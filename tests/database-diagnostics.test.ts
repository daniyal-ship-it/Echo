import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/[...path]/route';
import { inspectManagedMigrations, requireCurrentManagedSchema, type Database } from '../lib/db';
import { sanitiseDatabaseError, validateDatabaseUrl } from '../lib/database-diagnostics';

test('database diagnostics emit fixed reasons and codes, never raw error content', () => {
  const privateText = 'synthetic-private-password-cookie-and-source';
  const error = Object.assign(new Error(privateText), {
    code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    detail: privateText,
    query: privateText,
    parameters: [privateText],
    stack: privateText,
  });
  const safe = sanitiseDatabaseError(error);
  assert.equal(safe.code, 'UNABLE_TO_VERIFY_LEAF_SIGNATURE');
  assert.match(safe.reason, /TLS certificate chain/);
  assert.ok(!JSON.stringify(safe).includes(privateText));
  const sql = sanitiseDatabaseError(
    Object.assign(new Error(privateText), {
      name: 'PostgresError',
      code: '42501',
      position: '104',
    }),
  );
  assert.equal(sql.sqlstate, '42501');
  assert.equal(sql.statement_position, 104);
  assert.match(sql.reason, /permission/);
  const unknown = sanitiseDatabaseError({
    name: privateText,
    code: privateText,
    message: privateText,
  });
  assert.equal(unknown.code, null);
  assert.equal(unknown.error_class, 'UnknownError');
  assert.ok(!JSON.stringify(unknown).includes(privateText));
});

test('connection URL validation rejects missing, malformed and placeholder values without echoing them', () => {
  for (const [value, code] of [
    [undefined, 'DB_URL_MISSING'],
    ['synthetic-invalid-connection-secret', 'DB_URL_INVALID'],
    ['https://database.invalid/fixture', 'DB_URL_INVALID'],
    ['postgresql://fixture:test-only-password@database.invalid/fixture', 'DB_URL_PLACEHOLDER'],
  ] as const) {
    assert.throws(
      () => validateDatabaseUrl(value),
      (error) => {
        assert.equal(sanitiseDatabaseError(error).code, code);
        assert.ok(!String(error).includes(value || 'undefined'));
        return true;
      },
    );
  }
  // Validation only: no connection is opened to this synthetic local fixture URL.
  assert.doesNotThrow(() =>
    validateDatabaseUrl('postgresql://fixture:test-only-password@127.0.0.1/fixture'),
  );
});

test('managed migration inspection and pending-schema rejection never execute writes', async () => {
  const queries: string[] = [];
  const db = {
    async query(sql: string) {
      queries.push(sql);
      assert.match(sql, /^SELECT /);
      return sql.includes('to_regclass') ? [{ present: true }] : [{ version: '001_foundation' }];
    },
    async exec() {
      assert.fail('Schema inspection must not write');
    },
    async transaction() {
      assert.fail('Schema inspection must not start migration transaction');
    },
    async close() {},
  } as Database;
  const state = await inspectManagedMigrations(db);
  assert.deepEqual(state, [
    { version: '001_foundation', applied: true },
    { version: '002_memory_intelligence', applied: false },
  ]);
  assert.throws(
    () => requireCurrentManagedSchema(state),
    (error) => sanitiseDatabaseError(error).code === 'DB_MIGRATION_REQUIRED',
  );
  assert.equal(queries.length, 2);
  requireCurrentManagedSchema(state.map((row) => ({ ...row, applied: true })));
});

test('health failure remains generic and carries the correlation ID from private diagnostics', async () => {
  const saved = process.env.DATABASE_URL;
  const originalLog = console.error;
  const logs: string[] = [];
  const secret = 'synthetic-invalid-database-secret';
  try {
    process.env.DATABASE_URL = secret;
    console.error = (message) => {
      logs.push(String(message));
    };
    const response = await GET(new NextRequest('http://127.0.0.1/api/health'), {
      params: Promise.resolve({ path: ['health'] }),
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: 'The operation failed. Your existing data has been preserved.',
    });
    const requestId = response.headers.get('x-echo-request-id');
    assert.match(requestId || '', /^[0-9a-f-]{36}$/);
    const events = logs.map((line) => JSON.parse(line));
    assert.ok(
      events.some(
        (e) =>
          e.event === 'database_initialization_failed' &&
          e.stage === 'configuration' &&
          e.code === 'DB_URL_INVALID' &&
          e.request_id === requestId,
      ),
    );
    assert.ok(events.some((e) => e.event === 'api_error' && e.request_id === requestId));
    assert.ok(!logs.join('').includes(secret));
  } finally {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
    console.error = originalLog;
  }
});
