import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, UNAUTHORIZED_EVENT } from '../lib/client';

// The browser client must signal an ended session on a 401, except on the auth routes
// themselves, where 401 means wrong credentials.
async function eventsFor(path: string, status: number) {
  const events: string[] = [];
  const originalFetch = globalThis.fetch;
  const scope = globalThis as unknown as { window?: unknown };
  const originalWindow = scope.window;
  scope.window = { dispatchEvent: (event: Event) => events.push(event.type) };
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(status === 200 ? { ok: true } : { error: 'refused' }), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  try {
    await api(path).catch(() => undefined);
  } finally {
    globalThis.fetch = originalFetch;
    scope.window = originalWindow;
  }
  return events;
}
test('client signals an ended session on 401 from workspace routes only', async () => {
  assert.deepEqual(await eventsFor('providers/verify', 401), [UNAUTHORIZED_EVENT]);
  assert.deepEqual(await eventsFor('memories', 401), [UNAUTHORIZED_EVENT]);
  assert.deepEqual(await eventsFor('account', 401), [UNAUTHORIZED_EVENT]);
  assert.deepEqual(await eventsFor('auth/login', 401), []);
  assert.deepEqual(await eventsFor('auth/status', 401), []);
  assert.deepEqual(await eventsFor('memories', 200), []);
  assert.deepEqual(await eventsFor('memories', 403), []);
  assert.deepEqual(await eventsFor('memories', 404), []);
});
test('client still reports the server error message after signalling', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'Sign in to open your memory workspace.' }), {
      status: 401,
    })) as typeof fetch;
  try {
    await assert.rejects(api('settings'), /Sign in to open your memory workspace\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
