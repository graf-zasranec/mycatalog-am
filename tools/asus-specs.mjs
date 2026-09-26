// ASUS specs from asus.com's own tech-spec pages, for ASUS laptops and monitors still missing
// weight, screen resolution, panel type or refresh rate. asus.com's robots.txt allows product
// pages; the pages are found through its sitemaps (global first, then US).
//
// A tech-spec page covers a model family - "asus-expertbook-b3-b3405" for our B3405CCA-LY0189 -
// so a page is used only when its model token starts our model code, and a value only when the
// page gives one: a family sold with two screens gives no resolution, one weight ("Start from
// 1.45 kg" included) is used. Results go to data/specs/shop-<category>.json as shop "asus";
// tools/shop-specs.mjs <category> --write applies them (fills gaps only, prints conflicts).
//   node tools/asus-specs.mjs
import fs from 'node:fs';

const UA = 'BetterBot/0.1 (+price comparison; respects robots.txt)';
const g = (o, f) => f.split('.').reduce((a, k) => a == null ? a : a[k], o);
const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const O = JSON.parse(fs.readFileSync('data/prices.json', 'utf8')).offers;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => { const r = await fetch(u, { headers: { 'user-agent': UA } }).catch(() => null); await sleep(1200); return r && r.ok ? r.text() : null; };
const NEED = { laptop: ['body.weight', 'display.resolution'], monitor: ['display.type', 'display.refresh'] };

// 1. every tech-spec page asus.com lists, global site before the US one
const index = await get('https://www.asus.com/sitemap.xml');
const maps = [...(index || '').matchAll(/<loc>(https:\/\/www\.asus\.com\/(?:sitemap\/global|us\/sitemap\/us)\d+\.xml)<\/loc>/g)].map(m => m[1]);
const pages = [];
for (const m of maps) for (const [, u] of (await get(m) || '').matchAll(/<loc>([^<]+\/techspec\/)<\/loc>/g)) pages.push(u);
console.log(`${pages.length} tech-spec pages in ${maps.length} sitemaps`);
const tokens = u => u.split('/').slice(-3, -2)[0].split('-').filter(t => /\d/.test(t) && /[a-z]/.test(t) && t.length >= 4);

// 2. our products with a gap, and their model codes (name, aliases, shop titles)
const todo = P.filter(p => p.brand === 'ASUS' && NEED[p.category] && NEED[p.category].some(f => g(p, f) == null || g(p, f) === ''));
const codesOf = p => [...new Set([p.name, ...(p.aliases || []), ...(O[p.id] || []).map(o => o.title || '')].join(' ')
  .toUpperCase().match(/\b[A-Z]{1,4}\d{3,4}[A-Z0-9]{0,6}\b/g) || [])].map(c => c.toLowerCase()).filter(c => c.length >= 5);
const best = p => {
  let hit = null;
  for (const c of codesOf(p)) for (const u of pages) for (const t of tokens(u))
    if (c.startsWith(t) && t.length >= 5 && (!hit || t.length > hit.t.length)) hit = { u, t, c };
  return hit;
};

// 3. read a page: row title -> text; the Display row of a monitor holds "Panel Type : ..." pairs
const rowsOf = h => Object.fromEntries([...h.matchAll(/class="rowTableTitle">([^<]+)<\/div>([\s\S]*?)(?=class="[^"]*rowTable___|$)/g)]
  .map(m => [m[1].trim(), m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()]));
const one = (arr) => { const s = [...new Set(arr)]; return s.length === 1 ? s[0] : null; };
const read = (cat, rows) => {
  const spec = {};
  const w = Object.entries(rows).find(([k]) => /^Weight/i.test(k));
  if (w) {
    // a monitor's "Net Weight" is the one with its stand; a laptop row may list one weight or several
    const txt = cat === 'monitor' ? (w[1].match(/Net Weight\s*:\s*([\d.]+\s*kg)/i) || [])[1] || '' : w[1];
    const kg = one([...txt.matchAll(/(\d+(?:\.\d+)?)\s*kg/gi)].map(m => m[1]));
    if (kg) spec.Weight = kg + ' kg';
  }
  const d = rows.Display || '';
  if (cat === 'laptop') { const r = one([...d.matchAll(/(\d{3,4})\s*x\s*(\d{3,4})/g)].map(m => m[1] + 'x' + m[2])); if (r) spec['Screen Resolution'] = r; }
  if (cat === 'monitor') {
    const t = (d.match(/Panel Type\s*:\s*([A-Za-z ]+?)(?=\s+[A-Z][a-z]+[^:]*:|$)/) || [])[1];
    if (t) spec['Display type'] = /OLED/i.test(t) ? 'OLED' : /\bVA\b/.test(t) ? 'VA' : /\bTN\b/.test(t) ? 'TN' : /IPS/i.test(t) ? 'IPS' : t.trim();
    const hz = (d.match(/Refresh Rate \(Max\)\s*:\s*(\d{2,3})\s*Hz/i) || [])[1];
    if (hz) spec['Refresh rate'] = hz + ' Hz';
  }
  return spec;
};

const out = {};
const cache = new Map();
for (const p of todo) {
  const hit = best(p);
  if (!hit) { console.log(p.id.padEnd(44), 'no asus.com page for', codesOf(p).join(',') || 'no model code'); continue; }
  if (!cache.has(hit.u)) cache.set(hit.u, await get(hit.u));
  const h = cache.get(hit.u);
  if (!h) { console.log(p.id.padEnd(44), 'page did not load', hit.u); continue; }
  const spec = read(p.category, rowsOf(h));
  if (!Object.keys(spec).length) { console.log(p.id.padEnd(44), 'nothing single-valued on', hit.u); continue; }
  const file = `data/specs/shop-${p.category}.json`;
  (out[file] ||= fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
  // maker: this tool matched the model itself, so shop-specs does not ask the url to carry our full code
  out[file][hit.u + '#' + p.id] = { id: p.id, shop: 'asus', maker: true, status: 200, spec };
  console.log(p.id.padEnd(44), JSON.stringify(spec), '<-', hit.t);
}
for (const [f, d] of Object.entries(out)) fs.writeFileSync(f, JSON.stringify(d, null, 1));
