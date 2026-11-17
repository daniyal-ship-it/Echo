'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, AudioLines, CheckCircle2, FileAudio, Loader2, ShieldCheck } from 'lucide-react';

const MAX_BYTES = 10 * 1024 * 1024;
const SUPPORTED = /\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm)$/i;
type TranscriptResult = {
  memoryId: string;
  transcript: string;
  duplicate: boolean;
  model: string;
};

export default function MeetingsPage() {
  const [recording, setRecording] = useState<File | null>(null);
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TranscriptResult | null>(null);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] || null;
    setRecording(next);
    setResult(null);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recording || busy || !permission) return;
    if (recording.size === 0 || recording.size > MAX_BYTES || !SUPPORTED.test(recording.name)) {
      setError('Choose a supported audio file between 1 byte and 10 MiB.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch(
        '/api/meetings/transcribe?filename=' + encodeURIComponent(recording.name),
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Echo-Meeting-Consent': 'true',
          },
          body: recording,
        },
      );
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Unable to transcribe this meeting.';
        throw new Error(message);
      }
      setResult(payload as TranscriptResult);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The transcription request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#080b1b',
        color: '#e9edff',
        padding: 'clamp(20px, 5vw, 72px)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto', display: 'grid', gap: 28 }}>
        <Link href="/" style={{ color: '#9bb8f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowLeft size={18} /> Return to the brain
        </Link>
        <header>
          <p style={{ fontSize: 12, letterSpacing: '0.18em', color: '#83baff', fontWeight: 700 }}>
            ECHO / PHASE 5
          </p>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 46px)', margin: '10px 0' }}>
            Meeting intelligence
          </h1>
          <p style={{ color: '#b2bcdb', lineHeight: 1.65, maxWidth: 640 }}>
            Upload a recording, transcribe it securely, and preserve its words as a searchable
            memory in your ECHO brain. This first release does not yet create AI summaries,
            diarized speaker labels, or calendar reminders.
          </p>
        </header>
        <form
          onSubmit={submit}
          style={{
            padding: 'clamp(20px, 4vw, 36px)',
            display: 'grid',
            gap: 23,
            border: '1px solid #394269',
            borderRadius: 22,
            background: '#111831',
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <AudioLines size={28} color="#89b9ff" aria-hidden />
            <div>
              <h2 style={{ fontSize: 22, margin: 0 }}>Transcribe a recording</h2>
              <p style={{ color: '#bbc5e3', margin: '6px 0 0', fontSize: 14 }}>
                MP3, M4A, WAV, WEBM, OGG, FLAC or MP4 • 10 MiB maximum
              </p>
            </div>
          </div>
          <label style={{ display: 'grid', gap: 10, fontWeight: 600 }}>
            Choose audio
            <input
              type="file"
              accept=".mp3,.mpeg,.mpga,.m4a,.mp4,.wav,.webm,.ogg,.flac,audio/*"
              onChange={choose}
              disabled={busy}
              required
              style={{ background: '#1b2543', padding: 18, borderRadius: 10, maxWidth: '100%' }}
            />
          </label>
          {recording && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, color: '#bfcff5' }}>
              <FileAudio size={18} aria-hidden />
              {recording.name} · {(recording.size / 1024 / 1024).toFixed(2)} MiB
            </p>
          )}
          <section style={{ display: 'flex', gap: 12, color: '#c2cee8', lineHeight: 1.55 }}>
            <ShieldCheck size={21} color="#8aafe7" aria-hidden style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#fff' }}>Recording and privacy</strong>
              <p style={{ margin: '5px 0 0' }}>
                Your audio is sent from ECHO to OpenAI for transcription. ECHO stores the
                transcript in your workspace, but does not intentionally retain the audio file.
                Your transcript may be used in future ECHO searches and AI tasks.
                Make sure you have permission to record and transcribe everyone involved.
                Transcription may incur API charges.
              </p>
            </div>
          </section>
          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={permission}
              onChange={(event) => setPermission(event.target.checked)}
              disabled={busy}
              style={{ marginTop: 5 }}
            />
            I have permission to process this recording and agree to send it to OpenAI for
            transcription.
          </label>
          <button
            type="submit"
            disabled={!recording || !permission || busy}
            style={{
              padding: '14px 20px',
              border: 0,
              borderRadius: 12,
              cursor: !recording || !permission || busy ? 'not-allowed' : 'pointer',
              background: !recording || !permission || busy ? '#404b67' : '#4da8ff',
              color: '#071122',
              fontWeight: 700,
              fontSize: 16,
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              alignItems: 'center',
            }}
          >
            {busy ? <Loader2 size={19} aria-hidden /> : <AudioLines size={19} aria-hidden />}
            {busy ? 'Transcribing…' : 'Transcribe & save to brain'}
          </button>
          {error && <p role="alert" style={{ color: '#ffb6ba', margin: 0 }}>{error}</p>}
        </form>
        {result && (
          <section
            aria-label="Saved meeting transcript"
            style={{ border: '1px solid #45668a', background: '#101d31', borderRadius: 22, padding: 28 }}
          >
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 color="#8debb2" aria-hidden />
              {result.duplicate ? 'Previously saved meeting' : 'Transcript saved'}
            </h2>
            <p style={{ color: '#c1d6fa' }}>
              Saved in your Temporal lobe as a meeting memory. Return to the brain or
              All memories to explore it.
            </p>
            <div
              style={{
                maxHeight: 360,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                borderRadius: 12,
                background: '#0a1124',
                padding: 18,
              }}
            >
              {result.transcript}
            </div>
            <p style={{ fontSize: 12, color: '#9dabcd' }}>Memory ID: {result.memoryId}</p>
          </section>
        )}
      </div>
    </main>
  );
}
