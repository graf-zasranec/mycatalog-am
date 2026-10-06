// Builds three outputs from _shell.html + _app.js + data/.
//   index.html           standalone page, loads images/ from disk  <- open this locally
//   index.embedded.html  standalone single file, images inlined    <- one file to email/host
//   artifact.html        head-less fragment, images inlined        <- for publishing as an Artifact
// Run: node build.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { pairs } from './tools/pairs.mjs';
import { attachOfferConfigs } from './tools/offer-configs.mjs';
import { goatScript } from './tools/analytics.mjs';
const rd = f => fs.readFileSync(f, 'utf8');
const phones = JSON.parse(rd('data/phones.json'));
const STR = { hy: {}, ru: {}, en: {} };
for (const s of JSON.parse(rd('data/strings.json'))) { STR.hy[s.key] = s.hy; STR.ru[s.key] = s.ru; STR.en[s.key] = s.en; }
// real shop offers from scrape.mjs; optional, the site falls back to estimates without it
const HISTORY = fs.existsSync('data/history.json') ? JSON.parse(rd('data/history.json')) : { points: {} };
const TERMS = JSON.parse(rd('data/terms.json'));
// Announced, not yet on sale. Kept OUT of phones.json on purpose: these have no spec sheet we
// can stand behind and no offer anyone can buy today, and inventing either is the one thing
// this catalogue must not do. A name, a shop's pre-order price and a date is all we know.
const COMING = fs.existsSync('data/coming.json') ? JSON.parse(rd('data/coming.json')) : { when: {}, items: [] };
// colour photos whose shape fights the main shot: fine on the product page, a lurch in the
// card carousel. Regenerate with: python tools/pageonly.py
const PAGEONLY = fs.existsSync('data/pageonly.json') ? JSON.parse(rd('data/pageonly.json')) : {};
// duplicate id -> the product it was folded into, written by tools/merge.mjs
const MERGED = fs.existsSync('data/merged.json') ? JSON.parse(rd('data/merged.json')) : {};
// articles, newest first; data/blog.json holds each in hy, ru and en
const BLOG = (fs.existsSync('data/blog.json') ? JSON.parse(rd('data/blog.json')) : []).sort((a, b) => b.date.localeCompare(a.date));
const PRICES = fs.existsSync('data/prices.json') ? JSON.parse(rd('data/prices.json')) : { shops: {}, offers: {} };
attachOfferConfigs(phones, PRICES.offers || {});
// Popularity nobody set (unsure) was a flat default of 40 on 1,100 products, so "popular" sorted
// them in file order. How many shops stock a product is a real, nightly-updated signal: 1 shop -> 20,
// 8+ -> 60. A number somebody set by hand is never touched.
for (const p of phones) if ((p.unsure || []).includes('popularity'))
  p.popularity = Math.min(60, 14 + 6 * new Set((PRICES.offers[p.id] || []).map(o => o.shop)).size);
// The shop's own page title rides along in prices.json because the capacity re-derivation reads
// it, but nothing in the app renders it - and inlining it puts a shop's marketing copy
// ("... - Warranty - AllSell") into our page and adds weight for nothing.
// ...and the id, which every offer repeated although the offers are already stored UNDER that
// id. 4,949 copies of a key the reader is holding anyway: 135 KB of the page, for nothing. The
// one place that read it had the product in scope all along.
// inStock, seeded and simFromPage are the crawler's bookkeeping, and an empty field reads the same
// as a missing one everywhere the app looks: ~100 KB of the page for nothing.
for (const list of Object.values(PRICES.offers || {})) for (const o of list) {
  delete o.title; delete o.sku; delete o.image; delete o.id; delete o.seeded; delete o.simFromPage;
  for (const k of Object.keys(o)) if (o[k] == null || o[k] === '') delete o[k];
}

// Prices that really fell, for the front page. The history's first weeks grew from one shop to
// nine for a new iPhone and the cheapest price fell with every shop added: that is coverage, not
// a price cut. So a fall counts only across the latest run of days on which the SAME number of
// shops was read, the run has to be a week long, the fall at least 5%, and the cheapest offer
// today has to be the price the history ends on. Worked out here because the served page does not
// carry the history until a product page asks for it.
const DROPS = [];
for (const p of phones) {
  const pts = (HISTORY.points || {})[p.id], offs = ((PRICES.offers || {})[p.id] || []).slice().sort((a, b) => a.price - b.price);
  if (!pts || pts.length < 7 || !offs.length) continue;
  const last = pts[pts.length - 1];
  if (last.lo !== offs[0].price || last.shops < 2) continue;   // one shop flipping between two listings is noise
  let i = pts.length - 1;
  while (i > 0 && pts[i - 1].shops === last.shops) i--;
  const run = pts.slice(i);
  if (run.length < 7) continue;
  // the LAST day the higher price was seen, so a price that bounced back up and down again is
  // dated from its latest fall, not its first
  const top = run.reduce((a, b) => b.lo >= a.lo ? b : a);
  if ((top.lo - last.lo) / top.lo < 0.05) continue;
  DROPS.push({ id: p.id, lo: last.lo, since: top.d, fall: top.lo - last.lo, run: run.map(v => v.lo),
    loShop: offs[0].shop, shops: last.shops, pop: p.popularity || 0 });
}
DROPS.sort((a, b) => b.pop - a.pop);

// A configuration a shop actually sells is a real configuration. phones.json carries the spec
// sheet, which lags: the MacBook Pro 14 sells at 512 GB, the Pixel 11 Pro XL at 12/256, and
// neither was listed, so their cheapest offers could not be selected or even seen.
for (const p of phones) {
  if (p.variantUnit === 'mm') continue;                    // watch case sizes are not capacities
  const seen = new Set((p.variants || []).map(v => `${v.ram ?? ''}|${v.storage ?? ''}`));
  const add = [];
  for (const o of (PRICES.offers && PRICES.offers[p.id]) || []) {
    // A shop typo is not a configuration, and neither is one number sitting in two fields: viva
    // published the whole Galaxy S26 range with the RAM copied into the capacity column, and this
    // minted "12 GB" and "16 GB" buttons in the STORAGE row of an S26 Ultra. Nothing in this
    // catalogue stores less than the 32 GB of a Galaxy Tab A8, so below that it is a memory size
    // that has wandered, not a disk.
    if (!(o.storage >= 32 && o.storage <= 8192)) continue;
    if (o.ram != null && o.storage === o.ram) continue;
    const compatible = (p.variants || []).filter(v => v.storage === o.storage && (o.size == null || v.size == null || v.size === o.size));
    const knownRAM = [...new Set(compatible.map(v => v.ram).filter(v => v != null))];
    const ram = o.ram ?? (knownRAM.length === 1 ? knownRAM[0] : null);
    if (ram == null && (p.variants || []).some(v => v.ram != null)) continue;
    const k = `${ram ?? ''}|${o.storage}`;
    if (seen.has(k)) continue;
    seen.add(k);
    add.push({ ram, storage: o.storage, ...(o.size != null ? { size: o.size } : {}), priceAmd: o.price });
  }
  if (add.length) {
    p.variants = [...(p.variants || []), ...add]
      .sort((a, b) => (a.storage || 0) - (b.storage || 0) || (a.ram || 0) - (b.ram || 0));
  }
}

// Nothing here is sold with one gigabyte of storage. A "1" in that column is a terabyte whose
// unit got dropped on the way in - 83 laptops shipped that way and every one of them published
// "1 GB" on its page. The importer that did it was a one-off script, so the guard lives at the
// gate every product must pass rather than in whatever writes phones.json next. Watches and
// video cards measure something else in that field, and say so with variantUnit.
// The other way this goes wrong: a shop writes the configuration as "12/512GB" and the figure on
// the LEFT of the slash is taken. 8 and 12 clear the guard above, so the RAM ships as the capacity
// - and scrape.mjs then refuses every title that states a real one, leaving the product
// unreachable and the next import proposing a duplicate of it. No phone, tablet or laptop is sold
// with under 32 GB; a Kindle at 16 GB and an RTX 4060 at 8 GB are neither, so the floor is per
// category. Warned rather than refused: each one is settled by reading a shelf, not by a rule.
const RAMISH = [];
for (const p of phones)
  for (const v of p.variants || []) {
    if (!p.variantUnit && v.storage != null && v.storage < 8) {
      console.error(`build: ${p.id} says ${v.storage} GB of storage - a dropped TB?`);
      process.exit(1);
    }
    if (!p.variantUnit && v.storage != null && v.storage < 32 &&
        ['phone', 'tablet', 'laptop', 'desktop'].includes(p.category))
      RAMISH.push(`${p.id} (${p.category}) ${v.storage} GB`);
  }
if (RAMISH.length)
  console.warn(`  ! ${RAMISH.length} variant(s) hold what looks like RAM in the storage field: ` +
               RAMISH.slice(0, 8).join(', ') + (RAMISH.length > 8 ? ` +${RAMISH.length - 8} more` : ''));

// No price, no entry. A comparison with nothing to compare is an empty page wearing a product's
// name. Warned rather than refused, because a shop that was down on crawl day also leaves a
// product with no offers, and that is a bad day rather than a product gone: node tools/prune.mjs
// decides, after a clean crawl.
{
  const dead = phones.filter(p => !((PRICES.offers || {})[p.id] || []).length);
  if (dead.length) console.warn(`  ! ${dead.length} product(s) nothing sells - node tools/prune.mjs: ` +
    dead.slice(0, 6).map(p => p.id).join(', ') + (dead.length > 6 ? ', ...' : ''));
}


// A price series for a product that left the catalogue is dead weight nothing can render.
for (const k of Object.keys(HISTORY.points || {}))
  if (!phones.some(p => p.id === k)) { console.warn('  ! history for a product not in the catalogue:', k); delete HISTORY.points[k]; }

// transparent cutouts made by tools/cutout.mjs: images/cut/<phoneId>__<colourSlug>.webp
// "<id>__main.webp" is the default shot; the rest are per-colour.
const CUT = 'images/cut';
const cutFiles = fs.existsSync(CUT) ? fs.readdirSync(CUT).filter(f => f.endsWith('.webp')) : [];

// WebP width, read straight out of the header - the product page prefers the colour shot over
// the main one, and 30 colour photos were a third of the main's resolution, so the card looked
// sharp and the product page looked soft for the same phone. A colour shot that much worse is
// not worth showing: dropping it falls back to the main, which is what the eye wants.
function webpWidth(file) {
  const b = fs.readFileSync(file, { encoding: null }).subarray(0, 40);
  if (b.toString('ascii', 0, 4) !== 'RIFF') return 0;
  const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8X') return ((b[24] | (b[25] << 8) | (b[26] << 16)) + 1);
  if (tag === 'VP8L') return ((b[21] | ((b[22] & 0x3f) << 8)) + 1);
  if (tag === 'VP8 ') return b.readUInt16LE(26) & 0x3fff;
  return 0;
}
const cutW = {};
for (const f of cutFiles) { try { cutW[f] = webpWidth(`${CUT}/${f}`); } catch { cutW[f] = 0; } }

// The photo backlog, published. Every build writes what still needs a picture to a file that
// goes live with the site, so whoever is finding images can read the current list over HTTP
// instead of being handed a stale copy:
//     https://better.am/data/photos-needed.json
//
// Two different jobs, and they are not interchangeable. MISSING is a grey box on the page.
// TOO SMALL needs a LARGER ORIGINAL and never an enlargement - a 545px picture stretched to 600
// is the same picture with softer edges, which is the trade this floor exists to refuse.
{
  const FLOOR = 600;
  const need = [];
  const cuts = fs.readdirSync(CUT);
  for (const p of phones) {
    // a product shown by its colour photos alone (no __main) is not missing: the card uses them
    const f = `${CUT}/${fs.existsSync(`${CUT}/${p.id}__main.webp`) ? `${p.id}__main.webp` : cuts.find(c => c.startsWith(p.id + '__')) || `${p.id}__main.webp`}`;
    const shops = new Set(((PRICES.offers || {})[p.id] || []).map(o => o.shop)).size;
    const row = { id: p.id, brand: p.brand, name: p.name, category: p.category, shops,
                  // what to type into an image search to find the right thing
                  query: `${p.brand} ${p.name}`.replace(/\s+/g, ' ').trim() };
    if (!fs.existsSync(f)) { need.push({ ...row, what: 'missing', width: 0 }); continue; }
    const w = webpWidth(f);
    if (w && w < FLOOR) need.push({ ...row, what: 'too small', width: w });
  }
  // the ones people actually land on first: a missing photo costs most where the shops agree
  need.sort((a, b) => (a.what === b.what ? 0 : a.what === 'missing' ? -1 : 1)
    || b.shops - a.shops || (b.width ? 1 : 0) - (a.width ? 1 : 0) || a.id.localeCompare(b.id));
  fs.writeFileSync('data/photos-needed.json', JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    floorPx: FLOOR,
    note: 'too small needs a larger original, not an enlargement',
    total: phones.length,
    missing: need.filter(n => n.what === 'missing').length,
    tooSmall: need.filter(n => n.what === 'too small').length,
    products: need,
  }, null, 1));
  console.log(`  photos-needed.json: ${need.filter(n => n.what === 'missing').length} missing, ` +
              `${need.filter(n => n.what === 'too small').length} under ${FLOOR}px`);
}


// small: the 600 px copy where one exists. The product page wants the full-size colour shot;
// the card cycling through the same colours in a 123 px box does not.
// The same 600px floor tools/cutout.py mattes to; a floor of its own here would build cutouts the
// page cannot show. (A temporary 500px floor for unpopular products ran 2026-09-21 to 10-04.)
const colourFloor = () => 600;

const DUPES = fs.existsSync('data/photo-dupes.json') ? JSON.parse(rd('data/photo-dupes.json')) : {};
const COLOR_ALIASES = JSON.parse(rd('data/color-aliases.json'));
const colourSlug = c => String(c).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function cutMap(inline, small) {
  const m = {};
  for (const f of cutFiles) {
    const [id, rest] = f.replace(/\.webp$/, '').split('__');
    if (!id || !rest) continue;
    // 600px is the catalogue's floor for any photo. This used to be a fraction of the main
    // shot's width, which punished the good main shots: the Fold 8's 719px colours were thrown
    // out against its 1200px main while the Ultra's 937px ones squeaked past the same ratio.
    // A verified lower-resolution colour photo still answers a colour selection.
    // Never substitute another finish solely because its image is larger.
    // colours whose photo is another colour's photo (tools/photo-dupes.py): a dot for them would
    // show the wrong colour, so they have no colour photo until a real one is supplied
    if (rest !== 'main' && (DUPES[id] || []).includes(rest)) continue;
    (m[id] ||= {})[rest] = inline
      ? 'data:image/webp;base64,' + fs.readFileSync(`${CUT}/${f}`).toString('base64')
      : `${CUT}/${f}`;
  }
  for (const [id, aliases] of Object.entries(COLOR_ALIASES)) {
    for (const from of Object.keys(aliases)) {
      let to = from; const visited = new Set();
      while (aliases[to] && !visited.has(to)) { visited.add(to); to = aliases[to]; }
      const old = colourSlug(from), canonical = colourSlug(to);
      if (m[id]?.[old] && !m[id][canonical]) m[id][canonical] = m[id][old];
    }
  }
  return m;
}
const productImages = cutMap(false);
const productImage = p => (p.colors || []).map(c => productImages[p.id]?.[colourSlug(c)]).find(Boolean)
  || productImages[p.id]?.main || Object.values(productImages[p.id] || {})[0] || null;

// The stylesheet must balance. One brace left open by a merge put every rule after it inside
// "@media (max-width:760px)", and the whole desktop site shipped unstyled; one stray "}" makes a
// browser drop the rule after it. Neither shows up as an error anywhere - so the build refuses.
{
  const s = rd('_shell.html'), css = s.slice(s.indexOf('<style>'), s.indexOf('</style>'))
    .replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' ')).replace(/"[^"\n]*"|'[^'\n]*'/g, q => q.replace(/[{}]/g, ' '));
  const base = s.slice(0, s.indexOf('<style>')).split('\n').length - 1;
  let depth = 0, line = 1, opened = [];
  for (const c of css) {
    if (c === '\n') line++;
    if (c === '{') opened.push(line + base), depth++;
    if (c === '}') { if (!depth) { console.error(`build: _shell.html line ${line + base} closes a block that was never opened`); process.exit(1); } depth--; opened.pop(); }
  }
  if (depth) { console.error(`build: _shell.html line ${opened.pop()} opens a block that is never closed`); process.exit(1); }
}

// One check: pull the real tr() out of _app.js and prove the dictionary fires.
// If a term stops matching (bad boundary, key typo) the build fails here, not in the browser.
{
  const src = rd('_app.js');
  const a = src.indexOf('const TERMKEYS'), b = src.indexOf('/* TR_END */');
  // indexOf returns -1 on a renamed marker, and slice(-1, n) would build a bogus function that
  // either throws somewhere unrelated or passes while asserting nothing.
  if (a < 0 || b <= a) { console.error('build: cannot find the tr() markers in _app.js (const TERMKEYS / TR_END)'); process.exit(1); }
  const body = src.slice(a, b);
  const tr = new Function('TERMS', body + '; return tr;')(TERMS);
  const cases = [
    ['Octa-core (2x2.0 GHz Cortex-A75 & 6x1.8 GHz Cortex-A55)', 'hy', 'Ութմիջուկ (2x2.0 GHz Cortex-A75 & 6x1.8 GHz Cortex-A55)'],
    ['Aluminum frame, glass back', 'ru', 'Алюминиевая рамка, стеклянная задняя панель'],
    ['Awesome Lime', 'hy', 'Լայմ'],
    ['Titanium Jetblack', 'ru', 'Титановый Глубокий чёрный'],
    ['Nano-SIM + eSIM', 'en', 'Nano-SIM + eSIM'],
  ];
  for (const [input, lang, want] of cases) {
    const got = tr(input, lang);
    if (got !== want) { console.error(`terms: ${lang} "${input}"
  got  ${got}
  want ${want}`); process.exit(1); }
  }
  console.log('terms self-test: ' + cases.length + ' checks pass');
}

// The app's own checks. Run here so a build cannot ship logic that fails them; the scraper had
// 96 checks and the 1800 lines a visitor touches had none.
{
  const r = spawnSync(process.execPath, ['tools/app-test.mjs'], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  if (r.status !== 0) { process.stderr.write(r.stderr || ''); process.exit(1); }
}

// SEO. The router lives in the hash, so a crawler only ever sees ONE url - there is no point
// emitting a sitemap of #/p/... fragments, because fragments are not indexed as separate pages.
// What does carry weight on a single page: a real title and description, the social card, a
// canonical, and an ItemList that names the products and their cheapest Armenian price.
const SITE = 'https://better.am/';
const pricesOf = p => ((PRICES.offers && PRICES.offers[p.id]) || [])
  .map(o => o.price).filter(Number.isFinite);
const bestOf = p => { const l = pricesOf(p); return l.length ? Math.min(...l) : p.priceAmd; };
// A single Offer says "this costs X" and throws away the two facts this site exists to publish:
// how many shops sell it and what the spread is. AggregateOffer carries both, and it is what
// earns a price range in a search result rather than one bare number.
const offerOf = p => {
  const l = pricesOf(p);
  if (!l.length) return undefined;
  if (l.length === 1) {
    const o = PRICES.offers[p.id].find(o => Number.isFinite(o.price));
    return { '@type': 'Offer', priceCurrency: 'AMD', price: l[0],
      ...(o.inStock === true ? { availability: 'https://schema.org/InStock' } : {}),
      ...(o.url && /^https?:\/\//.test(o.url) ? { url: o.url } : {}) };
  }
  return {
    '@type': 'AggregateOffer', priceCurrency: 'AMD',
    lowPrice: Math.min(...l), highPrice: Math.max(...l),
    offerCount: new Set(((PRICES.offers && PRICES.offers[p.id]) || []).map(o => o.shop)).size,
  };
};
const SEO = {
  url: SITE,
  img: 'images/social/better-am.jpg',
  title: `Better.am: ${phones.length} սարքի գներ Հայաստանի խանութներում`,
  desc: `Հեռախոսներ, նոութբուքեր, ականջակալներ և ժամացույցներ՝ ${phones.length} մոդել, `
      + `${Object.keys(PRICES.shops || {}).length} խանութի գներ դրամով, համեմատում և զտիչներ։`,
  ld: {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Better.am',
    // the 50 most popular: every product now has its own page, which is where a crawler finds it
    numberOfItems: Math.min(50, phones.length),
    itemListElement: phones.filter(p => pricesOf(p).length && productImage(p)).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 50).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: (p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.name : p.brand + ' ' + p.name),
        brand: { '@type': 'Brand', name: p.brand },
        category: p.category || 'phone',
        ...(productImage(p) ? { image: SITE + productImage(p) } : {}),
        url: SITE + 'p/' + p.id + '/',
        offers: offerOf(p)
      }
    }))
  }
};

// A static site on GitHub Pages knows nothing about its own visitors: no server, no log anyone
// can read. Counting them needs a third party, so which one is a file and not a code change,
// and with no file there is no counter, no third-party request and no change to the policy
// below. data/analytics.json: { "provider": "umami", "id": "<site id>", "host": "<origin>" }
// or { "provider": "goatcounter", "id": "<your code>" }.
const AN = fs.existsSync('data/analytics.json') ? JSON.parse(rd('data/analytics.json')) : null;
const COUNTER = !AN ? { tag: '', script: [], connect: [], img: [] }
  : AN.provider === 'umami' ? {
      tag: `<script defer src="${AN.host || 'https://cloud.umami.is'}/script.js" data-website-id="${AN.id}"><\/script>`,
      script: [AN.host || 'https://cloud.umami.is'], connect: [AN.host || 'https://cloud.umami.is'], img: [] }
  : AN.provider === 'goatcounter' ? {
      tag: `<script defer src="/data/site-analytics.js"><\/script>`,
      script: ['https://gc.zgo.at'], connect: [`https://${AN.id}.goatcounter.com`], img: [`https://${AN.id}.goatcounter.com`] }
  : (() => { throw new Error('data/analytics.json: unknown provider ' + AN.provider); })();
if (AN) console.log(`visitor counter: ${AN.provider}`);
if (AN?.provider === 'goatcounter') fs.writeFileSync('data/site-analytics.js', goatScript(AN.id));

const THEME_JS = `try{var _t=JSON.parse(localStorage.getItem('better.v2')||localStorage.getItem('mycatalog.v2')||'{}').theme;if(_t&&_t!=='auto')document.documentElement.dataset.theme=_t}catch(e){}`;
const sha = js => "'sha256-" + crypto.createHash('sha256').update(js, 'utf8').digest('base64') + "'";

// GitHub Pages serves no custom headers, so the policy has to travel in the document. Both
// inline scripts are named by HASH rather than allowed wholesale with 'unsafe-inline': the page
// then cannot run a script this build did not produce, which is the point of having a CSP at all
// on a page that renders scraped shop names. Styles still need 'unsafe-inline' - the colour
// swatches carry a style attribute - and img-src keeps data: for the embedded build.
// connect-src is 'self' and nothing more. It was 'none', which is the right answer for a page
// that fetches nothing; the served build now fetches data/verdicts.json and data/history.json
// from its own origin when somebody opens a product page. 'self' permits exactly those two
// and no destination off this site, so nothing the page holds can be sent anywhere.
// frame-ancestors is NOT here: a meta element cannot deliver it and the browser logs an error
// on every load. Clickjacking cover would need a real header, which GitHub Pages does not serve.
// the brand kit's favicon (Fraunces "b.", dot on the baseline as in the wordmark), inlined: no extra request
const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync('images/favicon.svg', 'utf8').trim()).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2F/g, '/');
const HEAD_OPEN = appJs => `<!doctype html>
<html lang="hy"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' ${sha(THEME_JS)} ${sha(appJs)}${COUNTER.script.map(h => ' ' + h).join('')}; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:${COUNTER.img.map(h => ' ' + h).join('')}; connect-src ${["'self'", ...COUNTER.connect].join(' ')}; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="icon" href="${FAVICON}">
<meta name="description" content="${SEO.desc}">
<link rel="canonical" href="${SEO.url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Better.am">
<meta property="og:locale" content="hy_AM">
<meta property="og:locale:alternate" content="ru_RU">
<meta property="og:locale:alternate" content="en_US">
<meta property="og:title" content="${SEO.title}">
<meta property="og:description" content="${SEO.desc}">
<meta property="og:url" content="${SEO.url}">
<meta property="og:image" content="${SEO.url}${SEO.img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${SEO.title}">
<meta name="twitter:description" content="${SEO.desc}">
<meta name="twitter:image" content="${SEO.url}${SEO.img}">
<script type="application/ld+json">${JSON.stringify([homeListLD('hy'),
  { '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE + '#website', name: 'Better.am', alternateName: 'better.am', url: SITE, inLanguage: ['hy', 'ru', 'en'] },
  { '@context': 'https://schema.org', '@type': 'Organization', '@id': SITE + '#organization', name: 'Better.am', url: SITE, logo: SITE + 'images/favicon.svg' }
]).replace(/</g, String.fromCharCode(92) + "u003c")}<\/script>
${alts('')}
<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
<script>${THEME_JS}<\/script>
${COUNTER.tag}
`;
const HEAD_CLOSE = `</head><body>
`;

// The artifact platform supplies its own <head>, so the fragment build stays as-is. The
// standalone files are whole documents, and there <title>/<link>/<style> were landing in
// <body> - valid only because browsers hoist them, and it delays the webfont.
// The shell ships a placeholder <title> so the file opens sensibly on its own; the build puts
// the real one in. _app.js overwrites document.title per route, so this is what a crawler and
// the first paint see, and it is the line a search result prints.
function seoTitle(shell) {
  return shell.replace('<title>Better.am</title>', `<title>${SEO.title}</title>`);
}

function splitShell(shell) {
  const i = shell.lastIndexOf('</style>');
  return i < 0 ? { head: '', body: shell } : { head: shell.slice(0, i + 8), body: shell.slice(i + 8) };
}

function build({ inline, standalone }) {
  const colors = cutMap(inline);
  // the same colour shots at 600 px, for the card that cycles through them in a 123 px box
  // Cards show the very photo the product page shows (owner, 2026-10-02): a separate thumbnail
  // set kept drifting out of step with it, so there is none - THUMB() falls through to IMG().
  const colorThumbs = {};
  const at = f => inline ? 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64') : f;
  const main = {}, thumb = {};
  for (const p of [...phones, ...(COMING.items || [])]) {
    const cut = `${CUT}/${p.id}__main.webp`;
    // The card shows what the product page opens on: the first listed colour that has its own
    // photo. A main shot in a finish nobody here sells (a pink Band 10 over Black/Silver) made the
    // card promise a colour the page did not have (owner, 2026-10-02).
    // A product with colour photos and no __main used to be skipped here, so every IMG() caller
    // (compare-with cards, the hero) showed the empty placeholder for 95 products.
    const first = (p.colors || []).map(c => (colors[p.id] || {})[c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')]).find(Boolean)
      || Object.values(colors[p.id] || {})[0];
    if (!first && !fs.existsSync(cut)) { console.warn('  ! missing image for', p.id); continue; }
    main[p.id] = first || at(cut);
    // The embedded build carries every photo as a data URI. Inlining a second copy of all 198
    // would add 7 MB to a file nobody downloads over a network, so there it keeps one size and
    // THUMB() falls through to IMG().

  }
  const imgdata = `const IMGDATA=${JSON.stringify(main)};\nconst THUMBDATA=${JSON.stringify(thumb)};\n`
    + `const COLORIMG=${JSON.stringify(colors)};\nconst COLORTHUMB=${JSON.stringify(colorThumbs)};\n`;
  const shell = seoTitle(rd('_shell.html')).replace('<main id="main" tabindex="-1"></main>', `<main id="main" tabindex="-1">${homeContent('hy')}</main>`);
  // the script BODY is hashed for the CSP, so it is built once and wrapped separately
  // The verdict sentences and the price history are read on a PRODUCT page and nowhere else,
  // and together they are 531 KB of the 3.26 MB this file makes a browser parse before it can
  // paint one card. The served build leaves them out and fetches data/verdicts.json and
  // data/history.json the first time somebody opens a product - both are already published,
  // because the repo root is the Pages publish root. The single-file builds keep carrying them:
  // a file somebody mails or pastes has nothing to fetch from.
  const lazy = !inline;
  // A shop title holding '</script>' would end this script early and blank the site.
  // < is the same character to JS, and the HTML parser never sees a tag.
  const J = o => JSON.stringify(o).replace(/</g, '\\u003c');
  // The served build keeps the products and the prices in two files of their own (owner, 2026-10-04):
  // prices change every night, products rarely and the app code less, so a returning visitor
  // re-downloads only what moved. Plain classic scripts, run in order before the app, so their
  // top-level consts are the same globals the app always read and no app code had to change.
  const products = `const DATA=${J(phones.map(({ summaryEn, sources, ...p }) => p))};\n`
    + `const COMPARE_WITH=${J(pairs(phones, PRICES.offers || {}))};\n`
    + `const PBOX=${fs.existsSync('data/photo-box.json') ? J(JSON.parse(rd('data/photo-box.json'))) : '{}'};\n`;
  const prices = `const PRICES=${J(PRICES)};\nconst DROPS=${J(DROPS)};\n`;
  let ext = '';
  if (lazy) {
    for (const [f, body] of [['data/site-products.js', products], ['data/site-prices.js', prices]]) {
      fs.writeFileSync(f, body);
      ext += `<script src="${f}?v=${crypto.createHash('sha256').update(body).digest('hex').slice(0, 10)}"><\/script>\n`;
    }
  }
  let appJs = '\n'
    + (lazy ? '' : products + prices)
    + `const STR=${J(STR)};\n`
    + (lazy ? 'let HISTORY={points:{}};\nconst LAZYDATA=true;\n'
            : `const HISTORY=${J(HISTORY)};\nconst LAZYDATA=false;\n`)
    // Wrapping this in JSON.parse was tried and measured: 268 ms to interactive against 294 ms
    // for the literal, three loads each, same machine - 9% - and it cost 77 KB of backslashes.
    // Not worth carrying the escaping for that, so the literal stays.
    + `const TERMS=${J(TERMS)};\n`
    + `const COMING=${J(COMING)};\n`
    + `const PAGEONLY=${J(PAGEONLY)};\n`
    + `const MERGED=${J(MERGED)};\n`
    + `const BLOG=${J(BLOG)};\n`
    + imgdata + rd('_app.js') + '\n';
  // The CSP pins a sha256 of this script and the HTML parser normalises CRLF to LF before it
  // hashes. A Windows checkout with core.autocrlf=true hands us CRLF, so the hash written here
  // and the hash the browser computes disagree, the browser refuses to run the app at all, and
  // the page comes up blank on the machine that built it. Emit what the parser will see.
  appJs = appJs.replace(/\r\n/g, '\n');
  const script = '\n' + ext + '<script>' + appJs + '<\/script>\n';
  if (!standalone) return shell + script;          // the artifact platform supplies the <head>
  const { head, body } = splitShell(shell);
  return HEAD_OPEN(appJs) + head + HEAD_CLOSE + body + script + '\n</body></html>\n';
}

// Search engines in, AI crawlers out. The owner wants the catalogue found through search and not
// harvested into AI training sets or answered from by AI assistants.
//
// Blocked: crawlers that collect for training, and the fetchers AI assistants send when a user
// asks them something. Google-Extended and Applebot-Extended are opt-out TOKENS, not crawlers:
// naming them keeps pages out of Gemini and Apple Intelligence without touching Google or Apple
// search, which crawl as Googlebot and Applebot and stay allowed below.
//
// Allowed: everything else, which is search (Googlebot, Bingbot, YandexBot, DuckDuckBot, Applebot)
// and the link previews (TelegramBot, facebookexternalhit, Twitterbot) that make a shared link show
// its product. Bing's own crawler also feeds Copilot and cannot be split from Bing search, so it
// stays in - the price of being in Bing at all.
//
// robots.txt is a request, not a lock: the named companies honour it, a scraper that ignores it
// is not stopped by it.
const AI_BOTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',                    // OpenAI
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', // Anthropic
  'Google-Extended', 'GoogleOther', 'GoogleOther-Image', 'GoogleOther-Video', 'Google-CloudVertexBot',
  'Applebot-Extended',
  'PerplexityBot', 'Perplexity-User',
  'meta-externalagent', 'meta-externalfetcher', 'FacebookBot',
  'Amazonbot', 'Bytespider', 'CCBot', 'cohere-ai', 'cohere-training-data-crawler',
  'MistralAI-User', 'DuckAssistBot', 'YouBot', 'Diffbot', 'AI2Bot', 'Ai2Bot-Dolma',
  'PanguBot', 'Timpibot', 'ImagesiftBot', 'Omgilibot', 'omgili', 'Kangaroo Bot', 'Webzio-Extended',
];
fs.writeFileSync('robots.txt', AI_BOTS.map(b => `User-agent: ${b}`).join('\n') + `
Disallow: /

User-agent: *
Allow: /

Sitemap: ${SITE}sitemap.xml
`);
const today = new Date().toISOString().slice(0, 10);
const previousPages = fs.existsSync('data/page-manifest.json') ? JSON.parse(rd('data/page-manifest.json')) : {};
const generatedPages = {};
function writePage(file, html) {
  const key = file.replaceAll('\\', '/');
  const hash = crypto.createHash('sha256').update(html).digest('hex');
  generatedPages[key] = { hash, modified: previousPages[key]?.hash === hash ? previousPages[key].modified : today };
  fs.writeFileSync(file, html);
}
// One real page per product, and one per section. A #/p/... link says nothing to a crawler or to
// Telegram - the fragment never reaches a server - and these used to be a meta refresh into the
// app, which a search engine reads as "this url is the front page". Now each is a complete page:
// the name, where it sells and for how much, the key specs and a link into the app for filtering
// and comparing. No script runs here, so the policy stays script-free.
//
// These colours are literals because a standalone page cannot read the CSS variables in
// _shell.html. They mirror the tokens as of 2026-09-20: #F7F3EC --bg, #FFFFFF --surface,
// #161C28 --text, #4A5262 --body, #626974 --muted, #9E2B25 --brand, and for dark #12151D --bg,
// #1A1E29 --surface, #F2EEE7 --text, #B3BBC9 --body, #E4574F --brand. A palette change has to
// be made here too.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nameOf = p => p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.name : p.brand + ' ' + p.name;
const amd = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0\u058f';
const offersOf = p => ((PRICES.offers && PRICES.offers[p.id]) || []).slice().sort((a, b) => a.price - b.price);
const shopsOf = p => new Set(offersOf(p).map(o => o.shop)).size;
const shopName = k => (PRICES.shops && PRICES.shops[k] && PRICES.shops[k].name) || k;
const ldJson = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}<\/script>`;
// Every static page is written three times: Armenian at the root, Russian under ru/, English under
// en/ (owner, 2026-10-04 - people here search in Russian as much as in Armenian). Each names the
// other two with hreflang, so a search engine shows the reader's own language.
const LANGS = ['hy', 'ru', 'en'];
const PRE = { hy: '', ru: 'ru/', en: 'en/' };
// the section names the app shows, read from its own three tables (hy, ru, en, in that order)
const CATS = Object.fromEntries([...rd('_app.js').matchAll(/cats: \{([^}]*)\}/g)].slice(0, 3).map((m, i) =>
  [LANGS[i], Object.fromEntries([...m[1].matchAll(/(\w+): '([^']*)'/g)].map(x => [x[1], x[2]]))]));
const catOf = p => p.category === 'earbuds' ? 'headphones' : (p.category || 'phone');
const catLabel = (c, l = 'hy') => (CATS[l] || {})[c] || c;
const homeContent = lang => {
  const pre = PRE[lang], title = { hy: 'Սարքերի գների համեմատություն Հայաստանում', ru: 'Сравнение цен на электронику в Армении', en: 'Compare electronics prices in Armenia' }[lang];
  const method = { hy: 'Better.am-ը խանութ չէ։ Համեմատում ենք խանութների հրապարակած գները՝ նույն RAM-ի, հիշողության և այլ տարբերակների համար։ Գինը, առկայությունը, երաշխիքն ու վերադարձի պայմանները վերջնականապես ստուգեք խանութում։ Չճշտված բնութագրերը նշվում են որպես անորոշ։', ru: 'Better.am сравнивает опубликованные цены магазинов для одинаковых конфигураций RAM, накопителя и других параметров. Мы не продаём товары. Окончательную цену, наличие, гарантию и возврат уточняйте у магазина. Неподтверждённые характеристики отмечены.', en: 'Better.am compares shops’ published prices for matching RAM, storage and other configurations. We do not sell products. Confirm the final price, availability, warranty and returns with the shop. Unconfirmed specifications are marked.' }[lang];
  return `<div class="shell"><h1>${esc(title)}</h1><p>${esc(method)}</p><nav aria-label="Categories">${cats.map(c => `<a href="${pre}c/${c}/">${esc(catLabel(c, lang))}</a>`).join(' · ')}</nav><ul>${phones.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 50).map(p => `<li><a href="${pre}p/${p.id}/">${esc(nameOf(p))}</a></li>`).join('')}</ul><p><a href="${pre}b/">${esc(L[lang].blog)}</a></p></div>`;
};
// Armenian plural is the bare noun after any number, so one form is correct for all of them.
const ruShops = n => n % 10 === 1 && n % 100 !== 11 ? 'магазине' : 'магазинах';
const L = {
  hy: { locale: 'hy_AM', from: a => `${a}-ից`,
    desc: (a, n) => n ? `Գինը՝ ${a}-ից, ${n} խանութի գների համեմատություն Better.am-ում։` : 'Այս պահին հայկական խանութներում առկա չէ։',
    title: n => `${n}: գինը Հայաստանում | Better.am`,
    lead: (n, lo, k, hi, low) => `${n}-ի գինը Հայաստանում՝ ${lo}-ից, ${k} խանութում։${hi ? ` Ամենաթանկ առաջարկը՝ ${hi}։` : ''}${low ? ` Վերջին 30 օրվա ամենացածր գինը՝ ${low}։` : ''}`,
    go: 'Համեմատել Better.am-ում', prices: 'Գները խանութներում', th: ['Խանութ', 'Տարբերակ', 'Գին'], gb: 'ԳԲ', tb: 'ՏԲ',
    specs: 'Հիմնական բնութագրեր', sk: ['Էկրան', 'Պրոցեսոր', 'Մարտկոց', 'Քաշ', 'Թողարկում'], hz: 'Հց', mah: 'մԱժ', g: 'գ',
    checked: 'Գները ստուգվել են՝ ',
    ctitle: c => `${c}: գները Հայաստանի խանութներում | Better.am`,
    cdesc: (k, a) => `${k} մոդել, ${a}-ից։ Համեմատիր գները Հայաստանի խանութներում Better.am-ում։`,
    cgo: 'Զտել և համեմատել Better.am-ում', models: 'Մոդելներ և գներ',
    blog: 'Բլոգ', bdesc: 'Հոդվածներ գների, համեմատման և տեխնիկայի ընտրության մասին։', read: 'Կարդալ Better.am-ում', sources: 'Աղբյուրներ՝ ' },
  ru: { locale: 'ru_RU', from: a => `от ${a}`,
    desc: (a, n) => n ? `Цена от ${a}, сравнение цен в ${n} ${ruShops(n)} на Better.am.` : 'Сейчас нет в продаже в магазинах Армении.',
    title: n => `${n}: цена в Армении | Better.am`,
    lead: (n, lo, k, hi, low) => `Цена ${n} в Армении — от ${lo} в ${k} ${ruShops(k)}.${hi ? ` Самое дорогое предложение — ${hi}.` : ''}${low ? ` Самая низкая цена за 30 дней — ${low}.` : ''}`,
    go: 'Сравнить на Better.am', prices: 'Цены в магазинах', th: ['Магазин', 'Вариант', 'Цена'], gb: 'ГБ', tb: 'ТБ',
    specs: 'Основные характеристики', sk: ['Экран', 'Процессор', 'Аккумулятор', 'Вес', 'Выход'], hz: 'Гц', mah: 'мА·ч', g: 'г',
    checked: 'Цены проверены: ',
    ctitle: c => `${c}: цены в магазинах Армении | Better.am`,
    cdesc: (k, a) => `Моделей: ${k}, от ${a}. Сравните цены в магазинах Армении на Better.am.`,
    cgo: 'Фильтровать и сравнивать на Better.am', models: 'Модели и цены',
    blog: 'Блог', bdesc: 'Статьи о ценах, сравнении и выборе техники.', read: 'Читать на Better.am', sources: 'Источники: ' },
  en: { locale: 'en_US', from: a => `from ${a}`,
    desc: (a, n) => n ? `From ${a}, prices compared across ${n} shop${n === 1 ? '' : 's'} on Better.am.` : 'Not currently sold in Armenian shops.',
    title: n => `${n}: price in Armenia | Better.am`,
    lead: (n, lo, k, hi, low) => `${n} price in Armenia: from ${lo} at ${k} shop${k === 1 ? '' : 's'}.${hi ? ` The most expensive offer is ${hi}.` : ''}${low ? ` Lowest price in the last 30 days: ${low}.` : ''}`,
    go: 'Compare on Better.am', prices: 'Prices in shops', th: ['Shop', 'Version', 'Price'], gb: 'GB', tb: 'TB',
    specs: 'Key specs', sk: ['Display', 'Chip', 'Battery', 'Weight', 'Released'], hz: 'Hz', mah: 'mAh', g: 'g',
    checked: 'Prices checked: ',
    ctitle: c => `${c}: prices in Armenian shops | Better.am`,
    cdesc: (k, a) => `${k} models, from ${a}. Compare prices in Armenian shops on Better.am.`,
    cgo: 'Filter and compare on Better.am', models: 'Models and prices',
    blog: 'Blog', bdesc: 'Articles on prices, comparing and choosing tech.', read: 'Read on Better.am', sources: 'Sources: ' },
};
const DESC = (p, l = 'hy') => L[l].desc(amd(bestOf(p)), shopsOf(p));
const homeListLD = lang => ({ ...SEO.ld, itemListElement: SEO.ld.itemListElement.map(entry => {
  const p = phones.find(p => entry.item.url === SITE + 'p/' + p.id + '/');
  return { ...entry, item: { ...entry.item, ...(p ? { description: DESC(p, lang) } : {}) } };
}) });
// lowest price of the last 30 days, from the history the nightly crawl keeps
const low30 = p => {
  const pts = (HISTORY.points || {})[p.id] || [];
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const l = pts.filter(x => x.d >= since).map(x => x.lo).filter(Number.isFinite);
  return l.length > 1 ? Math.min(...l) : null;
};
// the day the price last moved - what a sitemap's lastmod is meant to say
const movedOn = p => {
  const pts = (HISTORY.points || {})[p.id] || [];
  for (let i = pts.length - 1; i > 0; i--) if (pts[i].lo !== pts[i - 1].lo || pts[i].hi !== pts[i - 1].hi) return pts[i].d;
  return pts.length ? pts[0].d : null;
};
// one row per shop and capacity, its cheapest - five colours of one phone at one price are one
// offer to a reader, and colour names would be English on an Armenian page
const rows = offs => { const seen = new Set(); return offs.filter(o => {
  const k = [o.shop, o.cpu, o.storage, o.ram, o.size, o.band, o.esim, o.cell].join('|');
  return !seen.has(k) && seen.add(k);
}); };
const configLabel = (p, o, t) => [o.cpu || '', o.ram != null ? o.ram + ' ' + t.gb + ' RAM' : '',
  o.storage && p.variantUnit !== 'mm' ? (o.storage >= 1024 ? o.storage / 1024 + ' ' + t.tb : o.storage + ' ' + t.gb) : '',
  o.size ? o.size + '″' : '', o.band || '', o.cell === true ? 'Wi-Fi + Cellular' : '',
  o.esim === true ? 'eSIM' : o.esim === false ? 'Nano-SIM' : ''].filter(Boolean).join(' · ') || '—';
const specRows = (p, l) => {
  const d = p.display || {}, c = p.chipset || {}, b = p.battery || {}, w = (p.body || {}).weight, t = L[l];
  return [
    [t.sk[0], [d.size && `${d.size}″`, d.resolution, d.refresh && `${d.refresh} ${t.hz}`].filter(Boolean).join(', ')],
    [t.sk[1], c.name],
    [t.sk[2], b.capacity && `${b.capacity} ${p.category === 'laptop' ? 'Wh' : t.mah}`],
    [t.sk[3], w && `${w} ${t.g}`],
    [t.sk[4], p.released],
  ].filter(([, v]) => v);
};
const STYLE = `<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#F7F3EC;color:#161C28}
main,header,nav.bc{max-width:860px;margin:0 auto;padding:0 16px}header{padding-top:18px}
header a{font-weight:800;font-size:20px;color:#9E2B25;text-decoration:none}
nav.bc{font-size:14px;color:#626974;margin-top:10px}nav.bc a{color:#4A5262}
h1{font-size:28px;line-height:1.2;margin:10px 0 6px}h2{font-size:19px;margin:28px 0 8px}
.lead{color:#4A5262;margin:0 0 14px}.shot{display:block;max-width:min(360px,100%);height:auto;margin:14px 0}
a.go{display:inline-block;background:#9E2B25;color:#fff;text-decoration:none;padding:11px 20px;border-radius:50px;font-weight:600}
table{width:100%;border-collapse:collapse;background:#FFFFFF;font-size:15px}th,td{padding:9px 10px;border-bottom:1px solid #E4DDD2;text-align:left}
td.n,th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.tw{overflow-x:auto}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin:0}dt{color:#626974}dd{margin:0}
ul.pl{list-style:none;padding:0;margin:0}ul.pl li{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #E4DDD2}
ul.pl a{color:#161C28}.upd{font-size:13px;color:#626974;margin:18px 0 40px}
@media (prefers-color-scheme:dark){body{background:#12151D;color:#F2EEE7}.lead,nav.bc a{color:#B3BBC9}header a{color:#E4574F}nav.bc,dt,.upd{color:#9AA3B2}
a.go{background:#E4574F;color:#12151D}table{background:#1A1E29}th,td,ul.pl li{border-color:#2A3040}ul.pl a{color:#F2EEE7}}</style>`;
// path: the page's place under the site root ('p/apple-iphone-17/'), the same in every language
const alts = path => LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${SITE}${PRE[l]}${path}">`).join('\n')
  + `\n<link rel="alternate" hreflang="x-default" href="${SITE}${path}">`;
const HEAD = ({ title, desc, url, img, ld, lang = 'hy', path }) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:${COUNTER.img.map(h => ' ' + h).join('')}; style-src 'unsafe-inline'${COUNTER.script.length ? "; script-src 'self' " + COUNTER.script.join(' ') : ''}${COUNTER.connect.length ? '; connect-src ' + COUNTER.connect.join(' ') : ''}; base-uri 'none'; form-action 'none'">
<link rel="icon" href="${FAVICON}">
<title>${esc(title)}</title>
${COUNTER.tag}
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${path != null ? alts(path) : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Better.am">
<meta property="og:locale" content="${L[lang].locale}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">
${ld.map(ldJson).join('\n')}
${STYLE}
</head><body>`;
const crumbs = list => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: list.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) });

let shared = 0;
const sitemapRows = [];
const cats = [...new Set(phones.map(catOf))];
for (const lang of LANGS) {
  // R: back up to the site root from a page two folders deep (three under ru/ and en/)
  const t = L[lang], pre = PRE[lang], home = SITE + pre, app = lang === 'hy' ? '' : `?lang=${lang}`;
  const R = pre ? '../../../' : '../../';
  for (const p of phones) {
    const card = `images/social/${p.id}.jpg`;
    const hero = productImage(p);
    const img = SITE + (fs.existsSync(card) ? card : hero || SEO.img);
    const path = `p/${p.id}/`, url = home + path, cat = catOf(p), catUrl = `${home}c/${cat}/`;
    const offs = offersOf(p), lo = offs.length ? offs[0].price : null, hi = offs.length ? offs[offs.length - 1].price : null;
    const low = low30(p), seen = offs.map(o => o.seen).filter(Boolean).sort().pop();
    // the same photo the app shows on the card and opens the page on: the first listed colour's own
    const n = nameOf(p), sr = specRows(p, lang);
    const ld = [
      { '@context': 'https://schema.org', '@type': 'Product', name: n, brand: { '@type': 'Brand', name: p.brand },
        category: cat, ...(hero ? { image: SITE + hero } : {}), description: DESC(p, lang), url, offers: offerOf(p) },
      crumbs([['Better.am', SITE + app], [catLabel(cat, lang), catUrl], [n, url]]),
    ];
    const page = HEAD({ title: t.title(n), desc: DESC(p, lang), url, img, ld, lang, path }) + `
<header><a href="${R}${app}">Better.am</a></header>
<nav class="bc" aria-label="Breadcrumb"><a href="${R}${app}">Better.am</a> › <a href="${R}${pre}c/${cat}/">${esc(catLabel(cat, lang))}</a> › <span>${esc(n)}</span></nav>
<main>
<h1>${esc(n)}</h1>
<p class="lead">${esc(lo != null ? t.lead(n, amd(lo), shopsOf(p), hi > lo ? amd(hi) : '', low != null && low < lo ? amd(low) : '') : DESC(p, lang))}</p>
<a class="go" href="${R}${app}#/p/${p.id}">${t.go}</a>
${hero ? `<img class="shot" src="${R}${hero}" alt="${esc(n)}" width="360" height="360">` : ''}
${offs.length ? `<h2>${t.prices}</h2>
<div class="tw"><table><thead><tr><th>${t.th[0]}</th><th>${t.th[1]}</th><th class="n">${t.th[2]}</th></tr></thead><tbody>
${rows(offs).map(o => `<tr><td>${/^https?:\/\//i.test(o.url || '') ? `<a href="${esc(o.url)}" rel="nofollow noopener">${esc(shopName(o.shop))}</a>` : esc(shopName(o.shop))}</td><td>${esc(configLabel(p, o, t))}</td><td class="n">${amd(o.price)}</td></tr>`).join('\n')}
</tbody></table></div>` : ''}
${sr.length ? `<h2>${t.specs}</h2>
<dl>${sr.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
${seen ? `<p class="upd">${t.checked}${seen.split('-').reverse().join('.')}</p>` : ''}
</main></body></html>
`;
    fs.mkdirSync(pre + path, { recursive: true });
    writePage(`${pre}${path}index.html`, page);
    sitemapRows.push([url, movedOn(p) || today, 0.7]);
    shared++;
  }
  // One page per section, and one per brand inside it ("Samsung phones") wherever a brand has three
  // priced products or more: every product with its cheapest price, linking to its own page.
  const listPage = ({ list, path, label, trail, appHash, brands = [] }) => {
    const R = '../'.repeat(path.split('/').length - 1 + (pre ? 1 : 0)), url = home + path;
    const desc = t.cdesc(list.length, amd(Math.min(...list.map(bestOf))));
    const page = HEAD({ title: t.ctitle(label), desc, url, img: SITE + SEO.img,
      ld: [crumbs([['Better.am', SITE + app], ...trail.map(([n, u]) => [n, home + u]), [label, url]])], lang, path }) + `
<header><a href="${R}${app}">Better.am</a></header>
<nav class="bc" aria-label="Breadcrumb"><a href="${R}${app}">Better.am</a> › ${trail.map(([n, u]) => `<a href="${R}${pre}${u}">${esc(n)}</a> › `).join('')}<span>${esc(label)}</span></nav>
<main>
<h1>${esc(label)}</h1>
<p class="lead">${esc(desc)}</p>
<a class="go" href="${R}${app}#/${appHash}">${t.cgo}</a>
${brands.length ? `<p class="lead">${brands.map(([n, u]) => `<a href="${R}${pre}${u}">${esc(n)}</a>`).join(' · ')}</p>` : ''}
<h2>${t.models}</h2>
<ul class="pl">${list.map(p => `<li><a href="${R}${pre}p/${p.id}/">${esc(nameOf(p))}</a><span>${t.from(amd(bestOf(p)))}</span></li>`).join('\n')}</ul>
<p class="upd">${today.split('-').reverse().join('.')}</p>
</main></body></html>
`;
    fs.mkdirSync(pre + path, { recursive: true });
    writePage(`${pre}${path}index.html`, page);
    sitemapRows.push([url, today, 0.8]);
  };
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const c of cats) {
    const list = phones.filter(p => catOf(p) === c && offersOf(p).length)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0) || bestOf(a) - bestOf(b));
    const label = catLabel(c, lang);
    const byBrand = Object.entries(Object.groupBy(list, p => p.brand)).filter(([, l]) => l.length >= 3)
      .sort((x, y) => y[1].length - x[1].length);
    for (const [brand, l] of byBrand)
      listPage({ list: l, path: `c/${c}/${slug(brand)}/`, label: `${brand} — ${label}`, trail: [[label, `c/${c}/`]], appHash: `c/${c}` });
    listPage({ list, path: `c/${c}/`, label, trail: [], appHash: `c/${c}`, brands: byBrand.map(([b]) => [b, `c/${c}/${slug(b)}/`]) });
  }
}
// The blog, as real pages a search engine can index (the app reads the same articles from BLOG).
// Armenian, like the rest of the static pages; the app offers all three languages.
// {{price:<id>}} and {{diff:<a>|<b>}} are today's prices, the same as the app shows (see LIVE there)
const livePrice = id => { const p = phones.find(q => q.id === id); return p && offersOf(p).length ? offersOf(p)[0].price : null; };
const LIVE = s => s.replace(/\{\{price:([\w-]+)\}\}/g, (m, id) => livePrice(id) != null ? amd(livePrice(id)) : '—')
  .replace(/\{\{diff:([\w-]+)\|([\w-]+)\}\}/g, (m, a, b) =>
    livePrice(a) != null && livePrice(b) != null ? amd(Math.abs(livePrice(b) - livePrice(a))) : '—');
// "## " starts a heading, "- " a list item (consecutive ones form one list), anything else a paragraph
const bodyHTML = list => {
  let html = '', inList = false;
  for (const s of list) {
    const li = s.startsWith('- ');
    if (li && !inList) html += '<ul>';
    if (!li && inList) html += '</ul>\n';
    inList = li;
    const fig = /^!fig:(images\/blog\/[\w.-]+)\|(.*)$/.exec(s);
    if (fig) { html += `<figure style="margin:20px 0"><img src="../../${fig[1]}" alt="${esc(fig[2])}" style="width:100%;height:auto;border-radius:12px"><figcaption style="font-size:13px;color:#626974;margin-top:6px">${esc(fig[2])}</figcaption></figure>\n`; continue; }
    html += s.startsWith('## ') ? `<h2>${esc(s.slice(3))}</h2>\n` : li ? `<li>${LIVE(esc(s.slice(2)))}</li>` : `<p>${LIVE(esc(s))}</p>\n`;
  }
  return html + (inList ? '</ul>\n' : '');
};
if (BLOG.length) for (const lang of LANGS) {
  const t = L[lang], pre = PRE[lang], home = SITE + pre, app = lang === 'hy' ? '' : `?lang=${lang}`;
  const R1 = pre ? '../../' : '../', R2 = '../' + R1;     // back to the root from b/ and from b/<id>/
  const bUrl = `${home}b/`;
  fs.mkdirSync(`${pre}b`, { recursive: true });
  writePage(`${pre}b/index.html`, HEAD({ title: `${t.blog} | Better.am`, desc: t.bdesc, url: bUrl, img: SITE + SEO.img,
    ld: [crumbs([['Better.am', SITE + app], [t.blog, bUrl]])], lang, path: 'b/' }) + `
<header><a href="${R1}${app}">Better.am</a></header>
<nav class="bc" aria-label="Breadcrumb"><a href="${R1}${app}">Better.am</a> › <span>${t.blog}</span></nav>
<main>
<h1>${t.blog}</h1>
<ul class="pl">${BLOG.map(a => `<li><a href="${a.id}/">${esc(a[lang].title)}</a><span>${a.date.split('-').reverse().join('.')}</span></li>`).join('\n')}</ul>
</main></body></html>
`);
  sitemapRows.push([bUrl, BLOG[0].date, 0.6]);
  // an article taken out of data/blog.json takes its page with it, or the old url stays live
  for (const d of fs.readdirSync(`${pre}b`, { withFileTypes: true }))
    // The checked output pruner below removes obsolete index pages after generation.
  for (const a of BLOG) {
    const A = a[lang], url = `${bUrl}${a.id}/`;
    const articleImage = a.cover && fs.existsSync(a.cover) ? a.cover : fs.existsSync(`images/blog/${a.id}.jpg`) ? `images/blog/${a.id}.jpg` : null;
    const ld = [{ '@context': 'https://schema.org', '@type': 'Article', headline: A.title, description: A.lead,
      datePublished: a.date, dateModified: a.modified || a.date, inLanguage: lang, url, mainEntityOfPage: url,
      ...(articleImage ? { image: SITE + articleImage } : {}),
      author: { '@type': 'Organization', name: 'Better.am', url: SITE },
      publisher: { '@type': 'Organization', name: 'Better.am', url: SITE } },
      crumbs([['Better.am', SITE + app], [t.blog, bUrl], [A.title, url]])];
    fs.mkdirSync(`${pre}b/${a.id}`, { recursive: true });
    const og = `images/blog/${a.id}.jpg`;
    // bodyHTML writes figure paths for a page two folders deep
    const body = bodyHTML(A.body).replaceAll('src="../../', `src="${R2}`);
    writePage(`${pre}b/${a.id}/index.html`, HEAD({ title: `${A.title} | Better.am`, desc: A.lead, url, img: SITE + (articleImage || SEO.img), ld, lang, path: `b/${a.id}/` }) + `
<header><a href="${R2}${app}">Better.am</a></header>
<nav class="bc" aria-label="Breadcrumb"><a href="${R2}${app}">Better.am</a> › <a href="../">${t.blog}</a> › <span>${esc(A.title)}</span></nav>
<main>
<h1>${esc(A.title)}</h1>
<p class="lead">${LIVE(esc(A.lead))}</p>
${a.cover && fs.existsSync(a.cover) ? `<img src="${R2}${a.cover}" alt="${esc(A.title)}" width="1600" height="900" style="width:100%;height:auto;border-radius:16px;margin:4px 0 18px">` : ''}
${body}
${(a.sources || []).length ? `<p class="upd">${t.sources}${a.sources.filter(s => /^https:\/\//.test(s.url)).map(s => `<a href="${esc(s.url)}" rel="nofollow noopener">${esc(s.name)}</a>`).join(' · ')}</p>` : ''}
<p><a class="go" href="${R2}${app}#/blog/${a.id}">${t.read}</a></p>
<p class="upd">${a.date.split('-').reverse().join('.')}</p>
</main></body></html>
`);
    sitemapRows.push([url, a.date, 0.6]);
  }
}
// A product folded into another keeps its url: the share page and any link to it that was
// already posted or indexed send the visitor, and a crawler, to the survivor instead of a 404.
let moved = 0;
for (const lang of LANGS) for (const [from, to] of Object.entries(MERGED)) {
  if (!phones.some(p => p.id === to) || phones.some(p => p.id === from)) continue;
  const pre = PRE[lang];
  fs.mkdirSync(`${pre}p/${from}`, { recursive: true });
  writePage(`${pre}p/${from}/index.html`, `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'">
<meta http-equiv="refresh" content="0;url=../${to}/">
<link rel="canonical" href="${SITE}${pre}p/${to}/">
<meta name="robots" content="noindex">
<title>Better.am</title>
</head><body><a href="../${to}/">${esc(nameOf(phones.find(p => p.id === to)))}</a></body></html>
`);
  moved++;
}
console.log(`${shared} product page(s) under p/, ${cats.length} section page(s) under c/` + (moved ? `, ${moved} redirect(s) for merged products` : ''));

// A mistyped product url, or one from a product that has since left the catalogue, gets
// GitHub's own 404 - a black page in English about a repository. This one is the catalogue's,
// in the catalogue's language, and it offers the way back.
fs.writeFileSync('404.html', `<!doctype html>
<html lang="hy"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Էջը չի գտնվել | Better.am</title>
<meta name="robots" content="noindex">
<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#F7F3EC;color:#161C28;
display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center}
h1{font-size:26px;margin:0 0 6px}p{margin:0 0 20px;color:#4A5262}
a{display:inline-block;background:#9E2B25;color:#fff;text-decoration:none;padding:12px 22px;border-radius:50px}
@media (prefers-color-scheme:dark){body{background:#12151D;color:#F2EEE7}p{color:#B3BBC9}a{background:#E4574F;color:#12151D}}</style>
</head><body><div>
<h1>Էջը չի գտնվել</h1>
<p>Հնարավոր է՝ այս ապրանքը այլևս կատալոգում չէ։</p>
<a href="${SITE}">Բացել կատալոգը</a>
</div></body></html>
`);

writePage('index.html', build({ inline: false, standalone: true }));
for (const lang of ['ru', 'en']) {
  const pre = PRE[lang], url = SITE + pre;
  const title = lang === 'ru' ? 'Сравнение цен на электронику в Армении | Better.am' : 'Compare electronics prices in Armenia | Better.am';
  fs.mkdirSync(pre, { recursive: true });
  // Real translated home pages make the root hreflang links crawlable. The interactive
  // catalogue remains at the root, where its scripts and images resolve correctly.
  writePage(pre + 'index.html', HEAD({ title, desc: lang === 'ru' ? 'Сравните реальные цены на телефоны, ноутбуки и другую электронику в магазинах Армении. Выбирайте конфигурацию и проверяйте предложения.' : 'Compare real prices for phones, laptops and other electronics at Armenian shops. Choose a configuration and check matching offers.', url, img: SITE + SEO.img,
    ld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Better.am', url: SITE, inLanguage: lang }], lang, path: '' })
    + `<header><a href="../?lang=${lang}">Better.am</a></header><main>${homeContent(lang).replaceAll('href="' + pre, 'href="../' + pre)}<p><a class="go" href="../?lang=${lang}">${L[lang].cgo}</a></p></main></body></html>`);
  sitemapRows.push([url, today, 1]);
}
// Only generated index files inside the known publication trees are removed. Keep
// unrelated files, and keep every translated merged-product redirect.
const prunePages = dir => {
  const root = path.resolve(dir), workspace = path.resolve('.');
  if (!root.startsWith(workspace + path.sep)) throw new Error('Unsafe publication directory: ' + root);
  if (!fs.existsSync(root)) return;
  const walk = folder => {
    for (const d of fs.readdirSync(folder, { withFileTypes: true })) if (d.isDirectory()) walk(path.join(folder, d.name));
    const index = path.join(folder, 'index.html'), key = path.relative(workspace, index).replaceAll('\\', '/');
    if (fs.existsSync(index) && !generatedPages[key]) fs.unlinkSync(index);
    if (folder !== root && fs.readdirSync(folder).length === 0) fs.rmdirSync(folder);
  };
  walk(root);
};
for (const pre of ['', 'ru/', 'en/']) for (const tree of ['p', 'c', 'b']) prunePages(pre + tree);
fs.writeFileSync('data/page-manifest.json', JSON.stringify(generatedPages, null, 1) + '\n');
const modifiedAt = url => generatedPages[(new URL(url).pathname.slice(1) || '') + 'index.html']?.modified || today;
fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 <url><loc>${SITE}</loc><lastmod>${modifiedAt(SITE)}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
${sitemapRows.map(([u, d, pr]) => ` <url><loc>${u}</loc><lastmod>${modifiedAt(u)}</lastmod><priority>${pr}</priority></url>`).join('\n')}
</urlset>
`);
// The two single-file builds inline every photograph as a data URI. That was ~18 MB each when
// this was written and is 211 MB each now, so a plain build wrote 422 MB nobody asked for -
// GitHub Pages serves index.html and nothing else, and both files are gitignored. They are
// still one command away for anyone who wants a self-contained copy to mail or to paste:
//
//   node build.mjs --all
const written = ['index.html'];
if (process.argv.includes('--all')) {
  fs.writeFileSync('index.embedded.html', build({ inline: true, standalone: true }));
  fs.writeFileSync('artifact.html', build({ inline: true, standalone: false }));
  written.push('index.embedded.html', 'artifact.html');
}
const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
for (const f of written) console.log(f.padEnd(22), kb(f));
if (written.length === 1) console.log('(single-file builds skipped - node build.mjs --all writes them)');
