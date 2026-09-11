// Builds three outputs from _shell.html + _app.js + data/.
//   index.html           standalone page, loads images/ from disk  <- open this locally
//   index.embedded.html  standalone single file, images inlined    <- one file to email/host
//   artifact.html        head-less fragment, images inlined        <- for publishing as an Artifact
// Run: node build.mjs
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
const PRICES = fs.existsSync('data/prices.json') ? JSON.parse(rd('data/prices.json')) : { shops: {}, offers: {} };

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

function cutMap(inline) {
  const m = {};
  for (const f of cutFiles) {
    const [id, rest] = f.replace(/\.webp$/, '').split('__');
    if (!id || !rest) continue;
    const mainW = cutW[`${id}__main.webp`] || 0;
    if (rest !== 'main' && mainW && cutW[f] < mainW * 0.75) continue;
    (m[id] ||= {})[rest] = inline
      ? 'data:image/webp;base64,' + fs.readFileSync(`${CUT}/${f}`).toString('base64')
      : `${CUT}/${f}`;
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

// SEO. The router lives in the hash, so a crawler only ever sees ONE url - there is no point
// emitting a sitemap of #/p/... fragments, because fragments are not indexed as separate pages.
// What does carry weight on a single page: a real title and description, the social card, a
// canonical, and an ItemList that names the products and their cheapest Armenian price.
const SITE = 'https://graf-zasranec.github.io/mycatalog-am/';
const bestOf = p => {
  const offs = (PRICES.offers && PRICES.offers[p.id]) || [];
  const live = offs.map(o => o.price).filter(Number.isFinite);
  return live.length ? Math.min(...live) : p.priceAmd;
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
        offers: { '@type': 'Offer', priceCurrency: 'AMD', price: bestOf(p), availability: 'https://schema.org/InStock' }
      }
    }))
  }
};

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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${sha(THEME_JS)} ${sha(appJs)}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
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
<script type="application/ld+json">${JSON.stringify(SEO.ld)}<\/script>
<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
<script>${THEME_JS}<\/script>
`;
const HEAD_CLOSE = `</head><body>
`;

// The artifact platform supplies its own <head>, so the fragment build stays as-is. The
// standalone files are whole documents, and there <title>/<link>/<style> were landing in
// <body> - valid only because browsers hoist them, and it delays the webfont.
function splitShell(shell) {
  const i = shell.lastIndexOf('</style>');
  return i < 0 ? { head: '', body: shell } : { head: shell.slice(0, i + 8), body: shell.slice(i + 8) };
}

function build({ inline, standalone }) {
  const colors = cutMap(inline);
  // main shot: the transparent cutout when we have one, else the original photo
  const main = {};
  for (const p of phones) {
    const cut = `${CUT}/${p.id}__main.webp`;
    if (fs.existsSync(cut)) {
      main[p.id] = inline ? 'data:image/webp;base64,' + fs.readFileSync(cut).toString('base64') : cut;
    } else console.warn('  ! missing image for', p.id);
  }
  const imgdata = `const IMGDATA=${JSON.stringify(main)};\nconst COLORIMG=${JSON.stringify(colors)};\n`;
  const shell = rd('_shell.html');
  // the script BODY is hashed for the CSP, so it is built once and wrapped separately
  const appJs = '\n'
    + `const DATA=${JSON.stringify(phones)};\nconst STR=${JSON.stringify(STR)};\nconst VERD=${JSON.stringify(VERD)};\n`
    + `const PRICES=${JSON.stringify(PRICES)};\n`
    + `const HISTORY=${JSON.stringify(HISTORY)};\n`
    + `const TERMS=${JSON.stringify(TERMS)};\n`
    + imgdata + rd('_app.js') + '\n';
  const script = '\n<script>' + appJs + '<\/script>\n';
  if (!standalone) return shell + script;          // the artifact platform supplies the <head>
  const { head, body } = splitShell(shell);
  return HEAD_OPEN(appJs) + head + HEAD_CLOSE + body + script + '\n</body></html>\n';
}

fs.writeFileSync('robots.txt', `User-agent: *
Allow: /
Sitemap: ${SITE}sitemap.xml
`);
fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 <url><loc>${SITE}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
</urlset>
`);
fs.writeFileSync('index.html', build({ inline: false, standalone: true }));
fs.writeFileSync('index.embedded.html', build({ inline: true, standalone: true }));
fs.writeFileSync('artifact.html', build({ inline: true, standalone: false }));
const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
for (const f of ['index.html', 'index.embedded.html', 'artifact.html']) console.log(f.padEnd(22), kb(f));
