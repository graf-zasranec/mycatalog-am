// Shared local/CI refresh. Each unavailable shop/cache step keeps previous data.
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import {preparedCheckpoint} from './refresh-recovery.mjs';
import {acquireRefreshLock} from './refresh-lock.mjs';
if (!process.argv.includes('--plan')) {
  const release = acquireRefreshLock();
  if (!release) {
    console.error('A price refresh is already running. Let it finish before starting another.');
    process.exit(2);
  }
  process.once('exit', release);
  process.once('SIGINT', () => process.exit(130));
  process.once('SIGTERM', () => process.exit(143));
}
const python = process.env.BETTER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const run = (command, args, required = false) => {
  console.log('\nRefreshing: ' + args.join(' '));
  if (process.argv.includes('--plan')) return;
  const t0 = Date.now();
  const r = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1' } });
  console.log(`Step took ${((Date.now() - t0) / 60000).toFixed(1)} min: ${args[0]}`);
  if (r.error || r.status !== 0) {
    if (required) process.exit(r.status || 1);
    console.warn('Step unavailable; retaining previous data: ' + (r.error?.message || r.status));
  }
};
// Same as run(), but returns at once; await it. Used for steps that talk to different shops.
const runAsync = (command, args) => new Promise(done => {
  console.log('\nRefreshing (parallel): ' + args.join(' '));
  if (process.argv.includes('--plan')) return done();
  const t0 = Date.now();
  const p = spawn(command, args, { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1' } });
  const end = code => { console.log(`Step took ${((Date.now() - t0) / 60000).toFixed(1)} min: ${args[0]}`); if (code) console.warn('Step unavailable; retaining previous data: ' + code); done(); };
  p.on('error', e => end(e.message)); p.on('exit', end);
});
run(process.execPath, ['scrape.mjs', '--selftest'], true);
run(process.execPath, ['tools/refresh-recovery-test.mjs'], true);
run(process.execPath, ['tools/stall-exit-test.mjs'], true);
run(process.execPath, ['tools/ucom-colors-test.mjs'], true);
run(process.execPath, ['tools/asbc-test.mjs'], true);
run(process.execPath, ['tools/appzone-test.mjs'], true);
run(process.execPath, ['tools/likemobile-test.mjs'], true);
run(process.execPath, ['tools/miarmenia-test.mjs'], true);
run(process.execPath, ['tools/page-refresh-test.mjs'], true);
run(process.execPath, ['tools/smart-glasses-test.mjs'], true);
run(python, ['tools/eldorado-data-test.py'], true);
run(python, ['tools/test_zigzag_stock.py'], true);
run(python, ['tools/test_zigzag_fetch.py'], true);
const eldoradoOnly = process.argv.includes('--eldorado-only') || process.env.BETTER_REFRESH_SCOPE === 'eldorado';
const retry = process.env.BETTER_REFRESH_RESUME === '1';
let prepared=false;
try { prepared=retry&&preparedCheckpoint(JSON.parse(fs.readFileSync('.refresh-prepared.json','utf8')),'all'); } catch {}
if (eldoradoOnly) {
  run(python, ['tools/eldorado-fetch.py', '--offers-only', '--recheck-hours', '0'], true);
  run(process.execPath, ['tools/confirm-hand.mjs', 'eldorado', '--recheck', '0']);
  run(process.execPath, ['scrape.mjs', 'eldorado', '--fresh'], true);
} else {
// Resume only after the preparation stages have completed in an interrupted run.
// The normal local/CI command always refreshes those caches first.
if (!process.argv.includes('--resume-prices') && !prepared) {
// Different shops, so these overlap (owner, 2026-10-16: 5.5 of GitHub's 6 hours were spent waiting
// on them one after another). Each shop is still read at its own pace. Notebook Centre and the
// hand check both write data/listings.csv, so they never overlap each other; the hand check also
// reads the fresh Eldorado and Zigzag caches, so it goes last.
await Promise.all([
  runAsync(python, ['tools/eldorado-fetch.py']),
  runAsync(process.execPath, ['tools/zigzag-sitemap.mjs']).then(() => runAsync(python, ['tools/zigzag-fetch.py'])),
  runAsync(process.execPath, ['tools/nbc-import.mjs', '--fetch', '--write'])
    .then(() => process.env.CI ? null : runAsync(python, ['tools/check-links.py', '--all'])),
]);
const limit = process.env.BETTER_ROW_LIMIT;
run(process.execPath, ['tools/confirm-hand.mjs', '--recheck', '1', ...(limit ? ['--limit', limit] : []), '--drop-gone']);
// Rebuilds data/soldout.json from every offer's own page (owner, 2026-10-16): it had not run since
// 2026-10-05, so pages that sold out later kept their price on the site. Resumable, non-fatal.
// GitHub runs it in its own job (stock-check.yml): the refresh there is already close to 6 hours.
if (!process.argv.includes('--plan')) fs.writeFileSync('.refresh-prepared.json',JSON.stringify({scope:'all',preparedAt:new Date().toISOString()}));
}
run(process.execPath, ['scrape.mjs', ...(prepared ? ['--resume-checkpoint'] : ['--fresh'])], true);
run(process.execPath, ['tools/audio.mjs', '--write'], true);
run(process.execPath, ['tools/links.mjs'], true);
for (const category of ['laptop', 'monitor', 'headphones', 'speaker', 'watch', 'tv'])
  run(process.execPath, ['tools/shop-specs.mjs', category, '--write']);
run(python, ['tools/photo-box.py']);
run(python, ['tools/thumbnails.py']);
run(python, ['tools/social.py']);
}
run(process.execPath, ['build.mjs'], true);
for (const tool of ['recheck', 'health', 'wrong-links', 'variant-audit']) run(process.execPath, ['tools/' + tool + '.mjs']);
if (process.argv.includes('--plan')) process.exit(0);
const prices = JSON.parse(fs.readFileSync('data/prices.json', 'utf8'));
const today = new Date().toISOString().slice(0, 10), summary = {};
for (const list of Object.values(prices.offers || {})) for (const o of list) {
  const row = summary[o.shop] ||= { total: 0, checkedToday: 0, oldest: today };
  row.total++; if (o.seen === today) row.checkedToday++;
  if (o.seen && o.seen < row.oldest) row.oldest = o.seen;
}
console.log('Offer freshness by shop: ' + JSON.stringify(summary));
