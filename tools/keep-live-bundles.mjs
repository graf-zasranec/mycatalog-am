// Copies the fingerprinted bundles the LIVE site points at into the folder about to be published.
//
//   node tools/keep-live-bundles.mjs _site [https://better.am/]
//
// Since 2026-11-08 the site is built at publish time and its bundles are not in git, so a new
// release would otherwise drop every bundle of the previous one. A visitor holding the previous
// page (an open tab, a cached HTML file, the service worker) still asks for those names, so
// they are fetched from the live site and published once more beside the new ones - the same
// "current plus previous release" that tools/prune-bundles.mjs used to keep through git.
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
const site = (process.argv[3] || 'https://better.am/').replace(/\/?$/, '/');
if (!out || !fs.existsSync(out)) { console.error('usage: keep-live-bundles.mjs <site dir> [site url]'); process.exit(2); }

const HASHED = /data\/(?:startup|details)\/[A-Za-z0-9_-]+\.[0-9a-f]{10}\.js|data\/site-[a-z-]+\.[0-9a-f]{10}\.(?:js|css)/g;
const get = async (p, binary) => {
  try {
    const r = await fetch(site + p, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'better.am-publish' } });
    if (!r.ok) return null;
    return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
  } catch { return null; }
};

const wanted = new Set();
const scan = text => { for (const m of String(text || '').matchAll(HASHED)) wanted.add(m[0]); };
for (const root of ['', 'en/', 'ru/', 'data/startup-manifest.json']) scan(await get(root));

let copied = 0, present = 0, missing = 0;
const done = new Set();
// Bundles load other bundles (the app loads detail chunks): follow references until stable.
for (let grew = true; grew;) {
  grew = false;
  for (const file of [...wanted]) {
    if (done.has(file)) continue;
    done.add(file);
    const dest = path.join(out, file);
    if (fs.existsSync(dest)) { present++; scan(fs.readFileSync(dest, 'utf8')); grew = true; continue; }
    const body = await get(file, true);
    if (!body) { missing++; continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body);
    copied++;
    scan(body.toString('utf8'));
    grew = true;
  }
}
console.log(`live bundles: ${wanted.size} referenced, ${present} already built, ${copied} copied from ${site}, ${missing} unavailable`);
// Finding nothing means the live site did not answer. Publishing still goes ahead - when the
// site is down, a fixed release matters more than an older tab's bundles - but it is said loudly.
if (!wanted.size) console.log('::warning::could not read the live site; the previous release\'s bundles are not carried over');
