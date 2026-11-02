import type { Database } from './db';

const branch = 'feat/core-memory-exploration';
// Opt-in expires automatically. No endpoint, request parameter or credential is read.
export function identityDiagnosticEnabled(
  env: Readonly<Record<string, string | undefined>>,
  now = Date.now(),
) {
  const until = Date.parse(env.ECHO_DB_IDENTITY_UNTIL || '');
  return (
    env.VERCEL_ENV === 'preview' &&
    env.VERCEL_GIT_COMMIT_REF === branch &&
    env.ECHO_DB_IDENTITY_DIAGNOSTIC === '1' &&
    Number.isFinite(until) &&
    until > now &&
    until - now <= 15 * 60 * 1000
  );
}

export async function inspectDatabaseIdentity(db: Database) {
  return db.transaction(async (tx) => {
    await tx.exec('SET TRANSACTION READ ONLY');
    await tx.exec("SET LOCAL statement_timeout = '3s'; SET LOCAL lock_timeout = '1s'");
    const [row] = await tx.query<{
      database: string;
      effective_role: string;
      session_role: string;
      search_path: string;
      resolved_search_path: string[];
      read_only: string;
    }>(`SELECT current_database() AS database, current_user AS effective_role,
      session_user AS session_role, current_setting('search_path') AS search_path,
      current_schemas(false) AS resolved_search_path,
      current_setting('transaction_read_only') AS read_only`);
    if (!row || row.read_only !== 'on') throw new Error('Read-only diagnostic unavailable');
    // Explicit projection: never pass driver errors, URL, options, or arbitrary rows to logs.
    return {
      database: row.database,
      effective_role: row.effective_role,
      session_role: row.session_role,
      search_path: row.search_path,
      resolved_search_path: row.resolved_search_path,
      read_only: true,
    };
  });
}
