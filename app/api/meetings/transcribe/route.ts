import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { discoverEdges, storeMemory } from '@/lib/memories';
import { newDiagnosticId } from '@/lib/database-diagnostics';
import {
  assertOrigin,
  audit,
  findSession,
  hash,
  HttpError,
  rateLimit,
  SESSION_COOKIE,
} from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 500000;
const AUDIO_TYPES: Record<string, string> = {
  flac: 'audio/flac',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  mpeg: 'audio/mpeg',
  mpga: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm',
};

function reply(data: unknown, status = 200, diagnosticId?: string) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(diagnosticId ? { 'X-Echo-Request-Id': diagnosticId } : {}),
    },
  });
}

async function readAudio(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const indicated = Number(request.headers.get('content-length') || 0);
  if (indicated > MAX_AUDIO_BYTES) throw new HttpError(413, 'Audio exceeds the 10 MiB limit.');
  const stream = request.body?.getReader();
  if (!stream) throw new HttpError(400, 'Choose an audio recording.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await stream.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_AUDIO_BYTES) {
      await stream.cancel();
      throw new HttpError(413, 'Audio exceeds the 10 MiB limit.');
    }
    chunks.push(value);
  }
  if (!total) throw new HttpError(400, 'The audio file is empty.');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export async function POST(request: NextRequest) {
  const diagnosticId = newDiagnosticId();
  try {
    assertOrigin(request);
    const db = await getDb(diagnosticId);
    const session = await findSession(db, request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) throw new HttpError(401, 'Sign in to ECHO before importing a meeting.');
    if (request.headers.get('x-echo-meeting-consent') !== 'true') {
      throw new HttpError(400, 'Confirm permission to share this recording with OpenAI.');
    }

    const supplied = request.nextUrl.searchParams.get('filename') || '';
    const filename = (supplied.split(/[\\/]/).pop() || '').replace(/[\u0000-\u001f]/g, '').trim();
    if (!filename || filename.length > 160) throw new HttpError(400, 'Invalid filename.');
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const audioType = AUDIO_TYPES[extension];
    if (!audioType) throw new HttpError(415, 'Use MP3, M4A, WAV, OGG, WEBM, FLAC or MP4 audio.');

    const key = process.env.ECHO_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) throw new HttpError(503, 'OpenAI audio transcription is not configured.');
    const audio = await readAudio(request);
    const fingerprint = hash(audio);
    const existing = await db.query<{ id: string; content: string }>(
      "SELECT m.id,m.content FROM memory_nodes m JOIN data_sources s ON m.source_id=s.id AND m.workspace_id=s.workspace_id WHERE m.workspace_id=$1 AND s.provider='meeting-audio' AND s.source_key=$2 LIMIT 1",
      [session.workspaceId, fingerprint],
    );
    if (existing[0]) {
      return reply(
        { memoryId: existing[0].id, transcript: existing[0].content, duplicate: true, model: 'gpt-transcribe' },
        200,
        diagnosticId,
      );
    }

    await rateLimit(db, 'meeting-upload:' + session.workspaceId, 5);
    await audit(db, session.workspaceId, 'meeting.transcription_requested', fingerprint);

    const data = new FormData();
    data.set('model', 'gpt-transcribe');
    data.set('file', new Blob([audio], { type: audioType }), filename);
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key },
        body: data,
        signal: AbortSignal.timeout(80000),
        cache: 'no-store',
      });
    } catch {
      throw new HttpError(502, 'Transcription connection failed. The provider may still have processed the recording; check usage before retrying.');
    }
    if (!response.ok) {
      if (response.status === 429) throw new HttpError(429, 'OpenAI transcription is rate-limited. Please try again later.');
      throw new HttpError(502, 'The transcription provider rejected this recording or model. No transcript was saved.');
    }
    const result = (await response.json()) as { text?: unknown };
    const transcript = typeof result.text === 'string' ? result.text.trim() : '';
    if (!transcript || transcript.length > MAX_TRANSCRIPT_CHARS)
      throw new HttpError(502, 'The transcription provider returned an empty or excessively long transcript.');

    const saved = await db.transaction(async (tx) => {
      const memory = await storeMemory(tx, session.workspaceId, {
        source: 'meeting-audio',
        sourceId: fingerprint,
        title: 'Meeting transcript: ' + filename,
        content: transcript,
        raw: {
          format: 'echo-meeting-transcript-v1',
          filename,
          transcript,
          model: 'gpt-transcribe',
          audioRetained: false,
        },
        messages: [],
        sourceAt: new Date().toISOString(),
        kind: 'conversation',
        tags: ['meeting', 'transcript'],
        region: 'temporal',
      });
      await discoverEdges(tx, session.workspaceId, memory.id);
      await audit(tx, session.workspaceId, 'meeting.transcript_saved', memory.id);
      return memory;
    });

    return reply(
      {
        memoryId: saved.id,
        transcript,
        duplicate: saved.duplicate,
        model: 'gpt-transcribe',
      },
      201,
      diagnosticId,
    );
  } catch (error) {
    if (error instanceof HttpError) return reply({ error: error.message }, error.status, diagnosticId);
    // Never log the recording, provider response, transcript or credentials.
    console.error('meeting_transcription_failed', { requestId: diagnosticId });
    return reply(
      { error: 'The meeting import failed. Any provider charges may still apply; check usage before retrying.' },
      500,
      diagnosticId,
    );
  }
}
