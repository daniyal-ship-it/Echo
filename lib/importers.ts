import { unzipSync, strFromU8 } from 'fflate';
import { HttpError, hash } from './security';
import type { ImportItem, Message } from './types';

const MAX_EXPANDED = 40 * 1024 * 1024;
const MAX_CONTENT = 500_000;
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
function date(v: unknown) {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : String(v));
  return Number.isNaN(d.valueOf()) ? null : d.toISOString();
}
export function extractTags(content: string) {
  return [
    ...new Set(
      Array.from(content.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu), (m) => m[1].toLowerCase()),
    ),
  ].slice(0, 20);
}
function contentText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(contentText).filter(Boolean).join('\n');
  const v = obj(value);
  if (v.type === 'text' || v.content_type === 'text') return text(v.text) || contentText(v.parts);
  if (v.parts) return contentText(v.parts);
  if (v.text) return text(v.text);
  if (v.asset_pointer || v.type === 'image')
    return `[Attachment reference: ${text(v.asset_pointer) || 'image; see original export'}]`;
  if (Object.keys(v).length) return '[Non-text content preserved in original export]';
  return '';
}
function parseChatGPT(c: Obj): ImportItem {
  const mapping = obj(c.mapping);
  const active = new Set<string>();
  let cursor = text(c.current_node);
  while (cursor && mapping[cursor] && !active.has(cursor)) {
    active.add(cursor);
    cursor = text(obj(mapping[cursor]).parent);
  }
  const messages: Message[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function walk(id: string, depth = 0) {
    if (visited.has(id)) return;
    if (depth > 5000 || visiting.has(id))
      throw new HttpError(
        400,
        'Conversation contains an invalid branch cycle or excessive nesting.',
      );
    visiting.add(id);
    const node = obj(mapping[id]);
    const parent = text(node.parent);
    if (parent && mapping[parent]) walk(parent, depth + 1);
    visiting.delete(id);
    visited.add(id);
    const m = obj(node.message);
    if (!Object.keys(m).length) return;
    messages.push({
      id: text(m.id) || id,
      role: text(obj(m.author).role) || 'unknown',
      content: contentText(m.content),
      timestamp: date(m.create_time),
      parent: parent || null,
      active: active.size ? active.has(id) : true,
      model: text(obj(m.metadata).model_slug) || undefined,
    });
  }
  Object.keys(mapping).forEach((id) => walk(id));
  const content = messages
    .filter((m) => m.active)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');
  return {
    source: 'chatgpt',
    sourceId: text(c.id) || text(c.conversation_id) || hash(JSON.stringify(c)),
    title: text(c.title) || 'Untitled ChatGPT conversation',
    content,
    raw: c,
    messages,
    sourceAt: date(c.create_time),
    kind: 'conversation',
    tags: extractTags(content),
    region: 'temporal',
  };
}
function parseClaude(c: Obj): ImportItem {
  const messages = (Array.isArray(c.chat_messages) ? c.chat_messages : []).map(
    (value, index): Message => {
      const m = obj(value);
      return {
        id: text(m.uuid) || String(index),
        role: text(m.sender) === 'human' ? 'user' : text(m.sender) || 'assistant',
        content: text(m.text) || contentText(m.content),
        timestamp: date(m.created_at),
        parent: null,
        active: true,
        model: text(m.model) || undefined,
      };
    },
  );
  const content = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
  return {
    source: 'claude',
    sourceId: text(c.uuid) || hash(JSON.stringify(c)),
    title: text(c.name) || 'Untitled Claude conversation',
    content,
    raw: c,
    messages,
    sourceAt: date(c.created_at),
    kind: 'conversation',
    tags: extractTags(content),
    region: 'temporal',
  };
}
export function parseJson(input: string): ImportItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new HttpError(
      400,
      'Invalid JSON. Use conversations.json from an official ChatGPT or Claude export.',
    );
  }
  const root = obj(parsed);
  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root.conversations)
      ? root.conversations
      : [parsed];
  if (entries.length > 1000)
    throw new HttpError(413, 'Split this archive into batches of at most 1,000 conversations.');
  return entries.map((value) => {
    const c = obj(value);
    if (c.mapping && typeof c.mapping === 'object') return parseChatGPT(c);
    if (Array.isArray(c.chat_messages)) return parseClaude(c);
    throw new HttpError(
      400,
      'Unsupported conversation format. Expected ChatGPT mapping or Claude chat_messages.',
    );
  });
}
export function parseImport(filename: string, data: Uint8Array): ImportItem[] {
  if (data.byteLength > 20 * 1024 * 1024)
    throw new HttpError(413, 'Maximum upload size is 20 MiB.');
  let items: ImportItem[] = [];
  if (filename.toLowerCase().endsWith('.zip')) {
    let expanded = 0,
      entries = 0;
    try {
      const files = unzipSync(data, {
        filter(file) {
          expanded += file.originalSize;
          entries++;
          if (expanded > MAX_EXPANDED || entries > 2000 || file.originalSize > 20 * 1024 * 1024)
            throw new HttpError(
              413,
              'Archive exceeds the safe expansion limit (40 MiB / 2,000 files).',
            );
          if (file.name.split(/[\\/]/).includes('..') || /^[\\/]/.test(file.name))
            throw new HttpError(400, 'Unsafe archive path.');
          return /(?:^|\/)conversations\.json$/i.test(file.name) || /\.(md|txt)$/i.test(file.name);
        },
      });
      const conversations = Object.keys(files).filter((name) =>
        /(?:^|\/)conversations\.json$/i.test(name),
      );
      const names = conversations.length ? conversations : Object.keys(files);
      for (const name of names) items.push(...parseImport(name, files[name]));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, 'The ZIP archive is corrupt, encrypted, or unsupported.');
    }
  } else if (filename.toLowerCase().endsWith('.json')) {
    items = parseJson(strFromU8(data));
  } else if (/\.(md|txt)$/i.test(filename)) {
    const content = strFromU8(data);
    if (content.includes('\0')) throw new HttpError(400, 'Expected a UTF-8 text file.');
    const title =
      content.match(/^#\s+(.+)$/m)?.[1] ||
      filename
        .split('/')
        .pop()
        ?.replace(/\.(md|txt)$/i, '') ||
      'Imported note';
    items = [
      {
        source: 'markdown',
        sourceId: filename,
        title,
        content,
        raw: { path: filename, text: content },
        messages: [],
        sourceAt: null,
        kind: 'note',
        tags: extractTags(content),
      },
    ];
  } else
    throw new HttpError(
      400,
      'Supported now: ChatGPT/Claude JSON or ZIP exports, Markdown, text, and Markdown vault ZIPs.',
    );
  if (!items.length) throw new HttpError(400, 'No supported records found in this file.');
  if (items.length > 1000) throw new HttpError(413, 'Maximum 1,000 memories per import.');
  for (const item of items) {
    if (
      item.content.length > MAX_CONTENT ||
      item.title.length > 500 ||
      item.messages.length > 10000
    )
      throw new HttpError(
        413,
        'A record exceeds the content limit. Split very large conversations before importing.',
      );
  }
  return items;
}
