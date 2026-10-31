import { X509Certificate } from 'node:crypto';
import * as tls from 'node:tls';
import { databaseConfigError } from './database-diagnostics';

// The operator supplies the database provider's public CA, never its private key.
// Scope this extra trust to this PostgreSQL client; do not alter global TLS policy.
export function databaseTlsOptions(caPem = process.env.DATABASE_CA_CERT) {
  if (!caPem?.trim()) return { rejectUnauthorized: true as const };
  const pem = caPem.trim();
  const certificates = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  try {
    if (
      !certificates?.length ||
      pem.replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, '').trim()
    )
      throw new Error('Unexpected CA bundle format');
    for (const certificate of certificates) {
      if (!new X509Certificate(certificate).ca) throw new Error('Expected a CA certificate');
    }
  } catch {
    throw databaseConfigError('DB_CA_INVALID');
  }
  return {
    rejectUnauthorized: true as const,
    ca: [...(tls.getCACertificates?.('default') || tls.rootCertificates), ...certificates],
  };
}
