// What the shops sell, from brands we carry, that the catalogue has no entry for yet - phones,
// laptops, watches, headphones, professional cameras and approved power banks.
//
//   node tools/new-products.mjs -> data/new-products.txt (grouped by shop)
//   --shops=allsell,istore --output=/path/to/private-report.txt
//
// Two sources: the titles the nightly crawl could not place (data/unmatched.json), and the product
// sitemaps of the shops that publish one - the crawl reads those only for urls it already
// recognises, so an unknown model there is never seen. Review the list, then add with tools/add.mjs.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const UA = 'BetterBot/1.0 (+https://better.am)';
const shopFilter = process.argv.find(a => a.startsWith('--shops='))?.slice(8).split(',');
const selected = shop => !shopFilter || shopFilter.includes(shop);
const src = fs.readFileSync('scrape.mjs', 'utf8');
const body = src.slice(0, src.indexOf('const report = [];')).replace('process.argv.slice(2)', '[]');
// Written beside scrape.mjs, not imported as a data: URL: scrape.mjs now imports ./tools/*.mjs
// by relative path, which a data: URL has no base to resolve against.
const tmp = `.new-products-${process.pid}.mjs`;
fs.writeFileSync(tmp, body + '\nexport { matchPhone, looksLikeAccessory };\n');
let matchPhone, looksLikeAccessory;
try { ({ matchPhone, looksLikeAccessory } = await import('../' + tmp)); } finally { fs.rmSync(tmp, { force: true }); }

const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const KINDS = new Set(['phone', 'laptop', 'watch', 'headphones']);
const LINES = ['iPhone', 'MacBook', 'AirPods', 'Galaxy', 'Redmi', 'POCO', 'Pixel', 'ThinkPad', 'ThinkBook', 'IdeaPad',
  'Vivobook', 'Zenbook', 'ROG', 'TUF', 'Legion', 'Yoga', 'Pavilion', 'Victus', 'OMEN', 'OmniBook', 'EliteBook', 'ProBook',
  'Inspiron', 'Vostro', 'Latitude', 'XPS', 'Aspire', 'Nitro', 'Predator', 'Swift', 'MagicBook', 'CMF'];
const brands = [...new Set(P.filter(p => KINDS.has(p.category)).map(p => p.brand))].concat(LINES);
const esc = s => s.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&');
const BRAND = new RegExp('\\b(' + brands.map(esc).join('|') + ')\\b', 'i');
const KIND = /phone|notebook|laptop|watch|headphone|headset|earbuds|buds|tws|iphone|macbook|airpods|galaxy [szaf]\d|redmi|poco|pixel|thinkpad|thinkbook|ideapad|vivobook|zenbook|legion|yoga|pavilion|victus|omen|omnibook|elitebook|probook|inspiron|vostro|latitude|xps|aspire|nitro|predator|swift|magicbook|smart ?band|fenix|forerunner|venu|instinct|tune|vibe|endurance|soundgear|wh-?1000|wf-?1000/i;
// things that sell next to the devices, under the same brand names
const NOT = /\b(ferrari|lagerfeld|guess|bmw|mercedes|polo|silicone|woven|shield|monogram|shell|loop|sport band|outlet|case|cover|glass|film|cable|charger|adapter|strap|holder|stand|bag|sleeve|protector|mount|dock|hub|mouse|keyboard|stylus|pencil|tips|power ?bank|router|ssd|monitor|tv|speaker|soundbar|microphone|game|chair|keris)\b|чехол|кабель|ремешок|стекло/i;
// Check these before the legacy accessory blacklist: power banks were previously
// excluded intentionally, and camera kits may legitimately include a lens.
const cameraBrand = /\b(canon|nikon|sony|fujifilm|panasonic|lumix|leica|om system|olympus|blackmagic)\b/i;
const cameraModel = /\b(eos|lumix\s+[a-z]+\d\w*|(?:sony\s+|alpha\s+)a\d\w*|zv[- ]?[a-z]*\d\w*|nikon\s+z\s*\d\w*|x[- ]?(?:t|s|h)\d\w*|x100\w*|gfx\s*\d\w*|mirrorless|dslr|cinema camera)\b/i;
const cameraAccessory = /\b(cap|cage|strap|adapter|filter|battery|charger|case|bag|screen protector|mount)\b|^\s*(?:lens|objective)\b|\b(?:lens|objective)\s+for\b|\b(?:for|compatible with)\s+(?:canon|nikon|sony|fujifilm|lumix)\b/i;
const powerBankBrand = /\b(belkin|xiaomi|redmi|huawei)\b/i;
const powerBank = /\bpower[ -]?bank\b|\bportable power bank\b|пауэрбанк|внешний аккумулятор|արտաքին մարտկոց/i;
const powerBankAccessory = /\b(case|pouch|cover|cable|adapter)\s+for\b|\b(power[ -]?bank)\s+(case|pouch|cover|holder)\b|\b(?:wall|car) charger\b/i;
const additionalKind = t => {
  if (powerBankBrand.test(t) && powerBank.test(t) && !powerBankAccessory.test(t)) return 'powerbank';
  if (cameraBrand.test(t) && cameraModel.test(t) && !cameraAccessory.test(t)) return 'camera';
  return null;
};
const wanted = t => Boolean(additionalKind(t) || (BRAND.test(t) && KIND.test(t) && !NOT.test(t) && !looksLikeAccessory(t))) && !matchPhone(bare(t));

// a known model in a memory size the catalogue has not listed is not a new product
const bare = t => t.replace(/\b\d+\s*(gb|tb)\b|\b\d+\s*\/\s*\d+\s*(gb|tb)?\b/gi, ' ').replace(/\s+/g, ' ');

const out = {};
const put = (shop, line) => (out[shop] ||= new Set()).add(line);

// 1. the crawl's own misses
const unmatchedPath = 'data/unmatched.json';
const um = fs.existsSync(unmatchedPath) ? JSON.parse(fs.readFileSync(unmatchedPath,'utf8')) : {shops:{}};
if (!fs.existsSync(unmatchedPath)) console.warn('No unmatched-listings artifact. Checking retailer sitemaps only.');
for (const [shop, rows] of Object.entries(um.shops)) if (selected(shop)) for (const r of rows) {
  const t = r.title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/^#+\s*/, '');
  if (wanted(t)) put(shop, t + (r.price ? ` | ${r.price}` : '') + (r.url ? ` | ${r.url}` : ''));
}

// 2. product sitemaps (curl: Cloudflare answers Node's fetch with 403 on some of these)
const curl = u => { try { return execFileSync('curl', ['-sL', '--max-time', '120', '-A', UA, u], { maxBuffer: 64e6 }).toString(); } catch { return ''; } };
const locs = (xml, re) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).filter(u => re.test(u));
const SITEMAPS = {
  allsell: () => locs(curl('https://allsell.am/media/sitemap/en.xml'), /allsell\.am\/en\/[^/]+$/),
  istore: () => locs(curl('https://istore.am/sitemaps/sitemap-products-1.xml'), /\/product\//),
  redstore: () => locs(curl('https://redstore.am/sitemap.xml'), /products\/\d+\.xml$/).flatMap(m => locs(curl(m), /\/en\/product\//)),
  zigzag: () => locs(curl('https://www.zigzag.am/sitemap/hy_AM/sitemap.xml'), /zigzag\.am\/am\/[a-z0-9-]+\.html$/),
};
for (const [shop, list] of Object.entries(SITEMAPS)) {
  if (!selected(shop)) continue;
  const urls = list();
  let n = 0;
  for (const u of urls) {
    const words = decodeURIComponent(u.split('/').pop()).replace(/\.html$/, '').replace(/[-_]+/g, ' ');
    if (wanted(words)) { put(shop, `${words} | ${u}`); n++; }
  }
  if (urls.length) console.log(`${shop}: ${urls.length} sitemap pages, ${n} unlisted from our brands`);
  else console.warn(`${shop}: sitemap returned no usable pages; coverage unknown`);
}

const txt = Object.entries(out).map(([s, l]) => `== ${s} (${l.size})\n` + [...l].sort().join('\n')).join('\n\n') + '\n';
const output = process.argv.find(a => a.startsWith('--output='))?.slice(9) || 'data/new-products.txt';
fs.writeFileSync(output, txt);
console.log(`${Object.values(out).reduce((n, l) => n + l.size, 0)} candidate(s) -> ${output}`);
