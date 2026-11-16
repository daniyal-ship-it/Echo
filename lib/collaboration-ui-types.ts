// Wire contract the collaboration frontend needs from the backend (Phase 4A, Codex-owned).
// These types describe what the browser sends and expects to receive. They are documented in
// docs/PHASE4_UX_CONTRACT.md and must be reconciled with the real API at integration.
import type { Citation } from './types';

export type CollaborationMode = 'parallel' | 'deliberate';
export type CollaborationProvider = 'openai' | 'anthropic';
export type CollaborationStatus =
  | 'queued'
  | 'running'
  | 'awaiting_continuation'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'needs_review';
export type CollaborationStage = 'preparing_context' | 'analysis' | 'cross_review' | 'synthesis';
export type StepStatus =
  'pending' | 'running' | 'succeeded' | 'failed' | 'uncertain' | 'skipped' | 'cancelled';

export type Participant = { provider: CollaborationProvider; model: string };
/** One saved unit of orchestration. `provider` is absent for stages no model performs. */
export type WireStep = {
  id: string;
  stage: CollaborationStage;
  provider?: CollaborationProvider | null;
  model?: string | null;
  status: StepStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  error?: string | null;
};
export type WireMessage = {
  id: string;
  stage: Exclude<CollaborationStage, 'preparing_context'>;
  provider: CollaborationProvider;
  model: string;
  /** For cross-review: the provider whose analysis this message reviews. */
  reviewOf?: CollaborationProvider | null;
  text: string;
  createdAt: string;
  usage?: { inputTokens: number; outputTokens: number } | null;
  /** 1-based numbers into the turn's `citations`. */
  citations?: number[];
};
export type WirePoint = { text: string; citations?: number[] };
export type WireDisagreement = {
  topic: string;
  positions: { provider: CollaborationProvider; text: string }[];
  citations?: number[];
};
export type WireResult = {
  jointConclusions: WirePoint[];
  agreements?: WirePoint[];
  disagreements: WireDisagreement[];
  openQuestions: WirePoint[];
  unverified: WirePoint[];
};
export type WireTurn = {
  id: string;
  index: number;
  prompt: string;
  status: CollaborationStatus;
  createdAt: string;
  updatedAt: string;
  steps: WireStep[];
  messages: WireMessage[];
  /** Sources supplied to the models for this turn, in citation-number order. */
  citations: Citation[];
  result?: WireResult | null;
  error?: string | null;
  contextCurrent?: boolean;
  billingUncertain?: boolean;
  reportedTokens?: number | null;
};
export type WireCollaboration = {
  id: string;
  task: string;
  mode: CollaborationMode;
  status: CollaborationStatus;
  participants: Participant[];
  limits: { maxProviderCalls: number; usedProviderCalls: number };
  /** Whether POST /turns is accepted in the current state. */
  canFollowUp: boolean;
  canRetry?: boolean;
  /** The saved conversation memory, when the backend has stored one. */
  savedMemoryId?: string | null;
  createdAt: string;
  updatedAt: string;
  turns: WireTurn[];
};
export type WireSummary = {
  id: string;
  task: string;
  mode: CollaborationMode;
  status: CollaborationStatus;
  participants: Participant[];
  turnCount: number;
  createdAt: string;
  updatedAt: string;
};
export type WireList = {
  collaborations: WireSummary[];
  /** Server-enforced upper bounds per mode, when the backend publishes them. */
  modes?: Partial<Record<CollaborationMode, { maxProviderCalls: number }>>;
};
export type CreateRequest = {
  task: string;
  mode: CollaborationMode;
  models: Record<CollaborationProvider, string>;
  consent: true;
  /** The same optional library scope the assistant endpoint accepts. */
  filters?: Record<string, string>;
};
export type AdvanceRequest = { action: 'continue' | 'retry'; acknowledgeCharge?: boolean };
export type TurnRequest = { prompt: string; consent: true };
