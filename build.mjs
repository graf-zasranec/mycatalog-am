// Builds three outputs from _shell.html + _app.js + data/.
//   index.html           standalone page, loads images/ from disk  <- open this locally
//   index.embedded.html  standalone single file, images inlined    <- one file to email/host
//   artifact.html        head-less fragment, images inlined        <- for publishing as an Artifact
// Run: node build.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
const rd = f => fs.readFileSync(f, 'utf8');
const phones = JSON.parse(rd('data/phones.json'));
const STR = { hy: {}, ru: {}, en: {} };
for (const s of JSON.parse(rd('data/strings.json'))) { STR.hy[s.key] = s.hy; STR.ru[s.key] = s.ru; STR.en[s.key] = s.en; }
const VERD = {};
for (const { id, ...r } of JSON.parse(rd('data/verdicts.json'))) VERD[id] = r;
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
const PRICES = fs.existsSync('data/prices.json') ? JSON.parse(rd('data/prices.json')) : { shops: {}, offers: {} };
// The shop's own page title rides along in prices.json because the capacity re-derivation reads
// it, but nothing in the app renders it - and inlining it puts a shop's marketing copy
// ("... - Warranty - AllSell") into our page and adds weight for nothing.
for (const list of Object.values(PRICES.offers || {})) for (const o of list) { delete o.title; delete o.sku; delete o.image; }

// A configuration a shop actually sells is a real configuration. phones.json carries the spec
// sheet, which lags: the MacBook Pro 14 sells at 512 GB, the Pixel 11 Pro XL at 12/256, and
// neither was listed, so their cheapest offers could not be selected or even seen.
for (const p of phones) {
  if (p.variantUnit === 'mm') continue;                    // watch case sizes are not capacities
  const seen = new Set((p.variants || []).map(v => `${v.ram ?? ''}|${v.storage ?? ''}`));
  const base = (p.variants || [])[0] || {};
  const add = [];
  for (const o of (PRICES.offers && PRICES.offers[p.id]) || []) {
    if (!(o.storage >= 8 && o.storage <= 8192)) continue;  // a shop typo is not a configuration
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

// No English in the Armenian or the Russian view. A product with no summary in those languages
// falls back to summaryEn, which is an English sentence on a page that must not have one, so it
// is worth stopping the build over: node tools/verdicts.mjs --write writes the missing ones.
{
  const mute = phones.filter(p => !(VERD[p.id] && VERD[p.id].s_hy && VERD[p.id].s_ru));
  if (mute.length) {
    console.error(`build: ${mute.length} product(s) would show English in the hy/ru view - ` +
      `node tools/verdicts.mjs --write: ` + mute.slice(0, 6).map(p => p.id).join(', '));
    process.exit(1);
  }
}

// A price series for a product that left the catalogue is dead weight nothing can render.
for (const k of Object.keys(HISTORY.points || {}))
  if (!phones.some(p => p.id === k)) { console.warn('  ! history for a product not in the catalogue:', k); delete HISTORY.points[k]; }

// The page never renders an offer's title, photo or SKU - it renders the shop, price and link.
// Shipping the rest is a large share of the inlined price blob for nothing.
for (const list of Object.values(PRICES.offers || {}))
  for (const o of list) { delete o.title; delete o.image; delete o.sku; }

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
function cutMap(inline, small) {
  const m = {};
  for (const f of cutFiles) {
    const [id, rest] = f.replace(/\.webp$/, '').split('__');
    if (!id || !rest) continue;
    // 600px is the catalogue's floor for any photo. This used to be a fraction of the main
    // shot's width, which punished the good main shots: the Fold 8's 719px colours were thrown
    // out against its 1200px main while the Ultra's 937px ones squeaked past the same ratio.
    if (rest !== 'main' && cutW[f] < 600) continue;
    const thumb = `images/thumb/${f}`;
    (m[id] ||= {})[rest] = inline
      ? 'data:image/webp;base64,' + fs.readFileSync(`${CUT}/${f}`).toString('base64')
      : (small && fs.existsSync(thumb) ? thumb : `${CUT}/${f}`);
  }
  return m;
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
  title: `MyCatalog — ${phones.length} սարքի գներ Հայաստանի խանութներում`,
  desc: `Հեռախոսներ, նոութբուքեր, ականջակալներ և ժամացույցներ՝ ${phones.length} մոդել, `
      + `${Object.keys(PRICES.shops || {}).length} խանութի գներ դրամով, համեմատում և զտիչներ։`,
  ld: {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'MyCatalog',
    numberOfItems: phones.length,
    itemListElement: phones.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: (p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.name : p.brand + ' ' + p.name),
        brand: { '@type': 'Brand', name: p.brand },
        category: p.category || 'phone',
        url: SITE + '#/p/' + p.id,
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

const THEME_JS = `try{var _t=JSON.parse(localStorage.getItem('mycatalog.v2')||'{}').theme;if(_t&&_t!=='auto')document.documentElement.dataset.theme=_t}catch(e){}`;
const sha = js => "'sha256-" + crypto.createHash('sha256').update(js, 'utf8').digest('base64') + "'";

// GitHub Pages serves no custom headers, so the policy has to travel in the document. Both
// inline scripts are named by HASH rather than allowed wholesale with 'unsafe-inline': the page
// then cannot run a script this build did not produce, which is the point of having a CSP at all
// on a page that renders scraped shop names. Styles still need 'unsafe-inline' - the colour
// swatches carry a style attribute - and img-src keeps data: for the embedded build.
// frame-ancestors is NOT here: a meta element cannot deliver it and the browser logs an error
// on every load. Clickjacking cover would need a real header, which GitHub Pages does not serve.
const HEAD_OPEN = appJs => `<!doctype html>
<html lang="hy"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${sha(THEME_JS)} ${sha(appJs)}${COUNTER.script.map(h => ' ' + h).join('')}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:${COUNTER.img.map(h => ' ' + h).join('')}; connect-src ${COUNTER.connect.length ? COUNTER.connect.join(' ') : "'none'"}; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2312151D'/%3E%3Ccircle cx='16' cy='16' r='7' fill='%23E4574F'/%3E%3C/svg%3E">
<meta name="description" content="${SEO.desc}">
<link rel="canonical" href="${SEO.url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MyCatalog">
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
  return shell.replace('<title>MyCatalog</title>', `<title>${SEO.title}</title>`);
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
  let appJs = '\n'
    + `const DATA=${JSON.stringify(phones)};\nconst STR=${JSON.stringify(STR)};\nconst VERD=${JSON.stringify(VERD)};\n`
    + `const PRICES=${JSON.stringify(PRICES)};\n`
    + `const HISTORY=${JSON.stringify(HISTORY)};\n`
    + `const TERMS=${JSON.stringify(TERMS)};\n`
    + `const COMING=${JSON.stringify(COMING)};\n`
    + `const PAGEONLY=${JSON.stringify(PAGEONLY)};\n`
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

fs.writeFileSync('robots.txt', `User-agent: *
Allow: /
Sitemap: ${SITE}sitemap.xml
`);
// One shareable page per product. Paste a #/p/... link into Telegram and nothing comes back:
// the fragment is never sent to the server, so no scraper can know which product it names. These
// are real urls with the product's own title, price and picture in the head, and a refresh that
// carries a person straight into the catalogue. The body is what a crawler and a reader with no
// JavaScript get, so it is not an empty doorway.
//
// It also gives the site 198 indexable urls where the sitemap could only ever list one.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nameOf = p => p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.name : p.brand + ' ' + p.name;
const amd = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0\u058f';
const shopsOf = p => new Set(((PRICES.offers && PRICES.offers[p.id]) || []).map(o => o.shop)).size;
// Armenian plural is the bare noun after any number, so one form is correct for all of them.
const DESC = p => {
  const n = shopsOf(p);
  return n
    ? `\u0533\u056b\u0576\u0568\u055d ${amd(bestOf(p))}-\u056b\u0581\u055d ${n} \u056d\u0561\u0576\u0578\u0582\u0569\u056b \u0563\u0576\u0565\u0580\u056b \u0570\u0561\u0574\u0565\u0574\u0561\u057f\u0578\u0582\u0569\u0575\u0578\u0582\u0576 MyCatalog-\u0578\u0582\u0574\u0589`
    : `\u0531\u0575\u057d \u057a\u0561\u0570\u056b\u0576 \u0570\u0561\u0575\u056f\u0561\u056f\u0561\u0576 \u056d\u0561\u0576\u0578\u0582\u0569\u0576\u0565\u0580\u0578\u0582\u0574 \u0561\u057c\u056f\u0561 \u0579\u0567\u0589`;
};

let shared = 0;
for (const p of phones) {
  const card = `images/social/${p.id}.jpg`;
  const img = SITE + (fs.existsSync(card) ? card : SEO.img);
  const url = `${SITE}p/${p.id}/`;
  const title = `${nameOf(p)} \u2014 \u0563\u056b\u0576\u0568 \u0540\u0561\u0575\u0561\u057d\u057f\u0561\u0576\u0578\u0582\u0574 | MyCatalog`;
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: nameOf(p),
    brand: { '@type': 'Brand', name: p.brand }, category: p.category || 'phone',
    image: img, url, offers: offerOf(p) };
  const page = `<!doctype html>
<html lang="hy"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta http-equiv="refresh" content="0;url=../../#/p/${p.id}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(DESC(p))}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MyCatalog">
<meta property="og:locale" content="hy_AM">
<meta property="og:title" content="${esc(nameOf(p))}">
<meta property="og:description" content="${esc(DESC(p))}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(nameOf(p))}">
<meta name="twitter:description" content="${esc(DESC(p))}">
<meta name="twitter:image" content="${img}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, String.fromCharCode(92) + "u003c")}<\/script>
<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;background:#F7F3EC;color:#161C28;
display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center}
img{max-width:min(420px,100%);height:auto}h1{font-size:22px;margin:16px 0 4px}
p{margin:0 0 16px;color:#4A5262}a{color:#9E2B25}</style>
</head><body><div>
<img src="../../images/social/${p.id}.jpg" alt="${esc(nameOf(p))}" width="1200" height="630">
<h1>${esc(nameOf(p))}</h1>
<p>${esc(DESC(p))}</p>
<a href="../../#/p/${p.id}">\u0532\u0561\u0581\u0565\u056c \u056f\u0561\u057f\u0561\u056c\u0578\u0563\u0578\u0582\u0574</a>
</div></body></html>
`;
  fs.mkdirSync(`p/${p.id}`, { recursive: true });
  fs.writeFileSync(`p/${p.id}/index.html`, page);
  shared++;
}
console.log(`${shared} share page(s) under p/`);

// A mistyped product url, or one from a product that has since left the catalogue, gets
// GitHub's own 404 - a black page in English about a repository. This one is the catalogue's,
// in the catalogue's language, and it offers the way back.
fs.writeFileSync('404.html', `<!doctype html>
<html lang="hy"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Էջը չի գտնվել | MyCatalog</title>
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

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 <url><loc>${SITE}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
${phones.map(p => ` <url><loc>${SITE}p/${p.id}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync('index.html', build({ inline: false, standalone: true }));
fs.writeFileSync('index.embedded.html', build({ inline: true, standalone: true }));
fs.writeFileSync('artifact.html', build({ inline: true, standalone: false }));
const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
for (const f of ['index.html', 'index.embedded.html', 'artifact.html']) console.log(f.padEnd(22), kb(f));
