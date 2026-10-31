import { readFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import postgres from 'postgres';
import {
  databaseConfigError,
  DatabaseInitializationError,
  newDiagnosticId,
  sanitiseDatabaseError,
  validateDatabaseUrl,
  type DatabaseStage,
} from './database-diagnostics';

export const MIGRATIONS = ['001_foundation', '002_memory_intelligence'] as const;

// Read-only inspection. Never create the history table just to inspect it.
export async function inspectManagedMigrations(db: Database) {
  const [history] = await db.query<{ present: boolean }>(
    "SELECT to_regclass('schema_migrations') IS NOT NULL AS present",
  );
  const applied = history.present
    ? await db.query<{ version: string }>(
        'SELECT version FROM schema_migrations WHERE version = ANY($1::text[])',
        [[...MIGRATIONS]],
      )
    : [];
  return MIGRATIONS.map((version) => ({
    version,
    applied: applied.some((row) => row.version === version),
  }));
}

export function requireCurrentManagedSchema(
  migrations: Awaited<ReturnType<typeof inspectManagedMigrations>>,
) {
  if (migrations.some((m) => !m.applied)) throw databaseConfigError('DB_MIGRATION_REQUIRED');
}

export interface Database {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function createDatabase(
  directory?: string,
  options: { requestId?: string; applyManagedMigrations?: boolean } = {},
): Promise<Database> {
  let db: Database | undefined;
  const initializationId = newDiagnosticId();
  const requestId = options.requestId || initializationId;
  const managed = Boolean(process.env.DATABASE_URL) && !directory;
  let stage: DatabaseStage = 'configuration';
  let migrationVersion: string | undefined, migrationSql: string | undefined;
  const report = (event: string, fields: Record<string, unknown> = {}) => {
    if (managed || process.env.VERCEL)
      console.info(
        JSON.stringify({
          event,
          request_id: requestId,
          initialization_id: initializationId,
          stage,
          ...fields,
        }),
      );
  };
  try {
    if (managed) {
      validateDatabaseUrl(process.env.DATABASE_URL);
      if (process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL === 'disable') {
        throw databaseConfigError('DB_TLS_REQUIRED');
      }
      const sql = postgres(process.env.DATABASE_URL!, {
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
          await sql.end({ timeout: 2 });
        },
      });
      db = wrap(sql);
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.ECHO_ALLOW_LOCAL_DB && !directory) {
        throw databaseConfigError('DB_URL_MISSING');
      }
      stage = 'local.open';
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
    stage = 'connection.check';
    await db.query('SELECT 1');
    report('database_connection_ok', {
      storage: managed ? 'postgresql' : 'local-postgresql',
      verified_tls: managed && process.env.DATABASE_SSL !== 'disable',
    });
    if (managed) {
      stage = 'migration.files';
      // Only inspect migration assets after a real connection has succeeded.
      const files = await Promise.all(
        MIGRATIONS.map(async (version) => {
          try {
            await access(path.join(process.cwd(), `db/migrations/${version}.sql`));
            return { version, present: true };
          } catch {
            return { version, present: false };
          }
        }),
      );
      report('database_migration_files', { files });
      stage = 'migration.history';
      const migrations = await inspectManagedMigrations(db);
      report('database_migration_history', {
        migrations,
        writes_authorised: options.applyManagedMigrations === true,
      });
      stage = 'migration.catalogue';
      const [catalogue] = await db.query(`SELECT
      EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='vector') AS vector_available,
      EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') AS vector_installed,
      to_regtype('vector') IS NOT NULL AS vector_visible,
      (SELECT CASE WHEN n.nspname IN ('public','extensions') THEN n.nspname ELSE 'custom' END
       FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector') AS vector_schema,
      EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
       WHERE e.extname='vector' AND n.nspname=ANY(current_schemas(false))) AS vector_schema_in_search_path,
      has_database_privilege(current_database(),'CREATE') AS database_create,
      has_schema_privilege(current_schema(),'USAGE') AS schema_usage,
      has_schema_privilege(current_schema(),'CREATE') AS schema_create`);
      report('database_catalogue', { catalogue });
      if (!options.applyManagedMigrations) {
        stage = 'migration.history';
        requireCurrentManagedSchema(migrations);
        return db;
      }
    }
    stage = 'migration.apply';
    await db.transaction(async (tx) => {
      if (process.env.DATABASE_URL && !directory) {
        await tx.query('SELECT pg_advisory_xact_lock(68182041)');
      }
      await tx.exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
      );
      for (const version of MIGRATIONS) {
        const exists = await tx.query('SELECT version FROM schema_migrations WHERE version=$1', [
          version,
        ]);
        if (!exists.length) {
          migrationVersion = version;
          const migration = await readFile(
            path.join(process.cwd(), `db/migrations/${version}.sql`),
            'utf8',
          );
          migrationSql = migration;
          await tx.exec(migration);
        }
      }
    });
    return db;
  } catch (error) {
    const safe = sanitiseDatabaseError(error);
    const diagnostic = {
      ...safe,
      initialization_id: initializationId,
      stage,
      ...(migrationVersion ? { migration: migrationVersion } : {}),
      ...(migrationSql && safe.statement_position
        ? { statement_line: migrationSql.slice(0, safe.statement_position - 1).split('\n').length }
        : {}),
    };
    console.error(
      JSON.stringify({
        event: 'database_initialization_failed',
        request_id: requestId,
        ...diagnostic,
      }),
    );
    await db?.close().catch(() => undefined);
    throw new DatabaseInitializationError(diagnostic);
  }
}

const globalDb = globalThis as unknown as { echoDatabase?: Promise<Database> };
export function getDb(requestId?: string) {
  globalDb.echoDatabase ??= createDatabase(undefined, { requestId }).catch((error) => {
    globalDb.echoDatabase = undefined;
    throw error;
  });
  return globalDb.echoDatabase;
}
