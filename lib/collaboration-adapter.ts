// Strict translation of the real v1 API into the frontend's presentation model.
// No provider output, progress event or agreement is invented here.
import { z } from 'zod';
import { COLLABORATION_VERSION, reasoningSchema, turnInput } from './collaboration-types';
import type { Reasoning } from './collaboration-types';
import type {
  WireCollaboration,
  WireTurn,
  WireList,
  CollaborationStatus,
} from './collaboration-ui-types';
const status = z.enum([
  'queued',
  'running',
  'awaiting-next-step',
  'completed',
  'failed',
  'cancelled',
  'uncertain',
]);
const provider = z.enum(['openai', 'anthropic']);
const stage = z.enum(['analysis', 'review', 'synthesis']);
const count = z.number().int().nonnegative();
const date = z.iso.datetime();
const citation = z
  .object({
    id: z.uuid(),
    title: z.string(),
    excerpt: z.string().min(1),
    source: z.string(),
    region: z.enum(['frontal', 'parietal', 'temporal', 'occipital']),
    rank: z.number(),
    version: z.number().int().positive(),
    chunkId: z.uuid().optional(),
    brainNodeId: z.uuid().optional(),
    startOffset: count.optional(),
    endOffset: count.optional(),
  })
  .passthrough();
const call = z
  .object({
    id: z.uuid(),
    turn_id: z.uuid(),
    stage,
    provider,
    model: z.string().min(1),
    attempt: count.min(1),
    status: z.enum(['planned', 'dispatched', 'completed', 'failed', 'uncertain', 'withheld']),
    billing: z.enum(['not-sent', 'unknown', 'reported', 'rejected']),
    usable: z.boolean(),
    retryable: z.boolean(),
    created_at: date,
    finished_at: date.nullable(),
    error: z.string().nullable(),
    output: z
      .object({
        provider,
        model: z.string(),
        text: z.string(),
        inputTokens: count,
        outputTokens: count,
        usageKnown: z.boolean().optional(),
      })
      .nullable(),
    result: reasoningSchema.nullable(),
  })
  .passthrough();
const turn = z
  .object({
    id: z.uuid(),
    thread_id: z.uuid(),
    ordinal: count.min(1),
    question: z.string(),
    mode: z.enum(['parallel', 'deliberate']),
    config: turnInput,
    status,
    stage,
    created_at: date,
    updated_at: date,
    lease_until: date.nullable(),
    citations: z.array(citation),
    calls: z.array(call),
    contextCurrent: z.boolean(),
    error: z.string().nullable(),
    limits: z.object({
      maxCalls: count,
      maxOutputTokens: count,
      maxInputBytes: count,
      expectedCalls: count,
      reservedCalls: count,
      remainingCalls: count,
    }),
    usage: z.object({
      inputTokens: count,
      outputTokens: count,
      billingUncertain: z.boolean(),
      monetaryCost: z.null(),
    }),
    result: z.array(z.object({ provider, result: reasoningSchema })).nullable(),
  })
  .passthrough();
export const snapshotSchema = z
  .object({
    version: z.literal(COLLABORATION_VERSION),
    id: z.uuid(),
    created_at: date,
    turns: z.array(turn).min(1).max(100),
  })
  .passthrough();
export type Snapshot = z.infer<typeof snapshotSchema>;
const toStatus = (s: z.infer<typeof status>): CollaborationStatus =>
  s === 'awaiting-next-step' ? 'awaiting_continuation' : s === 'uncertain' ? 'needs_review' : s;
const toStage = (s: z.infer<typeof stage>) => (s === 'review' ? ('cross_review' as const) : s);
function reasoningText(r: Reasoning) {
  return [
    ['Source-grounded claims', r.groundedClaims.map((c) => c.text)],
    ['Interpretations', r.interpretations],
    ['Agreements reported by this model', r.agreements],
    ['Disagreements', r.disagreements],
    ['Uncertainty', r.uncertainty],
  ]
    .map(([name, items]) => `${name}:\n${(items as string[]).join('\n') || 'None recorded.'}`)
    .join('\n\n');
}
export function adaptCollaboration(raw: unknown): WireCollaboration {
  const s = snapshotSchema.parse(raw),
    latest = s.turns.at(-1)!;
  const turns = s.turns.map((t): WireTurn => {
    if (
      t.thread_id !== s.id ||
      t.config.mode !== t.mode ||
      t.config.question !== t.question ||
      t.limits.reservedCalls !== t.calls.length ||
      t.limits.maxCalls !== t.config.limits.maxCalls ||
      t.limits.remainingCalls !== t.limits.maxCalls - t.calls.length
    )
      throw new Error('Inconsistent collaboration snapshot');
    for (const c of t.calls) {
      if (c.turn_id !== t.id) throw new Error('Foreign collaboration call');
      for (const claim of c.result?.groundedClaims || [])
        for (const ref of claim.citations)
          if (!t.citations[ref.source - 1]?.excerpt.includes(ref.quote))
            throw new Error('Invalid collaboration evidence');
    }
    const messages = t.calls
      .filter(
        (c) =>
          c.usable &&
          c.status === 'completed' &&
          t.contextCurrent &&
          c.result &&
          t.status !== 'cancelled',
      )
      .map((c) => ({
        id: c.id,
        stage: toStage(c.stage),
        provider: c.provider,
        model: c.output?.model || c.model,
        reviewOf:
          c.stage === 'review'
            ? c.provider === 'openai'
              ? ('anthropic' as const)
              : ('openai' as const)
            : null,
        text: reasoningText(c.result!),
        createdAt: c.finished_at || c.created_at,
        usage:
          c.output && c.billing === 'reported'
            ? { inputTokens: c.output.inputTokens, outputTokens: c.output.outputTokens }
            : null,
        citations: [
          ...new Set(
            c.result!.groundedClaims.flatMap((claim) => claim.citations.map((ref) => ref.source)),
          ),
        ],
      }));
    // Display only actual ledger entries; future stages are not fabricated saved events.
    const steps = t.calls.map((c) => ({
      id: c.id,
      stage: toStage(c.stage),
      provider: c.provider,
      model: c.model,
      status: (c.status === 'completed'
        ? 'succeeded'
        : c.status === 'dispatched'
          ? 'running'
          : c.status === 'planned'
            ? 'pending'
            : c.status === 'withheld'
              ? 'failed'
              : c.status) as WireTurn['steps'][number]['status'],
      startedAt: c.created_at,
      completedAt: c.finished_at,
      error: c.error,
    }));
    const final =
      t.status === 'completed' && t.contextCurrent && t.mode === 'deliberate'
        ? t.calls.find((c) => c.stage === 'synthesis' && c.usable && c.status === 'completed')
            ?.result
        : null;
    return {
      id: t.id,
      index: t.ordinal - 1,
      prompt: t.question,
      status: toStatus(t.status),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      steps,
      messages,
      citations: t.citations,
      contextCurrent: t.contextCurrent,
      billingUncertain: t.usage.billingUncertain,
      reportedTokens: t.calls.some((c) => c.billing === 'reported')
        ? t.usage.inputTokens + t.usage.outputTokens
        : null,
      error: !t.contextCurrent
        ? 'Source evidence changed or was deleted. Historical outputs are withheld; start a fresh turn.'
        : t.error,
      result: final
        ? {
            jointConclusions: final.groundedClaims.map((c) => ({
              text: c.text,
              citations: c.citations.map((r) => r.source),
            })),
            agreements: final.agreements.map((text) => ({ text })),
            disagreements: final.disagreements.map((topic) => ({ topic, positions: [] })),
            openQuestions: final.uncertainty.map((text) => ({ text })),
            unverified: final.interpretations.map((text) => ({ text })),
          }
        : null,
    };
  });
  return {
    id: s.id,
    task: s.turns[0].question,
    mode: latest.mode,
    status: toStatus(latest.status),
    participants: provider.options.map((p) => ({ provider: p, model: latest.config.models[p] })),
    limits: { maxProviderCalls: latest.limits.maxCalls, usedProviderCalls: latest.calls.length },
    canFollowUp:
      s.turns.length < 100 && ['completed', 'failed', 'cancelled'].includes(latest.status),
    canRetry:
      latest.contextCurrent &&
      latest.limits.remainingCalls > 0 &&
      latest.calls
        .filter((c) => c.stage === latest.stage && c.status !== 'completed')
        .every((c) => c.retryable),
    savedMemoryId: null,
    createdAt: s.created_at,
    updatedAt: latest.updated_at,
    turns,
  };
}
export function adaptList(raw: unknown): WireList {
  const s = z
    .object({
      version: z.literal(COLLABORATION_VERSION),
      threads: z.array(
        z.object({
          id: z.uuid(),
          question: z.string(),
          created_at: date,
          updated_at: date,
          mode: z.enum(['parallel', 'deliberate']),
          status,
          models: z.object({ openai: z.string(), anthropic: z.string() }),
          turn_count: count.min(1),
        }),
      ),
    })
    .parse(raw);
  return {
    collaborations: s.threads.map((t) => ({
      id: t.id,
      task: t.question,
      mode: t.mode,
      status: toStatus(t.status),
      participants: provider.options.map((p) => ({ provider: p, model: t.models[p] })),
      turnCount: t.turn_count,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
  };
}
export const collaborationLimits = (mode: 'parallel' | 'deliberate') => ({
  maxCalls: mode === 'parallel' ? 5 : 8,
  maxOutputTokens: 1200,
  maxInputBytes: 48000,
});
