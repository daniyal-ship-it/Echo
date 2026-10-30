import { test, expect } from '@playwright/test';

test('MOCK providers: imported original → generated summary → hybrid answer → cited passage → new session', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const email = `intelligence-${Date.now()}@example.test`,
    password = 'Isolated mocked pipeline password 42',
    headers = { origin: 'http://127.0.0.1:3100' };
  expect(
    (
      await page.request.post('/api/auth/register', {
        headers,
        data: { email, password, name: 'MOCK intelligence review' },
      })
    ).status(),
  ).toBe(201);
  const archive = [
    {
      id: 'mock-vault-conversation',
      title: 'Vault setup conversation',
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
            content: { parts: ['I will keep that location in the record.'] },
            create_time: 1700000001,
          },
        },
      },
    },
  ];
  await page.goto('/');
  // Settings is also rendered before session hydration. Wait for the private workspace.
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  for (const name of ['OpenAI', 'Anthropic']) {
    await page.getByRole('button', { name: `Check ${name} model access`, exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `mock-${name.toLowerCase()}-model` }),
    ).toContainText('Live answers still need testing');
  }
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Import history', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'fixture-conversations.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await expect(
    page.getByText('1 records added · 0 duplicates skipped', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: /Vault setup conversation/ }).click();
  await expect(page.locator('.messages')).toContainText('sealed envelope');
  const saved = (await page.request.get('/api/memories').then((r) => r.json())).memories[0];
  const before = await page.request.get(`/api/memories/${saved.id}`).then((r) => r.json());
  await page.getByRole('button', { name: 'Intelligence', exact: true }).click();
  await page.getByLabel('Allow processing of this original with these providers.').check();
  await page.getByRole('button', { name: 'Generate summary & index', exact: true }).click();
  await expect(page.locator('.intelligence-status strong')).toContainText('completed', {
    timeout: 30000,
  });
  await expect(page.locator('.generated-analysis')).toContainText('[MOCK PROVIDER]');
  await page.screenshot({ path: 'docs/screenshots/intelligence-mock-summary.png' });
  const status = await page.request
    .get(`/api/intelligence?memoryId=${saved.id}`)
    .then((r) => r.json());
  expect(status.analyses).toHaveLength(1);
  expect(status.jobs[0].embedded).toBe(2);
  const replay = await page.request
    .post('/api/intelligence', {
      headers,
      data: { memoryId: saved.id, summaryProvider: 'openai', consent: true },
    })
    .then((r) => r.json());
  expect(replay.id).toBe(status.jobs[0].id);
  expect(replay.status).toBe('completed');
  await page.getByRole('button', { name: 'Original passage 1', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Cited original passage' })).toContainText(
    'sealed envelope',
  );
  await page.screenshot({ path: 'docs/screenshots/intelligence-mock-passage.png' });
  // Restrict the demonstration to the imported original, excluding newly saved AI answers.
  await page.getByRole('button', { name: 'Filter memories', exact: true }).click();
  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('chatgpt');
  await page.getByLabel('Use these filters for questions').check();
  const question = 'Where were the credentials secured?';
  await page.getByLabel('Retrieval mode').selectOption('hybrid');
  await page.getByLabel('Ask your memory').fill(question);
  await page.getByRole('button', { name: 'Search or ask', exact: true }).click();
  await page.getByRole('button', { name: 'Send this context', exact: true }).click();
  await expect(page.locator('.citation')).toHaveCount(1);
  await expect(page.locator('.retrieval-panel')).toContainText('Keyword and semantic');
  for (const provider of ['openai', 'anthropic']) {
    await page.getByLabel('Retrieval mode').selectOption(provider);
    await page.getByLabel('Ask your memory').fill(question);
    await page.getByRole('button', { name: 'Search or ask', exact: true }).click();
    await page.getByRole('button', { name: 'Send this context', exact: true }).click();
    await expect(page.locator('.ai-output')).toHaveCount(1);
    await expect(page.locator('.ai-output')).toContainText(`[MOCK PROVIDER]`);
    await expect(page.locator('.ai-output .eyebrow')).toContainText(provider);
    await page.screenshot({ path: `docs/screenshots/intelligence-mock-${provider}.png` });
    await page.locator('.citation').click();
    await expect(page.getByRole('region', { name: 'Cited original passage' })).toContainText(
      'sealed envelope',
    );
  }
  const after = await page.request.get(`/api/memories/${saved.id}`).then((r) => r.json());
  expect(after.raw).toEqual(before.raw);
  expect(after.version).toBe(1);
  expect(after.position).toEqual(before.position);
  const unsupported = await page.request
    .post('/api/assistant', {
      headers,
      data: {
        question: 'What spacecraft deadline was promised?',
        providers: ['openai'],
        semantic: true,
        consent: true,
        filters: { source: 'chatgpt' },
      },
    })
    .then((r) => r.json());
  expect(unsupported.outputs).toHaveLength(0);
  expect(unsupported.notice).toContain('Insufficient');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: /Vault setup conversation/ })).toBeVisible();
  const persisted = await page.request
    .get(`/api/intelligence?memoryId=${saved.id}`)
    .then((r) => r.json());
  expect(persisted.analyses[0].id).toBe(status.analyses[0].id);
  const again = await page.request
    .post('/api/retrieve', {
      headers,
      data: { question, mode: 'hybrid', consent: true, filters: { source: 'chatgpt' } },
    })
    .then((r) => r.json());
  expect(again.citations[0].id).toBe(saved.id);
  expect(again.citations[0].chunkId).toBe(
    status.analyses[0].result.summary[0].citations[0].chunkId,
  );
  expect(errors).toEqual([]);
});
