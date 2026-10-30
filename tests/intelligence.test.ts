import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createDatabase, type Database } from '../lib/db';
import { storeMemory, memoryDetail } from '../lib/memories';
import {
  enqueueIntelligence,
  runIntelligenceStep,
  controlIntelligence,
  getIntelligenceJob,
  intelligenceStatus,
  type IntelligenceServices,
} from '../lib/intelligence';
import { chunkSource, getPassage, validateAnalysis, validateAnswerCitations } from '../lib/chunks';
import { hybridRetrieve, assertCitationAccess } from '../lib/retrieval';
import { ProviderFailure, embedTexts } from '../lib/providers';
import {
  CHUNKER_VERSION,
  PROMPT_VERSION,
  type IntelligenceConfig,
} from '../lib/intelligence-types';
import { uuid } from '../lib/security';
import type { ImportItem } from '../lib/types';
let db: Database;
before(async () => {
  db = await createDatabase('memory://');
});
after(async () => {
  await db?.close();
});
async function workspace(database: Database = db) {
  const id = uuid(),
    owner = uuid();
  await database.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
    owner,
    `${id}@example.test`,
    'Intelligence fixture',
    'unused',
  ]);
  await database.query('INSERT INTO workspaces(id,owner_id,name) VALUES($1,$2,$3)', [
    id,
    owner,
    'Isolated mocked intelligence',
  ]);
  return id;
}
const source = (
  id: string,
  content = 'Keep the access codes in a sealed envelope inside the desk.',
): ImportItem => ({
  source: 'note',
  sourceId: id,
  title: id,
  content,
  raw: { text: content },
  messages: [],
  sourceAt: null,
  kind: 'note',
  region: 'frontal',
  tags: [],
});
const vector = (index = 0) => Array.from({ length: 1536 }, (_, i) => (i === index ? 1 : 0));
function mocks() {
  const calls = { config: 0, embed: 0, analyse: 0 };
  const config: IntelligenceConfig = {
    embeddingModel: 'text-embedding-3-small',
    dimensions: 1536,
    summaryProvider: 'openai',
    summaryModel: 'mock-analysis-model',
    promptVersion: PROMPT_VERSION,
    chunkerVersion: CHUNKER_VERSION,
  };
  const services: IntelligenceServices = {
    async config(provider) {
      calls.config++;
      return { ...config, summaryProvider: provider };
    },
    async embed(texts, model) {
      calls.embed++;
      return {
        vectors: texts.map(() => vector()),
        model,
        dimensions: 1536,
        apiVersion: 'MOCK ONLY',
        tokens: 20,
      };
    },
    async analyse(chunks) {
      calls.analyse++;
      return {
        text: JSON.stringify({
          summary: [
            {
              text: 'MOCK: the codes were stored in the desk.',
              citations: [{ chunkId: chunks[0].id, quote: chunks[0].content.slice(0, 80) }],
            },
          ],
          insights: [],
        }),
        tokens: 40,
      };
    },
  };
  return { services, calls };
}
async function finish(w: string, id: string, services: IntelligenceServices) {
  for (let i = 0; i < 30; i++) {
    const job = await runIntelligenceStep(db, w, id, services);
    if (job.status === 'completed') return job;
    assert.ok(['queued', 'running'].includes(job.status), job.error || job.status);
  }
  throw new Error('Fixture did not finish');
}

test('chunks preserve message boundaries, branch flags, timestamps and exact Unicode offsets', () => {
  const w = uuid(),
    m = uuid();
  const messages = [
    {
      id: 'one',
      role: 'user',
      content: 'A unicode 🌌 message. '.repeat(160),
      timestamp: '2026-10-20T10:15:00Z',
      parent: null,
      active: true,
    },
    {
      id: 'branch',
      role: 'assistant',
      content: 'An alternative, preserved original branch.',
      timestamp: null,
      parent: 'one',
      active: false,
    },
  ];
  const a = chunkSource(w, m, 1, 'unused', messages, null),
    b = chunkSource(w, m, 1, 'unused', messages, null);
  assert.deepEqual(a, b);
  assert.ok(a.length > 2);
  for (const c of a) {
    assert.equal(c.content, messages[c.message_index!].content.slice(c.start_offset, c.end_offset));
    assert.equal(c.source_timestamp, messages[c.message_index!].timestamp);
    assert.equal(c.message_id, messages[c.message_index!].id);
  }
  assert.equal(a.at(-1)?.active, false);
  assert.equal(
    a
      .filter((c) => c.message_id === 'one')
      .map((c) => c.content)
      .join(''),
    messages[0].content,
  );
  assert.notEqual(a[0].id, chunkSource(w, m, 2, 'unused', messages, null)[0].id);
});
test('mocked full durable pipeline preserves originals, reuses successful work and retrieves a paraphrase', async () => {
  const w = await workspace(),
    { services, calls } = mocks(),
    item = source('Security note');
  const saved = await db.transaction((tx) => storeMemory(tx, w, item));
  const job = await enqueueIntelligence(db, w, saved.id, 'openai', services);
  assert.equal((await enqueueIntelligence(db, w, saved.id, 'openai', services)).id, job.id);
  await finish(w, job.id, services);
  const detail = await memoryDetail(db, w, saved.id);
  assert.equal(detail.content, item.content);
  assert.deepEqual(detail.raw, item.raw);
  const status = await intelligenceStatus(db, w, saved.id);
  assert.equal(status.analyses.length, 1);
  assert.equal(status.analyses[0].model, 'mock-analysis-model');
  assert.equal(calls.embed, 1);
  assert.equal(calls.analyse, 1);
  await runIntelligenceStep(db, w, job.id, services);
  await enqueueIntelligence(db, w, saved.id, 'openai', services);
  assert.equal(calls.embed, 1);
  assert.equal(calls.analyse, 1);
  const question = 'Where were the credentials secured?';
  const keyword = await hybridRetrieve(db, w, question);
  assert.equal(keyword.citations.length, 0);
  const hybrid = await hybridRetrieve(db, w, question, new URLSearchParams(), true, services.embed);
  assert.equal(hybrid.mode, 'hybrid-retrieval');
  assert.equal(hybrid.citations[0].id, saved.id);
  assert.equal(hybrid.citations[0].version, 1);
  const passage = await getPassage(db, w, saved.id, hybrid.citations[0].chunkId!);
  assert.equal(passage.content, item.content);
  assert.equal(calls.embed, 2);
  await hybridRetrieve(db, w, question, new URLSearchParams(), true, services.embed);
  assert.equal(calls.embed, 2, 'query embedding reused');
  const filtered = await hybridRetrieve(
    db,
    w,
    question,
    new URLSearchParams({ source: 'claude' }),
    true,
    services.embed,
  );
  assert.equal(filtered.citations.length, 0);
  assert.equal(calls.embed, 2, 'empty scope causes no provider egress');
});
test('workspace isolation is enforced before model checks, source transmission, job controls and citations', async () => {
  const w = await workspace(),
    other = await workspace(),
    { services, calls } = mocks();
  const saved = await db.transaction((tx) => storeMemory(tx, w, source('private')));
  await assert.rejects(
    enqueueIntelligence(db, other, saved.id, 'openai', services),
    /Memory not found/,
  );
  assert.equal(calls.config, 0);
  const job = await enqueueIntelligence(db, w, saved.id, 'openai', services);
  await assert.rejects(runIntelligenceStep(db, other, job.id, services), /not found/);
  await assert.rejects(controlIntelligence(db, other, job.id, 'cancel'), /not found/);
  await finish(w, job.id, services);
  const found = await hybridRetrieve(db, w, 'access codes');
  await assert.rejects(assertCitationAccess(db, other, found.citations), /no longer available/);
  await assert.rejects(getPassage(db, other, saved.id, found.citations[0].chunkId!), /not found/);
  const before = calls.embed;
  assert.equal(
    (await hybridRetrieve(db, other, 'access codes', new URLSearchParams(), true, services.embed))
      .citations.length,
    0,
  );
  assert.equal(calls.embed, before);
});
test('a successful saved provider response survives interruption without another charge', async () => {
  const w = await workspace(),
    { services, calls } = mocks();
  const saved = await db.transaction((tx) => storeMemory(tx, w, source('interrupted')));
  const job = await enqueueIntelligence(db, w, saved.id, 'openai', services);
  await runIntelligenceStep(db, w, job.id, services);
  assert.equal(calls.embed, 1);
  // Simulate crash after durable response write but before derived index application.
  await db.query('DELETE FROM chunk_embeddings WHERE workspace_id=$1', [w]);
  await db.query('DELETE FROM embedding_cache WHERE workspace_id=$1', [w]);
  await db.query(
    "UPDATE intelligence_jobs SET status='running',lease_token=$2,lease_until=now()-interval '1 second' WHERE id=$1",
    [job.id, uuid()],
  );
  await runIntelligenceStep(db, w, job.id, services);
  assert.equal(calls.embed, 1, 'journal replay avoids another provider request');
  await finish(w, job.id, services);
  assert.equal(calls.analyse, 1);
});
test('unknown outcomes pause for explicit cost acknowledgement; cancellation prevents further calls', async () => {
  const w = await workspace(),
    { services, calls } = mocks();
  const saved = await db.transaction((tx) => storeMemory(tx, w, source('uncertain')));
  const job = await enqueueIntelligence(db, w, saved.id, 'openai', services);
  const failing = {
    ...services,
    embed: async () => {
      calls.embed++;
      throw new ProviderFailure('Connection interrupted', false, true);
    },
  };
  assert.equal((await runIntelligenceStep(db, w, job.id, failing)).status, 'uncertain');
  await runIntelligenceStep(db, w, job.id, services);
  assert.equal(calls.embed, 1);
  await assert.rejects(controlIntelligence(db, w, job.id, 'retry'), /acknowledge/);
  await controlIntelligence(db, w, job.id, 'retry', true);
  await finish(w, job.id, services);
  assert.equal(calls.embed, 2);
  const other = await db.transaction((tx) => storeMemory(tx, w, source('cancelled')));
  const cancel = await enqueueIntelligence(db, w, other.id, 'openai', services);
  await controlIntelligence(db, w, cancel.id, 'cancel');
  await runIntelligenceStep(db, w, cancel.id, services);
  assert.equal(calls.embed, 2);
  await controlIntelligence(db, w, cancel.id, 'resume');
  await finish(w, cancel.id, services);
  assert.equal(calls.embed, 3);
});
test('source edits remove obsolete index entries, reuse unchanged chunks, retain historical evidence and respect dismissed edges', async () => {
  const w = await workspace(),
    { services, calls } = mocks();
  const a = await db.transaction((tx) => storeMemory(tx, w, source('A'))),
    b = await db.transaction((tx) =>
      storeMemory(tx, w, source('B', 'The access codes were secured inside the writing desk.')),
    );
  for (const m of [a, b]) {
    const job = await enqueueIntelligence(db, w, m.id, 'openai', services);
    await finish(w, job.id, services);
  }
  const [edge] = await db.query<{
    id: string;
    status: string;
    method: string;
    semantic_evidence: unknown;
  }>('SELECT * FROM memory_edges WHERE workspace_id=$1', [w]);
  assert.equal(edge.status, 'candidate');
  assert.equal(edge.method, 'semantic');
  assert.ok(edge.semantic_evidence);
  await db.query("UPDATE memory_edges SET status='dismissed' WHERE id=$1", [edge.id]);
  const old = await hybridRetrieve(db, w, 'codes');
  const oldA = old.citations.find((c) => c.id === a.id)!;
  const edited = source('A');
  edited.raw = { text: edited.content, metadata: 'changed, text retained' };
  await db.transaction((tx) => storeMemory(tx, w, edited));
  assert.equal(
    (
      await db.query(
        'SELECT i.* FROM chunk_embeddings i JOIN memory_chunks c ON c.id=i.chunk_id WHERE c.memory_id=$1',
        [a.id],
      )
    ).length,
    0,
  );
  const before = calls.embed;
  const next = await enqueueIntelligence(db, w, a.id, 'openai', services);
  await finish(w, next.id, services);
  assert.equal(calls.embed, before, 'unchanged text cache avoids repeat charge');
  assert.equal((await getPassage(db, w, a.id, oldA.chunkId!)).source_version, 1);
  assert.equal(
    (
      await db.query<{ status: string }>('SELECT status FROM memory_edges WHERE id=$1', [edge.id])
    )[0].status,
    'dismissed',
  );
  const now = await hybridRetrieve(db, w, 'codes');
  assert.equal(now.citations.find((c) => c.id === a.id)?.version, 2);
  await db.query('DELETE FROM memory_nodes WHERE workspace_id=$1 AND id=$2', [w, a.id]);
  for (const table of ['memory_chunks', 'embedding_cache', 'intelligence_jobs', 'memory_analyses'])
    assert.equal(
      (await db.query(`SELECT * FROM ${table} WHERE workspace_id=$1 AND memory_id=$2`, [w, a.id]))
        .length,
      0,
      table,
    );
  assert.equal(
    (await hybridRetrieve(db, w, 'codes')).citations.some((c) => c.id === a.id),
    false,
  );
});
test('invalid summary quotes and invalid answer references are rejected', async () => {
  const w = await workspace(),
    { services } = mocks();
  const saved = await db.transaction((tx) => storeMemory(tx, w, source('invalid')));
  const job = await enqueueIntelligence(db, w, saved.id, 'openai', services);
  await runIntelligenceStep(db, w, job.id, services);
  const bad = {
    ...services,
    analyse: async (chunks: Parameters<IntelligenceServices['analyse']>[0]) => ({
      text: JSON.stringify({
        summary: [
          {
            text: 'Invented deadline',
            citations: [{ chunkId: chunks[0].id, quote: 'Invented quote not in source.' }],
          },
        ],
        insights: [],
      }),
      tokens: 20,
    }),
  };
  assert.equal((await runIntelligenceStep(db, w, job.id, bad)).status, 'failed');
  assert.equal((await intelligenceStatus(db, w, saved.id)).analyses.length, 0);
  assert.throws(() => validateAnswerCitations('The source says yes [9].', 1), /invalid/);
  assert.throws(
    () => validateAnswerCitations('Unsupported answer without citation.', 1),
    /missing/,
  );
  assert.equal(
    validateAnswerCitations('Insufficient evidence to answer this question.', 1),
    'Insufficient evidence to answer this question.',
  );
  assert.throws(() => validateAnalysis({ summary: [], insights: [] }, []), /schema/);
});
test('real embedding adapter uses official API, dimensions and validates malformed vectors (mock transport)', async (t) => {
  const key = process.env.ECHO_OPENAI_API_KEY;
  process.env.ECHO_OPENAI_API_KEY = 'fixture-not-real';
  try {
    t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
      assert.equal(url, 'https://api.openai.com/v1/embeddings');
      const body = JSON.parse(String(init.body));
      assert.equal(body.dimensions, 1536);
      assert.equal(body.model, 'text-embedding-3-small');
      return Response.json({
        model: body.model,
        data: [{ index: 0, embedding: vector() }],
        usage: { total_tokens: 12 },
      });
    });
    const response = await embedTexts(['A tiny test passage.'], 'text-embedding-3-small', uuid());
    assert.equal(response.vectors[0].length, 1536);
    assert.equal(response.tokens, 12);
    t.mock.restoreAll();
    t.mock.method(globalThis, 'fetch', async () =>
      Response.json({ data: [{ index: 0, embedding: [1, 2] }] }),
    );
    await assert.rejects(embedTexts(['Test'], 'text-embedding-3-small', uuid()), /invalid vectors/);
  } finally {
    if (key === undefined) delete process.env.ECHO_OPENAI_API_KEY;
    else process.env.ECHO_OPENAI_API_KEY = key;
  }
});

test('concurrent dispatch claims only one lease and in-flight source deletion cannot publish results', async () => {
  const w = await workspace(),
    { services, calls } = mocks(),
    saved = await db.transaction((tx) => storeMemory(tx, w, source('concurrent')));
  const job = await enqueueIntelligence(db, w, saved.id, 'openai', services);
  let started!: () => void, release!: () => void;
  const began = new Promise<void>((r) => {
      started = r;
    }),
    wait = new Promise<void>((r) => {
      release = r;
    });
  const slow = {
    ...services,
    embed: async (...args: Parameters<IntelligenceServices['embed']>) => {
      started();
      await wait;
      return services.embed(...args);
    },
  };
  const first = runIntelligenceStep(db, w, job.id, slow);
  await began;
  const second = await runIntelligenceStep(db, w, job.id, slow);
  assert.equal(second.status, 'running');
  await db.query('DELETE FROM memory_nodes WHERE workspace_id=$1 AND id=$2', [w, saved.id]);
  release();
  await assert.rejects(first, /not found/);
  assert.equal(calls.embed, 1);
  assert.equal(
    (await db.query('SELECT * FROM memory_analyses WHERE workspace_id=$1', [w])).length,
    0,
  );
  assert.equal(
    (await db.query('SELECT * FROM intelligence_operations WHERE workspace_id=$1', [w])).length,
    0,
  );
});
test('rate-limited steps back off durably and retry without repeating completed operations', async () => {
  const w = await workspace(),
    { services, calls } = mocks(),
    saved = await db.transaction((tx) => storeMemory(tx, w, source('retry')));
  const job = await enqueueIntelligence(db, w, saved.id, 'openai', services);
  const limited = {
    ...services,
    embed: async () => {
      calls.embed++;
      throw new ProviderFailure('Mock rate limit', true, false);
    },
  };
  const failed = await runIntelligenceStep(db, w, job.id, limited);
  assert.equal(failed.status, 'retry_wait');
  assert.ok(failed.next_attempt_at);
  await runIntelligenceStep(db, w, job.id, services);
  assert.equal(calls.embed, 1);
  await db.query(
    "UPDATE intelligence_jobs SET next_attempt_at=now()-interval '1 second' WHERE id=$1",
    [job.id],
  );
  await finish(w, job.id, services);
  assert.equal(calls.embed, 2);
  assert.equal(calls.analyse, 1);
});
test('expired sent operations require review instead of automatic duplicate provider calls', async () => {
  const w = await workspace(),
    { services, calls } = mocks(),
    saved = await db.transaction((tx) => storeMemory(tx, w, source('lost-response')));
  const job = await enqueueIntelligence(db, w, saved.id, 'openai', services);
  await db.query(
    "INSERT INTO intelligence_operations(id,workspace_id,job_id,step,attempt,status,reserved_tokens) VALUES($1,$2,$3,'interrupted-test',1,'sent',2000)",
    [uuid(), w, job.id],
  );
  await db.query(
    "UPDATE intelligence_jobs SET status='running',lease_until=now()-interval '1 second' WHERE id=$1",
    [job.id],
  );
  assert.equal((await runIntelligenceStep(db, w, job.id, services)).status, 'uncertain');
  assert.equal(calls.embed, 0);
});

test('saved intelligence work and exact passages survive database close/reopen without repeated embedding calls', async () => {
  const directory = await mkdtemp('/tmp/echo-intelligence-reopen-');
  let persistent: Database | undefined;
  const { services, calls } = mocks();
  try {
    persistent = await createDatabase(directory);
    const w = await workspace(persistent);
    const saved = await persistent.transaction((tx) =>
      storeMemory(tx, w, source('restart fixture')),
    );
    const job = await enqueueIntelligence(persistent, w, saved.id, 'openai', services);
    await runIntelligenceStep(persistent, w, job.id, services);
    assert.equal(calls.embed, 1);
    await persistent.close();
    persistent = await createDatabase(directory);
    await runIntelligenceStep(persistent, w, job.id, services);
    assert.equal((await runIntelligenceStep(persistent, w, job.id, services)).status, 'completed');
    assert.equal(calls.embed, 1);
    assert.equal(calls.analyse, 1);
    const before = await intelligenceStatus(persistent, w, saved.id);
    await persistent.close();
    persistent = await createDatabase(directory);
    const after = await intelligenceStatus(persistent, w, saved.id);
    assert.equal(after.analyses[0].id, before.analyses[0].id);
    const citation = after.analyses[0].result.summary[0].citations[0];
    assert.ok(
      (await getPassage(persistent, w, saved.id, citation.chunkId)).content.includes(
        citation.quote,
      ),
    );
    assert.equal(
      (await enqueueIntelligence(persistent, w, saved.id, 'openai', services)).id,
      job.id,
    );
    assert.equal(calls.embed, 1);
  } finally {
    await persistent?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
