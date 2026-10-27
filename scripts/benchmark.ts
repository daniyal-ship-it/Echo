import { performance } from 'node:perf_hooks';
import { writeFile, mkdir } from 'node:fs/promises';
import { createDatabase } from '../lib/db';
import { getAnatomy } from '../lib/anatomy';
import { getGraph, listMemories, retrieve } from '../lib/memories';
import { uuid } from '../lib/security';
import { REGIONS } from '../lib/types';

async function main() {
  // This database never touches .data/postgres or a configured remote database.
  const db = await createDatabase('memory://');
  const user = uuid(),
    workspace = uuid();
  const results = [];
  try {
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      user,
      'benchmark@example.test',
      'Isolated benchmark',
      'no-login',
    ]);
    await db.query('INSERT INTO workspaces(id,owner_id,name) VALUES($1,$2,$3)', [
      workspace,
      user,
      'Synthetic benchmark',
    ]);
    const anatomy = await getAnatomy();
    const anchors = Array.from({ length: anatomy.count }, (_, i) => ({
      id: i,
      region: REGIONS[Math.max(0, anatomy.regions[i] - 1)],
      position: Array.from(anatomy.positions.slice(i * 3, i * 3 + 3)),
    }));
    await db.exec(
      'CREATE TEMP TABLE benchmark_anchors(id integer PRIMARY KEY,region text,position jsonb)',
    );
    await db.query(
      'INSERT INTO benchmark_anchors SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id integer,region text,position jsonb)',
      [JSON.stringify(anchors)],
    );
    let previous = 0;
    for (const count of [100, 1000, 10000, 100000]) {
      const start = performance.now();
      await db.transaction(async (tx) => {
        await tx.query(
          "INSERT INTO data_sources(id,workspace_id,provider,source_key) SELECT md5('source-'||g)::uuid,$1,'benchmark',g::text FROM generate_series($2::int,$3::int) g",
          [workspace, previous + 1, count],
        );
        await tx.query(
          `INSERT INTO memory_nodes(id,workspace_id,source_id,title,summary,content,source,kind,region,tags,position,anchor,is_demo)
          SELECT md5('memory-'||g)::uuid,$1,md5('source-'||g)::uuid,'Benchmark memory '||g,'Synthetic performance fixture','Synthetic benchmark holographic research record '||g,'benchmark','note',a.region,ARRAY['benchmark'],a.position,g,true
          FROM generate_series($2::int,$3::int) g JOIN benchmark_anchors a ON a.id=(g-1)%$4`,
          [workspace, previous + 1, count, anatomy.count],
        );
      });
      const insertedMs = performance.now() - start;
      await db.exec('ANALYZE memory_nodes');
      const graphStart = performance.now();
      const graph = await getGraph(db, workspace);
      const graphMs = performance.now() - graphStart;
      const searchStart = performance.now();
      const citations = await retrieve(db, workspace, 'holographic research');
      const searchMs = performance.now() - searchStart;
      const listStart = performance.now();
      const library = await listMemories(db, workspace, new URLSearchParams());
      const listMs = performance.now() - listStart;
      if (
        graph.total !== count ||
        graph.nodes.length > 1500 ||
        graph.nodes.reduce((sum, n) => sum + n.count, 0) !== count ||
        library.memories.length !== 50 ||
        citations.length !== 6
      )
        throw new Error('Benchmark correctness failed');
      const row = {
        records: count,
        insertBatchMs: Math.round(insertedMs),
        graphMs: Math.round(graphMs),
        returnedNodes: graph.nodes.length,
        aggregated: graph.aggregated,
        searchMs: Math.round(searchMs),
        libraryMs: Math.round(listMs),
        graphBytes: JSON.stringify(graph).length,
      };
      results.push(row);
      console.log(row);
      previous = count;
    }
    await mkdir('docs/validation', { recursive: true });
    await writeFile(
      'docs/validation/benchmark.json',
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          runtime: process.version,
          storage: 'PGlite in-memory isolated synthetic fixtures',
          limitations:
            'Server data-path benchmark only. No hardware GPU FPS claim. Records are not retained in any user workspace.',
          results,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
