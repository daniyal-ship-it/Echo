import { z } from 'zod';
import { hash, HttpError } from './security';
import type { Database } from './db';
import type { Message } from './types';
import { CHUNKER_VERSION, MAX_CHUNKS, type Passage, type Analysis } from './intelligence-types';
const stableId = (key: string) => {
  const h = hash(key);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export function chunkSource(
  workspace: string,
  memory: string,
  version: number,
  content: string,
  messages: Message[],
  sourceTimestamp: string | null,
): Passage[] {
  const chunks: Passage[] = [];
  const sources = messages.length
    ? messages.map((message, index) => ({ text: message.content, message, index }))
    : [{ text: content, message: null, index: null }];
  for (const source of sources) {
    for (let start = 0; start < source.text.length;) {
      let end = Math.min(start + 1600, source.text.length);
      if (end < source.text.length) {
        const boundary = Math.max(
          source.text.lastIndexOf('\n', end),
          source.text.lastIndexOf(' ', end),
        );
        if (boundary > start + 800) end = boundary + 1;
        if (/[\uD800-\uDBFF]/.test(source.text[end - 1])) end--;
      }
      const text = source.text.slice(start, end),
        ordinal = chunks.length;
      if (text.trim())
        chunks.push({
          id: stableId(
            `${workspace}:${memory}:${version}:${CHUNKER_VERSION}:${source.index}:${start}:${end}`,
          ),
          workspace_id: workspace,
          memory_id: memory,
          source_version: version,
          ordinal,
          message_id: source.message?.id ?? null,
          message_index: source.index,
          role: source.message?.role ?? null,
          source_timestamp: source.message?.timestamp ?? sourceTimestamp,
          active: source.message?.active ?? true,
          start_offset: start,
          end_offset: end,
          content: text,
          content_hash: hash(text),
          chunker_version: CHUNKER_VERSION,
        });
      start = end;
    }
  }
  if (!chunks.some((c) => c.active))
    throw new HttpError(400, 'This original has no active text to index.');
  if (chunks.length > MAX_CHUNKS)
    throw new HttpError(
      413,
      `This original exceeds the ${MAX_CHUNKS}-passage processing limit. Its original remains preserved; split processing is not yet supported.`,
    );
  return chunks;
}
const evidence = z.object({ chunkId: z.uuid(), quote: z.string().min(8).max(1600) }).strict();
const claim = z
  .object({ text: z.string().min(1).max(800), citations: z.array(evidence).min(1).max(4) })
  .strict();
const schema = z
  .object({
    summary: z.array(claim).min(1).max(6),
    insights: z
      .array(claim.extend({ kind: z.enum(['decision', 'question', 'commitment']) }))
      .max(10),
  })
  .strict();
export function validateAnalysis(value: unknown, chunks: Passage[]): Analysis {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new HttpError(
      422,
      'Generated analysis did not satisfy the evidence schema. No summary was published.',
    );
  const allowed = new Map(chunks.filter((c) => c.active).map((c) => [c.id, c]));
  for (const item of [...parsed.data.summary, ...parsed.data.insights])
    for (const citation of item.citations) {
      const source = allowed.get(citation.chunkId);
      if (!source || !source.content.includes(citation.quote))
        throw new HttpError(
          422,
          'Generated analysis cited a missing passage or an inexact quote. No summary was published.',
        );
    }
  return parsed.data;
}
export async function getPassage(db: Database, workspace: string, memory: string, id: string) {
  const [passage] = await db.query<Passage>(
    'SELECT * FROM memory_chunks WHERE workspace_id=$1 AND memory_id=$2 AND id=$3',
    [workspace, memory, id],
  );
  if (!passage) throw new HttpError(404, 'Original passage not found.');
  return passage;
}
export function validateAnswerCitations(text: string, count: number) {
  const matches = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (
    matches.some((n) => n < 1 || n > count) ||
    (count > 0 && !matches.length && !/insufficient evidence/i.test(text))
  )
    throw new HttpError(
      422,
      'The answer contained invalid or missing source citations and was withheld.',
    );
  return text;
}
