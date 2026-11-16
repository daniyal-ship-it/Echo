import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Integrated tests: real session/API/database/orchestration. Only official provider HTTP
// transport is mocked by the guarded isolated-server fixture, never /api/collaborations.
const headers = { origin: 'http://127.0.0.1:3100' },
  version = 'echo-collaboration-v1';
const shots = 'test-results/phase4-integration';
mkdirSync(shots, { recursive: true });
let account: { email: string; password: string } | undefined;
let source: { id: string; version: number } | undefined;
async function signIn(page: Page) {
  if (!account) {
    account = {
      email: `phase4-${Date.now()}@example.test`,
      password: 'Isolated phase4 integration password 42',
    };
    expect(
      (
        await page.request.post('/api/auth/register', {
          headers,
          data: { ...account, name: 'Phase4 integration fixture' },
        })
      ).status(),
    ).toBe(201);
  } else
    expect((await page.request.post('/api/auth/login', { headers, data: account })).status()).toBe(
      200,
    );
  if (!source) {
    source = await (
      await page.request.post('/api/memories', {
        headers,
        data: {
          title: 'Notebook source',
          content: 'TEST FIXTURE: The notebook is in the cabinet.',
          region: 'frontal',
          tags: ['phase4'],
        },
      })
    ).json();
    let j = await (
      await page.request.post('/api/intelligence', {
        headers,
        data: { memoryId: source!.id, summaryProvider: 'openai', consent: true },
      })
    ).json();
    for (let i = 0; i < 12 && ['queued', 'running', 'retry_wait'].includes(j.status); i++)
      j = await (
        await page.request.post(`/api/intelligence/${j.id}/run`, { headers, data: {} })
      ).json();
    expect(j.status).toBe('completed');
  }
}
async function open(page: Page) {
  await page.goto('/');
  await expect(
    page.getByLabel('Retrieval mode').locator('option[value="collaborate"]'),
  ).toHaveCount(1);
}
async function compose(page: Page, question: string) {
  await open(page);
  await page.getByLabel('Retrieval mode').selectOption('collaborate');
  await page.getByLabel('Ask your memory').fill(question);
  await page.getByRole('button', { name: 'Search or ask', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New collaboration' })).toBeVisible();
}
async function start(
  page: Page,
  mode: 'Parallel analysis' | 'Deliberate collaboration' = 'Parallel analysis',
) {
  await page.getByRole('radio', { name: new RegExp(mode) }).check();
  await page
    .getByLabel('Allow this task and matching passages to be sent to OpenAI and Anthropic.')
    .check();
  const created = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/collaborations' && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Start collaboration', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  return response.json();
}
const state = (page: Page) => page.locator('.collab-state-label');
const snapshot = async (page: Page, id: string) =>
  (await page.request.get(`/api/collaborations/${id}`)).json();
const input = (question: string, mode = 'parallel') => ({
  version,
  idempotencyKey: randomUUID(),
  question,
  mode,
  consent: true,
  models: { openai: 'mock-openai-model', anthropic: 'mock-anthropic-model' },
  limits: { maxCalls: 8, maxOutputTokens: 1200, maxInputBytes: 48000 },
});
const step = (turnId: string, extra = {}) => ({
  version,
  turnId,
  idempotencyKey: randomUUID(),
  ...extra,
});
const post = (page: Page, path: string, data: unknown) =>
  page.request.post(path, { headers, data });

test('INTEGRATED: creation, explicit consent, independent outputs and real persistence', async ({
  page,
}) => {
  await signIn(page);
  await compose(page, 'Where is the notebook?');
  await expect(
    page.getByRole('button', { name: 'Start collaboration', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('form', { name: 'Collaboration task' })).toContainText('At most 5');
  expect(
    (
      await post(page, '/api/collaborations', { ...input('notebook denied'), consent: false })
    ).status(),
  ).toBe(400);
  const raw = await start(page);
  expect(raw.turns[0].calls).toHaveLength(0);
  expect(raw.turns[0].status).toBe('queued');
  await expect(state(page)).toHaveText('Completed');
  const done = await snapshot(page, raw.id);
  expect(done.turns[0].calls).toHaveLength(2);
  expect(done.turns[0].calls.every((c: any) => c.status === 'completed')).toBe(true);
  for (const provider of ['GPT', 'Claude']) {
    await page.getByRole('button', { name: provider, exact: true }).click();
    await expect(page.locator('.collab-message')).toContainText('[MOCK');
  }
  await page.screenshot({ path: `${shots}/parallel-desktop.png` });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Collaborations', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Collaborations', exact: true }).click();
  await page.locator('.collab-history-row').filter({ hasText: 'Where is the notebook?' }).click();
  await expect(state(page)).toHaveText('Completed');
  expect((await snapshot(page, raw.id)).turns[0].calls).toHaveLength(2);
});

test('INTEGRATED: real cross-review, synthesis, cited original, brain navigation and follow-up across sessions', async ({
  page,
}) => {
  await signIn(page);
  await compose(page, 'Review the notebook evidence together');
  const raw = await start(page, 'Deliberate collaboration');
  await expect(state(page)).toHaveText('Awaiting continuation');
  expect((await snapshot(page, raw.id)).turns[0].calls).toHaveLength(2);
  await page.getByRole('button', { name: 'Continue to next stage' }).click();
  await expect(page.locator('.collab-step-label')).toContainText([
    'GPT analysed',
    'Claude analysed',
    'GPT reviewed Claude',
    'Claude reviewed GPT',
  ]);
  await expect(state(page)).toHaveText('Awaiting continuation');
  await page.getByRole('button', { name: 'Continue to next stage' }).click();
  await expect(state(page)).toHaveText('Completed');
  const done = await snapshot(page, raw.id);
  expect(done.turns[0].calls).toHaveLength(5);
  expect(done.turns[0].calls.filter((c: any) => c.stage === 'review')).toHaveLength(2);
  await expect(page.getByRole('region', { name: 'Source-grounded synthesis' })).toContainText(
    '[MOCK openai synthesis]',
  );
  await expect(page.getByRole('region', { name: 'Reported agreements' })).toContainText('[MOCK]');
  await page.screenshot({ path: `${shots}/deliberate-synthesis.png` });
  await page
    .getByRole('button', { name: /Source 1\s*:\s*Notebook source/ })
    .first()
    .click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Notebook source');
  await expect(
    page.getByText('TEST FIXTURE: The notebook is in the cabinet.', { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({ path: `${shots}/cited-original.png` });
  await page.locator('.trail-back').click();
  await expect(state(page)).toHaveText('Completed');
  await page
    .getByRole('form', { name: 'Follow-up question' })
    .locator('textarea')
    .fill('Is the notebook location current?');
  await expect(page.getByRole('button', { name: 'Send follow-up' })).toBeDisabled();
  await page
    .getByRole('form', { name: 'Follow-up question' })
    .locator('input[type=checkbox]')
    .check();
  await page.getByRole('button', { name: 'Send follow-up' }).click();
  await expect(state(page)).toHaveText('Awaiting continuation');
  const followed = await snapshot(page, raw.id);
  expect(followed.turns).toHaveLength(2);
  expect(followed.turns[1].history[0].turnId).toBe(raw.turns[0].id);
  await post(page, '/api/auth/logout', {});
  expect((await page.request.get(`/api/collaborations/${raw.id}`)).status()).toBe(401);
  await signIn(page);
  expect((await snapshot(page, raw.id)).turns).toHaveLength(2);
});

test('INTEGRATED: partial success, uncertain billing and explicit recovery preserve original attempts', async ({
  page,
}) => {
  await signIn(page);
  await compose(page, 'notebook [TEST UNCERTAIN]');
  const raw = await start(page);
  await expect(state(page)).toHaveText('Needs review');
  const retry = page.getByRole('button', { name: 'Retry stage · API charges may apply' });
  await expect(retry).toBeDisabled();
  const before = await snapshot(page, raw.id);
  expect(before.turns[0].calls.filter((c: any) => c.status === 'completed')).toHaveLength(1);
  expect(
    (
      await post(
        page,
        `/api/collaborations/${raw.id}/advance`,
        step(raw.turns[0].id, { retry: true }),
      )
    ).status(),
  ).toBe(409);
  await page.screenshot({ path: `${shots}/uncertain-billing.png` });
  await page.getByLabel('I understand that retrying may duplicate a provider charge.').check();
  await retry.click();
  await expect(state(page)).toHaveText('Completed');
  const after = await snapshot(page, raw.id);
  expect(after.turns[0].calls).toHaveLength(3);
  expect(after.turns[0].usage.billingUncertain).toBe(true);
  await expect(page.getByText(/Some provider billing is still unknown/)).toBeVisible();
});

test('INTEGRATED: cancellation and source edits prevent further dispatch or stale publication', async ({
  page,
}) => {
  await signIn(page);
  const raw = await (await post(page, '/api/collaborations', input('notebook cancelled'))).json();
  await open(page);
  await page.getByRole('button', { name: 'Collaborations', exact: true }).click();
  await page.locator('.collab-history-row').filter({ hasText: 'notebook cancelled' }).click();
  await expect(state(page)).toHaveText('Queued');
  await page.getByRole('button', { name: 'Cancel run' }).click();
  await expect(state(page)).toHaveText('Cancelled');
  expect((await snapshot(page, raw.id)).turns[0].calls).toHaveLength(0);
  const mem = await (
    await post(page, '/api/memories', {
      title: 'Isolated stale evidence',
      content: 'TEST FIXTURE: zirconium evidence version one',
      region: 'frontal',
      tags: [],
    })
  ).json();
  const stale = await (
    await post(page, '/api/collaborations', input('zirconium evidence', 'deliberate'))
  ).json();
  await post(page, `/api/collaborations/${stale.id}/advance`, step(stale.turns[0].id));
  expect(
    (
      await page.request.put(`/api/memories/${mem.id}`, {
        headers,
        data: {
          title: 'Isolated stale evidence',
          content: 'TEST FIXTURE: zirconium evidence version two',
          region: 'frontal',
          tags: [],
        },
      })
    ).status(),
  ).toBe(200);
  await post(page, `/api/collaborations/${stale.id}/advance`, step(stale.turns[0].id));
  await page.getByRole('button', { name: 'All collaborations' }).click();
  await page.locator('.collab-history-row').filter({ hasText: 'zirconium evidence' }).click();
  await expect(state(page)).toHaveText('Failed');
  await expect(
    page.getByRole('region', { name: 'Multi-AI collaboration' }).getByRole('alert'),
  ).toContainText('Source evidence changed');
  expect((await snapshot(page, stale.id)).turns[0].calls).toHaveLength(2);
});

test('INTEGRATED: duplicate/concurrent requests reserve one stage and private routes reject unsigned access', async ({
  page,
  browser,
}) => {
  await signIn(page);
  const request = input('notebook [TEST SLOW] duplicate');
  const a = await post(page, '/api/collaborations', request),
    b = await post(page, '/api/collaborations', request);
  const first = await a.json();
  expect((await b.json()).id).toBe(first.id);
  const action = step(first.turns[0].id);
  const replies = await Promise.all([
    post(page, `/api/collaborations/${first.id}/advance`, action),
    post(page, `/api/collaborations/${first.id}/advance`, action),
  ]);
  expect(replies.every((r) => r.status() === 200)).toBe(true);
  expect((await snapshot(page, first.id)).turns[0].calls).toHaveLength(2);
  const other = await browser.newContext();
  try {
    expect(
      (await other.request.get(`http://127.0.0.1:3100/api/collaborations/${first.id}`)).status(),
    ).toBe(401);
  } finally {
    await other.close();
  }
});

test('FRONTEND FAULTS: malformed, unavailable and offline replies are rejected without silent mutations', async ({
  page,
}) => {
  await signIn(page);
  let mode = 'malformed',
    writes = 0;
  await page.route('**/api/collaborations', async (route) => {
    if (route.request().method() !== 'GET') {
      writes++;
      return route.continue();
    }
    if (mode === 'offline') return route.abort('internetdisconnected');
    return route.fulfill({
      status: mode === 'unavailable' ? 404 : 200,
      contentType: 'application/json',
      body: JSON.stringify(
        mode === 'unavailable' ? { error: 'Endpoint not found.' } : { version, threads: 'broken' },
      ),
    });
  });
  await compose(page, 'notebook faults');
  await expect(
    page.getByRole('region', { name: 'Multi-AI collaboration' }).getByRole('alert'),
  ).toContainText('could not read');
  mode = 'offline';
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Multi-AI collaboration' }).getByRole('alert'),
  ).toContainText('could not reach');
  mode = 'unavailable';
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Collaboration task' })).toContainText(
    'not available',
  );
  expect(writes).toBe(0);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('INTEGRATED: phone portrait and landscape retain brain navigation and provider tabs', async ({
  page,
}) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await compose(page, 'notebook phone');
  await start(page);
  await expect(state(page)).toHaveText('Completed');
  await page.getByRole('button', { name: 'Claude', exact: true }).click();
  await expect(page.locator('.collab-message')).toContainText('[MOCK anthropic analysis]');
  await page.screenshot({ path: `${shots}/phone-portrait.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: `${shots}/phone-landscape.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Close collaboration', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
});

test('INTEGRATED: keyboard activation, focus and reduced motion use saved real state', async ({
  page,
}) => {
  await signIn(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await compose(page, 'notebook keyboard');
  const heading = page.getByRole('heading', { name: 'New collaboration' });
  await expect(heading).toBeFocused();
  const consent = page.getByLabel(
    'Allow this task and matching passages to be sent to OpenAI and Anthropic.',
  );
  await consent.focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Start collaboration', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveText('Completed');
  await page.getByRole('button', { name: 'GPT', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.collab-message')).toContainText('[MOCK openai analysis]');
  await page.screenshot({ path: `${shots}/keyboard-reduced-motion.png` });
});
