import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Phase 2B: the memory intelligence experience.
// Provider calls go through the isolated MOCK transport configured in playwright.config.ts.
// Tests marked REAL drive the unmodified backend. Tests marked STUBBED replace only the
// browser's GET /api/intelligence response to reach states the mock transport cannot produce.
const origin = 'http://127.0.0.1:3100';
const headers = { origin };
const shots = process.env.ECHO_SHOT_DIR || 'test-results/phase-2b';
mkdirSync(shots, { recursive: true });
const shot = (page: Page, name: string) =>
  page.locator('.inspector').screenshot({ path: `${shots}/${name}.png` });

// The server allows ten registrations per fifteen minutes across the whole browser suite, so
// these tests share two workspaces instead of registering one each. Titles never collide.
const accounts = new Map<string, { email: string; password: string }>();
async function signIn(page: Page, workspace: 'first' | 'second') {
  const known = accounts.get(workspace);
  if (known) {
    const response = await page.request.post('/api/auth/login', { headers, data: known });
    expect(response.status()).toBe(200);
    return;
  }
  const account = {
    email: `phase2b-${workspace}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`,
    password: 'Isolated phase 2b password 42',
  };
  const response = await page.request.post('/api/auth/register', {
    headers,
    data: { ...account, name: `MOCK phase 2b ${workspace}` },
  });
  expect(response.status()).toBe(201);
  accounts.set(workspace, account);
}
async function note(page: Page, title: string, content: string, tags: string[] = []) {
  const response = await page.request.post('/api/memories', {
    headers,
    data: { title, content, region: 'frontal', tags },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; version: number };
}
async function enqueue(page: Page, memoryId: string) {
  const response = await page.request.post('/api/intelligence', {
    headers,
    data: { memoryId, summaryProvider: 'openai', consent: true },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Record<string, unknown> & { id: string; status: string };
}
async function processFully(page: Page, memoryId: string) {
  let job = await enqueue(page, memoryId);
  for (let i = 0; i < 12 && ['queued', 'running', 'retry_wait'].includes(job.status); i++)
    job = await page.request
      .post(`/api/intelligence/${job.id}/run`, { headers, data: {} })
      .then((r) => r.json());
  expect(job.status).toBe('completed');
  return job;
}
async function openIntelligence(page: Page, title: string) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: new RegExp(title) })
    .first()
    .click();
  await expect(page.locator('.memory-intro h2')).toHaveText(title);
  await page.getByRole('button', { name: 'Intelligence', exact: true }).click();
}
const panel = (page: Page) => page.getByRole('region', { name: 'Memory intelligence' });
const state = (page: Page) => page.locator('.iq-state-label');
/** Re-mounts the intelligence section so it fetches its status again. */
async function reopen(page: Page) {
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await page.getByRole('button', { name: 'Intelligence', exact: true }).click();
}
function pageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('REAL: suggested, inferred and confirmed connections are kept apart', async ({ page }) => {
  const errors = pageErrors(page);
  // Runs first in this workspace: its link counts assume no other processed memories exist.
  await signIn(page, 'first');
  // Two notes share an explicit tag; two others are related only by (mock) embedding similarity.
  await note(page, 'Aurora launch plan', 'TEST FIXTURE: Launch Aurora in November.', [
    'aurora',
    'launch',
  ]);
  await note(page, 'Aurora review notes', 'TEST FIXTURE: Aurora review is in October.', [
    'aurora',
    'launch',
  ]);
  const a = await note(page, 'Envelope location', 'TEST FIXTURE: sealed envelope inside the desk.');
  const b = await note(page, 'Credential storage', 'TEST FIXTURE: the credentials are secured.');
  await processFully(page, a.id);
  await processFully(page, b.id);

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: /Aurora launch plan/ })
    .first()
    .click();
  await page.getByRole('button', { name: /Links \(1\)/ }).click();
  const confirmed = page.getByRole('region', { name: /Confirmed by you/ });
  const explicit = page.getByRole('region', { name: /Suggested from explicit tags/ });
  const inferred = page.getByRole('region', { name: /Inferred from meaning/ });
  await expect(confirmed).toContainText('You have not confirmed any link for this memory.');
  await expect(explicit.locator('.edge-card')).toHaveCount(1);
  await expect(explicit.locator('.iq-origin')).toHaveText(
    'Found from an explicit tag or reference',
  );
  await expect(inferred.locator('.edge-card')).toHaveCount(0);
  await shot(page, '12-links-suggested');
  await explicit.getByRole('button', { name: 'Confirm link' }).click();
  await expect(confirmed.locator('.edge-card')).toHaveCount(1);
  await expect(confirmed.locator('.iq-origin')).toHaveText(
    'Found from an explicit tag or reference, confirmed by you',
  );
  await expect(explicit.locator('.edge-card')).toHaveCount(0);

  await page
    .getByRole('button', { name: /Envelope location/ })
    .first()
    .click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Envelope location');
  await page.getByRole('button', { name: /Links \(1\)/ }).click();
  await expect(inferred.locator('.edge-card')).toHaveCount(1);
  await expect(inferred.locator('.iq-origin')).toHaveText('Inferred from meaning');
  await expect(inferred).toContainText('Similar wording is not evidence');
  await expect(inferred.locator('.edge-card')).toContainText('Cosine');
  await expect(confirmed.locator('.edge-card')).toHaveCount(0);
  await shot(page, '13-links-inferred');
  expect(errors).toEqual([]);
});

test('REAL: unprocessed → informed consent → completed summary → evidence → passage in context', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await signIn(page, 'first');
  const text =
    'TEST FIXTURE: The access codes are kept in a sealed envelope inside the desk. Review them in March.';
  await note(page, 'Access code storage', text);
  await openIntelligence(page, 'Access code storage');

  // Unprocessed: plain-language state, an extractive preview that is not presented as AI.
  await expect(state(page)).toHaveText('Not processed');
  await expect(panel(page).locator('.iq-state')).toHaveAttribute('data-state', 'unprocessed');
  await expect(panel(page).locator('.iq-preview')).toContainText(
    'EXTRACTIVE PREVIEW · NOT AI-GENERATED',
  );
  await expect(panel(page).locator('.iq-preview')).toContainText('sealed envelope');
  await expect(panel(page).locator('.generated-analysis')).toHaveCount(0);

  // Consent discloses recipients, cost and retention without exposing a credential.
  const consent = panel(page).locator('.iq-consent');
  for (const heading of ['What is sent', 'Who receives it', 'What it may cost', 'What is kept'])
    await expect(consent.getByText(heading, { exact: true })).toBeVisible();
  await expect(consent).toContainText('at most 16 provider requests');
  await expect(consent).toContainText('ECHO cannot see prices');
  await expect(consent.getByLabel('Summary provider')).toContainText('mock-openai-model');
  await expect(consent).not.toContainText('MOCK-ONLY-NOT-A-CREDENTIAL');
  const generate = page.getByRole('button', { name: 'Generate summary & index', exact: true });
  await expect(generate).toBeDisabled();
  await shot(page, '01-unprocessed-consent');
  await page.getByLabel('Allow processing of this original with these providers.').check();
  await expect(generate).toBeEnabled();
  await generate.click();

  // Completed: every real stage is done and the summary is labelled as AI-generated.
  await expect(state(page)).toHaveText('Completed', { timeout: 30000 });
  await expect(panel(page).locator('.iq-stage.is-done')).toHaveCount(4);
  await expect(panel(page).locator('.iq-counts')).toHaveText('1/1 passages indexed · 1/1 analysed');
  const analysis = panel(page).locator('.generated-analysis');
  await expect(analysis).toContainText('AI-GENERATED SUMMARY · SOURCE V1');
  await expect(analysis).toContainText('[MOCK PROVIDER]');
  await expect(analysis).toContainText('Written by OpenAI · mock-openai-model');
  await expect(panel(page).locator('.iq-preview')).toHaveCount(0);
  await expect(panel(page).getByText('POSSIBLE API COST')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Intelligence', exact: true }).locator('.iq-tab-dot'),
  ).toHaveClass(/is-semantic/);
  // The quoted evidence is shown beside the claim, before any navigation.
  await expect(analysis.locator('.iq-evidence blockquote')).toContainText('sealed envelope');
  await shot(page, '02-completed-summary');

  // Evidence opens the immutable cited passage, highlighted inside the original.
  await page.getByRole('button', { name: 'Original passage 1', exact: true }).click();
  const cited = page.getByRole('region', { name: 'Cited original passage' });
  await expect(cited).toContainText('sealed envelope');
  await expect(cited).toContainText('Fixed reference: source version 1, passage 1.');
  await expect(cited).toBeFocused();
  await expect(page.locator('.original-content .iq-mark')).toHaveText(text);
  await page.getByRole('button', { name: 'Show in original', exact: true }).click();
  await expect(page.locator('.iq-mark')).toBeFocused();
  await shot(page, '03-cited-passage');
  await page.getByRole('button', { name: 'Back to summary', exact: true }).click();
  await expect(analysis).toContainText('[MOCK PROVIDER]');
  await page.getByRole('button', { name: 'Original passage 1', exact: true }).click();
  await page.getByRole('button', { name: 'Clear cited passage', exact: true }).click();
  await expect(cited).toHaveCount(0);
  await expect(page.locator('.iq-mark')).toHaveCount(0);
  // The original was not altered by processing.
  await expect(page.locator('.original-content')).toHaveText(text);
  expect(errors).toEqual([]);
});

test('REAL: queued → cancelled → resumed → completed, then outdated after the original changes', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await signIn(page, 'second');
  const saved = await note(
    page,
    'Recovery plan',
    'TEST FIXTURE: Keep the credentials secured in the vault.',
  );
  await enqueue(page, saved.id);
  await openIntelligence(page, 'Recovery plan');

  await expect(state(page)).toHaveText('Queued');
  await expect(panel(page)).toContainText('no step has started');
  await expect(panel(page).locator('.iq-cost')).toContainText(
    'at most 2 more provider requests (1 to index, 1 to analyse)',
  );
  await expect(panel(page).locator('.iq-stage.is-done')).toHaveCount(1);
  await shot(page, '04-queued');

  await page.getByRole('button', { name: 'Cancel processing', exact: true }).click();
  await expect(state(page)).toHaveText('Cancelled');
  await expect(panel(page).locator('.iq-state')).toHaveAttribute('data-state', 'cancelled');
  await expect(panel(page).locator('.generated-analysis')).toHaveCount(0);
  await shot(page, '05-cancelled');

  await page.getByRole('button', { name: 'Resume cancelled job', exact: true }).click();
  await expect(state(page)).toHaveText('Completed', { timeout: 30000 });
  await expect(panel(page).locator('.generated-analysis')).toContainText('[MOCK PROVIDER]');

  // Editing a note creates version 2. The version 1 summary must be shown as outdated.
  const edited = await page.request.put(`/api/memories/${saved.id}`, {
    headers,
    data: {
      title: 'Recovery plan',
      content: 'TEST FIXTURE: Keep the credentials secured in the new safe, not the vault.',
      region: 'frontal',
      tags: [],
    },
  });
  expect(edited.status()).toBe(200);
  await openIntelligence(page, 'Recovery plan');
  await expect(state(page)).toHaveText('Outdated');
  await expect(panel(page)).toContainText('A summary exists for source version 1');
  await expect(panel(page).locator('.generated-analysis')).toHaveCount(0);
  await expect(panel(page).locator('.iq-preview')).toContainText('new safe');
  await shot(page, '06-outdated-latest');
  await page.getByRole('button', { name: 'View version 1 and its summary', exact: true }).click();
  await expect(page.locator('.version-notice')).toContainText('Viewing source version 1 of 2');
  await expect(state(page)).toHaveText('Outdated');
  await expect(panel(page).locator('.generated-analysis')).toContainText(
    'This summary describes source version 1, not the current text.',
  );
  // Historical versions cannot be processed again.
  await expect(panel(page).locator('.iq-consent')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('STUBBED responses: paused, waiting to retry, failed, needs review and a failed load', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await signIn(page, 'first');
  const saved = await note(
    page,
    'Stubbed states',
    'TEST FIXTURE: Keep the credentials secured in the vault.',
  );
  const real = await enqueue(page, saved.id);
  let override: Record<string, unknown> | 'fail' = {};
  await page.route('**/api/intelligence?*', async (route) => {
    if (override === 'fail')
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'The operation failed. Your existing data has been preserved.',
        }),
      });
    const response = await route.fetch();
    const body = await response.json();
    body.jobs = [{ ...body.jobs[0], ...override }];
    await route.fulfill({ response, json: body });
  });
  // Mutating controls are never reached in this test; fail loudly if the UI calls them.
  await page.route(`**/api/intelligence/${real.id}/**`, (route) => route.abort());

  override = { status: 'queued', total_chunks: 12, embedded: 8, analysed: 0 };
  await openIntelligence(page, 'Stubbed states');
  await expect(state(page)).toHaveText('Paused');
  await expect(panel(page)).toContainText('Nothing runs until you resume');
  await expect(panel(page).locator('.iq-cost')).toContainText(
    'at most 3 more provider requests (1 to index, 2 to analyse)',
  );
  await expect(page.getByRole('button', { name: 'Resume saved job', exact: true })).toBeEnabled();
  await expect(panel(page).locator('.iq-stage.is-current')).toContainText('Index passages');
  await expect(
    page.getByRole('progressbar', { name: 'Memory processing progress' }),
  ).toHaveAttribute('aria-valuetext', '8 of 12 passages indexed, 0 of 12 analysed');
  await shot(page, '07-paused');

  override = {
    status: 'retry_wait',
    total_chunks: 12,
    embedded: 12,
    analysed: 8,
    error: 'Embedding provider returned HTTP 429.',
    next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
  };
  await reopen(page);
  await expect(state(page)).toHaveText('Waiting to retry');
  await expect(panel(page)).toContainText('Next attempt');
  await expect(panel(page).getByRole('alert')).toContainText('HTTP 429');
  await expect(panel(page).locator('.iq-stage.is-current')).toContainText('Analyse passages');

  override = {
    status: 'failed',
    total_chunks: 12,
    embedded: 12,
    analysed: 8,
    error: 'Three attempts reached for this step. No further provider calls will be made.',
  };
  await reopen(page);
  await expect(state(page)).toHaveText('Failed');
  await expect(panel(page).getByRole('alert')).toContainText('Three attempts reached');
  await expect(panel(page).locator('.iq-stage.is-stopped')).toContainText('Analyse passages');
  await expect(
    page.getByRole('button', { name: 'Retry step · API charges may apply', exact: true }),
  ).toBeEnabled();
  await shot(page, '08-failed');

  override = {
    status: 'uncertain',
    total_chunks: 12,
    embedded: 12,
    analysed: 8,
    error: 'Interrupted provider call: billing outcome unknown. Review before retrying.',
  };
  await reopen(page);
  await expect(state(page)).toHaveText('Needs review');
  const retry = page.getByRole('button', {
    name: 'Retry step · API charges may apply',
    exact: true,
  });
  // An unknown billing outcome cannot be retried without an explicit acknowledgement.
  await expect(retry).toBeDisabled();
  await page.getByLabel('I understand retrying may duplicate a provider charge.').check();
  await expect(retry).toBeEnabled();
  await shot(page, '09-needs-review');

  override = 'fail';
  await reopen(page);
  await expect(panel(page).getByRole('alert')).toContainText(
    'Processing history could not be loaded.',
  );
  await expect(panel(page).locator('.iq-state')).toHaveCount(0);
  override = { status: 'completed', total_chunks: 1, embedded: 1, analysed: 1 };
  await page.getByRole('button', { name: 'Retry loading', exact: true }).click();
  await expect(state(page)).toHaveText('Completed');
  // The stub claims completion but no analysis exists, so none may be shown.
  await expect(panel(page)).toContainText('No summary was published for this version.');
  await expect(panel(page).locator('.generated-analysis')).toHaveCount(0);
  expect(errors).toEqual([]);
  // In-flight stubbed requests must not fail the test while the page closes.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('AUGMENTED real analysis: decisions, questions and commitments with numbered evidence and passage stepping', async ({
  page,
}) => {
  const errors = pageErrors(page);
  await signIn(page, 'second');
  const archive = [
    {
      id: 'phase-2b-conversation',
      title: 'Vault decision conversation',
      current_node: 'a',
      mapping: {
        u: {
          parent: null,
          message: {
            id: 'u',
            author: { role: 'user' },
            content: {
              parts: ['TEST FIXTURE: Store the access codes in a sealed envelope inside the desk.'],
            },
            create_time: 1700000000,
          },
        },
        a: {
          parent: 'u',
          message: {
            id: 'a',
            author: { role: 'assistant' },
            content: { parts: ['Agreed. I will keep that location in the record by Friday.'] },
            create_time: 1700000001,
          },
        },
      },
    },
  ];
  const imported = await page.request.post('/api/import?filename=phase-2b.json', {
    headers: { ...headers, 'content-type': 'application/json' },
    data: JSON.stringify(archive),
  });
  expect(imported.ok()).toBe(true);
  let job = await imported.json();
  for (let i = 0; i < 6 && job.status !== 'completed'; i++)
    job = await page.request
      .post(`/api/jobs/${job.id}/run`, { headers, data: {} })
      .then((r) => r.json());
  const memory = (await page.request.get('/api/memories').then((r) => r.json())).memories[0];
  await processFully(page, memory.id);
  const real = await page.request
    .get(`/api/intelligence?memoryId=${memory.id}`)
    .then((r) => r.json());
  const first = real.analyses[0].result.summary[0].citations[0];
  const second = (
    await page.request
      .post('/api/retrieve', {
        headers,
        data: { question: 'location record Friday', mode: 'keyword' },
      })
      .then((r) => r.json())
  ).citations.find((c: { chunkId?: string }) => c.chunkId && c.chunkId !== first.chunkId);
  expect(second?.chunkId).toBeTruthy();
  // The mock provider returns no insights. Add insights that cite the two REAL passages so the
  // structured-insight and multi-passage UI can be exercised against real source references.
  await page.route('**/api/intelligence?*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.analyses[0].result.insights = [
      {
        kind: 'decision',
        text: '[AUGMENTED TEST DATA] The codes go in a sealed envelope inside the desk.',
        citations: [first],
      },
      {
        kind: 'commitment',
        text: '[AUGMENTED TEST DATA] The assistant will record the location by Friday.',
        citations: [{ chunkId: second.chunkId, quote: second.excerpt }, first],
      },
    ];
    await route.fulfill({ response, json: body });
  });
  await openIntelligence(page, 'Vault decision conversation');
  const analysis = panel(page).locator('.generated-analysis');
  await expect(analysis.getByRole('region', { name: 'Decisions' })).toContainText(
    'sealed envelope inside the desk',
  );
  await expect(analysis.getByRole('region', { name: 'Open questions' })).toContainText(
    'No unresolved question is stated in this original.',
  );
  await expect(analysis.getByRole('region', { name: 'Commitments' })).toContainText('by Friday');
  // One passage keeps one number wherever it is cited.
  await expect(
    analysis.getByRole('button', { name: 'Original passage 1', exact: true }),
  ).toHaveCount(3);
  await expect(
    analysis.getByRole('button', { name: 'Original passage 2', exact: true }),
  ).toHaveCount(1);
  await expect(analysis).toContainText('2 original passages are cited.');
  await shot(page, '10-structured-insights');

  await analysis.getByRole('button', { name: 'Original passage 2', exact: true }).click();
  const cited = page.getByRole('region', { name: 'Cited original passage' });
  await expect(cited).toContainText('keep that location in the record');
  await expect(cited).toContainText('Passage 2 of 2 cited');
  await expect(page.locator('.message.is-cited')).toContainText('by Friday');
  await expect(page.locator('.message.is-cited')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Next cited passage' })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous cited passage' }).click();
  await expect(cited).toContainText('sealed envelope');
  await expect(cited).toContainText('Passage 1 of 2 cited');
  await expect(page.locator('.message.is-cited .iq-mark')).toContainText('sealed envelope');
  await shot(page, '11-passage-stepping');
  expect(errors).toEqual([]);
  // In-flight stubbed requests must not fail the test while the page closes.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('STUBBED faults and layout: a broken analysis stays inside its section; mobile and reduced motion', async ({
  page,
}) => {
  await signIn(page, 'first');
  const saved = await note(
    page,
    'Mobile memory',
    'TEST FIXTURE: Keep the credentials secured in the vault.',
  );
  await processFully(page, saved.id);
  // A memory whose stored shape is wrong (as with the double-encoded JSON found on the hosted
  // Preview) must fail inside the inspector, not replace the workspace with an error page.
  let malformed = true;
  await page.route(`**/api/memories/${saved.id}?*`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (malformed) body.messages = '[]';
    await route.fulfill({ response, json: body });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: /Mobile memory/ })
    .first()
    .click();
  await expect(page.locator('.section-fault')).toContainText('This memory could not be displayed');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  malformed = false;
  let mode: 'real' | 'broken' | 'running' = 'real';
  await page.route('**/api/intelligence?*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (mode === 'broken') body.analyses[0].result = { unexpected: true };
    if (mode === 'running')
      body.jobs = [
        {
          ...body.jobs[0],
          status: 'running',
          total_chunks: 12,
          embedded: 8,
          analysed: 0,
          lease_until: new Date(Date.now() + 120_000).toISOString(),
        },
      ];
    await route.fulfill({ response, json: body });
  });
  await openIntelligence(page, 'Mobile memory');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(state(page)).toHaveText('Completed');
  // Nothing in the inspector may force sideways scrolling on a phone.
  const overflow = await page
    .locator('.inspector-scroll')
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const tabs = await page.locator('.panel-tabs button').evaluateAll((buttons) =>
    buttons.map((b) => ({
      pressed: b.getAttribute('aria-pressed'),
      height: b.getBoundingClientRect().height,
    })),
  );
  expect(tabs.filter((t) => t.pressed === 'true')).toHaveLength(1);
  expect(Math.min(...tabs.map((t) => t.height))).toBeGreaterThanOrEqual(40);
  await shot(page, '14-mobile-completed');

  mode = 'running';
  await reopen(page);
  await expect(state(page)).toHaveText('Running');
  await expect(panel(page)).toContainText('started in another session');
  const pulse = () =>
    page.locator('.iq-state-icon').evaluate((el) => getComputedStyle(el, '::after').animationName);
  expect(await pulse()).toBe('iq-pulse');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await pulse()).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await shot(page, '15-mobile-running');

  // A malformed analysis must not replace the whole workspace with a framework error page.
  mode = 'broken';
  await reopen(page);
  await expect(page.locator('.section-fault')).toContainText(
    'Memory intelligence could not be displayed',
  );
  await expect(page.locator('.memory-intro h2')).toHaveText('Mobile memory');
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await expect(page.locator('.original-content')).toContainText('credentials secured');
  await page.getByRole('button', { name: 'Intelligence', exact: true }).click();
  await expect(page.locator('.section-fault')).toContainText('could not be displayed');
  mode = 'real';
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(state(page)).toHaveText('Completed');
  // In-flight stubbed requests must not fail the test while the page closes.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
