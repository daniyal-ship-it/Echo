'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { api, post } from '@/lib/client';
import type { MemoryDetail } from '@/lib/types';
import type { GeneratedAnalysis, IntelligenceJob } from '@/lib/intelligence-types';
import type { Settings } from './panels';
type Job = Omit<IntelligenceJob, 'lease_token'>;
type Status = {
  jobs: Job[];
  analyses: GeneratedAnalysis[];
  embedding: { configured: boolean; model: string };
};
export default function MemoryIntelligence({
  memory,
  onOpen,
  onChanged,
}: {
  memory: MemoryDetail;
  onOpen: (id: string, version: number, passage: string) => void;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [settings, setSettings] = useState<Settings | null>(null),
    [error, setError] = useState('');
  const [provider, setProvider] = useState('openai'),
    [consent, setConsent] = useState(false),
    [ack, setAck] = useState(false),
    [running, setRunning] = useState(false),
    [starting, setStarting] = useState(false);
  const live = useRef(true),
    latestChanged = useRef(onChanged);
  latestChanged.current = onChanged;
  const job = status?.jobs[0];
  async function refresh() {
    const data = await api<Status>(
      `intelligence?memoryId=${memory.id}&version=${memory.viewed_version}`,
    );
    if (live.current) setStatus(data);
  }
  useEffect(() => {
    live.current = true;
    void Promise.all([
      api<Status>(`intelligence?memoryId=${memory.id}&version=${memory.viewed_version}`),
      api<Settings>('settings'),
    ])
      .then(([s, config]) => {
        if (live.current) {
          setStatus(s);
          setSettings(config);
          if (
            !config.providers.find((p) => p.id === 'openai')?.configured &&
            config.providers.find((p) => p.id === 'anthropic')?.configured
          )
            setProvider('anthropic');
        }
      })
      .catch((e) => {
        if (live.current) setError(e.message);
      });
    return () => {
      live.current = false;
    };
  }, [memory.id, memory.viewed_version]);
  useEffect(() => {
    if (!running || !job) return;
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        while (active) {
          const next = await api<Job>(`intelligence/${job.id}/run`, {
            method: 'POST',
            body: '{}',
            signal: controller.signal,
          });
          if (!active) return;
          setStatus((s) =>
            s ? { ...s, jobs: [next, ...s.jobs.filter((j) => j.id !== next.id)] } : s,
          );
          if (!['queued', 'running', 'retry_wait'].includes(next.status)) {
            setRunning(false);
            await refresh();
            if (active) latestChanged.current();
            return;
          }
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              Math.min(
                8000,
                Math.max(
                  1200,
                  next.next_attempt_at
                    ? new Date(next.next_attempt_at).getTime() - Date.now()
                    : 1200,
                ),
              ),
            ),
          );
        }
      } catch (e) {
        if (active && (e as Error).name !== 'AbortError') {
          setError((e as Error).message);
          setRunning(false);
        }
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [running, job?.id]); // The durable server job owns progress; rendering cannot dispatch overlapping loops.
  async function start() {
    setStarting(true);
    setError('');
    try {
      const next = await post<Job>('intelligence', {
        memoryId: memory.id,
        summaryProvider: provider,
        consent: true,
      });
      if (!live.current) return;
      setStatus((s) =>
        s ? { ...s, jobs: [next, ...s.jobs.filter((j) => j.id !== next.id)] } : null,
      );
      setRunning(['queued', 'running', 'retry_wait'].includes(next.status));
      await refresh();
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      if (live.current) setStarting(false);
    }
  }
  async function control(action: 'cancel' | 'resume' | 'retry') {
    if (!job) return;
    setError('');
    try {
      const next = await post<Job>(`intelligence/${job.id}/control`, {
        action,
        acknowledgeCharge: ack,
      });
      if (!live.current) return;
      setStatus((s) => (s ? { ...s, jobs: [next, ...s.jobs.slice(1)] } : s));
      setAck(false);
      setRunning(action !== 'cancel' && next.status === 'queued');
    } catch (e) {
      if (live.current) setError((e as Error).message);
    }
  }
  return (
    <section className="intelligence-panel" aria-label="Memory intelligence">
      <h3>Summary & semantic index</h3>
      <p className="fine-print">
        Generated analysis is kept separately from your unchanged original. Explicit tags and
        inferred associations remain distinct.
      </p>
      {error && <p role="alert">{error}</p>}
      {!status && !error && <p role="status">Loading processing history…</p>}
      {job && (
        <div className="intelligence-status">
          <strong>
            {job.status.replace('_', ' ')} · source version {job.source_version}
          </strong>
          <progress
            aria-label="Memory processing progress"
            value={job.embedded + job.analysed}
            max={job.total_chunks * 2}
          />
          <p>
            {job.embedded}/{job.total_chunks} passages indexed · {job.analysed}/{job.total_chunks}{' '}
            analysed
          </p>
          {job.error && <p role="alert">{job.error}</p>}
          {['uncertain', 'cancelled'].includes(job.status) && (
            <label className="check-label">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I
              understand retrying may duplicate a provider charge.
            </label>
          )}
          {['queued', 'running', 'retry_wait'].includes(job.status) && (
            <div className="row">
              <button
                className="button secondary"
                disabled={running}
                onClick={() => setRunning(true)}
              >
                {running ? (
                  <>
                    <Loader2 size={13} className="spin" />
                    Processing…
                  </>
                ) : (
                  'Resume saved job'
                )}
              </button>
              <button className="text-button" onClick={() => void control('cancel')}>
                Cancel processing
              </button>
            </div>
          )}
          {job.status === 'cancelled' && (
            <button className="button secondary" onClick={() => void control('resume')}>
              Resume cancelled job
            </button>
          )}
          {['failed', 'uncertain'].includes(job.status) && (
            <button
              className="button secondary"
              disabled={job.status === 'uncertain' && !ack}
              onClick={() => void control('retry')}
            >
              Retry step · API charges may apply
            </button>
          )}
          <p className="fine-print">
            Completed steps are reused. Closing this panel pauses further steps; an in-flight call
            may still finish and be billed. Reopen this original to resume.
          </p>
        </div>
      )}
      {!job && memory.viewed_version === memory.version && (
        <div className="intelligence-consent">
          <label>
            Summary provider
            <select
              aria-label="Summary provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {settings?.providers
                .filter((p) => p.configured)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.model}
                  </option>
                ))}
            </select>
          </label>
          <p>
            Process this original only. OpenAI creates the semantic index; the selected provider
            receives its active text to generate cited summaries and insights. API charges apply.
          </p>
          <p className="fine-print">
            Up to 64 passages, with at most eight per request. Larger originals are preserved but
            require a later processing increment. Uncertain charges require explicit review before
            retry.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Allow processing of this original with these providers.
          </label>
          <button
            className="button primary full"
            disabled={
              !consent ||
              starting ||
              !status?.embedding.configured ||
              !settings?.providers.find((p) => p.id === provider)?.configured
            }
            onClick={() => void start()}
          >
            {starting ? 'Checking account access…' : 'Generate summary & index'}
          </button>
          {status && !status.embedding.configured && (
            <p className="fine-print">
              The embedding provider is not configured in this runtime. Original reading and keyword
              search remain available.
            </p>
          )}
        </div>
      )}
      {status?.analyses.map((analysis) => (
        <article key={analysis.id} className="generated-analysis">
          <span className="eyebrow">GENERATED SUMMARY · SOURCE V{analysis.source_version}</span>
          <p className="fine-print">
            {analysis.provider} · {analysis.model} ·{' '}
            {new Date(analysis.created_at).toLocaleString()}
          </p>
          {analysis.result.summary.map((claim, index) => (
            <div key={index} className="analysis-claim">
              <p>{claim.text}</p>
              {claim.citations.map((citation, i) => (
                <button
                  className="text-button"
                  key={i}
                  onClick={() => onOpen(memory.id, analysis.source_version, citation.chunkId)}
                >
                  Original passage {i + 1}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
          ))}
          <h3>Structured insights</h3>
          {analysis.result.insights.length ? (
            analysis.result.insights.map((claim, index) => (
              <div className="analysis-claim" key={index}>
                <span className="status-label">{claim.kind}</span>
                <p>{claim.text}</p>
                {claim.citations.map((citation, i) => (
                  <button
                    className="text-button"
                    key={i}
                    onClick={() => onOpen(memory.id, analysis.source_version, citation.chunkId)}
                  >
                    Open supporting passage
                    <ArrowUpRight size={12} />
                  </button>
                ))}
              </div>
            ))
          ) : (
            <p className="fine-print">
              No explicit decisions, unresolved questions or commitments were extracted.
            </p>
          )}
          <p className="fine-print">
            Quotes are checked against the original. Generated interpretations still need your
            review; citations are not proof of factual truth.
          </p>
        </article>
      ))}
      {status && !status.analyses.length && (
        <p className="fine-print">
          No generated summary has been published for this source version.
        </p>
      )}
    </section>
  );
}
