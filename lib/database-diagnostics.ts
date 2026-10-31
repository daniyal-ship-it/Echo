import { randomUUID } from 'node:crypto';

export type DatabaseStage =
  | 'configuration'
  | 'connection.check'
  | 'local.open'
  | 'migration.files'
  | 'migration.history'
  | 'migration.catalogue'
  | 'migration.apply'
  | 'health.query'
  | 'request';

const reasons: Record<string, string> = {
  DB_URL_MISSING: 'DATABASE_URL is missing in a managed runtime',
  DB_URL_INVALID: 'DATABASE_URL is not a valid PostgreSQL connection URL',
  DB_URL_PLACEHOLDER: 'DATABASE_URL contains a recognised placeholder',
  DB_TLS_REQUIRED: 'Managed production requires verified database TLS',
  DB_MIGRATION_REQUIRED: 'Expected migrations are pending; startup will not modify managed schema',
  ENOENT: 'A required runtime file is missing',
  EACCES: 'Runtime file access was denied',
  ENOTFOUND: 'Database hostname resolution failed',
  EAI_AGAIN: 'Database hostname resolution is temporarily unavailable',
  ECONNREFUSED: 'Database connection was refused',
  ECONNRESET: 'Database connection was reset',
  ETIMEDOUT: 'Database network operation timed out',
  CONNECT_TIMEOUT: 'Database connection timed out',
  CONNECTION_CLOSED: 'Database connection closed before completion',
  CONNECTION_ENDED: 'Database connection ended before completion',
  EHOSTUNREACH: 'Database host is unreachable',
  ENETUNREACH: 'Database network is unreachable',
  ERR_INVALID_URL: 'Database connection URL could not be parsed',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'Database TLS certificate is self-signed and untrusted',
  SELF_SIGNED_CERT_IN_CHAIN: 'Database TLS chain contains an untrusted self-signed certificate',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Database TLS certificate chain could not be verified',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'Database TLS issuer is absent from the trust store',
  CERT_HAS_EXPIRED: 'Database TLS certificate has expired',
  CERT_NOT_YET_VALID: 'Database TLS certificate is not yet valid',
  ERR_TLS_CERT_ALTNAME_INVALID: 'Database TLS certificate does not match its hostname',
  SASL_SIGNATURE_MISMATCH: 'Database authentication server signature did not match',
  '28P01': 'Database authentication rejected the supplied credentials',
  '28000': 'Database authentication or access policy rejected the connection',
  '3D000': 'Configured database does not exist',
  '42501': 'Database role lacks a required permission',
  '42P01': 'An expected database relation is missing',
  '42704': 'An expected database object or type is missing',
  '42710': 'A database object already exists',
  '42P07': 'A database relation already exists',
  '42601': 'Database statement syntax was rejected',
  '0A000': 'A required database operation or extension is unavailable',
  '23505': 'Database uniqueness constraint rejected the operation',
  '23503': 'Database reference constraint rejected the operation',
  '57014': 'Database statement was cancelled or timed out',
  '53300': 'Database connection capacity was exhausted',
};

export function databaseConfigError(code: string) {
  return Object.assign(new Error('Database configuration or initialization failed'), { code });
}

// Do not redact arbitrary error text: it can contain source content or credentials.
// Only fixed reason strings and constrained protocol codes cross this boundary.
export function sanitiseDatabaseError(error: unknown) {
  const value = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const candidate = typeof value.code === 'string' ? value.code : '';
  const sqlstate = /^[0-9A-Z]{5}$/.test(candidate) ? candidate : null;
  const code = Object.hasOwn(reasons, candidate) || sqlstate ? candidate : null;
  const name = [
    'Error',
    'PostgresError',
    'TypeError',
    'RangeError',
    'SyntaxError',
    'AggregateError',
  ].includes(String(value.name))
    ? String(value.name)
    : 'UnknownError';
  const position =
    typeof value.position === 'string' && /^[1-9][0-9]{0,7}$/.test(value.position)
      ? Number(value.position)
      : null;
  return {
    error_class: name,
    code,
    sqlstate,
    reason:
      (code && reasons[code]) ||
      (sqlstate
        ? 'Database rejected the operation; inspect SQLSTATE'
        : 'Unclassified failure; raw error details intentionally omitted'),
    statement_position: position,
  };
}

export type DatabaseDiagnostic = ReturnType<typeof sanitiseDatabaseError> & {
  initialization_id: string;
  stage: DatabaseStage;
  migration?: string;
  statement_line?: number;
};

export class DatabaseInitializationError extends Error {
  constructor(readonly diagnostic: DatabaseDiagnostic) {
    super(diagnostic.reason);
    this.name = 'DatabaseInitializationError';
  }
}

export function logDatabaseError(error: unknown, requestId: string, stage: DatabaseStage) {
  const diagnostic =
    error instanceof DatabaseInitializationError
      ? error.diagnostic
      : { ...sanitiseDatabaseError(error), stage };
  console.error(JSON.stringify({ event: 'api_error', request_id: requestId, ...diagnostic }));
}

export function newDiagnosticId() {
  return randomUUID();
}

export function validateDatabaseUrl(value: string | undefined) {
  if (!value?.trim()) throw databaseConfigError('DB_URL_MISSING');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw databaseConfigError('DB_URL_INVALID');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    url.pathname.length < 2
  )
    throw databaseConfigError('DB_URL_INVALID');
  const placeholders = new Set([
    'your-user',
    'your-password',
    'your-host',
    'your-database',
    'changeme',
    'replace-me',
    'placeholder',
  ]);
  let parts: string[];
  try {
    parts = [url.hostname, url.username, url.password, url.pathname.slice(1)].map(
      decodeURIComponent,
    );
  } catch {
    throw databaseConfigError('DB_URL_INVALID');
  }
  if (
    parts.some((p) => placeholders.has(p.toLowerCase()) || /[<>]/.test(p)) ||
    /\.(example|invalid)$/.test(url.hostname)
  )
    throw databaseConfigError('DB_URL_PLACEHOLDER');
}
