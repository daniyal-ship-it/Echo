import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import {
  identityDiagnosticEnabled,
  inspectDatabaseIdentity,
} from '../lib/database-identity-diagnostic';
import type { Database } from '../lib/db';

test('identity diagnostic defaults off and rejects production, other branches and invalid expiry', () => {
  const now = Date.now();
  const env = {
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'feat/core-memory-exploration',
    ECHO_DB_IDENTITY_DIAGNOSTIC: '1',
    ECHO_DB_IDENTITY_UNTIL: new Date(now + 600000).toISOString(),
  };
  assert.equal(identityDiagnosticEnabled(env, now), true);
  for (const change of [
    { VERCEL_ENV: 'production' },
    { VERCEL_ENV: 'development' },
    { VERCEL_GIT_COMMIT_REF: 'main' },
    { ECHO_DB_IDENTITY_DIAGNOSTIC: undefined },
    { ECHO_DB_IDENTITY_UNTIL: 'invalid' },
    { ECHO_DB_IDENTITY_UNTIL: new Date(now - 1).toISOString() },
    { ECHO_DB_IDENTITY_UNTIL: new Date(now + 900001).toISOString() },
  ])
    assert.equal(identityDiagnosticEnabled({ ...env, ...change }, now), false);
  assert.equal(identityDiagnosticEnabled({}, now), false);
});
test('identity query uses a real read-only transaction and leaves session settings unchanged', async () => {
  const pg = await PGlite.create({ dataDir: 'memory://' });
  const wrap = (client: Pick<PGlite, 'query' | 'exec'>): Database => ({
    async query<T>(s: string, p: unknown[] = []) {
      return (await client.query<T>(s, p)).rows;
    },
    async exec(s) {
      await client.exec(s);
    },
    async transaction<T>(fn: (db: Database) => Promise<T>) {
      return pg.transaction((tx) => fn(wrap(tx)));
    },
    async close() {
      await pg.close();
    },
  });
  try {
    const before = await pg.query('SHOW search_path');
    const r = await inspectDatabaseIdentity(wrap(pg));
    assert.equal(r.read_only, true);
    assert.ok(r.database);
    assert.ok(r.effective_role);
    assert.deepEqual(
      Object.keys(r).sort(),
      [
        'database',
        'effective_role',
        'session_role',
        'search_path',
        'resolved_search_path',
        'read_only',
      ].sort(),
    );
    assert.deepEqual(await pg.query('SHOW search_path'), before);
    assert.equal(
      (await pg.query<{ transaction_read_only: string }>('SHOW transaction_read_only')).rows[0]
        .transaction_read_only,
      'off',
    );
  } finally {
    await pg.close();
  }
});
