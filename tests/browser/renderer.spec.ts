import { test, expect } from '@playwright/test';
import { getAnatomy } from '../../lib/anatomy';
import { mkdirSync, writeFileSync } from 'node:fs';

test('renderer: isolated density, aspect ratios, lobe focus, motion and context/asset failure', async ({
  page,
}) => {
  test.setTimeout(150000);
  const directory = process.env.ECHO_RENDER_REPORT_DIR || 'test-results/renderer';
  mkdirSync(directory, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /shader|WebGLProgram/.test(m.text())) errors.push(m.text());
  });
  await page.addInitScript(() => {
    const w = window as any;
    w.rendererProbe = { draws: 0, gpuTimerAvailable: false, active: false, frame: 0, queries: [] };
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const matrixLocations = new WeakSet<WebGLUniformLocation>();
      const getLocation = proto.getUniformLocation;
      proto.getUniformLocation = function (program, name) {
        const location = getLocation.call(this, program, name);
        if (location && name === 'modelViewMatrix') matrixLocations.add(location);
        return location;
      };
      const setMatrix = proto.uniformMatrix4fv;
      proto.uniformMatrix4fv = function (
        location: WebGLUniformLocation | null,
        transpose: boolean,
        value: Float32List,
      ) {
        if (location && matrixLocations.has(location))
          w.rendererProbe.modelView = Array.from(value);
        return setMatrix.call(this, location, transpose, value);
      };
      for (const key of [
        'drawArrays',
        'drawElements',
        'drawArraysInstanced',
        'drawElementsInstanced',
      ]) {
        const original = (proto as any)[key];
        if (!original) continue;
        (proto as any)[key] = function (...args: any[]) {
          w.rendererProbe.draws++;
          const gl = this as WebGL2RenderingContext;
          const probe = w.rendererProbe;
          const ext =
            probe.active && gl instanceof WebGL2RenderingContext
              ? gl.getExtension('EXT_disjoint_timer_query_webgl2')
              : null;
          if (!ext || probe.queries.length >= 600) return original.apply(this, args);
          const query = gl.createQuery()!;
          gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
          try {
            return original.apply(this, args);
          } finally {
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            probe.queries.push({ query, gl, ext, frame: probe.frame });
          }
        };
      }
    }
  });
  const registration = await page.request.post('/api/auth/register', {
    headers: { origin: 'http://127.0.0.1:3100' },
    data: {
      email: `renderer-${Date.now()}@example.test`,
      password: 'Isolated renderer fixture 42',
      name: 'Renderer benchmark',
    },
  });
  expect(registration.status()).toBe(201);
  const anatomy = await getAnatomy();
  let density = 0;
  await page.route('**/api/graph?*', async (route) => {
    const nodes = Array.from({ length: Math.min(density, 1500) }, (_, i) => ({
      id: `synthetic-${i}`,
      title: 'SYNTHETIC RENDER FIXTURE',
      region: 'frontal',
      position: Array.from(anatomy.positions.slice(i * 12, i * 12 + 3), (x) => x * 1.025),
      count: density > 1500 ? Math.floor(density / 1500) + (i < density % 1500 ? 1 : 0) : 1,
      is_demo: true,
      kind: density > 1500 ? 'spatial' : 'memory',
    }));
    await route.fulfill({
      json: {
        nodes,
        edges: nodes.slice(1).map((n, i) => ({
          id: `fixture-edge-${i}`,
          source_id: nodes[i].id,
          target_id: n.id,
          status: 'confirmed',
        })),
        total: density,
        counts: { frontal: density },
        aggregated: density > 1500,
      },
    });
  });
  const metrics = [];
  for (const count of [0, 100, 1500, 100000]) {
    density = count;
    await page.goto('/');
    await expect(page.getByText('3D ANATOMICAL VIEW', { exact: true })).toBeVisible();
    await page.waitForTimeout(1200);
    const canvas = page.locator('canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    const pending = page.evaluate(async () => {
      const w = window as any;
      const samples: number[] = [];
      let last = performance.now();
      const start = w.rendererProbe.draws;
      const gl = document.querySelector('canvas')!.getContext('webgl2');
      const gpuTimerAvailable = !!gl?.getExtension('EXT_disjoint_timer_query_webgl2');
      w.rendererProbe.active = true;
      await new Promise<void>((resolve) => {
        function frame(t: number) {
          w.rendererProbe.frame++;
          samples.push(t - last);
          last = t;
          if (samples.length < 30) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
      w.rendererProbe.active = false;
      await new Promise((resolve) => setTimeout(resolve, 100));
      const gpuFrames = new Map<number, number>();
      let unavailable = 0,
        disjoint = 0;
      for (const { query, gl, ext, frame } of w.rendererProbe.queries) {
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) disjoint++;
        else if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE))
          gpuFrames.set(
            frame,
            (gpuFrames.get(frame) || 0) + gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6,
          );
        else unavailable++;
        gl.deleteQuery(query);
      }
      const gpu = [...gpuFrames.values()].sort((a, b) => a - b);
      samples.shift();
      samples.sort((a, b) => a - b);
      return {
        rafMedianMs: samples[Math.floor(samples.length * 0.5)],
        rafP95Ms: samples[Math.floor(samples.length * 0.95)],
        drawCalls: w.rendererProbe.draws - start,
        jsHeapBytes: w.performance.memory?.usedJSHeapSize ?? null,
        gpuTimerAvailable,
        gpuDrawSumMedianMs: gpu.length ? gpu[Math.floor(gpu.length * 0.5)] : null,
        gpuDrawSumP95Ms: gpu.length ? gpu[Math.floor(gpu.length * 0.95)] : null,
        gpuMeasuredIntervals: gpu.length,
        unavailableQueries: unavailable,
        disjointQueries: disjoint,
        gpuTimeMeaning:
          'Sum of timer-query draw durations per RAF interval, excludes clears/presentation; software GPU, not complete hardware frame time.',
      };
    });
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.55, { steps: 40 });
    await page.mouse.up();
    metrics.push({ records: count, renderedNodes: Math.min(count, 1500), ...(await pending) });
  }
  writeFileSync(
    `${directory}/performance.json`,
    JSON.stringify(
      {
        environment: 'Chromium SwiftShader; RAF wall-clock intervals, not GPU time or hardware FPS',
        metrics,
      },
      null,
      2,
    ),
  );
  density = 0;
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  for (const lobe of ['Frontal', 'Parietal', 'Temporal', 'Occipital']) {
    await page.locator('.region-row').filter({ hasText: lobe }).click();
    await expect(page.getByRole('navigation', { name: 'Brain navigation' })).toContainText(lobe);
  }
  // Exercise renderer motion preference, not just the surrounding CSS. Keyboard
  // activation retains the existing accessible camera controls. On this software
  // renderer we assert settled output, not sub-frame timing or hardware latency.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Workspace samples the OS preference on mount (its explicit setting is live).
  await page.reload();
  await expect(page.locator('[data-reduced-motion="true"]')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  const front = page.getByRole('button', { name: 'Anterior view', exact: true });
  await front.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  const cameraMatrix = () =>
    page.evaluate(() => (window as any).rendererProbe.modelView as number[]);
  const reducedFront = await cameraMatrix();
  expect(reducedFront).toHaveLength(16);
  await page.waitForTimeout(250);
  expect(await cameraMatrix()).toEqual(reducedFront);
  await page.getByRole('button', { name: 'Left lateral view', exact: true }).click();
  await page.waitForTimeout(250);
  const reducedSide = await cameraMatrix();
  expect(reducedSide).not.toEqual(reducedFront);
  await page.waitForTimeout(250);
  expect(await cameraMatrix()).toEqual(reducedSide);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  for (const [width, height] of [
    [1600, 1000],
    [1024, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: 'Reset brain view', exact: true }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${directory}/empty-${width}.png` });
    expect(await page.locator('canvas').isVisible()).toBe(true);
  }
  expect(errors).toEqual([]);
  await page.evaluate(() => {
    const gl = document.querySelector('canvas')!.getContext('webgl2');
    gl!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(
    page.getByText('Graphics context lost. Reload to restore the anatomical view.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.view-status')).toContainText('3D VIEW UNAVAILABLE');
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  // The supported recovery path is a reload, not automatic context restoration.
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.view-status')).toContainText('3D ANATOMICAL VIEW');
  await page.route('**/anatomy/brain.bin', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable fixture' }),
  );
  await page.reload();
  await expect(
    page.getByText('Anatomical asset could not be loaded.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.view-status')).toContainText('3D VIEW UNAVAILABLE');
});
