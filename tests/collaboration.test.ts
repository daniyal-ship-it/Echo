import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, type Database } from '../lib/db';
import { scenarios } from './fixtures/collaboration-suite';
let db: Database;
before(async () => {
  db = await createDatabase('memory://');
});
after(async () => {
  await db?.close();
});
for (const [name, run] of Object.entries(scenarios)) test(name, () => run(db));

test('failed stage reservation rolls back calls, idempotency record and turn state atomically', async () => {
  const { fixture, advance } = await import('./fixtures/collaboration-suite');
  const { advanceCollaboration, getCollaboration } = await import('../lib/collaboration');
  const f = await fixture(db);
  const failing: Database = {
    ...db,
    transaction: (fn) =>
      db.transaction((tx) => {
        let inserts = 0;
        return fn({
          ...tx,
          query: async (sql, params) => {
            if (sql.includes('INSERT INTO collaboration_calls') && ++inserts === 2)
              throw new Error('Injected reservation failure');
            return tx.query(sql, params);
          },
        });
      }),
  };
  await assert.rejects(
    advanceCollaboration(failing, f.w, f.thread.id, advance(f.turn), f.services),
    /Injected/,
  );
  const state = await getCollaboration(db, f.w, f.thread.id);
  assert.equal(state.turns[0].status, 'queued');
  assert.equal(state.turns[0].calls.length, 0);
  assert.equal(
    (await db.query('SELECT * FROM collaboration_steps WHERE turn_id=$1', [f.turn])).length,
    0,
  );
  assert.equal(f.sent.length, 0);
});
