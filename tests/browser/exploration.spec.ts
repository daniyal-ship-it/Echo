import { test, expect, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { getAnatomy } from '../../lib/anatomy';
import { cameraFov, fitAnatomy } from '../../lib/brain-camera';

async function checkLayout(page: Page) {
  const canvas = (await page.locator('canvas').boundingBox())!;
  const title = (await page.locator('.scene-title').boundingBox())!;
  const caption = (await page.locator('.scene-caption').boundingBox())!;
  const nav = (await page.getByRole('navigation', { name: 'Brain navigation' }).boundingBox())!;
  expect(canvas.y).toBeGreaterThanOrEqual(title.y + title.height);
  expect(canvas.y + canvas.height).toBeLessThanOrEqual(caption.y);
  expect(nav.y + nav.height).toBeLessThan(title.y);
}

test('progressive topics, real ring selection, cross-lobe links and search focus retain originals', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Shader compiler failures are console errors rather than React page errors.
  page.on('console', (message) => {
    if (message.type() === 'error' && /shader|WebGLProgram/i.test(message.text()))
      errors.push(message.text());
  });
  const headers = { origin: 'http://127.0.0.1:3100' };
  const registration = await page.request.post('/api/auth/register', {
    headers,
    data: {
      name: 'Exploration review',
      email: `exploration-${Date.now()}@example.test`,
      password: 'Isolated exploration password 42',
    },
  });
  expect(registration.status()).toBe(201);
  async function note(title: string, content: string, region: string) {
    const response = await page.request.post('/api/memories', {
      headers,
      data: { title, content, region },
    });
    expect(response.status()).toBe(201);
    return response.json();
  }
  const first = await note(
    'Observatory launch plan',
    'TEST FIXTURE: Observatory opens after review. #observatory',
    'frontal',
  );
  await note(
    'Observatory decisions',
    'TEST FIXTURE: Preserve source provenance. #observatory',
    'frontal',
  );
  await note('Unfiled thought', 'TEST FIXTURE: This original has no explicit tags.', 'frontal');
  const linked = await note(
    'Optical design',
    'TEST FIXTURE: The blue telescope is named quasarquartz. #optics',
    'occipital',
  );
  expect(
    (
      await page.request.post('/api/edges', {
        headers,
        data: {
          sourceId: first.id,
          targetId: linked.id,
          relationship: 'design context',
          evidence: 'Test fixture: the launch plan uses this optical design.',
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('.region-row').filter({ hasText: 'Frontal' }).click();
  await expect(
    page.getByRole('button', { name: 'Explore #observatory, 2 memories' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Explore Untagged memories, 1 memory' }),
  ).toBeVisible();
  await page.waitForTimeout(1600);
  await checkLayout(page);
  await page.screenshot({ path: 'docs/screenshots/topics.png' });

  // Click the actual topic ring in 3D, using the original anatomical camera projection.
  const graph = await page.request
    .get('/api/graph?region=frontal&view=topics')
    .then((r) => r.json());
  const topic = graph.nodes.find((n: { topic: string }) => n.topic === 'observatory');
  const box = (await page.locator('canvas').boundingBox())!;
  const aspect = box.width / box.height;
  const target: [number, number, number] = [-2.7 * 0.17, 0.17, -3.2 * 0.17];
  const camera = new PerspectiveCamera(cameraFov(aspect), aspect, 0.01, 50);
  camera.position.set(
    ...fitAnatomy((await getAnatomy()).positions, [-2.7, 1, -3.2], target, camera.fov, aspect),
  );
  camera.lookAt(...target);
  camera.updateMatrixWorld();
  const projected = new Vector3(...(topic.position as [number, number, number])).project(camera);
  await page.mouse.click(
    box.x + ((projected.x + 1) * box.width) / 2,
    box.y + ((1 - projected.y) * box.height) / 2,
  );
  const topicPanel = page.getByRole('region', { name: 'Memories in topic' });
  await expect(topicPanel.getByRole('heading', { name: '#observatory' })).toBeVisible();
  await expect(topicPanel.locator('.topic-card')).toHaveCount(2);
  const focused = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/graph?`) && new URL(r.url()).searchParams.get('focus') === first.id,
  );
  await topicPanel.getByRole('button', { name: /Observatory launch plan/ }).click();
  const focusGraph = await (await focused).json();
  expect(focusGraph.nodes.map((n: { id: string }) => n.id).sort()).toEqual(
    [first.id, linked.id].sort(),
  );
  expect(focusGraph.edges).toHaveLength(1);
  await expect(page.locator('.original-content')).toContainText('Observatory opens after review');
  await page.waitForTimeout(1400);
  await checkLayout(page);
  await page.screenshot({ path: 'docs/screenshots/connected-memory.png' });
  await page.getByRole('button', { name: /Links \(/ }).click();
  await page
    .locator('.edge-card')
    .getByRole('button', { name: /Optical design/ })
    .click();
  await expect(page.locator('.memory-intro h2')).toHaveText('Optical design');
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await expect(page.locator('.original-content')).toContainText('quasarquartz');
  await expect(page.getByRole('navigation', { name: 'Brain navigation' })).toContainText(
    'Occipital',
  );
  await page.getByRole('button', { name: 'Close memory', exact: true }).click();
  await expect(topicPanel.getByRole('heading', { name: '#observatory' })).toBeVisible();

  // Global retrieval must focus a real node excluded by the previous lobe/tag.
  await page.getByLabel('Ask your memory').fill('quasarquartz');
  await page.getByRole('button', { name: 'Search or ask', exact: true }).click();
  await expect(page.locator('.citation')).toHaveCount(1);
  const searched = page.waitForResponse(
    (r) =>
      r.url().includes('/api/graph?') && new URL(r.url()).searchParams.get('focus') === linked.id,
  );
  await page.locator('.citation').click();
  expect(
    (await (await searched).json()).nodes.some((n: { id: string }) => n.id === linked.id),
  ).toBe(true);
  await expect(page.locator('.original-content')).toContainText('quasarquartz');
  await page.getByRole('button', { name: 'Whole brain', exact: true }).click();
  await expect(page.locator('.scene-title h1')).toHaveText('Memory atlas');

  // Failed topic loads expose retry without inventing a populated atlas.
  let failOnce = true;
  await page.route('**/api/graph?**', async (route) => {
    if (failOnce && new URL(route.request().url()).searchParams.get('view') === 'topics') {
      failOnce = false;
      await route.fulfill({ status: 503, json: { error: 'Temporary topic fixture failure' } });
    } else await route.continue();
  });
  await page.locator('.region-row').filter({ hasText: 'Frontal' }).click();
  await expect(
    page.getByRole('region', { name: 'Topic and project clusters' }).getByRole('alert'),
  ).toContainText('Temporary topic fixture failure');
  await page.getByRole('button', { name: 'Retry topic loading' }).click();
  await page.getByRole('button', { name: 'Explore Untagged memories, 1 memory' }).click();
  await expect(topicPanel.locator('.topic-card')).toHaveCount(1);
  await expect(topicPanel).toContainText('Unfiled thought');
  await page.getByRole('button', { name: 'Whole brain', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  // A fresh mobile load chooses the actual low preset, unlike resizing a desktop canvas.
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'docs/screenshots/mobile-low.png' });
  await checkLayout(page);
  await page.getByRole('button', { name: 'Memories', exact: true }).click();
  await page.locator('.region-row').filter({ hasText: 'Frontal' }).click();
  await expect(
    page.getByRole('button', { name: 'Explore #observatory, 2 memories' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Explore #observatory, 2 memories' }).click();
  await topicPanel.getByRole('button', { name: /Observatory launch plan/ }).click();
  await expect(page.locator('.original-content')).toContainText('Observatory opens after review');
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.waitForTimeout(1400);
  await checkLayout(page);
  await page.screenshot({ path: 'docs/screenshots/mobile-selected.png' });
  await page.getByRole('button', { name: 'Whole brain', exact: true }).click();
  await page.getByRole('button', { name: 'Enter immersive view' }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'docs/screenshots/immersive-mobile.png' });
  expect(errors).toEqual([]);
});
