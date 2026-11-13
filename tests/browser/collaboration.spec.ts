import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import {
  createMockBackend,
  type MockBackend,
  type MockOptions,
} from '../fixtures/collaboration-mock';
import type { Citation } from '../../lib/types';

// Phase 4B: the multi-AI collaboration experience.
//
// MOCK CONTRACT tests answer the browser's /api/collaborations requests from
// tests/fixtures/collaboration-mock.ts. They prove the interface against the contract in
// docs/PHASE4_UX_CONTRACT.md, NOT against the real collaboration backend, which does not exist
// at this commit. The one GENUINE test talks to the real server and shows what a reader sees
// today. Everything else (sign-in, memories, citations, passages) is the real application.
const origin = 'http://127.0.0.1:3100';
const headers = { origin };
const shots = process.env.ECHO_SHOT_DIR || 'test-results/phase-4b';
mkdirSync(shots, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png` });

// One workspace for the whole file: the server allows ten registrations per fifteen minutes.
let account: { email: string; password: string } | null = null;
let source: Citation | null = null;
async function signIn(page: Page) {
  if (account) {
    const response = await page.request.post('/api/auth/login', { headers, data: account });
    expect(response.status()).toBe(200);
  } else {
    const fresh = {
      email: `phase4b-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`,
      password: 'Isolated phase 4b password 42',
    };
    const response = await page.request.post('/api/auth/register', {
      headers,
      data: { ...fresh, name: 'MOCK phase 4b' },
    });
    expect(response.status()).toBe(201);
    account = fresh;
  }
  if (!source) source = await realSource(page);
  return source;
}
/** A real saved memory with a real indexed passage, so citations open genuine originals. */
async function realSource(page: Page): Promise<Citation> {
  const text = 'TEST FIXTURE: The access codes are kept in a sealed envelope inside the desk.';
  const saved = await page.request
    .post('/api/memories', {
      headers,
      data: { title: 'Access code storage', content: text, region: 'frontal', tags: [] },
    })
    .then((r) => r.json());
  let job = await page.request
    .post('/api/intelligence', {
      headers,
      data: { memoryId: saved.id, summaryProvider: 'openai', consent: true },
    })
    .then((r) => r.json());
  for (let i = 0; i < 12 && ['queued', 'running', 'retry_wait'].includes(job.status); i++)
    job = await page.request
      .post(`/api/intelligence/${job.id}/run`, { headers, data: {} })
      .then((r) => r.json());
  expect(job.status).toBe('completed');
  const status = await page.request
    .get(`/api/intelligence?memoryId=${saved.id}`)
    .then((r) => r.json());
  return {
    id: saved.id,
    title: 'Access code storage',
    excerpt: text,
    source: 'note',
    region: 'frontal',
    rank: 1,
    version: 1,
    chunkId: status.analyses[0].result.summary[0].citations[0].chunkId,
  };
}
type Wire = 'mock' | 'offline' | 'server-error' | 'malformed';
/** Routes the planned endpoints to the mock backend. `wire.mode` simulates transport faults. */
async function mockBackend(page: Page, options: MockOptions = {}) {
  const backend: MockBackend = createMockBackend(options);
  const wire: { mode: Wire; only?: RegExp } = { mode: 'mock' };
  await page.route('**/api/collaborations**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const faulty = wire.mode !== 'mock' && (!wire.only || wire.only.test(path));
    if (faulty && wire.mode === 'offline') return route.abort('internetdisconnected');
    if (faulty && wire.mode === 'server-error')
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'The operation failed. Your existing data has been preserved.',
        }),
      });
    const result = backend.handle(request.method(), path, request.postDataJSON() ?? undefined);
    const json =
      faulty && wire.mode === 'malformed' && result.status === 200
        ? { ...(result.json as object), status: 'thinking' }
        : result.json;
    await route.fulfill({
      status: result.status,
      contentType: 'application/json',
      body: JSON.stringify(json),
    });
  });
  return { backend, wire };
}
const advances = (backend: MockBackend) =>
  backend.calls.filter((c) => c.path.endsWith('/advance')).length;
async function openWorkspace(page: Page) {
  await page.goto('/');
  // The Collaborate option exists only once the private workspace has loaded (any screen size).
  await expect(
    page.getByLabel('Retrieval mode').locator('option[value="collaborate"]'),
  ).toHaveCount(1);
}
/** Chooses Collaborate in the existing mode selector and submits a task from the composer bar. */
async function compose(page: Page, task: string) {
  await page.getByLabel('Retrieval mode').selectOption('collaborate');
  await page.getByLabel('Ask your memory').fill(task);
  await page.getByRole('button', { name: 'Search or ask', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New collaboration' })).toBeVisible();
}
async function start(page: Page, mode: 'Parallel analysis' | 'Deliberate collaboration') {
  await page.getByRole('radio', { name: new RegExp(mode) }).check();
  await page
    .getByLabel('Allow this task and matching passages to be sent to OpenAI and Anthropic.')
    .check();
  await page.getByRole('button', { name: 'Start collaboration', exact: true }).click();
}
const panel = (page: Page) => page.getByRole('region', { name: 'Multi-AI collaboration' });
const state = (page: Page) => page.locator('.collab-state-label');
const stepLabels = (page: Page) => page.locator('.collab-step-label').allInnerTexts();
function pageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('GENUINE: the real server has no collaboration backend yet, and the interface says so without sending anything', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await signIn(page);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/collaborations')) requests.push(`${r.method()} ${r.url()}`);
  });
  await openWorkspace(page);
  // Every existing mode is still offered beside the new one.
  await expect(page.getByLabel('Retrieval mode').locator('option')).toHaveText([
    'Source search',
    'Hybrid source search',
    'OpenAI · mock-openai-model',
    'Anthropic · mock-anthropic-model',
    'Compare + synthesise',
    'Collaborate · GPT + Claude',
  ]);
  await compose(page, 'Where are the access codes kept?');
  await expect(panel(page).getByRole('list').filter({ hasText: 'not available' })).toContainText(
    'The collaboration service is not available on this server yet.',
  );
  await page
    .getByLabel('Allow this task and matching passages to be sent to OpenAI and Anthropic.')
    .check();
  await expect(
    page.getByRole('button', { name: 'Start collaboration', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'All collaborations' }).click();
  await expect(panel(page).getByRole('alert')).toContainText('Nothing was sent to an AI provider.');
  // Only read requests were made; no run was created.
  expect(requests.every((r) => r.startsWith('GET '))).toBe(true);
  await shot(page, '01-genuine-backend-unavailable');
  expect(errors).toEqual([]);
});

test('MOCK CONTRACT: parallel analysis from disclosure and consent to a cited combined result', async ({
  page,
}) => {
  const errors = pageErrors(page);
  const cited = await signIn(page);
  const { backend } = await mockBackend(page, { citations: [cited] });
  await openWorkspace(page);
  await compose(page, 'Where are the access codes kept?');

  const composer = page.getByRole('form', { name: 'Collaboration task' });
  await expect(composer.getByLabel('Task', { exact: true })).toHaveValue(
    'Where are the access codes kept?',
  );
  for (const heading of [
    'Who receives data',
    'What is sent',
    'Provider requests',
    'Possible cost',
    'What is stored',
    'Cancelling',
  ])
    await expect(composer.getByText(heading, { exact: true })).toBeVisible();
  await expect(composer).toContainText('At most 3 for parallel analysis');
  await page.getByRole('radio', { name: /Deliberate collaboration/ }).check();
  await expect(composer).toContainText('At most 5 for deliberate collaboration');
  await expect(composer).toContainText('ECHO has no price data and shows no amounts.');
  await expect(composer).toContainText('may still finish and be billed');
  await expect(composer.getByLabel('Participating models')).toContainText(
    'OpenAI · mock-openai-model',
  );
  await expect(composer.getByLabel('Participating models')).toContainText(
    'Anthropic · mock-anthropic-model',
  );
  await expect(composer).not.toContainText('MOCK-ONLY-NOT-A-CREDENTIAL');
  await expect(composer).not.toContainText(/[$£€]\s?\d/);
  const startButton = page.getByRole('button', { name: 'Start collaboration', exact: true });
  await expect(startButton).toBeDisabled();
  await shot(page, '02-composer-disclosure');
  // Nothing billable has been requested before consent.
  expect(backend.calls.every((c) => c.method === 'GET')).toBe(true);

  await start(page, 'Parallel analysis');
  await expect(state(page)).toHaveText('Completed', { timeout: 20000 });
  expect(
    backend.calls.find((c) => c.method === 'POST' && c.path === '/api/collaborations')?.body,
  ).toMatchObject({ task: 'Where are the access codes kept?', mode: 'parallel', consent: true });
  expect(advances(backend)).toBe(3);
  expect(await stepLabels(page)).toEqual([
    'Context prepared',
    'GPT analysed',
    'Claude analysed',
    'Synthesis written · GPT',
  ]);
  await expect(panel(page).locator('.collab-usage')).toContainText(
    '3 of at most 3 provider requests used.',
  );
  await expect(page.locator('.app-shell')).toHaveAttribute('data-place', 'collaboration');
  await expect(page.getByLabel('Brain navigation')).toContainText('Collaboration');
  await expect(page.locator('canvas')).toBeVisible();

  // Combined result: agreement, disagreement, open questions and unverified points stay apart.
  const result = panel(page).locator('.collab-result');
  await expect(result).toContainText('The models did not settle everything.');
  await expect(result.getByRole('region', { name: 'Joint conclusions' })).toContainText(
    'sealed envelope inside the desk',
  );
  const disagreement = result.getByRole('region', { name: 'Disagreements' });
  await expect(disagreement.locator('.collab-position.lane-openai')).toContainText(
    'GPT [MOCK] The note fixes the review in March.',
  );
  await expect(disagreement.locator('.collab-position.lane-anthropic')).toContainText(
    'Claude [MOCK] March is mentioned, but not as a commitment.',
  );
  await expect(result.getByRole('region', { name: 'Open questions' })).toContainText(
    'Who is responsible',
  );
  await expect(result.getByRole('region', { name: 'Unverified interpretations' })).toContainText(
    'Treat as unverified',
  );
  await shot(page, '03-combined-result');

  // Each model's own output, attributed, with usage only where it was reported.
  await page.getByRole('button', { name: 'GPT', exact: true }).click();
  const gpt = panel(page).locator('.collab-message');
  await expect(gpt).toHaveCount(2);
  await expect(gpt.first()).toContainText('INDEPENDENT ANALYSIS BY GPT');
  await expect(gpt.first()).toContainText('OpenAI · mock-openai-model');
  await expect(gpt.first()).toContainText('130 tokens reported');
  await expect(gpt.first()).toContainText('[MOCK GPT ANALYSIS]');
  await page.getByRole('button', { name: 'Claude', exact: true }).click();
  await expect(panel(page).locator('.collab-message')).toHaveCount(1);
  await expect(panel(page).locator('.collab-message')).toContainText(
    'Anthropic · mock-anthropic-model',
  );
  await expect(panel(page).locator('.collab-message')).toContainText('token usage not reported');
  await shot(page, '04-claude-output');

  // A citation opens the real original at the cited passage, and Back returns to the run.
  await page.getByRole('button', { name: /Sources \(1\)/ }).click();
  await panel(page).locator('.citation').click();
  await expect(page.getByRole('region', { name: 'Cited original passage' })).toContainText(
    'sealed envelope',
  );
  await expect(page.locator('.memory-intro h2')).toHaveText('Access code storage');
  await page.getByRole('button', { name: /^Back/ }).first().click();
  await expect(state(page)).toHaveText('Completed');
  await expect(panel(page).locator('.collab-result')).toContainText('sealed envelope');
  // Returning did not request another stage.
  expect(advances(backend)).toBe(3);
  expect(errors).toEqual([]);
});

test('MOCK CONTRACT: deliberate collaboration waits for continuation and attributes each cross-review', async ({
  page,
}) => {
  const errors = pageErrors(page);
  const cited = await signIn(page);
  const { backend } = await mockBackend(page, { citations: [cited], pauseBeforeReview: true });
  await openWorkspace(page);
  await compose(page, 'Compare the storage plan with the review plan.');
  await start(page, 'Deliberate collaboration');

  await expect(state(page)).toHaveText('Awaiting continuation', { timeout: 20000 });
  await expect(panel(page)).toContainText('The next stage starts only when you continue.');
  const before = advances(backend);
  expect(await stepLabels(page)).toEqual([
    'Context prepared',
    'GPT analysed',
    'Claude analysed',
    'GPT review of Claude',
    'Claude review of GPT',
    'Synthesis · GPT',
  ]);
  await expect(panel(page).locator('.collab-usage')).toContainText('2 of at most 5');
  await shot(page, '05-awaiting-continuation');
  // A paused run does not move on by itself.
  await page.waitForTimeout(1500);
  expect(advances(backend)).toBe(before);
  await expect(panel(page)).toContainText('No combined result has been saved for this turn yet.');

  await page.getByRole('button', { name: 'Continue to next stage', exact: true }).click();
  await expect(state(page)).toHaveText('Completed', { timeout: 20000 });
  expect(await stepLabels(page)).toContain('Claude reviewed GPT');
  await page.getByRole('button', { name: 'Claude', exact: true }).click();
  const messages = panel(page).locator('.collab-message');
  await expect(messages).toHaveCount(2);
  await expect(messages.nth(1)).toContainText('CLAUDE REVIEWING GPT');
  await expect(messages.nth(1)).toContainText('[MOCK Claude REVIEW]');
  await page.getByRole('button', { name: 'GPT', exact: true }).click();
  await expect(panel(page).locator('.collab-message').nth(1)).toContainText('GPT REVIEWING CLAUDE');
  await shot(page, '06-cross-review');
  expect(errors).toEqual([]);
});

test('MOCK CONTRACT: running, failed, needs-review and cancelled all come from saved state', async ({
  page,
}) => {
  const errors = pageErrors(page);
  const cited = await signIn(page);
  const { backend } = await mockBackend(page, { citations: [cited], pauseBeforeReview: true });
  // A run saved by "another session": in flight, and not driven by this window.
  const saved = backend.handle('POST', '/api/collaborations', {
    task: 'Saved elsewhere',
    mode: 'parallel',
    consent: true,
  }).json as { id: string };
  backend.edit(saved.id, (c) => {
    c.status = 'running';
    c.turns[0].status = 'running';
    c.turns[0].steps[0].status = 'succeeded';
    c.turns[0].steps[1].status = 'running';
    c.turns[0].steps[2].status = 'running';
  });
  await openWorkspace(page);
  await page.getByRole('button', { name: 'Collaborations', exact: true }).click();
  await page.getByRole('button', { name: /Saved elsewhere/ }).click();
  await expect(state(page)).toHaveText('Running');
  await expect(panel(page).locator('.collab-activity')).toHaveText(
    'GPT analysing and Claude analysing',
  );
  await expect(page.locator('.collab-step.is-running')).toHaveCount(2);
  // Opening a saved run never starts provider work without being asked.
  await expect(page.getByRole('button', { name: 'Resume run', exact: true })).toBeVisible();
  await page.waitForTimeout(1200);
  expect(advances(backend)).toBe(0);
  await shot(page, '07-running-saved-state');

  // Uncertain billing: the run stops and nothing is repeated until the reader acknowledges.
  await page.getByRole('button', { name: 'New collaboration' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Check the review date.');
  backend.failNextStage('uncertain');
  await start(page, 'Parallel analysis');
  await expect(state(page)).toHaveText('Needs review', { timeout: 20000 });
  await expect(panel(page).getByRole('alert')).toContainText('billing outcome unknown');
  await expect(page.locator('.collab-step.is-uncertain')).toContainText('Outcome unknown');
  const stalled = advances(backend);
  await page.waitForTimeout(1500);
  expect(advances(backend)).toBe(stalled);
  const retry = page.getByRole('button', {
    name: 'Retry stage · API charges may apply',
    exact: true,
  });
  await expect(retry).toBeDisabled();
  await shot(page, '08-needs-review');
  await page.getByLabel('I understand that retrying may duplicate a provider charge.').check();
  await retry.click();
  await expect(state(page)).toHaveText('Completed', { timeout: 20000 });
  expect(backend.calls.filter((c) => c.path.endsWith('/advance')).at(stalled)?.body).toEqual({
    action: 'retry',
    acknowledgeCharge: true,
  });

  // A failed stage offers a retry and shows the saved error.
  await page.getByRole('button', { name: 'New collaboration' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Fail once.');
  backend.failNextStage('failed');
  await start(page, 'Parallel analysis');
  await expect(state(page)).toHaveText('Failed', { timeout: 20000 });
  await expect(page.locator('.collab-step.is-failed')).toContainText('GPT analysis');
  await expect(panel(page).getByRole('alert')).toContainText('HTTP 500');
  await expect(panel(page)).toContainText('No combined result has been saved for this turn yet.');
  await shot(page, '09-failed');

  // Cancelling a paused run stops it and says what cancelling cannot guarantee.
  await page.getByRole('button', { name: 'New collaboration' }).click();
  await page.getByLabel('Task', { exact: true }).fill('Cancel me.');
  await start(page, 'Deliberate collaboration');
  await expect(state(page)).toHaveText('Awaiting continuation', { timeout: 20000 });
  await expect(panel(page)).toContainText('may still finish and be billed');
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click();
  await expect(state(page)).toHaveText('Cancelled');
  await expect(page.locator('.collab-step.is-cancelled')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Continue to next stage' })).toHaveCount(0);
  // The analyses finished before cancelling are still readable.
  await page.getByRole('button', { name: 'GPT', exact: true }).click();
  await expect(panel(page).locator('.collab-message')).toContainText('[MOCK GPT ANALYSIS]');
  expect(errors).toEqual([]);
});

test('MOCK CONTRACT: history survives a reload and a follow-up continues the same thread', async ({
  page,
}) => {
  const errors = pageErrors(page);
  const cited = await signIn(page);
  const { backend } = await mockBackend(page, { citations: [cited] });
  await openWorkspace(page);
  await compose(page, 'Where are the access codes kept?');
  await start(page, 'Parallel analysis');
  await expect(state(page)).toHaveText('Completed', { timeout: 20000 });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Collaborations', exact: true }).click();
  const row = page.getByRole('button', { name: /Where are the access codes kept\?/ });
  await expect(row).toContainText('Completed · Parallel analysis · 1 turn');
  await shot(page, '10-history');
  await row.click();
  await expect(state(page)).toHaveText('Completed');
  await expect(panel(page).locator('.collab-result')).toContainText('sealed envelope');
  const reopened = advances(backend);

  const follow = page.getByRole('form', { name: 'Follow-up question' });
  const send = follow.getByRole('button', { name: 'Send follow-up', exact: true });
  await follow.getByLabel('Continue this collaboration').fill('Who should review them?');
  await expect(send).toBeDisabled();
  await follow.getByLabel(/Send this follow-up and matching passages/).check();
  await send.click();
  await expect(page.getByRole('button', { name: 'Turn 2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(state(page)).toHaveText('Completed', { timeout: 20000 });
  expect(advances(backend)).toBe(reopened + 3);
  await expect(panel(page).locator('.collab-prompt')).toContainText('Who should review them?');
  await page.getByRole('button', { name: 'GPT', exact: true }).click();
  await expect(panel(page).locator('.collab-message').first()).toContainText(
    'Turn 2: Who should review them?',
  );
  // The first turn is still there, unchanged.
  await page.getByRole('button', { name: 'Turn 1', exact: true }).click();
  await expect(panel(page).locator('.collab-prompt')).toContainText(
    'Where are the access codes kept?',
  );
  await expect(panel(page).locator('.collab-message').first()).toContainText('Turn 1:');
  await shot(page, '11-follow-up-turns');
  expect(backend.store.size).toBe(1);
  expect(errors).toEqual([]);
});

test('MOCK CONTRACT: server failure, offline and an unreadable response are reported, never retried silently', async ({
  page,
}) => {
  const errors = pageErrors(page);
  const cited = await signIn(page);
  const { backend, wire } = await mockBackend(page, { citations: [cited] });
  await openWorkspace(page);
  await compose(page, 'Go offline mid-run.');
  // The network drops when the first stage is requested.
  wire.mode = 'offline';
  wire.only = /\/advance$/;
  await start(page, 'Parallel analysis');
  await expect(panel(page).getByRole('alert')).toContainText('could not reach the server');
  await expect(panel(page).getByRole('alert')).toContainText('It will not repeat it for you.');
  await expect(state(page)).toHaveText('Queued');
  await expect(page.getByRole('button', { name: 'Resume run', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  // Exactly one stage request was attempted while offline.
  expect(advances(backend)).toBe(0);
  await shot(page, '12-offline');
  wire.mode = 'mock';
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await expect(state(page)).toHaveText('Completed', { timeout: 20000 });

  // A failing server when reopening a saved run.
  wire.mode = 'server-error';
  wire.only = /\/collab-\d+$/;
  await page.getByRole('button', { name: 'All collaborations' }).click();
  await page.getByRole('button', { name: /Go offline mid-run\./ }).click();
  await expect(panel(page).getByRole('alert')).toContainText('The operation failed.');
  await expect(state(page)).toHaveCount(0);
  wire.mode = 'mock';
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(state(page)).toHaveText('Completed');

  // A response outside the contract is refused rather than half-rendered.
  wire.mode = 'malformed';
  await page.getByRole('button', { name: 'All collaborations' }).click();
  await page.getByRole('button', { name: /Go offline mid-run\./ }).click();
  await expect(panel(page).getByRole('alert')).toContainText(
    'ECHO could not read the collaboration returned by the server',
  );
  await expect(panel(page).locator('.collab-result')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('MOCK CONTRACT: phone portrait and landscape keep the brain in view and switch between models', async ({
  page,
}) => {
  const errors = pageErrors(page);
  const cited = await signIn(page);
  await mockBackend(page, { citations: [cited] });
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await compose(page, 'Where are the access codes kept?');
  await start(page, 'Parallel analysis');
  await expect(state(page)).toHaveText('Completed', { timeout: 20000 });

  const fits = async () =>
    page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: (() => {
        const el = document.querySelector('.collab-body')!;
        return el.scrollWidth - el.clientWidth;
      })(),
    }));
  expect(await fits()).toEqual({ page: 0, body: 0 });
  // The existing phone navigation names the collaboration, and the anatomy stays on screen.
  await expect(page.getByRole('navigation', { name: 'Workspace' })).toContainText('Collaborate');
  const canvas = await page.locator('canvas').boundingBox();
  expect(canvas!.height).toBeGreaterThan(120);
  // Model outputs are switched, not squeezed side by side.
  await page.getByRole('button', { name: 'Claude', exact: true }).click();
  await expect(panel(page).locator('.collab-message')).toHaveCount(1);
  const tabs = await page
    .locator('.collab-tabs button')
    .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
  expect(Math.min(...tabs)).toBeGreaterThanOrEqual(40);
  await shot(page, '13-phone-portrait');

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(state(page)).toHaveText('Completed');
  expect((await fits()).page).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    ),
  ).toBe(0);
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Combined result', exact: true }).click();
  await expect(panel(page).locator('.collab-result')).toContainText('sealed envelope');
  await shot(page, '14-phone-landscape');
  expect(errors).toEqual([]);
});

test('MOCK CONTRACT: keyboard-only use, announcements and reduced motion', async ({ page }) => {
  const errors = pageErrors(page);
  const cited = await signIn(page);
  const { backend } = await mockBackend(page, { citations: [cited] });
  await openWorkspace(page);
  await page.getByLabel('Retrieval mode').selectOption('collaborate');
  await expect(page.getByText('Opens a task composer · nothing is sent yet')).toBeVisible();
  // "/" reaches the task field; Enter opens the composer and moves focus to its heading.
  await page.locator('body').press('/');
  await expect(page.getByLabel('Ask your memory')).toBeFocused();
  await page.keyboard.type('Where are the access codes kept?');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'New collaboration' })).toBeFocused();
  await expect(page.getByTestId('place-announcement')).toHaveText('New collaboration');
  // Tab order: task, mode, consent, start. Space toggles, Enter submits.
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Task', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: /Parallel analysis/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /Deliberate collaboration/ })).toBeChecked();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(
    page.getByLabel('Allow this task and matching passages to be sent to OpenAI and Anthropic.'),
  ).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Start collaboration', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveText('Completed', { timeout: 20000 });
  // Status changes are announced politely; the run title takes focus.
  await expect(panel(page).locator('.collab-activity')).toHaveAttribute('aria-live', 'polite');
  await expect(
    page.getByRole('heading', { name: 'Where are the access codes kept?' }),
  ).toBeFocused();
  await expect(page.getByTestId('place-announcement')).toHaveText(
    'Collaboration opened: Where are the access codes kept?',
  );
  const pressed = await page
    .locator('.collab-tabs button')
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-pressed')));
  expect(pressed).toEqual(['true', 'false', 'false', 'false']);
  // Escape walks back through the trail: run, composer, whole brain.
  await page.locator('body').press('Escape');
  await expect(page.getByRole('heading', { name: 'New collaboration' })).toBeVisible();
  await page.locator('body').press('Escape');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-place', 'whole');

  // Reduced motion: a running step stops pulsing for the system setting and the saved app one.
  const saved = backend.handle('POST', '/api/collaborations', {
    task: 'Motion check',
    mode: 'parallel',
    consent: true,
  }).json as { id: string };
  backend.edit(saved.id, (c) => {
    c.status = 'running';
    c.turns[0].steps[1].status = 'running';
  });
  const pulse = () =>
    page
      .locator('.collab-step.is-running .collab-step-mark')
      .evaluate((el) => getComputedStyle(el).animationName);
  await page.getByRole('button', { name: 'Collaborations', exact: true }).click();
  await page.getByRole('button', { name: /Motion check/ }).click();
  await expect(state(page)).toHaveText('Running');
  expect(await pulse()).toBe('collab-pulse');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await pulse()).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => localStorage.setItem('echo-reduced-motion', 'true'));
  await page.reload();
  await page.getByRole('button', { name: 'Collaborations', exact: true }).click();
  await page.getByRole('button', { name: /Motion check/ }).click();
  await expect(state(page)).toHaveText('Running');
  expect(await pulse()).toBe('none');
  await page.evaluate(() => localStorage.removeItem('echo-reduced-motion'));
  expect(errors).toEqual([]);
});
