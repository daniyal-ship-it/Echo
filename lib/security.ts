import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  randomUUID,
} from 'node:crypto';
import { promisify } from 'node:util';
import type { Database } from './db';
import type { Session } from './types';
const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'echo_session';
export const hash = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
export const uuid = () => randomUUID();
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [, salt, key] = encoded.split(':');
  if (!salt || !key) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function createSession(db: Database, userId: string) {
  const token = randomBytes(32).toString('base64url');
  await db.query('DELETE FROM sessions WHERE expires_at < now()');
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now() + interval '7 days')",
    [hash(token), userId],
  );
  return token;
}
export async function findSession(db: Database, token?: string): Promise<Session | null> {
  if (!token) return null;
  const rows = await db.query<Session>(
    'SELECT u.id AS "userId", u.email, u.name, w.id AS "workspaceId" FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspaces w ON w.owner_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()',
    [hash(token)],
  );
  return rows[0] ?? null;
}
export async function rateLimit(db: Database, key: string, limit = 10) {
  const rows = await db.query<{ count: number }>(
    `INSERT INTO auth_attempts(key,count) VALUES($1,1)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_attempts.started_at < now()-interval '15 minutes' THEN 1 ELSE auth_attempts.count+1 END,
    started_at=CASE WHEN auth_attempts.started_at < now()-interval '15 minutes' THEN now() ELSE auth_attempts.started_at END RETURNING count`,
    [hash(key)],
  );
  if (rows[0].count > limit)
    throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get('origin');
  // Next may normalise request.url to its bind hostname. The browser's Host
  // remains the actual development origin; production always pins APP_ORIGIN.
  const url = new URL(request.url);
  if (process.env.NODE_ENV === 'production' && !process.env.APP_ORIGIN)
    throw new HttpError(503, 'Configure APP_ORIGIN before accepting production requests.');
  const expected =
    process.env.APP_ORIGIN ?? `${url.protocol}//${request.headers.get('host') || url.host}`;
  if (!origin || origin !== expected || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'This action must come from this application.');
  }
}
export async function audit(db: Database, workspace: string, action: string, resourceId?: string) {
  await db.query(
    'INSERT INTO audit_events(id,workspace_id,action,resource_id) VALUES($1,$2,$3,$4)',
    [uuid(), workspace, action, resourceId ?? null],
  );
}
