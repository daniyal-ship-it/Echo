import { transcriptionAccount } from '../fixtures/transcription-account';
import { test, expect } from '@playwright/test';
import { wav } from '../fixtures/meeting-suite';

test('Meetings: consent, mocked transcription, duplicate status and login persistence', async ({
  page,
}, testInfo) => {
  const headers = { origin: 'http://127.0.0.1:3100' };
  const { email, password } = await transcriptionAccount(page.request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Meetings · upload audio' }).click();
  await expect(page.getByRole('heading', { name: 'Meetings', exact: true })).toBeVisible();
  const submit = page.getByRole('button', { name: 'Transcribe and save', exact: true });
  await page.getByLabel('Recording', { exact: true }).setInputFiles({
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
  const exported = await page.request.get('/api/export').then((r) => r.json());
  expect(exported.meetingTranscriptions).toHaveLength(1);
  expect(exported.meetingAuditEvents.map((e: { action: string }) => e.action).sort()).toEqual([
    'meeting.transcription.consent',
    'meeting.transcription.dispatch_intent',
  ]);
  expect(
    new Set(exported.meetingAuditEvents.map((e: { workspace_id: string }) => e.workspace_id)),
  ).toEqual(new Set([exported.meetingTranscriptions[0].workspace_id]));
  await page.screenshot({
    path: testInfo.outputPath('meetings-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath('meetings-mobile.png'),
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
  await page.route('**/api/meetings/transcribe', (route) =>
    route.fulfill({ status: 502, contentType: 'text/html', body: 'PRIVATE UPSTREAM ERROR' }),
  );
  await page.getByRole('button', { name: 'Check saved status (no provider call)' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('HTTP 502');
  await expect(page.getByRole('main')).not.toContainText('PRIVATE UPSTREAM ERROR');
  await page.unroute('**/api/meetings/transcribe');
  const meeting = memories.find((m: { source: string }) => m.source === 'meeting-audio');
  expect(
    (
      await page.request.delete('/api/memories/' + meeting.id, {
        headers,
        data: { confirm: 'DELETE' },
      })
    ).ok(),
  ).toBe(true);
  await page.getByRole('button', { name: 'Check saved status (no provider call)' }).click();
  await expect(page.getByText('The saved memory was removed.', { exact: false })).toBeVisible();
  const afterDelete = await page.request.get('/api/export').then((r) => r.json());
  expect(afterDelete.meetingTranscriptions).toHaveLength(1);
  expect(afterDelete.meetingAuditEvents).toHaveLength(2);
});
