'use client';
// Presentation components that surround the anatomical canvas. They render only state the
// workspace already holds (lobe counts, the current place, loading and errors); none of them
// talks to the renderer or invents data.
import type { CSSProperties, ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Focus,
  Plus,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { REGION_INFO, REGIONS, type Region } from '@/lib/types';
import { placeName, type TrailLocation } from '@/lib/exploration-trail';

const plural = (count: number) => `${count} ${count === 1 ? 'memory' : 'memories'}`;

/** One step back through the places the reader has actually visited. */
export function TrailBack({ to, onBack }: { to: TrailLocation | null; onBack: () => void }) {
  if (!to) return null;
  return (
    <button className="trail-back" onClick={onBack} aria-keyshortcuts="Escape">
      <ArrowLeft size={13} aria-hidden />
      Back
      <span className="trail-back-to">to {placeName(to)}</span>
    </button>
  );
}

/** Lobe indicators on the canvas: always-available entry to a lobe without the sidebar or WebGL. */
export function LobeLegend({
  counts,
  active,
  onSelect,
}: {
  counts: Record<string, number>;
  active: Region | null;
  onSelect: (region: Region) => void;
}) {
  return (
    <nav className="lobe-legend" aria-label="Cerebral lobes">
      {REGIONS.map((region) => {
        const info = REGION_INFO[region];
        const count = counts[region] || 0;
        const selected = active === region;
        return (
          <button
            key={region}
            className={`lobe-chip${selected ? ' active' : ''}`}
            style={{ '--lobe': info.color } as CSSProperties}
            aria-current={selected ? 'true' : undefined}
            aria-label={`${info.name} lobe, ${plural(count)}`}
            onClick={() => onSelect(region)}
          >
            <span className="lobe-chip-dot" aria-hidden />
            <span className="lobe-chip-name">{info.name}</span>
            <span className="lobe-chip-count" aria-hidden>
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Context for the whole-brain view once memories exist: where they are, and how to go in. */
export function LobeOverview({
  counts,
  total,
  connections,
  onSelect,
  onImport,
  onWrite,
}: {
  counts: Record<string, number>;
  total: number;
  connections: number;
  onSelect: (region: Region) => void;
  onImport: () => void;
  onWrite: () => void;
}) {
  const largest = Math.max(1, ...REGIONS.map((r) => counts[r] || 0));
  return (
    <section className="lobe-overview" aria-label="Whole brain overview">
      <div className="inspector-heading">
        <span className="eyebrow">01 / WHOLE BRAIN</span>
        <BrainCircuit size={16} aria-hidden />
      </div>
      <div className="overview-intro">
        <h2>Choose a lobe.</h2>
        <p>
          {plural(total)} placed across four lobes. Enter a lobe to see its topics, or select a
          luminous point to open one original.
        </p>
      </div>
      <ul className="lobe-cards">
        {REGIONS.map((region) => {
          const info = REGION_INFO[region];
          const count = counts[region] || 0;
          return (
            <li key={region}>
              <button
                className="lobe-card"
                style={{ '--lobe': info.color } as CSSProperties}
                aria-label={`Enter ${info.name} lobe, ${plural(count)}`}
                onClick={() => onSelect(region)}
              >
                <span className="lobe-card-head">
                  <span className="lobe-chip-dot" aria-hidden />
                  <strong>{info.name}</strong>
                  <span className="lobe-card-count">{count}</span>
                </span>
                <span className="lobe-card-meaning">{info.meaning}</span>
                <span className="lobe-card-bar" aria-hidden>
                  <span style={{ width: `${(count / largest) * 100}%` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="fine-print overview-note">
        Lobes are a way to organise your records, not a claim about where memories are stored.{' '}
        {connections} confirmed {connections === 1 ? 'connection is' : 'connections are'} drawn in
        this view.
      </p>
      <div className="overview-actions">
        <button className="text-button" onClick={onImport}>
          <Upload size={13} aria-hidden />
          Import memories
        </button>
        <button className="text-button" onClick={onWrite}>
          <Plus size={13} aria-hidden />
          Write a memory
        </button>
      </div>
      <div className="scaffold-note">
        <div>
          <span className="scaffold-key" />
          <strong>Scaffold ≠ memories</strong>
        </div>
        <p>
          The fine dots trace real cortical anatomy. Brighter, selectable points represent stored
          records. No memories are generated to fill the brain.
        </p>
        <a href="/anatomy/manifest.json" target="_blank" rel="noreferrer">
          View anatomical provenance
          <ArrowUpRight size={12} aria-hidden />
        </a>
      </div>
    </section>
  );
}

/** A quiet message over the canvas for loading, empty and failed views. */
export function CanvasNotice({
  tone = 'info',
  live = 'polite',
  children,
}: {
  tone?: 'info' | 'empty' | 'problem';
  live?: 'polite' | 'assertive';
  children: ReactNode;
}) {
  return (
    <div className={`canvas-notice is-${tone}`} aria-live={live}>
      {children}
    </div>
  );
}

/** Bottom navigation for phones: the three places a thumb needs, plus capture. */
export function MobileBar({
  signedIn,
  view,
  contextLabel,
  onAtlas,
  onMemories,
  onContext,
  onNew,
}: {
  signedIn: boolean;
  view: 'atlas' | 'memories' | 'context';
  contextLabel: string;
  onAtlas: () => void;
  onMemories: () => void;
  onContext: () => void;
  onNew: () => void;
}) {
  return (
    <nav className="mobile-dock mobile-only" aria-label="Workspace">
      <button className={view === 'atlas' ? 'active' : ''} onClick={onAtlas}>
        <BrainCircuit size={18} aria-hidden />
        Atlas
      </button>
      <button className={view === 'memories' ? 'active' : ''} onClick={onMemories}>
        <BookOpen size={18} aria-hidden />
        Memories
      </button>
      <button className={view === 'context' ? 'active' : ''} onClick={onContext}>
        {signedIn ? <Focus size={18} aria-hidden /> : <ShieldCheck size={18} aria-hidden />}
        {signedIn ? contextLabel : 'Open workspace'}
      </button>
      {signedIn && (
        <button onClick={onNew}>
          <Plus size={18} aria-hidden />
          New
        </button>
      )}
    </nav>
  );
}
