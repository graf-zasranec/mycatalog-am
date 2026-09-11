// Collects manufacturer press photos for the products whose Armenian stockists only publish
// small previews. Mobile Centre serves 550x550; samsung.com serves the same product as a
// 1920px transparent PNG, and its robots.txt allows us. Output goes to data/press.json, which
// tools/photos.mjs then treats as one more candidate source (biggest photo always wins).
//
//   node tools/press.mjs            refresh data/press.json
//
// SEEDS maps one of our products to any single colour page on samsung.com; the colour chips on
// that page link to its siblings, so one seed per product finds every colour Samsung publishes.
import fs from 'node:fs';

const UA = 'MyCatalogBot/0.1 (+price comparison; respects robots.txt)';   // same string scrape.mjs sends
const B = 'https://www.samsung.com';
const SEEDS = {
  'samsung-galaxy-buds-4':        '/uk/audio-sound/galaxy-buds/galaxy-buds4-white-sm-r540nzwaeub/',
  'samsung-galaxy-buds-4-pro':    '/levant/audio-sound/galaxy-buds/galaxy-buds4-pro-black-sm-r640nzkamea/',
  'samsung-galaxy-buds-core':     '/levant/audio-sound/galaxy-buds/galaxy-buds-core-black-sm-r410nzkamea/',
  'samsung-galaxy-tab-a11':       '/uk/tablets/galaxy-tab-a/galaxy-tab-a11-grey-64gb-wi-fi-sm-x130nzaaeub/',
  'samsung-galaxy-tab-a11-plus':  '/uk/tablets/galaxy-tab-a/galaxy-tab-a11-plus-grey-128gb-wi-fi-sm-x230nzareub/',
  'samsung-galaxy-watch-8':       '/uk/watches/galaxy-watch/galaxy-watch8-40mm-graphite-bluetooth-sm-l320ndaaeua/',
  'samsung-galaxy-watch-8-classic': '/uk/watches/galaxy-watch/galaxy-watch8-classic-46mm-black-bluetooth-sm-l500nzkaeua/',
  'samsung-galaxy-watch-ultra-2': '/uk/watches/galaxy-watch/galaxy-watch-ultra2-titanium-silver-lte-sm-l715fzsaeub/',
  'samsung-galaxy-a56':           '/uk/smartphones/galaxy-a/galaxy-a56-5g-awesome-lightgrey-256gb-sm-a566bzaceub/',
  'samsung-galaxy-a36':           '/uk/smartphones/galaxy-a/galaxy-a36-5g-awesome-lavender-256gb-sm-a366blvgeub/',
  'samsung-galaxy-a26':           '/uk/smartphones/galaxy-a/galaxy-a26-5g-black-256gb-sm-a266bzkceub/',
  'samsung-galaxy-a57':           '/uk/smartphones/galaxy-a/galaxy-a57-5g-awesome-navy-256gb-sm-a576bdbdeub/',
  'samsung-galaxy-a37':           '/uk/smartphones/galaxy-a/galaxy-a37-5g-awesome-charcoal-256gb-sm-a376bzageub/',
  'samsung-galaxy-a27':           '/uk/smartphones/galaxy-a/galaxy-a27-5g-black-128gb-sm-a276bzkbeub/',
  'samsung-galaxy-a17':           '/uk/smartphones/galaxy-a/galaxy-a17-5g-black-128gb-sm-a176bzkaeub/',
  'samsung-galaxy-a07':           '/levant/smartphones/galaxy-a/galaxy-a07-black-128gb-sm-a075fzkgmea/',
  'samsung-galaxy-s26-fe':        '/uk/smartphones/galaxy-s/galaxy-s26-fe-pistachio-128gb-sm-s741blgdeub/',
  'samsung-galaxy-s25-fe':        '/uk/smartphones/galaxy-s/galaxy-s25-fe-icyblue-512gb-sm-s731blbieub/'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const get = async u => {
  const r = await fetch(u.startsWith('http') ? u : B + u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
  return r.ok ? r.text() : '';
};

// A colour page's URL is ".../<family tokens>-<colour>-<spec tokens>-sm-<model>/". The family is
// whatever every sibling shares, so it falls out of the longest common token prefix rather than
// from a hand-written rule. Siblings must have the same token count as the seed, or
// "galaxy-tab-a11-plus-..." gets read as an a11 in the colour "plus".
const tokens = url => url.split('/').filter(Boolean).pop().split('-');
const lcp = lists => {
  const out = [];
  for (let i = 0; i < lists[0].length; i++) { const w = lists[0][i]; if (lists.every(l => l[i] === w)) out.push(w); else break; }
  return out.length;
};
const model = url => (url.match(/-sm-([a-z]\d{3})/i) || [, ''])[1].toLowerCase();
const JUNK = new Set(['5g', 'lte', 'wi', 'fi', 'bluetooth', 'mm', 'gb', 'tb', 'sm']);
function colorAfter(url, n) {
  const t = tokens(url).slice(n);
  const at = t.findIndex(w => w === 'sm');
  const words = (at < 0 ? t : t.slice(0, at)).filter(w => w && !/\d/.test(w) && !JUNK.has(w));
  return words.length ? words.join(' ') : null;
}

// the first gallery still is the hero shot; ORIGIN_PNG is Samsung's untouched transparent master
function heroImage(html) {
  const hits = [...html.matchAll(/images\.samsung\.com\/is\/image\/samsung\/p6pim\/[^"'\s?]+/g)].map(m => m[0]);
  const gallery = hits.filter(u => u.includes('/gallery/') && !u.includes('-thumb-'));
  return gallery.length ? 'https://' + gallery[0] + '?$ORIGIN_PNG$' : null;
}

const out = {};
for (const [id, seed] of Object.entries(SEEDS)) {
  const html = await get(seed);
  if (!html) { console.log(`  ${id}: seed page unreachable`); continue; }
  const dir = seed.slice(0, seed.lastIndexOf('/', seed.length - 2) + 1);
  const n = tokens(seed).length, seedModel = model(seed);
  const sibs = new Set([seed]);
  for (const m of html.matchAll(/"?(\/[a-z]{2,7}\/[a-z-]+\/[a-z0-9-]+\/[a-z0-9-]*sm-[a-z0-9]+)\/?"/gi)) {
    const u = m[1] + '/';
    // Same directory and token count is not enough - the regional sites list every Buds model
    // side by side. Colour variants of one product share a model family (R540 vs R640), so the
    // model code is what actually separates them.
    if (u.startsWith(dir) && tokens(u).length === n && model(u) === seedModel) sibs.add(u);
  }
  const cut = sibs.size > 1 ? lcp([...sibs].map(tokens)) : 0;

  out[id] = {};
  for (const s of sibs) {
    const page = s === seed ? html : await get(s);
    if (s !== seed) await sleep(600);
    const img = heroImage(page);
    if (!img) continue;
    if (s === seed) out[id].main = img;
    const c = cut && colorAfter(s, cut);
    if (c) out[id][slug(c)] = img;
    console.log(`  ${id} ${c ? slug(c) : 'main only'}`);
  }
  if (!Object.keys(out[id]).length) { delete out[id]; console.log(`  ${id}: no gallery image on the page`); }
  await sleep(600);
}
fs.writeFileSync('data/press.json', JSON.stringify(out, null, 1) + String.fromCharCode(10));
console.log(`${Object.keys(out).length} products, ${Object.values(out).reduce((n, v) => n + Object.keys(v).length, 0)} photos -> data/press.json`);
