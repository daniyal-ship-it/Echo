import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRetrieval, evaluationManifest } from '../scripts/retrieval-evaluation';

test('reproducible relevance evaluation covers exact, paraphrase, cross-memory, irrelevant and insufficient cases without pretending to have semantic vectors', async () => {
  const report = await evaluateRetrieval();
  assert.equal(new Set(report.results.map((r) => r.kind)).size, 5);
  assert.match(report.semantics.status, /NOT RUN/);
  for (const row of report.results.filter((r) => r.kind === 'exact-match'))
    assert.equal(row.recallAt6, 1);
  assert.equal(report.results.find((r) => r.case === 'cross-launch')!.recallAt6, 1);
  for (const key of ['empty-filter', 'no-source'])
    assert.equal(report.results.find((r) => r.case === key)!.correctAbstention, true);
  assert.equal(
    report.results.find((r) => r.case === 'lexical-trap')!.correctAbstention,
    false,
    'Lexical overlap alone must not be misreported as answer support',
  );
  for (const row of report.results.filter((r) => r.kind === 'paraphrased'))
    assert.equal(row.recallAt6, 0, 'No fabricated semantic success');
  assert.ok(evaluationManifest().inputs.every((x) => x.sha256.length === 64));
});
