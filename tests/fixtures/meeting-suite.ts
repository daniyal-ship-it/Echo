import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { Database } from '../../lib/db';
import { transcribeMeeting, meetingStatus } from '../../lib/meetings';
import { workspace } from './collaboration-suite';
import { hash } from '../../lib/security';
import { memoryDetail, listMemories } from '../../lib/memories';
export function wav(seconds = 1, sample = 1) {
  const b = Buffer.alloc(44 + Math.floor(seconds * 32000));
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(b.length - 44, 40);
  b.fill(sample, 44);
  return new Uint8Array(b);
}
export async function meetingSuite(t: TestContext, db: Database) {
  const previous = process.env.ECHO_OPENAI_API_KEY;
  process.env.ECHO_OPENAI_API_KEY = 'TEST-NOT-A-KEY';
  const w = await workspace(db),
    other = await workspace(db);
  let calls = 0,
    mode = 'ok';
  let unblock: (() => void) | undefined, entered: (() => void) | undefined;
  const mock = t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://api.openai.com/v1/audio/transcriptions');
    calls++;
    assert.equal((init.body as FormData).get('model'), 'gpt-transcribe');
    assert.equal(((init.body as FormData).get('file') as File).name, 'recording.wav');
    if (mode === 'hold') {
      entered?.();
      await new Promise<void>((r) => {
        unblock = r;
      });
    }
    if (mode === 'network') throw new Error('PRIVATE PROVIDER ERROR');
    if (mode === '429') return new Response('PRIVATE BODY', { status: 429 });
    if (mode === 'malformed') return Response.json({ notText: true });
    return Response.json({ text: 'MOCK transcript: iridescent notebook meeting on Friday.' });
  });
  try {
    const audio = wav();
    const first = await transcribeMeeting(db, w, audio, 'Team');
    assert.equal(first?.status, 'completed');
    assert.equal(calls, 1);
    assert.equal(
      (await transcribeMeeting(db, w, audio, 'Changed title'))?.memoryId,
      first?.memoryId,
    );
    assert.equal(calls, 1);
    const memory = await memoryDetail(db, w, first!.memoryId!);
    assert.equal(memory.region, 'temporal');
    assert.equal(memory.source, 'meeting-audio');
    assert.equal((memory.raw as any).audioRetained, false);
    assert.equal((memory.raw as any).machineTranscribed, true);
    assert.equal(memory.source_at, null);
    assert.match(memory.content, /MOCK transcript/);
    assert.equal(await meetingStatus(db, other, hash(audio)), null);
    await assert.rejects(memoryDetail(db, other, first!.memoryId!), /not found/);
    assert.equal((await listMemories(db, w, new URLSearchParams({ q: 'iridescent' }))).total, 1);
    mode = 'hold';
    const slow = wav(1, 2);
    const start = new Promise<void>((r) => {
      entered = r;
    });
    const active = transcribeMeeting(db, w, slow, 'Concurrent');
    await start;
    const duplicate = await transcribeMeeting(db, w, slow, 'Concurrent');
    assert.equal(duplicate?.status, 'running');
    assert.equal(calls, 2);
    unblock!();
    await active;
    mode = 'network';
    const failed = wav(1, 3);
    const uncertain = await transcribeMeeting(db, w, failed, 'Uncertain');
    assert.equal(uncertain?.status, 'uncertain');
    const before = calls;
    await transcribeMeeting(db, w, failed, 'No implicit retry');
    assert.equal(calls, before);
    mode = 'ok';
    const recovered = await transcribeMeeting(db, w, failed, 'Retry', uncertain!.attemptId);
    assert.equal(recovered?.status, 'completed');
    assert.equal(recovered?.attempts, 2);
    mode = '429';
    assert.equal((await transcribeMeeting(db, w, wav(1, 4), 'Rate limit'))?.status, 'failed');
    mode = 'malformed';
    assert.equal((await transcribeMeeting(db, w, wav(1, 5), 'Invalid'))?.status, 'uncertain');
    const exhaustedAudio = wav(1, 7);
    const rejected = await transcribeMeeting(db, w, exhaustedAudio, 'Rejected');
    await assert.rejects(
      transcribeMeeting(db, other, exhaustedAudio, 'Foreign retry', rejected!.attemptId),
      /no longer matches/,
    );
    const second = await transcribeMeeting(
      db,
      w,
      exhaustedAudio,
      'Explicit second',
      rejected!.attemptId,
    );
    const countAfterTwo = calls;
    await transcribeMeeting(db, w, exhaustedAudio, 'No third', second!.attemptId);
    assert.equal(calls, countAfterTwo);
    assert.equal(second!.attempts, 2);
    // Simulate an interrupted worker. Recovery is explicit; stale completion cannot overwrite it.
    mode = 'hold';
    const lateAudio = wav(1, 6);
    const lateStarted = new Promise<void>((r) => {
      entered = r;
    });
    const late = transcribeMeeting(db, w, lateAudio, 'Old');
    await lateStarted;
    await db.query(
      "UPDATE meeting_transcriptions SET updated_at=now()-interval '3 minutes' WHERE workspace_id=$1 AND fingerprint=$2",
      [w, hash(lateAudio)],
    );
    const stale = await meetingStatus(db, w, hash(lateAudio));
    assert.equal(stale?.status, 'uncertain');
    mode = 'ok';
    await transcribeMeeting(db, w, lateAudio, 'Recovered', stale!.attemptId);
    unblock!();
    await late;
    const result = await meetingStatus(db, w, hash(lateAudio));
    assert.equal(
      (await memoryDetail(db, w, result!.memoryId!)).title,
      'Machine transcript: Recovered',
    );
  } finally {
    mock.mock.restore();
    if (previous === undefined) delete process.env.ECHO_OPENAI_API_KEY;
    else process.env.ECHO_OPENAI_API_KEY = previous;
  }
}
