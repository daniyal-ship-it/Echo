// Navigation history for brain exploration: whole brain → lobe → topic → memory, plus
// search results. Pure data and functions so the browser Back button, the in-app Back
// control and the breadcrumb all read the same record of where the reader has been.
import { REGION_INFO, type Region } from './types';

export type TrailKind = 'whole' | 'region' | 'topic' | 'memory' | 'results';
export type TrailLocation<Results = unknown> = {
  kind: TrailKind;
  /** The lobe and topic context the reader was exploring, kept when a memory is opened. */
  region: Region | null;
  tag: string;
  untagged: boolean;
  topicPosition: [number, number, number] | null;
  memory?: { id: string; title: string; region: Region; version?: number; passage?: string };
  /** The exact results the reader was shown, so going back never repeats a search. */
  results?: Results;
  question?: string;
};
export type Trail<Results = unknown> = { entries: TrailLocation<Results>[]; index: number };

export const WHOLE_BRAIN: TrailLocation<never> = {
  kind: 'whole',
  region: null,
  tag: '',
  untagged: false,
  topicPosition: null,
};
export const initialTrail = <Results = unknown>(): Trail<Results> => ({
  entries: [WHOLE_BRAIN],
  index: 0,
});

/** The place a memory or result set sits in: its lobe/topic context without the memory. */
export function contextOf<R>(location: TrailLocation<R>): TrailLocation<R> {
  const { region, tag, untagged, topicPosition } = location;
  return {
    kind: tag || untagged ? 'topic' : region ? 'region' : 'whole',
    region,
    tag,
    untagged,
    topicPosition: tag || untagged ? topicPosition : null,
  };
}

/** Two locations are the same place when a reader would not expect Back to separate them. */
export function samePlace<R>(a: TrailLocation<R>, b: TrailLocation<R>) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'memory') return a.memory?.id === b.memory?.id;
  if (a.kind === 'results') return a.results === b.results;
  return a.region === b.region && a.tag === b.tag && a.untagged === b.untagged;
}

/**
 * Records arriving somewhere. Revisiting the current place (a new passage or version of the
 * open memory) updates it in place; anything else is appended and forward history is dropped.
 */
export function visit<R>(trail: Trail<R>, location: TrailLocation<R>): Trail<R> {
  const current = trail.entries[trail.index];
  if (current && samePlace(current, location)) {
    const entries = trail.entries.slice();
    entries[trail.index] = location;
    return { entries, index: trail.index };
  }
  return {
    entries: [...trail.entries.slice(0, trail.index + 1), location],
    index: trail.index + 1,
  };
}

/** Moves to a recorded position, as the browser does on Back or Forward. */
export function travel<R>(trail: Trail<R>, index: number): Trail<R> | null {
  if (!Number.isInteger(index) || index < 0 || index >= trail.entries.length) return null;
  return { entries: trail.entries, index };
}
export const current = <R>(trail: Trail<R>) => trail.entries[trail.index];
export const previous = <R>(trail: Trail<R>) =>
  trail.index > 0 ? trail.entries[trail.index - 1] : null;

export function topicLabel(location: Pick<TrailLocation, 'tag' | 'untagged'>) {
  return location.untagged ? 'Untagged memories' : location.tag ? `#${location.tag}` : '';
}
/** A short name for a place, used after "Back to". Memory titles are deliberately omitted. */
export function placeName(location: TrailLocation) {
  switch (location.kind) {
    case 'whole':
      return 'whole brain';
    case 'region':
      return `${REGION_INFO[location.region!].name} lobe`;
    case 'topic':
      return topicLabel(location);
    case 'memory':
      return 'memory';
    case 'results':
      return 'results';
  }
}

export type Depth = { level: 1 | 2 | 3 | 4; of: 4; name: string };
/** How deep the reader is in the four-step exploration, for the on-canvas state label. */
export function depth(location: TrailLocation): Depth | null {
  switch (location.kind) {
    case 'whole':
      return { level: 1, of: 4, name: 'Whole brain' };
    case 'region':
      return { level: 2, of: 4, name: 'Lobe' };
    case 'topic':
      return { level: 3, of: 4, name: 'Topic' };
    case 'memory':
      return { level: 4, of: 4, name: 'Memory' };
    case 'results':
      return null;
  }
}
