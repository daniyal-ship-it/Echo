import type { Database } from './db';
import { HttpError } from './security';
import { REGIONS, type Edge, type GraphNode } from './types';
import { TOPICS_PER_PAGE } from './exploration-constants';

/** One predicate keeps the library, visual graph and topic counts consistent. */
export function memoryFilter(workspace: string, filters: URLSearchParams) {
  const region = filters.get('region') || '';
  if (region && !REGIONS.includes(region as (typeof REGIONS)[number]))
    throw new HttpError(400, 'Unknown anatomical region.');
  const from = filters.get('from') || '',
    to = filters.get('to') || '';
  for (const date of [from, to]) {
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw new HttpError(400, 'Use valid ISO dates for date filters.');
  }
  return {
    args: [
      workspace,
      region,
      (filters.get('q') || '').slice(0, 500),
      filters.get('source') || '',
      filters.get('tag') || '',
      from,
      to,
      filters.get('untagged') === '1',
    ],
    where: `workspace_id=$1 AND ($2='' OR region=$2)
      AND ($3='' OR search_vector @@ websearch_to_tsquery('english',$3) OR title ILIKE '%' || $3 || '%')
      AND ($4='' OR source=$4) AND ($5='' OR $5=ANY(tags))
      AND ($6='' OR coalesce(source_at,created_at)>=nullif($6,'')::date)
      AND ($7='' OR coalesce(source_at,created_at)<nullif($7,'')::date+interval '1 day')
      AND (NOT $8::boolean OR cardinality(tags)=0)`,
  };
}

/** Clusters are traceable to explicit tags. They do not claim semantic inference. */
export async function topicNodes(db: Database, workspace: string, filters: URLSearchParams) {
  const region = filters.get('region');
  if (!region) throw new HttpError(400, 'Choose a lobe to explore its topics.');
  const { where, args } = memoryFilter(workspace, filters);
  const inputPage = Number(filters.get('topicPage')) || 0;
  const page = Math.max(0, Math.min(100000, Math.floor(inputPage)));
  const term = (filters.get('topicQ') || '').slice(0, 80).trim();
  const cte = `WITH scoped AS (SELECT * FROM memory_nodes WHERE ${where}),
    members AS (
      SELECT m.id,m.region,m.position,m.is_demo,t.tag FROM scoped m
      CROSS JOIN LATERAL (SELECT DISTINCT unnest(m.tags) AS tag) t
      UNION ALL
      SELECT id,region,position,is_demo,NULL::text FROM scoped WHERE cardinality(tags)=0
    ), topics AS (
      SELECT tag,region,count(*)::int AS count,bool_and(is_demo) AS is_demo,
        jsonb_build_array(avg((position->>0)::real),avg((position->>1)::real),avg((position->>2)::real)) AS position
      FROM members WHERE $9='' OR strpos(lower(coalesce(tag,'Untagged memories')),lower($9))>0
      GROUP BY tag,region
    )`;
  const [{ total }] = await db.query<{ total: number }>(
    `${cte} SELECT count(*)::int AS total FROM topics`,
    [...args, term],
  );
  const safePage = Math.min(page, Math.max(0, Math.ceil(total / TOPICS_PER_PAGE) - 1));
  const nodes = await db.query<GraphNode>(
    `${cte}
    SELECT CASE WHEN tag IS NULL THEN 'topic:untagged' ELSE 'topic:tag:'||tag END AS id,
      CASE WHEN tag IS NULL THEN 'Untagged memories' ELSE '#'||tag END AS title,
      tag AS topic, 'topic' AS kind, region, count, is_demo, position
    FROM topics ORDER BY count DESC,tag ASC NULLS LAST LIMIT $10 OFFSET $11`,
    [...args, term, TOPICS_PER_PAGE, safePage * TOPICS_PER_PAGE],
  );
  return { nodes, topicTotal: total, topicPage: safePage };
}

/** Source selection always has a real glyph, even outside the current filters. */
export async function memoryNeighborhood(db: Database, workspace: string, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw new HttpError(400, 'Invalid memory identifier.');
  const own = await db.query<GraphNode>(
    "SELECT id,title,region,position,1 AS count,is_demo,'memory' AS kind FROM memory_nodes WHERE workspace_id=$1 AND id=$2",
    [workspace, id],
  );
  if (!own.length) throw new HttpError(404, 'Memory not found.');
  const edges = await db.query<Edge>(
    `SELECT * FROM memory_edges WHERE workspace_id=$1 AND status='confirmed'
      AND (source_id=$2 OR target_id=$2) ORDER BY pinned DESC,strength DESC,id LIMIT 100`,
    [workspace, id],
  );
  const ids = [...new Set(edges.flatMap((e) => [e.source_id, e.target_id]))].filter(
    (n) => n !== id,
  );
  const neighbors = ids.length
    ? await db.query<GraphNode>(
        "SELECT id,title,region,position,1 AS count,is_demo,'memory' AS kind FROM memory_nodes WHERE workspace_id=$1 AND id=ANY($2::uuid[]) ORDER BY id",
        [workspace, ids],
      )
    : [];
  return { nodes: [...own, ...neighbors], edges };
}
