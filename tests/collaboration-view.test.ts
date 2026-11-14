import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CollaborationError,
  createCollaborationClient,
} from './fixtures/legacy-collaboration-client';
import {
  ContractError,
  MODE_INFO,
  activity,
  callBound,
  controls,
  messagesOf,
  readCollaboration,
  readList,
  reportedTokens,
  resultView,
  statusView,
  workflow,
} from '../lib/collaboration-view';
import type { CollaborationStatus, WireCollaboration } from '../lib/collaboration-ui-types';
import type { Citation } from '../lib/types';
import { createMockBackend } from './fixtures/collaboration-mock';

// MOCK CONTRACT tests: the backend here is tests/fixtures/collaboration-mock.ts, not Phase 4A.
const source = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Access code storage',
  excerpt: 'The access codes are kept in a sealed envelope inside the desk.',
  source: 'note',
  region: 'frontal',
  rank: 1,
  version: 1,
} as Citation;
async function run(mode: 'parallel' | 'deliberate', options = {}) {
  const backend = createMockBackend({ citations: [source], ...options });
  const client = createCollaborationClient(backend.transport);
  let c = readCollaboration(
    await client.create({
      task: 'Where are the codes?',
      mode,
      consent: true,
      models: { openai: 'mock-openai-model', anthropic: 'mock-anthropic-model' },
    }),
  );
  const seen: CollaborationStatus[] = [c.status];
  for (let i = 0; i < 8 && (c.status === 'queued' || c.status === 'running'); i++) {
    c = readCollaboration(await client.advance(c.id, { action: 'continue' }));
    seen.push(c.status);
  }
  return { backend, client, c, seen };
}

test('MOCK CONTRACT: a parallel run advances one saved stage per request and stays within its bound', async () => {
  const { backend, c, seen } = await run('parallel');
  assert.deepEqual(seen, ['queued', 'running', 'running', 'completed']);
  assert.equal(c.limits.usedProviderCalls, 3);
  assert.equal(c.limits.maxProviderCalls, 3);
  assert.equal(backend.calls.filter((call) => call.path.endsWith('/advance')).length, 3);
  const turn = c.turns[0];
  assert.deepEqual(
    workflow(turn).map((s) => [s.lane, s.label]),
    [
      ['shared', 'Context prepared'],
      ['openai', 'GPT analysed'],
      ['anthropic', 'Claude analysed'],
      ['shared', 'Synthesis written · GPT'],
    ],
  );
  assert.equal(activity(c, false), 'Completed');
});
test('MOCK CONTRACT: a deliberate run pauses for continuation and attributes each cross-review', async () => {
  const { client, c: paused, seen } = await run('deliberate', { pauseBeforeReview: true });
  assert.equal(seen.at(-1), 'awaiting_continuation');
  assert.deepEqual(controls(paused, false), {
    drive: false,
    cancel: true,
    resume: false,
    continueStage: true,
    retry: false,
    acknowledge: false,
    followUp: false,
  });
  let c = readCollaboration(await client.advance(paused.id, { action: 'continue' }));
  c = readCollaboration(await client.advance(c.id, { action: 'continue' }));
  assert.equal(c.status, 'completed');
  assert.equal(c.limits.usedProviderCalls, 5);
  const turn = c.turns[0];
  assert.deepEqual(
    messagesOf(turn, 'anthropic').map((m) => m.heading),
    ['Independent analysis by Claude', 'Claude reviewing GPT'],
  );
  assert.deepEqual(
    workflow(turn)
      .filter((s) => s.stage === 'cross_review')
      .map((s) => s.label),
    ['GPT reviewed Claude', 'Claude reviewed GPT'],
  );
  // Usage is reported only where the provider supplied it.
  assert.equal(messagesOf(turn, 'anthropic')[0].tokens, null);
  assert.equal(messagesOf(turn, 'openai')[0].tokens, 130);
  assert.equal(reportedTokens(turn), 130 * 4);
});
test('MOCK CONTRACT: the combined result keeps disagreements and unverified points separate', async () => {
  const { c } = await run('parallel');
  const result = resultView(c.turns[0])!;
  assert.equal(result.jointConclusions.length, 1);
  assert.equal(result.jointConclusions[0].sources[0].citation.id, source.id);
  assert.deepEqual(
    result.disagreements[0].positions.map((p) => p.provider),
    ['openai', 'anthropic'],
  );
  assert.equal(result.openQuestions.length, 1);
  assert.equal(result.unverified.length, 1);
  assert.equal(result.unsettled, true);
  // A citation number with no matching source is dropped, never invented.
  c.turns[0].result!.jointConclusions[0].citations = [1, 7];
  assert.deepEqual(
    resultView(c.turns[0])!.jointConclusions[0].sources.map((s) => s.number),
    [1],
  );
  assert.equal(resultView({ ...c.turns[0], result: null }), null);
});
test('MOCK CONTRACT: an uncertain billing outcome is never retried without acknowledgement', async () => {
  const backend = createMockBackend({ citations: [source] });
  const client = createCollaborationClient(backend.transport);
  let c = readCollaboration(
    await client.create({
      task: 'Task',
      mode: 'parallel',
      consent: true,
      models: { openai: 'mock-openai-model', anthropic: 'mock-anthropic-model' },
    }),
  );
  c = readCollaboration(await client.advance(c.id, { action: 'continue' }));
  backend.failNextStage('uncertain');
  c = readCollaboration(await client.advance(c.id, { action: 'continue' }));
  assert.equal(c.status, 'needs_review');
  assert.equal(statusView(c.status).tone, 'caution');
  const can = controls(c, true);
  assert.equal(can.drive, false);
  assert.equal(can.acknowledge, true);
  assert.equal(workflow(c.turns[0]).find((s) => s.status === 'uncertain')?.label, 'GPT analysis');
  await assert.rejects(
    client.advance(c.id, { action: 'retry' }),
    (error: CollaborationError) => error.kind === 'rejected' && error.status === 409,
  );
  c = readCollaboration(await client.advance(c.id, { action: 'retry', acknowledgeCharge: true }));
  assert.equal(c.status, 'running');
});
test('MOCK CONTRACT: cancel, follow-up turns and history', async () => {
  const { backend, client, c } = await run('parallel');
  assert.equal(controls(c, false).followUp, true);
  let next = readCollaboration(
    await client.addTurn(c.id, { prompt: 'And who reviews?', consent: true }),
  );
  assert.equal(next.turns.length, 2);
  assert.equal(next.status, 'queued');
  assert.equal(controls(next, false).resume, true);
  assert.match(activity(next, false), /not advancing/);
  next = readCollaboration(await client.cancel(c.id));
  assert.equal(next.status, 'cancelled');
  assert.equal(controls(next, false).cancel, false);
  const list = readList(await client.list());
  assert.equal(list.collaborations.length, 1);
  assert.equal(list.collaborations[0].turnCount, 2);
  assert.deepEqual(callBound('deliberate', list.modes), { calls: 8, source: 'requested' });
  assert.deepEqual(callBound('deliberate'), {
    calls: 8,
    source: 'requested',
  });
  assert.equal(backend.store.size, 1);
});
test('the client names each failure honestly and never retries on its own', async () => {
  const reply = (status: number, body: unknown) => async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  const kind = async (transport: () => Promise<Response>) =>
    createCollaborationClient(transport)
      .list()
      .then(
        () => 'ok',
        (error: CollaborationError) => error.kind,
      );
  assert.equal(await kind(reply(404, { error: 'Endpoint not found.' })), 'unavailable');
  assert.equal(await kind(reply(404, { error: 'Collaboration not found.' })), 'rejected');
  assert.equal(
    await kind(reply(401, { error: 'Sign in to open your memory workspace.' })),
    'signed-out',
  );
  assert.equal(await kind(reply(409, { error: 'Not now.' })), 'rejected');
  assert.equal(await kind(reply(500, { error: 'The operation failed.' })), 'server');
  assert.equal(await kind(reply(200, 'not json')), 'server');
  let attempts = 0;
  assert.equal(
    await kind(async () => {
      attempts++;
      throw new TypeError('Failed to fetch');
    }),
    'offline',
  );
  assert.equal(attempts, 1);
});
test('the adapter refuses responses it does not understand instead of guessing', async () => {
  const { c } = await run('parallel');
  const copy = () => JSON.parse(JSON.stringify(c)) as Record<string, unknown> & WireCollaboration;
  const broken = [
    (x: ReturnType<typeof copy>) => ((x as Record<string, unknown>).status = 'thinking'),
    (x: ReturnType<typeof copy>) => delete (x as Record<string, unknown>).turns,
    (x: ReturnType<typeof copy>) =>
      ((x.turns[0].steps[0] as Record<string, unknown>).stage = 'debate'),
    (x: ReturnType<typeof copy>) =>
      ((x.turns[0].messages[0] as Record<string, unknown>).provider = 'gemini'),
    (x: ReturnType<typeof copy>) =>
      ((x.turns[0] as Record<string, unknown>).result = { jointConclusions: 'yes' }),
  ];
  for (const breakIt of broken) {
    const x = copy();
    breakIt(x);
    assert.throws(() => readCollaboration(x), ContractError);
  }
  assert.throws(() => readCollaboration(null), ContractError);
  assert.throws(() => readList({ items: [] }), ContractError);
  assert.equal(readCollaboration(copy()).id, c.id);
});
test('labels follow saved step status: running reads as in progress, pending never does', () => {
  const base = { id: 's', model: 'm' };
  const turn = {
    id: 't',
    index: 0,
    prompt: 'p',
    status: 'running',
    createdAt: 'x',
    updatedAt: 'x',
    messages: [],
    citations: [],
    steps: [
      { ...base, id: 'a', stage: 'preparing_context', provider: null, status: 'succeeded' },
      { ...base, id: 'b', stage: 'analysis', provider: 'openai', status: 'running' },
      { ...base, id: 'c', stage: 'analysis', provider: 'anthropic', status: 'pending' },
      { ...base, id: 'd', stage: 'synthesis', provider: 'openai', status: 'pending' },
    ],
  } as never;
  assert.deepEqual(
    workflow(turn).map((s) => s.label),
    ['Context prepared', 'GPT analysing', 'Claude analysis', 'Synthesis · GPT'],
  );
  const c = { status: 'running', turns: [turn] } as never;
  assert.equal(activity(c, true), 'GPT analysing');
});
