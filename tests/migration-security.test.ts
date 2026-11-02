import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { MIGRATIONS } from '../lib/db';
async function fixture() {
  const db = await PGlite.create({ dataDir: 'memory://', extensions: { vector } });
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE ROLE unrelated; CREATE TABLE unrelated_data(id int); GRANT SELECT ON unrelated_data TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;`);
  return db;
}
async function apply(db: PGlite, inject?: (tx: Pick<PGlite, 'exec'>) => Promise<void>) {
  await db.transaction(async (tx) => {
    await tx.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz DEFAULT now())',
    );
    for (const version of MIGRATIONS) {
      if (
        (await tx.query('SELECT 1 FROM schema_migrations WHERE version=$1', [version])).rows.length
      )
        continue;
      if (version === '003_server_only_access') await inject?.(tx);
      await tx.exec(await readFile(`db/migrations/${version}.sql`, 'utf8'));
    }
  });
}
test('security migration protects all tables despite unsafe defaults and column grants; owner and rerun preserve data', async () => {
  const db = await fixture();
  try {
    await apply(db, async (tx) => {
      await tx.exec('GRANT SELECT(email) ON users TO PUBLIC, anon');
    });
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname <> 'unrelated_data'",
    );
    assert.equal(tables.rows.length, 22);
    assert.ok(tables.rows.every((t) => t.relrowsecurity));
    for (const role of ['anon', 'authenticated', 'service_role'])
      for (const t of tables.rows) {
        const r = await db.query<{ t: boolean; c: boolean }>(
          "SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') t,has_any_column_privilege($1,$2,'SELECT,INSERT,UPDATE,REFERENCES') c",
          [role, t.relname],
        );
        assert.deepEqual(r.rows[0], { t: false, c: false });
      }
    assert.equal(
      (
        await db.query<{ v: boolean }>(
          "SELECT has_table_privilege('anon','unrelated_data','SELECT') v",
        )
      ).rows[0].v,
      true,
    );
    await db.exec('CREATE ROLE future_browser; SET ROLE future_browser');
    assert.equal(
      (
        await db.query<{ v: boolean }>(
          "SELECT has_function_privilege('public.invalidate_memory_intelligence()','EXECUTE') v",
        )
      ).rows[0].v,
      false,
    );
    await assert.rejects(db.query('SELECT * FROM users'), { code: '42501' });
    await db.exec('RESET ROLE');
    await db.exec(
      "INSERT INTO users(id,email,name,password_hash) VALUES ('00000000-0000-0000-0000-000000000001','fixture@example.test','Fixture','unused')",
    );
    await apply(db);
    assert.equal((await db.query('SELECT * FROM users')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM schema_migrations')).rows.length, 3);
    const f = await db.query<{ prosecdef: boolean; proconfig: string[] }>(
      "SELECT prosecdef,proconfig FROM pg_proc WHERE proname='invalidate_memory_intelligence'",
    );
    assert.equal(f.rows[0].prosecdef, false);
    assert.ok(f.rows[0].proconfig.includes('search_path=pg_catalog, public'));
  } finally {
    await db.close();
  }
});
test('inherited privileges fail closed and roll back the entire fresh migration', async () => {
  const db = await fixture();
  try {
    await db.exec('CREATE ROLE inherited_reader; GRANT inherited_reader TO anon');
    await assert.rejects(
      apply(db, async (tx) => {
        await tx.exec('GRANT SELECT(email) ON users TO inherited_reader');
      }),
      /effective privileges remain/,
    );
    assert.equal(
      (await db.query<{ v: string | null }>("SELECT to_regclass('public.users')::text v")).rows[0]
        .v,
      null,
    );
    assert.equal(
      (await db.query("SELECT 1 FROM pg_extension WHERE extname='vector'")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query<{ v: string | null }>(
          "SELECT to_regclass('public.schema_migrations')::text v",
        )
      ).rows[0].v,
      null,
    );
  } finally {
    await db.close();
  }
});
