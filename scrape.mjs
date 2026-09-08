// Collects real smartphone prices from Armenian online shops into data/prices.json.
//
//   node scrape.mjs            all shops
//   node scrape.mjs ispace     one shop
//
// Politeness / rules this respects:
//   * list.am is EXCLUDED — its robots.txt has "User-agent: ClaudeBot / Disallow: /".
//   * vega.am disallows ?limit= ?sort= ?order= ?search= — only ?page= is used.
//   * zigzag.am is OFF by default — its WAF 403s identified crawlers and faking a browser
//     user agent to bypass that would be bot-detection evasion.
//   * ispace.am publishes llms.txt pointing AI clients at /category/* — that is what is used.
//   * one request at a time per host, with a delay between them.
//
// If a shop changes its markup an adapter returns 0 offers and says so. It never guesses:
// a phone with no offers keeps its estimated price in phones.json and is labelled as such.

import fs from 'node:fs';

const UA = 'MyCatalogBot/0.1 (+price comparison; respects robots.txt)';
const DELAY_MS = 400;
const TIMEOUT_MS = 30000;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

async function get(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const c = AbortSignal.timeout(TIMEOUT_MS);
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*' }, signal: c, redirect: 'follow' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      if (i === tries - 1) { console.warn('    ! ' + url.slice(0, 90) + ' -> ' + e.message); return ''; }
      await sleep(1200);
    }
  }
  return '';
}

/* ---------- phone matching ---------- */
const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const fullName = p => p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.name : p.brand + ' ' + p.name;

// each phone gets one or more keys; the LONGEST key that matches a listing wins,
// so "iphone 17" never steals a listing for "iphone 17 pro max".
const KEYS = [];
for (const p of phones) {
  const V = new Set();
  const add = k => {
    k = norm(k);
    if (!k) return;
    V.add(k);
    if (/ 5g$/.test(k)) V.add(k.replace(/ 5g$/, ''));   // shops often drop the "5G"
  };
  add(fullName(p));
  // shops usually omit the brand in slugs ("iphone-17-pro-...", "galaxy-s25-ultra-...").
  // only trust a brand-less key when it is specific enough to stand alone.
  const bare = norm(p.name);
  if (bare.length >= 8 && bare.includes(' ')) add(bare);   // "iphone 17 pro", "iphone air"
  else if (bare.length >= 5 && /\d/.test(bare)) add(bare);
  for (const k of V) KEYS.push({ id: p.id, key: k });
}
KEYS.sort((a, b) => b.key.length - a.key.length);

// space-delimited containment == whole-token matching, without regex escaping traps.
// " apple iphone 17e " does NOT contain " iphone 17 ", so the 17e never lands on the 17.
// Model words that turn a phone into a DIFFERENT phone. Keys are tried longest-first, so if
// one of these still trails the best match, the listing is a variant we don't carry -> no match.
// Without this, "Apple iPhone 16 Pro Max" would be priced as an iPhone 16.
const QUALIFIERS = new Set(['pro', 'max', 'plus', 'ultra', 'mini', 'air', 'fe', 'lite', 'neo', 'edge', 'e', 'se']);

// Shops list accessories under the phone's own name ("Clear Case with MagSafe for iPhone 15"),
// and those were being priced AS the phone. Anything that names an accessory, or is sold
// "for" a phone, is not the phone.
// Plain substring list rather than one big regex: an alternation that silently breaks in
// editing means accessories get priced as phones, which is exactly what happened.
const ACCESSORY_WORDS = [
  'case', 'cover', 'bumper', 'sleeve', 'pouch', 'wallet', 'folio', 'glass', 'protector',
  'protection', 'tempered', 'film', 'skin', 'charger', 'charging', 'cable', 'adapter',
  'adaptor', 'dock', 'holder', 'mount', 'strap', 'lens', 'magsafe', 'powerbank',
  'power bank', 'airpods', 'airtag', 'apple watch', 'pencil', 'keyboard', 'earphone',
  'headphone', 'headset', 'stylus',
  'պատյան', 'ապակի', 'պաշտպան', 'լիցքավոր', 'մալուխ', 'ադապտեր',
  'чехол', 'стекло', 'защит', 'кабел', 'зарядн', 'адаптер', 'держател',
  'накладк', 'бампер', 'пленк', 'плёнк', 'наушник'
];
// a phone is never sold "for" another phone
const FOR_WORDS = [' for iphone', ' for galaxy', ' for redmi', ' for poco', ' for pixel',
  ' for honor', ' for realme', ' for oneplus', ' for xiaomi',
  ' для iphone', ' для galaxy', ' для redmi', ' для xiaomi'];
// No regex here on purpose: every escaped pattern written into this file so far has lost its
// backslashes in editing, and a silently-broken normaliser means accessories pass as phones.
// A letter is any char whose upper and lower case differ - true for Latin, Cyrillic, Armenian.
function tokenized(text) {
  let out = ' ';
  for (const ch of String(text).toLowerCase()) {
    const isLetter = ch.toLowerCase() !== ch.toUpperCase();
    const isDigit = ch >= '0' && ch <= '9';
    out += (isLetter || isDigit) ? ch : ' ';
  }
  return out + ' ';
}
function looksLikeAccessory(text) {
  const h = tokenized(text).replace(/  +/g, ' ');
  if (ACCESSORY_WORDS.some(w => h.includes(' ' + w + ' '))) return true;
  if (FOR_WORDS.some(w => h.includes(w + ' '))) return true;
  return false;
}
function matchPhone(text) {
  if (looksLikeAccessory(text)) return null;
  const h = ' ' + norm(text) + ' ';
  for (const k of KEYS) {
    const needle = ' ' + k.key + ' ';
    const i = h.indexOf(needle);
    if (i < 0) continue;
    const next = h.slice(i + needle.length).trim().split(' ')[0];
    if (next && QUALIFIERS.has(next)) return null;
    return k.id;
  }
  return null;
}
// every "<n> GB/TB" figure in a title, in GB
function capacitiesOf(text) {
  // keep unicode letters: norm() strips ԳԲ / ՏԲ before they can be read
  const h = String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return [...h.matchAll(/(\d+)\s*(tb|տբ|gb|գբ)(?:\s|$)/g)]
    .map(m => +m[1] * (/tb|տբ/.test(m[2]) ? 1024 : 1));
}
// titles like "SM-S938B/DS 12GB 256GB" list RAM first, then storage -> larger is storage
const storageOf = text => { const c = capacitiesOf(text); return c.length ? Math.max(...c) : null; };
// ...and the smaller one is RAM, but only when the title really lists both
const ramOf = text => { const c = capacitiesOf(text); return c.length >= 2 ? Math.min(...c) : null; };
// colour, matched against the colours we already know this phone ships in
function colorOf(text, colors) {
  const h = String(text).toLowerCase();
  let hit = null;
  for (const c of colors || []) if (h.includes(String(c).toLowerCase()) && (!hit || c.length > hit.length)) hit = c;
  return hit;
}
// Offer URLs end up in an href. iSpace's come from a third party's JSON-LD, so the scheme is
// not ours to trust: anything but http(s) is dropped rather than rendered.
function safeUrl(u) {
  try {
    const url = new URL(String(u));
    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
  } catch { return null; }
}
const clean = s => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const ldJson = html => [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap(m => { try { const j = JSON.parse(m[1]); return Array.isArray(j) ? j : [j]; } catch { return []; } });

/* ---------- self-test:  node scrape.mjs --selftest  (no network) ---------- */
if (process.argv[2] === '--selftest') {
  const cases = [
    ['apple-iphone-17-pro', 'iphone-17-pro-512-gb-deep-blue-mg8k4af-a'],
    ['apple-iphone-17', 'apple-iphone-17-256gb-black-mg6j4af-a.html'],
    [null, 'Apple iPhone 17e'],                       // 17e must not land on the 17
    [null, 'Apple iPhone 16 Pro Max'],                // model we do not carry
    ['samsung-galaxy-s25-ultra', 'samsung-galaxy-s25-ultra-512gb'],
    ['samsung-galaxy-s25', 'samsung-galaxy-s25-256gb'],
    ['apple-iphone-17', 'Սմարթ հեռախոս APPLE iPhone 17 256GB (Lavender) (A3520)'],
    ['xiaomi-15t', 'xiaomi-15t-256gb'],
    ['poco-x7-pro', 'poco-x7-pro-512gb'],
    ['apple-iphone-17-pro-max', 'apple-iphone-17-pro-max-2tb'],
    ['samsung-galaxy-a56', 'Samsung Galaxy A56 5G 256GB'],
    ['xiaomi-redmi-note-14-pro', 'redmi-note-14-pro-256gb'],
    ['realme-c75', 'realme-c75-128gb'],
    ['apple-iphone-air', 'iphone-air-256-gb'],
    [null, 'APPLE Clear Case with MagSafe for iPhone 15'],        // accessory, not the phone
    [null, 'https://istore.am/product/silicone-case-for-iphone-17-pro-black'],
    [null, 'Tempered Glass for iPhone 15'],
    [null, 'Чехол для iPhone 15 Pro'],
    [null, 'Պատյան iPhone 15-ի համար'],
    [null, 'Apple Watch Series 10'],
    ['apple-iphone-15', 'Սմարթ հեռախոս APPLE IPHONE 15 128GB (BK) (MTP03HX/A)'],   // still a phone
    ['apple-iphone-15', 'iPhone 15, 128 ԳԲ, Pink'],
  ];
  let bad = 0;
  for (const [want, txt] of cases) {
    const got = matchPhone(txt);
    if (got !== want) { bad++; console.log(`FAIL  got=${got}  want=${want}  <- ${txt}`); }
  }
  const st = [['iphone 17 pro 512 gb', 512], ['2tb', 2048], ['256gb', 256], ['1 ՏԲ', 1024], ['128 ԳԲ', 128],
    ['SAMSUNG Galaxy S25 Ultra 5G SM-S938B/DS 12GB 256GB', 256],   // RAM listed first, storage is the larger
    ['ONEPLUS 13 16GB 512GB (Arctic Down)', 512],
    ['Apple iPhone 17', null]];
  const ramCases = [['SAMSUNG Galaxy S25 Ultra 5G SM-S938B/DS 12GB 256GB', 12], ['XIAOMI POCO X7 Pro 5G 8GB 256GB (Black)', 8],
    ['iPhone 17 Pro, 256 ԳԲ, Silver', null]];
  for (const [txt, want] of ramCases) {
    const got = ramOf(txt);
    if (got !== want) { bad++; console.log(`FAIL ram got=${got} want=${want} <- ${txt}`); }
  }
  const colCases = [['iPhone 17 Pro, 256 ԳԲ, Deep Blue', ['Cosmic Orange', 'Deep Blue', 'Silver'], 'Deep Blue'],
    ['APPLE iPhone 17 Pro 256GB (Cosmic Orange) (A3523)', ['Cosmic Orange', 'Deep Blue'], 'Cosmic Orange'],
    ['Apple iPhone 17 Pro', ['Cosmic Orange', 'Deep Blue'], null]];
  const urlCases = [['https://vega.am/x.html', true], ['http://shop.am/x', true],
    ['javascript:alert(1)', false], ['data:text/html,<script>', false], ['/relative/path', false], ['', false]];
  for (const [txt, ok] of urlCases) {
    const got = safeUrl(txt);
    if (!!got !== ok) { bad++; console.log(`FAIL url got=${got} want=${ok ? 'accepted' : 'rejected'} <- ${txt}`); }
  }
  for (const [txt, cols, want] of colCases) {
    const got = colorOf(txt, cols);
    if (got !== want) { bad++; console.log(`FAIL colour got=${got} want=${want} <- ${txt}`); }
  }
  for (const [txt, want] of st) {
    const got = storageOf(txt);
    if (got !== want) { bad++; console.log(`FAIL storage got=${got} want=${want} <- ${txt}`); }
  }
  console.log(bad ? `${bad} failure(s)` : `all ${cases.length + st.length + ramCases.length + colCases.length + urlCases.length} checks pass`);
  process.exit(bad ? 1 : 0);
}

const phoneById = Object.fromEntries(phones.map(p => [p.id, p]));
const enrich = (o) => ({
  ...o,
  ram: o.ram ?? ramOf(o.title),
  color: colorOf(o.title, (phoneById[o.id] || {}).colors)
});

/* ---------- shops ---------- */
const SHOPS = {
  ispace: {
    name: 'iSpace', site: 'https://ispace.am', note: 'Apple Premium Reseller',
    warranty: 'https://ispace.am/pages/warranty',
    async run() {
      const out = [];
      const seen = new Set();
      for (let page = 1; page <= 4; page++) {
        const html = await get(`https://ispace.am/category/iphone${page > 1 ? '?page=' + page : ''}`);
        await sleep(DELAY_MS);
        if (!html) break;
        const list = ldJson(html).find(j => j['@type'] === 'ItemList');
        const urls = (list?.itemListElement || []).map(i => i.url).filter(Boolean);
        if (!urls.length) break;
        const fresh = urls.filter(u => !seen.has(u) && matchPhone(u));
        urls.forEach(u => seen.add(u));
        for (const u of fresh) {
          const ph = await get(u); await sleep(DELAY_MS);
          const pr = ldJson(ph).find(j => j['@type'] === 'Product');
          const price = Number(pr?.offers?.price);
          if (!pr || !price) continue;
          const id = matchPhone(pr.name + ' ' + u);
          const safe = safeUrl(u);
          if (!id || !safe) continue;
          out.push({ id, price, storage: storageOf(pr.name) ?? storageOf(u), title: pr.name, url: safe,
            sku: pr.sku || null, image: (Array.isArray(pr.image) ? pr.image[0] : pr.image) || null,
            inStock: /InStock/i.test(pr.offers.availability || '') });
        }
      }
      return out;
    }
  },

  vega: {
    name: 'Vega', site: 'https://vega.am', note: 'electronics retailer',
    warranty: 'https://vega.am/services.html',
    async run() {
      const out = [];
      for (let page = 1; page <= 6; page++) {
        // robots.txt disallows limit/sort/order/search params — page is allowed
        const html = await get(`https://vega.am/home-appliances/phones-and-gadgets/smart-phones${page > 1 ? '?page=' + page : ''}`);
        await sleep(DELAY_MS);
        if (!html) break;
        const blocks = html.split('class="product-thumb').slice(1);
        if (!blocks.length) break;
        for (const b of blocks) {
          const url = (b.match(/href="(https:\/\/vega\.am\/[^"]*\.html)"/) || [])[1];
          const title = clean((b.match(/alt="([^"]{10,})"/) || [])[1] || '');
          const price = Number((b.match(/data-price-value="(\d+)"/) || [])[1]);
          if (!url || !title || !price || !safeUrl(url)) continue;
          const id = matchPhone(title + ' ' + url);
          if (!id) continue;
          // the listing serves 250x250; the same path also serves 500x500 (and 1500x1500)
          const thumb = (b.match(/src="(https:\/\/vega\.am\/image\/cache\/catalog\/[^"]+?\.jpg)"/) || [])[1];
          out.push({ id, price, storage: storageOf(title) ?? storageOf(url), title, url, inStock: true,
            image: thumb ? thumb.replace(/-250x250\.jpg$/, '-500x500.jpg') : null });
        }
        if (blocks.length < 5) break;
      }
      return out;
    }
  },

  mobilecentre: {
    name: 'Mobile Centre', site: 'https://mobilecentre.am', note: 'phone retail chain',
    async run() {
      const out = [];
      // this category ignores ?page= and returns its whole listing in one response,
      // so paging it just refetches the same 140 products
      {
        const html = await get('https://mobilecentre.am/category/phones/138/0/');
        await sleep(DELAY_MS);
        if (!html) return out;
        const blocks = html.split('class="listitem"').slice(1);
        if (!blocks.length) return out;
        for (const b of blocks) {
          const url = (b.match(/href="(https:\/\/mobilecentre\.am\/product\/[^"]+)"/) || [])[1];
          const title = clean((b.match(/<h3[^>]*>([\s\S]{2,120}?)<\/h3>/) || [])[1] || '');
          // the credit-calculator link carries the price as a clean integer
          const price = Number((b.match(/data-price="(\d+)"/) || [])[1])
            || Number(((b.match(/Գին՝\s*<\/span>\s*([\d,]+)\s*դր/) || [])[1] || '').replace(/,/g, ''));
          if (!url || !title || !price || !safeUrl(url)) continue;
          const id = matchPhone(title + ' ' + url);
          if (!id) continue;
          out.push({ id, price, storage: storageOf(title) ?? storageOf(url), title, url, inStock: true });
        }
      }
      return out;
    }
  },

  pixel: {
    name: 'Pixel', site: 'https://www.pixel.am', note: 'phone retailer',
    async run() {
      const out = [];
      let cat = '';
      for (let page = 1; page <= 4; page++) {
        const part = await get(`https://www.pixel.am/am/products/phones?show=32&page=${page}`);
        await sleep(DELAY_MS);
        if (!part) break;
        cat += part;
        if (!/\/am\/product\//.test(part)) break;
      }
      if (!cat) return out;
      // filter by URL first so we only fetch pages that can match a phone we list
      const urls = [...new Set([...cat.matchAll(/https:\/\/www\.pixel\.am\/am\/product\/[a-z0-9-]+/g)].map(m => m[0]))]
        .filter(u => matchPhone(u));
      for (const u of urls) {
        const h = await get(u); await sleep(DELAY_MS);
        if (!h) continue;
        // <title> is "<name>՝ գինը 274,000 Դրամ"; the variant blob carries every SKU price
        const title = clean((h.match(/<title>([^<]*)<\/title>/) || [])[1] || '').replace(/՝\s*գին[^]*$/, '').trim();
        const prices = [...h.matchAll(/"price":(\d{4,})/g)].map(m => +m[1]).filter(n => n > 1000);
        if (!title || !prices.length) continue;
        const id = matchPhone(title + ' ' + u);
        const safe = safeUrl(u);
        if (!id || !safe) continue;
        out.push({ id, price: Math.min(...prices), storage: storageOf(title) ?? storageOf(u), title, url: safe, inStock: true });
      }
      return out;
    }
  },


  istore: {
    name: 'iStore', site: 'https://istore.am', note: 'authorised Apple reseller',
    async run() {
      // istore publishes a product sitemap with descriptive slugs, so only pages that already
      // look like one of our phones are fetched. robots.txt disallows /product/search - unused.
      const xml = await get('https://istore.am/sitemaps/sitemap-products-1.xml');
      await sleep(DELAY_MS);
      const urls = [...xml.matchAll(/<loc>(https:\/\/istore\.am\/product\/[^<]+)<\/loc>/g)].map(m => m[1]);
      const out = [], perPhone = {};
      for (const u of urls) {
        const id = matchPhone(u);
        if (!id) continue;
        perPhone[id] = (perPhone[id] || 0) + 1;
        if (perPhone[id] > 8) continue;               // cap requests per model
        const html = await get(u); await sleep(DELAY_MS);
        if (!html) continue;
        // ".price is-action" is the live price; ".price text-muted" is the struck-through old one
        const raw = (html.match(/class="price is-action"[^>]*>\s*([\d\s  ]+)/) || [])[1];
        const price = raw ? Number(raw.replace(/[^\d]/g, '')) : 0;
        const title = clean((html.match(/<title>([^<|]*)/) || [])[1] || '');
        if (!price || !title) continue;
        if (!safeUrl(u)) continue;
        out.push({ id, price, storage: storageOf(title) ?? storageOf(u), title, url: u, inStock: true,
          image: (html.match(/https:\/\/istore\.am\/[^"']*?\.(?:jpg|png|webp)/) || [])[0] || null });
      }
      return out;
    }
  },

  zigzag: {
    name: 'Zigzag', site: 'https://www.zigzag.am', note: 'electronics retailer',
    // Their WAF answers 403 to any non-browser user agent. Spoofing a browser to get around
    // that is bot-detection evasion, so this adapter stays off by default. Run it explicitly
    // (node scrape.mjs zigzag) if they ever allow identified crawlers.
    disabled: '403 to non-browser user agents',
    async run() {
      // robots.txt forbids query strings, so candidate URLs come from zigzag's own sitemap
      const xml = await get('https://www.zigzag.am/sitemap/hy_AM/sitemap.xml');
      await sleep(DELAY_MS);
      const urls = [...xml.matchAll(/<loc>(https:\/\/www\.zigzag\.am\/am\/[^<]+\.html)<\/loc>/g)].map(m => m[1]);
      // only fetch pages that already look like one of our phones
      const cand = urls.filter(u => matchPhone(u));
      const out = [];
      const perPhone = {};
      for (const u of cand) {
        const id = matchPhone(u);
        perPhone[id] = (perPhone[id] || 0) + 1;
        if (perPhone[id] > 6) continue;            // cap requests per model
        const html = await get(u); await sleep(DELAY_MS);
        if (!html) continue;
        const price = Number((html.match(/data-price-amount="(\d+(?:\.\d+)?)"/) || [])[1]);
        const title = clean((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '').replace(/\s*-\s*Zigzag.*$/i, '');
        if (!price) continue;
        out.push({ id, price: Math.round(price), storage: storageOf(title) ?? storageOf(u), title, url: u, inStock: true });
      }
      return out;
    }
  }
};

/* ---------- run ---------- */
const only = process.argv[2];
const names = Object.keys(SHOPS).filter(k => only ? k === only : !SHOPS[k].disabled);

// Running one shop must not throw away the others. Start from what is already on disk and
// replace only the shops this run actually covers.
const PRICES_FILE = 'data/prices.json';
let prev = { shops: {}, offers: {} };
if (only && fs.existsSync(PRICES_FILE)) {
  try { prev = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8')); } catch { }
}
for (const [k, s] of Object.entries(SHOPS)) if (s.disabled && !names.includes(k)) console.log(`[${s.name}] skipped — ${s.disabled}`);
const offers = {};
for (const [id, list] of Object.entries(prev.offers || {})) {
  const keep = list.filter(o => !names.includes(o.shop));   // drop the shops we are re-fetching
  if (keep.length) offers[id] = keep;
}
const report = [];

for (const key of names) {
  const s = SHOPS[key];
  process.stdout.write(`[${s.name}] `);
  let got = [];
  try { got = await s.run(); } catch (e) { console.warn('adapter failed:', e.message); }
  // keep the cheapest offer per (phone, storage)
  const best = new Map();
  let dropped = 0;
  for (const raw of got) {
    const o = enrich(raw);
    // Catches accessories that do not use any of the words above: nothing legitimately sells
    // at under a third of the model's own reference price.
    const ref = (phoneById[o.id] || {}).priceAmd;
    if (ref && o.price < ref * 0.3) { dropped++; continue; }
    const k = [o.id, o.storage ?? '?', o.color ?? '?'].join('|');
    if (!best.has(k) || o.price < best.get(k).price) best.set(k, o);
  }
  for (const o of best.values()) (offers[o.id] ||= []).push({ ...o, shop: key });
  const models = new Set([...best.values()].map(o => o.id));
  console.log(`${best.size} offers across ${models.size} of ${phones.length} models` + (dropped ? ` (${dropped} implausible dropped)` : ''));
  report.push({ shop: key, offers: best.size, models: models.size });
}

for (const id of Object.keys(offers)) offers[id].sort((a, b) => a.price - b.price);

const shops = { ...(prev.shops || {}) };
for (const k of names) shops[k] = { name: SHOPS[k].name, site: SHOPS[k].site, note: SHOPS[k].note, warranty: SHOPS[k].warranty || null };

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/prices.json', JSON.stringify({
  generated: new Date().toISOString(),
  excluded: { 'list.am': 'robots.txt: User-agent: ClaudeBot / Disallow: /' },
  shops, offers
}, null, 1));

/* ---------- price history ----------
   History cannot be backfilled: it only exists from the first run that records it. Each run
   appends ONE point per phone per day (cheapest offer + how many shops), replacing the point
   if the same day is scraped twice. The chart stays honest - it plots only days we actually saw. */
const HIST = 'data/history.json';
const hist = fs.existsSync(HIST) ? JSON.parse(fs.readFileSync(HIST, 'utf8')) : { points: {} };
hist.points ||= {};
const day = new Date().toISOString().slice(0, 10);
let hadded = 0;
for (const [id, list] of Object.entries(offers)) {
  if (!list.length) continue;
  const lo = Math.min(...list.map(o => o.price));
  const hi = Math.max(...list.map(o => o.price));
  const shops = new Set(list.map(o => o.shop)).size;
  // History is what the site's credibility rests on, so a point is only recorded if it is
  // plausible. An accessory once slipped through as a 20 900 AMD "iPhone 15" and was baked
  // into day one; these guards stop a bad scrape becoming permanent history.
  const ref = (phoneById[id] || {}).priceAmd;
  if (ref && lo < ref * 0.45) { console.warn(`    ! history skipped ${id}: lo ${lo} implausible vs ${ref}`); continue; }
  if (hi / lo > 3) { console.warn(`    ! history skipped ${id}: spread ${lo}-${hi} too wide`); continue; }
  const prev = (hist.points[id] || []).filter(pt => pt.d !== day).slice(-1)[0];
  if (prev && Math.abs(lo - prev.lo) / prev.lo > 0.5) {
    console.warn(`    ! history skipped ${id}: ${prev.lo} -> ${lo} is a >50% jump`); continue;
  }
  const arr = (hist.points[id] ||= []);
  const i = arr.findIndex(pt => pt.d === day);
  const pt = { d: day, lo, hi, shops };
  if (i >= 0) arr[i] = pt; else { arr.push(pt); hadded++; }
  arr.sort((a, b) => a.d.localeCompare(b.d));
  if (arr.length > 400) arr.splice(0, arr.length - 400);   // ~13 months, plenty
}
hist.updated = day;
fs.writeFileSync(HIST, JSON.stringify(hist));
const days = new Set(Object.values(hist.points).flat().map(p => p.d)).size;
console.log(`data/history.json - ${hadded} new points, ${days} day(s) tracked so far`);

const covered = Object.keys(offers).length;
console.log(`\ndata/prices.json written — ${covered}/${phones.length} models have at least one real offer`);
const missing = phones.filter(p => !offers[p.id]).map(p => p.id);
if (missing.length) console.log('no offers found for:', missing.join(', '));
