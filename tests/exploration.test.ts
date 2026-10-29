import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createDatabase, type Database } from '../lib/db';
import { getAnatomy } from '../lib/anatomy';
import { cameraFov, fitAnatomy } from '../lib/brain-camera';
import { getGraph, listMemories, storeMemory } from '../lib/memories';
import { uuid } from '../lib/security';
import type { ImportItem } from '../lib/types';

let db: Database;
const workspace = uuid(),
  other = uuid();
before(async () => {
  db = await createDatabase('memory://');
  for (const w of [workspace, other]) {
    const owner = uuid();
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      owner,
      `${w}@example.test`,
      'Exploration fixture',
      'unused',
    ]);
    await db.query('INSERT INTO workspaces(id,owner_id,name) VALUES($1,$2,$3)', [
      w,
      owner,
      'Isolated test',
    ]);
  }
});
after(async () => {
  await db?.close();
});
const item = (
  id: string,
  tags: string[],
  region: ImportItem['region'] = 'frontal',
): ImportItem => ({
  source: 'note',
  sourceId: id,
  title: id,
  content: `Test original ${id}`,
  raw: { text: id },
  messages: [],
  sourceAt: '2026-10-01T10:00:00Z',
  kind: 'note',
  region,
  tags,
});

test('topics count distinct members, page every tag, preserve untagged and isolate scopes', async () => {
  await db.transaction((tx) =>
    storeMemory(tx, workspace, item('multi', ['echo', 'echo', 'launch'])),
  );
  await db.transaction((tx) => storeMemory(tx, workspace, item('same-tag', ['echo'])));
  await db.transaction((tx) => storeMemory(tx, workspace, item('no-tags', [])));
  await db.transaction((tx) =>
    storeMemory(tx, workspace, item('other-lobe', ['echo'], 'temporal')),
  );
  await db.transaction((tx) => storeMemory(tx, other, item('private-other', ['private-only'])));
  for (let i = 0; i < 27; i++)
    await db.transaction((tx) =>
      storeMemory(tx, workspace, item(`paged-${i}`, [`topic-${String(i).padStart(2, '0')}`])),
    );
  const first = await getGraph(db, workspace, 'frontal', new URLSearchParams({ view: 'topics' }));
  assert.equal(first.mode, 'topics');
  assert.equal(first.nodes.length, 24);
  assert.equal(first.topicTotal, 30);
  assert.equal(first.filteredTotal, 30);
  assert.equal(first.nodes[0].title, '#echo');
  assert.equal(first.nodes[0].count, 2); // duplicate tag on same record counted once
  const last = await getGraph(
    db,
    workspace,
    'frontal',
    new URLSearchParams({ view: 'topics', topicPage: '99' }),
  );
  assert.equal(last.topicPage, 1);
  assert.equal(last.nodes.length, 6);
  const nodes = [...first.nodes, ...last.nodes];
  assert.equal(new Set(nodes.map((n) => n.id)).size, 30);
  assert.equal(nodes.find((n) => n.topic === null)?.count, 1);
  assert.ok(!nodes.some((n) => n.topic === 'private-only'));
  assert.ok(
    nodes.every(
      (n) => n.kind === 'topic' && n.region === 'frontal' && n.position.every(Number.isFinite),
    ),
  );
  const filtered = new URLSearchParams({
    region: 'frontal',
    tag: 'echo',
    source: 'note',
    from: '2026-10-01',
    to: '2026-10-01',
  });
  const graph = await getGraph(db, workspace, 'frontal', filtered);
  const library = await listMemories(db, workspace, filtered);
  assert.equal(graph.filteredTotal, 2);
  assert.deepEqual(graph.nodes.map((n) => n.id).sort(), library.memories.map((n) => n.id).sort());
  const untagged = new URLSearchParams({ region: 'frontal', untagged: '1' });
  assert.equal((await listMemories(db, workspace, untagged)).total, 1);
  assert.equal((await getGraph(db, workspace, 'frontal', untagged)).nodes[0].title, 'no-tags');
  const search = await getGraph(
    db,
    workspace,
    'frontal',
    new URLSearchParams({ view: 'topics', topicQ: 'LaUnCh' }),
  );
  assert.equal(search.nodes.length, 1);
  assert.equal(search.nodes[0].topic, 'launch');
  for (const from of ['2026-02-30', 'not-a-date'])
    await assert.rejects(
      listMemories(db, workspace, new URLSearchParams({ from })),
      /valid ISO dates/,
    );
  await assert.rejects(getGraph(db, workspace, 'invalid'), /Unknown anatomical region/);
  await assert.rejects(
    getGraph(db, workspace, '', new URLSearchParams({ view: 'topics' })),
    /Choose a lobe/,
  );
});

test('source focus bypasses view filters but never workspace boundaries or unconfirmed links', async () => {
  const a = await db.transaction((tx) => storeMemory(tx, workspace, item('focused', ['focus'])));
  const b = await db.transaction((tx) =>
    storeMemory(tx, workspace, item('cross-lobe-neighbour', ['different'], 'occipital')),
  );
  const c = await db.transaction((tx) =>
    storeMemory(tx, workspace, item('unconfirmed', ['focus'])),
  );
  for (const [target, status] of [
    [b.id, 'confirmed'],
    [c.id, 'candidate'],
  ]) {
    await db.query(
      "INSERT INTO memory_edges(id,workspace_id,source_id,target_id,relationship,evidence,confidence,method,status) VALUES($1,$2,$3,$4,'test','Fixture evidence',1,'manual',$5)",
      [uuid(), workspace, a.id, target, status],
    );
  }
  const filters = new URLSearchParams({
    focus: a.id,
    tag: 'excluded',
    q: 'nonexistent',
    view: 'topics',
  });
  const graph = await getGraph(db, workspace, 'temporal', filters);
  assert.equal(graph.mode, 'neighborhood');
  assert.equal(graph.aggregated, false);
  assert.equal(graph.nodes[0].id, a.id);
  assert.deepEqual(graph.nodes.map((n) => n.id).sort(), [a.id, b.id].sort());
  assert.equal(graph.edges.length, 1);
  await assert.rejects(getGraph(db, other, '', filters), /Memory not found/);
  await assert.rejects(
    getGraph(db, workspace, '', new URLSearchParams({ focus: 'invalid' })),
    /Invalid memory/,
  );
});

test('front, side and asymmetric focus fit every anatomical vertex on desktop and mobile', async () => {
  const { positions } = await getAnatomy();
  const views: [number, number, number][] = [
    [0, 0.4, -5.7],
    [-5.8, 0.5, 0],
    [-4.8, 1.1, -2.8],
    [-2.7, 3, 1],
    [3, -1, 3],
  ];
  for (const aspect of [0.55, 1, 1.6, 2.6])
    for (const desired of views)
      for (const target of [
        [0, 0, 0],
        [0.25, -0.18, 0.3],
      ] as [number, number, number][]) {
        const camera = new PerspectiveCamera(cameraFov(aspect), aspect, 0.01, 50);
        camera.position.set(...fitAnatomy(positions, desired, target, camera.fov, aspect));
        camera.lookAt(...target);
        camera.updateMatrixWorld();
        for (let i = 0; i < positions.length; i += 3) {
          const p = new Vector3(positions[i], positions[i + 1], positions[i + 2]).project(camera);
          assert.ok(
            Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.9 && p.z > -1 && p.z < 1,
            `Clipped vertex ${i / 3}, aspect ${aspect}`,
          );
        }
      }
});
