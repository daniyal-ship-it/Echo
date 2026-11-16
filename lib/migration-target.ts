import type { Database } from './db';
import { databaseConfigError } from './database-diagnostics';

export const DEVELOPMENT_PROJECT = 'dtcxlxehqiuhmhuypqbm';
export const DEVELOPMENT_SYSTEM_IDENTIFIER = '7703760980994770283';
const hostname = `db.${DEVELOPMENT_PROJECT}.supabase.co`;
type Environment = Readonly<Record<string, string | undefined>>;

// No caller-supplied project/system-ID allowlist and no test bypass. Direct TLS
// endpoint attribution plus the cluster ID are required; shared poolers are rejected.
export function requireDevelopmentTarget(target: unknown, env: Environment = process.env) {
  if (target !== 'echo-dev') throw databaseConfigError('DB_MIGRATION_AUTH_REQUIRED');
  try {
    const url = new URL(env.DATABASE_URL || '');
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hostname !== hostname ||
      (url.port && url.port !== '5432') ||
      url.username !== 'postgres' ||
      !url.password ||
      url.pathname !== '/postgres' ||
      url.search ||
      url.hash ||
      (env.DATABASE_SSL && env.DATABASE_SSL !== 'require') ||
      env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ||
      env.VERCEL_ENV === 'production' ||
      env.VERCEL_TARGET_ENV === 'production' ||
      (env.VERCEL_GIT_COMMIT_REF && env.VERCEL_GIT_COMMIT_REF !== 'feat/core-memory-exploration') ||
      ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGSERVICE', 'PGOPTIONS', 'PGSSLMODE'].some(
        (key) => Boolean(env[key]),
      )
    )
      throw new Error();
    return env.DATABASE_URL!;
  } catch {
    throw databaseConfigError('DB_MIGRATION_TARGET_INVALID');
  }
}

export async function verifyDevelopmentIdentity(db: Pick<Database, 'query'>) {
  try {
    const rows = await db.query<{
      system_identifier: string;
      database: string;
      effective_role: string;
      session_role: string;
      creation_schema: string;
    }>(`SELECT system_identifier::text AS system_identifier,
      pg_catalog.current_database() AS database, current_user AS effective_role,
      session_user AS session_role, pg_catalog.current_schema() AS creation_schema
      FROM pg_catalog.pg_control_system()`);
    if (
      rows.length !== 1 ||
      rows[0].system_identifier !== DEVELOPMENT_SYSTEM_IDENTIFIER ||
      rows[0].database !== 'postgres' ||
      rows[0].effective_role !== 'postgres' ||
      rows[0].session_role !== 'postgres' ||
      rows[0].creation_schema !== 'public'
    )
      throw new Error();
  } catch {
    // Never propagate raw driver errors or identity row contents.
    throw databaseConfigError('DB_MIGRATION_IDENTITY_REJECTED');
  }
}

// This callback can execute DDL only after validation on the pinned transaction
// connection. No pool-level identity observation substitutes for this check.
export async function developmentMigrationTransaction(
  db: Database,
  target: unknown,
  connectionUrl: string,
  apply: (tx: Database) => Promise<void>,
) {
  if (requireDevelopmentTarget(target) !== connectionUrl)
    throw databaseConfigError('DB_MIGRATION_TARGET_INVALID');
  await verifyDevelopmentIdentity(db);
  await db.transaction(async (tx) => {
    await tx.exec("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s'");
    await tx.query('SELECT pg_advisory_xact_lock(68182041)');
    if (requireDevelopmentTarget(target) !== connectionUrl)
      throw databaseConfigError('DB_MIGRATION_TARGET_INVALID');
    await verifyDevelopmentIdentity(tx);
    await apply(tx);
  });
}
