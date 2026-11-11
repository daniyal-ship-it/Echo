// ECHO isolation check for the browser console. Open the feature Preview, sign in to Vercel if asked,
// open DevTools > Console on that page, paste this whole file and press Enter.
// It asks for the two test accounts' emails and passwords; nothing is stored or sent anywhere else.
(async () => {
// ECHO cross-workspace isolation check. Shared by the Node runner and the browser console build.
// `api(method, path, body)` must return { status, data, text } and keep the session cookie.
// Creates one harmless note per workspace, attacks workspace A from workspace B, verifies A is
// untouched, then deletes both notes. Never calls the assistant or any paid provider endpoint.
async function runIsolationCheck(api, creds, log) {
  const results = [];
  const check = (name, pass, detail) => {
    results.push({ check: name, result: pass ? 'PASS' : 'FAIL', detail: String(detail) });
  };
  const word = () =>
    'zq' + Array.from({ length: 14 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
  const login = async (who) => {
    await api('POST', 'auth/logout');
    const r = await api('POST', 'auth/login', { email: creds[who].email, password: creds[who].password });
    if (r.status !== 200) throw new Error(`Could not sign in as user ${who} (HTTP ${r.status}). Nothing was tested.`);
    return r.data.user;
  };
  const note = (label, token) => ({
    title: `Isolation test ${label} ${token}`,
    content: `Harmless test note. Private marker ${token} belongs to workspace ${label}.`,
    region: 'frontal',
    tags: [],
  });
  const tokenA = word(), tokenB = word();

  const userA = await login('A');
  const madeA = await api('POST', 'memories', note('A', tokenA));
  if (madeA.status !== 201) throw new Error(`User A could not save a note (HTTP ${madeA.status}). Nothing was tested.`);
  const idA = madeA.data.id;
  check('A can save and read its own note', (await api('GET', `memories/${idA}`)).status === 200, 'baseline');

  const userB = await login('B');
  check('A and B are different workspaces', userA.workspaceId !== userB.workspaceId, 'session workspace ids differ');
  const madeB = await api('POST', 'memories', note('B', tokenB));
  if (madeB.status !== 201) throw new Error(`User B could not save a note (HTTP ${madeB.status}). Nothing was tested.`);
  const idB = madeB.data.id;
  const leaks = (r) => r.text.includes(tokenA) || r.text.includes(idA);
  let r;

  r = await api('GET', 'memories');
  check('B list does not show A note', r.status === 200 && !leaks(r), `HTTP ${r.status}, total ${r.data && r.data.total}`);
  r = await api('GET', `memories?q=${tokenA}`);
  check('B filtered list does not show A note', !leaks(r), `HTTP ${r.status}`);
  r = await api('GET', `memories/${idA}`);
  check('B cannot read A note by id', r.status === 404 && !leaks(r), `HTTP ${r.status}`);
  r = await api('GET', `memories/${idA}?version=1`);
  check('B cannot read A note version by id', r.status === 404 && !leaks(r), `HTTP ${r.status}`);
  r = await api('PUT', `memories/${idA}`, { title: 'Overwritten by B', content: 'Overwritten by B', region: 'frontal', tags: [] });
  check('B cannot overwrite A note', r.status === 404, `HTTP ${r.status}`);
  r = await api('DELETE', `memories/${idA}`, { confirm: 'DELETE' });
  check('B cannot delete A note', r.status === 404, `HTTP ${r.status}`);
  r = await api('POST', 'edges', { sourceId: idA, targetId: idB, relationship: 'isolation test', evidence: 'cross-workspace link attempt' });
  check('B cannot link its note to A note', r.status === 404, `HTTP ${r.status}`);
  r = await api('POST', 'retrieve', { question: tokenA, mode: 'keyword' });
  check('B keyword retrieval does not return A note', r.status === 200 && !leaks(r), `HTTP ${r.status}`);
  r = await api('GET', `graph?focus=${idA}`);
  check('B graph focus on A note reveals nothing', !leaks(r), `HTTP ${r.status}`);
  r = await api('GET', 'graph');
  check('B graph does not contain A note', !leaks(r), `HTTP ${r.status}`);
  r = await api('GET', `intelligence?memoryId=${idA}`);
  check('B cannot read intelligence status of A note', r.status !== 200 && !leaks(r), `HTTP ${r.status}`);
  r = await api('POST', 'intelligence', { memoryId: idA, summaryProvider: 'openai', consent: true });
  check('B cannot queue intelligence on A note', r.status !== 201 && r.status !== 200, `HTTP ${r.status}`);
  r = await api('GET', 'export');
  check('B export does not contain A note', r.status === 200 && !leaks(r), `HTTP ${r.status}`);

  await login('A');
  r = await api('GET', `memories/${idA}`);
  check(
    'A note is intact after the attempts',
    r.status === 200 && r.data.title === note('A', tokenA).title && r.text.includes(tokenA) && !r.text.includes(idB),
    `HTTP ${r.status}, version ${r.data && r.data.version}`,
  );
  r = await api('GET', 'memories');
  check('A list does not show B note', r.status === 200 && !r.text.includes(tokenB) && !r.text.includes(idB), `HTTP ${r.status}`);
  r = await api('GET', `memories/${idB}`);
  check('A cannot read B note by id', r.status === 404, `HTTP ${r.status}`);

  const delA = await api('DELETE', `memories/${idA}`, { confirm: 'DELETE' });
  await login('B');
  const delB = await api('DELETE', `memories/${idB}`, { confirm: 'DELETE' });
  await api('POST', 'auth/logout');
  check('Test notes removed', delA.status === 200 && delB.status === 200, `A HTTP ${delA.status}, B HTTP ${delB.status}`);

  const failed = results.filter((x) => x.result === 'FAIL').length;
  log(results, failed === 0 ? `ISOLATION PASS: ${results.length} of ${results.length} checks` : `ISOLATION FAIL: ${failed} of ${results.length} checks failed`);
  return { failed, results };
}
  const api = async (method, path, body) => {
    const res = await fetch(`/api/${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { status: res.status, data, text };
  };
  const creds = {
    A: { email: prompt('User A email'), password: prompt('User A password') },
    B: { email: prompt('User B email'), password: prompt('User B password') },
  };
  try {
    await runIsolationCheck(api, creds, (rows, verdict) => { console.table(rows); console.log(verdict); });
  } catch (error) {
    console.error('ISOLATION CHECK DID NOT RUN:', error.message);
  }
})();
