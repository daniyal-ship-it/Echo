import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { transcribeMeeting, meetingStatus } from '../lib/meetings';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createDatabase } from '../lib/db';
import { POST, GET } from '../app/api/meetings/transcribe/route';
import {
  validateMeetingAudio,
  canonicalMeetingAudio,
  boundedBody,
  MAX_AUDIO_BYTES,
} from '../lib/meeting-audio';
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

test('real FFmpeg PCM WAV metadata is accepted and stripped without changing samples', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'echo-wav-'));
  try {
    const file = path.join(dir, 'fixture.wav');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=16000:cl=mono',
      '-t',
      '1',
      '-c:a',
      'pcm_s16le',
      '-metadata',
      'title=PRIVATE FIXTURE',
      file,
    ]);
    const bytes = await readFile(file);
    assert.ok(bytes.includes(Buffer.from('LIST')));
    assert.equal(validateMeetingAudio(bytes), 1);
    const canonical = canonicalMeetingAudio(bytes);
    assert.equal(canonical.length, 32044);
    assert.equal(validateMeetingAudio(canonical), 1);
    assert.ok(!Buffer.from(canonical).includes(Buffer.from('PRIVATE FIXTURE')));
    assert.ok(canonical.slice(44).every((b) => b === 0));
    const forged = Buffer.from(bytes);
    forged.writeUInt32LE(0xffffffff, forged.indexOf('LIST') + 4);
    assert.throws(() => validateMeetingAudio(forged));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('consent failure prevents dispatch; save failure rolls back memory and records uncertain audit', async (t) => {
  const db = await createDatabase('memory://');
  const previous = process.env.ECHO_OPENAI_API_KEY;
  process.env.ECHO_OPENAI_API_KEY = 'MOCK-ONLY-NOT-A-KEY';
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ text: 'MOCK transcript' });
  });
  const w = await workspace(db);
  const transaction = db.transaction.bind(db);
  let fail = 'audit_events',
    loseCommitAck = false;
  t.mock.method(db, 'transaction', async (fn: any) => {
    let wroteMemory = false;
    const result = await transaction(async (tx) => {
      const query = tx.query.bind(tx);
      return fn({
        ...tx,
        query: (sql: string, params: any[]) => {
          if (sql.includes('INSERT INTO ' + fail)) throw new Error('PRIVATE DATABASE ERROR');
          if (sql.includes('INSERT INTO memory_nodes')) wroteMemory = true;
          return query(sql, params);
        },
      });
    });
    if (loseCommitAck && wroteMemory) {
      loseCommitAck = false;
      throw new Error('COMMIT ACK LOST');
    }
    return result;
  });
  try {
    await assert.rejects(transcribeMeeting(db, w, wav(), 'Audit failure'));
    assert.equal(calls, 0);
    assert.equal(await meetingStatus(db, w, hash(wav())), null);
    fail = 'memory_nodes';
    await assert.rejects(transcribeMeeting(db, w, wav(), 'Save failure'), /could not be confirmed/);
    assert.equal(calls, 1);
    assert.equal((await meetingStatus(db, w, hash(wav())))!.status, 'uncertain');
    assert.equal(
      (await db.query('SELECT * FROM memory_nodes WHERE workspace_id=$1', [w])).length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "SELECT * FROM audit_events WHERE workspace_id=$1 AND action='meeting.transcription.save_failed'",
          [w],
        )
      ).length,
      1,
    );
    fail = 'unused';
    loseCommitAck = true;
    await assert.rejects(
      transcribeMeeting(db, w, wav(1, 22), 'Committed'),
      /could not be confirmed/,
    );
    const committed = await meetingStatus(db, w, hash(wav(1, 22)));
    assert.equal(committed!.status, 'completed');
    const beforeRepeat = calls;
    await transcribeMeeting(db, w, wav(1, 22), 'No repeat', committed!.attemptId);
    assert.equal(calls, beforeRepeat);
    await db.query('DELETE FROM workspaces WHERE id=$1', [w]);
    assert.equal(
      (await db.query('SELECT * FROM meeting_transcriptions WHERE workspace_id=$1', [w])).length,
      0,
    );
    assert.equal(
      (await db.query('SELECT * FROM audit_events WHERE workspace_id=$1', [w])).length,
      0,
    );
  } finally {
    if (previous === undefined) delete process.env.ECHO_OPENAI_API_KEY;
    else process.env.ECHO_OPENAI_API_KEY = previous;
    await db.close();
  }
});
