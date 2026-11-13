import assert from 'node:assert/strict';
import type { Database } from '../../lib/db';
import { uuid } from '../../lib/security';
import { storeMemory } from '../../lib/memories';
import {
  createCollaboration,
  advanceCollaboration,
  getCollaboration,
  addCollaborationTurn,
  cancelCollaboration,
  type CollaborationServices,
} from '../../lib/collaboration';
import { COLLABORATION_VERSION, type TurnInput } from '../../lib/collaboration-types';
import { ProviderFailure } from '../../lib/providers';

export async function workspace(db: Database) {
  const id = uuid(),
    owner = uuid();
  await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
    owner,
    `${owner}@example.test`,
    'Isolated collaboration fixture',
    'unused',
  ]);
  await db.query('INSERT INTO workspaces(id,owner_id,name) VALUES($1,$2,$3)', [
    id,
    owner,
    'MOCK collaboration',
  ]);
  return id;
}
export const note = (key = uuid(), content = 'TEST FIXTURE: The notebook is in the cabinet.') => ({
  source: 'note',
  sourceId: key,
  title: 'Notebook',
  content,
  raw: { content },
  messages: [],
  sourceAt: null,
  kind: 'note',
  tags: [],
});
export function input(mode: TurnInput['mode'] = 'deliberate'): TurnInput {
  return {
    version: COLLABORATION_VERSION,
    idempotencyKey: uuid(),
    question: 'Where is the notebook?',
    mode,
    models: { openai: 'mock-gpt', anthropic: 'mock-claude' },
    consent: true,
    limits: { maxCalls: 8, maxOutputTokens: 800, maxInputBytes: 48000 },
  };
}
export function mocks() {
  const sent: { provider: string; input: any; limit: number | undefined }[] = [];
  const services: CollaborationServices = {
    models: () => ({ openai: 'mock-gpt', anthropic: 'mock-claude' }),
    verify: async (_p, m) => m,
    call: async (provider, _question, sources, _signal, _comparison, options) => {
      sent.push({ provider, input: options?.input, limit: options?.maxOutputTokens });
      return {
        provider,
        model: provider === 'openai' ? 'mock-gpt' : 'mock-claude',
        text: JSON.stringify({
          groundedClaims: sources.length
            ? [
                {
                  text: 'MOCK: a historical statement describes a cabinet.',
                  citations: [{ source: 1, quote: sources[0].excerpt }],
                },
              ]
            : [],
          interpretations: ['MOCK interpretation, not additional evidence.'],
          agreements: [],
          disagreements: ['MOCK: location today is unresolved.'],
          uncertainty: ['Historical source does not prove present location.'],
        }),
        inputTokens: 30,
        outputTokens: 20,
        usageKnown: true,
      };
    },
  };
  return { services, sent };
}
export const advance = (turnId: string, extra = {}) => ({
  version: COLLABORATION_VERSION,
  turnId,
  idempotencyKey: uuid(),
  ...extra,
});
export async function fixture(db: Database, mode: TurnInput['mode'] = 'deliberate') {
  const w = await workspace(db),
    item = note();
  const memory = await db.transaction((tx) => storeMemory(tx, w, item));
  const { services, sent } = mocks(),
    request = input(mode);
  const thread = await createCollaboration(db, w, request, services);
  return { w, item, memory, services, sent, request, thread, turn: thread.turns[0].id };
}

export const scenarios: Record<string, (db: Database) => Promise<void>> = {
  async 'late output from a superseded lease is retained without replacing the published recovery result'(
    db,
  ) {
    const f = await fixture(db, 'parallel'),
      base = f.services.call;
    let ready!: () => void,
      release!: () => void,
      started = 0;
    const bothStarted = new Promise<void>((r) => {
      ready = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    f.services.call = async (...args) => {
      if (++started === 2) ready();
      await gate;
      const output = await base(...args),
        parsed = JSON.parse(output.text);
      parsed.interpretations = ['LATE ORIGINAL RESPONSE'];
      return { ...output, text: JSON.stringify(parsed) };
    };
    const oldWork = advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
    await bothStarted;
    try {
      await db.query(
        "UPDATE collaboration_turns SET lease_until=now()-interval '1 second' WHERE id=$1",
        [f.turn],
      );
      await advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
      f.services.call = base;
      const recovered = await advanceCollaboration(
        db,
        f.w,
        f.thread.id,
        advance(f.turn, { retry: true, acknowledgePossibleDuplicateCharge: true }),
        f.services,
      );
      assert.equal(recovered.turns[0].status, 'completed');
      const published = recovered.turns[0].result;
      release();
      await oldWork;
      const afterLate = await getCollaboration(db, f.w, f.thread.id);
      assert.deepEqual(afterLate.turns[0].result, published);
      assert.equal(afterLate.turns[0].calls.length, 4);
      assert.equal(afterLate.turns[0].calls.filter((c) => c.status === 'withheld').length, 2);
      assert.equal(afterLate.turns[0].usage.inputTokens, 120);
    } finally {
      release();
      await oldWork;
    }
  },

  async 'deliberate checkpoints exchange actual peer outputs; synthesis and follow-up persist without creating memories'(
    db,
  ) {
    const f = await fixture(db),
      { w, thread, services, sent } = f;
    const step = advance(f.turn);
    let result = await advanceCollaboration(db, w, thread.id, step, services);
    assert.equal(result.turns[0].status, 'awaiting-next-step');
    assert.equal(result.turns[0].stage, 'review');
    assert.equal(sent.length, 2);
    assert.deepEqual(sent[0].input.sources, sent[1].input.sources);
    assert.equal(sent[0].input.otherAnalysis, undefined);
    await advanceCollaboration(db, w, thread.id, step, services);
    assert.equal(sent.length, 2, 'same step cannot accidentally advance to review');
    result = await advanceCollaboration(db, w, thread.id, advance(f.turn), services);
    assert.equal(result.turns[0].stage, 'synthesis');
    assert.deepEqual(
      sent[2].input.otherAnalysis,
      result.turns[0].calls.find((c) => c.stage === 'analysis' && c.provider !== sent[2].provider)!
        .result,
    );
    result = await advanceCollaboration(db, w, thread.id, advance(f.turn), services);
    assert.equal(result.turns[0].status, 'completed');
    assert.equal(sent.length, 5);
    assert.equal(sent[4].input.analyses.length, 2);
    assert.equal(sent[4].input.reviews.length, 2);
    assert.deepEqual(result.turns[0].result![0].result!.disagreements, [
      'MOCK: location today is unresolved.',
    ]);
    assert.equal(result.turns[0].usage.inputTokens, 150);
    assert.equal(result.turns[0].usage.outputTokens, 100);
    assert.equal(result.turns[0].usage.monetaryCost, null);
    assert.deepEqual(result.turns[0].completedStages, ['analysis', 'review', 'synthesis']);
    assert.ok(sent.every((s) => s.limit === 800));
    assert.equal((await getCollaboration(db, w, thread.id)).turns[0].status, 'completed');
    assert.equal((await createCollaboration(db, w, f.request, services)).id, thread.id);
    await assert.rejects(
      createCollaboration(db, w, { ...f.request, question: 'Another question?' }, services),
      /Idempotency/,
    );
    const followup = {
      ...input('parallel'),
      question: 'Was the notebook location verified today?',
    };
    const followed = await addCollaborationTurn(db, w, thread.id, followup, services);
    assert.equal(followed.turns.length, 2);
    assert.equal(followed.turns[1].history.length, 1);
    assert.equal(
      (await addCollaborationTurn(db, w, thread.id, followup, services)).turns.length,
      2,
    );
    await advanceCollaboration(db, w, thread.id, advance(followed.turns[1].id), services);
    assert.equal(sent[5].input.history[0].turnId, f.turn);
    assert.equal(
      (await db.query('SELECT id FROM memory_nodes WHERE workspace_id=$1', [w])).length,
      1,
    );
  },
  async 'parallel calls overlap, one success survives rate limit and retry only dispatches missing provider'(
    db,
  ) {
    const f = await fixture(db, 'parallel');
    let resolve!: () => void;
    const barrier = new Promise<void>((r) => {
      resolve = r;
    });
    const base = f.services.call;
    let attempts = 0;
    f.services.call = async (...args) => {
      attempts++;
      if (args[0] === 'openai') {
        await barrier;
        return base(...args);
      }
      resolve();
      throw new ProviderFailure('HTTP 429', true, false);
    };
    const result = await advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
    assert.equal(attempts, 2);
    assert.equal(result.turns[0].status, 'failed');
    assert.equal(result.turns[0].calls.filter((c) => c.status === 'completed').length, 1);
    assert.equal(result.turns[0].usage.billingUncertain, false);
    await assert.rejects(
      advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services),
      /recovery/,
    );
    f.services.call = base;
    const recovered = await advanceCollaboration(
      db,
      f.w,
      f.thread.id,
      advance(f.turn, { retry: true }),
      f.services,
    );
    assert.equal(recovered.turns[0].status, 'completed');
    assert.equal(recovered.turns[0].calls.length, 3);
    assert.equal(f.sent.filter((s) => s.provider === 'openai').length, 1);
  },
  async 'uncertain timeouts require explicit acknowledgement and cannot exceed consented call limit'(
    db,
  ) {
    const f = await fixture(db, 'parallel'),
      base = f.services.call;
    f.services.call = async (...args) =>
      args[0] === 'openai'
        ? base(...args)
        : Promise.reject(new ProviderFailure('timeout', false, true));
    let result = await advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
    assert.equal(result.turns[0].status, 'uncertain');
    assert.equal(result.turns[0].usage.billingUncertain, true);
    await assert.rejects(
      advanceCollaboration(db, f.w, f.thread.id, advance(f.turn, { retry: true }), f.services),
      /acknowledgement/,
    );
    f.services.call = base;
    result = await advanceCollaboration(
      db,
      f.w,
      f.thread.id,
      advance(f.turn, { retry: true, acknowledgePossibleDuplicateCharge: true }),
      f.services,
    );
    assert.equal(result.turns[0].status, 'completed');
    assert.equal(
      result.turns[0].usage.billingUncertain,
      true,
      'recovery does not erase unknown earlier charge',
    );
    const g = await fixture(db, 'parallel');
    await db.query(
      "UPDATE collaboration_turns SET config=jsonb_set(config,'{limits,maxCalls}','2') WHERE id=$1",
      [g.turn],
    );
    g.services.call = async () => {
      throw new ProviderFailure('rate limit', true, false);
    };
    await advanceCollaboration(db, g.w, g.thread.id, advance(g.turn), g.services);
    await assert.rejects(
      advanceCollaboration(db, g.w, g.thread.id, advance(g.turn, { retry: true }), g.services),
      /limit exhausted/,
    );
  },
  async 'cancellation retains in-flight results and billing but prevents further dispatch/publication'(
    db,
  ) {
    const f = await fixture(db),
      base = f.services.call;
    let started!: () => void, release!: () => void;
    const ready = new Promise<void>((r) => {
        started = r;
      }),
      gate = new Promise<void>((r) => {
        release = r;
      });
    f.services.call = async (...args) => {
      started();
      await gate;
      return base(...args);
    };
    const work = advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
    await ready;
    await cancelCollaboration(db, f.w, f.thread.id, f.turn);
    release();
    const result = await work;
    assert.equal(result.turns[0].status, 'cancelled');
    assert.equal(result.turns[0].result, null);
    assert.ok(result.turns[0].calls.every((c) => !c.usable));
    const count = f.sent.length;
    await advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
    assert.equal(f.sent.length, count);
  },
  async 'workspace isolation, fresh consent and tampered citations fail before dispatch'(db) {
    const f = await fixture(db),
      other = await workspace(db);
    for (const action of [
      () => getCollaboration(db, other, f.thread.id),
      () => advanceCollaboration(db, other, f.thread.id, advance(f.turn), f.services),
      () => cancelCollaboration(db, other, f.thread.id, f.turn),
      () => addCollaborationTurn(db, other, f.thread.id, input(), f.services),
    ])
      await assert.rejects(action, /not found/);
    await assert.rejects(createCollaboration(db, f.w, { ...input(), consent: false }, f.services));
    await assert.rejects(
      addCollaborationTurn(db, f.w, f.thread.id, { ...input(), consent: false }, f.services),
    );
    await db.query(
      "UPDATE collaboration_turns SET citations=jsonb_set(citations,'{0,excerpt}','\"fabricated\"') WHERE id=$1",
      [f.turn],
    );
    const result = await advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
    assert.equal(result.turns[0].status, 'failed');
    assert.equal(f.sent.length, 0);
  },
  async 'source edits during dispatch withhold publication; later reads and follow-ups revalidate evidence'(
    db,
  ) {
    const f = await fixture(db, 'parallel'),
      base = f.services.call;
    let edited = false;
    f.services.call = async (...args) => {
      if (!edited) {
        edited = true;
        const changed = note(f.item.sourceId, 'The notebook moved to a shelf.');
        await db.transaction((tx) => storeMemory(tx, f.w, changed));
      }
      return base(...args);
    };
    const result = await advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
    assert.equal(result.turns[0].status, 'failed');
    assert.equal(result.turns[0].contextCurrent, false);
    assert.equal(result.turns[0].result, null);
    const followup = await addCollaborationTurn(db, f.w, f.thread.id, input(), f.services);
    assert.equal(followup.turns[1].citations[0].version, 2);
    assert.equal(followup.turns[1].history.length, 0);
    const g = await fixture(db, 'parallel');
    await advanceCollaboration(db, g.w, g.thread.id, advance(g.turn), g.services);
    await db.query('DELETE FROM memory_nodes WHERE workspace_id=$1 AND id=$2', [g.w, g.memory.id]);
    assert.equal((await getCollaboration(db, g.w, g.thread.id)).turns[0].result, null);
    assert.equal(
      (await addCollaborationTurn(db, g.w, g.thread.id, input(), g.services)).turns[1].history
        .length,
      0,
    );
  },
  async 'invalid citations preserve raw output without publication or silent retry'(db) {
    const f = await fixture(db, 'parallel'),
      base = f.services.call;
    f.services.call = async (...args) => {
      const out = await base(...args);
      const parsed = JSON.parse(out.text);
      parsed.groundedClaims[0].citations[0].source = 900;
      return { ...out, text: JSON.stringify(parsed) };
    };
    const result = await advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
    assert.equal(result.turns[0].status, 'failed');
    assert.equal(result.turns[0].calls[0].status, 'withheld');
    assert.ok(result.turns[0].calls[0].output?.text.includes('900'));
    assert.equal(result.turns[0].calls[0].result, null);
    await assert.rejects(
      advanceCollaboration(db, f.w, f.thread.id, advance(f.turn, { retry: true }), f.services),
      /cannot be retried/,
    );
  },
  async 'expired leases never auto-replay; duplicate advances share a single durable stage'(db) {
    const f = await fixture(db),
      base = f.services.call;
    let started!: () => void, release!: () => void;
    const ready = new Promise<void>((r) => {
        started = r;
      }),
      gate = new Promise<void>((r) => {
        release = r;
      });
    f.services.call = async (...args) => {
      started();
      await gate;
      return base(...args);
    };
    const request = advance(f.turn),
      work = advanceCollaboration(db, f.w, f.thread.id, request, f.services);
    await ready;
    await advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
    assert.equal((await getCollaboration(db, f.w, f.thread.id)).turns[0].calls.length, 2);
    await db.query(
      "UPDATE collaboration_turns SET lease_until=now()-interval '1 second' WHERE id=$1",
      [f.turn],
    );
    const expired = await advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services);
    assert.equal(expired.turns[0].status, 'uncertain');
    assert.equal(expired.turns[0].calls.length, 2);
    release();
    await work;
    assert.equal(
      (await getCollaboration(db, f.w, f.thread.id)).turns[0].status,
      'uncertain',
      'late worker must not publish',
    );
  },
  async 'bounded inputs and changed models prevent transmission; disconnected calls remain uncertain'(
    db,
  ) {
    const f = await fixture(db, 'parallel');
    f.services.models = () => ({ openai: 'changed-model', anthropic: 'mock-claude' });
    await assert.rejects(
      advanceCollaboration(db, f.w, f.thread.id, advance(f.turn), f.services),
      /configuration changed/,
    );
    assert.equal(f.sent.length, 0);
    const g = await fixture(db, 'parallel');
    await db.query(
      "UPDATE collaboration_turns SET config=jsonb_set(config,'{limits,maxInputBytes}','20') WHERE id=$1",
      [g.turn],
    );
    await assert.rejects(
      advanceCollaboration(db, g.w, g.thread.id, advance(g.turn), g.services),
      /input limit/,
    );
    assert.equal((await getCollaboration(db, g.w, g.thread.id)).turns[0].calls.length, 0);
    const h = await fixture(db, 'parallel');
    h.services.call = async () => {
      throw new Error('simulated disconnect');
    };
    const result = await advanceCollaboration(db, h.w, h.thread.id, advance(h.turn), h.services);
    assert.equal(result.turns[0].status, 'uncertain');
  },
};
