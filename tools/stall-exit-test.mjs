// Regression check: a page request that never answers must time out, not end the whole run.
// 2026-10-18 and -19: REDstore was left awaiting a request that held no socket, and the refresh
// exited 13 ("unsettled top-level await") and saved nothing. On the 18th the timeout's timer did not
// keep Node alive (AbortSignal.timeout); on the 19th the request also ignored its abort.
// Each case runs scrape.mjs's own timed() + plainGet in a child, with fetch stubbed:
//   obeys  - a promise only an abort can settle
//   ignores - a promise nothing ever settles, abort or not
//   node tools/stall-exit-test.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const src = fs.readFileSync('scrape.mjs', 'utf8').replaceAll(String.fromCharCode(13), '');
const t0 = src.indexOf('function timed('), timedSrc = src.slice(t0, src.indexOf('\n}\n', t0) + 3);
const getSrc = src.slice(src.indexOf('async function plainGet'), src.indexOf('/* ---------- phone matching'));
const FETCH = {
  obeys: `(url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))`,
  ignores: `() => new Promise(() => {})`,
};

const run = name => new Promise(done => {
  const child = `const TIMEOUT_MS = 2000, UA = 'test'; let S = 0; const setStatus = v => { S = v; }, lastStatus = () => S;
const sleep = ms => new Promise(r => setTimeout(r, ms));
globalThis.fetch = ${FETCH[name]};
${timedSrc}
${getSrc}
const html = await plainGet('https://stalled.example/', 1);
console.log('settled with', html.length, 'chars');`;
  const t = Date.now();
  const c = spawn(process.execPath, ['--input-type=module', '-e', child], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; c.stdout.on('data', d => { out += d; }); c.stderr.on('data', d => { out += d; });
  const kill = setTimeout(() => c.kill(), 20000);
  c.on('exit', code => {
    clearTimeout(kill);
    const ok = code === 0 && out.includes('settled with 0 chars');
    console.log(ok ? 'PASS' : `FAIL (exit ${code})`, name, `after ${((Date.now() - t) / 1000).toFixed(1)} s`);
    done(ok);
  });
});

const results = [await run('obeys'), await run('ignores')];
process.exit(results.every(Boolean) ? 0 : 1);
