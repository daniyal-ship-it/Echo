import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../lib/db';
import { storeMemory } from '../lib/memories';
import { hybridRetrieve, assertCitationAccess, diversifyCitations } from '../lib/retrieval';
import { chunkSource, assertPassageIntegrity, validateAnalysis } from '../lib/chunks';
import { analysisInstructions } from '../lib/intelligence';
import { PROMPT_VERSION } from '../lib/intelligence-types';
import { uuid } from '../lib/security';
import type { Citation, Message } from '../lib/types';

test('fallback citations verify immutable excerpts, offsets, node identity and version', async () => {
  const db = await createDatabase('memory://');
  try {
    const owner = uuid(),
      workspace = uuid();
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      owner,
      `${owner}@example.test`,
      'fixture',
      'not-a-login',
    ]);
    await db.query('INSERT INTO workspaces(id,owner_id,name) VALUES($1,$2,$3)', [
      workspace,
      owner,
      'fixture',
    ]);
    const item = {
      source: 'note',
      sourceId: 'exact',
      title: 'Zephyr schedule',
      content: 'The Zephyr appointment is at noon.',
      raw: { note: 'original' },
      messages: [],
      sourceAt: null,
      kind: 'note',
      tags: [],
    };
    await db.transaction((tx) => storeMemory(tx, workspace, item));
    const { citations } = await hybridRetrieve(db, workspace, 'Zephyr');
    assert.equal(citations.length, 1);
    const c = citations[0];
    assert.equal(c.brainNodeId, c.id);
    assert.equal(c.endOffset! - c.startOffset!, c.excerpt.length);
    await assertCitationAccess(db, workspace, [c]);
    for (const altered of [
      { ...c, excerpt: 'A fabricated time is midnight.' },
      { ...c, startOffset: 100 },
      { ...c, brainNodeId: uuid() },
      { ...c, contentHash: 'wrong' },
    ])
      await assert.rejects(assertCitationAccess(db, workspace, [altered]), /citation/i);
    await db.transaction((tx) =>
      storeMemory(tx, workspace, {
        ...item,
        content: 'Zephyr is postponed.',
        raw: { note: 'edited' },
      }),
    );
    await assert.rejects(assertCitationAccess(db, workspace, [c]), /changed/);
  } finally {
    await db.close();
  }
});

test('passage integrity checks immutable speaker, message, UTF-16 offsets, hash and active branch', () => {
  const message: Message = {
    id: 'speaker-one',
    role: 'user',
    content: 'A 🌌 note with uncertain timing.',
    timestamp: null,
    parent: null,
    active: true,
  };
  const original = { content: '', messages: [message] };
  const [p] = chunkSource(uuid(), uuid(), 1, original.content, original.messages, null);
  assertPassageIntegrity(p, original);
  for (const alteration of [
    { role: 'assistant' },
    { message_index: 3 },
    { message_id: 'wrong' },
    { start_offset: 1 },
    { end_offset: 999 },
    { content_hash: 'wrong' },
    { active: false },
  ])
    assert.throws(() => assertPassageIntegrity({ ...p, ...alteration }, original), /immutable/);
});

test('grounding derives speaker provenance and rejects mismatched attribution and suggested commitments', () => {
  const message: Message = {
    id: 'assistant-one',
    role: 'assistant',
    content: 'You could possibly send the proposal tomorrow.',
    timestamp: null,
    parent: null,
    active: true,
  };
  const chunks = chunkSource(uuid(), uuid(), 1, '', [message], null);
  const claim = {
    text: message.content,
    certainty: 'uncertain' as const,
    speakerRole: 'assistant',
    citations: [{ chunkId: chunks[0].id, quote: message.content }],
  };
  const result = validateAnalysis({ summary: [claim], insights: [] }, chunks);
  assert.equal(result.summary[0].certainty, 'uncertain');
  assert.equal(result.summary[0].citations[0].speakerRole, 'assistant');
  assert.equal(result.summary[0].citations[0].memoryId, chunks[0].memory_id);
  assert.equal(result.summary[0].citations[0].version, 1);
  assert.throws(
    () => validateAnalysis({ summary: [{ ...claim, speakerRole: 'user' }], insights: [] }, chunks),
    /attribution/,
  );
  assert.throws(
    () =>
      validateAnalysis({ summary: [claim], insights: [{ ...claim, kind: 'commitment' }] }, chunks),
    /commitment/,
  );
  assert.throws(
    () =>
      validateAnalysis(
        { summary: [claim], insights: [{ ...claim, kind: 'decision', certainty: 'inference' }] },
        chunks,
      ),
    /inference/i,
  );
  assert.notEqual(
    analysisInstructions('grounded-analysis-v1'),
    analysisInstructions(PROMPT_VERSION),
  );
  assert.throws(() => analysisInstructions('invented'), /Unknown/);
});

test('context diversity covers distinct originals before second passages; duplicate excerpts do not crowd evidence', () => {
  const cite = (id: string, rank: number, excerpt: string): Citation => ({
    id,
    title: id,
    source: 'note',
    region: 'frontal',
    rank,
    excerpt,
    version: 1,
  });
  const rows = [
    cite('a', 10, 'first'),
    cite('a', 9, 'first'),
    cite('a', 8, 'second'),
    cite('b', 7, 'other'),
    cite('c', 6, 'third'),
  ];
  assert.deepEqual(
    diversifyCitations(rows, 3).map((c) => c.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    diversifyCitations(rows, 6).map((c) => c.excerpt),
    ['first', 'other', 'third', 'second'],
  );
});
