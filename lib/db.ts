import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import postgres from 'postgres';

export interface Database {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function createDatabase(directory?: string): Promise<Database> {
  let db: Database;
  if (process.env.DATABASE_URL && !directory) {
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL === 'disable') {
      throw new Error('Production database connections require certificate-verified TLS.');
    }
    const sql = postgres(process.env.DATABASE_URL, {
      max: 5,
      ssl: process.env.DATABASE_SSL === 'disable' ? false : 'verify-full',
      prepare: false,
    });
    const wrap = (client: typeof sql): Database => ({
      async query<T>(text: string, params: unknown[] = []) {
        return (await client.unsafe(text, params as never[])) as unknown as T[];
      },
      async exec(text) {
        await client.unsafe(text);
      },
      async transaction<T>(fn: (db: Database) => Promise<T>) {
        return (await sql.begin(async (tx) => fn(wrap(tx as unknown as typeof sql)))) as T;
      },
      async close() {
        await sql.end();
      },
    });
    db = wrap(sql);
  } else {
    if (process.env.NODE_ENV === 'production' && !process.env.ECHO_ALLOW_LOCAL_DB && !directory) {
      throw new Error(
        'Production requires DATABASE_URL. For a persistent single-server evaluation only, set ECHO_ALLOW_LOCAL_DB=1.',
      );
    }
    const location =
      directory ?? process.env.ECHO_DATA_DIR ?? path.join(process.cwd(), '.data/postgres');
    if (location !== 'memory://') await mkdir(location, { recursive: true, mode: 0o700 });
    const pg = await PGlite.create({ dataDir: location, extensions: { vector } });
    type PgClient = Pick<PGlite, 'query' | 'exec'>;
    const wrap = (client: PgClient): Database => ({
      async query<T>(text: string, params: unknown[] = []) {
        return (await client.query<T>(text, params)).rows;
      },
      async exec(text) {
        await client.exec(text);
      },
      async transaction<T>(fn: (db: Database) => Promise<T>) {
        return pg.transaction((tx) => fn(wrap(tx)));
      },
      async close() {
        await pg.close();
      },
    });
    db = wrap(pg);
  }
  await db.transaction(async (tx) => {
    if (process.env.DATABASE_URL && !directory) {
      await tx.query('SELECT pg_advisory_xact_lock(68182041)');
    }
    await tx.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const exists = await tx.query('SELECT version FROM schema_migrations WHERE version=$1', [
      '001_foundation',
    ]);
    if (!exists.length) {
      const migration = await readFile(
        path.join(process.cwd(), 'db/migrations/001_foundation.sql'),
        'utf8',
      );
      await tx.exec(migration);
    }
  });
  return db;
}

const globalDb = globalThis as unknown as { echoDatabase?: Promise<Database> };
export function getDb() {
  globalDb.echoDatabase ??= createDatabase().catch((error) => {
    globalDb.echoDatabase = undefined;
    throw error;
  });
  return globalDb.echoDatabase;
}
