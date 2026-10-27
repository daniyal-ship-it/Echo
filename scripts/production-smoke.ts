import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function main() {
  const dist = process.env.ECHO_DIST_DIR || '.next';
  const standalone = path.resolve(dist, 'standalone');
  await cp(path.resolve(dist, 'static'), path.join(standalone, dist, 'static'), {
    recursive: true,
  });
  await cp('public', path.join(standalone, 'public'), { recursive: true });
  const dataDir = await mkdtemp(path.join(tmpdir(), 'echo-production-smoke-'));
  const origin = 'http://127.0.0.1:3200';
  const server = spawn(process.execPath, [path.join(standalone, 'server.js')], {
    env: {
      ...process.env,
      DATABASE_URL: '',
      HOSTNAME: '127.0.0.1',
      PORT: '3200',
      APP_ORIGIN: origin,
      ECHO_ALLOW_LOCAL_DB: '1',
      ECHO_DATA_DIR: dataDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (chunk) => {
    output += String(chunk);
  });
  server.stderr.on('data', (chunk) => {
    output += String(chunk);
  });
  const closed = new Promise<void>((resolve) => server.once('exit', () => resolve()));
  const checks: string[] = [];
  let cookie = '';
  async function request(route: string, method = 'GET', data?: unknown) {
    return fetch(`${origin}/api/${route}`, {
      method,
      headers: { origin, ...(cookie ? { cookie } : {}), 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.timeout(10000),
    });
  }
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null)
        throw new Error(`Standalone server exited: ${output.slice(-1200)}`);
      try {
        if ((await request('health')).ok) {
          ready = true;
          break;
        }
      } catch {
        /* startup not ready */
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(ready, 'Production server did not become healthy');
    checks.push(
      'Standalone server, traced PostgreSQL/pgvector extension, and transactional migration',
    );
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Memory atlas/);
    const asset = await fetch(`${origin}/anatomy/brain.bin`);
    assert.equal(asset.status, 200);
    assert.ok((await asset.arrayBuffer()).byteLength > 500000);
    checks.push('Production HTML, static assets and anatomical geometry');
    const registration = await request('auth/register', 'POST', {
      name: 'Production smoke fixture',
      email: 'production-fixture@example.test',
      password: 'Isolated smoke test password 42',
    });
    assert.equal(registration.status, 201, await registration.text());
    const setCookie = registration.headers.get('set-cookie') || '';
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=strict/i);
    cookie = setCookie.split(';')[0];
    const created = await request('memories', 'POST', {
      title: 'Production fixture',
      content: 'A real saved record in an isolated production-mode database.',
      region: 'parietal',
    });
    assert.equal(created.status, 201);
    const memory = await created.json();
    assert.equal(
      (await request(`memories/${memory.id}`).then((r) => r.json())).content,
      memory.content,
    );
    assert.equal((await request('graph').then((r) => r.json())).total, 1);
    const exported = await request('export').then((r) => r.json());
    assert.equal(exported.versions.length, 1);
    checks.push('Production-mode account, session, original persistence, graph and export');
    await request('auth/logout', 'POST', {});
    assert.equal((await request('memories')).status, 401);
    checks.push('Session revocation');
    await mkdir('docs/validation', { recursive: true });
    await writeFile(
      'docs/validation/production-smoke.json',
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          checks,
          result: 'passed',
          limitations:
            'Local standalone build with isolated PGlite; not a managed database, Docker deployment or cloud publication.',
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      `PASS: ${checks.length} standalone production checks. Isolated test database removed.`,
    );
  } finally {
    server.kill('SIGTERM');
    await closed;
    await rm(dataDir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
