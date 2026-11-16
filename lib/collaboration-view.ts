// Typed presentation adapter for collaborations. It reads what the API returned, refuses
// shapes it does not understand, and derives every label from saved state. It never invents a
// stage, a model, progress or a result.
import type { Citation } from './types';
import { collaborationLimits } from './collaboration-adapter';
import type {
  CollaborationMode,
  CollaborationProvider,
  CollaborationStage,
  CollaborationStatus,
  Participant,
  StepStatus,
  WireCollaboration,
  WireList,
  WireMessage,
  WirePoint,
  WireStep,
  WireSummary,
  WireTurn,
} from './collaboration-ui-types';

/** Raised when the server's response does not match the contract this interface was built to. */
export class ContractError extends Error {
  constructor(detail: string) {
    super(`ECHO could not read the collaboration returned by the server (${detail}).`);
    this.name = 'ContractError';
  }
}
const STATUSES: CollaborationStatus[] = [
  'queued',
  'running',
  'awaiting_continuation',
  'completed',
  'failed',
  'cancelled',
  'needs_review',
];
const STAGES: CollaborationStage[] = ['preparing_context', 'analysis', 'cross_review', 'synthesis'];
const STEP_STATUSES: StepStatus[] = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'uncertain',
  'skipped',
  'cancelled',
];
const PROVIDERS: CollaborationProvider[] = ['openai', 'anthropic'];
const MODES: CollaborationMode[] = ['parallel', 'deliberate'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (o: Obj, key: string, where: string) => {
  if (typeof o[key] !== 'string') throw new ContractError(`${where}.${key} is not text`);
  return o[key] as string;
};
const oneOf = <T extends string>(o: Obj, key: string, allowed: T[], where: string) => {
  const value = o[key];
  if (typeof value !== 'string' || !allowed.includes(value as T))
    throw new ContractError(`${where}.${key} has the unrecognised value "${String(value)}"`);
  return value as T;
};
const list = (o: Obj, key: string, where: string) => {
  if (!Array.isArray(o[key])) throw new ContractError(`${where}.${key} is not a list`);
  return o[key] as unknown[];
};
const optionalText = (v: unknown) => (typeof v === 'string' && v ? v : null);
const numbers = (v: unknown) =>
  Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n) && n > 0) : [];
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

function readParticipants(o: Obj, where: string): Participant[] {
  return list(o, 'participants', where).map((p, i) => {
    if (!isObj(p)) throw new ContractError(`${where}.participants[${i}] is not an object`);
    return {
      provider: oneOf(p, 'provider', PROVIDERS, `${where}.participants[${i}]`),
      model: str(p, 'model', `${where}.participants[${i}]`),
    };
  });
}
function readPoints(v: unknown, where: string): WirePoint[] {
  if (!Array.isArray(v)) throw new ContractError(`${where} is not a list`);
  return v.map((p, i) => {
    if (!isObj(p)) throw new ContractError(`${where}[${i}] is not an object`);
    return { text: str(p, 'text', `${where}[${i}]`), citations: numbers(p.citations) };
  });
}
function readTurn(raw: unknown, where: string): WireTurn {
  if (!isObj(raw)) throw new ContractError(`${where} is not an object`);
  const steps = list(raw, 'steps', where).map((s, i): WireStep => {
    const at = `${where}.steps[${i}]`;
    if (!isObj(s)) throw new ContractError(`${at} is not an object`);
    return {
      id: str(s, 'id', at),
      stage: oneOf(s, 'stage', STAGES, at),
      provider: s.provider == null ? null : oneOf(s, 'provider', PROVIDERS, at),
      model: optionalText(s.model),
      status: oneOf(s, 'status', STEP_STATUSES, at),
      startedAt: optionalText(s.startedAt),
      completedAt: optionalText(s.completedAt),
      error: optionalText(s.error),
    };
  });
  const messages = list(raw, 'messages', where).map((m, i): WireMessage => {
    const at = `${where}.messages[${i}]`;
    if (!isObj(m)) throw new ContractError(`${at} is not an object`);
    const usage = isObj(m.usage)
      ? { inputTokens: count(m.usage.inputTokens), outputTokens: count(m.usage.outputTokens) }
      : null;
    return {
      id: str(m, 'id', at),
      stage: oneOf(m, 'stage', ['analysis', 'cross_review', 'synthesis'], at),
      provider: oneOf(m, 'provider', PROVIDERS, at),
      model: str(m, 'model', at),
      reviewOf: m.reviewOf == null ? null : oneOf(m, 'reviewOf', PROVIDERS, at),
      text: str(m, 'text', at),
      createdAt: str(m, 'createdAt', at),
      usage,
      citations: numbers(m.citations),
    };
  });
  const citations = list(raw, 'citations', where).map((c, i) => {
    const at = `${where}.citations[${i}]`;
    if (!isObj(c)) throw new ContractError(`${at} is not an object`);
    str(c, 'id', at);
    str(c, 'title', at);
    str(c, 'excerpt', at);
    return c as unknown as Citation;
  });
  let result: WireTurn['result'] = null;
  if (raw.result != null) {
    if (!isObj(raw.result)) throw new ContractError(`${where}.result is not an object`);
    const r = raw.result;
    result = {
      agreements: r.agreements ? readPoints(r.agreements, `${where}.result.agreements`) : [],
      jointConclusions: readPoints(r.jointConclusions, `${where}.result.jointConclusions`),
      openQuestions: readPoints(r.openQuestions, `${where}.result.openQuestions`),
      unverified: readPoints(r.unverified, `${where}.result.unverified`),
      disagreements: list(r, 'disagreements', `${where}.result`).map((d, i) => {
        const at = `${where}.result.disagreements[${i}]`;
        if (!isObj(d)) throw new ContractError(`${at} is not an object`);
        return {
          topic: str(d, 'topic', at),
          citations: numbers(d.citations),
          positions: list(d, 'positions', at).map((p, j) => {
            if (!isObj(p)) throw new ContractError(`${at}.positions[${j}] is not an object`);
            return {
              provider: oneOf(p, 'provider', PROVIDERS, `${at}.positions[${j}]`),
              text: str(p, 'text', `${at}.positions[${j}]`),
            };
          }),
        };
      }),
    };
  }
  return {
    id: str(raw, 'id', where),
    index: count(raw.index),
    prompt: str(raw, 'prompt', where),
    status: oneOf(raw, 'status', STATUSES, where),
    createdAt: str(raw, 'createdAt', where),
    updatedAt: str(raw, 'updatedAt', where),
    steps,
    messages,
    citations,
    result,
    error: optionalText(raw.error),
    contextCurrent: raw.contextCurrent !== false,
    billingUncertain: raw.billingUncertain === true,
    reportedTokens:
      raw.reportedTokens === null
        ? null
        : typeof raw.reportedTokens === 'number'
          ? raw.reportedTokens
          : undefined,
  };
}
/** Validates a collaboration from the API. Throws ContractError rather than guess. */
export function readCollaboration(raw: unknown): WireCollaboration {
  if (!isObj(raw)) throw new ContractError('the response is not an object');
  const limits = isObj(raw.limits) ? raw.limits : {};
  return {
    id: str(raw, 'id', 'collaboration'),
    task: str(raw, 'task', 'collaboration'),
    mode: oneOf(raw, 'mode', MODES, 'collaboration'),
    status: oneOf(raw, 'status', STATUSES, 'collaboration'),
    participants: readParticipants(raw, 'collaboration'),
    limits: {
      maxProviderCalls: count(limits.maxProviderCalls),
      usedProviderCalls: count(limits.usedProviderCalls),
    },
    canFollowUp: raw.canFollowUp === true,
    canRetry: raw.canRetry !== false,
    savedMemoryId: optionalText(raw.savedMemoryId),
    createdAt: str(raw, 'createdAt', 'collaboration'),
    updatedAt: str(raw, 'updatedAt', 'collaboration'),
    turns: list(raw, 'turns', 'collaboration').map((t, i) => readTurn(t, `turns[${i}]`)),
  };
}
export function readList(raw: unknown): WireList {
  if (!isObj(raw)) throw new ContractError('the list response is not an object');
  const collaborations = list(raw, 'collaborations', 'list').map((c, i): WireSummary => {
    const at = `collaborations[${i}]`;
    if (!isObj(c)) throw new ContractError(`${at} is not an object`);
    return {
      id: str(c, 'id', at),
      task: str(c, 'task', at),
      mode: oneOf(c, 'mode', MODES, at),
      status: oneOf(c, 'status', STATUSES, at),
      participants: readParticipants(c, at),
      turnCount: count(c.turnCount),
      createdAt: str(c, 'createdAt', at),
      updatedAt: str(c, 'updatedAt', at),
    };
  });
  const modes: WireList['modes'] = {};
  if (isObj(raw.modes))
    for (const mode of MODES) {
      const entry = raw.modes[mode];
      if (isObj(entry) && count(entry.maxProviderCalls) > 0)
        modes[mode] = { maxProviderCalls: count(entry.maxProviderCalls) };
    }
  return { collaborations, modes };
}

// ── Presentation ─────────────────────────────────────────────────────────────────────────

/** Short names used in running text; the vendor and exact model are always shown beside them. */
export const participantName = (provider: CollaborationProvider) =>
  provider === 'openai' ? 'GPT' : 'Claude';
export const vendorName = (provider: CollaborationProvider) =>
  provider === 'openai' ? 'OpenAI' : 'Anthropic';

export type ModeInfo = {
  id: CollaborationMode;
  name: string;
  summary: string;
  sequence: string[];
  /** Calls the planned workflow makes when nothing is retried. Not a server guarantee. */
  plannedCalls: number;
};
export const MODE_INFO: Record<CollaborationMode, ModeInfo> = {
  parallel: {
    id: 'parallel',
    name: 'Parallel analysis',
    summary: 'Both models answer independently from the same authorised sources.',
    sequence: ['Each model analyses the task on its own; no synthesis in this mode'],
    plannedCalls: 2,
  },
  deliberate: {
    id: 'deliberate',
    name: 'Deliberate collaboration',
    summary: 'Both models answer, each reviews the other’s answer, then one synthesis.',
    sequence: [
      'Each model analyses the task on its own',
      'Each model reviews the other’s analysis',
      'One synthesis of analyses and reviews',
    ],
    plannedCalls: 5,
  },
};
/** The call bound to disclose before sending: the server's figure when published, else the plan. */
export function callBound(mode: CollaborationMode, published?: WireList['modes']) {
  void published;
  return { calls: collaborationLimits(mode).maxCalls, source: 'requested' as const };
}

export type Tone = 'idle' | 'active' | 'held' | 'done' | 'problem' | 'caution';
export type StatusView = { label: string; tone: Tone; meaning: string };
export function statusView(status: CollaborationStatus): StatusView {
  switch (status) {
    case 'queued':
      return {
        label: 'Queued',
        tone: 'held',
        meaning: 'Consent is recorded and the run is saved. No provider request has started.',
      };
    case 'running':
      return { label: 'Running', tone: 'active', meaning: 'A saved stage is in progress.' };
    case 'awaiting_continuation':
      return {
        label: 'Awaiting continuation',
        tone: 'held',
        meaning: 'The finished stages are saved. The next stage starts only when you continue.',
      };
    case 'completed':
      return { label: 'Completed', tone: 'done', meaning: 'Every planned stage has finished.' };
    case 'failed':
      return {
        label: 'Failed',
        tone: 'problem',
        meaning: 'A stage did not finish. Finished stages are kept.',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        tone: 'held',
        meaning: 'You stopped this run. Finished stages are kept.',
      };
    case 'needs_review':
      return {
        label: 'Needs review',
        tone: 'caution',
        meaning:
          'A provider request was interrupted, so it is unknown whether it was billed. Nothing is retried until you decide.',
      };
  }
}

export type Lane = CollaborationProvider | 'shared';
export type WorkflowStep = {
  id: string;
  lane: Lane;
  stage: CollaborationStage;
  status: StepStatus;
  /** A label in the tense the saved status supports, e.g. "GPT analysing" or "GPT analysed". */
  label: string;
  detail: string;
  error: string | null;
};
const STEP_STATE: Record<StepStatus, string> = {
  pending: 'Not started',
  running: 'In progress',
  succeeded: 'Finished',
  failed: 'Failed',
  uncertain: 'Outcome unknown',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};
function stepLabel(step: WireStep, reviewed: CollaborationProvider | null) {
  const who = step.provider ? participantName(step.provider) : '';
  const done = step.status === 'succeeded';
  const active = step.status === 'running';
  switch (step.stage) {
    case 'preparing_context':
      return done ? 'Context prepared' : active ? 'Preparing context' : 'Prepare context';
    case 'analysis':
      return who
        ? `${who} ${done ? 'analysed' : active ? 'analysing' : 'analysis'}`
        : done
          ? 'Analysis finished'
          : 'Analysis';
    case 'cross_review': {
      const target = reviewed ? ` ${participantName(reviewed)}` : '';
      return who
        ? `${who} ${done ? 'reviewed' : active ? 'reviewing' : 'review of'}${target}`.trim()
        : 'Cross-review';
    }
    case 'synthesis':
      return `${done ? 'Synthesis written' : active ? 'Synthesising' : 'Synthesis'}${who ? ` · ${who}` : ''}`;
  }
}
/** The saved orchestration steps of one turn, in stage order, ready to draw as lanes. */
export function workflow(turn: WireTurn): WorkflowStep[] {
  return turn.steps
    .slice()
    .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage))
    .map((step) => {
      // In a two-model cross-review each model reviews the other one.
      const reviewed =
        step.stage === 'cross_review' && step.provider
          ? (turn.messages.find((m) => m.stage === 'cross_review' && m.provider === step.provider)
              ?.reviewOf ??
            PROVIDERS.find((p) => p !== step.provider) ??
            null)
          : null;
      return {
        id: step.id,
        // Preparation and synthesis belong to the run as a whole, whichever model performs them.
        lane:
          step.stage === 'analysis' || step.stage === 'cross_review'
            ? (step.provider ?? 'shared')
            : 'shared',
        stage: step.stage,
        status: step.status,
        label: stepLabel(step, reviewed),
        detail: [STEP_STATE[step.status], step.model].filter(Boolean).join(' · '),
        error: step.error ?? null,
      };
    });
}
/** One sentence saying what is happening now, for the status line and screen readers. */
export function activity(collaboration: WireCollaboration, driving: boolean): string {
  const turn = collaboration.turns.at(-1);
  const running = turn ? workflow(turn).filter((s) => s.status === 'running') : [];
  if (collaboration.status === 'running' && running.length)
    return running.map((s) => s.label).join(' and ');
  if ((collaboration.status === 'running' || collaboration.status === 'queued') && !driving)
    return `${statusView(collaboration.status).label}. This window is not advancing the run.`;
  return statusView(collaboration.status).label;
}

export type Controls = {
  /** This window may request the next stage without asking again. */
  drive: boolean;
  cancel: boolean;
  resume: boolean;
  continueStage: boolean;
  retry: boolean;
  /** Retrying needs an explicit acknowledgement that a charge may be duplicated. */
  acknowledge: boolean;
  followUp: boolean;
};
export function controls(collaboration: WireCollaboration, driving: boolean): Controls {
  const s = collaboration.status;
  const open = s === 'queued' || s === 'running';
  return {
    drive: open && driving,
    cancel: open || ['awaiting_continuation', 'needs_review', 'failed'].includes(s),
    resume: open && !driving,
    continueStage: s === 'awaiting_continuation',
    retry: (s === 'failed' || s === 'needs_review') && collaboration.canRetry !== false,
    acknowledge: s === 'needs_review',
    followUp: collaboration.canFollowUp,
  };
}
/** Stages still to run are only ever started automatically for these statuses. */
export const isAdvancing = (status: CollaborationStatus) =>
  status === 'queued' || status === 'running';

export type CitedPoint = { text: string; sources: { number: number; citation: Citation }[] };
const cite = (turn: WireTurn, refs: number[] = []) =>
  refs
    .filter((n, i) => refs.indexOf(n) === i && turn.citations[n - 1])
    .map((number) => ({ number, citation: turn.citations[number - 1] }));
export type ResultView = {
  jointConclusions: CitedPoint[];
  agreements: CitedPoint[];
  disagreements: {
    topic: string;
    positions: { provider: CollaborationProvider; text: string }[];
    sources: CitedPoint['sources'];
  }[];
  openQuestions: CitedPoint[];
  unverified: CitedPoint[];
  /** True when the models disagreed or left questions open: the answer is not settled. */
  unsettled: boolean;
};
export function resultView(turn: WireTurn): ResultView | null {
  if (!turn.result) return null;
  const points = (items: WirePoint[]) =>
    items.map((p) => ({ text: p.text, sources: cite(turn, p.citations) }));
  const disagreements = turn.result.disagreements.map((d) => ({
    topic: d.topic,
    positions: d.positions,
    sources: cite(turn, d.citations),
  }));
  const openQuestions = points(turn.result.openQuestions);
  return {
    jointConclusions: points(turn.result.jointConclusions),
    agreements: points(turn.result.agreements || []),
    disagreements,
    openQuestions,
    unverified: points(turn.result.unverified),
    unsettled: disagreements.length > 0 || openQuestions.length > 0,
  };
}
export type MessageView = WireMessage & {
  heading: string;
  sources: CitedPoint['sources'];
  tokens: number | null;
};
const STAGE_HEADING = {
  analysis: 'Independent analysis',
  cross_review: 'Cross-review',
  synthesis: 'Synthesis',
} as const;
export function messagesOf(turn: WireTurn, provider?: CollaborationProvider): MessageView[] {
  return turn.messages
    .filter((m) => !provider || m.provider === provider)
    .map((m) => ({
      ...m,
      heading:
        m.stage === 'cross_review' && m.reviewOf
          ? `${participantName(m.provider)} reviewing ${participantName(m.reviewOf)}`
          : `${STAGE_HEADING[m.stage]} by ${participantName(m.provider)}`,
      sources: cite(turn, m.citations),
      tokens: m.usage ? m.usage.inputTokens + m.usage.outputTokens : null,
    }));
}
/** Tokens the provider reported for a turn. Null when no message reported usage. */
export function reportedTokens(turn: WireTurn) {
  if (turn.reportedTokens !== undefined) return turn.reportedTokens;
  const reported = turn.messages.filter((m) => m.usage);
  return reported.length
    ? reported.reduce((n, m) => n + m.usage!.inputTokens + m.usage!.outputTokens, 0)
    : null;
}
