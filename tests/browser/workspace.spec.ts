import { test, expect } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { mkdir } from 'node:fs/promises';

test('real workspace: anatomy, persistence, archive import, citations, data isolation and mobile', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const suffix = Date.now();
  const email = `visual-${suffix}@example.test`;
  const password = 'Isolated browser test password 42';
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('3D ANATOMICAL VIEW', { exact: true })).toBeVisible();
  // A previous isolated run can leave users; the test server explicitly permits registration.
  if (await page.getByRole('button', { name: 'Create an account', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Visual review');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create private workspace' }).click();
  await expect(page.getByText('The beginning of an archive.')).toBeVisible();
  await page.getByRole('button', { name: 'Create a labelled demonstration memory' }).click();
  await expect(page.locator('.memory-intro h2')).toHaveText('A place for an idea');
  await expect(page.locator('.original-content')).toContainText('DEMONSTRATION DATA');
  const demo = await page.request.get('/api/graph').then((r) => r.json());
  expect(demo.total).toBe(1);
  expect(demo.nodes[0].is_demo).toBe(true);
  const position = demo.nodes[0].position;
  const id = demo.nodes[0].id;
  await page.reload();
  await expect(page.getByRole('button', { name: /A place for an idea/ })).toBeVisible();
  // Exercise actual 3D raycasting, not just the library's selection shortcut.
  await page.getByRole('button', { name: 'Reset brain view', exact: true }).click();
  await page.waitForTimeout(1400);
  const box = (await page.locator('canvas').boundingBox())!;
  const camera = new PerspectiveCamera(32, box.width / box.height, 0.01, 50);
  camera.position.set(-4.8, 1.1, -2.8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const projected = new Vector3(...(position as [number, number, number])).project(camera);
  await page.mouse.click(
    box.x + ((projected.x + 1) * box.width) / 2,
    box.y + ((1 - projected.y) * box.height) / 2,
  );
  await expect(page.locator('.memory-intro h2')).toHaveText('A place for an idea');
  await mkdir('docs/screenshots', { recursive: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/screenshots/memory-selected.png' });
  await page.getByRole('button', { name: 'Close memory', exact: true }).click();
  for (const [label, file] of [
    ['Anterior view', 'front'],
    ['Left lateral view', 'side'],
    ['Three-quarter view', 'three-quarter'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `docs/screenshots/${file}.png` });
  }
  // Rotation, pan and zoom change the rendered image without losing the canvas.
  const before = await page.locator('canvas').screenshot();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 15 });
  await page.mouse.up();
  await page.mouse.wheel(0, -180);
  await page.waitForTimeout(800);
  const after = await page.locator('canvas').screenshot();
  expect(before.equals(after)).toBe(false);
  await page.getByRole('button', { name: 'New memory', exact: true }).last().click();
  await page.getByLabel('Title', { exact: true }).fill('Aurora launch decision');
  await page
    .getByLabel('Original note', { exact: true })
    .fill('We agreed to launch Aurora in November after the accessibility review. #aurora #launch');
  await page.getByLabel('Primary region').selectOption('frontal');
  await page.getByRole('button', { name: 'Save memory', exact: true }).click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Aurora launch decision');
  const originalArchive = [
    {
      id: 'e2e-chat',
      title: 'Aurora design conversation',
      current_node: 'a',
      mapping: {
        u: {
          parent: null,
          message: {
            id: 'u',
            author: { role: 'user' },
            content: { parts: ['Discuss the Aurora launch. #aurora #launch'] },
            create_time: 1700000000,
          },
        },
        a: {
          parent: 'u',
          message: {
            id: 'a',
            author: { role: 'assistant' },
            content: { parts: ['Preserve accessibility findings in the launch plan.'] },
            create_time: 1700000001,
          },
        },
        branch: {
          parent: 'u',
          message: {
            id: 'branch',
            author: { role: 'assistant' },
            content: { parts: ['An alternate approach, preserved in the original.'] },
          },
        },
      },
    },
  ];
  await page.getByRole('button', { name: 'Import history', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'conversations.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(originalArchive)),
    });
  await expect(
    page.getByText('1 records added · 0 duplicates skipped', { exact: true }),
  ).toBeVisible();
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'conversations.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(originalArchive)),
    });
  await expect(
    page.getByText('This exact archive is already imported. No records were duplicated.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: /Aurora design conversation/ }).click();
  await expect(page.locator('.messages')).toContainText('Preserve accessibility findings');
  await expect(page.locator('.messages')).not.toContainText('An alternate approach');
  await page.getByLabel('Include other conversation branches').check();
  await expect(page.locator('.messages')).toContainText('An alternate approach');
  await page.getByRole('button', { name: /Links \(/ }).click();
  await expect(page.locator('.edge-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Confirm link' }).click();
  await expect(page.locator('.edge-card .status-label')).toHaveText('confirmed');
  await page.getByLabel('Ask your memory').fill('What did we decide about the Aurora launch?');
  await page.getByRole('button', { name: 'Search or ask', exact: true }).click();
  await expect(page.locator('.citation')).toHaveCount(2);
  await expect(page.locator('.citation')).toContainText(['Aurora', 'Aurora']);
  await expect(page.getByText('SOURCE EXCERPTS · NO GENERATED ANSWER')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/retrieval.png' });
  const exported = await page.request.get('/api/export').then((r) => r.json());
  expect(exported.memories).toHaveLength(3);
  expect(
    exported.versions.find((v: { raw: { id?: string } }) => v.raw.id === 'e2e-chat').raw,
  ).toEqual(originalArchive[0]);
  // No session = no data; different valid workspace = no data.
  const other = await browser.newContext();
  const anon = await other.request.get('http://127.0.0.1:3100/api/memories');
  expect(anon.status()).toBe(401);
  await other.request.post('http://127.0.0.1:3100/api/auth/register', {
    headers: { origin: 'http://127.0.0.1:3100' },
    data: { email: `other-${suffix}@example.test`, password, name: 'Other workspace' },
  });
  expect((await other.request.get(`http://127.0.0.1:3100/api/memories/${id}`)).status()).toBe(404);
  const isolated = await other.request.get('http://127.0.0.1:3100/api/graph').then((r) => r.json());
  expect(isolated.total).toBe(0);
  await other.close();
  const csrf = await page.request.post('/api/memories', {
    headers: { origin: 'https://untrusted.example' },
    data: { title: 'forged', content: 'no', region: 'frontal' },
  });
  expect(csrf.status()).toBe(403);
  // Logout/login uses a new opaque session and preserves the record/coordinates.
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: /A place for an idea/ })).toBeVisible();
  const persisted = await page.request.get(`/api/memories/${id}`).then((r) => r.json());
  expect(persisted.position).toEqual(position);
  await page.getByRole('button', { name: 'Reset brain view', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.getByRole('button', { name: 'Dismiss notification' }).isVisible())
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'docs/screenshots/mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Memories', exact: true }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.getByRole('button', { name: /A place for an idea/ }).click();
  await expect(page.locator('.original-content')).toContainText('DEMONSTRATION DATA');
  expect(errors).toEqual([]);
});
