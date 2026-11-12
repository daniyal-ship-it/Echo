import type { Database } from './db';
import { memoryFilter } from './exploration';
import type { Citation, Message } from './types';
import { getPassage } from './chunks';
import {
  embedTexts,
  embeddingStatus,
  verifyProviderModel,
  ProviderFailure,
  validateEmbeddingResult,
} from './providers';
import { hash, HttpError, uuid } from './security';
const STOP = new Set(
  'find show where when what which how did does do the a an we i my me about first discussed please conversation conversations everything related to and or of in on is was were that it have has who'.split(
    ' ',
  ),
);
function terms(question: string) {
  return [...new Set(question.toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) || [])]
    .filter((w) => !STOP.has(w))
    .slice(0, 20)
    .join(' | ');
}
export async function assertCitationAccess(db: Database, workspace: string, citations: Citation[]) {
  for (const citation of citations) {
    const [source] = await db.query<{
      version: number;
      content: string;
      messages: Message[];
      title: string;
      source: string;
      region: string;
    }>(
      `SELECT m.version,m.title,m.source,m.region,v.content,v.messages FROM memory_nodes m
       JOIN memory_versions v ON v.memory_id=m.id AND v.workspace_id=m.workspace_id AND v.version=coalesce($3,m.version)
       WHERE m.workspace_id=$1 AND m.id=$2`,
      [workspace, citation.id, citation.version ?? null],
    );
    if (!source) throw new HttpError(409, 'A cited original is no longer available. Search again.');
    if (citation.version !== undefined && source.version !== citation.version)
      throw new HttpError(409, 'A cited original changed. Search again before sending context.');
    if (
      !citation.excerpt ||
      citation.title !== source.title ||
      citation.source !== source.source ||
      citation.region !== source.region ||
      (citation.brainNodeId !== undefined && citation.brainNodeId !== citation.id)
    )
      throw new HttpError(409, 'Citation identity does not match its original.');
    if (citation.chunkId) {
      const chunk = await getPassage(db, workspace, citation.id, citation.chunkId);
      if (
        !chunk.active ||
        chunk.source_version !== citation.version ||
        chunk.content !== citation.excerpt ||
        (citation.messageId !== undefined && citation.messageId !== chunk.message_id) ||
        (citation.messageIndex !== undefined && citation.messageIndex !== chunk.message_index) ||
        (citation.speakerRole !== undefined && citation.speakerRole !== chunk.role) ||
        (citation.timestamp !== undefined &&
          String(citation.timestamp) !== String(chunk.source_timestamp)) ||
        (citation.startOffset !== undefined && citation.startOffset !== chunk.start_offset) ||
        (citation.endOffset !== undefined && citation.endOffset !== chunk.end_offset)
      )
        throw new HttpError(409, 'A citation does not match its original passage.');
    } else {
      // Unindexed fallback excerpts are evidence too, never arbitrary client text.
      const start = citation.startOffset ?? source.content.indexOf(citation.excerpt);
      const end = citation.endOffset ?? start + citation.excerpt.length;
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end !== start + citation.excerpt.length ||
        source.content.slice(start, end) !== citation.excerpt
      )
        throw new HttpError(409, 'A citation excerpt does not match its immutable original.');
    }
    if (citation.contentHash !== undefined && citation.contentHash !== hash(citation.excerpt))
      throw new HttpError(409, 'Citation content hash does not match its evidence.');
  }
}
type QueryEmbedder = (
  texts: string[],
  model: string,
  operation: string,
) => Promise<Awaited<ReturnType<typeof embedTexts>>>;
async function queryVector(
  db: Database,
  workspace: string,
  question: string,
  model: string,
  embed: QueryEmbedder,
) {
  const digest = hash(question),
    lease = uuid();
  const claim = await db.transaction(async (tx) => {
    await tx.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [workspace]);
    const [existing] = await tx.query<{ status: string; embedding: string; lease_until: string }>(
      'SELECT status,embedding::text,lease_until FROM query_embeddings WHERE workspace_id=$1 AND query_hash=$2 AND model=$3',
      [workspace, digest, model],
    );
    if (existing?.status === 'completed') return JSON.parse(existing.embedding) as number[];
    if (existing)
      throw new HttpError(
        409,
        existing.status === 'running' && new Date(existing.lease_until).getTime() > Date.now()
          ? 'This semantic question is already being processed. Wait and submit it again.'
          : 'The prior query embedding outcome is unknown. Use keyword retrieval; it will not be charged again automatically.',
      );
    await tx.query(
      "INSERT INTO query_embeddings(workspace_id,query_hash,model,status,lease_token,lease_until) VALUES($1,$2,$3,'running',$4,now()+interval '90 seconds')",
      [workspace, digest, model, lease],
    );
    return null;
  });
  if (claim) return claim;
  try {
    const result = await embed([question], model, lease);
    validateEmbeddingResult(result, 1, model);
    await db.query(
      "UPDATE query_embeddings SET status='completed',embedding=$4::vector,tokens=$5 WHERE workspace_id=$1 AND query_hash=$2 AND model=$3 AND lease_token=$6",
      [workspace, digest, model, JSON.stringify(result.vectors[0]), result.tokens, lease],
    );
    return result.vectors[0];
  } catch (error) {
    // Explicit rejection (429) may be retried; uncertain sends must never auto-repeat.
    if (error instanceof ProviderFailure && error.retryable && !error.uncertain) {
      await db.query(
        'DELETE FROM query_embeddings WHERE workspace_id=$1 AND query_hash=$2 AND model=$3 AND lease_token=$4',
        [workspace, digest, model, lease],
      );
      throw error;
    }
    await db.query(
      "UPDATE query_embeddings SET status='uncertain' WHERE workspace_id=$1 AND query_hash=$2 AND model=$3 AND lease_token=$4",
      [workspace, digest, model, lease],
    );
    throw error;
  }
}
export async function hybridRetrieve(
  db: Database,
  workspace: string,
  question: string,
  filters = new URLSearchParams(),
  semantic = false,
  embed: QueryEmbedder = embedTexts,
) {
  question = question.trim();
  if (question.length < 2) throw new HttpError(400, 'Enter a nonempty question.');
  if (question.length > 2000) throw new HttpError(400, 'Question is too long.');
  const { where, args } = memoryFilter(workspace, filters),
    query = terms(question);
  const columns = `m.id,m.title,m.source,m.region,c.content AS excerpt,c.source_version AS version,c.id AS "chunkId",c.message_id AS "messageId",c.source_timestamp AS timestamp,c.start_offset AS "startOffset",c.end_offset AS "endOffset",c.message_index AS "messageIndex",c.role AS "speakerRole",c.content_hash AS "contentHash"`;
  const lexical = query
    ? await db.query<Citation>(
        `WITH scoped AS (SELECT * FROM memory_nodes WHERE ${where})
 SELECT ${columns},ts_rank_cd(c.search_vector,to_tsquery('english',$9)) AS rank
 FROM memory_chunks c JOIN scoped m ON m.id=c.memory_id AND m.workspace_id=c.workspace_id AND m.version=c.source_version
 WHERE c.active AND c.search_vector @@ to_tsquery('english',$9) ORDER BY rank DESC,c.id LIMIT 40`,
        [...args, query],
      )
    : [];
  const fallback = query
    ? await db.query<Citation>(
        `WITH scoped AS (SELECT * FROM memory_nodes WHERE ${where}) SELECT id,title,source,region,content AS excerpt,version,ts_rank_cd(search_vector,to_tsquery('english',$9)) AS rank FROM scoped m WHERE search_vector @@ to_tsquery('english',$9) AND NOT EXISTS(SELECT 1 FROM memory_chunks c WHERE c.workspace_id=m.workspace_id AND c.memory_id=m.id AND c.source_version=m.version AND c.active) ORDER BY rank DESC,id LIMIT 20`,
        [...args, query],
      )
    : [];
  for (const citation of fallback) {
    const locations = query
      .split(' | ')
      .map((word) => citation.excerpt.toLowerCase().indexOf(word))
      .filter((index) => index >= 0);
    const start = locations.length ? Math.max(0, Math.min(...locations) - 150) : 0;
    citation.excerpt = citation.excerpt.slice(start, start + 1600);
    citation.startOffset = start;
    citation.endOffset = start + citation.excerpt.length;
    citation.contentHash = hash(citation.excerpt);
  }
  const keywords = [...lexical, ...fallback].sort((a, b) => b.rank - a.rank);
  const config = embeddingStatus();
  let vectors: Citation[] = [],
    usedSemantic = false;
  if (semantic) {
    // Only seek account access/send a query when this workspace and filter have eligible current entries.
    const [{ count }] = await db.query<{ count: number }>(
      `WITH scoped AS (SELECT * FROM memory_nodes WHERE ${where}) SELECT count(*)::int AS count FROM memory_chunks c JOIN scoped m ON m.id=c.memory_id AND m.workspace_id=c.workspace_id AND m.version=c.source_version JOIN chunk_embeddings i ON i.chunk_id=c.id AND i.workspace_id=c.workspace_id JOIN embedding_cache e ON e.id=i.cache_id AND e.workspace_id=c.workspace_id AND e.memory_id=c.memory_id AND e.content_hash=c.content_hash AND e.dimensions=1536 WHERE c.active AND e.model=$9`,
      [...args, config.model],
    );
    if (count) {
      if (embed === embedTexts) await verifyProviderModel('openai', config.model);
      const embedding = await queryVector(db, workspace, question, config.model, embed);
      vectors = await db.query<Citation>(
        `WITH scoped AS (SELECT * FROM memory_nodes WHERE ${where}) SELECT ${columns},1-(e.embedding <=> $10::vector) AS similarity,0::real AS rank
    FROM memory_chunks c JOIN scoped m ON m.id=c.memory_id AND m.workspace_id=c.workspace_id AND m.version=c.source_version JOIN chunk_embeddings i ON i.chunk_id=c.id AND i.workspace_id=c.workspace_id JOIN embedding_cache e ON e.id=i.cache_id AND e.workspace_id=c.workspace_id AND e.memory_id=c.memory_id AND e.content_hash=c.content_hash AND e.dimensions=1536
    WHERE c.active AND e.model=$9 AND 1-(e.embedding <=> $10::vector)>=0.45 ORDER BY e.embedding <=> $10::vector,c.id LIMIT 40`,
        [...args, config.model, JSON.stringify(embedding)],
      );
      usedSemantic = true;
    }
  }
  const merged = new Map<string, Citation>();
  for (const [list, kind] of [
    [keywords, 'keyword'],
    [vectors, 'semantic'],
  ] as const)
    list.forEach((c, index) => {
      const key = c.chunkId || c.id,
        previous = merged.get(key);
      merged.set(key, {
        ...previous,
        ...c,
        rank: (previous?.rank || 0) + 1 / (60 + index + 1),
        keywordRank: kind === 'keyword' ? index + 1 : previous?.keywordRank,
        similarity: kind === 'semantic' ? Number(c.similarity) : previous?.similarity,
      });
    });
  const citations = diversifyCitations([...merged.values()]);
  for (const citation of citations) citation.brainNodeId = citation.id;
  await assertCitationAccess(db, workspace, citations);
  return {
    mode: usedSemantic ? 'hybrid-retrieval' : 'keyword-retrieval',
    citations,
    semanticAvailable: usedSemantic,
    evidence: {
      status: citations.length ? ('retrieved' as const) : ('insufficient' as const),
      keywordCandidates: keywords.length,
      semanticCandidates: vectors.length,
      distinctMemories: new Set(citations.map((c) => c.id)).size,
      // A ranking score/similarity is not a confidence that an answer is true.
      entailsAnswer: false as const,
    },
  };
}

/** Cover distinct originals before spending the remaining context on second passages. */
export function diversifyCitations(candidates: Citation[], limit = 6): Citation[] {
  const ordered = [...candidates].sort(
    (a, b) =>
      b.rank - a.rank ||
      a.id.localeCompare(b.id) ||
      (a.chunkId || '').localeCompare(b.chunkId || ''),
  );
  const first: Citation[] = [],
    extra: Citation[] = [];
  const memories = new Set<string>(),
    seen = new Set<string>();
  for (const c of ordered) {
    const key = `${c.id}:${c.version}:${hash(c.excerpt)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!memories.has(c.id)) {
      memories.add(c.id);
      first.push(c);
    } else if (!extra.some((e) => e.id === c.id)) extra.push(c);
  }
  return [...first, ...extra].slice(0, limit);
}
