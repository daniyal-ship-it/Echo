import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { connect, createServer, type ConnectionOptions } from 'node:tls';
import { databaseTlsOptions } from '../lib/database-tls';
import { sanitiseDatabaseError } from '../lib/database-diagnostics';

test('custom database trust accepts its CA but rejects untrusted certificates and wrong hostnames', async () => {
  const directory = await mkdtemp('/tmp/echo-database-tls-');
  let server: ReturnType<typeof createServer> | undefined;
  try {
    // Disposable test key/certificate, never a real database credential or committed artifact.
    await promisify(execFile)('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost',
      '-addext',
      'basicConstraints=critical,CA:TRUE',
      '-keyout',
      `${directory}/key.pem`,
      '-out',
      `${directory}/ca.pem`,
    ]);
    const ca = await readFile(`${directory}/ca.pem`, 'utf8');
    server = createServer({ key: await readFile(`${directory}/key.pem`), cert: ca }, (socket) =>
      socket.end(),
    );
    server.on('tlsClientError', () => {
      /* Expected negative certificate checks. */
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const port = address.port;
    const handshake = (options: ConnectionOptions, servername = 'localhost') =>
      new Promise<boolean>((resolve, reject) => {
        const socket = connect({ host: '127.0.0.1', port, servername, ...options });
        socket.setTimeout(3000, () => socket.destroy(new Error('Local TLS fixture timed out')));
        socket.once('secureConnect', () => {
          const authorised = socket.authorized;
          socket.destroy();
          resolve(authorised);
        });
        socket.once('error', reject);
      });
    assert.equal(databaseTlsOptions(ca).rejectUnauthorized, true);
    assert.equal(await handshake(databaseTlsOptions(ca)), true);
    await assert.rejects(handshake(databaseTlsOptions('')), (error: unknown) =>
      ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(
        sanitiseDatabaseError(error).code || '',
      ),
    );
    await assert.rejects(
      handshake(databaseTlsOptions(ca), 'mismatch.example.test'),
      (error: unknown) => sanitiseDatabaseError(error).code === 'ERR_TLS_CERT_ALTNAME_INVALID',
    );
  } finally {
    if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('invalid CA configuration fails without disclosing its content', () => {
  const value = 'synthetic-private-key-or-password-not-a-certificate';
  assert.throws(
    () => databaseTlsOptions(value),
    (error) => {
      assert.equal(sanitiseDatabaseError(error).code, 'DB_CA_INVALID');
      assert.ok(!String(error).includes(value));
      return true;
    },
  );
  assert.deepEqual(databaseTlsOptions(''), { rejectUnauthorized: true });
});
