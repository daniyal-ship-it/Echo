import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/[...path]/route';
import { createDatabase } from '../lib/db';
import { createSession, SESSION_COOKIE } from '../lib/security';
import { workspace, note, input, advance } from './fixtures/collaboration-suite';
import { storeMemory } from '../lib/memories';
import { createCollaborationClient } from '../lib/collaboration-client';
import { adaptCollaboration } from '../lib/collaboration-adapter';
import { COLLABORATION_VERSION } from '../lib/collaboration-types';

test('authenticated API and actual adapters with mock HTTP: consent, peer review, history, origin and workspace isolation', async (t) => {
  const db = await createDatabase('memory://');
  const global = globalThis as unknown as { echoDatabase?: Promise<typeof db> };
  const previousDb = global.echoDatabase;
  global.echoDatabase = Promise.resolve(db);
  const keys = [
    'ECHO_OPENAI_API_KEY',
    'ECHO_ANTHROPIC_API_KEY',
    'ECHO_OPENAI_MODEL',
    'ECHO_ANTHROPIC_MODEL',
    'APP_ORIGIN',
  ] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.ECHO_OPENAI_API_KEY = process.env.ECHO_ANTHROPIC_API_KEY = 'mock-api-key-no-network';
  process.env.ECHO_OPENAI_MODEL = 'mock-gpt';
  process.env.ECHO_ANTHROPIC_MODEL = 'mock-claude';
  process.env.APP_ORIGIN = 'http://127.0.0.1';
  const requests: any[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.ok(
      url.startsWith('https://api.openai.com/') || url.startsWith('https://api.anthropic.com/'),
    );
    if (!options.body) return Response.json({ id: url.split('/').at(-1) });
    const body = JSON.parse(String(options.body));
    const context = JSON.parse(body.input || body.messages[0].content);
    requests.push(context);
    const text = JSON.stringify({
      groundedClaims: context.sources.length
        ? [
            {
              text: 'MOCK supported excerpt',
              citations: [{ source: 1, quote: context.sources[0].excerpt }],
            },
          ]
        : [],
      interpretations: [],
      agreements: [],
      disagreements: ['MOCK unresolved point'],
      uncertainty: ['Source may be outdated.'],
    });
    return Response.json(
      url.includes('openai')
        ? {
            model: 'mock-gpt',
            output: [{ content: [{ type: 'output_text', text }] }],
            usage: { input_tokens: 10, output_tokens: 20 },
          }
        : {
            model: 'mock-claude',
            content: [{ type: 'text', text }],
            usage: { input_tokens: 11, output_tokens: 21 },
          },
    );
  });
  const request = async (
    path: string,
    token?: string,
    value?: unknown,
    origin = 'http://127.0.0.1',
  ) => {
    const headers: Record<string, string> = { origin, 'content-type': 'application/json' };
    if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
    const req = new NextRequest(`http://127.0.0.1/api/${path}`, {
      method: value === undefined ? 'GET' : 'POST',
      headers,
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    });
    return (value === undefined ? GET : POST)(req, {
      params: Promise.resolve({ path: path.split('/') }),
    });
  };
  try {
    const w = await workspace(db),
      other = await workspace(db);
    const [owner] = await db.query<{ owner_id: string }>(
      'SELECT owner_id FROM workspaces WHERE id=$1',
      [w],
    );
    const [stranger] = await db.query<{ owner_id: string }>(
      'SELECT owner_id FROM workspaces WHERE id=$1',
      [other],
    );
    const session = await createSession(db, owner.owner_id),
      otherSession = await createSession(db, stranger.owner_id);
    await db.transaction((tx) => storeMemory(tx, w, note()));
    assert.equal((await request('collaborations')).status, 401);
    assert.equal(
      (await request('collaborations', session, input(), 'https://attacker.invalid')).status,
      403,
    );
    assert.equal(
      (await request('collaborations', session, { ...input(), consent: false })).status,
      400,
    );
    const created = await request('collaborations', session, input());
    assert.equal(created.status, 201);
    const thread = await created.json(),
      id = thread.id,
      turnId = thread.turns[0].id;
    assert.equal(requests.length, 0, 'creation must not send sources');
    for (const [path, value] of [
      [`collaborations/${id}`, undefined],
      [`collaborations/${id}/advance`, advance(turnId)],
      [`collaborations/${id}/cancel`, { version: COLLABORATION_VERSION, turnId }],
      [`collaborations/${id}/turns`, input()],
    ] as const)
      assert.equal((await request(path, otherSession, value)).status, 404);
    for (let i = 0; i < 3; i++)
      assert.equal(
        (await request(`collaborations/${id}/advance`, session, advance(turnId))).status,
        200,
      );
    const result = await (await request(`collaborations/${id}`, session)).json();
    assert.equal(result.turns[0].status, 'completed');
    assert.equal(requests.length, 5);
    assert.ok(requests[2].otherAnalysis);
    assert.equal(requests[4].reviews.length, 2);
    assert.equal(result.turns[0].usage.inputTokens, 52);
    const threads = await (await request('collaborations', session)).json();
    assert.equal(threads.threads.length, 1);
    assert.equal((await (await request('collaborations', otherSession)).json()).threads.length, 0);
    const followed = await (
      await request(`collaborations/${id}/turns`, session, input('parallel'))
    ).json();
    assert.equal(followed.turns[1].history.length, 1);
    const cancelled = await request(`collaborations/${id}/cancel`, session, {
      version: COLLABORATION_VERSION,
      turnId: followed.turns[1].id,
    });
    assert.equal((await cancelled.json()).turns[1].status, 'cancelled');
    assert.equal(requests.length, 5);
    assert.ok(!JSON.stringify(result).includes('mock-api-key'));
    const client = createCollaborationClient((path, init) =>
      request(
        path.replace('/api/', ''),
        session,
        init?.body ? JSON.parse(String(init.body)) : undefined,
      ),
    );
    const native = await client.create({
      task: 'Where is the notebook?',
      mode: 'deliberate',
      consent: true,
      models: { openai: 'mock-gpt', anthropic: 'mock-claude' },
    });
    assert.equal(native.status, 'queued');
    let ui = await client.advance(native.id, { action: 'continue' });
    assert.equal(ui.status, 'awaiting_continuation');
    assert.equal(ui.turns[0].messages.length, 2);
    ui = await client.advance(native.id, { action: 'continue' });
    assert.equal(ui.turns[0].messages.filter((m) => m.stage === 'cross_review').length, 2);
    ui = await client.advance(native.id, { action: 'continue' });
    assert.equal(ui.status, 'completed');
    assert.equal(ui.turns[0].result!.jointConclusions.length, 1);
    assert.equal((await client.get(native.id)).turns[0].messages.length, 5);
    assert.equal((await client.list()).collaborations[0].id, native.id);
    const next = await client.addTurn(native.id, {
      prompt: 'Is the notebook still there?',
      consent: true,
    });
    assert.equal(next.turns.length, 2);
    assert.equal((await client.cancel(native.id)).status, 'cancelled');
    const scoped = await client.create({
      task: 'notebook',
      mode: 'parallel',
      consent: true,
      models: { openai: 'mock-gpt', anthropic: 'mock-claude' },
      filters: { region: 'occipital' },
    });
    assert.equal(scoped.turns[0].citations.length, 0, 'scope must constrain retrieved sources');
    const invalid = structuredClone(result);
    invalid.turns[0].calls[0].result.groundedClaims[0].citations[0].source = 999;
    assert.throws(() => adaptCollaboration(invalid), /Invalid collaboration evidence/);
    const stale = structuredClone(result);
    stale.turns[0].contextCurrent = false;
    assert.equal(adaptCollaboration(stale).turns[0].messages.length, 0);
    assert.equal(adaptCollaboration(stale).turns[0].result, null);
    let hold = false,
      ready!: () => void,
      release!: () => void;
    const waiting = new Promise<void>((r) => {
        ready = r;
      }),
      gate = new Promise<void>((r) => {
        release = r;
      });
    const delayed = createCollaborationClient(async (path, init) => {
      const response = await request(
        path.replace('/api/', ''),
        session,
        init?.body ? JSON.parse(String(init.body)) : undefined,
      );
      if (hold && !init?.method) {
        ready();
        await gate;
      }
      return response;
    });
    const pendingThread = await delayed.create({
      task: 'notebook slow read',
      mode: 'parallel',
      consent: true,
      models: { openai: 'mock-gpt', anthropic: 'mock-claude' },
    });
    hold = true;
    const pendingRead = delayed.get(pendingThread.id);
    await waiting;
    assert.equal((await delayed.cancel(pendingThread.id)).status, 'cancelled');
    release();
    assert.equal(
      (await pendingRead).status,
      'cancelled',
      'late GET must retain the newer cancellation',
    );
  } finally {
    for (const key of keys)
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    global.echoDatabase = previousDb;
    await db.close();
  }
});
