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

const UA = 'ImpulseBot/0.1 (+price comparison; respects robots.txt)';   // same string scrape.mjs sends
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
  'samsung-galaxy-s25-fe':        '/uk/smartphones/galaxy-s/galaxy-s25-fe-icyblue-512gb-sm-s731blbieub/',
  // The UK site retires a model's page once it stops selling it there and leaves only the
  // accessories behind, so an older phone is seeded from a region that still carries it. Found
  // through samsung.com's own sitemaps - /*/search/ is Disallow in their robots.txt.
  'samsung-galaxy-a07s':          '/levant/smartphones/galaxy-a/galaxy-a07s-black-64gb-sm-a077fzkdmea/',
  'samsung-galaxy-a35':           '/levant/smartphones/galaxy-a/galaxy-a35-5g-awesome-iceblue-128gb-sm-a356elbmmea/',
  'samsung-a15':                  '/levant/smartphones/galaxy-a/galaxy-a15-5g-blue-black-128gb-sm-a156ezkdmea/',
  'samsung-galaxy-watch4-40-mm':  '/ru/watches/galaxy-watch/galaxy-watch4-black-bt-sm-r860nzkacis/',
  // Televisions. One model, one colour, and no "sm-" code in the slug - so the sibling search
  // below finds nothing to pair them with and each simply keeps its own hero shot, which is the
  // right answer for a television. The gallery image is the same 1920px transparent master.
  'samsung-qe55q60abuxru':        '/ru/tvs/qled-tv/q60ab-55-inch-qled-4k-smart-tv-qe55q60abuxru/',
  'samsung-qe55ls03bauxce':       '/ru/lifestyle-tvs/the-frame/ls03b-55-inch-the-frame-qled-4k-smart-tv-black-qe55ls03bauxru/',
  'samsung-qe65s95hauxpy':        '/ru/tvs/oled-tv/s95h-65-inch-4k-smart-tv-qe65s95hauxpy/',
  'samsung-qe83s90daexru':        '/ru/tvs/oled-tv/s90d-83-inch-oled-4k-tizen-os-smart-tv-qe83s90daexru/',
  'samsung-qe85qn800auxru':       '/ru/tvs/qled-tv/qn800a-85-inch-neo-qled-8k-smart-tv-qe85qn800auxru/',
  'samsung-qe85qn90bauxce':       '/ru/tvs/qled-tv/qn90b-85-inch-neo-qled-4k-smart-tv-qe85qn90bauxru/',
  'samsung-qe85qn90cauxru':       '/ru/tvs/qled-tv/qn90c-85-inch-neo-qled-4k-smart-tv-qe85qn90cauxru/',
  'samsung-ue98du9000uxru':       '/ru/tvs/uhd-4k-tv/du9000-98-inch-crystal-uhd-4k-tizen-os-smart-tv-ue98du9000uxru/'
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
// ---------- apple.com ----------
// Apple's stockists here publish 455-700px previews; apple.com serves the same product as a
// 2000px TRANSPARENT png, which is the best source in this whole pipeline - cutout.py sees real
// alpha and keeps it rather than asking the model to guess an edge.
//
// Its robots.txt names no crawler it refuses and disallows only two shop overlays, a Chinese
// path and /tmall - none of which is this.
//
// The naming is regular: a buy page carries "<stem>-<colour>-select-<yyyymm>" for every finish it
// sells, and the image server takes wid/hei/fmt. So one page yields every colour without walking
// to each of them. Gallery stills are NOT usable and are not read: "s12-case-unselect-gallery-1"
// is a close crop of a corner of the watch, not a photograph of the watch.
const APPLE = {
  'apple-iphone-16-plus': { page: 'https://www.apple.com/shop/buy-iphone/iphone-16', stem: 'iphone-16-plus' },
};
const APPLE_IMG = n => `https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/${n}?wid=2000&hei=2000&fmt=png-alpha`;

for (const [id, { page, stem }] of Object.entries(APPLE)) {
  const html = await get(page);
  if (!html) { console.log(`  ${id}: apple page unreachable`); continue; }
  // the colour sits between the stem and "-select", and nothing else on the page matches that
  const re = new RegExp(`as-images\\.apple\\.com/is/(${stem}-([a-z]+)-select-\\d{6})`, 'g');
  const found = new Map();
  for (const m of html.matchAll(re)) if (!found.has(m[2])) found.set(m[2], m[1]);
  if (!found.size) { console.log(`  ${id}: no finish image on the apple page`); continue; }
  out[id] = out[id] || {};
  let first = true;
  for (const [colour, name] of found) {
    out[id][slug(colour)] = APPLE_IMG(name);
    if (first) { out[id].main = APPLE_IMG(name); first = false; }
  }
  console.log(`  ${id}: ${found.size} finish(es) from apple.com - ${[...found.keys()].join(', ')}`);
  await sleep(600);
}

// Merged, not replaced. This file is a record of photographs somebody found, and not all of
// them came from SEEDS: sonos-ace was written in by hand and was silently deleted the first time
// this ran afterwards. A manufacturer also retires a product page - five Samsung seeds stopped
// yielding a gallery image between two runs - and a run that overwrites turns that into the loss
// of a picture the site is still using. What this run found wins; what it did not find stays.
let prev = {};
try { prev = JSON.parse(fs.readFileSync('data/press.json', 'utf8')); } catch { }
const merged = { ...prev };
for (const [id, v] of Object.entries(out)) merged[id] = { ...(merged[id] || {}), ...v };
const kept = Object.keys(prev).filter(k => !out[k]).length;
fs.writeFileSync('data/press.json', JSON.stringify(merged, null, 1) + String.fromCharCode(10));
console.log(`${Object.keys(out).length} product(s) read this run, ${kept} kept from before`);
console.log(`${Object.keys(merged).length} products, ${Object.values(merged).reduce((n, v) => n + Object.keys(v).length, 0)} photos -> data/press.json`);
