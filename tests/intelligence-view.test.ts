import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  connectionOrigin,
  deriveState,
  groupConnections,
  locatePassage,
  MAX_REQUESTS_PER_RUN,
  numberAnalysis,
  remainingRequests,
  stages,
  type PublicJob,
} from '../lib/intelligence-view';
import type { Edge } from '../lib/types';

const job = (over: Partial<PublicJob> = {}): PublicJob => ({
  id: 'job',
  workspace_id: 'w',
  memory_id: 'm',
  source_version: 1,
  source_hash: 'h',
  config: {
    embeddingModel: 'text-embedding-3-small',
    dimensions: 1536,
    summaryProvider: 'openai',
    summaryModel: 'model',
    promptVersion: 'p',
    chunkerVersion: 'c',
  },
  config_hash: 'c',
  status: 'queued',
  total_chunks: 12,
  embedded: 0,
  analysed: 0,
  lease_until: null,
  next_attempt_at: null,
  error: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});
const base = { driving: false, viewedVersion: 1, latestVersion: 1, hasAnalysis: false };
const state = (input: Partial<Parameters<typeof deriveState>[0]>) =>
  deriveState({ ...base, ...input }).state;

test('every required intelligence state is derived from saved data, never assumed', () => {
  assert.equal(state({}), 'unprocessed');
  assert.equal(state({ job: job() }), 'queued');
  assert.equal(state({ job: job({ embedded: 8 }) }), 'paused');
  assert.equal(state({ job: job({ embedded: 8 }), driving: true }), 'running');
  assert.equal(state({ job: job({ status: 'retry_wait', embedded: 8 }) }), 'waiting');
  assert.equal(state({ job: job({ status: 'completed' }), hasAnalysis: true }), 'completed');
  assert.equal(state({ job: job({ status: 'failed' }) }), 'failed');
  assert.equal(state({ job: job({ status: 'uncertain' }) }), 'review');
  assert.equal(state({ job: job({ status: 'cancelled' }) }), 'cancelled');
  assert.equal(state({ job: job({ status: 'superseded' }) }), 'outdated');
});
test('a step in flight elsewhere reads as running only while its lease is live', () => {
  const now = Date.parse('2026-01-01T00:01:00Z');
  const running = (lease: string) =>
    deriveState({
      ...base,
      now,
      job: job({ status: 'running', embedded: 8, lease_until: lease }),
    }).state;
  assert.equal(running('2026-01-01T00:02:00Z'), 'running');
  assert.equal(running('2026-01-01T00:00:30Z'), 'paused');
});
test('outdated covers historical versions and a changed original, and completion needs evidence', () => {
  const historical = deriveState({
    ...base,
    viewedVersion: 1,
    latestVersion: 2,
    hasAnalysis: true,
    job: job({ status: 'completed' }),
  });
  assert.equal(historical.state, 'outdated');
  assert.match(historical.meaning, /version 1\..*version 2/);
  assert.equal(state({ viewedVersion: 1, latestVersion: 2 }), 'unprocessed');
  assert.equal(state({ viewedVersion: 2, latestVersion: 2, earlierSummaryVersion: 1 }), 'outdated');
  // A completed job without a published analysis must not claim a summary exists.
  assert.match(
    deriveState({ ...base, job: job({ status: 'completed' }) }).meaning,
    /No summary was published/,
  );
});
test('stages and request bounds follow the saved counts and the eight-passage batch', () => {
  const partial = job({ status: 'failed', embedded: 12, analysed: 8 });
  assert.deepEqual(
    stages(partial, false).map((s) => s.status),
    ['done', 'done', 'stopped', 'pending'],
  );
  assert.deepEqual(
    stages(job({ embedded: 8 }), false).map((s) => s.status),
    ['done', 'current', 'pending', 'pending'],
  );
  assert.deepEqual(
    stages(job({ status: 'completed', embedded: 12, analysed: 12 }), true).map((s) => s.status),
    ['done', 'done', 'done', 'done'],
  );
  assert.deepEqual(remainingRequests(partial), { index: 0, analyse: 1, total: 1 });
  assert.deepEqual(remainingRequests(job({ embedded: 8 })), { index: 1, analyse: 2, total: 3 });
  assert.equal(MAX_REQUESTS_PER_RUN, 16);
});
test('a cited passage keeps one number across summary and insights', () => {
  const view = numberAnalysis({
    summary: [{ text: 's', citations: [{ chunkId: 'a', quote: 'qa' }] }],
    insights: [
      { kind: 'commitment', text: 'c', citations: [{ chunkId: 'b', quote: 'qb' }] },
      {
        kind: 'decision',
        text: 'd',
        citations: [
          { chunkId: 'c', quote: 'qc' },
          { chunkId: 'a', quote: 'qa' },
        ],
      },
    ],
  });
  // Numbered in reading order: summary, decisions, questions, commitments.
  assert.deepEqual(
    view.decisions[0].citations.map((c) => c.number),
    [2, 1],
  );
  assert.equal(view.commitments[0].citations[0].number, 3);
  assert.equal(view.questions.length, 0);
  assert.deepEqual(
    view.passages.map((p) => [p.chunkId, p.number]),
    [
      ['a', 1],
      ['c', 2],
      ['b', 3],
    ],
  );
});
test('connections separate the reader’s decisions from suggestions and inferences', () => {
  const edge = (method: string, status: string) => ({ method, status }) as Edge;
  const groups = groupConnections([
    edge('manual', 'confirmed'),
    edge('semantic', 'confirmed'),
    edge('semantic', 'candidate'),
    edge('shared-tags', 'candidate'),
    edge('explicit-reference', 'candidate'),
  ]);
  assert.equal(groups.confirmed.length, 2);
  assert.equal(groups.suggestedInferred.length, 1);
  assert.equal(groups.suggestedExplicit.length, 2);
  assert.equal(connectionOrigin(edge('manual', 'confirmed')), 'Created by you');
  assert.equal(connectionOrigin(edge('semantic', 'candidate')), 'Inferred from meaning');
  assert.match(connectionOrigin(edge('semantic', 'confirmed')), /confirmed by you/);
});
test('a passage is highlighted only when its offsets reproduce the cited text exactly', () => {
  const text = 'Keep the codes in the desk. Review in March.';
  const hit = locatePassage(text, { start_offset: 5, end_offset: 14, content: 'the codes' });
  assert.deepEqual(hit, {
    before: 'Keep ',
    match: 'the codes',
    after: ' in the desk. Review in March.',
  });
  assert.equal(
    locatePassage(text, { start_offset: 5, end_offset: 14, content: 'other text' }),
    null,
  );
  assert.equal(locatePassage(text, { start_offset: 40, end_offset: 90, content: 'x' }), null);
});
