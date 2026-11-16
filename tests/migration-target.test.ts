import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  requireDevelopmentTarget,
  verifyDevelopmentIdentity,
  developmentMigrationTransaction,
  DEVELOPMENT_SYSTEM_IDENTIFIER,
} from '../lib/migration-target';
import { createDatabase, type Database } from '../lib/db';
import { sanitiseDatabaseError } from '../lib/database-diagnostics';

const url =
  'postgresql://postgres:synthetic-test-only@db.dtcxlxehqiuhmhuypqbm.supabase.co:5432/postgres';
const identity = {
  system_identifier: DEVELOPMENT_SYSTEM_IDENTIFIER,
  database: 'postgres',
  effective_role: 'postgres',
  session_role: 'postgres',
  creation_schema: 'public',
};
const rejectCode = (code: string) => (e: unknown) => {
  assert.equal(sanitiseDatabaseError(e).code, code);
  assert.ok(!JSON.stringify(e).includes('synthetic-test-only'));
  return true;
};
function fixture(rows: unknown[] = [identity], txRows = rows) {
  const events: string[] = [];
  let transactions = 0;
  const make = (transaction: boolean): Database => ({
    async query<T>(sql: string) {
      events.push((transaction ? 'tx:' : 'pool:') + sql);
      return (
        sql.includes('pg_control_system') ? (transaction && transactions > 1 ? txRows : rows) : []
      ) as T[];
    },
    async exec(sql) {
      events.push('exec:' + sql);
    },
    async transaction(fn) {
      transactions++;
      events.push('begin');
      try {
        const result = await fn(make(true));
        events.push('commit');
        return result;
      } catch (error) {
        events.push('rollback');
        throw error;
      }
    },
    async close() {},
  });
  return { db: make(false), events };
}

test('migration attribution requires explicit authorization and pinned direct TLS endpoint', () => {
  assert.equal(requireDevelopmentTarget('echo-dev', { DATABASE_URL: url }), url);
  for (const target of [undefined, '', 'production', 'echo'])
    assert.throws(
      () => requireDevelopmentTarget(target, { DATABASE_URL: url }),
      rejectCode('DB_MIGRATION_AUTH_REQUIRED'),
    );
  for (const databaseUrl of [
    undefined,
    '',
    'invalid',
    url.replace('dtcxlxehqiuhmhuypqbm', 'pyidklztsnowarqumtki'),
    url.replace('db.dtcxlxehqiuhmhuypqbm.supabase.co', 'aws-0-eu-central-1.pooler.supabase.com'),
    url.replace('.supabase.co:', '.supabase.co.attacker.invalid:'),
    url.replace(':5432/', ':6543/'),
    url.replace('/postgres', '/other'),
    url.replace('postgres:synthetic', 'other:synthetic'),
    url + '?host=another',
    url + '?sslmode=disable',
    url + '#fragment',
  ])
    assert.throws(
      () => requireDevelopmentTarget('echo-dev', { DATABASE_URL: databaseUrl }),
      rejectCode('DB_MIGRATION_TARGET_INVALID'),
    );
  for (const extra of [
    { DATABASE_SSL: 'disable' },
    { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { VERCEL_ENV: 'production' },
    { VERCEL_TARGET_ENV: 'production' },
    { VERCEL_GIT_COMMIT_REF: 'main' },
    { PGHOST: 'another' },
    { PGOPTIONS: '-c role=other' },
  ])
    assert.throws(
      () => requireDevelopmentTarget('echo-dev', { DATABASE_URL: url, ...extra }),
      rejectCode('DB_MIGRATION_TARGET_INVALID'),
    );
});

test('cluster identity is exact text; missing, multiple, changed and unauthorized identities fail closed', async () => {
  await verifyDevelopmentIdentity(fixture().db);
  for (const rows of [
    [],
    [identity, identity],
    [{}],
    ...Object.keys(identity).map((key) => [{ ...identity, [key]: 'wrong' }]),
    [{ ...identity, system_identifier: Number(DEVELOPMENT_SYSTEM_IDENTIFIER) }],
  ])
    await assert.rejects(
      verifyDevelopmentIdentity(fixture(rows).db),
      rejectCode('DB_MIGRATION_IDENTITY_REJECTED'),
    );
  await assert.rejects(
    verifyDevelopmentIdentity({
      query: async () => {
        throw new Error('synthetic-test-only driver secret');
      },
    }),
    rejectCode('DB_MIGRATION_IDENTITY_REJECTED'),
  );
});

test('managed migration checks the actual transaction after locking, prevents changed identity DDL and rolls back', async () => {
  const saved = { ...process.env };
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
    process.env.DATABASE_URL = url;
    const good = fixture();
    await developmentMigrationTransaction(good.db, 'echo-dev', url, async (tx) => {
      await tx.exec('DDL fixture');
    });
    const lock = good.events.findIndex((e) => e.includes('pg_advisory_xact_lock'));
    const check = good.events.findLastIndex(
      (e) => e.startsWith('tx:') && e.includes('pg_control_system'),
    );
    assert.ok(lock > 0 && check > lock && good.events.indexOf('exec:DDL fixture') > check);
    assert.equal(good.events.at(-1), 'commit');
    const wrong = fixture([identity], [{ ...identity, system_identifier: 'different-cluster' }]);
    await assert.rejects(
      developmentMigrationTransaction(wrong.db, 'echo-dev', url, async () => {
        assert.fail('DDL must not run');
      }),
      rejectCode('DB_MIGRATION_IDENTITY_REJECTED'),
    );
    assert.equal(wrong.events.at(-1), 'rollback');
    const failed = fixture();
    await assert.rejects(
      developmentMigrationTransaction(failed.db, 'echo-dev', url, async () => {
        throw new Error('DDL failure');
      }),
      /DDL failure/,
    );
    assert.equal(failed.events.at(-1), 'rollback');
    const changed = fixture();
    const transaction = changed.db.transaction;
    changed.db.transaction = async (fn) => {
      process.env.DATABASE_URL = url + '?host=changed';
      return transaction(fn);
    };
    await assert.rejects(
      developmentMigrationTransaction(changed.db, 'echo-dev', url, async () => {
        assert.fail('Changed configuration must stop before DDL');
      }),
      rejectCode('DB_MIGRATION_TARGET_INVALID'),
    );
    assert.equal(changed.events.at(-1), 'rollback');
    // Neither no URL nor a local target may silently fall back to PGlite when --apply is set.
    delete process.env.DATABASE_URL;
    await assert.rejects(
      createDatabase(undefined, { applyManagedMigrations: true, migrationTarget: 'echo-dev' }),
      /authorized development target/,
    );
    process.env.DATABASE_URL = url;
    await assert.rejects(
      createDatabase(undefined, { applyManagedMigrations: true }),
      /explicit echo-dev authorization/,
    );
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
