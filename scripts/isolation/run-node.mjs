// Usage: BASE=http://localhost:3000 A_EMAIL=.. A_PASSWORD=.. B_EMAIL=.. B_PASSWORD=.. node scripts/isolation/run-node.mjs
import { readFile } from 'node:fs/promises';
const base = process.env.BASE.replace(/\/$/, '');
const core = await readFile(new URL('./core.js', import.meta.url), 'utf8');
const runIsolationCheck = new Function(`${core}; return runIsolationCheck;`)();
let cookie = '';
const api = async (method, path, body) => {
  const res = await fetch(`${base}/api/${path}`, {
    method,
    headers: { origin: base, 'sec-fetch-site': 'same-origin', ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) if (c.startsWith('echo_session=')) cookie = c.split(';')[0] === 'echo_session=' ? '' : c.split(';')[0];
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, text };
};
const creds = { A: { email: process.env.A_EMAIL, password: process.env.A_PASSWORD }, B: { email: process.env.B_EMAIL, password: process.env.B_PASSWORD } };
const { failed } = await runIsolationCheck(api, creds, (rows, verdict) => { console.table(rows); console.log(verdict); });
process.exitCode = failed ? 1 : 0;
