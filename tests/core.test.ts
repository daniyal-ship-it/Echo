import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { createDatabase, type Database } from '../lib/db';
import { parseImport, parseJson } from '../lib/importers';
import {
  discoverEdges,
  getGraph,
  listMemories,
  memoryDetail,
  retrieve,
  runImportBatch,
  storeMemory,
} from '../lib/memories';
import {
  assertOrigin,
  createSession,
  findSession,
  hash,
  hashPassword,
  HttpError,
  uuid,
  verifyPassword,
} from '../lib/security';
import { getAnatomy, placeMemory } from '../lib/anatomy';
import type { ImportItem } from '../lib/types';

let db: Database;
const workspace = uuid(),
  otherWorkspace = uuid(),
  owner = uuid(),
  otherOwner = uuid();
before(async () => {
  db = await createDatabase('memory://');
  for (const [u, w, email] of [
    [owner, workspace, 'a@example.test'],
    [otherOwner, otherWorkspace, 'b@example.test'],
  ]) {
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      u,
      email,
      'Test user',
      'not-a-password',
    ]);
    await db.query('INSERT INTO workspaces(id,owner_id,name) VALUES($1,$2,$3)', [
      w,
      u,
      'Test workspace',
    ]);
  }
});
after(async () => {
  await db?.close();
});
const note = (
  id: string,
  content = 'A durable memory of the holographic brain architecture. #echo #architecture',
): ImportItem => ({
  source: 'note',
  sourceId: id,
  title: `Architecture ${id}`,
  content,
  raw: { text: content },
  messages: [],
  sourceAt: null,
  kind: 'note',
  region: 'frontal',
  tags: ['echo', 'architecture'],
});
const chat = [
  {
    id: 'chat-1',
    title: 'A branching conversation',
    create_time: 1700000000,
    current_node: 'a2',
    mapping: {
      root: { parent: null, message: null },
      u1: {
        parent: 'root',
        message: {
          id: 'u1',
          author: { role: 'user' },
          content: { parts: ['Design a holographic brain.'] },
          create_time: 1700000001,
        },
      },
      a1: {
        parent: 'u1',
        message: {
          id: 'a1',
          author: { role: 'assistant' },
          content: { parts: ['Earlier branch.'] },
          create_time: 1700000002,
        },
      },
      a2: {
        parent: 'u1',
        message: {
          id: 'a2',
          author: { role: 'assistant' },
          content: { parts: ['Keep the original anatomy.'] },
          create_time: 1700000003,
          metadata: { model_slug: 'exported-model' },
        },
      },
    },
  },
];

test('anatomical anchors use real vertices, remain stable and avoid occupied slots', async () => {
  const anatomy = await getAnatomy();
  assert.equal(anatomy.count, 20484);
  for (const r of ['frontal', 'parietal', 'temporal', 'occipital'] as const) {
    assert.ok(anatomy.candidates[r].length > 1000);
  }
  const a = await placeMemory('same source', 'frontal', new Set());
  const b = await placeMemory('same source', 'frontal', new Set());
  assert.deepEqual(a, b);
  assert.equal(anatomy.regions[a.anchor], 1);
  const c = await placeMemory('same source', 'frontal', new Set([a.anchor]));
  assert.notEqual(a.anchor, c.anchor);
  assert.equal(anatomy.regions[c.anchor], 1);
});
test('ChatGPT preserves branches, source metadata, role order and active path', () => {
  const [item] = parseJson(JSON.stringify(chat));
  assert.deepEqual(item.raw, chat[0]);
  assert.deepEqual(
    item.messages.map((m) => m.id),
    ['u1', 'a1', 'a2'],
  );
  assert.equal(item.messages[1].active, false);
  assert.equal(item.messages[2].active, true);
  assert.match(item.content, /Keep the original anatomy/);
  assert.doesNotMatch(item.content, /Earlier branch/);
  assert.equal(item.messages[2].model, 'exported-model');
  assert.ok(item.sourceAt?.startsWith('2023-11'));
});
test('Claude export preserves ordered messages and original attachments', () => {
  const raw = [
    {
      uuid: 'claude-1',
      name: 'Launch plan',
      chat_messages: [
        {
          uuid: 'm1',
          sender: 'human',
          text: 'What is the plan?',
          attachments: [{ file_name: 'notes.pdf' }],
        },
        {
          uuid: 'm2',
          sender: 'assistant',
          content: [{ type: 'text', text: 'Review the sources first.' }],
        },
      ],
    },
  ];
  const [item] = parseJson(JSON.stringify(raw));
  assert.equal(item.source, 'claude');
  assert.equal(item.messages[0].role, 'user');
  assert.equal(item.messages[1].content, 'Review the sources first.');
  assert.deepEqual(item.raw, raw[0]);
});
test('invalid JSON, unsupported formats, cyclic branches, and unsafe ZIP paths fail', () => {
  assert.throws(() => parseJson('{'), HttpError);
  assert.throws(() => parseJson('[{"fake":true}]'), HttpError);
  assert.throws(
    () => parseJson(JSON.stringify([{ mapping: { a: { parent: 'b' }, b: { parent: 'a' } } }])),
    /cycle/,
  );
  assert.throws(
    () => parseImport('vault.zip', zipSync({ '../escape.md': strToU8('No') })),
    /Unsafe/,
  );
  assert.throws(() => parseImport('file.pdf', strToU8('PDF')), /Supported now/);
});
test('Markdown vault paths, tags and wiki links are preserved without filesystem extraction', () => {
  const archive = zipSync({
    'project/Idea.md': strToU8('# A thought\n\nRead [[Architecture]] #echo #architecture'),
    'image.png': new Uint8Array([1, 2, 3]),
  });
  const [item] = parseImport('vault.zip', archive);
  assert.equal(item.sourceId, 'project/Idea.md');
  assert.equal(item.title, 'A thought');
  assert.deepEqual(item.tags, ['echo', 'architecture']);
  assert.match(item.content, /\[\[Architecture\]\]/);
});
test('persistent originals are versioned, reimport is idempotent and old versions cannot overwrite latest', async () => {
  const item = note('versioned');
  const saved = await db.transaction((tx) => storeMemory(tx, workspace, item));
  const again = await db.transaction((tx) => storeMemory(tx, workspace, item));
  assert.equal(again.duplicate, true);
  assert.equal(saved.id, again.id);
  const location = (await memoryDetail(db, workspace, saved.id)).position;
  const changed = note('versioned', 'A revised decision. Preserve the older architecture.');
  await db.transaction((tx) => storeMemory(tx, workspace, changed));
  await db.transaction((tx) => storeMemory(tx, workspace, item));
  const latest = await memoryDetail(db, workspace, saved.id);
  assert.equal(latest.version, 2);
  assert.equal(latest.versions.length, 2);
  assert.equal(latest.content, changed.content);
  assert.deepEqual(latest.position, location);
  const old = await memoryDetail(db, workspace, saved.id, 1);
  assert.equal(old.content, item.content);
  assert.deepEqual(old.raw, item.raw);
});
test('workspace isolation covers detail, list, retrieval, graph and cross-workspace edges', async () => {
  const saved = await db.transaction((tx) =>
    storeMemory(tx, workspace, note('private', 'Private zebraquartz launch plan')),
  );
  await assert.rejects(memoryDetail(db, otherWorkspace, saved.id), /not found/);
  assert.equal((await listMemories(db, otherWorkspace, new URLSearchParams())).total, 0);
  assert.equal((await retrieve(db, otherWorkspace, 'zebraquartz')).length, 0);
  assert.equal((await getGraph(db, otherWorkspace)).total, 0);
  const other = await db.transaction((tx) => storeMemory(tx, otherWorkspace, note('other')));
  await assert.rejects(
    db.query(
      "INSERT INTO memory_edges(id,workspace_id,source_id,target_id,relationship,evidence,confidence,method) VALUES($1,$2,$3,$4,'link','bad cross-workspace edge',1,'manual')",
      [uuid(), workspace, saved.id, other.id],
    ),
    /foreign key/,
  );
});
test('graph candidate evidence is inspectable; only confirmed edges appear in the brain', async () => {
  const a = await db.transaction((tx) => storeMemory(tx, workspace, note('linked-a')));
  const b = await db.transaction((tx) => storeMemory(tx, workspace, note('linked-b')));
  await discoverEdges(db, workspace, b.id);
  const detail = await memoryDetail(db, workspace, b.id);
  const edge = detail.edges.find((e) => e.source_id === a.id || e.target_id === a.id)!;
  assert.ok(edge);
  assert.match(edge.evidence, /#architecture/);
  assert.equal(edge.status, 'candidate');
  assert.equal((await getGraph(db, workspace)).edges.length, 0);
  await db.query("UPDATE memory_edges SET status='confirmed' WHERE id=$1", [edge.id]);
  assert.equal((await getGraph(db, workspace)).edges.length, 1);
});
test('natural-language full-text retrieval returns real source excerpts', async () => {
  const results = await retrieve(
    db,
    workspace,
    'Find the conversation where we discussed the holographic brain',
  );
  assert.ok(results.length > 0);
  assert.match(results[0].excerpt, /holographic brain/);
  assert.ok(results[0].id);
  assert.equal((await retrieve(db, workspace, 'inexistentsourceuniqueterm')).length, 0);
});
test('import jobs resume in bounded batches and exact replay does not multiply memories', async () => {
  const items = Array.from({ length: 17 }, (_, i) => note(`job-${i}`));
  const id = uuid();
  await db.query(
    'INSERT INTO import_jobs(id,workspace_id,filename,fingerprint,items,original,total) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [
      id,
      workspace,
      'notes.json',
      hash('jobfixture'),
      JSON.stringify(items),
      Buffer.from('original archive'),
      items.length,
    ],
  );
  const first = await runImportBatch(db, workspace, id);
  assert.equal(first.processed, 15);
  assert.equal(first.status, 'running');
  const last = await runImportBatch(db, workspace, id);
  assert.equal(last.processed, 17);
  assert.equal(last.status, 'completed');
  const replay = await runImportBatch(db, workspace, id);
  assert.equal(replay.added, 17);
  const count = await db.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM data_sources WHERE workspace_id=$1 AND source_key LIKE 'job-%'",
    [workspace],
  );
  assert.equal(count[0].count, 17);
});
test('password hashing, opaque sessions, expiry and same-origin mutation rules', async () => {
  const encoded = await hashPassword('long test password 123');
  assert.ok(await verifyPassword('long test password 123', encoded));
  assert.equal(await verifyPassword('wrong', encoded), false);
  assert.doesNotMatch(encoded, /long test/);
  const token = await createSession(db, owner);
  assert.equal((await findSession(db, token))?.workspaceId, workspace);
  assert.equal(await findSession(db, 'invalid'), null);
  await db.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [
    hash(token),
  ]);
  assert.equal(await findSession(db, token), null);
  const previousOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = 'http://localhost:3000';
  try {
    assert.throws(
      () =>
        assertOrigin(
          new Request('http://localhost:3000/api/memories', {
            method: 'POST',
            headers: { origin: 'https://evil.test' },
          }),
        ),
      /must come from/,
    );
    assert.doesNotThrow(() =>
      assertOrigin(
        new Request('http://localhost:3000/api/memories', {
          method: 'POST',
          headers: { origin: 'http://localhost:3000' },
        }),
      ),
    );
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
  }
});
test('PostgreSQL data survives a real database close and reopen', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'echo-persistence-'));
  let persistent: Database | undefined;
  try {
    persistent = await createDatabase(dir);
    await persistent.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      uuid(),
      'persist@example.test',
      'Persistent user',
      'hash',
    ]);
    await persistent.close();
    persistent = await createDatabase(dir);
    const rows = await persistent.query('SELECT name FROM users WHERE email=$1', [
      'persist@example.test',
    ]);
    assert.equal(rows[0].name, 'Persistent user');
  } finally {
    await persistent?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
