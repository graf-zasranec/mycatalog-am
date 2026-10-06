// Shared local/CI refresh. Each unavailable shop/cache step keeps previous data.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const python = process.env.BETTER_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const run = (command, args, required = false) => {
  console.log('\nRefreshing: ' + args.join(' '));
  if (process.argv.includes('--plan')) return;
  const r = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1' } });
  if (r.error || r.status !== 0) {
    if (required) process.exit(r.status || 1);
    console.warn('Step unavailable; retaining previous data: ' + (r.error?.message || r.status));
  }
};
run(process.execPath, ['scrape.mjs', '--selftest'], true);
// Resume only after the preparation stages have completed in an interrupted run.
// The normal local/CI command always refreshes those caches first.
if (!process.argv.includes('--resume-prices')) {
run(python, ['tools/eldorado-fetch.py']);
run(python, ['tools/zigzag-fetch.py']);
const limit = process.env.BETTER_ROW_LIMIT;
run(process.execPath, ['tools/confirm-hand.mjs', '--recheck', '1', ...(limit ? ['--limit', limit] : []), '--drop-gone']);
run(process.execPath, ['tools/nbc-import.mjs', '--fetch', '--write']);
}
run(process.execPath, ['scrape.mjs', '--fresh'], true);
run(process.execPath, ['tools/audio.mjs', '--write'], true);
run(process.execPath, ['tools/links.mjs'], true);
for (const category of ['laptop', 'monitor', 'headphones', 'speaker', 'watch', 'tv'])
  run(process.execPath, ['tools/shop-specs.mjs', category, '--write']);
run(python, ['tools/photo-box.py']);
run(python, ['tools/thumbnails.py']);
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
