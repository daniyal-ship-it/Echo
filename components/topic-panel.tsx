'use client';
import { ArrowLeft, ArrowRight, Layers, Search } from 'lucide-react';
import { REGION_INFO, type Graph, type GraphNode, type Region } from '@/lib/types';
import { TOPICS_PER_PAGE } from '@/lib/exploration-constants';

type Props = {
  graph: Graph;
  region: Region;
  query: string;
  loading: boolean;
  error: string;
  onQuery: (value: string) => void;
  onPage: (page: number) => void;
  onSelect: (node: GraphNode) => void;
  onRetry: () => void;
};

export default function TopicPanel({
  graph,
  region,
  query,
  loading,
  error,
  onQuery,
  onPage,
  onSelect,
  onRetry,
}: Props) {
  const page = graph.topicPage || 0;
  const total = graph.topicTotal || 0;
  return (
    <section className="topic-panel" aria-label="Topic and project clusters" aria-busy={loading}>
      <div className="inspector-heading">
        <span className="eyebrow">EXPLORE / {REGION_INFO[region].name.toUpperCase()}</span>
        <Layers size={16} />
      </div>
      <div className="topic-intro">
        <span className="step-label">02 / LOBE → TOPIC</span>
        <h2>Find a thread.</h2>
        <p>
          Explore topics and projects named by tags in your originals. A memory can belong to
          several groups.
        </p>
        <label className="topic-search">
          <Search size={14} />
          <input
            aria-label="Find a topic or project"
            placeholder="Find a tag…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
        <p className="fine-print">
          Rings group stored records. Small scaffold points trace anatomy. Groups are based on
          explicit tags, not AI inference.
        </p>
      </div>
      <div className="topic-list">
        {error ? (
          <div role="alert" className="quiet-empty">
            <p>{error}</p>
            <button className="button secondary" onClick={onRetry}>
              Retry topic loading
            </button>
          </div>
        ) : loading ? (
          <p role="status" className="fine-print">
            Loading your topics…
          </p>
        ) : (
          graph.nodes.map((node) => (
            <button
              key={node.id}
              className="topic-card"
              onClick={() => onSelect(node)}
              aria-label={`Explore ${node.title}, ${node.count} ${node.count === 1 ? 'memory' : 'memories'}`}
            >
              <span
                className="topic-ring"
                style={{ borderColor: REGION_INFO[node.region].color }}
              />
              <span>
                <strong>{node.title}</strong>
                <small>
                  {node.topic === null
                    ? 'No explicit tags yet'
                    : `Shared tag in ${node.count === 1 ? 'an original' : 'the originals'}`}
                </small>
              </span>
              <span className="topic-count">{node.count}</span>
            </button>
          ))
        )}
        {!loading && !error && !graph.nodes.length && (
          <div className="quiet-empty">
            <p>{query ? 'No matching topics.' : 'No memories in this view yet.'}</p>
            <span>
              Import conversations or add notes. Tags such as #project-name make an explicit group;
              untagged records remain accessible.
            </span>
          </div>
        )}
      </div>
      {!error && total > TOPICS_PER_PAGE && (
        <div className="topic-pagination">
          <button
            className="icon-button"
            aria-label="Previous topics"
            disabled={loading || page === 0}
            onClick={() => onPage(page - 1)}
          >
            <ArrowLeft size={16} />
          </button>
          <span>
            {page * TOPICS_PER_PAGE + 1}–{Math.min((page + 1) * TOPICS_PER_PAGE, total)} / {total}{' '}
            groups
          </span>
          <button
            className="icon-button"
            aria-label="Next topics"
            disabled={loading || (page + 1) * TOPICS_PER_PAGE >= total}
            onClick={() => onPage(page + 1)}
          >
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
