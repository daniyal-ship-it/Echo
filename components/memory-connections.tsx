'use client';
import { ArrowUpRight, Check, Link2, Plus, Sparkles, Tag, UserCheck } from 'lucide-react';
import { connectionOrigin, groupConnections } from '@/lib/intelligence-view';
import type { Edge, MemoryDetail } from '@/lib/types';

/** Links for one memory, with the reader's own decisions kept apart from ECHO's suggestions. */
export default function MemoryConnections({
  memory,
  onNavigate,
  onDecide,
  onConnect,
}: {
  memory: MemoryDetail;
  onNavigate: (id: string, version?: number, passage?: string) => void;
  onDecide: (id: string, status: 'confirmed' | 'dismissed') => void;
  onConnect: () => void;
}) {
  const groups = groupConnections(memory.edges);
  const card = (e: Edge) => {
    const other = e.source_id === memory.id ? e.target_id : e.source_id;
    const title = e.source_id === memory.id ? e.target_title : e.source_title;
    const OriginIcon = e.method === 'manual' ? UserCheck : e.method === 'semantic' ? Sparkles : Tag;
    return (
      <article className={`edge-card iq-edge is-${e.status} is-${e.method}`} key={e.id}>
        <div className="row">
          <span className="status-label">{e.status}</span>
          <span className="fine-print">
            {e.method === 'semantic'
              ? `Cosine ${e.confidence.toFixed(3)}`
              : `${Math.round(e.confidence * 100)}% confidence`}
          </span>
        </div>
        <button className="text-button link-title" onClick={() => onNavigate(other)}>
          {title}
          <ArrowUpRight size={14} aria-hidden />
        </button>
        <strong>{e.relationship}</strong>
        <p>{e.evidence}</p>
        <span className="iq-origin">
          <OriginIcon size={11} aria-hidden />
          {connectionOrigin(e)}
        </span>
        {e.semantic_evidence && (
          <div className="semantic-evidence">
            <p className="fine-print">
              Embedding similarity {e.semantic_evidence.similarity.toFixed(3)} ·{' '}
              {e.semantic_evidence.model}.{' '}
              {e.semantic_evidence.stale
                ? 'Source changed since this comparison; inspect the historical evidence.'
                : 'This is an inferred association, not an explicit tag or a truth assessment.'}
            </p>
            {e.semantic_evidence.passages.map((p) => (
              <button
                className="text-button"
                key={p.chunkId}
                onClick={() => onNavigate(p.memoryId, p.version, p.chunkId)}
              >
                Source v{p.version}: {p.quote.slice(0, 65)}
                {p.quote.length > 65 ? '…' : ''}
                <ArrowUpRight size={12} aria-hidden />
              </button>
            ))}
          </div>
        )}
        <div className="row">
          {e.status === 'candidate' && (
            <button className="button small" onClick={() => onDecide(e.id, 'confirmed')}>
              <Check size={13} aria-hidden />
              Confirm link
            </button>
          )}
          <button className="text-button" onClick={() => onDecide(e.id, 'dismissed')}>
            {e.status === 'candidate' ? 'Dismiss' : 'Disconnect'}
          </button>
        </div>
      </article>
    );
  };
  const section = (id: string, title: string, note: string, edges: Edge[], empty: string) => (
    <section className="iq-links" aria-labelledby={`links-${id}`}>
      <h3 id={`links-${id}`}>
        {title} <span>{edges.length}</span>
      </h3>
      <p className="fine-print">{note}</p>
      {edges.length ? edges.map(card) : <p className="iq-links-empty">{empty}</p>}
    </section>
  );
  return (
    <>
      <p className="fine-print">
        Every link has evidence. Candidate links remain invisible in the brain until confirmed.
        Confidence is not proof.
      </p>
      {memory.edges.length === 0 ? (
        <div className="quiet-empty">
          <Link2 size={24} aria-hidden />
          <p>No connections yet.</p>
          <span>
            Add a connection with an explanation, or import notes with shared explicit tags and
            links.
          </span>
        </div>
      ) : (
        <>
          {section(
            'confirmed',
            'Confirmed by you',
            'Links you created or approved. Only these are drawn in the brain.',
            groups.confirmed,
            'You have not confirmed any link for this memory.',
          )}
          {section(
            'explicit',
            'Suggested from explicit tags and references',
            'ECHO found a shared tag, title or reference. Not yet confirmed by you.',
            groups.suggestedExplicit,
            'No suggestion from explicit tags or references is waiting.',
          )}
          {section(
            'inferred',
            'Inferred from meaning',
            'ECHO compared passage embeddings. Similar wording is not evidence that two claims are true or related. Not yet confirmed by you.',
            groups.suggestedInferred,
            'No inferred suggestion is waiting. Inferred links appear after an original is processed.',
          )}
        </>
      )}
      <button className="button secondary full" onClick={onConnect}>
        <Plus size={15} aria-hidden />
        Connect another memory
      </button>
    </>
  );
}
