import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contextOf,
  current,
  depth,
  initialTrail,
  placeName,
  previous,
  samePlace,
  topicLabel,
  travel,
  visit,
  type TrailLocation,
} from '../lib/exploration-trail';

const whole: TrailLocation = {
  kind: 'whole',
  region: null,
  tag: '',
  untagged: false,
  topicPosition: null,
};
const frontal: TrailLocation = { ...whole, kind: 'region', region: 'frontal' };
const aurora: TrailLocation = {
  ...frontal,
  kind: 'topic',
  tag: 'aurora',
  topicPosition: [1, 2, 3],
};
const memory = (
  id: string,
  extra: Partial<NonNullable<TrailLocation['memory']>> = {},
): TrailLocation => ({
  ...aurora,
  kind: 'memory',
  memory: { id, title: `Memory ${id}`, region: 'frontal', ...extra },
});

test('the trail records whole brain → lobe → topic → memory and steps back through each', () => {
  let trail = initialTrail();
  for (const place of [frontal, aurora, memory('a')]) trail = visit(trail, place);
  assert.equal(trail.index, 3);
  assert.deepEqual(
    trail.entries.map((e) => e.kind),
    ['whole', 'region', 'topic', 'memory'],
  );
  assert.equal(previous(trail)?.kind, 'topic');
  trail = travel(trail, 2)!;
  assert.equal(current(trail).tag, 'aurora');
  assert.equal(previous(trail)?.kind, 'region');
  assert.equal(previous(travel(trail, 0)!), null);
});
test('following a link keeps the first memory reachable instead of dropping it', () => {
  let trail = initialTrail();
  for (const place of [frontal, aurora, memory('a'), memory('b')]) trail = visit(trail, place);
  assert.equal(trail.index, 4);
  assert.equal(previous(trail)?.memory?.id, 'a');
});
test('a new passage or version of the open memory updates its entry rather than adding one', () => {
  let trail = visit(visit(initialTrail(), frontal), memory('a'));
  const before = trail.index;
  trail = visit(trail, memory('a', { version: 2, passage: 'chunk-9' }));
  assert.equal(trail.index, before);
  assert.equal(trail.entries.length, 3);
  assert.deepEqual(
    [current(trail).memory?.version, current(trail).memory?.passage],
    [2, 'chunk-9'],
  );
});
test('going back then somewhere new discards forward history, as a browser does', () => {
  let trail = initialTrail();
  for (const place of [frontal, aurora, memory('a')]) trail = visit(trail, place);
  trail = travel(trail, 1)!;
  trail = visit(trail, { ...whole, kind: 'region', region: 'occipital' });
  assert.deepEqual(
    trail.entries.map((e) => e.region),
    [null, 'frontal', 'occipital'],
  );
  assert.equal(travel(trail, 3), null);
  assert.equal(travel(trail, -1), null);
  assert.equal(travel(trail, 1.5), null);
});
test('search results are one place per result set and keep the exact results shown', () => {
  const first = { citations: [1] },
    second = { citations: [2] };
  const results = (r: object): TrailLocation => ({
    ...whole,
    kind: 'results',
    results: r,
    question: 'q',
  });
  let trail = visit(initialTrail(), results(first));
  trail = visit(trail, memory('a'));
  assert.equal(previous(trail)?.results, first);
  assert.equal(samePlace(results(first), results(first)), true);
  assert.equal(samePlace(results(first), results(second)), false);
});
test('closing a memory returns to its lobe or topic context', () => {
  assert.deepEqual(contextOf(memory('a')), aurora);
  assert.equal(
    contextOf({ ...frontal, kind: 'memory', memory: memory('a').memory }).kind,
    'region',
  );
  assert.equal(contextOf({ ...whole, kind: 'results' }).kind, 'whole');
  // A stale topic position must not survive without its topic.
  assert.equal(contextOf({ ...frontal, topicPosition: [1, 2, 3] }).topicPosition, null);
});
test('place names and depth describe real state without exposing memory titles', () => {
  assert.equal(placeName(whole), 'whole brain');
  assert.equal(placeName(frontal), 'Frontal lobe');
  assert.equal(placeName(aurora), '#aurora');
  assert.equal(placeName({ ...frontal, kind: 'topic', untagged: true }), 'Untagged memories');
  assert.equal(placeName(memory('a')), 'memory');
  assert.equal(topicLabel(frontal), '');
  assert.deepEqual(
    [whole, frontal, aurora, memory('a')].map((p) => depth(p)?.level),
    [1, 2, 3, 4],
  );
  assert.equal(depth({ ...whole, kind: 'results' }), null);
});
