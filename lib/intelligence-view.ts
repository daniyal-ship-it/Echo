// Pure presentation logic for the memory intelligence panel. It only interprets data the
// existing API already returns; it never fabricates progress, statuses or analysis.
import {
  INTELLIGENCE_BATCH,
  MAX_CHUNKS,
  type Analysis,
  type Claim,
  type Evidence,
  type IntelligenceJob,
} from './intelligence-types';
import type { Edge } from './types';

export type PublicJob = Omit<IntelligenceJob, 'lease_token'>;
export type DisplayState =
  | 'unprocessed'
  | 'queued'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'review'
  | 'cancelled'
  | 'outdated';
export type Tone = 'idle' | 'active' | 'held' | 'done' | 'problem' | 'caution';
export type StateView = {
  state: DisplayState;
  tone: Tone;
  label: string;
  /** One plain sentence saying what this state means for the reader. */
  meaning: string;
};
const IN_PROGRESS = ['queued', 'running', 'retry_wait'];
export const isInProgress = (job?: Pick<PublicJob, 'status'> | null) =>
  !!job && IN_PROGRESS.includes(job.status);

export function deriveState(input: {
  job?: PublicJob | null;
  /** True while this open panel is asking the server to run the next saved step. */
  driving: boolean;
  viewedVersion: number;
  latestVersion: number;
  hasAnalysis: boolean;
  /** Source version of a summary that exists for an earlier version, when the latest has none. */
  earlierSummaryVersion?: number | null;
  now?: number;
}): StateView {
  const { job, driving, viewedVersion, latestVersion, hasAnalysis } = input;
  const now = input.now ?? Date.now();
  if (viewedVersion !== latestVersion) {
    if (job || hasAnalysis)
      return {
        state: 'outdated',
        tone: 'caution',
        label: 'Outdated',
        meaning: `This describes source version ${viewedVersion}. The original is now at version ${latestVersion}.`,
      };
    return {
      state: 'unprocessed',
      tone: 'idle',
      label: 'Not processed',
      meaning: `Source version ${viewedVersion} was never processed. Only the latest version can be processed.`,
    };
  }
  if (!job) {
    if (input.earlierSummaryVersion)
      return {
        state: 'outdated',
        tone: 'caution',
        label: 'Outdated',
        meaning: `A summary exists for source version ${input.earlierSummaryVersion}, but the original has changed since. This version has not been processed.`,
      };
    return {
      state: 'unprocessed',
      tone: 'idle',
      label: 'Not processed',
      meaning:
        'Nothing has been sent to an AI provider. Keyword search and the original are available.',
    };
  }
  switch (job.status) {
    case 'completed':
      return {
        state: 'completed',
        tone: 'done',
        label: 'Completed',
        meaning: hasAnalysis
          ? 'Every passage is indexed and a cited summary is published for this version.'
          : 'Every passage is indexed. No summary was published for this version.',
      };
    case 'failed':
      return {
        state: 'failed',
        tone: 'problem',
        label: 'Failed',
        meaning: 'A step did not finish. Completed steps are kept and nothing is published yet.',
      };
    case 'uncertain':
      return {
        state: 'review',
        tone: 'caution',
        label: 'Needs review',
        meaning:
          'A provider call was interrupted, so it is unknown whether it was billed. Review before retrying.',
      };
    case 'cancelled':
      return {
        state: 'cancelled',
        tone: 'held',
        label: 'Cancelled',
        meaning: 'You stopped this run. Completed steps are kept and can be reused.',
      };
    case 'superseded':
      return {
        state: 'outdated',
        tone: 'caution',
        label: 'Outdated',
        meaning: 'The original changed while this run was in progress, so it was stopped.',
      };
  }
  const untouched = job.embedded + job.analysed === 0;
  if (job.status === 'retry_wait')
    return {
      state: 'waiting',
      tone: driving ? 'active' : 'held',
      label: 'Waiting to retry',
      meaning: driving
        ? 'The provider asked ECHO to slow down. The step is retried automatically.'
        : 'The provider asked ECHO to slow down. Resume to retry the saved step.',
    };
  const leased =
    job.status === 'running' && !!job.lease_until && new Date(job.lease_until).getTime() > now;
  if (driving || leased)
    return {
      state: untouched && job.status === 'queued' ? 'queued' : 'running',
      tone: 'active',
      label: untouched && job.status === 'queued' ? 'Queued' : 'Running',
      meaning: driving
        ? 'ECHO is working through the saved steps while this panel stays open.'
        : 'A step started in another session is still in flight.',
    };
  if (untouched)
    return {
      state: 'queued',
      tone: 'held',
      label: 'Queued',
      meaning: 'Consent is recorded and the run is saved, but no step has started.',
    };
  return {
    state: 'paused',
    tone: 'held',
    label: 'Paused',
    meaning: 'Progress is saved on the server. Nothing runs until you resume.',
  };
}

export type Stage = {
  id: 'consent' | 'index' | 'analyse' | 'publish';
  label: string;
  detail: string;
  status: 'done' | 'current' | 'pending' | 'stopped';
  done: number;
  total: number;
};
/** The four real stages of a run, with counts taken from the saved job. */
export function stages(job: PublicJob, hasAnalysis: boolean): Stage[] {
  const total = job.total_chunks;
  const indexed = Math.min(job.embedded, total),
    analysed = Math.min(job.analysed, total);
  const stopped = ['failed', 'uncertain', 'cancelled', 'superseded'].includes(job.status);
  const finished = job.status === 'completed';
  const mark = (done: boolean, current: boolean): Stage['status'] =>
    done ? 'done' : current ? (stopped ? 'stopped' : 'current') : 'pending';
  const indexDone = finished || indexed >= total,
    analyseDone = finished || (indexDone && analysed >= total);
  return [
    {
      id: 'consent',
      label: 'Consent recorded',
      detail: `Source version ${job.source_version}`,
      status: 'done',
      done: 1,
      total: 1,
    },
    {
      id: 'index',
      label: 'Index passages',
      detail: `${indexed} of ${total} indexed`,
      status: mark(indexDone, true),
      done: indexed,
      total,
    },
    {
      id: 'analyse',
      label: 'Analyse passages',
      detail: `${analysed} of ${total} analysed`,
      status: mark(analyseDone, indexDone),
      done: analysed,
      total,
    },
    {
      id: 'publish',
      label: 'Publish cited summary',
      detail: finished ? (hasAnalysis ? 'Published' : 'Nothing published') : 'Not yet published',
      status: mark(finished, analyseDone),
      done: finished ? 1 : 0,
      total: 1,
    },
  ];
}

const batches = (count: number) => Math.ceil(Math.max(0, count) / INTELLIGENCE_BATCH);
/** Requests still needed before retries. Saved results are reused, so it can be lower. */
export function remainingRequests(job: PublicJob) {
  const index = batches(job.total_chunks - job.embedded),
    analyse = batches(job.total_chunks - job.analysed);
  return { index, analyse, total: index + analyse };
}
/** Request bound before retries for one original, before its passages are counted. */
export const MAX_REQUESTS_PER_RUN = batches(MAX_CHUNKS) * 2;
export const PASSAGE_LIMIT = MAX_CHUNKS;
export const PASSAGES_PER_REQUEST = INTELLIGENCE_BATCH;

export type NumberedEvidence = Evidence & { number: number };
export type NumberedClaim = Omit<Claim, 'citations'> & { citations: NumberedEvidence[] };
export type AnalysisView = {
  summary: NumberedClaim[];
  decisions: NumberedClaim[];
  questions: NumberedClaim[];
  commitments: NumberedClaim[];
  /** Every distinct cited passage, in first-cited order. Numbers are stable within one analysis. */
  passages: { chunkId: string; number: number; quote: string }[];
};
/** Gives each distinct cited passage one number so the same passage is always "passage N". */
export function numberAnalysis(result: Analysis): AnalysisView {
  const numbers = new Map<string, number>();
  const passages: AnalysisView['passages'] = [];
  const claim = (c: Claim): NumberedClaim => ({
    ...c,
    citations: c.citations.map((citation) => {
      let number = numbers.get(citation.chunkId);
      if (!number) {
        number = numbers.size + 1;
        numbers.set(citation.chunkId, number);
        passages.push({ chunkId: citation.chunkId, number, quote: citation.quote });
      }
      return { ...citation, number };
    }),
  });
  const summary = result.summary.map(claim);
  const of = (kind: Analysis['insights'][number]['kind']) =>
    result.insights.filter((i) => i.kind === kind).map(claim);
  // Number in reading order: summary first, then each insight group as displayed.
  const decisions = of('decision'),
    questions = of('question'),
    commitments = of('commitment');
  return { summary, decisions, questions, commitments, passages };
}

export type ConnectionGroups = {
  /** Links the reader made or approved. These are the only ones drawn in the brain. */
  confirmed: Edge[];
  /** Suggestions from an explicit shared tag, title or reference, awaiting review. */
  suggestedExplicit: Edge[];
  /** Suggestions inferred from embedding similarity, awaiting review. */
  suggestedInferred: Edge[];
};
export function groupConnections(edges: Edge[]): ConnectionGroups {
  const confirmed = edges.filter((e) => e.status === 'confirmed');
  const candidates = edges.filter((e) => e.status !== 'confirmed');
  return {
    confirmed,
    suggestedExplicit: candidates.filter((e) => e.method !== 'semantic'),
    suggestedInferred: candidates.filter((e) => e.method === 'semantic'),
  };
}
export function connectionOrigin(edge: Edge) {
  if (edge.method === 'manual') return 'Created by you';
  if (edge.method === 'semantic')
    return edge.status === 'confirmed'
      ? 'Inferred from meaning, confirmed by you'
      : 'Inferred from meaning';
  return edge.status === 'confirmed'
    ? 'Found from an explicit tag or reference, confirmed by you'
    : 'Found from an explicit tag or reference';
}

/** Locates a cited passage inside the text it was cut from, or null if the text does not match. */
export function locatePassage(
  text: string,
  passage: { start_offset: number; end_offset: number; content: string },
) {
  const { start_offset: start, end_offset: end } = passage;
  if (start < 0 || end > text.length || start >= end) return null;
  if (text.slice(start, end) !== passage.content) return null;
  return { before: text.slice(0, start), match: text.slice(start, end), after: text.slice(end) };
}
