import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { hash } from './security';
import { REGION_INFO, type Region } from './types';
type Anatomy = {
  positions: Float32Array;
  regions: Uint8Array;
  candidates: Record<Region, number[]>;
  count: number;
};
let cached: Promise<Anatomy> | undefined;
export function getAnatomy() {
  cached ??= (async () => {
    const buffer = await readFile(path.join(process.cwd(), 'public/anatomy/brain.bin'));
    const copy = new Uint8Array(buffer).buffer;
    const header = new Uint32Array(copy, 0, 4);
    const count = header[1];
    const positions = new Float32Array(copy, 16, count * 3);
    const regions = new Uint8Array(copy, 16 + count * 12 + header[2] * 4, count);
    const candidates = Object.fromEntries(
      Object.entries(REGION_INFO).map(([key, info]) => [
        key,
        Array.from({ length: count }, (_, i) => i).filter((i) => regions[i] === info.index),
      ]),
    ) as Record<Region, number[]>;
    return { count, positions, regions, candidates };
  })();
  return cached;
}
export async function placeMemory(key: string, region: Region, occupied: Set<number>) {
  const anatomy = await getAnatomy();
  const candidates = anatomy.candidates[region];
  const start = parseInt(hash(key).slice(0, 8), 16) % candidates.length;
  for (let n = 0; n < 1_000_000; n++) {
    const vertex = candidates[(start + n) % candidates.length];
    const layer = Math.floor(n / candidates.length);
    const anchor = vertex + layer * anatomy.count;
    if (occupied.has(anchor)) continue;
    const p = Array.from(anatomy.positions.slice(vertex * 3, vertex * 3 + 3));
    const scale = 1.025 + Math.min(layer, 10) * 0.012;
    return { anchor, position: p.map((v) => v * scale) as [number, number, number] };
  }
  throw new Error('Spatial capacity reached.');
}
