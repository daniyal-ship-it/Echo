'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CirclePause,
  History,
  Loader2,
  OctagonAlert,
  RotateCcw,
  ShieldQuestion,
  Sparkles,
  TextQuote,
  TriangleAlert,
} from 'lucide-react';
import { api, post } from '@/lib/client';
import type { MemoryDetail } from '@/lib/types';
import type { GeneratedAnalysis } from '@/lib/intelligence-types';
import {
  MAX_REQUESTS_PER_RUN,
  PASSAGE_LIMIT,
  PASSAGES_PER_REQUEST,
  deriveState,
  isInProgress,
  numberAnalysis,
  remainingRequests,
  stages,
  type DisplayState,
  type NumberedClaim,
  type PublicJob as Job,
} from '@/lib/intelligence-view';
import type { Settings } from './panels';

type Status = {
  jobs: Job[];
  analyses: GeneratedAnalysis[];
  embedding: { configured: boolean; model: string };
};
const STATE_ICON: Record<DisplayState, typeof CircleDot> = {
  unprocessed: CircleDashed,
  queued: CircleDot,
  running: Loader2,
  waiting: History,
  paused: CirclePause,
  completed: CircleCheck,
  failed: OctagonAlert,
  review: ShieldQuestion,
  cancelled: CirclePause,
  outdated: TriangleAlert,
};
const when = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const providerName = (id: string) =>
  id === 'openai' ? 'OpenAI' : id === 'anthropic' ? 'Anthropic' : id;

export default function MemoryIntelligence({
  memory,
  onOpen,
  onViewVersion,
  onPublished,
  onChanged,
}: {
  memory: MemoryDetail;
  /** Opens a cited passage. `trail` lists every passage cited by the same analysis, in order. */
  onOpen: (id: string, version: number, passage: string, trail?: string[]) => void;
  onViewVersion?: (version: number) => void;
  /** Reports whether a summary is published for the viewed version, once that is known. */
  onPublished?: (published: boolean) => void;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [settings, setSettings] = useState<Settings | null>(null),
    [loadError, setLoadError] = useState(''),
    [error, setError] = useState('');
  const [provider, setProvider] = useState('openai'),
    [consent, setConsent] = useState(false),
    [ack, setAck] = useState(false),
    [running, setRunning] = useState(false),
    [starting, setStarting] = useState(false),
    [acting, setActing] = useState(false),
    [earlier, setEarlier] = useState<number | null>(null),
    [attempt, setAttempt] = useState(0);
  const live = useRef(true),
    latestChanged = useRef(onChanged);
  latestChanged.current = onChanged;
  const ids = useId();
  const job = status?.jobs[0];
  const latest = memory.viewed_version === memory.version;
  const refresh = useCallback(async () => {
    const data = await api<Status>(
      `intelligence?memoryId=${memory.id}&version=${memory.viewed_version}`,
    );
    if (live.current) setStatus(data);
  }, [memory.id, memory.viewed_version]);
  useEffect(() => {
    live.current = true;
    setLoadError('');
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
        if (live.current) setLoadError(e.message);
      });
    return () => {
      live.current = false;
    };
  }, [memory.id, memory.viewed_version, attempt]);
  // When the latest version has never been processed, look for the newest earlier version
  // that has a published summary, so the reader knows existing analysis is out of date.
  const untouchedLatest = !!status && latest && !status.jobs.length && !status.analyses.length;
  useEffect(() => {
    if (!untouchedLatest) return;
    let active = true;
    void (async () => {
      const candidates = memory.versions
        .map((v) => v.version)
        .filter((v) => v < memory.version)
        .sort((a, b) => b - a)
        .slice(0, 3);
      for (const version of candidates) {
        try {
          const past = await api<Status>(`intelligence?memoryId=${memory.id}&version=${version}`);
          if (!active) return;
          if (past.analyses.length) return setEarlier(version);
        } catch {
          return; // Optional context only; the panel stays accurate without it.
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [untouchedLatest, memory.id, memory.version, memory.versions]);
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
          if (!isInProgress(next)) {
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
          // The server may have recorded an outcome even though this request failed.
          void refresh().catch(() => undefined);
        }
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [running, job?.id, refresh]); // The durable server job owns progress; rendering cannot dispatch overlapping loops.
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
      setRunning(isInProgress(next));
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
    setActing(true);
    if (action === 'cancel') setRunning(false);
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
    } finally {
      if (live.current) setActing(false);
    }
  }

  const view = deriveState({
    job,
    driving: running,
    viewedVersion: memory.viewed_version,
    latestVersion: memory.version,
    hasAnalysis: !!status?.analyses.length,
    earlierSummaryVersion: earlier,
  });
  const Icon = STATE_ICON[view.state];
  const steps = job ? stages(job, !!status?.analyses.length) : [];
  const remaining = job ? remainingRequests(job) : null;
  const configured = settings?.providers.filter((p) => p.configured) ?? [];
  const chosen = settings?.providers.find((p) => p.id === provider);
  const blockers = [
    status && !status.embedding.configured
      ? 'OpenAI is not connected on this server, so passages cannot be indexed.'
      : '',
    settings && !configured.length ? 'No summary provider is connected on this server.' : '',
    settings && configured.length && !chosen?.configured
      ? 'The selected summary provider is not connected on this server.'
      : '',
  ].filter(Boolean);
  const [newest, ...older] = status?.analyses ?? [];
  const published = status ? status.analyses.length > 0 : null;
  const reportPublished = useRef(onPublished);
  reportPublished.current = onPublished;
  useEffect(() => {
    if (published !== null) reportPublished.current?.(published);
  }, [published]);

  return (
    <section className="intelligence-panel iq" aria-label="Memory intelligence">
      <header className="iq-head">
        <h3>Summary &amp; semantic index</h3>
        <p className="fine-print">
          Generated analysis is kept separately from your unchanged original. Explicit tags and
          inferred associations remain distinct.
        </p>
      </header>
      {loadError && (
        <div className="iq-alert" role="alert">
          <TriangleAlert size={16} aria-hidden />
          <div>
            <p>Processing history could not be loaded. {loadError}</p>
            <button
              className="button secondary small"
              onClick={() => {
                setStatus(null);
                setAttempt((n) => n + 1);
              }}
            >
              <RotateCcw size={13} aria-hidden />
              Retry loading
            </button>
          </div>
        </div>
      )}
      {!status && !loadError && (
        <div className="iq-skeleton" aria-busy="true">
          <p role="status">Loading processing history…</p>
          <span />
          <span />
          <span />
        </div>
      )}
      {status && (
        <>
          <div
            className={`intelligence-status iq-state iq-tone-${view.tone}`}
            data-state={view.state}
          >
            <div className="iq-state-head">
              <span className="iq-state-icon" aria-hidden>
                <Icon size={18} className={view.state === 'running' ? 'spin' : undefined} />
              </span>
              <div>
                <span className="eyebrow">PROCESSING STATE</span>
                <p className="iq-state-label" role="status" aria-live="polite">
                  {view.label}
                </p>
              </div>
            </div>
            <p className="iq-state-meaning">{view.meaning}</p>
            {job && (
              <>
                {/* The saved server status, shown verbatim beside the plain-language state. */}
                <strong className="iq-state-line">
                  {job.status.replace('_', ' ')} · source version {job.source_version}
                </strong>
                <ol className="iq-stages" aria-label="Processing stages">
                  {steps.map((stage) => (
                    <li key={stage.id} className={`iq-stage is-${stage.status}`}>
                      <span className="iq-stage-mark" aria-hidden />
                      <div>
                        <span className="iq-stage-label">
                          {stage.label}
                          <span className="sr-only">
                            {' '}
                            —{' '}
                            {stage.status === 'done'
                              ? 'done'
                              : stage.status === 'current'
                                ? 'in progress'
                                : stage.status === 'stopped'
                                  ? 'stopped here'
                                  : 'not started'}
                          </span>
                        </span>
                        <span className="iq-stage-detail">{stage.detail}</span>
                      </div>
                    </li>
                  ))}
                </ol>
                <progress
                  aria-label="Memory processing progress"
                  aria-valuetext={`${job.embedded} of ${job.total_chunks} passages indexed, ${job.analysed} of ${job.total_chunks} analysed`}
                  value={job.embedded + job.analysed}
                  max={Math.max(1, job.total_chunks * 2)}
                />
                <p className="iq-counts">
                  {job.embedded}/{job.total_chunks} passages indexed · {job.analysed}/
                  {job.total_chunks} analysed
                </p>
                <dl className="iq-facts">
                  <div>
                    <dt>Index</dt>
                    <dd>OpenAI · {job.config.embeddingModel}</dd>
                  </div>
                  <div>
                    <dt>Summary</dt>
                    <dd>
                      {providerName(job.config.summaryProvider)} · {job.config.summaryModel}
                    </dd>
                  </div>
                  <div>
                    <dt>Last activity</dt>
                    <dd>
                      <time dateTime={job.updated_at}>{when(job.updated_at)}</time>
                    </dd>
                  </div>
                  {job.status === 'retry_wait' && job.next_attempt_at && (
                    <div>
                      <dt>Next attempt</dt>
                      <dd>
                        <time dateTime={job.next_attempt_at}>{when(job.next_attempt_at)}</time>
                      </dd>
                    </div>
                  )}
                </dl>
                {job.error && (
                  <div className="iq-alert" role="alert">
                    <TriangleAlert size={16} aria-hidden />
                    <p>{job.error}</p>
                  </div>
                )}
              </>
            )}
            {error && (
              <div className="iq-alert" role="alert">
                <TriangleAlert size={16} aria-hidden />
                <p>{error}</p>
              </div>
            )}
            {job && remaining && !['completed', 'superseded'].includes(job.status) && (
              <p className="iq-cost">
                <span className="eyebrow">POSSIBLE API COST</span>
                Continuing makes at most {remaining.total} more provider{' '}
                {remaining.total === 1 ? 'request' : 'requests'} ({remaining.index} to index,{' '}
                {remaining.analyse} to analyse) before retries. Retries can add requests and
                charges. Saved results are reused, so it can be fewer. Your provider bills the API
                account connected to this server; ECHO cannot see prices.
              </p>
            )}
            {job && ['uncertain', 'cancelled'].includes(job.status) && (
              <label className="check-label">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I
                understand retrying may duplicate a provider charge.
              </label>
            )}
            {job && isInProgress(job) && (
              <div className="row iq-actions">
                <button
                  className="button secondary"
                  disabled={running || acting}
                  onClick={() => setRunning(true)}
                >
                  {running ? (
                    <>
                      <Loader2 size={13} className="spin" aria-hidden />
                      Processing…
                    </>
                  ) : (
                    'Resume saved job'
                  )}
                </button>
                <button
                  className="text-button"
                  disabled={acting}
                  onClick={() => void control('cancel')}
                >
                  Cancel processing
                </button>
              </div>
            )}
            {job?.status === 'cancelled' && (
              <div className="row iq-actions">
                <button
                  className="button secondary"
                  disabled={acting}
                  onClick={() => void control('resume')}
                >
                  Resume cancelled job
                </button>
              </div>
            )}
            {job && ['failed', 'uncertain'].includes(job.status) && (
              <div className="row iq-actions">
                <button
                  className="button secondary"
                  disabled={acting || (job.status === 'uncertain' && !ack)}
                  onClick={() => void control('retry')}
                >
                  Retry step · API charges may apply
                </button>
              </div>
            )}
            {job && isInProgress(job) && (
              <p className="fine-print">
                Completed steps are reused. Closing this panel pauses further steps; an in-flight
                call may still finish and be billed. Reopen this original to resume.
              </p>
            )}
            {job?.status === 'superseded' && onViewVersion && (
              <p className="fine-print">
                Open the latest version to process the current text of this original.
              </p>
            )}
            {!job && earlier && onViewVersion && (
              <div className="row iq-actions">
                <button className="button secondary small" onClick={() => onViewVersion(earlier)}>
                  <History size={13} aria-hidden />
                  View version {earlier} and its summary
                </button>
              </div>
            )}
          </div>

          {!job && latest && (
            <form
              className="intelligence-consent iq-consent"
              aria-labelledby={`${ids}-consent`}
              onSubmit={(e) => {
                e.preventDefault();
                void start();
              }}
            >
              <h4 id={`${ids}-consent`}>Before anything is sent</h4>
              <dl className="iq-disclosure">
                <div>
                  <dt>What is sent</dt>
                  <dd>
                    The active text of this original only (source version {memory.version}). No
                    other memory is included.
                  </dd>
                </div>
                <div>
                  <dt>Who receives it</dt>
                  <dd>
                    OpenAI creates the semantic index
                    {status.embedding.model ? ` (${status.embedding.model})` : ''}. The summary
                    provider you choose below writes the cited summary and insights.
                  </dd>
                </div>
                <div>
                  <dt>What it may cost</dt>
                  <dd>
                    API charges apply and are billed by each provider to the API account connected
                    to this server. ECHO cannot see prices or balances. One original needs at most{' '}
                    {MAX_REQUESTS_PER_RUN} provider requests before retries ({PASSAGES_PER_REQUEST}{' '}
                    passages per request, up to {PASSAGE_LIMIT} passages). A daily limit on this
                    server stops runaway use. Retries can add requests and charges.
                  </dd>
                </div>
                <div>
                  <dt>What is kept</dt>
                  <dd>
                    The generated analysis is stored separately. Your original is never changed, and
                    your API keys are never shown here.
                  </dd>
                </div>
              </dl>
              <label>
                Summary provider
                <select
                  aria-label="Summary provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  disabled={!configured.length}
                >
                  {configured.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.model}
                    </option>
                  ))}
                  {!configured.length && <option value={provider}>No provider connected</option>}
                </select>
              </label>
              <p className="fine-print">
                Up to {PASSAGE_LIMIT} passages, with at most {PASSAGES_PER_REQUEST} per request.
                Larger originals are preserved but require a later processing increment. Uncertain
                charges require explicit review before retry.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Allow processing of this original with these providers.
              </label>
              {blockers.length > 0 && (
                <ul className="iq-blockers" id={`${ids}-blockers`}>
                  {blockers.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                  <li>
                    Original reading and keyword search remain available. Saved credentials do not
                    need replacing; they must be available to this running server.
                  </li>
                </ul>
              )}
              <button
                className="button primary full"
                aria-describedby={blockers.length ? `${ids}-blockers` : undefined}
                disabled={
                  !consent ||
                  starting ||
                  !status.embedding.configured ||
                  !settings?.providers.find((p) => p.id === provider)?.configured
                }
              >
                {starting ? 'Checking account access…' : 'Generate summary & index'}
              </button>
            </form>
          )}

          {newest ? (
            <>
              <AnalysisCard
                analysis={newest}
                stale={view.state === 'outdated'}
                onOpen={(passage, trail) =>
                  onOpen(memory.id, newest.source_version, passage, trail)
                }
              />
              {older.length > 0 && (
                <details className="iq-older">
                  <summary>
                    {older.length} earlier generated {older.length === 1 ? 'summary' : 'summaries'}{' '}
                    for this version
                  </summary>
                  {older.map((analysis) => (
                    <AnalysisCard
                      key={analysis.id}
                      analysis={analysis}
                      stale={view.state === 'outdated'}
                      onOpen={(passage, trail) =>
                        onOpen(memory.id, analysis.source_version, passage, trail)
                      }
                    />
                  ))}
                </details>
              )}
            </>
          ) : (
            <div className="iq-preview">
              <span className="eyebrow">
                <TextQuote size={11} aria-hidden /> EXTRACTIVE PREVIEW · NOT AI-GENERATED
              </span>
              <p>{memory.summary}</p>
              <p className="fine-print">
                These are the opening words of your original, copied without interpretation. No
                generated summary has been published for this source version.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AnalysisCard({
  analysis,
  stale,
  onOpen,
}: {
  analysis: GeneratedAnalysis;
  stale: boolean;
  onOpen: (passage: string, trail: string[]) => void;
}) {
  const view = numberAnalysis(analysis.result);
  const trail = view.passages.map((p) => p.chunkId);
  const groups: { title: string; empty: string; claims: NumberedClaim[] }[] = [
    {
      title: 'Decisions',
      empty: 'No decision is stated in this original.',
      claims: view.decisions,
    },
    {
      title: 'Open questions',
      empty: 'No unresolved question is stated in this original.',
      claims: view.questions,
    },
    {
      title: 'Commitments',
      empty: 'No commitment is stated in this original.',
      claims: view.commitments,
    },
  ];
  const insightCount = groups.reduce((n, g) => n + g.claims.length, 0);
  return (
    <article className={`generated-analysis iq-analysis${stale ? ' is-stale' : ''}`}>
      <span className="eyebrow iq-ai-badge">
        <Sparkles size={11} aria-hidden /> AI-GENERATED SUMMARY · SOURCE V{analysis.source_version}
      </span>
      <p className="fine-print">
        Written by {providerName(analysis.provider)} · {analysis.model} ·{' '}
        <time dateTime={analysis.created_at}>{when(analysis.created_at)}</time> · prompt{' '}
        {analysis.prompt_version}
      </p>
      {stale && (
        <p className="iq-stale-note">
          <TriangleAlert size={13} aria-hidden /> This summary describes source version{' '}
          {analysis.source_version}, not the current text.
        </p>
      )}
      <ClaimList claims={view.summary} label="Summary claims" onOpen={onOpen} trail={trail} />
      <h4 className="iq-section-title">
        Structured insights <span>{insightCount}</span>
      </h4>
      {insightCount === 0 && (
        <p className="fine-print">
          No explicit decisions, unresolved questions or commitments were extracted.
        </p>
      )}
      {insightCount > 0 &&
        groups.map((group) => (
          <section key={group.title} className="iq-insights" aria-label={group.title}>
            <h5>
              {group.title} <span>{group.claims.length}</span>
            </h5>
            {group.claims.length ? (
              <ClaimList claims={group.claims} label={group.title} onOpen={onOpen} trail={trail} />
            ) : (
              <p className="fine-print">{group.empty}</p>
            )}
          </section>
        ))}
      {view.passages.length > 0 && (
        <p className="fine-print iq-sources">
          {view.passages.length} original{' '}
          {view.passages.length === 1 ? 'passage is' : 'passages are'} cited. Each number always
          refers to the same passage of source version {analysis.source_version}.
        </p>
      )}
      <p className="fine-print">
        Quotes are checked against the original. Generated interpretations still need your review;
        citations are not proof of factual truth.
      </p>
    </article>
  );
}

function ClaimList({
  claims,
  label,
  trail,
  onOpen,
}: {
  claims: NumberedClaim[];
  label: string;
  trail: string[];
  onOpen: (passage: string, trail: string[]) => void;
}) {
  return (
    <ul className="iq-claims" aria-label={label}>
      {claims.map((claim, index) => (
        <li key={index} className="analysis-claim iq-claim">
          <p className="iq-claim-text">{claim.text}</p>
          {(claim.speakerRole || claim.certainty) && (
            <p className="fine-print iq-claim-attribution">
              {claim.speakerRole && <>Source speaker: {claim.speakerRole}. </>}
              {claim.certainty && <>Interpretation: {claim.certainty}.</>}
            </p>
          )}
          {claim.citations.length ? (
            <ul className="iq-evidence" aria-label="Evidence from the original">
              {claim.citations.map((citation, i) => (
                <li key={`${citation.chunkId}-${i}`}>
                  <blockquote>{citation.quote}</blockquote>
                  <button
                    type="button"
                    className="iq-cite"
                    onClick={() => onOpen(citation.chunkId, trail)}
                  >
                    <span className="iq-cite-number" aria-hidden>
                      {citation.number}
                    </span>
                    Original passage {citation.number}
                    <ArrowUpRight size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fine-print iq-unsupported">
              No original passage is attached to this statement. Treat it as unverified.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
