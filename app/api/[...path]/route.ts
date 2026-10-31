import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, type Database } from '@/lib/db';
import { logDatabaseError, newDiagnosticId, type DatabaseStage } from '@/lib/database-diagnostics';
import {
  assertOrigin,
  audit,
  createSession,
  findSession,
  hash,
  hashPassword,
  HttpError,
  rateLimit,
  SESSION_COOKIE,
  uuid,
  verifyPassword,
} from '@/lib/security';
import {
  discoverEdges,
  getGraph,
  listMemories,
  memoryDetail,
  runImportBatch,
  storeMemory,
} from '@/lib/memories';
import { extractTags, parseImport } from '@/lib/importers';
import {
  callProvider,
  embeddingStatus,
  providerStatus,
  verifyProviderModel,
  type ModelOutput,
  type Provider,
} from '@/lib/providers';
import {
  controlIntelligence,
  enqueueIntelligence,
  getIntelligenceJob,
  intelligenceStatus,
  publicJob,
  runIntelligenceStep,
} from '@/lib/intelligence';
import { getPassage, validateAnswerCitations } from '@/lib/chunks';
import { assertCitationAccess, hybridRetrieve } from '@/lib/retrieval';
import { REGIONS, type ImportItem, type Job } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const filtersSchema = z
  .object({
    region: z.string().max(20).optional(),
    source: z.string().max(40).optional(),
    tag: z.string().max(80).optional(),
    from: z.string().max(10).optional(),
    to: z.string().max(10).optional(),
    q: z.string().max(500).optional(),
    untagged: z.string().max(1).optional(),
  })
  .default({});
const filterParams = (value: z.infer<typeof filtersSchema>) =>
  new URLSearchParams(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(200);
const noteSchema = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.string().min(1).max(500000),
  region: z.enum(REGIONS),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),
});
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function bytes(request: Request, max = 1024 * 1024) {
  if (Number(request.headers.get('content-length') || 0) > max)
    throw new HttpError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw new HttpError(413, 'Request is too large.');
    }
    chunks.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
async function body(request: Request) {
  try {
    return JSON.parse(new TextDecoder().decode(await bytes(request)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Invalid JSON body.');
  }
}
function withCookie(response: NextResponse, token: string, request: Request) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: new URL(process.env.APP_ORIGIN || request.url).protocol === 'https:',
    path: '/',
    maxAge: token ? 7 * 24 * 3600 : 0,
  });
  return response;
}
function validId(value: string) {
  return z.uuid().parse(value);
}

async function handleRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  requestId: string,
) {
  let stage: DatabaseStage = 'request';
  try {
    const route = (await context.params).path.join('/');
    const method = request.method;
    if (method !== 'GET') assertOrigin(request);
    const db = await getDb(requestId);
    if (route === 'health' && method === 'GET') {
      stage = 'health.query';
      await db.query('SELECT 1');
      return json({
        ok: true,
        storage: process.env.DATABASE_URL ? 'postgresql' : 'local-postgresql',
      });
    }
    const session = await findSession(db, request.cookies.get(SESSION_COOKIE)?.value);
    if (route === 'auth/status' && method === 'GET') {
      const users = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM users');
      return json({
        user: session,
        canRegister: users[0].count === 0 || process.env.ALLOW_REGISTRATION === 'true',
        firstUser: users[0].count === 0,
      });
    }
    if (route === 'auth/register' && method === 'POST') {
      const input = z
        .object({
          email: emailSchema,
          password: passwordSchema,
          name: z.string().trim().min(1).max(80),
        })
        .parse(await body(request));
      await rateLimit(db, 'registration', 10);
      const passwordHash = await hashPassword(input.password);
      const userId = uuid(),
        workspaceId = uuid();
      await db.transaction(async (tx) => {
        await tx.query('LOCK TABLE users IN EXCLUSIVE MODE');
        const users = await tx.query<{ count: number }>('SELECT count(*)::int AS count FROM users');
        if (users[0].count > 0 && process.env.ALLOW_REGISTRATION !== 'true')
          throw new HttpError(403, 'New registrations are closed on this instance.');
        const exists = await tx.query('SELECT id FROM users WHERE email=$1', [input.email]);
        if (exists.length) throw new HttpError(409, 'An account already exists. Sign in instead.');
        await tx.query('INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)', [
          userId,
          input.email,
          input.name,
          passwordHash,
        ]);
        await tx.query('INSERT INTO workspaces(id,owner_id,name) VALUES($1,$2,$3)', [
          workspaceId,
          userId,
          `${input.name}’s memory`,
        ]);
        await audit(tx, workspaceId, 'account.created', userId);
      });
      const token = await createSession(db, userId);
      return withCookie(json({ user: await findSession(db, token) }, 201), token, request);
    }
    if (route === 'auth/login' && method === 'POST') {
      const input = z
        .object({ email: emailSchema, password: z.string().max(200) })
        .parse(await body(request));
      await rateLimit(db, `login:${input.email}`);
      const users = await db.query<{ id: string; password_hash: string }>(
        'SELECT id,password_hash FROM users WHERE email=$1',
        [input.email],
      );
      // Always perform scrypt, including unknown accounts.
      const encoded = users[0]?.password_hash || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
      const match = await verifyPassword(input.password, encoded);
      if (!users[0] || !match) throw new HttpError(401, 'Email or password is incorrect.');
      const token = await createSession(db, users[0].id);
      return withCookie(json({ user: await findSession(db, token) }), token, request);
    }
    if (!session) throw new HttpError(401, 'Sign in to open your memory workspace.');
    const workspace = session.workspaceId;
    if (route === 'auth/logout' && method === 'POST') {
      await db.query('DELETE FROM sessions WHERE token_hash=$1', [
        hash(request.cookies.get(SESSION_COOKIE)?.value || ''),
      ]);
      return withCookie(json({ ok: true }), '', request);
    }
    if (route === 'settings' && method === 'GET')
      return json({
        providers: providerStatus(),
        storage: process.env.DATABASE_URL
          ? 'Managed PostgreSQL'
          : 'Local PostgreSQL · persistent disk',
        embeddingConfigured: embeddingStatus().configured,
        embedding: embeddingStatus(),
        limits: { uploadMiB: 20, memoriesPerImport: 1000 },
      });
    if (route === 'intelligence' && method === 'GET') {
      const memory = validId(request.nextUrl.searchParams.get('memoryId') || '');
      const version = request.nextUrl.searchParams.has('version')
        ? z.coerce.number().int().positive().parse(request.nextUrl.searchParams.get('version'))
        : undefined;
      return json(await intelligenceStatus(db, workspace, memory, version));
    }
    if (route === 'intelligence' && method === 'POST') {
      const input = z
        .object({
          memoryId: z.uuid(),
          summaryProvider: z.enum(['openai', 'anthropic']).default('openai'),
          consent: z.literal(true),
        })
        .parse(await body(request));
      await rateLimit(db, `intelligence-enqueue:${workspace}`, 20);
      return json(
        publicJob(await enqueueIntelligence(db, workspace, input.memoryId, input.summaryProvider)),
        201,
      );
    }
    const intelligenceMatch = route.match(/^intelligence\/([^/]+)(?:\/(run|control))?$/);
    if (intelligenceMatch) {
      const id = validId(intelligenceMatch[1]);
      if (method === 'GET') return json(publicJob(await getIntelligenceJob(db, workspace, id)));
      if (method === 'POST' && intelligenceMatch[2] === 'run') {
        await rateLimit(db, `intelligence-run:${workspace}`, 120);
        return json(await runIntelligenceStep(db, workspace, id));
      }
      if (method === 'POST' && intelligenceMatch[2] === 'control') {
        const input = z
          .object({
            action: z.enum(['cancel', 'resume', 'retry']),
            acknowledgeCharge: z.boolean().default(false),
          })
          .parse(await body(request));
        return json(
          await controlIntelligence(db, workspace, id, input.action, input.acknowledgeCharge),
        );
      }
    }
    if (route === 'providers/verify' && method === 'POST') {
      await rateLimit(db, `models:${workspace}`, 10);
      const input = z
        .object({ provider: z.enum(['openai', 'anthropic']) })
        .parse(await body(request));
      const configured = providerStatus().find((p) => p.id === input.provider);
      if (!configured?.model) throw new HttpError(503, 'No API model configured in this runtime.');
      return json({
        provider: input.provider,
        model: await verifyProviderModel(input.provider, configured.model),
        accountAccess: true,
        liveAnswerVerified: false,
      });
    }
    if (route === 'memories' && method === 'GET')
      return json(await listMemories(db, workspace, request.nextUrl.searchParams));
    if (route === 'memories' && method === 'POST') {
      const input = noteSchema.parse(await body(request));
      const item: ImportItem = {
        ...input,
        source: 'note',
        sourceId: uuid(),
        raw: input,
        messages: [],
        sourceAt: null,
        kind: 'note',
        tags: [...new Set([...input.tags, ...extractTags(input.content)])],
      };
      const result = await db.transaction(async (tx) => {
        const saved = await storeMemory(tx, workspace, item);
        await discoverEdges(tx, workspace, saved.id);
        return saved;
      });
      return json(await memoryDetail(db, workspace, result.id), 201);
    }
    if (route === 'demo' && method === 'POST') {
      const item: ImportItem = {
        source: 'demo',
        sourceId: 'echo-foundation-v1',
        title: 'A place for an idea',
        content:
          'DEMONSTRATION DATA — created only at your request.\n\nThe Holographic Brain is a personal knowledge workspace. This note is a real, persisted record anchored to an atlas-labelled cortical vertex.\n\nYou can rotate the brain, select this point, inspect this original, and find it again after signing out and back in. Import your own conversations to make the workspace yours.\n\nThe coloured lobes organise software categories. They do not claim that human memories are stored this way.\n\n#echo #architecture',
        raw: {
          label: 'Demonstration data',
          purpose: 'Verify the real memory data layer and interactive node selection.',
        },
        messages: [],
        sourceAt: null,
        kind: 'note',
        tags: ['echo', 'architecture'],
        region: 'frontal',
      };
      item.raw = { ...(item.raw as object), content: item.content };
      const result = await db.transaction((tx) => storeMemory(tx, workspace, item, true));
      return json(await memoryDetail(db, workspace, result.id), 201);
    }
    const memoryMatch = route.match(/^memories\/([^/]+)$/);
    if (memoryMatch) {
      const id = validId(memoryMatch[1]);
      if (method === 'GET') {
        const passage = request.nextUrl.searchParams.has('passage')
          ? await getPassage(
              db,
              workspace,
              id,
              validId(request.nextUrl.searchParams.get('passage')!),
            )
          : undefined;
        const detail = await memoryDetail(
          db,
          workspace,
          id,
          request.nextUrl.searchParams.has('version')
            ? z.coerce.number().int().positive().parse(request.nextUrl.searchParams.get('version'))
            : passage?.source_version,
        );
        if (passage && passage.source_version !== detail.viewed_version)
          throw new HttpError(400, 'Passage does not belong to the requested source version.');
        return json({ ...detail, ...(passage ? { passage } : {}) });
      }
      if (method === 'DELETE') {
        const input = z.object({ confirm: z.literal('DELETE') }).parse(await body(request));
        void input;
        await memoryDetail(db, workspace, id);
        await db.query('DELETE FROM memory_nodes WHERE id=$1 AND workspace_id=$2', [id, workspace]);
        await audit(db, workspace, 'memory.deleted', id);
        return json({
          ok: true,
          notice: 'Original archives remain in import history until that archive is deleted.',
        });
      }
      if (method === 'PUT') {
        const input = noteSchema.parse(await body(request));
        const original = await memoryDetail(db, workspace, id);
        if (original.source !== 'note')
          throw new HttpError(
            400,
            'Imported originals are immutable. Import a newer source version instead.',
          );
        const source = await db.query<{ source_key: string }>(
          'SELECT s.source_key FROM data_sources s JOIN memory_nodes m ON m.source_id=s.id WHERE m.id=$1 AND m.workspace_id=$2',
          [id, workspace],
        );
        const item: ImportItem = {
          ...input,
          source: 'note',
          sourceId: source[0].source_key,
          raw: input,
          messages: [],
          sourceAt: null,
          kind: 'note',
        };
        await db.transaction(async (tx) => {
          await storeMemory(tx, workspace, item);
          await discoverEdges(tx, workspace, id);
        });
        return json(await memoryDetail(db, workspace, id));
      }
    }
    if (route === 'graph' && method === 'GET')
      return json(
        await getGraph(
          db,
          workspace,
          request.nextUrl.searchParams.get('region') || '',
          request.nextUrl.searchParams,
        ),
      );
    if (route === 'edges' && method === 'POST') {
      const input = z
        .object({
          sourceId: z.uuid(),
          targetId: z.uuid(),
          relationship: z.string().trim().min(1).max(80),
          evidence: z.string().trim().min(5).max(2000),
        })
        .parse(await body(request));
      if (input.sourceId === input.targetId)
        throw new HttpError(400, 'Choose two different memories.');
      await memoryDetail(db, workspace, input.sourceId);
      await memoryDetail(db, workspace, input.targetId);
      const [a, b] = [input.sourceId, input.targetId].sort();
      const rows = await db.query(
        `INSERT INTO memory_edges(id,workspace_id,source_id,target_id,relationship,evidence,confidence,method,status,pinned) VALUES($1,$2,$3,$4,$5,$6,1,'manual','confirmed',true) ON CONFLICT(workspace_id,source_id,target_id) DO UPDATE SET relationship=excluded.relationship,evidence=excluded.evidence,method='manual',status='confirmed',pinned=true,validated_at=now() RETURNING *`,
        [uuid(), workspace, a, b, input.relationship, input.evidence],
      );
      await audit(db, workspace, 'edge.created', String(rows[0].id));
      return json(rows[0], 201);
    }
    const edgeMatch = route.match(/^edges\/([^/]+)$/);
    if (edgeMatch && method === 'PATCH') {
      const input = z
        .object({
          status: z.enum(['confirmed', 'dismissed']).optional(),
          pinned: z.boolean().optional(),
        })
        .parse(await body(request));
      const rows = await db.query(
        'UPDATE memory_edges SET status=coalesce($1,status),pinned=coalesce($2,pinned),validated_at=now() WHERE id=$3 AND workspace_id=$4 RETURNING *',
        [input.status ?? null, input.pinned ?? null, validId(edgeMatch[1]), workspace],
      );
      if (!rows.length) throw new HttpError(404, 'Connection not found.');
      await audit(db, workspace, 'edge.updated', edgeMatch[1]);
      return json(rows[0]);
    }
    if (route === 'import' && method === 'POST') {
      await rateLimit(db, `import:${workspace}`, 40);
      const filename = z
        .string()
        .min(1)
        .max(240)
        .parse(request.nextUrl.searchParams.get('filename'));
      const data = await bytes(request, 20 * 1024 * 1024);
      const fingerprint = hash(data);
      const previous = await db.query<Job>(
        'SELECT id,filename,status,total,processed,added,duplicates,error,created_at FROM import_jobs WHERE workspace_id=$1 AND fingerprint=$2',
        [workspace, fingerprint],
      );
      if (previous[0]) return json({ ...previous[0], alreadyImported: true });
      const items = parseImport(filename, data);
      const id = uuid();
      await db.query(
        'INSERT INTO import_jobs(id,workspace_id,filename,fingerprint,items,original,total) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          id,
          workspace,
          filename,
          fingerprint,
          JSON.stringify(items),
          Buffer.from(data),
          items.length,
        ],
      );
      await audit(db, workspace, 'import.created', id);
      return json(
        {
          id,
          filename,
          status: 'queued',
          total: items.length,
          processed: 0,
          added: 0,
          duplicates: 0,
        },
        201,
      );
    }
    if (route === 'jobs' && method === 'GET')
      return json(
        await db.query<Job>(
          'SELECT id,filename,status,total,processed,added,duplicates,error,created_at FROM import_jobs WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 50',
          [workspace],
        ),
      );
    const jobMatch = route.match(/^jobs\/([^/]+)(?:\/(run|cancel|original))?$/);
    if (jobMatch) {
      const id = validId(jobMatch[1]);
      if (method === 'POST' && jobMatch[2] === 'run') {
        try {
          return json(await runImportBatch(db, workspace, id));
        } catch (error) {
          await db.query(
            "UPDATE import_jobs SET status='failed',error=$1 WHERE id=$2 AND workspace_id=$3",
            [
              error instanceof HttpError
                ? error.message
                : 'Processing failed. Retry this job; originals are preserved.',
              id,
              workspace,
            ],
          );
          throw error;
        }
      }
      if (method === 'POST' && jobMatch[2] === 'cancel') {
        const rows = await db.query(
          "UPDATE import_jobs SET status='cancelled',updated_at=now() WHERE id=$1 AND workspace_id=$2 AND status NOT IN ('completed','cancelled') RETURNING id",
          [id, workspace],
        );
        return json({ cancelled: !!rows.length });
      }
      if (method === 'GET' && jobMatch[2] === 'original') {
        const rows = await db.query<{ original: Uint8Array }>(
          'SELECT original FROM import_jobs WHERE id=$1 AND workspace_id=$2',
          [id, workspace],
        );
        if (!rows[0]) throw new HttpError(404, 'Archive not found.');
        await audit(db, workspace, 'archive.downloaded', id);
        return new NextResponse(new Uint8Array(rows[0].original), {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="echo-archive-${id}"`,
            'Cache-Control': 'no-store',
          },
        });
      }
      if (method === 'DELETE' && !jobMatch[2]) {
        z.object({ confirm: z.literal('DELETE') }).parse(await body(request));
        await db.query('DELETE FROM import_jobs WHERE id=$1 AND workspace_id=$2', [id, workspace]);
        await audit(db, workspace, 'archive.deleted', id);
        return json({ ok: true });
      }
    }
    if (route === 'retrieve' && method === 'POST') {
      const input = z
        .object({
          question: z.string().trim().min(2).max(2000),
          mode: z.enum(['keyword', 'hybrid']).default('keyword'),
          consent: z.boolean().default(false),
          filters: filtersSchema,
        })
        .parse(await body(request));
      if (input.mode === 'hybrid' && !input.consent)
        throw new HttpError(
          400,
          'Semantic retrieval needs consent to send your question to the embedding provider.',
        );
      await rateLimit(db, `retrieval:${workspace}`, 60);
      return json(
        await hybridRetrieve(
          db,
          workspace,
          input.question,
          filterParams(input.filters),
          input.mode === 'hybrid',
        ),
      );
    }
    if (route === 'assistant' && method === 'POST') {
      const input = z
        .object({
          question: z.string().trim().min(2).max(2000),
          providers: z
            .array(z.enum(['openai', 'anthropic']))
            .min(1)
            .max(2),
          consent: z.literal(true),
          synthesise: z.boolean().default(false),
          semantic: z.boolean().default(false),
          filters: filtersSchema,
        })
        .parse(await body(request));
      const providers = [...new Set(input.providers)];
      if (providers.some((p) => !providerStatus().find((s) => s.id === p)?.configured))
        throw new HttpError(
          503,
          'Configure the selected provider credentials and model IDs first.',
        );
      await rateLimit(db, `assistant:${workspace}`, 20);
      const budget = await db.query<{ tokens: number }>(
        "SELECT coalesce(sum(tokens),0)::int AS tokens FROM agent_runs WHERE workspace_id=$1 AND created_at>now()-interval '1 day'",
        [workspace],
      );
      if (budget[0].tokens > Number(process.env.DAILY_TOKEN_LIMIT || 100000))
        throw new HttpError(429, 'Daily token budget reached.');
      const retrieval = await hybridRetrieve(
        db,
        workspace,
        input.question,
        filterParams(input.filters),
        input.semantic,
      );
      const citations = retrieval.citations;
      if (!citations.length)
        return json({
          outputs: [],
          citations: [],
          tokens: 0,
          mode: retrieval.mode,
          notice: 'Insufficient retrieved evidence. No answer-provider call was made.',
        });
      const id = uuid();
      await db.query(
        "INSERT INTO agent_runs(id,workspace_id,question,status) VALUES($1,$2,$3,'running')",
        [id, workspace, input.question],
      );
      const outputs: ModelOutput[] = [];
      try {
        // Finite sequence: two independent calls at most, then one optional synthesis.
        for (const provider of providers) {
          await verifyProviderModel(
            provider,
            providerStatus().find((p) => p.id === provider)!.model!,
          );
          await assertCitationAccess(db, workspace, citations);
          const output = await callProvider(provider, input.question, citations, request.signal);
          try {
            validateAnswerCitations(output.text, citations.length);
          } catch (error) {
            outputs.push({
              ...output,
              text: 'Response withheld because source citations were invalid.',
            });
            throw error;
          }
          outputs.push(output);
        }
        if (input.synthesise && outputs.length === 2) {
          await assertCitationAccess(db, workspace, citations);
          const synthesis = await callProvider(
            providers[0] as Provider,
            input.question,
            citations,
            request.signal,
            outputs,
          );
          try {
            validateAnswerCitations(synthesis.text, citations.length);
          } catch (error) {
            outputs.push({
              ...synthesis,
              text: 'Response withheld because source citations were invalid.',
            });
            throw error;
          }
          outputs.push(synthesis);
        }
        await assertCitationAccess(db, workspace, citations);
        const tokens = outputs.reduce((n, o) => n + o.inputTokens + o.outputTokens, 0);
        await db.transaction(async (tx) => {
          await tx.query(
            "UPDATE agent_runs SET status='completed',outputs=$1,tokens=$2 WHERE id=$3",
            [JSON.stringify(outputs), tokens, id],
          );
          for (const citation of citations)
            await tx.query(
              'INSERT INTO retrieval_citations(id,workspace_id,run_id,memory_id,excerpt,version,chunk_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
              [
                uuid(),
                workspace,
                id,
                citation.id,
                citation.excerpt,
                citation.version,
                citation.chunkId || null,
              ],
            );
          const content = `user: ${input.question}\n\n${outputs.map((o) => `${o.provider} (${o.model}): ${o.text}`).join('\n\n')}`;
          await storeMemory(tx, workspace, {
            source: 'assistant',
            sourceId: id,
            title: input.question.slice(0, 200),
            content,
            raw: { question: input.question, outputs, citations },
            messages: [],
            sourceAt: new Date().toISOString(),
            kind: 'conversation',
            region: 'temporal',
            tags: [],
          });
          await audit(tx, workspace, 'provider.context_sent', id);
        });
        return json({ id, outputs, citations, tokens, mode: retrieval.mode });
      } catch (error) {
        await db.query('UPDATE agent_runs SET status=$1,outputs=$2,tokens=$3 WHERE id=$4', [
          request.signal.aborted ? 'cancelled' : 'failed',
          JSON.stringify(outputs),
          outputs.reduce((n, o) => n + o.inputTokens + o.outputTokens, 0),
          id,
        ]);
        throw error;
      }
    }
    if (route === 'export' && method === 'GET') {
      const [
        memories,
        versions,
        edges,
        runs,
        citations,
        sources,
        analyses,
        passages,
        intelligenceJobs,
      ] = await Promise.all([
        db.query('SELECT * FROM memory_nodes WHERE workspace_id=$1', [workspace]),
        db.query('SELECT * FROM memory_versions WHERE workspace_id=$1', [workspace]),
        db.query('SELECT * FROM memory_edges WHERE workspace_id=$1', [workspace]),
        db.query('SELECT * FROM agent_runs WHERE workspace_id=$1', [workspace]),
        db.query('SELECT * FROM retrieval_citations WHERE workspace_id=$1', [workspace]),
        db.query('SELECT * FROM data_sources WHERE workspace_id=$1', [workspace]),
        db.query('SELECT * FROM memory_analyses WHERE workspace_id=$1', [workspace]),
        db.query(
          'SELECT id,memory_id,source_version,ordinal,message_id,message_index,role,source_timestamp,active,start_offset,end_offset,content,chunker_version FROM memory_chunks WHERE workspace_id=$1',
          [workspace],
        ),
        db.query(
          'SELECT id,memory_id,source_version,config,status,total_chunks,embedded,analysed,error,created_at FROM intelligence_jobs WHERE workspace_id=$1',
          [workspace],
        ),
      ]);
      await audit(db, workspace, 'workspace.exported');
      return new NextResponse(
        JSON.stringify(
          {
            format: 'echo-workspace-v1',
            exportedAt: new Date().toISOString(),
            memories,
            versions,
            edges,
            runs,
            citations,
            sources,
            analyses,
            passages,
            intelligenceJobs,
          },
          null,
          2,
        ),
        {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="echo-memories.json"',
            'Cache-Control': 'no-store',
          },
        },
      );
    }
    if (route === 'account' && method === 'DELETE') {
      const input = z
        .object({ confirm: z.literal('DELETE MY WORKSPACE'), password: z.string().max(200) })
        .parse(await body(request));
      await rateLimit(db, `delete:${session.userId}`, 5);
      const rows = await db.query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id=$1',
        [session.userId],
      );
      if (!(await verifyPassword(input.password, rows[0].password_hash)))
        throw new HttpError(401, 'Password is incorrect.');
      await db.transaction(async (tx) => {
        await tx.query('DELETE FROM users WHERE id=$1', [session.userId]);
      });
      return withCookie(json({ ok: true }), '', request);
    }
    throw new HttpError(404, 'Endpoint not found.');
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: error.issues[0]?.message || 'Invalid input.' }, 400);
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    logDatabaseError(error, requestId, stage);
    return json({ error: 'The operation failed. Your existing data has been preserved.' }, 500);
  }
}
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const requestId = newDiagnosticId();
  const response = await handleRequest(request, context, requestId);
  response.headers.set('X-Echo-Request-Id', requestId);
  return response;
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
