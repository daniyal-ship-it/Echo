// MOCK CONTRACT backend for the Phase 4B collaboration frontend. Test-only: it is never
// imported by application code and never reaches a provider. It implements the endpoints
// described in docs/PHASE4_UX_CONTRACT.md so the interface can be exercised before the real
// backend (Phase 4A) exists. All generated text is labelled as mock output.
import type {
  CollaborationMode,
  CollaborationProvider,
  CollaborationStage,
  WireCollaboration,
  WireStep,
  WireSummary,
  WireTurn,
} from '../../lib/collaboration-ui-types';
import type { Citation } from '../../lib/types';

export const MOCK_MODELS: Record<CollaborationProvider, string> = {
  openai: 'mock-openai-model',
  anthropic: 'mock-anthropic-model',
};
const PLAN: Record<CollaborationMode, CollaborationStage[]> = {
  parallel: ['preparing_context', 'analysis', 'synthesis'],
  deliberate: ['preparing_context', 'analysis', 'cross_review', 'synthesis'],
};
export const MOCK_LIMITS: Record<CollaborationMode, number> = { parallel: 3, deliberate: 5 };
const other = (p: CollaborationProvider): CollaborationProvider =>
  p === 'openai' ? 'anthropic' : 'openai';

export type MockFailure = 'failed' | 'uncertain';
export type MockOptions = {
  /** Sources returned as each turn's citations. Use real memory ids to test opening them. */
  citations?: Citation[];
  /** Deliberate runs stop after analysis until the reader continues. */
  pauseBeforeReview?: boolean;
  now?: () => string;
};
export function createMockBackend(options: MockOptions = {}) {
  const store = new Map<string, WireCollaboration>();
  const calls: { method: string; path: string; body: unknown }[] = [];
  let sequence = 0;
  let failNext: MockFailure | null = null;
  let clock = Date.parse('2026-11-13T10:00:00Z');
  const now = options.now ?? (() => new Date((clock += 1000)).toISOString());
  const citations = options.citations ?? [];
  const next = (prefix: string) => `${prefix}-${String(++sequence).padStart(4, '0')}`;

  function steps(mode: CollaborationMode): WireStep[] {
    return PLAN[mode].flatMap((stage): WireStep[] =>
      stage === 'analysis' || stage === 'cross_review'
        ? (['openai', 'anthropic'] as const).map((provider) => ({
            id: next('step'),
            stage,
            provider,
            model: MOCK_MODELS[provider],
            status: 'pending',
          }))
        : [
            {
              id: next('step'),
              stage,
              provider: stage === 'synthesis' ? 'openai' : null,
              model: stage === 'synthesis' ? MOCK_MODELS.openai : null,
              status: 'pending',
            },
          ],
    );
  }
  function turn(index: number, prompt: string, mode: CollaborationMode): WireTurn {
    const at = now();
    return {
      id: next('turn'),
      index,
      prompt,
      status: 'queued',
      createdAt: at,
      updatedAt: at,
      steps: steps(mode),
      messages: [],
      citations: [],
      result: null,
      error: null,
    };
  }
  function touch(c: WireCollaboration, t: WireTurn, status: WireCollaboration['status']) {
    const at = now();
    c.status = status;
    c.updatedAt = at;
    t.status = status;
    t.updatedAt = at;
    c.canFollowUp = status === 'completed';
  }
  function runStage(c: WireCollaboration, t: WireTurn, stage: CollaborationStage) {
    const pending = t.steps.filter((s) => s.stage === stage);
    const refs = citations.map((_, i) => i + 1);
    for (const step of pending) {
      const at = now();
      step.startedAt = step.startedAt ?? at;
      if (failNext && step.provider) {
        step.status = failNext;
        step.error =
          failNext === 'uncertain'
            ? 'MOCK: the provider request was interrupted; billing outcome unknown.'
            : 'MOCK: the provider returned HTTP 500.';
        t.error = step.error;
        c.limits.usedProviderCalls += 1;
        touch(c, t, failNext === 'uncertain' ? 'needs_review' : 'failed');
        failNext = null;
        return;
      }
      step.status = 'succeeded';
      step.completedAt = at;
      if (stage === 'preparing_context') {
        t.citations = citations;
        continue;
      }
      c.limits.usedProviderCalls += 1;
      const provider = step.provider!;
      const name = provider === 'openai' ? 'GPT' : 'Claude';
      t.messages.push({
        id: next('message'),
        stage,
        provider,
        model: MOCK_MODELS[provider],
        reviewOf: stage === 'cross_review' ? other(provider) : null,
        text:
          stage === 'analysis'
            ? `[MOCK ${name} ANALYSIS] Turn ${t.index + 1}: ${t.prompt} — the sources say the codes are in a sealed envelope${refs.length ? ' [1]' : ''}.`
            : stage === 'cross_review'
              ? `[MOCK ${name} REVIEW] The other analysis is supported by the envelope passage but overstates the March review.`
              : `[MOCK SYNTHESIS] Both models place the codes in the sealed envelope; they differ on the review date.`,
        createdAt: at,
        usage:
          provider === 'anthropic' && stage === 'analysis'
            ? null
            : { inputTokens: 80, outputTokens: 50 },
        citations: refs.slice(0, 1),
      });
      if (stage === 'synthesis')
        t.result = {
          jointConclusions: [
            {
              text: '[MOCK] The access codes are kept in a sealed envelope inside the desk.',
              citations: refs.slice(0, 1),
            },
          ],
          disagreements: [
            {
              topic: '[MOCK] When the codes should be reviewed',
              positions: [
                { provider: 'openai', text: '[MOCK] The note fixes the review in March.' },
                {
                  provider: 'anthropic',
                  text: '[MOCK] March is mentioned, but not as a commitment.',
                },
              ],
              citations: refs.slice(0, 1),
            },
          ],
          openQuestions: [{ text: '[MOCK] Who is responsible for the review?', citations: [] }],
          unverified: [
            { text: '[MOCK] The envelope may have been moved since the note.', citations: [] },
          ],
        };
    }
  }
  function advance(c: WireCollaboration, action: string, acknowledge: boolean) {
    const t = c.turns.at(-1)!;
    if (c.status === 'completed' || c.status === 'cancelled') return { status: 200, json: c };
    if (c.status === 'needs_review' && !(action === 'retry' && acknowledge))
      return {
        status: 409,
        json: {
          error:
            'The previous provider outcome is unknown. Acknowledge possible duplicate charges before retrying.',
        },
      };
    if (action === 'retry')
      for (const step of t.steps)
        if (step.status === 'failed' || step.status === 'uncertain') {
          step.status = 'pending';
          step.error = null;
        }
    t.error = null;
    const stage = PLAN[c.mode].find((s) =>
      t.steps.some((step) => step.stage === s && step.status !== 'succeeded'),
    );
    if (!stage) {
      touch(c, t, 'completed');
      return { status: 200, json: c };
    }
    if (
      options.pauseBeforeReview &&
      stage === 'cross_review' &&
      c.status !== 'awaiting_continuation'
    ) {
      touch(c, t, 'awaiting_continuation');
      return { status: 200, json: c };
    }
    touch(c, t, 'running');
    runStage(c, t, stage);
    if (c.status === 'running' && t.steps.every((s) => s.status === 'succeeded'))
      touch(c, t, 'completed');
    return { status: 200, json: c };
  }
  const summary = (c: WireCollaboration): WireSummary => ({
    id: c.id,
    task: c.task,
    mode: c.mode,
    status: c.status,
    participants: c.participants,
    turnCount: c.turns.length,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  });

  function handle(method: string, path: string, body: unknown): { status: number; json: unknown } {
    calls.push({ method, path, body });
    const data = (body ?? {}) as Record<string, unknown>;
    const [, id, action] = path.match(/^\/api\/collaborations(?:\/([^/?]+)(?:\/(\w+))?)?/) ?? [];
    if (!id) {
      if (method === 'GET')
        return {
          status: 200,
          json: {
            collaborations: [...store.values()]
              .map(summary)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
            modes: {
              parallel: { maxProviderCalls: MOCK_LIMITS.parallel },
              deliberate: { maxProviderCalls: MOCK_LIMITS.deliberate },
            },
          },
        };
      if (data.consent !== true || typeof data.task !== 'string' || !data.task.trim())
        return { status: 400, json: { error: 'A task and explicit consent are required.' } };
      const mode: CollaborationMode = data.mode === 'deliberate' ? 'deliberate' : 'parallel';
      const at = now();
      const created: WireCollaboration = {
        id: next('collab'),
        task: data.task.trim(),
        mode,
        status: 'queued',
        participants: (['openai', 'anthropic'] as const).map((provider) => ({
          provider,
          model: MOCK_MODELS[provider],
        })),
        limits: { maxProviderCalls: MOCK_LIMITS[mode], usedProviderCalls: 0 },
        canFollowUp: false,
        savedMemoryId: null,
        createdAt: at,
        updatedAt: at,
        turns: [],
      };
      created.turns.push(turn(0, created.task, mode));
      store.set(created.id, created);
      return { status: 201, json: created };
    }
    const c = store.get(id);
    if (!c) return { status: 404, json: { error: 'Collaboration not found.' } };
    if (method === 'GET' && !action) return { status: 200, json: c };
    if (method === 'POST' && action === 'advance')
      return advance(c, String(data.action ?? 'continue'), data.acknowledgeCharge === true);
    if (method === 'POST' && action === 'cancel') {
      if (c.status !== 'completed') {
        const t = c.turns.at(-1)!;
        for (const step of t.steps) if (step.status !== 'succeeded') step.status = 'cancelled';
        touch(c, t, 'cancelled');
      }
      return { status: 200, json: c };
    }
    if (method === 'POST' && action === 'turns') {
      if (!c.canFollowUp)
        return { status: 409, json: { error: 'This collaboration cannot take a follow-up now.' } };
      if (data.consent !== true || typeof data.prompt !== 'string' || !data.prompt.trim())
        return { status: 400, json: { error: 'A prompt and explicit consent are required.' } };
      const t = turn(c.turns.length, data.prompt.trim(), c.mode);
      c.turns.push(t);
      c.limits.maxProviderCalls += MOCK_LIMITS[c.mode];
      touch(c, t, 'queued');
      return { status: 200, json: c };
    }
    return { status: 404, json: { error: 'Endpoint not found.' } };
  }
  return {
    handle,
    calls,
    store,
    /** The next provider stage ends in this state instead of succeeding. */
    failNextStage(kind: MockFailure) {
      failNext = kind;
    },
    /** Directly edits a saved collaboration, to stage states a single request cannot reach. */
    edit(id: string, change: (collaboration: WireCollaboration) => void) {
      const c = store.get(id);
      if (!c) throw new Error(`No mock collaboration ${id}`);
      change(c);
      c.updatedAt = now();
    },
    /** A fetch-compatible transport for the isolated client in unit tests. */
    transport: async (input: string, init: RequestInit = {}) => {
      const result = handle(
        init.method ?? 'GET',
        input,
        typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      );
      return new Response(JSON.stringify(result.json), {
        status: result.status,
        headers: { 'content-type': 'application/json' },
      });
    },
  };
}
export type MockBackend = ReturnType<typeof createMockBackend>;
