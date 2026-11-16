// Test-only instrumentation. Production contains no identity override. All SQL,
// transaction state, backend PIDs, locks, timeouts, DDL and rollback are real.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { Database } from '../../lib/db';
import {
  developmentMigrationTransaction,
  DEVELOPMENT_SYSTEM_IDENTIFIER,
} from '../../lib/migration-target';

export async function testMigrationGuardPostgres(
  t: TestContext,
  db: Database,
  route: 'direct' | 'session' = 'direct',
) {
  const saved = { ...process.env };
  const attributedUrl =
    route === 'direct'
      ? 'postgresql://postgres:synthetic-test-only@db.dtcxlxehqiuhmhuypqbm.supabase.co:5432/postgres'
      : 'postgresql://postgres.dtcxlxehqiuhmhuypqbm:synthetic-test-only@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
  try {
    for (const k of [
      'DATABASE_SSL',
      'NODE_TLS_REJECT_UNAUTHORIZED',
      'VERCEL_ENV',
      'VERCEL_TARGET_ENV',
      'VERCEL_GIT_COMMIT_REF',
      'PGHOST',
      'PGPORT',
      'PGDATABASE',
      'PGUSER',
      'PGSERVICE',
      'PGOPTIONS',
      'PGSSLMODE',
    ])
      delete process.env[k];
    // db was already constructed against asserted loopback; this URL is ONLY
    // policy input. It is never passed to a driver or used for a connection.
    process.env.DATABASE_URL = attributedUrl;
    function instrument(mode: 'match' | 'mismatch' | 'slow' = 'match') {
      const checks: { pid: number; readonly: string; timeout: string }[] = [];
      const lockPids: number[] = [];
      let transactions = 0;
      const wrap = (client: Database, phase = 0): Database => ({
        async query<T>(sql: string, params?: unknown[]) {
          if (sql.includes('pg_control_system')) {
            const [state] = await client.query<{ pid: number; readonly: string; timeout: string }>(
              "SELECT pg_backend_pid() AS pid, current_setting('transaction_read_only') AS readonly, current_setting('statement_timeout') AS timeout",
            );
            checks.push(state);
            if (mode === 'slow' && phase === 1) await client.query('SELECT pg_sleep(30)');
            const rows = await client.query<Record<string, unknown>>(sql, params);
            return rows.map((row) => ({
              ...row,
              // Only identity fields different on the disposable cluster are simulated.
              database: 'postgres',
              system_identifier:
                mode === 'mismatch' && phase === 2
                  ? 'wrong-cluster'
                  : DEVELOPMENT_SYSTEM_IDENTIFIER,
            })) as T[];
          }
          const result = await client.query<T>(sql, params);
          if (sql.includes('pg_advisory_xact_lock')) {
            const [state] = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
            lockPids.push(state.pid);
          }
          return result;
        },
        exec: (sql) => client.exec(sql),
        transaction: (fn) => client.transaction((tx) => fn(wrap(tx, ++transactions))),
        close: async () => {},
      });
      return { connection: wrap(db), checks, lockPids };
    }
    const absent = async (name: string) => {
      const [row] = await db.query<{ absent: boolean }>(
        'SELECT to_regclass($1) IS NULL AS absent',
        ['public.' + name],
      );
      assert.equal(row.absent, true);
    };
    await t.test(
      'real guard: identity, advisory lock and DDL use the same backend; precheck is read-only and bounded',
      async () => {
        const probe = instrument();
        await developmentMigrationTransaction(
          probe.connection,
          'echo-dev',
          attributedUrl,
          async (tx) => {
            const [row] = await tx.query<{ pid: number; readonly: string; timeout: string }>(
              "SELECT pg_backend_pid() AS pid, current_setting('transaction_read_only') AS readonly, current_setting('statement_timeout') AS timeout",
            );
            assert.equal(probe.checks.length, 2);
            assert.equal(probe.checks[0].readonly, 'on');
            assert.equal(probe.checks[0].timeout, '3s');
            assert.equal(probe.checks[1].readonly, 'off');
            assert.equal(row.readonly, 'off');
            assert.equal(row.timeout, '1min');
            assert.equal(row.pid, probe.checks[1].pid);
            assert.deepEqual(probe.lockPids, [row.pid]);
            // A second real connection must not acquire this transaction's lock.
            await db.transaction(async (other) => {
              const [lock] = await other.query<{ acquired: boolean }>(
                'SELECT pg_try_advisory_xact_lock(68182041) AS acquired',
              );
              assert.equal(lock.acquired, false);
            });
            await tx.exec(
              'CREATE TABLE guard_driver_success(id integer, backend_pid integer DEFAULT pg_backend_pid())',
            );
            const [written] = await tx.query<{ backend_pid: number }>(
              'INSERT INTO guard_driver_success(id) VALUES (1) RETURNING backend_pid',
            );
            assert.equal(written.backend_pid, row.pid);
          },
        );
        await db.exec('DROP TABLE guard_driver_success');
      },
    );
    await t.test(
      'real guard: identity changes on migration connection; callback never starts and lock releases on rollback',
      async () => {
        const probe = instrument('mismatch');
        let called = false;
        await assert.rejects(
          developmentMigrationTransaction(
            probe.connection,
            'echo-dev',
            attributedUrl,
            async (tx) => {
              called = true;
              await tx.exec('CREATE TABLE guard_driver_forbidden(id integer)');
            },
          ),
          (e: unknown) => (e as { code: string }).code === 'DB_MIGRATION_IDENTITY_REJECTED',
        );
        assert.equal(called, false);
        assert.equal(probe.checks.length, 2);
        await absent('guard_driver_forbidden');
        await db.transaction(async (tx) => {
          const [lock] = await tx.query<{ acquired: boolean }>(
            'SELECT pg_try_advisory_xact_lock(68182041) AS acquired',
          );
          assert.equal(lock.acquired, true);
        });
      },
    );
    await t.test('real guard: DDL error rolls back earlier statements', async () => {
      const probe = instrument();
      await assert.rejects(
        developmentMigrationTransaction(probe.connection, 'echo-dev', attributedUrl, async (tx) => {
          await tx.exec('CREATE TABLE guard_driver_rollback(id integer)');
          await tx.query('SELECT 1 / 0');
        }),
        (e: unknown) => (e as { code: string }).code === '22012',
      );
      await absent('guard_driver_rollback');
    });
    await t.test(
      'real guard: advisory contention hits existing five-second lock timeout before DDL',
      async () => {
        // Keep the lock on a different connection while the entire guard runs.
        await db.transaction(async (holder) => {
          await holder.query('SELECT pg_advisory_xact_lock(68182041)');
          const probe = instrument();
          let called = false;
          await assert.rejects(
            developmentMigrationTransaction(
              probe.connection,
              'echo-dev',
              attributedUrl,
              async () => {
                called = true;
              },
            ),
            (e: unknown) => (e as { code: string }).code === '55P03',
          );
          assert.equal(called, false);
          assert.equal(probe.checks.length, 1);
        });
      },
    );
    await t.test(
      'real guard: stalled initial identity query is cancelled by PostgreSQL before migration transaction',
      async () => {
        const probe = instrument('slow');
        const start = Date.now();
        let called = false;
        await assert.rejects(
          developmentMigrationTransaction(probe.connection, 'echo-dev', attributedUrl, async () => {
            called = true;
          }),
          (e: unknown) => (e as { code: string }).code === 'DB_MIGRATION_IDENTITY_REJECTED',
        );
        assert.equal(called, false);
        assert.equal(probe.checks.length, 1);
        assert.ok(Date.now() - start < 15000, '3s server timeout must cancel 30s test query');
        assert.deepEqual(probe.lockPids, []);
      },
    );
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}
