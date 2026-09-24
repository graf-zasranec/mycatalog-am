// Folds duplicate products into one, or removes a product outright, by id.
//
//   node tools/merge.mjs plan.json            what it would do
//   node tools/merge.mjs plan.json --write    do it
//
// plan.json:
//   { "merge":  [["keep-id", "lose-id", ...], ...],   // every later id folds into the first
//     "remove": ["id", ...],                           // gone, and its shop urls pinned to "-"
//     "rename": { "id": "New name", ... },
//     "recat":  { "id": "category", ... } }
//
// tools/apply-issues.mjs does the same from a filled-in questionnaire, but leaves the offers and
// the price history filed under the old id until the next crawl. This moves them now, so a merge
// is visible the moment the site is rebuilt - and it records every merge in data/merged.json, so
// build.mjs can point the old share page at the survivor and an old #/p/ link still lands.
import fs from 'node:fs';

const D = 'data/';
const rd = f => JSON.parse(fs.readFileSync(D + f, 'utf8'));
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const write = process.argv.includes('--write');

const phones = rd('phones.json');
const byId = new Map(phones.map(p => [p.id, p]));
const prices = rd('prices.json');
const history = rd('history.json');
const merged = fs.existsSync(D + 'merged.json') ? rd('merged.json') : {};

const gone = new Map();             // lost id -> surviving id, or '' when removed outright
const problems = [];
const need = id => { if (!byId.has(id)) problems.push(`no such product: ${id}`); return byId.get(id); };

for (const [id, name] of Object.entries(plan.rename || {})) {
  const p = need(id); if (!p) continue;
  console.log(`rename  ${id.padEnd(46)} ${p.name}  ->  ${name}`);
  p.aliases = [...new Set([...(p.aliases || []), p.name])];
  p.name = name;
}
for (const [id, cat] of Object.entries(plan.recat || {})) {
  const p = need(id); if (!p) continue;
  console.log(`recat   ${id.padEnd(46)} ${p.category}  ->  ${cat}`);
  p.category = cat;
}
for (const [keepId, ...loseIds] of plan.merge || []) {
  const keep = need(keepId); if (!keep) continue;
  for (const loseId of loseIds) {
    const lose = need(loseId); if (!lose) continue;
    if (gone.has(keepId)) { problems.push(`${keepId} is itself merged away`); continue; }
    console.log(`merge   ${loseId.padEnd(46)} into ${keepId}`);
    gone.set(loseId, keepId);
    keep.aliases = [...new Set([...(keep.aliases || []), lose.name, ...(lose.aliases || [])])]
      .filter(a => a !== keep.name);
    // the screen is part of a variant: an 11-inch and a 13-inch iPad with 256 GB are two
    const vk = v => `${v.ram ?? ''}|${v.storage ?? ''}|${v.size ?? ''}`;
    const have = new Set((keep.variants || []).map(vk));
    for (const v of lose.variants || [])
      if (!have.has(vk(v))) (keep.variants ||= []).push(v);
    keep.priceAmd = Math.min(keep.priceAmd || Infinity, lose.priceAmd || Infinity);
    keep.priceAmdMax = Math.max(keep.priceAmdMax || 0, lose.priceAmdMax || 0);
    keep.popularity = Math.max(keep.popularity || 0, lose.popularity || 0);
    for (const k of ['released', 'display', 'chipset', 'battery', 'body', 'connectivity', 'camera'])
      if (keep[k] == null && lose[k] != null) keep[k] = lose[k];
  }
}
for (const id of plan.remove || []) {
  if (!need(id)) continue;
  console.log(`remove  ${id}`);
  gone.set(id, '');
}
if (problems.length) { console.log('\n' + problems.join('\n')); process.exit(1); }
if (!write) { console.log('\npass --write'); process.exit(0); }

fs.writeFileSync(D + 'phones.json', JSON.stringify(phones.filter(p => !gone.has(p.id)), null, 1));

// An array, so filtered rather than deleted - a hole serialises as null and the build dies on it.
const V = rd('verdicts.json').filter(v => v && !gone.has(v.id));
fs.writeFileSync(D + 'verdicts.json', JSON.stringify(V, null, 1));

// Offers move to the survivor and stay cheapest first, which is what the app reads them as.
for (const [lose, keep] of gone) {
  const offs = prices.offers[lose] || [];
  delete prices.offers[lose];
  if (!keep || !offs.length) continue;
  const into = prices.offers[keep] || [];
  const seen = new Set(into.map(o => o.url + '|' + o.storage + '|' + o.color + '|' + o.price));
  for (const o of offs) if (!seen.has(o.url + '|' + o.storage + '|' + o.color + '|' + o.price)) into.push({ ...o, id: keep });
  prices.offers[keep] = into.sort((a, b) => a.price - b.price);
}
fs.writeFileSync(D + 'prices.json', JSON.stringify(prices, null, 1));

// One reading per day: where both products were read the same day, the wider spread wins.
for (const [lose, keep] of gone) {
  const pts = history.points[lose] || [];
  delete history.points[lose];
  if (!keep || !pts.length) continue;
  const byDay = new Map((history.points[keep] || []).map(x => [x.d, x]));
  for (const x of pts) {
    const y = byDay.get(x.d);
    if (!y) { byDay.set(x.d, x); continue; }
    // the per-configuration prices too, or a merge threw away the chart's by-size history
    const t = { ...(y.t || {}) };
    for (const [k, v] of Object.entries(x.t || {})) t[k] = t[k] == null ? v : Math.min(t[k], v);
    byDay.set(x.d, { d: x.d, lo: Math.min(x.lo, y.lo), hi: Math.max(x.hi, y.hi), shops: Math.max(x.shops || 0, y.shops || 0),
      ...(Object.keys(t).length ? { t } : {}) });
  }
  history.points[keep] = [...byDay.values()].sort((a, b) => a.d.localeCompare(b.d));
}
fs.writeFileSync(D + 'history.json', JSON.stringify(history));

// The loser's urls are pinned to the survivor so no crawl re-creates it; a removed product's
// urls are pinned to "-", which the scraper reads as "not something we carry".
const links = fs.readFileSync(D + 'links.csv', 'utf8').replace(/\n+$/, '').split(/\r?\n/);
let pinned = 0;
fs.writeFileSync(D + 'links.csv', links.map((l, i) => {
  if (!i) return l;
  const c = l.split(',');
  if (!gone.has(c[0])) return l;
  const to = gone.get(c[0]);
  c[0] = to || '-';
  c[1] = to ? (byId.get(to).brand + ' ' + byId.get(to).name).replace(/,/g, ' ') : '-';
  pinned++;
  return c.join(',');
}).join('\n') + '\n');

// Old links keep working: a merged id sends its visitor to the survivor. A chain (a -> b, then
// b -> c) is resolved here so nothing has to follow it at runtime.
for (const [lose, keep] of gone) if (keep) merged[lose] = keep;
for (const k of Object.keys(merged)) { let t = merged[k], n = 0; while (merged[t] && n++ < 20) t = merged[t]; merged[k] = t; }
fs.writeFileSync(D + 'merged.json', JSON.stringify(merged, null, 1) + '\n');

// The share page and the photos of a product that no longer exists; build.mjs writes a
// redirect page in place of a merged one.
let files = 0;
for (const id of gone.keys()) {
  if (fs.existsSync(`p/${id}`)) { fs.rmSync(`p/${id}`, { recursive: true }); files++; }
  for (const dir of ['images/cut', 'images/thumb', 'images/social'])
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : [])
      if (f === id + '.jpg' || f.startsWith(id + '__')) { fs.rmSync(`${dir}/${f}`); files++; }
}
console.log(`\nwritten: ${gone.size} gone, ${pinned} link row(s) repointed, ${files} file(s) removed`);
console.log('now run:  node build.mjs');
