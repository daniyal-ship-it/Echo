import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  assertOrigin,
  findSession,
  HttpError,
  rateLimit,
  SESSION_COOKIE,
  uuid,
} from '@/lib/security';
import { boundedBody, MAX_AUDIO_BYTES } from '@/lib/meeting-audio';
import { meetingStatus, transcribeMeeting } from '@/lib/meetings';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function handle(request: NextRequest, write: boolean) {
  const diagnosticId = uuid();
  try {
    if (write) assertOrigin(request);
    const db = await getDb();
    const session = await findSession(db, request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) throw new HttpError(401, 'Sign in to ECHO first.');
    if (!write)
      return NextResponse.json(
        await meetingStatus(
          db,
          session.workspaceId,
          request.headers.get('x-echo-audio-hash') || '',
        ),
        { headers: { 'Cache-Control': 'no-store' } },
      );
    if (request.headers.get('x-echo-meeting-consent') !== 'true')
      throw new HttpError(400, 'Consent is required before sending audio.');
    await rateLimit(db, 'meeting-upload:' + session.workspaceId, 10);
    let title: string;
    try {
      title = decodeURIComponent(request.headers.get('x-echo-meeting-title') || 'Recording').trim();
    } catch {
      throw new HttpError(400, 'Invalid title.');
    }
    if (!title || title.length > 120 || /[\u0000-\u001f]/.test(title))
      throw new HttpError(400, 'Use a title of at most 120 characters.');
    const retry = request.headers.get('x-echo-retry-id') || undefined;
    if (
      retry &&
      (!/^[a-f0-9-]{36}$/.test(retry) || request.headers.get('x-echo-retry-consent') !== 'true')
    )
      throw new HttpError(
        400,
        'Explicit acknowledgement of possible duplicate charges is required.',
      );
    const bytes = await boundedBody(request, MAX_AUDIO_BYTES);
    return NextResponse.json(
      await transcribeMeeting(db, session.workspaceId, bytes, title, retry),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: 'meeting_request_failed',
        diagnosticId,
        status: error instanceof HttpError ? error.status : 500,
      }),
    );
    return NextResponse.json(
      {
        diagnosticId,
        error:
          error instanceof HttpError
            ? error.message
            : 'The request could not finish. Check saved status before retrying; provider charges may apply.',
      },
      {
        status: error instanceof HttpError ? error.status : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
export const POST = (request: NextRequest) => handle(request, true);
export const GET = (request: NextRequest) => handle(request, false);
