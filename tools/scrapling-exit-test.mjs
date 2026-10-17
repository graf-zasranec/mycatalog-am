// Regression check: a process that has used scrape.mjs's Scrapling helper must exit by itself once
// idle. The 2026-10-16 night refresh wrote prices.json, then hung 3 h on the open helper pipes.
//   node tools/scrapling-exit-test.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const src = fs.readFileSync('scrape.mjs', 'utf8');
const block = src.slice(src.indexOf('let scraplingProc'), src.indexOf('async function get('));
const child = `const {spawn}=require('child_process');const setStatus=()=>{};
${block.replace('const scraplingGet', 'globalThis.scraplingGet')}
scraplingGet('https://allsell.am/en/').then(h => console.log('fetched', h.length, 'chars'));`;
const t0 = Date.now();
const c = spawn(process.execPath, ['-e', child], { stdio: 'inherit' });
const kill = setTimeout(() => { c.kill(); console.log('FAIL: still running 120 s after start'); process.exit(1); }, 120000);
c.on('exit', code => { clearTimeout(kill); console.log(code === 0 ? 'PASS' : 'FAIL', 'exited in', ((Date.now() - t0) / 1000).toFixed(1), 's'); process.exit(code ? 1 : 0); });
