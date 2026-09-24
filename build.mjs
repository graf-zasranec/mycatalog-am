// Builds three outputs from _shell.html + _app.js + data/.
//   index.html           standalone page, loads images/ from disk  <- open this locally
//   index.embedded.html  standalone single file, images inlined    <- one file to email/host
//   artifact.html        head-less fragment, images inlined        <- for publishing as an Artifact
// Run: node build.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pairs } from './tools/pairs.mjs';
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
// The shop's own page title rides along in prices.json because the capacity re-derivation reads
// it, but nothing in the app renders it - and inlining it puts a shop's marketing copy
// ("... - Warranty - AllSell") into our page and adds weight for nothing.
// ...and the id, which every offer repeated although the offers are already stored UNDER that
// id. 4,949 copies of a key the reader is holding anyway: 135 KB of the page, for nothing. The
// one place that read it had the product in scope all along.
// inStock, seeded and simFromPage are the crawler's bookkeeping, and an empty field reads the same
// as a missing one everywhere the app looks: ~100 KB of the page for nothing.
for (const list of Object.values(PRICES.offers || {})) for (const o of list) {
  delete o.title; delete o.sku; delete o.image; delete o.id; delete o.inStock; delete o.seeded; delete o.simFromPage;
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
  const base = (p.variants || [])[0] || {};
  const add = [];
  for (const o of (PRICES.offers && PRICES.offers[p.id]) || []) {
    // A shop typo is not a configuration, and neither is one number sitting in two fields: viva
    // published the whole Galaxy S26 range with the RAM copied into the capacity column, and this
    // minted "12 GB" and "16 GB" buttons in the STORAGE row of an S26 Ultra. Nothing in this
    // catalogue stores less than the 32 GB of a Galaxy Tab A8, so below that it is a memory size
    // that has wandered, not a disk.
    if (!(o.storage >= 32 && o.storage <= 8192)) continue;
    if (o.ram != null && o.storage === o.ram) continue;
    const ram = o.ram ?? base.ram ?? null;
    const k = `${ram ?? ''}|${o.storage}`;
    if (seen.has(k)) continue;
    seen.add(k);
    add.push({ ram, storage: o.storage, priceAmd: o.price });
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
//     https://graf-zasranec.github.io/mycatalog-am/data/photos-needed.json
//
// Two different jobs, and they are not interchangeable. MISSING is a grey box on the page.
// TOO SMALL needs a LARGER ORIGINAL and never an enlargement - a 545px picture stretched to 600
// is the same picture with softer edges, which is the trade this floor exists to refuse.
{
  const FLOOR = 600;
  const need = [];
  for (const p of phones) {
    const f = `${CUT}/${p.id}__main.webp`;
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
// The same floor tools/cutout.py mattes to, and for the same reason: 600px, or 500px for a
// product nobody is looking at, where the comparison is not 500 against 600 but 500 against a
// swatch that changes nothing when it is clicked. Keeping this in step matters - cutout.py now
// mattes those colours, and a floor of its own here would build cutouts the page cannot show.
// TEMPORARY alongside its twin; see the note in tools/cutout.py.
const POP = Object.fromEntries(phones.map(p => [p.id, p.popularity ?? 100]));
const colourFloor = id => ((POP[id] ?? 100) < 50 ? 500 : 600);

const DUPES = fs.existsSync('data/photo-dupes.json') ? JSON.parse(rd('data/photo-dupes.json')) : {};
function cutMap(inline, small) {
  const m = {};
  for (const f of cutFiles) {
    const [id, rest] = f.replace(/\.webp$/, '').split('__');
    if (!id || !rest) continue;
    // 600px is the catalogue's floor for any photo. This used to be a fraction of the main
    // shot's width, which punished the good main shots: the Fold 8's 719px colours were thrown
    // out against its 1200px main while the Ultra's 937px ones squeaked past the same ratio.
    if (rest !== 'main' && cutW[f] < colourFloor(id)) continue;
    // colours whose photo is another colour's photo (tools/photo-dupes.py): a dot for them would
    // show the wrong colour, so they have no colour photo until a real one is supplied
    if (rest !== 'main' && (DUPES[id] || []).includes(rest)) continue;
    const thumb = `images/thumb/${f}`;
    (m[id] ||= {})[rest] = inline
      ? 'data:image/webp;base64,' + fs.readFileSync(`${CUT}/${f}`).toString('base64')
      : (small && fs.existsSync(thumb) ? thumb : `${CUT}/${f}`);
  }
  return m;
}

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
const SITE = 'https://graf-zasranec.github.io/mycatalog-am/';
const pricesOf = p => ((PRICES.offers && PRICES.offers[p.id]) || [])
  .map(o => o.price).filter(Number.isFinite);
const bestOf = p => { const l = pricesOf(p); return l.length ? Math.min(...l) : p.priceAmd; };
// A single Offer says "this costs X" and throws away the two facts this site exists to publish:
// how many shops sell it and what the spread is. AggregateOffer carries both, and it is what
// earns a price range in a search result rather than one bare number.
const offerOf = p => {
  const l = pricesOf(p);
  if (l.length < 2) {
    return { '@type': 'Offer', priceCurrency: 'AMD', price: bestOf(p), availability: 'https://schema.org/InStock' };
  }
  return {
    '@type': 'AggregateOffer', priceCurrency: 'AMD',
    lowPrice: Math.min(...l), highPrice: Math.max(...l),
    offerCount: new Set(((PRICES.offers && PRICES.offers[p.id]) || []).map(o => o.shop)).size,
    availability: 'https://schema.org/InStock'
  };
};
const SEO = {
  url: SITE,
  img: 'images/cut/' + (phones.find(p => fs.existsSync(`${CUT}/${p.id}__main.webp`)) || phones[0]).id + '__main.webp',
  title: `Better — ${phones.length} սարքի գներ Հայաստանի խանութներում`,
  desc: `Հեռախոսներ, նոութբուքեր, ականջակալներ և ժամացույցներ՝ ${phones.length} մոդել, `
      + `${Object.keys(PRICES.shops || {}).length} խանութի գներ դրամով, համեմատում և զտիչներ։`,
  ld: {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Better',
    // the 50 most popular: every product now has its own page, which is where a crawler finds it
    numberOfItems: Math.min(50, phones.length),
    itemListElement: phones.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 50).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: (p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.name : p.brand + ' ' + p.name),
        brand: { '@type': 'Brand', name: p.brand },
        category: p.category || 'phone',
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
      tag: `<script data-goatcounter="https://${AN.id}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"><\/script>`,
      script: ['https://gc.zgo.at'], connect: [`https://${AN.id}.goatcounter.com`], img: [`https://${AN.id}.goatcounter.com`] }
  : (() => { throw new Error('data/analytics.json: unknown provider ' + AN.provider); })();
if (AN) console.log(`visitor counter: ${AN.provider}`);

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
const HEAD_OPEN = appJs => `<!doctype html>
<html lang="hy"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${sha(THEME_JS)} ${sha(appJs)}${COUNTER.script.map(h => ' ' + h).join('')}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:${COUNTER.img.map(h => ' ' + h).join('')}; connect-src ${["'self'", ...COUNTER.connect].join(' ')}; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2312151D'/%3E%3Ccircle cx='16' cy='16' r='7' fill='%23E4574F'/%3E%3C/svg%3E">
<meta name="description" content="${SEO.desc}">
<link rel="canonical" href="${SEO.url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Better">
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
<script type="application/ld+json">${JSON.stringify(SEO.ld).replace(/</g, String.fromCharCode(92) + "u003c")}<\/script>
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
  return shell.replace('<title>Better</title>', `<title>${SEO.title}</title>`);
}

function splitShell(shell) {
  const i = shell.lastIndexOf('</style>');
  return i < 0 ? { head: '', body: shell } : { head: shell.slice(0, i + 8), body: shell.slice(i + 8) };
}

function build({ inline, standalone }) {
  const colors = cutMap(inline);
  // the same colour shots at 600 px, for the card that cycles through them in a 123 px box
  const colorThumbs = inline ? {} : cutMap(false, true);
  // main shot: the transparent cutout when we have one, else the original photo
  // Two sizes of the same photograph. A card draws it into a box 123 px wide on a phone and was
  // being handed the 1200 px cutout the product page uses - 829 KB of images for thirteen
  // thumbnails. images/thumb holds a 600 px copy, which still clears a retina desktop card, and
  // the full-size file is left to the two places that fill the screen with it.
  const THUMB = 'images/thumb';
  const src = (id, small) => {
    const t = `${THUMB}/${id}__main.webp`;
    return small && fs.existsSync(t) ? t : `${CUT}/${id}__main.webp`;
  };
  const at = f => inline ? 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64') : f;
  const main = {}, thumb = {};
  for (const p of [...phones, ...(COMING.items || [])]) {
    const cut = `${CUT}/${p.id}__main.webp`;
    if (!fs.existsSync(cut)) { console.warn('  ! missing image for', p.id); continue; }
    main[p.id] = at(cut);
    // The embedded build carries every photo as a data URI. Inlining a second copy of all 198
    // would add 7 MB to a file nobody downloads over a network, so there it keeps one size and
    // THUMB() falls through to IMG().
    if (!inline) thumb[p.id] = src(p.id, true);
  }
  const imgdata = `const IMGDATA=${JSON.stringify(main)};\nconst THUMBDATA=${JSON.stringify(thumb)};\n`
    + `const COLORIMG=${JSON.stringify(colors)};\nconst COLORTHUMB=${JSON.stringify(colorThumbs)};\n`;
  const shell = seoTitle(rd('_shell.html'));
  // the script BODY is hashed for the CSP, so it is built once and wrapped separately
  // The verdict sentences and the price history are read on a PRODUCT page and nowhere else,
  // and together they are 531 KB of the 3.26 MB this file makes a browser parse before it can
  // paint one card. The served build leaves them out and fetches data/verdicts.json and
  // data/history.json the first time somebody opens a product - both are already published,
  // because the repo root is the Pages publish root. The single-file builds keep carrying them:
  // a file somebody mails or pastes has nothing to fetch from.
  const lazy = !inline;
  let appJs = '\n'
    + `const DATA=${JSON.stringify(phones.map(({ summaryEn, sources, ...p }) => p))};\nconst STR=${JSON.stringify(STR)};\n`
    + (lazy ? 'let HISTORY={points:{}};\nconst LAZYDATA=true;\n'
            : `const HISTORY=${JSON.stringify(HISTORY)};\nconst LAZYDATA=false;\n`)
    // Wrapping this in JSON.parse was tried and measured: 268 ms to interactive against 294 ms
    // for the literal, three loads each, same machine - 9% - and it cost 77 KB of backslashes.
    // Not worth carrying the escaping for that, so the literal stays.
    + `const PRICES=${JSON.stringify(PRICES)};\n`
    + `const TERMS=${JSON.stringify(TERMS)};\n`
    + `const COMING=${JSON.stringify(COMING)};\n`
    + `const PAGEONLY=${JSON.stringify(PAGEONLY)};\n`
    + `const MERGED=${JSON.stringify(MERGED)};\n`
    + `const BLOG=${JSON.stringify(BLOG)};\n`
    + `const DROPS=${JSON.stringify(DROPS)};\n`
    + `const COMPARE_WITH=${JSON.stringify(pairs(phones, PRICES.offers || {}))};\n`
    + imgdata + rd('_app.js') + '\n';
  // The CSP pins a sha256 of this script and the HTML parser normalises CRLF to LF before it
  // hashes. A Windows checkout with core.autocrlf=true hands us CRLF, so the hash written here
  // and the hash the browser computes disagree, the browser refuses to run the app at all, and
  // the page comes up blank on the machine that built it. Emit what the parser will see.
  appJs = appJs.replace(/\r\n/g, '\n');
  const script = '\n<script>' + appJs + '<\/script>\n';
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
// the section names the app shows, read from its own Armenian table rather than copied here
const CATS = (() => {
  const m = rd('_app.js').match(/cats: \{([^}]*)\}/);
  const o = {};
  for (const [, k, v] of (m ? m[1] : '').matchAll(/(\w+): '([^']*)'/g)) o[k] = v;
  return o;
})();
const catOf = p => p.category === 'earbuds' ? 'headphones' : (p.category || 'phone');
const catLabel = c => CATS[c] || c;
// Armenian plural is the bare noun after any number, so one form is correct for all of them.
const DESC = p => {
  const n = shopsOf(p);
  return n ? `Գինը՝ ${amd(bestOf(p))}-ից, ${n} խանութի գների համեմատություն Better-ում։`
    : 'Այս պահին հայկական խանութներում առկա չէ։';
};
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
const rows = offs => { const seen = new Set(); return offs.filter(o => { const k = o.shop + '|' + (o.storage || ''); return !seen.has(k) && seen.add(k); }); };
const specRows = p => {
  const d = p.display || {}, c = p.chipset || {}, b = p.battery || {}, w = (p.body || {}).weight;
  return [
    ['Էկրան', [d.size && `${d.size}″`, d.resolution, d.refresh && `${d.refresh} Հց`].filter(Boolean).join(', ')],
    ['Պրոցեսոր', c.name],
    ['Մարտկոց', b.capacity && `${b.capacity} մԱժ`],
    ['Քաշ', w && `${w} գ`],
    ['Թողարկում', p.released],
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
@media (prefers-color-scheme:dark){body{background:#12151D;color:#F2EEE7}.lead,nav.bc a{color:#B3BBC9}header a{color:#E4574F}
a.go{background:#E4574F;color:#12151D}table{background:#1A1E29}th,td,ul.pl li{border-color:#2A3040}ul.pl a{color:#F2EEE7}}</style>`;
const HEAD = ({ title, desc, url, img, ld }) => `<!doctype html>
<html lang="hy"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2312151D'/%3E%3Ccircle cx='16' cy='16' r='7' fill='%23E4574F'/%3E%3C/svg%3E">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Better">
<meta property="og:locale" content="hy_AM">
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
for (const p of phones) {
  const card = `images/social/${p.id}.jpg`;
  const img = SITE + (fs.existsSync(card) ? card : SEO.img);
  const url = `${SITE}p/${p.id}/`, cat = catOf(p), catUrl = `${SITE}c/${cat}/`;
  const offs = offersOf(p), lo = offs.length ? offs[0].price : null, hi = offs.length ? offs[offs.length - 1].price : null;
  const low = low30(p), seen = offs.map(o => o.seen).filter(Boolean).sort().pop();
  const shot = fs.existsSync(`${CUT}/${p.id}__main.webp`) ? `../../${CUT}/${p.id}__main.webp` : null;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Product', name: nameOf(p), brand: { '@type': 'Brand', name: p.brand },
      category: cat, image: img, url, offers: offerOf(p) },
    crumbs([['Better', SITE], [catLabel(cat), catUrl], [nameOf(p), url]]),
  ];
  const page = HEAD({ title: `${nameOf(p)} — գինը Հայաստանում | Better`, desc: DESC(p), url, img, ld }) + `
<header><a href="../../">Better</a></header>
<nav class="bc" aria-label="Breadcrumb"><a href="../../">Better</a> › <a href="../../c/${cat}/">${esc(catLabel(cat))}</a> › <span>${esc(nameOf(p))}</span></nav>
<main>
<h1>${esc(nameOf(p))}</h1>
<p class="lead">${lo != null ? `${esc(nameOf(p))}-ի գինը Հայաստանում՝ ${amd(lo)}-ից, ${shopsOf(p)} խանութում։${hi > lo ? ` Ամենաթանկ առաջարկը՝ ${amd(hi)}։` : ''}${low != null && low < lo ? ` Վերջին 30 օրվա ամենացածր գինը՝ ${amd(low)}։` : ''}` : esc(DESC(p))}</p>
<a class="go" href="../../#/p/${p.id}">Համեմատել Better-ում</a>
${shot ? `<img class="shot" src="${shot}" alt="${esc(nameOf(p))}" width="360" height="360">` : ''}
${offs.length ? `<h2>Գները խանութներում</h2>
<div class="tw"><table><thead><tr><th>Խանութ</th><th>Տարբերակ</th><th class="n">Գին</th></tr></thead><tbody>
${rows(offs).map(o => `<tr><td><a href="${esc(o.url)}" rel="nofollow noopener">${esc(shopName(o.shop))}</a></td><td>${o.storage ? (o.storage >= 1024 ? o.storage / 1024 + ' ՏԲ' : o.storage + ' ԳԲ') : '—'}</td><td class="n">${amd(o.price)}</td></tr>`).join('\n')}
</tbody></table></div>` : ''}
${specRows(p).length ? `<h2>Հիմնական բնութագրեր</h2>
<dl>${specRows(p).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
${seen ? `<p class="upd">Գները ստուգվել են՝ ${seen.split('-').reverse().join('.')}</p>` : ''}
</main></body></html>
`;
  fs.mkdirSync(`p/${p.id}`, { recursive: true });
  fs.writeFileSync(`p/${p.id}/index.html`, page);
  sitemapRows.push([url, movedOn(p) || today, 0.7]);
  shared++;
}
// one page per section: every product in it with its cheapest price, linking to its own page
const cats = [...new Set(phones.map(catOf))];
for (const c of cats) {
  const list = phones.filter(p => catOf(p) === c && offersOf(p).length)
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0) || bestOf(a) - bestOf(b));
  const url = `${SITE}c/${c}/`;
  const title = `${catLabel(c)} — գները Հայաստանի խանութներում | Better`;
  const desc = `${list.length} մոդել, ${amd(Math.min(...list.map(bestOf)))}-ից։ Համեմատիր գները Հայաստանի խանութներում Better-ում։`;
  const page = HEAD({ title, desc, url, img: SITE + SEO.img, ld: [crumbs([['Better', SITE], [catLabel(c), url]])] }) + `
<header><a href="../../">Better</a></header>
<nav class="bc" aria-label="Breadcrumb"><a href="../../">Better</a> › <span>${esc(catLabel(c))}</span></nav>
<main>
<h1>${esc(catLabel(c))}</h1>
<p class="lead">${esc(desc)}</p>
<a class="go" href="../../#/c/${c}">Զտել և համեմատել Better-ում</a>
<h2>Մոդելներ և գներ</h2>
<ul class="pl">${list.map(p => `<li><a href="../../p/${p.id}/">${esc(nameOf(p))}</a><span>${amd(bestOf(p))}-ից</span></li>`).join('\n')}</ul>
<p class="upd">${today.split('-').reverse().join('.')}</p>
</main></body></html>
`;
  fs.mkdirSync(`c/${c}`, { recursive: true });
  fs.writeFileSync(`c/${c}/index.html`, page);
  sitemapRows.push([url, today, 0.8]);
}
// The blog, as real pages a search engine can index (the app reads the same articles from BLOG).
// Armenian, like the rest of the static pages; the app offers all three languages.
// "## " starts a heading, "- " a list item (consecutive ones form one list), anything else a paragraph
const bodyHTML = list => {
  let html = '', inList = false;
  for (const s of list) {
    const li = s.startsWith('- ');
    if (li && !inList) html += '<ul>';
    if (!li && inList) html += '</ul>\n';
    inList = li;
    html += s.startsWith('## ') ? `<h2>${esc(s.slice(3))}</h2>\n` : li ? `<li>${esc(s.slice(2))}</li>` : `<p>${esc(s)}</p>\n`;
  }
  return html + (inList ? '</ul>\n' : '');
};
if (BLOG.length) {
  const bUrl = `${SITE}b/`;
  fs.mkdirSync('b', { recursive: true });
  fs.writeFileSync('b/index.html', HEAD({ title: 'Բլոգ | Better', desc: 'Հոդվածներ գների, համեմատման և տեխնիկայի ընտրության մասին։', url: bUrl, img: SITE + SEO.img,
    ld: [crumbs([['Better', SITE], ['Բլոգ', bUrl]])] }) + `
<header><a href="../">Better</a></header>
<nav class="bc" aria-label="Breadcrumb"><a href="../">Better</a> › <span>Բլոգ</span></nav>
<main>
<h1>Բլոգ</h1>
<ul class="pl">${BLOG.map(a => `<li><a href="${a.id}/">${esc(a.hy.title)}</a><span>${a.date.split('-').reverse().join('.')}</span></li>`).join('\n')}</ul>
</main></body></html>
`);
  sitemapRows.push([bUrl, BLOG[0].date, 0.6]);
  for (const a of BLOG) {
    const url = `${bUrl}${a.id}/`;
    const ld = [{ '@context': 'https://schema.org', '@type': 'Article', headline: a.hy.title, description: a.hy.lead,
      datePublished: a.date, inLanguage: 'hy', url, publisher: { '@type': 'Organization', name: 'Better' } },
      crumbs([['Better', SITE], ['Բլոգ', bUrl], [a.hy.title, url]])];
    fs.mkdirSync(`b/${a.id}`, { recursive: true });
    fs.writeFileSync(`b/${a.id}/index.html`, HEAD({ title: `${a.hy.title} | Better`, desc: a.hy.lead, url, img: SITE + SEO.img, ld }) + `
<header><a href="../../">Better</a></header>
<nav class="bc" aria-label="Breadcrumb"><a href="../../">Better</a> › <a href="../">Բլոգ</a> › <span>${esc(a.hy.title)}</span></nav>
<main>
<h1>${esc(a.hy.title)}</h1>
<p class="lead">${esc(a.hy.lead)}</p>
${bodyHTML(a.hy.body)}
<p><a class="go" href="../../#/blog/${a.id}">Կարդալ Better-ում</a></p>
<p class="upd">${a.date.split('-').reverse().join('.')}</p>
</main></body></html>
`);
    sitemapRows.push([url, a.date, 0.6]);
  }
}
// A product folded into another keeps its url: the share page and any link to it that was
// already posted or indexed send the visitor, and a crawler, to the survivor instead of a 404.
let moved = 0;
for (const [from, to] of Object.entries(MERGED)) {
  if (!phones.some(p => p.id === to) || phones.some(p => p.id === from)) continue;
  fs.mkdirSync(`p/${from}`, { recursive: true });
  fs.writeFileSync(`p/${from}/index.html`, `<!doctype html>
<html lang="hy"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'">
<meta http-equiv="refresh" content="0;url=../${to}/">
<link rel="canonical" href="${SITE}p/${to}/">
<meta name="robots" content="noindex">
<title>Better</title>
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
<title>Էջը չի գտնվել | Better</title>
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

fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 <url><loc>${SITE}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
${sitemapRows.map(([u, d, pr]) => ` <url><loc>${u}</loc><lastmod>${d}</lastmod><priority>${pr}</priority></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync('index.html', build({ inline: false, standalone: true }));
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
