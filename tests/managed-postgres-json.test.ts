import { test } from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { managedPostgresOptions, serialiseJsonParameter } from '../lib/db';

// Regression: on managed PostgreSQL every jsonb value was stored double-encoded (a JSON string
// holding JSON text), so positions, originals and messages came back as strings and the
// memory view crashed. The local engine used by the other tests does not show this.
test('pre-serialised JSON parameters are passed through once, objects are serialised once', () => {
  assert.equal(serialiseJsonParameter('[1,2,3]'), '[1,2,3]');
  assert.equal(serialiseJsonParameter('{"a":1}'), '{"a":1}');
  assert.equal(serialiseJsonParameter([1, 2, 3]), '[1,2,3]');
  assert.equal(serialiseJsonParameter({ a: 1 }), '{"a":1}');
  const { types } = managedPostgresOptions();
  assert.equal(types.json.serialize, serialiseJsonParameter);
  assert.deepEqual(types.json.from, [114, 3802]);
});

// Runs only against a real PostgreSQL server: ECHO_TEST_POSTGRES_URL=postgres://… npm test
const url = process.env.ECHO_TEST_POSTGRES_URL;
test(
  'managed PostgreSQL stores and returns jsonb as arrays and objects',
  { skip: !url },
  async () => {
    const previous = process.env.DATABASE_SSL;
    process.env.DATABASE_SSL = 'disable';
    const sql = postgres(url!, managedPostgresOptions());
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(
          'CREATE TEMP TABLE echo_json_check(position jsonb, raw jsonb, plain json) ON COMMIT DROP',
        );
        await tx.unsafe('INSERT INTO echo_json_check(position,raw,plain) VALUES($1,$2,$3)', [
          JSON.stringify([0.1, 0.2, 0.3]),
          JSON.stringify({ title: 'note', tags: [] }),
          JSON.stringify([]),
        ] as never[]);
        const [row] = await tx.unsafe(
          'SELECT position,raw,plain,jsonb_typeof(position) AS p,jsonb_typeof(raw) AS r,json_typeof(plain) AS j FROM echo_json_check',
        );
        assert.deepEqual([row.p, row.r, row.j], ['array', 'object', 'array']);
        assert.deepEqual(row.position, [0.1, 0.2, 0.3]);
        assert.deepEqual(row.raw, { title: 'note', tags: [] });
        assert.deepEqual(row.plain, []);
      });
    } finally {
      await sql.end({ timeout: 2 });
      if (previous === undefined) delete process.env.DATABASE_SSL;
      else process.env.DATABASE_SSL = previous;
    }
  },
);
