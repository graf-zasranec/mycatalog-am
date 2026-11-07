// One morning reading of the whole pipeline (2026-11-07): how fresh each shop's prices are, how
// the last runs ended, whether the site and its photo host answer, and how much of Cloudflare R2's
// free allowance the photos use. Read-only - it changes nothing.
//
//   node tools/status-report.mjs                 print the report
//   node tools/status-report.mjs --r2-bytes N --r2-objects N   add the bucket size (status.yml passes it)
//
// It exits 1 when something needs a person, so the workflow turns red and GitHub emails the owner.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : null; };
const P = JSON.parse(fs.readFileSync('data/prices.json', 'utf8'));
const now = Date.now(), day = 864e5;
const lines = [], alerts = [];
const say = s => lines.push(s);

// 1. Prices: per shop, how many offers and when the newest was confirmed.
const shops = {};
for (const o of Object.values(P.offers).flat()) {
  const s = shops[o.shop] ||= { n: 0, newest: 0 };
  s.n++;
  const t = o.seen ? Date.parse(o.seen) : 0;
  if (t > s.newest) s.newest = t;
}
say(`## Prices (built ${P.generated?.slice(0, 16).replace('T', ' ')} UTC)`);
say('| Shop | Offers | Newest price | Age |');
say('|---|---:|---|---:|');
for (const [id, s] of Object.entries(shops).sort((a, b) => a[1].newest - b[1].newest)) {
  const age = s.newest ? (now - s.newest) / day : Infinity;
  // Shops read through the browser (AllSell, Pixel, iStore, Eldorado) are refreshed every few days.
  const limit = /^(allsell|pixel|istore|eldorado)$/.test(id) ? 4 : 2;
  const flag = age > limit ? ' ⚠️' : '';
  if (age > limit && s.n >= 20) alerts.push(`${P.shops?.[id]?.name || id}: newest price ${Number.isFinite(age) ? age.toFixed(1) + ' days' : 'never'} old`);
  say(`| ${P.shops?.[id]?.name || id} | ${s.n} | ${s.newest ? new Date(s.newest).toISOString().slice(0, 10) : '-'} | ${Number.isFinite(age) ? age.toFixed(1) + ' d' : '-'}${flag} |`);
}

// 2. The last run of each workflow (needs the gh CLI; skipped when it is missing).
try {
  const runs = JSON.parse(execFileSync('gh', ['run', 'list', '-L', '60', '--json', 'workflowName,status,conclusion,createdAt'], { encoding: 'utf8' }));
  const last = {};
  for (const r of runs) last[r.workflowName] ||= r;
  say('\n## Last runs');
  for (const [name, r] of Object.entries(last)) {
    const res = r.status === 'completed' ? r.conclusion : r.status;
    say(`- ${name}: ${res} (${r.createdAt.slice(0, 16).replace('T', ' ')} UTC)`);
    if (res === 'failure' && !/browser check/i.test(name)) alerts.push(`${name} failed last time`);
  }
} catch { say('\n(last runs: gh not available)'); }

// 3. The site and the photo host answer.
const probe = async url => { try { const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) }); return r.status; } catch { return 0; } };
const index = await fetch('https://better.am/', { signal: AbortSignal.timeout(15000) }).then(r => r.text()).catch(() => '');
const photo = index.match(/https:\/\/img\.better\.am\/images\/[^"' ]+?\.webp/)?.[0];
const checks = [['better.am', await probe('https://better.am/')]];
if (photo) checks.push(['a photo on img.better.am', await probe(photo)]);
say('\n## Site');
for (const [what, status] of checks) {
  say(`- ${what}: ${status || 'no answer'}`);
  if (status !== 200) alerts.push(`${what} answered ${status || 'nothing'}`);
}

// 4. R2 against the free allowance; the owner's rule is to stop at 80% (AGENTS.md).
const bytes = arg('--r2-bytes'), objects = arg('--r2-objects');
if (bytes != null) {
  const pct = bytes / 10e9 * 100;
  say('\n## Cloudflare R2');
  say(`- ${objects} files, ${(bytes / 1e9).toFixed(2)} GB of the free 10 GB (${pct.toFixed(0)}%)`);
  if (pct >= 80) alerts.push(`R2 storage at ${pct.toFixed(0)}% of the free 10 GB - stop uploading`);
}

say(alerts.length ? `\n## Needs attention\n${alerts.map(a => '- ' + a).join('\n')}` : '\nAll fine.');
const text = lines.join('\n');
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
process.exit(alerts.length ? 1 : 0);
