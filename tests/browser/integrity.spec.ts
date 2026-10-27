import { test, expect } from '@playwright/test';

test('version editing, graph filters, confirmed deletion and session revocation', async ({
  page,
}) => {
  const email = `integrity-${Date.now()}@example.test`;
  const password = 'Isolated integrity password 42';
  const headers = { origin: 'http://127.0.0.1:3100' };
  const registration = await page.request.post('/api/auth/register', {
    headers,
    data: { email, password, name: 'Integrity test' },
  });
  expect(registration.status()).toBe(201);
  const created = await page.request.post('/api/memories', {
    headers,
    data: {
      title: 'Original plan',
      content: 'Version one of the launch plan. #release',
      region: 'frontal',
    },
  });
  expect(created.status()).toBe(201);
  const original = await created.json();
  await page.goto('/');
  await page.getByRole('button', { name: /Original plan/ }).click();
  await page.getByRole('button', { name: 'Edit as a new version' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Updated plan');
  await page
    .getByLabel('Original note', { exact: true })
    .fill('Version two changes the launch date. #release');
  await page.getByRole('button', { name: 'Save memory', exact: true }).click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Updated plan');
  const updated = await page.request.get(`/api/memories/${original.id}`).then((r) => r.json());
  expect(updated.version).toBe(2);
  expect(updated.position).toEqual(original.position);
  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  await page.getByRole('button', { name: /Version 1/ }).click();
  await expect(page.locator('.version-notice')).toContainText('Viewing source version 1 of 2');
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await expect(page.locator('.original-content')).toHaveText(original.content);
  expect(
    (await page.request.get('/api/graph?source=chatgpt').then((r) => r.json())).filteredTotal,
  ).toBe(0);
  expect(
    (await page.request.get('/api/graph?tag=release').then((r) => r.json())).filteredTotal,
  ).toBe(1);
  const refused = await page.request.delete(`/api/memories/${original.id}`, {
    headers,
    data: { confirm: 'no' },
  });
  expect(refused.status()).toBe(400);
  const deletion = await page.request.delete(`/api/memories/${original.id}`, {
    headers,
    data: { confirm: 'DELETE' },
  });
  expect(deletion.status()).toBe(200);
  expect((await page.request.get(`/api/memories/${original.id}`)).status()).toBe(404);
  const wrongPassword = await page.request.delete('/api/account', {
    headers,
    data: { confirm: 'DELETE MY WORKSPACE', password: 'wrong' },
  });
  expect(wrongPassword.status()).toBe(401);
  const removed = await page.request.delete('/api/account', {
    headers,
    data: { confirm: 'DELETE MY WORKSPACE', password },
  });
  expect(removed.status()).toBe(200);
  expect((await page.request.get('/api/memories')).status()).toBe(401);
});

test('WebGL failure leaves a truthful fallback and a usable account interface', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof getContext>
    ) {
      if (String(args[0]).includes('webgl')) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.getByText('3D view unavailable', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});

test('a delayed authenticated response cannot restore private records after logout', async ({
  page,
}) => {
  const headers = { origin: 'http://127.0.0.1:3100' };
  await page.request.post('/api/auth/register', {
    headers,
    data: {
      name: 'Race fixture',
      email: `race-${Date.now()}@example.test`,
      password: 'Isolated race password 42',
    },
  });
  await page.request.post('/api/memories', {
    headers,
    data: {
      title: 'Private delayed note',
      content: 'This record must not reappear after logout.',
      region: 'temporal',
    },
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Private delayed note/ })).toBeVisible();
  let release!: () => void;
  let captured!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    captured = resolve;
  });
  await page.route('**/api/memories?**', async (route) => {
    const response = await route.fetch();
    captured();
    await waiting;
    await route.fulfill({ response });
  });
  await page.getByLabel('Search memory library').fill('Private');
  await started;
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  const delivered = page.waitForResponse(
    (r) => r.url().includes('/api/memories?') && r.request().method() === 'GET',
  );
  release();
  await delivered;
  await page.waitForTimeout(200);
  await expect(page.getByRole('button', { name: /Private delayed note/ })).toHaveCount(0);
  await expect(page.locator('.composer-footnote')).toContainText('0 memories');
});
