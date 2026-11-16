'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CircleCheck,
  CircleDashed,
  CirclePause,
  History,
  Loader2,
  OctagonAlert,
  Plus,
  RotateCcw,
  ShieldQuestion,
  TriangleAlert,
  Waypoints,
  X,
} from 'lucide-react';
import {
  CollaborationError,
  createCollaborationClient,
  type CollaborationClient,
} from '@/lib/collaboration-client';
import type {
  CollaborationMode,
  CollaborationProvider,
  WireCollaboration,
  WireList,
  WireTurn,
} from '@/lib/collaboration-ui-types';
import {
  ContractError,
  MODE_INFO,
  activity,
  callBound,
  controls,
  isAdvancing,
  messagesOf,
  participantName,
  readCollaboration,
  readList,
  reportedTokens,
  resultView,
  statusView,
  vendorName,
  workflow,
  type CitedPoint,
  type Tone,
  type WorkflowStep,
} from '@/lib/collaboration-view';
import type { Citation } from '@/lib/types';
import { collaborationLimits } from '@/lib/collaboration-adapter';
import type { Settings } from '../panels';

export type CollaborationPlace =
  | { collab: 'compose'; task: string }
  | { collab: 'history' }
  | { collab: 'run'; id: string; task: string };

type Fault = { kind: CollaborationError['kind'] | 'contract'; message: string };
const fault = (error: unknown): Fault =>
  error instanceof CollaborationError
    ? { kind: error.kind, message: error.message }
    : error instanceof ContractError
      ? { kind: 'contract', message: error.message }
      : { kind: 'server', message: (error as Error).message || 'Something went wrong.' };
const when = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const TONE_ICON: Record<Tone, typeof CircleCheck> = {
  idle: CircleDashed,
  active: Loader2,
  held: CirclePause,
  done: CircleCheck,
  problem: OctagonAlert,
  caution: ShieldQuestion,
};

export default function CollaborationPanel({
  place,
  settings,
  scope,
  scopeLabel,
  client: provided,
  onGo,
  onClose,
  onOpenCitation,
  onOpenMemory,
  onFocusSource,
}: {
  place: CollaborationPlace;
  settings: Settings | null;
  /** The library scope applied to retrieval, exactly as the assistant modes send it. */
  scope: Record<string, string>;
  scopeLabel: string;
  client?: CollaborationClient;
  onGo: (place: CollaborationPlace) => void;
  onClose: () => void;
  onOpenCitation: (citation: Citation) => void;
  onOpenMemory: (id: string) => void;
  /** Lets the brain point at the first source a finished turn relied on. */
  onFocusSource?: (citation: Citation) => void;
}) {
  const client = useMemo(() => provided ?? createCollaborationClient(), [provided]);
  const [list, setList] = useState<WireList | null>(null);
  const [listFault, setListFault] = useState<Fault | null>(null);
  const [listAttempt, setListAttempt] = useState(0);
  // Runs this window was told to advance: created or resumed here, with consent.
  const driven = useRef(new Set<string>());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setListFault(null);
    client
      .list(controller.signal)
      .then((raw) => setList(readList(raw)))
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setListFault(fault(error));
      });
    return () => controller.abort();
  }, [client, listAttempt, place.collab]);
  const key = place.collab === 'run' ? `run:${place.id}` : place.collab;
  useEffect(() => {
    // Move reading focus to the new view for keyboard and screen-reader users.
    heading.current?.focus({ preventScroll: true });
  }, [key]);
  const title =
    place.collab === 'compose'
      ? 'New collaboration'
      : place.collab === 'history'
        ? 'Collaborations'
        : place.task || 'Collaboration';
  return (
    <section className="collab" aria-label="Multi-AI collaboration">
      <div className="inspector-heading">
        <span className="eyebrow">
          <Waypoints size={11} aria-hidden /> COLLABORATE · GPT + CLAUDE
        </span>
        <button className="icon-button" aria-label="Close collaboration" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="collab-body">
        <nav className="collab-nav" aria-label="Collaboration views">
          {place.collab !== 'history' ? (
            <button className="text-button" onClick={() => onGo({ collab: 'history' })}>
              <History size={13} aria-hidden />
              All collaborations
            </button>
          ) : (
            <span />
          )}
          {place.collab !== 'compose' && (
            <button className="text-button" onClick={() => onGo({ collab: 'compose', task: '' })}>
              <Plus size={13} aria-hidden />
              New collaboration
            </button>
          )}
        </nav>
        <h2 ref={heading} tabIndex={-1} className="collab-title">
          {title}
        </h2>
        {place.collab === 'compose' && (
          <Composer
            key="compose"
            initialTask={place.task}
            settings={settings}
            scope={scope}
            scopeLabel={scopeLabel}
            list={list}
            listFault={listFault}
            client={client}
            onRetryService={() => setListAttempt((n) => n + 1)}
            onCreated={(created) => {
              driven.current.add(created.id);
              onGo({ collab: 'run', id: created.id, task: created.task });
            }}
          />
        )}
        {place.collab === 'history' && (
          <HistoryList
            list={list}
            fault={listFault}
            onRetry={() => setListAttempt((n) => n + 1)}
            onOpen={(id, task) => onGo({ collab: 'run', id, task })}
            onCompose={() => onGo({ collab: 'compose', task: '' })}
          />
        )}
        {place.collab === 'run' && (
          <Run
            key={place.id}
            id={place.id}
            client={client}
            driven={driven.current}
            onOpenCitation={onOpenCitation}
            onOpenMemory={onOpenMemory}
            onFocusSource={onFocusSource}
          />
        )}
      </div>
    </section>
  );
}

function FaultNotice({ fault: f, onRetry }: { fault: Fault; onRetry?: () => void }) {
  return (
    <div className="collab-alert" role="alert" data-fault={f.kind}>
      <TriangleAlert size={16} aria-hidden />
      <div>
        <p>{f.message}</p>
        {f.kind === 'unavailable' && (
          <p className="fine-print">
            Nothing was sent to an AI provider. Source search and the existing assistant modes are
            unaffected.
          </p>
        )}
        {f.kind === 'offline' && (
          <p className="fine-print">
            ECHO does not know whether the server received the last request. It will not repeat it
            for you.
          </p>
        )}
        {onRetry && (
          <button className="button secondary small" onClick={onRetry}>
            <RotateCcw size={13} aria-hidden />
            {f.kind === 'unavailable' ? 'Check again' : 'Reload'}
          </button>
        )}
      </div>
    </div>
  );
}

function Composer({
  initialTask,
  settings,
  scope,
  scopeLabel,
  list,
  listFault,
  client,
  onRetryService,
  onCreated,
}: {
  initialTask: string;
  settings: Settings | null;
  scope: Record<string, string>;
  scopeLabel: string;
  list: WireList | null;
  listFault: Fault | null;
  client: CollaborationClient;
  onRetryService: () => void;
  onCreated: (collaboration: WireCollaboration) => void;
}) {
  const ids = useId();
  const [task, setTask] = useState(initialTask);
  const [mode, setMode] = useState<CollaborationMode>('parallel');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<Fault | null>(null);
  const providers = (['openai', 'anthropic'] as CollaborationProvider[]).map((id) => ({
    id,
    info: settings?.providers.find((p) => p.id === id),
  }));
  const missing = providers.filter((p) => !p.info?.configured);
  const bound = callBound(mode, list?.modes);
  const blockers = [
    listFault?.kind === 'unavailable' ? listFault.message : '',
    settings && missing.length
      ? `${missing.map((p) => vendorName(p.id)).join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not connected on this server. Collaboration needs both.`
      : '',
  ].filter(Boolean);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending || !consent || !settings || missing.length || !task.trim()) return;
    setSending(true);
    setError(null);
    try {
      onCreated(
        readCollaboration(
          await client.create({
            task: task.trim(),
            mode,
            consent: true,
            filters: scope,
            models: {
              openai: settings!.providers.find((p) => p.id === 'openai')!.model!,
              anthropic: settings!.providers.find((p) => p.id === 'anthropic')!.model!,
            },
          }),
        ),
      );
    } catch (e) {
      setError(fault(e));
      setSending(false);
    }
  }
  return (
    <form className="collab-composer" onSubmit={submit} aria-label="Collaboration task">
      <p className="collab-lede">
        One task goes to two models. Each answers from your retrieved sources, and you see every
        stage, each model’s own words, and where they disagree. Nothing is sent until you allow it
        below.
      </p>
      {listFault && listFault.kind !== 'unavailable' && (
        <FaultNotice fault={listFault} onRetry={onRetryService} />
      )}
      <label htmlFor={`${ids}-task`}>Task</label>
      <textarea
        id={`${ids}-task`}
        value={task}
        onChange={(e) => setTask(e.target.value)}
        rows={4}
        maxLength={2000}
        required
        placeholder="What should GPT and Claude work on together?"
      />
      <fieldset className="collab-modes">
        <legend>How they work</legend>
        {(['parallel', 'deliberate'] as CollaborationMode[]).map((id) => (
          <label key={id} className={`collab-mode${mode === id ? ' is-chosen' : ''}`}>
            <input
              type="radio"
              name={`${ids}-mode`}
              value={id}
              checked={mode === id}
              onChange={() => setMode(id)}
            />
            <span>
              <strong>{MODE_INFO[id].name}</strong>
              <span>{MODE_INFO[id].summary}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="collab-participants" aria-label="Participating models">
        {providers.map(({ id, info }) => (
          <div
            key={id}
            className={`collab-chip lane-${id}${info?.configured ? '' : ' is-missing'}`}
          >
            <strong>{participantName(id)}</strong>
            <span>
              {vendorName(id)} · {info?.configured ? info.model : 'not connected'}
            </span>
          </div>
        ))}
      </div>
      <dl className="collab-disclosure">
        <div>
          <dt>Who receives data</dt>
          <dd>OpenAI and Anthropic, through the API accounts connected to this server.</dd>
        </div>
        <div>
          <dt>What is sent</dt>
          <dd>
            Your task and matching passages from your original memories in {scopeLabel}. In later
            stages each model may also receive the other model’s answer.
          </dd>
        </div>
        <div>
          <dt>Provider requests</dt>
          <dd>
            At most {bound.calls} for {MODE_INFO[mode].name.toLowerCase()}:{' '}
            {MODE_INFO[mode].sequence.map((s) => s.toLowerCase()).join('; ')}. This includes{' '}
            {MODE_INFO[mode].plannedCalls} planned requests and up to 3 explicitly approved retries.
            Keyword retrieval makes no embedding request. Each request is limited to{' '}
            {collaborationLimits(mode).maxOutputTokens} output tokens and{' '}
            {collaborationLimits(mode).maxInputBytes.toLocaleString()} input bytes.
          </dd>
        </div>
        <div>
          <dt>Possible cost</dt>
          <dd>
            API charges apply and are billed by each provider. ECHO has no price data and shows no
            amounts.
          </dd>
        </div>
        <div>
          <dt>What is stored</dt>
          <dd>
            The task, each stage, each model’s output and the sources used are saved in this
            workspace so the collaboration can be reopened. Your originals are never changed.
          </dd>
        </div>
        <div>
          <dt>Cancelling</dt>
          <dd>
            Stops further stages. A request already with a provider may still finish and be billed.
          </dd>
        </div>
      </dl>
      <label className="check-label">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Allow this task and matching passages to be sent to OpenAI and Anthropic.
      </label>
      {blockers.length > 0 && (
        <ul className="collab-blockers" id={`${ids}-blockers`}>
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
          {listFault?.kind === 'unavailable' && (
            <li>
              <button type="button" className="text-button" onClick={onRetryService}>
                Check again
              </button>
            </li>
          )}
        </ul>
      )}
      {error && <FaultNotice fault={error} />}
      <button
        className="button primary full"
        aria-describedby={blockers.length ? `${ids}-blockers` : undefined}
        disabled={!task.trim() || !consent || !settings || sending || blockers.length > 0}
      >
        {sending ? 'Starting…' : 'Start collaboration'}
      </button>
    </form>
  );
}

function HistoryList({
  list,
  fault: f,
  onRetry,
  onOpen,
  onCompose,
}: {
  list: WireList | null;
  fault: Fault | null;
  onRetry: () => void;
  onOpen: (id: string, task: string) => void;
  onCompose: () => void;
}) {
  if (f) return <FaultNotice fault={f} onRetry={onRetry} />;
  if (!list)
    return (
      <p role="status" className="collab-loading">
        <Loader2 size={14} className="spin" aria-hidden /> Loading saved collaborations…
      </p>
    );
  if (!list.collaborations.length)
    return (
      <div className="quiet-empty">
        <Waypoints size={24} aria-hidden />
        <p>No collaborations yet.</p>
        <span>A collaboration you start is saved here with every stage and model output.</span>
        <button className="button secondary small" onClick={onCompose}>
          <Plus size={13} aria-hidden />
          New collaboration
        </button>
      </div>
    );
  return (
    <ul className="collab-history" aria-label="Saved collaborations">
      {list.collaborations.map((c) => {
        const view = statusView(c.status);
        return (
          <li key={c.id}>
            <button className="collab-history-row" onClick={() => onOpen(c.id, c.task)}>
              <span className={`collab-dot tone-${view.tone}`} aria-hidden />
              <span>
                <strong>{c.task}</strong>
                <small>
                  {view.label} · {MODE_INFO[c.mode].name} · {c.turnCount}{' '}
                  {c.turnCount === 1 ? 'turn' : 'turns'} ·{' '}
                  <time dateTime={c.updatedAt}>{when(c.updatedAt)}</time>
                </small>
              </span>
              <ArrowUpRight size={14} aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type RunTab = 'result' | CollaborationProvider | 'evidence';

function Run({
  id,
  client,
  driven,
  onOpenCitation,
  onOpenMemory,
  onFocusSource,
}: {
  id: string;
  client: CollaborationClient;
  driven: Set<string>;
  onOpenCitation: (citation: Citation) => void;
  onOpenMemory: (id: string) => void;
  onFocusSource?: (citation: Citation) => void;
}) {
  const ids = useId();
  const [collaboration, setCollaboration] = useState<WireCollaboration | null>(null);
  const [loadFault, setLoadFault] = useState<Fault | null>(null);
  const [actionFault, setActionFault] = useState<Fault | null>(null);
  const [driving, setDriving] = useState(() => driven.has(id));
  const [acting, setActing] = useState(false);
  const [ack, setAck] = useState(false);
  const [tab, setTab] = useState<RunTab>('result');
  const [turnIndex, setTurnIndex] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [followUp, setFollowUp] = useState('');
  const [followConsent, setFollowConsent] = useState(false);
  const live = useRef(true);
  const generation = useRef(0);
  const focusSource = useRef(onFocusSource);
  focusSource.current = onFocusSource;
  const load = useCallback(
    async (signal?: AbortSignal) => readCollaboration(await client.get(id, signal)),
    [client, id],
  );
  useEffect(() => {
    live.current = true;
    const epoch = ++generation.current;
    const controller = new AbortController();
    setLoadFault(null);
    load(controller.signal)
      .then((c) => live.current && generation.current === epoch && setCollaboration(c))
      .catch((error) => {
        if (live.current && generation.current === epoch && (error as Error).name !== 'AbortError')
          setLoadFault(fault(error));
      });
    return () => {
      live.current = false;
      controller.abort();
    };
  }, [load, attempt]);
  const status = collaboration?.status;
  // Advance one saved stage at a time while this view is open. A failed request is never
  // repeated automatically: the saved state is read back instead.
  useEffect(() => {
    if (!driving || status !== 'queued') return;
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const next = readCollaboration(
          await client.advance(id, { action: 'continue' }, controller.signal),
        );
        if (active) {
          setCollaboration(next);
          setDriving(false);
          driven.delete(id);
        }
      } catch (error) {
        if (!active || (error as Error).name === 'AbortError') return;
        setDriving(false);
        driven.delete(id);
        setActionFault(fault(error));
        load()
          .then((c) => active && setCollaboration(c))
          .catch(() => undefined);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [driving, status, collaboration?.updatedAt, client, id, load, driven]);
  useEffect(() => {
    if (status && !isAdvancing(status) && driving) {
      setDriving(false);
      driven.delete(id);
    }
  }, [status, driving, driven, id]);
  // Running means another request owns the stage. Refresh saved state without billing.
  useEffect(() => {
    if (status !== 'running') return;
    let active = true;
    const controller = new AbortController();
    const timer = setInterval(() => {
      const epoch = generation.current;
      load(controller.signal)
        .then((c) => {
          if (active && generation.current === epoch) setCollaboration(c);
        })
        .catch(() => undefined);
    }, 1500);
    return () => {
      active = false;
      clearInterval(timer);
      controller.abort();
    };
  }, [status, load]);
  const turns = collaboration?.turns ?? [];
  const turn: WireTurn | undefined = turns[turnIndex ?? turns.length - 1] ?? turns.at(-1);
  const firstSource = turn?.status === 'completed' ? turn.citations[0] : undefined;
  useEffect(() => {
    if (firstSource) focusSource.current?.(firstSource);
  }, [firstSource?.id, turn?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(request: () => Promise<unknown>, thenDrive: boolean) {
    if (acting) return;
    ++generation.current;
    setDriving(false);
    driven.delete(id);
    setActing(true);
    setActionFault(null);
    try {
      const next = readCollaboration(await request());
      ++generation.current;
      if (!live.current) return;
      setCollaboration(next);
      setAck(false);
      setTurnIndex(null);
      if (thenDrive && isAdvancing(next.status)) {
        driven.add(id);
        setDriving(true);
      }
    } catch (error) {
      if (!live.current) return;
      setActionFault(fault(error));
      const epoch = ++generation.current;
      load()
        .then((c) => live.current && generation.current === epoch && setCollaboration(c))
        .catch(() => undefined);
    } finally {
      if (live.current) setActing(false);
    }
  }

  if (loadFault) return <FaultNotice fault={loadFault} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!collaboration)
    return (
      <p role="status" className="collab-loading">
        <Loader2 size={14} className="spin" aria-hidden /> Opening saved collaboration…
      </p>
    );
  const view = statusView(collaboration.status);
  const Icon = TONE_ICON[view.tone];
  const can = controls(collaboration, driving);
  const steps = turn ? workflow(turn) : [];
  const result = turn ? resultView(turn) : null;
  const tokens = turn ? reportedTokens(turn) : null;
  const tabs: { id: RunTab; label: string }[] = [
    { id: 'result', label: 'Combined result' },
    ...collaboration.participants.map((p) => ({
      id: p.provider as RunTab,
      label: participantName(p.provider),
    })),
    { id: 'evidence', label: `Sources (${turn?.citations.length ?? 0})` },
  ];
  const cited = (sources: CitedPoint['sources']) =>
    sources.length > 0 && (
      <span className="collab-cites">
        {sources.map(({ number, citation }) => (
          <button
            key={number}
            type="button"
            className="collab-cite"
            title={citation.title}
            onClick={() => onOpenCitation(citation)}
          >
            Source {number}
            <span className="sr-only">: {citation.title}</span>
            <ArrowUpRight size={11} aria-hidden />
          </button>
        ))}
      </span>
    );

  return (
    <div className="collab-run" data-status={collaboration.status}>
      <div className="collab-participants" aria-label="Participating models">
        {collaboration.participants.map((p) => (
          <div key={p.provider} className={`collab-chip lane-${p.provider}`}>
            <strong>{participantName(p.provider)}</strong>
            <span>
              {vendorName(p.provider)} · {p.model}
            </span>
          </div>
        ))}
        <div className="collab-chip">
          <strong>{MODE_INFO[collaboration.mode].name}</strong>
          <span>Started {when(collaboration.createdAt)}</span>
        </div>
      </div>

      <div className={`collab-state tone-${view.tone}`}>
        <span className="collab-state-icon" aria-hidden>
          <Icon size={18} className={view.tone === 'active' ? 'spin' : undefined} />
        </span>
        <div>
          <span className="eyebrow">SAVED STATE</span>
          <p className="collab-state-label">{view.label}</p>
          <p className="collab-state-meaning">{view.meaning}</p>
          <p className="collab-activity" role="status" aria-live="polite">
            {activity(collaboration, driving)}
          </p>
        </div>
      </div>

      {steps.length > 0 && <Lanes steps={steps} participants={collaboration.participants} />}
      <p className="collab-usage">
        {collaboration.limits.maxProviderCalls > 0
          ? `${collaboration.limits.usedProviderCalls} of at most ${collaboration.limits.maxProviderCalls} provider requests reserved for this turn.`
          : `${collaboration.limits.usedProviderCalls} provider requests reserved for this turn.`}{' '}
        {tokens !== null
          ? `${tokens.toLocaleString()} tokens reported for this turn.`
          : 'No token usage has been reported for this turn.'}
      </p>

      {turn?.billingUncertain && (
        <p className="collab-alert" role="status">
          Some provider billing is still unknown. Successful recovery does not erase an earlier
          uncertain charge.
        </p>
      )}
      {turn?.error && (
        <div className="collab-alert" role="alert">
          <TriangleAlert size={16} aria-hidden />
          <p>{turn.error}</p>
        </div>
      )}
      {actionFault && <FaultNotice fault={actionFault} />}
      {can.acknowledge && (
        <label className="check-label">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I
          understand that retrying may duplicate a provider charge.
        </label>
      )}
      <div className="collab-actions">
        {can.resume && (
          <button
            className="button secondary"
            disabled={acting}
            onClick={() => void act(() => client.advance(id, { action: 'continue' }), false)}
          >
            Resume run
          </button>
        )}
        {can.continueStage && (
          <button
            className="button primary"
            disabled={acting}
            onClick={() => void act(() => client.advance(id, { action: 'continue' }), true)}
          >
            Continue to next stage
          </button>
        )}
        {can.retry && (
          <button
            className="button secondary"
            disabled={acting || (can.acknowledge && !ack)}
            onClick={() =>
              void act(() => client.advance(id, { action: 'retry', acknowledgeCharge: ack }), true)
            }
          >
            Retry stage · API charges may apply
          </button>
        )}
        {can.cancel && (
          <button
            className="text-button"
            disabled={acting}
            onClick={() => {
              setDriving(false);
              driven.delete(id);
              void act(() => client.cancel(id), false);
            }}
          >
            Cancel run
          </button>
        )}
      </div>
      {(can.cancel || can.resume) && (
        <p className="fine-print">
          Stages start only on an explicit start, resume or continue action. Running requests are
          refreshed without starting new work. Cancelling stops further stages; a request already
          with a provider may still finish and be billed.
        </p>
      )}

      {turns.length > 1 && (
        <div className="collab-turns" role="group" aria-label="Turns in this collaboration">
          {turns.map((t, i) => (
            <button
              key={t.id}
              aria-pressed={t.id === turn?.id}
              className={t.id === turn?.id ? 'active' : ''}
              onClick={() => setTurnIndex(i)}
            >
              Turn {i + 1}
            </button>
          ))}
        </div>
      )}
      {turn && (
        <>
          <blockquote className="collab-prompt">
            <span className="eyebrow">
              {turns.length > 1 ? `TURN ${turns.indexOf(turn) + 1} · ` : ''}YOUR TASK
            </span>
            {turn.prompt}
          </blockquote>
          <div className="collab-tabs" role="group" aria-label="Collaboration output">
            {tabs.map((t) => (
              <button
                key={t.id}
                aria-pressed={tab === t.id}
                className={`${tab === t.id ? 'active' : ''} ${t.id === 'openai' || t.id === 'anthropic' ? `lane-${t.id}` : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="collab-output" id={`${ids}-output`}>
            {tab === 'result' &&
              (result ? (
                <article className="collab-result">
                  {result.unsettled && (
                    <p className="collab-unsettled">
                      <TriangleAlert size={13} aria-hidden /> The models did not settle everything.
                      Disagreements and open questions are listed, not resolved.
                    </p>
                  )}
                  <ResultSection
                    title="Source-grounded synthesis"
                    empty="No source-grounded synthesis claims were recorded."
                    note="Claims written by the synthesizing model with checked source quotations. They are not verified consensus."
                    count={result.jointConclusions.length}
                  >
                    {result.jointConclusions.map((p, i) => (
                      <li key={i}>
                        <p>{p.text}</p>
                        {cited(p.sources)}
                      </li>
                    ))}
                  </ResultSection>
                  <ResultSection
                    title="Reported agreements"
                    empty="No agreement was recorded."
                    note="Agreement reported by the synthesizing model is not proof."
                    count={result.agreements.length}
                  >
                    {result.agreements.map((p, i) => (
                      <li key={i}>
                        <p>{p.text}</p>
                        {cited(p.sources)}
                      </li>
                    ))}
                  </ResultSection>
                  <ResultSection
                    title="Disagreements"
                    empty="No disagreement was recorded."
                    note="Differences reported by the synthesizing model. Inspect both independent analyses and reviews."
                    count={result.disagreements.length}
                    tone="caution"
                  >
                    {result.disagreements.map((d, i) => (
                      <li key={i}>
                        <p className="collab-topic">{d.topic}</p>
                        {d.positions.map((position, j) => (
                          <p key={j} className={`collab-position lane-${position.provider}`}>
                            <strong>{participantName(position.provider)}</strong> {position.text}
                          </p>
                        ))}
                        {cited(d.sources)}
                      </li>
                    ))}
                  </ResultSection>
                  <ResultSection
                    title="Open questions"
                    empty="No open question was recorded."
                    note="Not answered by the sources or the models."
                    count={result.openQuestions.length}
                  >
                    {result.openQuestions.map((p, i) => (
                      <li key={i}>
                        <p>{p.text}</p>
                        {cited(p.sources)}
                      </li>
                    ))}
                  </ResultSection>
                  <ResultSection
                    title="Unverified interpretations"
                    empty="No unverified interpretation was recorded."
                    note="Model reasoning without a supporting source. Treat as unverified."
                    count={result.unverified.length}
                    tone="caution"
                  >
                    {result.unverified.map((p, i) => (
                      <li key={i}>
                        <p>{p.text}</p>
                        {cited(p.sources)}
                      </li>
                    ))}
                  </ResultSection>
                </article>
              ) : (
                <p className="collab-empty">
                  {turn.status === 'completed'
                    ? 'This turn finished without a combined result. Each model’s own output is under its tab.'
                    : 'No combined result has been saved for this turn yet.'}
                </p>
              ))}
            {(tab === 'openai' || tab === 'anthropic') &&
              (messagesOf(turn, tab).length ? (
                messagesOf(turn, tab).map((m) => (
                  <article key={m.id} className={`collab-message lane-${m.provider}`}>
                    <span className="eyebrow">{m.heading.toUpperCase()}</span>
                    <p className="fine-print">
                      {vendorName(m.provider)} · {m.model} ·{' '}
                      <time dateTime={m.createdAt}>{when(m.createdAt)}</time> ·{' '}
                      {m.tokens !== null
                        ? `${m.tokens.toLocaleString()} tokens reported`
                        : 'token usage not reported'}
                    </p>
                    <p className="collab-text">{m.text}</p>
                    {cited(m.sources)}
                  </article>
                ))
              ) : (
                <p className="collab-empty">
                  {participantName(tab)} has no saved output in this turn.
                </p>
              ))}
            {tab === 'evidence' &&
              (turn.citations.length ? (
                <>
                  <p className="fine-print">
                    The passages supplied to both models for this turn. Opening one shows the
                    original at the cited version.
                  </p>
                  {turn.citations.map((c, i) => (
                    <button
                      className="citation"
                      key={c.chunkId || `${c.id}-${i}`}
                      onClick={() => onOpenCitation(c)}
                    >
                      <div>
                        <span className="citation-number">{i + 1}</span>
                        <strong>{c.title}</strong>
                        <ArrowUpRight size={14} aria-hidden />
                      </div>
                      <p>{c.excerpt}</p>
                      <span>{c.source} · Open original</span>
                      {c.version && (
                        <small>
                          {' '}
                          · Version {c.version}
                          {c.chunkId ? ' · Exact passage' : ''}
                        </small>
                      )}
                    </button>
                  ))}
                </>
              ) : (
                <p className="collab-empty">No source passages are saved for this turn.</p>
              ))}
          </div>
        </>
      )}
      {collaboration.savedMemoryId && (
        <button className="text-button" onClick={() => onOpenMemory(collaboration.savedMemoryId!)}>
          <ArrowLeft size={13} aria-hidden style={{ transform: 'rotate(135deg)' }} />
          Open the memory saved from this collaboration
        </button>
      )}
      {can.followUp && (
        <form
          className="collab-follow"
          aria-label="Follow-up question"
          onSubmit={(event) => {
            event.preventDefault();
            const prompt = followUp.trim();
            if (!prompt || !followConsent) return;
            setFollowUp('');
            setFollowConsent(false);
            void act(() => client.addTurn(id, { prompt, consent: true }), true);
          }}
        >
          <label htmlFor={`${ids}-follow`}>Continue this collaboration</label>
          <textarea
            id={`${ids}-follow`}
            rows={3}
            maxLength={2000}
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Ask a follow-up in the same thread"
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={followConsent}
              onChange={(e) => setFollowConsent(e.target.checked)}
            />
            Send this follow-up, matching passages and bounded previous discussion to the same
            providers. The same per-turn call, output-token and input-byte limits apply. New API
            charges apply.
          </label>
          <button
            className="button primary"
            disabled={!followUp.trim() || !followConsent || acting}
          >
            Send follow-up
          </button>
        </form>
      )}
      {collaboration.status === 'completed' && !collaboration.canFollowUp && (
        <p className="fine-print">Follow-up turns are not available for this collaboration.</p>
      )}
    </div>
  );
}

function ResultSection({
  title,
  note,
  empty,
  count,
  tone,
  children,
}: {
  title: string;
  note: string;
  empty: string;
  count: number;
  tone?: 'caution';
  children: React.ReactNode;
}) {
  return (
    <section className={`collab-section${tone ? ` tone-${tone}` : ''}`} aria-label={title}>
      <h3>
        {title} <span>{count}</span>
      </h3>
      {count ? (
        <>
          <p className="fine-print">{note}</p>
          <ul>{children}</ul>
        </>
      ) : (
        <p className="fine-print">{empty}</p>
      )}
    </section>
  );
}

/** Two model lanes that start together, run side by side and converge on the synthesis. */
function Lanes({
  steps,
  participants,
}: {
  steps: WorkflowStep[];
  participants: { provider: CollaborationProvider }[];
}) {
  const order = participants.map((p) => p.provider);
  const stages = steps.map((s) => s.stage).filter((stage, i, all) => all.indexOf(stage) === i);
  return (
    <ol className="collab-lanes" aria-label="Saved workflow stages">
      {stages.map((stage) => {
        const row = steps.filter((s) => s.stage === stage);
        const shared = row.filter((s) => s.lane === 'shared');
        return (
          <li key={stage} className={`collab-row${shared.length ? ' is-shared' : ''}`}>
            {shared.length
              ? shared.map((s) => <StepCell key={s.id} step={s} />)
              : order.map((provider) => {
                  const step = row.find((s) => s.lane === provider);
                  return step ? (
                    <StepCell key={step.id} step={step} />
                  ) : (
                    <span key={provider} className="collab-step is-absent" aria-hidden />
                  );
                })}
          </li>
        );
      })}
    </ol>
  );
}
function StepCell({ step }: { step: WorkflowStep }) {
  return (
    <div className={`collab-step lane-${step.lane} is-${step.status}`}>
      <span className="collab-step-mark" aria-hidden />
      <span className="collab-step-label">{step.label}</span>
      <span className="collab-step-detail">{step.detail}</span>
      {step.error && <span className="collab-step-error">{step.error}</span>}
    </div>
  );
}
