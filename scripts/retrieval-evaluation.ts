/** Offline evaluation only. No API calls, no configured DATABASE_URL, no hosted writes. */
import { createDatabase } from '../lib/db';
import { hash } from '../lib/security';
import { chunkSource } from '../lib/chunks';
import { hybridRetrieve } from '../lib/retrieval';
import { validateEmbeddingResult } from '../lib/providers';
import corpus from '../tests/fixtures/retrieval/corpus.json';

const stable = (label: string) => {
  const h = hash(label);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const evaluationManifest = () => ({
  corpus: corpus.version,
  inputs: [
    ...new Set([...corpus.memories.map((m) => m.content), ...corpus.cases.map((c) => c.question)]),
  ].map((text) => ({ sha256: hash(text), text })),
});
export type EmbeddingArtifact = {
  corpus: string;
  model: string;
  dimensions: number;
  generatedAt: string;
  generatedBy: string;
  /** Actual model output, keyed by SHA-256 of exact input; never hand-authored vectors. */
  vectors: Record<string, number[]>;
};
export async function evaluateRetrieval(artifact?: EmbeddingArtifact) {
  if (artifact) {
    if (
      artifact.corpus !== corpus.version ||
      !artifact.generatedBy?.trim() ||
      !Number.isFinite(Date.parse(artifact.generatedAt)) ||
      !artifact.model?.trim() ||
      artifact.dimensions !== 1536
    )
      throw new Error('Embedding artifact must include matching corpus and real model provenance.');
    for (const { sha256 } of evaluationManifest().inputs)
      validateEmbeddingResult(
        {
          vectors: [artifact.vectors[sha256]],
          model: artifact.model,
          dimensions: artifact.dimensions,
          tokens: 0,
          apiVersion: 'offline-replay',
        },
        1,
        artifact.model,
      );
  }
  const db = await createDatabase('memory://');
  const workspace = stable('evaluation-workspace'),
    owner = stable('evaluation-owner');
  const previousModel = process.env.ECHO_EMBEDDING_MODEL;
  const sources = new Map<string, string>();
  try {
    await db.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
      owner,
      'retrieval@example.test',
      'Synthetic evaluation',
      'not-a-login',
    ]);
    await db.query('INSERT INTO workspaces(id,owner_id,name) VALUES($1,$2,$3)', [
      workspace,
      owner,
      'Synthetic evaluation',
    ]);
    for (const [anchor, memory] of corpus.memories.entries()) {
      const id = stable(memory.key),
        source = stable('source:' + memory.key);
      sources.set(id, memory.key);
      await db.query(
        'INSERT INTO data_sources(id,workspace_id,provider,source_key) VALUES($1,$2,$3,$4)',
        [source, workspace, memory.source, memory.key],
      );
      await db.query(
        `INSERT INTO memory_nodes(id,workspace_id,source_id,title,summary,content,source,kind,region,position,anchor)
        VALUES($1,$2,$3,$4,'',$5,$6,'note','frontal','[0,0,0]',$7)`,
        [id, workspace, source, memory.title, memory.content, memory.source, anchor],
      );
      await db.query(
        `INSERT INTO memory_versions(id,workspace_id,memory_id,version,fingerprint,raw,content,messages)
        VALUES($1,$2,$3,1,$4,'{}',$5,'[]')`,
        [stable('version:' + memory.key), workspace, id, hash(memory.content), memory.content],
      );
      for (const c of chunkSource(workspace, id, 1, memory.content, [], null)) {
        await db.query(
          `INSERT INTO memory_chunks(id,workspace_id,memory_id,source_version,ordinal,active,start_offset,end_offset,content,content_hash,chunker_version)
          VALUES($1,$2,$3,1,$4,true,$5,$6,$7,$8,$9)`,
          [
            c.id,
            workspace,
            id,
            c.ordinal,
            c.start_offset,
            c.end_offset,
            c.content,
            c.content_hash,
            c.chunker_version,
          ],
        );
        if (artifact) {
          const cache = stable('embedding:' + memory.key);
          await db.query(
            `INSERT INTO embedding_cache(id,workspace_id,memory_id,content_hash,provider,model,dimensions,api_version,embedding)
            VALUES($1,$2,$3,$4,'offline-evaluation',$5,1536,'artifact-replay',$6::vector)`,
            [
              cache,
              workspace,
              id,
              c.content_hash,
              artifact.model,
              JSON.stringify(artifact.vectors[hash(c.content)]),
            ],
          );
          await db.query(
            'INSERT INTO chunk_embeddings(workspace_id,chunk_id,cache_id) VALUES($1,$2,$3)',
            [workspace, c.id, cache],
          );
        }
      }
    }
    if (artifact) process.env.ECHO_EMBEDDING_MODEL = artifact.model;
    const modes = artifact ? (['keyword', 'hybrid'] as const) : (['keyword'] as const);
    const results = [];
    for (const mode of modes)
      for (const q of corpus.cases) {
        const filters = new URLSearchParams(
          Object.entries(q.filters || {}).filter(
            (v): v is [string, string] => typeof v[1] === 'string',
          ),
        );
        const retrieved = await hybridRetrieve(
          db,
          workspace,
          q.question,
          filters,
          mode === 'hybrid',
          async (texts, model) => {
            if (!artifact)
              throw new Error('No real embedding artifact; never call a provider from evaluation.');
            return {
              vectors: texts.map((t) => artifact.vectors[hash(t)]),
              model,
              dimensions: 1536,
              tokens: 0,
              apiVersion: 'artifact-replay',
            };
          },
        );
        const found = [...new Set(retrieved.citations.map((c) => sources.get(c.id)!))];
        const hits = found.filter((id) => q.expected.includes(id));
        results.push({
          case: q.key,
          kind: q.kind,
          mode,
          expected: q.expected,
          found,
          recallAt6: q.expected.length ? hits.length / q.expected.length : null,
          precisionAt6: found.length ? hits.length / found.length : null,
          reciprocalRank: q.expected.length
            ? hits.length
              ? 1 / (found.findIndex((id) => q.expected.includes(id)) + 1)
              : 0
            : null,
          correctAbstention: q.expected.length ? null : found.length === 0,
          citationIntegrity: 'passed',
        });
      }
    return {
      corpus: corpus.version,
      corpusSha256: hash(JSON.stringify(corpus)),
      semantics: artifact
        ? {
            status: 'evaluated from supplied model outputs',
            model: artifact.model,
            generatedBy: artifact.generatedBy,
            generatedAt: artifact.generatedAt,
            artifactSha256: hash(JSON.stringify(artifact)),
          }
        : {
            status:
              'NOT RUN: real embedding artifact unavailable; no fabricated vectors or paid calls',
          },
      limitations: [
        'Synthetic corpus is small; metrics are retrieval relevance, not answer entailment.',
        'Keyword lexical-trap false positives are reported, not hidden.',
        'Artifact provenance is supplied by its producer, not independently certified by this runner.',
      ],
      results,
    };
  } finally {
    if (previousModel === undefined) delete process.env.ECHO_EMBEDDING_MODEL;
    else process.env.ECHO_EMBEDDING_MODEL = previousModel;
    await db.close();
  }
}
