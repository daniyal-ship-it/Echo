import type { Database } from './db';
import { hash, HttpError, uuid } from './security';
import { storeMemory } from './memories';
import { boundedBody, validateMeetingAudio } from './meeting-audio';
export const TRANSCRIPTION_MODEL = 'gpt-transcribe';
type Attempt = {
  id: string;
  status: string;
  attempt_token: string;
  attempts: number;
  memory_id: string | null;
  expired: boolean;
};
export async function meetingStatus(db: Database, workspace: string, fingerprint: string) {
  if (!/^[a-f0-9]{64}$/.test(fingerprint))
    throw new HttpError(400, 'Invalid recording identifier.');
  const [row] = await db.query<Attempt>(
    `SELECT id,status,attempt_token,attempts,memory_id,
    updated_at < now()-interval '2 minutes' AS expired FROM meeting_transcriptions WHERE workspace_id=$1 AND fingerprint=$2`,
    [workspace, fingerprint],
  );
  if (!row) return null;
  const [memory] = row.memory_id
    ? await db.query<{ id: string }>(
        'SELECT id FROM memory_nodes WHERE workspace_id=$1 AND id=$2',
        [workspace, row.memory_id],
      )
    : [];
  return {
    fingerprint,
    status: row.status === 'running' && row.expired ? 'uncertain' : row.status,
    attemptId: row.attempt_token,
    attempts: row.attempts,
    memoryId: memory?.id ?? null,
    removed: row.status === 'completed' && !memory,
    model: TRANSCRIPTION_MODEL,
  };
}
export async function transcribeMeeting(
  db: Database,
  workspace: string,
  audio: Uint8Array,
  title: string,
  retryId?: string,
) {
  const duration = validateMeetingAudio(audio),
    fingerprint = hash(audio);
  const key = process.env.ECHO_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const token = uuid();
  const claim = await db.transaction(async (tx) => {
    await tx.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [workspace]);
    const old = await meetingStatus(tx, workspace, fingerprint);
    if (old && (!retryId || old.status === 'completed' || old.status === 'running')) return false;
    if (old && (retryId !== old.attemptId || old.attempts >= 2)) return false;
    if (!old && retryId)
      throw new HttpError(409, 'This retry no longer matches the saved attempt.');
    if (!key)
      throw new HttpError(503, 'OpenAI transcription is not configured. No audio was sent.');
    await tx.query(
      `INSERT INTO meeting_transcriptions(id,workspace_id,fingerprint,status,attempt_token,attempts)
      VALUES($1,$2,$3,'running',$4,1) ON CONFLICT(workspace_id,fingerprint) DO UPDATE SET
      status='running',attempt_token=$4,attempts=meeting_transcriptions.attempts+1,updated_at=now()`,
      [uuid(), workspace, fingerprint, token],
    );
    return true;
  });
  if (!claim) return meetingStatus(db, workspace, fingerprint);
  let text: string;
  try {
    const form = new FormData();
    form.set('model', TRANSCRIPTION_MODEL);
    // Never transmit the user's filename or other client metadata to the provider.
    form.set('file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'recording.wav');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(45000),
      cache: 'no-store',
    });
    if (!response.ok) {
      await response.body?.cancel();
      const status = [400, 401, 403, 404, 413, 415, 422, 429].includes(response.status)
        ? 'failed'
        : 'uncertain';
      await db.query(
        'UPDATE meeting_transcriptions SET status=$1,updated_at=now() WHERE workspace_id=$2 AND fingerprint=$3 AND attempt_token=$4',
        [status, workspace, fingerprint, token],
      );
      return meetingStatus(db, workspace, fingerprint);
    }
    const payload = JSON.parse(
      new TextDecoder().decode(await boundedBody(response, 256000, 10000)),
    );
    text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (!text || text.length > 60000) throw new Error('Invalid transcript');
  } catch {
    await db.query(
      "UPDATE meeting_transcriptions SET status='uncertain',updated_at=now() WHERE workspace_id=$1 AND fingerprint=$2 AND attempt_token=$3",
      [workspace, fingerprint, token],
    );
    return meetingStatus(db, workspace, fingerprint);
  }
  // Late provider results cannot publish over a newer explicitly approved attempt.
  await db.transaction(async (tx) => {
    await tx.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [workspace]);
    const [current] = await tx.query<{ attempt_token: string }>(
      'SELECT attempt_token FROM meeting_transcriptions WHERE workspace_id=$1 AND fingerprint=$2 FOR UPDATE',
      [workspace, fingerprint],
    );
    if (current?.attempt_token !== token) return;
    const memory = await storeMemory(tx, workspace, {
      source: 'meeting-audio',
      sourceId: fingerprint,
      title: `Machine transcript: ${title}`,
      content: text,
      raw: {
        format: 'echo-meeting-transcript-v1',
        machineTranscribed: true,
        provider: 'openai',
        model: TRANSCRIPTION_MODEL,
        audioSha256: fingerprint,
        audioRetained: false,
        durationSeconds: duration,
        transcribedAt: new Date().toISOString(),
        transcript: text,
      },
      messages: [],
      sourceAt: null,
      kind: 'note',
      tags: ['meeting', 'machine-transcript'],
      region: 'temporal',
    });
    await tx.query(
      "UPDATE meeting_transcriptions SET status='completed',memory_id=$1,updated_at=now() WHERE workspace_id=$2 AND fingerprint=$3 AND attempt_token=$4",
      [memory.id, workspace, fingerprint, token],
    );
  });
  return meetingStatus(db, workspace, fingerprint);
}
