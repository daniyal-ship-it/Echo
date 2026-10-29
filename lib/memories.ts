import type { Database } from './db';
import { audit, hash, HttpError, uuid } from './security';
import { placeMemory } from './anatomy';
import { memoryFilter, memoryNeighborhood, topicNodes } from './exploration';
import type {
  Citation,
  Edge,
  Graph,
  GraphNode,
  ImportItem,
  Job,
  Memory,
  MemoryDetail,
  Region,
} from './types';

export function summarise(content: string) {
  const clean = content.replace(/\s+/g, ' ').trim();
  return clean.length <= 280 ? clean : `${clean.slice(0, 277)}…`;
}
export function classify(item: ImportItem): Region {
  if (item.region) return item.region;
  const title = item.title.toLowerCase();
  if (/plan|decision|goal|strategy|roadmap/.test(title)) return 'frontal';
  if (/image|visual|design|sketch|photo/.test(title)) return 'occipital';
  return item.kind === 'conversation' ? 'temporal' : 'parietal';
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export async function storeMemory(
  db: Database,
  workspace: string,
  item: ImportItem,
  demo = false,
): Promise<{ id: string; duplicate: boolean; version: number }> {
  // Call in a transaction. Workspace row serialises allocation/imports across workers.
  await db.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [workspace]);
  const sourceId = uuid();
  const sources = await db.query<{ id: string }>(
    'INSERT INTO data_sources(id,workspace_id,provider,source_key) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,provider,source_key) DO UPDATE SET source_key=excluded.source_key RETURNING id',
    [sourceId, workspace, item.source, item.sourceId],
  );
  const existing = await db.query<Memory>(
    'SELECT * FROM memory_nodes WHERE workspace_id=$1 AND source_id=$2',
    [workspace, sources[0].id],
  );
  const fingerprint = hash(canonical(item.raw));
  if (existing[0]) {
    const duplicate = await db.query(
      'SELECT id FROM memory_versions WHERE memory_id=$1 AND fingerprint=$2',
      [existing[0].id, fingerprint],
    );
    if (duplicate.length)
      return { id: existing[0].id, duplicate: true, version: existing[0].version };
  }
  const id = existing[0]?.id ?? uuid();
  const version = (existing[0]?.version ?? 0) + 1;
  const region = existing[0]?.region ?? classify(item);
  const occupied = new Set(
    (
      await db.query<{ anchor: number }>('SELECT anchor FROM memory_nodes WHERE workspace_id=$1', [
        workspace,
      ])
    ).map((m) => m.anchor),
  );
  const location = existing[0]
    ? { anchor: existing[0].anchor, position: existing[0].position }
    : await placeMemory(`${workspace}:${item.source}:${item.sourceId}`, region, occupied);
  await db.query(
    `INSERT INTO memory_nodes(id,workspace_id,source_id,title,summary,content,source,kind,region,tags,position,anchor,version,source_at,is_demo)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,summary=excluded.summary,content=excluded.content,tags=excluded.tags,version=excluded.version,indexing_status='keyword'`,
    [
      id,
      workspace,
      sources[0].id,
      item.title,
      summarise(item.content),
      item.content,
      item.source,
      item.kind,
      region,
      item.tags,
      JSON.stringify(location.position),
      location.anchor,
      version,
      item.sourceAt,
      demo,
    ],
  );
  await db.query(
    'INSERT INTO memory_versions(id,workspace_id,memory_id,version,fingerprint,raw,content,messages) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [
      uuid(),
      workspace,
      id,
      version,
      fingerprint,
      JSON.stringify(item.raw),
      item.content,
      JSON.stringify(item.messages),
    ],
  );
  await db.query('DELETE FROM embeddings WHERE memory_id=$1', [id]);
  await audit(db, workspace, existing[0] ? 'memory.version_created' : 'memory.created', id);
  return { id, duplicate: false, version };
}

export async function discoverEdges(db: Database, workspace: string, id: string) {
  const own = await db.query<Memory & { content: string }>(
    'SELECT * FROM memory_nodes WHERE id=$1 AND workspace_id=$2',
    [id, workspace],
  );
  if (!own[0]) return;
  const links = Array.from(own[0].content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g), (m) =>
    m[1].toLowerCase(),
  );
  const matches = await db.query<Memory>(
    'SELECT * FROM memory_nodes WHERE workspace_id=$1 AND id<>$2 AND (tags && $3::text[] OR lower(title)=ANY($4::text[])) LIMIT 50',
    [workspace, id, own[0].tags, links],
  );
  for (const match of matches) {
    const common = own[0].tags.filter((t) => match.tags.includes(t));
    const explicit = links.includes(match.title.toLowerCase());
    if (!explicit && common.length < 2) continue;
    const [source, target] = [id, match.id].sort();
    const evidence = explicit
      ? `Original note explicitly references [[${match.title}]].`
      : `Both originals contain the explicit tags ${common.map((t) => `#${t}`).join(', ')}. Candidate association; not proof of a factual connection.`;
    await db.query(
      `INSERT INTO memory_edges(id,workspace_id,source_id,target_id,relationship,evidence,confidence,method,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'candidate') ON CONFLICT(workspace_id,source_id,target_id) DO NOTHING`,
      [
        uuid(),
        workspace,
        source,
        target,
        explicit ? 'references' : 'shared tags',
        evidence,
        explicit ? 0.95 : 0.55,
        explicit ? 'explicit-reference' : 'shared-tags',
      ],
    );
  }
}

export async function listMemories(db: Database, workspace: string, params: URLSearchParams) {
  const { where, args } = memoryFilter(workspace, params);
  const page = Math.max(0, Math.min(20000, Math.floor(Number(params.get('page')) || 0)));
  const rows = await db.query<Memory>(
    `SELECT id,title,summary,region,source,kind,tags,created_at,source_at,importance,position,anchor,version,is_demo,indexing_status FROM memory_nodes WHERE ${where} ORDER BY created_at DESC,id LIMIT 50 OFFSET $9`,
    [...args, page * 50],
  );
  const count = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM memory_nodes WHERE ${where}`,
    args,
  );
  return { memories: rows, total: count[0].total, page };
}
export async function memoryDetail(
  db: Database,
  workspace: string,
  id: string,
  version?: number,
): Promise<MemoryDetail> {
  const rows = await db.query<Memory & { content: string }>(
    'SELECT * FROM memory_nodes WHERE workspace_id=$1 AND id=$2',
    [workspace, id],
  );
  if (!rows.length) throw new HttpError(404, 'Memory not found.');
  const versions = await db.query<{ version: number; created_at: string; fingerprint: string }>(
    'SELECT version,created_at,fingerprint FROM memory_versions WHERE workspace_id=$1 AND memory_id=$2 ORDER BY version DESC',
    [workspace, id],
  );
  const raw = await db.query<{ raw: unknown; messages: MemoryDetail['messages']; content: string }>(
    'SELECT raw,messages,content FROM memory_versions WHERE workspace_id=$1 AND memory_id=$2 AND version=$3',
    [workspace, id, version ?? rows[0].version],
  );
  if (!raw[0]) throw new HttpError(404, 'Version not found.');
  const edges = await db.query<Edge>(
    `SELECT e.*,a.title AS source_title,b.title AS target_title FROM memory_edges e JOIN memory_nodes a ON a.id=e.source_id JOIN memory_nodes b ON b.id=e.target_id WHERE e.workspace_id=$1 AND (e.source_id=$2 OR e.target_id=$2) AND e.status<>'dismissed'`,
    [workspace, id],
  );
  const historical =
    raw[0].raw && typeof raw[0].raw === 'object' ? (raw[0].raw as Record<string, unknown>) : {};
  const title =
    typeof historical.title === 'string'
      ? historical.title
      : typeof historical.name === 'string'
        ? historical.name
        : rows[0].title;
  return {
    ...rows[0],
    ...raw[0],
    title,
    summary: summarise(raw[0].content),
    viewed_version: version ?? rows[0].version,
    versions,
    edges,
  };
}
export async function getGraph(
  db: Database,
  workspace: string,
  region = '',
  filters = new URLSearchParams(),
): Promise<Graph> {
  const counts = await db.query<{ region: string; count: number }>(
    'SELECT region,count(*)::int AS count FROM memory_nodes WHERE workspace_id=$1 GROUP BY region',
    [workspace],
  );
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const scoped = new URLSearchParams(filters);
  scoped.set('region', region);
  const { where, args } = memoryFilter(workspace, scoped);
  const base = { total, counts: Object.fromEntries(counts.map((c) => [c.region, c.count])) };
  if (filters.get('focus')) {
    const focused = await memoryNeighborhood(db, workspace, filters.get('focus')!);
    return {
      ...base,
      ...focused,
      filteredTotal: focused.nodes.length,
      aggregated: false,
      mode: 'neighborhood',
    };
  }
  const [{ count: filteredTotal }] = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM memory_nodes WHERE ${where}`,
    args,
  );
  if (filters.get('view') === 'topics') {
    const topics = await topicNodes(db, workspace, scoped);
    return { ...base, ...topics, edges: [], filteredTotal, aggregated: true, mode: 'topics' };
  }
  let nodes: GraphNode[] = [];
  const aggregated = filteredTotal > 1500;
  if (aggregated) {
    // Coarsen until every cluster fits the draw budget. Never truncate clusters.
    for (const grid of [5, 4, 3, 2, 1]) {
      nodes = await db.query<GraphNode>(
        `SELECT 'cluster:'||region||':'||floor((position->>0)::real*$9)||':'||floor((position->>1)::real*$9)||':'||floor((position->>2)::real*$9) AS id,
        count(*)::text||' memories' AS title,region,jsonb_build_array(avg((position->>0)::real),avg((position->>1)::real),avg((position->>2)::real)) AS position,count(*)::int AS count,bool_and(is_demo) AS is_demo,'spatial' AS kind
        FROM memory_nodes WHERE ${where} GROUP BY region,floor((position->>0)::real*$9),floor((position->>1)::real*$9),floor((position->>2)::real*$9) ORDER BY count(*) DESC`,
        [...args, grid],
      );
      if (nodes.length <= 1500) break;
    }
  } else {
    nodes = await db.query<GraphNode>(
      `SELECT id,title,region,position,1 AS count,is_demo,'memory' AS kind FROM memory_nodes WHERE ${where} ORDER BY created_at,id LIMIT 1500`,
      args,
    );
  }
  const ids = nodes.map((n) => n.id);
  const edges =
    aggregated || !ids.length
      ? []
      : await db.query<Edge>(
          "SELECT * FROM memory_edges WHERE workspace_id=$1 AND status='confirmed' AND source_id=ANY($2::uuid[]) AND target_id=ANY($2::uuid[]) ORDER BY pinned DESC,strength DESC LIMIT 300",
          [workspace, ids],
        );
  return {
    nodes,
    edges,
    total,
    filteredTotal,
    counts: Object.fromEntries(counts.map((c) => [c.region, c.count])),
    aggregated,
    mode: 'memories',
  };
}
const STOPWORDS = new Set(
  'find show where when what which how did does do the a an we i my me about first discussed please conversation conversations everything related to and or of in on is was were that it have has'.split(
    ' ',
  ),
);
export async function retrieve(
  db: Database,
  workspace: string,
  question: string,
): Promise<Citation[]> {
  const words = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) || [])]
    .filter((w) => !STOPWORDS.has(w))
    .slice(0, 20);
  if (!words.length) return [];
  const query = words.map((w) => `'${w.replace(/'/g, '')}'`).join(' | ');
  const results = await db.query<{
    id: string;
    title: string;
    content: string;
    source: string;
    region: Region;
    rank: number;
  }>(
    `SELECT id,title,content,source,region,ts_rank_cd(search_vector,to_tsquery('english',$2)) AS rank FROM memory_nodes WHERE workspace_id=$1 AND search_vector @@ to_tsquery('english',$2) ORDER BY rank DESC,created_at DESC LIMIT 6`,
    [workspace, query],
  );
  return results.map((m) => {
    const lower = m.content.toLowerCase();
    const first = Math.max(
      0,
      Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0)) - 100,
    );
    const start = Number.isFinite(first) ? first : 0;
    return {
      id: m.id,
      title: m.title,
      source: m.source,
      region: m.region,
      rank: m.rank,
      excerpt: `${start ? '…' : ''}${m.content.slice(start, start + 700)}${m.content.length > start + 700 ? '…' : ''}`,
    };
  });
}
export async function runImportBatch(db: Database, workspace: string, id: string) {
  // Bounded work per call. A process crash rolls back the batch; durable cursor allows retry.
  return db.transaction(async (tx) => {
    const jobs = await tx.query<Job & { items: ImportItem[] }>(
      'SELECT * FROM import_jobs WHERE id=$1 AND workspace_id=$2 FOR UPDATE',
      [id, workspace],
    );
    const job = jobs[0];
    if (!job) throw new HttpError(404, 'Import not found.');
    if (['completed', 'cancelled'].includes(job.status)) return job;
    const batch = job.items.slice(job.processed, job.processed + 15);
    let added = job.added,
      duplicates = job.duplicates;
    for (const item of batch) {
      const result = await storeMemory(tx, workspace, item);
      if (result.duplicate) duplicates++;
      else {
        added++;
        await discoverEdges(tx, workspace, result.id);
      }
    }
    const processed = job.processed + batch.length;
    const rows = await tx.query<Job>(
      `UPDATE import_jobs SET processed=$1,added=$2,duplicates=$3,status=$4,error=NULL,updated_at=now() WHERE id=$5 RETURNING id,filename,status,total,processed,added,duplicates,error,created_at`,
      [processed, added, duplicates, processed >= job.total ? 'completed' : 'running', id],
    );
    return rows[0];
  });
}
