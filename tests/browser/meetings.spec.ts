import { test, expect } from '@playwright/test';
import { wav } from '../fixtures/meeting-suite';

test('Meetings: consent, mocked transcription, duplicate status and login persistence', async ({
  page,
}) => {
  const headers = { origin: 'http://127.0.0.1:3100' };
  const email = `meetings-${Date.now()}@example.test`,
    password = 'Isolated meetings fixture password 42';
  expect(
    (
      await page.request.post('/api/auth/register', {
        headers,
        data: { email, password, name: 'Meeting fixture' },
      })
    ).status(),
  ).toBe(201);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Meetings · upload audio' }).click();
  await expect(page.getByRole('heading', { name: 'Meetings', exact: true })).toBeVisible();
  const submit = page.getByRole('button', { name: 'Transcribe and save', exact: true });
  await page
    .getByLabel('Recording', { exact: true })
    .setInputFiles({
      name: 'invalid.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from('not audio'),
    });
  await page.getByRole('checkbox').check();
  await submit.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Use a complete PCM WAV');

  await page
    .getByLabel('Recording', { exact: true })
    .setInputFiles({ name: 'fixture.wav', mimeType: 'audio/wav', buffer: Buffer.from(wav()) });
  await expect(submit).toBeDisabled();
  await page.getByLabel('Memory title').fill('Synthetic meeting');
  await page.getByRole('checkbox').check();
  await submit.click();
  await expect(page.getByRole('heading', { name: 'Transcript saved', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Machine transcript', exact: true })).toContainText(
    'MOCK TRANSCRIPTION',
  );
  await submit.click();
  await expect(page.getByRole('heading', { name: 'Transcript saved', exact: true })).toBeVisible();
  const memories = (await page.request.get('/api/memories').then((r) => r.json())).memories;
  expect(memories.filter((m: { source: string }) => m.source === 'meeting-audio')).toHaveLength(1);
  await page.screenshot({
    path: '/workspace/artifacts/echo-phase5a/meetings-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '/workspace/artifacts/echo-phase5a/meetings-mobile.png',
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await page.request.post('/api/auth/logout', { headers })).ok()).toBe(true);
  expect((await page.request.get('/api/meetings/transcribe')).status()).toBe(401);
  expect(
    (await page.request.post('/api/auth/login', { headers, data: { email, password } })).ok(),
  ).toBe(true);
  await page.reload();
  await page
    .getByLabel('Recording', { exact: true })
    .setInputFiles({ name: 'fixture.wav', mimeType: 'audio/wav', buffer: Buffer.from(wav()) });
  await page.getByRole('button', { name: 'Check saved status (no provider call)' }).click();
  await expect(page.getByRole('region', { name: 'Machine transcript', exact: true })).toContainText(
    'MOCK TRANSCRIPTION',
  );
});
