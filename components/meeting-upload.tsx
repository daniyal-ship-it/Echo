'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
type Status = {
  fingerprint: string;
  status: string;
  attemptId: string;
  attempts: number;
  memoryId: string | null;
  removed: boolean;
  model: string;
};
export default function MeetingUpload() {
  const [file, setFile] = useState<File | null>(null),
    [title, setTitle] = useState('Recording');
  const [transcript, setTranscript] = useState('');
  const [consent, setConsent] = useState(false),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState(''),
    [fingerprint, setFingerprint] = useState('');
  async function run(retry = false, check = false) {
    if (busy || !file || (!check && !consent) || (retry && !ack)) return;
    setBusy(true);
    setError('');
    try {
      if (!file.size || file.size > 3 * 1024 * 1024 || !/\.wav$/i.test(file.name))
        throw new Error('Choose a PCM WAV file of at most 3 MiB.');
      const bytes = await file.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (x) =>
        x.toString(16).padStart(2, '0'),
      ).join('');
      setFingerprint(digest);
      const response = await fetch('/api/meetings/transcribe', {
        method: check ? 'GET' : 'POST',
        headers: {
          'x-echo-audio-hash': digest,
          ...(!check
            ? {
                'content-type': 'audio/wav',
                'x-echo-meeting-consent': 'true',
                'x-echo-meeting-title': encodeURIComponent(title),
              }
            : {}),
          ...(retry && status
            ? { 'x-echo-retry-id': status.attemptId, 'x-echo-retry-consent': 'true' }
            : {}),
        },
        ...(!check ? { body: bytes } : {}),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Your session expired. Return to ECHO and sign in.'
            : data.error || 'Request failed.',
        );
      if (
        data &&
        (typeof data.attemptId !== 'string' ||
          !['running', 'completed', 'failed', 'uncertain'].includes(data.status))
      )
        throw new Error('Unexpected status. Check saved status before retrying.');
      setStatus(data);
      setAck(false);
      if (data?.memoryId) {
        const saved = await fetch('/api/memories/' + encodeURIComponent(data.memoryId));
        if (!saved.ok)
          throw new Error(
            'Transcript was saved, but could not be reopened. Check your session and saved status.',
          );
        const memory = await saved.json();
        setTranscript(typeof memory.content === 'string' ? memory.content : '');
      }
      if (check && !data)
        setError('No saved attempt exists for this recording. You can consent and submit it.');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Request interrupted. Check saved status before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void run();
  }
  return (
    <main className="meeting-page">
      <Link href="/">← Return to ECHO</Link>
      <h1>Meetings</h1>
      <p>Turn a short recording into a searchable memory in your Temporal lobe.</p>
      <p>
        PCM WAV only: 16 kHz, mono, 16-bit; 0.1–90 seconds; maximum 3 MiB. Export a standard WAV
        without metadata chunks. Longer or compressed recordings are not supported in this release.
      </p>
      <form onSubmit={submit} aria-busy={busy}>
        <label>
          Recording
          <input
            type="file"
            accept=".wav,audio/wav"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setConsent(false);
              setAck(false);
              setStatus(null);
              setError('');
              setFingerprint('');
              setTranscript('');
            }}
            required
          />
        </label>
        <label>
          Memory title
          <input
            value={title}
            maxLength={120}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <p>
          ECHO sends this recording to OpenAI using gpt-transcribe. API charges may apply. ECHO does
          not retain raw audio. Only the machine transcript and provenance are saved privately.
          Transcription can mishear speech; no speaker identities or recording date are inferred.
          Review the result before relying on it. OpenAI’s data policies apply to the transmitted
          audio.
        </p>
        <label className="meeting-consent">
          <input
            type="checkbox"
            checked={consent}
            disabled={busy}
            onChange={(e) => setConsent(e.target.checked)}
          />
          I have permission from the participants and consent to sending this recording to OpenAI
          for transcription.
        </label>
        <button className="button primary" disabled={!file || !consent || busy || !title.trim()}>
          {busy ? 'Working…' : 'Transcribe and save'}
        </button>
        <button
          className="button"
          type="button"
          disabled={!file || busy}
          onClick={() => void run(false, true)}
        >
          Check saved status (no provider call)
        </button>
      </form>
      {busy && (
        <p role="status">
          Processing request. Leaving this page does not guarantee provider cancellation. Re-select
          the same recording to check saved status.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {transcript && (
        <section aria-label="Machine transcript">
          <h2>Machine transcript — review for errors</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{transcript}</p>
        </section>
      )}
      {status && (
        <section aria-label="Transcription status" aria-live="polite">
          <h2>
            {status.status === 'completed'
              ? 'Transcript saved'
              : status.status === 'running'
                ? 'Request in progress'
                : status.status === 'uncertain'
                  ? 'Outcome needs review'
                  : 'Provider request rejected'}
          </h2>
          {status.status === 'completed' ? (
            <>
              <p>Machine-transcribed by OpenAI ({status.model}). The audio was not retained.</p>
              {status.removed ? (
                <p>
                  The saved memory was removed. It will not be recreated or retranscribed
                  automatically.
                </p>
              ) : (
                <p>
                  Open <Link href="/">All memories in ECHO</Link> and search for “Machine
                  transcript” or your title to inspect the original transcript.
                </p>
              )}
            </>
          ) : (
            <p>
              No automatic retry is performed. A request may still finish or be billed even after a
              connection fails. Check status again before retrying.
            </p>
          )}
          {['failed', 'uncertain'].includes(status.status) && status.attempts < 2 && (
            <>
              <label className="meeting-consent">
                <input
                  type="checkbox"
                  checked={ack}
                  disabled={busy}
                  onChange={(e) => setAck(e.target.checked)}
                />
                I checked the saved status and provider usage. I accept that retrying may cause an
                additional charge.
              </label>
              <button
                className="button"
                disabled={!ack || !consent || busy}
                onClick={() => void run(true)}
              >
                Retry transcription once
              </button>
            </>
          )}
          {status.attempts >= 2 && status.status !== 'completed' && (
            <p>
              The two-attempt safety limit has been reached. No more provider requests will be made
              for these exact audio bytes.
            </p>
          )}
        </section>
      )}
      {fingerprint && (
        <p className="fine-print">
          Re-selecting identical audio in this workspace reuses its saved attempt. The recording
          itself is not stored.
        </p>
      )}
    </main>
  );
}
