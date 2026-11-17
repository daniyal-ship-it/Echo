import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createDatabase } from '../lib/db';
import { POST, GET } from '../app/api/meetings/transcribe/route';
import { validateMeetingAudio, boundedBody, MAX_AUDIO_BYTES } from '../lib/meeting-audio';
import { meetingSuite, wav } from './fixtures/meeting-suite';
import { workspace } from './fixtures/collaboration-suite';
import { createSession, SESSION_COOKIE, hash } from '../lib/security';
test('WAV validation enforces actual encoding, framing, byte and duration limits', async () => {
  assert.equal(validateMeetingAudio(wav()), 1);
  for (const b of [
    new Uint8Array(),
    wav(91),
    new Uint8Array(MAX_AUDIO_BYTES + 1),
    new Uint8Array([1, 2, 3]),
  ])
    assert.throws(() => validateMeetingAudio(b));
  const fake = wav();
  fake[22] = 2;
  assert.throws(() => validateMeetingAudio(fake));
  const forged = wav();
  forged[4] = 0;
  assert.throws(() => validateMeetingAudio(forged));
  await assert.rejects(
    boundedBody(new Request('http://local', { method: 'POST', body: new Uint8Array(20) }), 10),
  );
});
test('meeting durable attempts: isolation, duplicates, uncertain recovery and source persistence', async (t) => {
  const db = await createDatabase('memory://');
  try {
    await meetingSuite(t, db);
  } finally {
    await db.close();
  }
});
test('meeting API requires session, origin, consent and bounded uploads before provider dispatch', async (t) => {
  const db = await createDatabase('memory://');
  const global = globalThis as unknown as { echoDatabase?: Promise<typeof db> };
  const saved = global.echoDatabase;
  global.echoDatabase = Promise.resolve(db);
  const old = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = 'http://localhost';
  const w = await workspace(db);
  const [owner] = await db.query<{ owner_id: string }>(
    'SELECT owner_id FROM workspaces WHERE id=$1',
    [w],
  );
  const token = await createSession(db, owner.owner_id);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    throw new Error('No dispatch expected');
  });
  const send = (headers: Record<string, string>, body: Uint8Array = wav()) =>
    POST(
      new NextRequest('http://localhost/api/meetings/transcribe', {
        method: 'POST',
        headers,
        body: new Uint8Array(body),
      }),
    );
  const auth = { origin: 'http://localhost', cookie: `${SESSION_COOKIE}=${token}` };
  try {
    assert.equal((await send({ origin: 'http://localhost' })).status, 401);
    assert.equal((await send({ ...auth, origin: 'http://attacker.invalid' })).status, 403);
    assert.equal((await send(auth)).status, 400);
    assert.equal(
      (
        await send(
          { ...auth, 'x-echo-meeting-consent': 'true' },
          new Uint8Array(MAX_AUDIO_BYTES + 1),
        )
      ).status,
      413,
    );
    assert.equal(
      (await send({ ...auth, 'x-echo-meeting-consent': 'true' }, new Uint8Array([1, 2]))).status,
      415,
    );
    assert.equal(
      (await send({ ...auth, 'x-echo-meeting-consent': 'true', 'x-echo-retry-id': 'invalid' }))
        .status,
      400,
    );
    assert.equal(
      (
        await GET(
          new NextRequest('http://localhost/api/meetings/transcribe', {
            headers: { cookie: auth.cookie, 'x-echo-audio-hash': hash(wav()) },
          }),
        )
      ).status,
      200,
    );
    assert.equal(calls, 0);
  } finally {
    global.echoDatabase = saved;
    if (old === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = old;
    await db.close();
  }
});
