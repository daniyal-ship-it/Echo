'use client';
import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, CornerDownRight, Sparkles, X } from 'lucide-react';
import type { Passage } from '@/lib/intelligence-types';

/** The cited passage, with its immutable source-version reference and citation navigation. */
export default function SourcePassage({
  passage,
  trail,
  inContext,
  onStep,
  onShowInContext,
  onReturn,
  onClear,
}: {
  passage: Passage;
  /** Passages cited by the analysis this citation was opened from, if any. */
  trail: string[];
  /** Whether the passage could be located inside the original text shown below. */
  inContext: boolean;
  onStep: (chunkId: string) => void;
  onShowInContext: () => void;
  onReturn?: () => void;
  onClear: () => void;
}) {
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    // Move reading focus to the newly cited passage for keyboard and screen-reader users.
    region.current?.focus({ preventScroll: true });
    region.current?.scrollIntoView({ block: 'start' });
  }, [passage.id]);
  const position = trail.indexOf(passage.id);
  return (
    <section
      className="source-passage iq-passage"
      aria-label="Cited original passage"
      tabIndex={-1}
      ref={region}
    >
      <div className="iq-passage-head">
        <span className="eyebrow">CITED ORIGINAL · VERSION {passage.source_version}</span>
        <button className="icon-button" aria-label="Clear cited passage" onClick={onClear}>
          <X size={14} aria-hidden />
        </button>
      </div>
      <blockquote>{passage.content}</blockquote>
      <small>
        {passage.role || 'Original text'}
        {passage.source_timestamp
          ? ` · ${new Date(passage.source_timestamp).toLocaleString()}`
          : ''}{' '}
        · characters {passage.start_offset}–{passage.end_offset}
        {!passage.active ? ' · alternate branch' : ''}
      </small>
      <p className="fine-print iq-passage-ref">
        Fixed reference: source version {passage.source_version}, passage {passage.ordinal + 1}.
        Later edits create a new version and never change this text.
      </p>
      <div className="iq-passage-actions">
        {onReturn && (
          <button className="button secondary small" onClick={onReturn}>
            <Sparkles size={13} aria-hidden />
            Back to summary
          </button>
        )}
        {inContext && (
          <button className="button secondary small" onClick={onShowInContext}>
            <CornerDownRight size={13} aria-hidden />
            Show in original
          </button>
        )}
        {position >= 0 && trail.length > 1 && (
          <span className="iq-passage-step" role="group" aria-label="Cited passages">
            <button
              className="icon-button"
              aria-label="Previous cited passage"
              disabled={position === 0}
              onClick={() => onStep(trail[position - 1])}
            >
              <ArrowLeft size={14} aria-hidden />
            </button>
            <span aria-live="polite">
              Passage {position + 1} of {trail.length} cited
            </span>
            <button
              className="icon-button"
              aria-label="Next cited passage"
              disabled={position === trail.length - 1}
              onClick={() => onStep(trail[position + 1])}
            >
              <ArrowRight size={14} aria-hidden />
            </button>
          </span>
        )}
      </div>
    </section>
  );
}
