import { expect, type APIRequestContext } from '@playwright/test';
// Two compatible journeys share one synthetic workspace. Other isolation tests retain theirs.
// The run ID comes from the local Playwright config, also when workers restart.
export async function transcriptionAccount(request: APIRequestContext) {
  const run = process.env.ECHO_BROWSER_RUN_ID;
  if (!run || !/^[a-z0-9-]+$/.test(run)) throw new Error('Missing isolated browser run identifier');
  const account = {
    email: `transcription-${run}@example.test`,
    password: 'Isolated transcription fixture password 42',
  };
  const headers = { origin: 'http://127.0.0.1:3100' };
  const login = await request.post('http://127.0.0.1:3100/api/auth/login', {
    headers,
    data: account,
  });
  if (login.status() === 401) {
    expect(
      (
        await request.post('http://127.0.0.1:3100/api/auth/register', {
          headers,
          data: { ...account, name: 'MOCK transcription review' },
        })
      ).status(),
    ).toBe(201);
  } else expect(login.status()).toBe(200);
  return account;
}
