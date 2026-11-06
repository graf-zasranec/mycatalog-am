// Removes fingerprinted bundles that nothing on the site points to any more.
//
//   node tools/prune-bundles.mjs           delete them
//   node tools/prune-bundles.mjs --dry     only report
//
// build.mjs writes every bundle twice: a plain name and a content-hashed copy
// (data/startup/catalogue.<hash>.js, data/details/chunk-3.<hash>.js, data/site-app.<hash>.js...).
// Nothing ever deleted the old hashed copies, so each release added tens of MB and the Pages
// upload passed GitHub's 1 GB limit on 2026-11-06 (deploy cancelled: "artifact size exceeds").
// A hashed file is kept when the current build references it, or when the previous commit's
// index.html / startup manifest did - a visitor holding the previous page still gets its files.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dry = process.argv.includes('--dry');
const HASHED = /data\/(?:startup|details)\/[A-Za-z0-9_-]+\.[0-9a-f]{10}\.js|data\/site-[a-z-]+\.[0-9a-f]{10}\.(?:js|css)/g;
const keep = new Set();
const scan = text => { for (const m of String(text).matchAll(HASHED)) keep.add(m[0]); };

// Every generated page and the files they load.
const roots = ['index.html', '404.html', 'sw.js', 'data/startup-manifest.json', 'data/page-manifest.json'];
for (const f of roots) if (fs.existsSync(f)) scan(fs.readFileSync(f, 'utf8'));
const walk = dir => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) scan(fs.readFileSync(p, 'utf8'));
  }
};
for (const pre of ['', 'en/', 'ru/']) for (const tree of ['p', 'c', 'b']) walk(pre + tree);
// The previous release, for visitors with a cached page.
for (const f of ['index.html', 'data/startup-manifest.json']) {
  try { scan(execFileSync('git', ['show', 'HEAD:' + f], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })); } catch {}
}
// Bundles can load other bundles (the app loads detail chunks): follow references until stable.
for (let grew = true; grew;) {
  const before = keep.size;
  for (const f of [...keep]) if (fs.existsSync(f)) scan(fs.readFileSync(f, 'utf8'));
  grew = keep.size > before;
}

const candidates = [
  ...['data/startup', 'data/details'].flatMap(d => fs.existsSync(d) ? fs.readdirSync(d).map(n => `${d}/${n}`) : []),
  ...fs.readdirSync('data').filter(n => /^site-/.test(n)).map(n => `data/${n}`),
].filter(f => /\.[0-9a-f]{10}\.(?:js|css)$/.test(f));
const gone = candidates.filter(f => !keep.has(f));
let bytes = 0;
for (const f of gone) { bytes += fs.statSync(f).size; if (!dry) fs.unlinkSync(f); }
console.log(`${dry ? 'would remove' : 'removed'} ${gone.length} of ${candidates.length} hashed bundles (${(bytes / 1048576).toFixed(1)} MB); ${keep.size} referenced kept`);

// Thumbnails carry a hash of their cutout, so a changed photo leaves its old set behind.
const live = new Set();
for (const f of ['data/thumbnails.json', 'data/photo-previews.json']) if (fs.existsSync(f))
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/images\/thumb\/([^"]+?-[0-9a-f]{12})(?:-\d+)?\.webp/g)) live.add(m[1]);
if (live.size > 1000 && fs.existsSync('images/thumb')) {
  const stale = fs.readdirSync('images/thumb').filter(n => { const m = n.match(/^(.+?-[0-9a-f]{12})(?:-\d+)?\.webp$/); return m && !live.has(m[1]); });
  let tb = 0;
  for (const n of stale) { const f = 'images/thumb/' + n; tb += fs.statSync(f).size; if (!dry) fs.unlinkSync(f); }
  console.log(`${dry ? 'would remove' : 'removed'} ${stale.length} stale thumbnails (${(tb / 1048576).toFixed(1)} MB)`);
}
