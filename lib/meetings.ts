import type { Database } from './db';
import { audit, hash, HttpError, uuid } from './security';
import { storeMemory } from './memories';
import { boundedBody, validateMeetingAudio, canonicalMeetingAudio } from './meeting-audio';
export const TRANSCRIPTION_MODEL = 'gpt-transcribe';
export const MEETING_CONSENT_POLICY = 'meeting-transcription-v1';
// Only fixed metadata and opaque identifiers enter the audit trail, never source content.
function consentResource(transcriptionId: string, attemptId: string) {
  return JSON.stringify({
    transcriptionId,
    attemptId,
    policyVersion: MEETING_CONSENT_POLICY,
    provider: 'openai',
    model: TRANSCRIPTION_MODEL,
    purpose: 'audio-transcription',
  });
}

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
  const [history] = await db.query<{
    dispatches: number;
    rejections: number;
    last_rejected: boolean;
  }>(
    `SELECT count(*) FILTER (WHERE action='meeting.transcription.dispatch_intent')::int AS dispatches,
      count(*) FILTER (WHERE action='meeting.transcription.authorization_rejected')::int AS rejections,
      coalesce(bool_or(action='meeting.transcription.authorization_rejected' AND resource_id=$3),false) AS last_rejected
     FROM audit_events WHERE workspace_id=$1 AND resource_id LIKE $2`,
    [workspace, `{"transcriptionId":"${row.id}",%`, consentResource(row.id, row.attempt_token)],
  );
  const totalAttempts = Math.max(row.attempts, history.dispatches);
  // Legacy/partial histories remain conservative: never infer a free retry from missing evidence.
  const completeHistory = history.dispatches >= row.attempts;
  const chargedReservations = completeHistory ? totalAttempts - history.rejections : totalAttempts;

  const [memory] = row.memory_id
    ? await db.query<{ id: string }>(
        'SELECT id FROM memory_nodes WHERE workspace_id=$1 AND id=$2',
        [workspace, row.memory_id],
      )
    : [];
  return {
    fingerprint,
    transcriptionId: row.id,
    status: row.status === 'running' && row.expired ? 'uncertain' : row.status,
    attemptId: row.attempt_token,
    attempts: totalAttempts,
    canRetry:
      !['completed'].includes(row.status) &&
      (row.status !== 'running' || row.expired) &&
      chargedReservations < 2 &&
      totalAttempts < 4,
    authorizationRejected: history.last_rejected,
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
    if (old && (retryId !== old.attemptId || !old.canRetry)) return false;
    if (!old && retryId)
      throw new HttpError(409, 'This retry no longer matches the saved attempt.');
    if (!key)
      throw new HttpError(503, 'OpenAI transcription is not configured. No audio was sent.');
    const transcriptionId = old?.transcriptionId ?? uuid();
    await tx.query(
      `INSERT INTO meeting_transcriptions(id,workspace_id,fingerprint,status,attempt_token,attempts)
      VALUES($1,$2,$3,'running',$4,1) ON CONFLICT(workspace_id,fingerprint) DO UPDATE SET
      status='running',attempt_token=$4,attempts=LEAST(2,meeting_transcriptions.attempts+1),updated_at=now()`,
      [transcriptionId, workspace, fingerprint, token],
    );
    const resource = consentResource(transcriptionId, token);
    await audit(tx, workspace, 'meeting.transcription.consent', resource);
    if (retryId)
      await audit(
        tx,
        workspace,
        'meeting.transcription.retry_duplicate_charge_acknowledged',
        resource,
      );
    // Durable reservation to attempt dispatch, NOT proof of transmission or provider receipt.
    await audit(tx, workspace, 'meeting.transcription.dispatch_intent', resource);
    return true;
  });
  if (!claim) return meetingStatus(db, workspace, fingerprint);
  let text: string;
  try {
    const form = new FormData();
    form.set('model', TRANSCRIPTION_MODEL);
    // Never transmit the user's filename or other client metadata to the provider.
    form.set(
      'file',
      new Blob([canonicalMeetingAudio(audio)], { type: 'audio/wav' }),
      'recording.wav',
    );
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
      await db.transaction(async (tx) => {
        const rows = await tx.query<{ id: string }>(
          'UPDATE meeting_transcriptions SET status=$1,updated_at=now() WHERE workspace_id=$2 AND fingerprint=$3 AND attempt_token=$4 RETURNING id',
          [status, workspace, fingerprint, token],
        );
        // Only explicit authentication/authorization rejection establishes no authorized model run.
        // Rate limits, ambiguous failures and malformed responses still consume the conservative budget.
        if (rows[0] && [401, 403].includes(response.status))
          await audit(
            tx,
            workspace,
            'meeting.transcription.authorization_rejected',
            consentResource(rows[0].id, token),
          );
      });
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
  try {
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
  } catch {
    // The provider may have charged. Best-effort classification; never redispatch here.
    try {
      await db.transaction(async (tx) => {
        const rows = await tx.query<{ id: string }>(
          "UPDATE meeting_transcriptions SET status='uncertain',updated_at=now() WHERE workspace_id=$1 AND fingerprint=$2 AND attempt_token=$3 AND status='running' RETURNING id",
          [workspace, fingerprint, token],
        );
        if (rows[0])
          await audit(
            tx,
            workspace,
            'meeting.transcription.save_failed',
            consentResource(rows[0].id, token),
          );
      });
    } catch {
      /* An unavailable database cannot guarantee durable failure recording. */
    }
    throw new HttpError(
      503,
      'Transcript save could not be confirmed after provider processing. Charges may apply. Check saved status before retrying.',
    );
  }
  return meetingStatus(db, workspace, fingerprint);
}
