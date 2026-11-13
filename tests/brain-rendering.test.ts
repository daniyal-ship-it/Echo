import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filamentGeometry, validateAtlasBuffer } from '../lib/brain-rendering';
import { fitAnatomy, orbitClearance } from '../lib/brain-camera';
import type { Graph, Edge } from '../lib/types';
const graph: Graph = {
  nodes: [
    { id: 'a', title: 'Fixture', region: 'frontal', position: [-1, 0, 0], count: 1, is_demo: true },
    { id: 'b', title: 'Fixture', region: 'temporal', position: [1, 0, 0], count: 1, is_demo: true },
  ],
  edges: [],
  counts: {},
  total: 2,
  aggregated: false,
};
const edge = (id: string, status = 'confirmed') =>
  ({ id, source_id: 'a', target_id: 'b', status }) as Edge;
test('batched filaments include only confirmed, present, selected graph relationships', () => {
  const g = {
    ...graph,
    edges: [
      edge('real'),
      edge('suggestion', 'candidate'),
      { ...edge('missing'), target_id: 'missing' },
    ],
  };
  const geometry = filamentGeometry(g, null);
  assert.equal(geometry.getAttribute('position').count, 48);
  assert.deepEqual(Array.from(geometry.getAttribute('position').array).slice(0, 3), [-1, 0, 0]);
  assert.deepEqual(Array.from(geometry.getAttribute('position').array).slice(-3), [1, 0, 0]);
  geometry.dispose();
  const empty = filamentGeometry(g, 'other');
  assert.equal(empty.getAttribute('position').count, 0);
  empty.dispose();
});
test('edge density is linear with bounded tessellation, independent of record counts', () => {
  for (const count of [0, 10, 1000]) {
    const geometry = filamentGeometry(
      { ...graph, edges: Array.from({ length: count }, (_, i) => edge(String(i))) },
      null,
    );
    assert.equal(geometry.getAttribute('position').count, count * 48);
    geometry.dispose();
  }
});
test('camera handles coincident destinations and conservative panned orbit clearance', () => {
  const positions = new Float32Array([-1, -1, -1, 1, 1, 1]);
  for (const aspect of [0.3, 1, 2.5])
    assert.ok(fitAnatomy(positions, [0, 0, 0], [0, 0, 0], 35, aspect).every(Number.isFinite));
  assert.ok(orbitClearance(positions) > Math.sqrt(3));
  assert.ok(orbitClearance(positions, [2, 0, 0]) > Math.sqrt(11));
});

test('unchanged atlas with region and hemisphere arrays loads, truncated assets fail closed', () => {
  const bytes = readFileSync('public/anatomy/brain.bin');
  const buffer = Uint8Array.from(bytes).buffer;
  assert.equal(validateAtlasBuffer(buffer)[1], 20484);
  assert.throws(() => validateAtlasBuffer(buffer.slice(0, -1)), /dimensions/);
  assert.throws(() => validateAtlasBuffer(new ArrayBuffer(4)), /Truncated/);
});
