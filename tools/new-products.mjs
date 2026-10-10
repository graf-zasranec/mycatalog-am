// What the shops sell, from brands we carry, that the catalogue has no entry for yet - phones,
// laptops, watches and headphones only.
//
//   node tools/new-products.mjs        -> data/new-products.txt (grouped by shop)
//
// Two sources: the titles the nightly crawl could not place (data/unmatched.json), and the product
// sitemaps of the shops that publish one - the crawl reads those only for urls it already
// recognises, so an unknown model there is never seen. Review the list, then add with tools/add.mjs.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const UA = 'BetterBot/1.0 (+https://better.am)';
const src = fs.readFileSync('scrape.mjs', 'utf8');
const body = src.slice(0, src.indexOf('const report = [];')).replace('process.argv.slice(2)', '[]');
const { matchPhone, looksLikeAccessory } = await import('data:text/javascript;base64,' +
  Buffer.from(body + '\nexport { matchPhone, looksLikeAccessory };\n', 'utf8').toString('base64'));

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
const wanted = t => BRAND.test(t) && KIND.test(t) && !NOT.test(t) && !looksLikeAccessory(t) && !matchPhone(bare(t));
// a known model in a memory size the catalogue has not listed is not a new product
const bare = t => t.replace(/\d+\s*(gb|tb)|\d+\s*\/\s*\d+\s*(gb|tb)?/gi, ' ').replace(/\s+/g, ' ');

const out = {};
const put = (shop, line) => (out[shop] ||= new Set()).add(line);

// 1. the crawl's own misses
const um = JSON.parse(fs.readFileSync('data/unmatched.json', 'utf8'));
for (const [shop, rows] of Object.entries(um.shops)) for (const r of rows) {
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
  const urls = list();
  let n = 0;
  for (const u of urls) {
    const words = decodeURIComponent(u.split('/').pop()).replace(/\.html$/, '').replace(/[-_]+/g, ' ');
    if (wanted(words)) { put(shop, `${words} | ${u}`); n++; }
  }
  console.log(`${shop}: ${urls.length} sitemap pages, ${n} unlisted from our brands`);
}

const txt = Object.entries(out).map(([s, l]) => `== ${s} (${l.size})\n` + [...l].sort().join('\n')).join('\n\n') + '\n';
fs.writeFileSync('data/new-products.txt', txt);
console.log(`${Object.values(out).reduce((n, l) => n + l.size, 0)} candidate(s) -> data/new-products.txt`);
