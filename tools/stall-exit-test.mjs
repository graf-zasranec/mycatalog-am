// Regression check: a page request that never answers must time out, not end the whole run.
// The 2026-10-18 refresh died with exit 13 ("unsettled top-level await"): REDstore (after ~1000 of
// 1245 pages) and 3DPlanet were each left awaiting a request that held no socket, and
// AbortSignal.timeout's timer does not keep Node alive - so once the other lanes finished, Node
// quit before the 30 s timeout could fire, and nothing was saved.
// The child below stubs fetch with exactly that: a promise that only an abort can settle.
//   node tools/stall-exit-test.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const src = fs.readFileSync('scrape.mjs', 'utf8');
const block = src.slice(src.indexOf('async function plainGet'), src.indexOf('/* ---------- phone matching'));
const child = `const TIMEOUT_MS = 2000, UA = 'test'; let S = 0; const setStatus = v => { S = v; }, lastStatus = () => S;
const sleep = ms => new Promise(r => setTimeout(r, ms));
globalThis.fetch = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
${block}
const html = await plainGet('https://stalled.example/', 1);
console.log('settled with', html.length, 'chars');`;

const t0 = Date.now();
const c = spawn(process.execPath, ['--input-type=module', '-e', child], { stdio: ['ignore', 'pipe', 'pipe'] });
let out = ''; c.stdout.on('data', d => { out += d; }); c.stderr.on('data', d => { out += d; });
const kill = setTimeout(() => { c.kill(); console.log('FAIL: still running after 20 s'); process.exit(1); }, 20000);
c.on('exit', code => {
  clearTimeout(kill);
  const ok = code === 0 && out.includes('settled with 0 chars');
  console.log(ok ? 'PASS' : `FAIL (exit ${code})`, `after ${((Date.now() - t0) / 1000).toFixed(1)} s:`, out.trim().split('\n').pop());
  process.exit(ok ? 0 : 1);
});
