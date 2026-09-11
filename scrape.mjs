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

const UA = 'MyCatalogBot/0.1 (+price comparison; respects robots.txt)';   // tools/*.mjs use the same string
const DELAY_MS = 400;
const TIMEOUT_MS = 30000;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s).toLowerCase().split(String.fromCharCode(43)).join(" plus ").replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

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
  // shops write some names differently ("Apple Watch SE GPS Gen.3"). An item can list the
  // spellings it also answers to rather than us loosening the matcher for everyone.
  for (const al of p.aliases || []) add(al);
  // shops usually omit the brand in slugs ("iphone-17-pro-...", "galaxy-s25-ultra-...").
  // only trust a brand-less key when it is specific enough to stand alone.
  // Operator shops drop "Galaxy" from the slug: telecomarmenia writes samsung-a37-6-128-graygreen
  // and samsung-s26ultra-12-512gb-skyblue, never "galaxy".
  if (/^galaxy /i.test(p.name)) add(p.brand + ' ' + p.name.replace(/^galaxy /i, ''));
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
// 'xl' earns its place here: telecomarmenia's "Google Pixel 10 Pro XL" was being priced as a
// Pixel 10 Pro, which is a different, cheaper phone.
const QUALIFIERS = new Set(['pro', 'max', 'plus', 'ultra', 'mini', 'air', 'fe', 'lite', 'neo', 'edge', 'e', 'se', 'xl']);

// Shops list accessories under the phone's own name ("Clear Case with MagSafe for iPhone 15"),
// and those were being priced AS the phone. Anything that names an accessory, or is sold
// "for" a phone, is not the phone.
// Plain substring list rather than one big regex: an alternation that silently breaks in
// editing means accessories get priced as phones, which is exactly what happened.
const ACCESSORY_WORDS = [
  // Things sold FOR a device. airpods / apple watch / headphone / earphone / headset used to
  // live here; they are catalogue categories now, so rejecting them would hide real products.
  // NOT 'glass': the iPad Pro is sold with 'standard glass' / 'nano-texture glass'.
  // Screen protectors are still caught by protector / protection / tempered / պաշտպան / защит.
  'case', 'cover', 'bumper', 'sleeve', 'pouch', 'wallet', 'folio', 'protector',
  'protection', 'tempered', 'film', 'skin', 'charger', 'charging', 'cable', 'adapter',
  'adaptor', 'dock', 'holder', 'mount', 'strap', 'lens', 'magsafe', 'powerbank', 'power bank',
  'airtag', 'pencil', 'keyboard', 'stylus',
  'պատյան', 'պաշտպան', 'լիցքավոր', 'մալուխ', 'ադապտեր',
  'чехол', 'защит', 'кабел', 'зарядн', 'адаптер', 'держател',
  'накладк', 'бампер', 'пленк', 'плёнк'
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
  // Shops compress the model in a slug ("samsung-s26ultra", "google-pixel10"). Splitting the
  // digit/letter joins gives an ordinary title back unchanged and recovers the model name from a
  // compressed one, so each reading gets its own attempt instead of loosening the matcher.
  const base = norm(text);
  for (const v of new Set([base, base.replace(/(\d)([a-z])/g, '$1 $2'), base.replace(/([a-z])(\d)/g, '$1 $2')])) {
    const id = matchIn(' ' + v + ' ');
    if (id) return id;
  }
  return null;
}
function matchIn(h) {
  for (const k of KEYS) {
    const needle = ' ' + k.key + ' ';
    const i = h.indexOf(needle);
    if (i < 0) continue;
    const next = h.slice(i + needle.length).trim().split(' ')[0];
    // 'ultra' marks a different phone (Galaxy S25 Ultra) but is also an Intel chip tier
    // ('Core Ultra 7 255U'), which was making every Core Ultra laptop unmatchable.
    const intelUltra = next === 'ultra' && (h.includes(' core ultra ') || h.includes(' ultra 5 ') || h.includes(' ultra 7 ') || h.includes(' ultra 9 '));
    if (next && QUALIFIERS.has(next) && !intelUltra) return null;
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
// pixel.am never names the variant in the title, but its product photo does:
// ".../17-pro-orng-1.png". Expand the shop's abbreviations, then match a word of one of
// the colours we list for that phone, so the row can say "Cosmic Orange" instead of nothing.
const IMG_HUE = { orng: 'orange', ormg: 'orange', oringe: 'orange', blu: 'blue', blk: 'black', wht: 'white',
  slv: 'silver', silv: 'silver', gld: 'gold', grn: 'green', pnk: 'pink', prpl: 'purple',
  ylw: 'yellow', gry: 'gray', grey: 'gray', ttn: 'titanium', titan: 'titanium', lav: 'lavender',
  mid: 'midnight', ultra: 'ultramarine', jet: 'jetblack' };
function colorFromImage(src, colors) {
  const words = tokenized(src).split(' ').filter(Boolean).map(w => IMG_HUE[w] || w);
  let hit = null;
  const hits = [];
  for (const c of colors || []) {
    const cw = tokenized(c).split(' ').filter(Boolean);
    if (cw.some(w => words.includes(w))) { hits.push(c); if (!hit || c.length > hit.length) hit = c; }
  }
  // two colours in one filename ("a06-blk-blue") is a two-tone render, not an answer
  return hits.length === 1 ? hit : null;
}
// Offer URLs end up in an href. iSpace's come from a third party's JSON-LD, so the scheme is
// not ours to trust: anything but http(s) is dropped rather than rendered.
function safeUrl(u) {
  try {
    const url = new URL(String(u));
    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
  } catch { return null; }
}
// A double quote, spelled out: writing one inline inside these scanners is what keeps
// breaking when the file is edited through a shell.
const D = String.fromCharCode(34);
// Both Telecom and iStore mark the real price with a class and then nest spans inside it. A
// fixed-width slice after the tag, or a regex over literal nbsp characters, spliced two numbers
// into a plausible-looking wrong price whenever the markup shifted. Anchor, strip tags, take the
// first number.  ponytail: 8-digit cap, fine until something here costs over 99,999,999 AMD.
const priceAfter = (html, anchor, span = 240) => {
  const i = html.indexOf(anchor);
  if (i < 0) return 0;
  const m = clean(html.slice(i, i + span)).match(/\d[\d\s.,  ]*\d|\d/);
  return m ? Number(m[0].replace(/[^\d]/g, '').slice(0, 8)) : 0;
};
const clean = s => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, String.fromCharCode(34)).replace(/&#0?39;|&apos;/g, String.fromCharCode(39)).replace(/\s+/g, ' ').trim();
const ldJson = html => [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap(m => { try { const j = JSON.parse(m[1]); return Array.isArray(j) ? j : [j]; } catch { return []; } });

/* ---------- self-test:  node scrape.mjs --selftest  (no network) ---------- */
if (process.argv[2] === '--selftest') {
  const cases = [
    // the multi-brand shops reached beyond phones; these slugs must land on the right item
    ['xiaomi-pad-7-pro', 'https://www.pixel.am/am/product/xiaomi-pad-7-pro'],
    ['xiaomi-pad-7', 'https://www.pixel.am/am/product/xiaomi-pad-7-8-256-gray'],
    ['hp-15-fd2747nr', 'HP PC Notebook 15-FD2747NR / Ultra 7 255U / 16GB RAM / 512GB SSD'],
    // Mobile Centre lists the Plus as "S25+"; it must NOT be sold as a plain S25
    [null, 'Samsung Galaxy S25+ 256GB (Silver Shadow)'],
    ['samsung-galaxy-s25', 'Samsung Galaxy S25 128GB (Navy)'],
    ['apple-iphone-17-pro', 'iphone-17-pro-512-gb-deep-blue-mg8k4af-a'],
    ['apple-iphone-17', 'apple-iphone-17-256gb-black-mg6j4af-a.html'],
    // Both are in the catalogue now, so the assertion is the real id - which still proves the
    // qualifier guard works: a broken guard answers apple-iphone-17 / apple-iphone-16 here.
    ['apple-iphone-17e', 'Apple iPhone 17e'],
    ['apple-iphone-16-pro-max', 'Apple iPhone 16 Pro Max'],
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
  // priceAfter is the money path: a wrong number here is published as a real price.
  const NB = String.fromCharCode(160), NN = String.fromCharCode(8239);
  const priceCases = [
    ['<span class="e-shop__main-price"><span>479' + NB + '900</span> AMD</span>', 'e-shop__main-price', 479900],
    ['<div class="price is-action"> 1' + NN + '274' + NB + '900 </div>', 'class="price is-action"', 1274900],
    ['<b class="e-shop__main-price">45900</b>', 'e-shop__main-price', 45900],
    ['<p>no price class here</p>', 'e-shop__main-price', 0],
    // the number must come from the anchored block, not from a capacity sitting before it
    ['256 GB <span class="e-shop__main-price">89' + NB + '900</span>', 'e-shop__main-price', 89900],
  ];
  for (const [html, anchor, want] of priceCases) {
    const got = priceAfter(html, anchor);
    if (got !== want) { bad++; console.log(`FAIL  priceAfter got=${got} want=${want}  <- ${html}`); }
  }
  console.log(bad ? `${bad} failure(s)` : `all ${cases.length + st.length + ramCases.length + colCases.length + urlCases.length + priceCases.length} checks pass`);
  process.exit(bad ? 1 : 0);
}

const phoneById = Object.fromEntries(phones.map(p => [p.id, p]));
const enrich = (o) => ({
  ...o,
  ram: o.ram ?? ramOf(o.title),
  // iSpace titles name the colour in Armenian ("Սև", "Արծաթագույն") but every shop slugs the
  // English name into the product URL, so the slug is the reliable place to read it from.
  color: o.color ?? colorOf(o.title + ' ' + String(o.url || '').replace(/[^a-zA-Z0-9]+/g, ' '), (phoneById[o.id] || {}).colors)
});

/* ---------- shops ---------- */
const SHOPS = {
  ispace: {
    name: 'iSpace', site: 'https://ispace.am', note: 'Apple Premium Reseller',
    warranty: 'https://ispace.am/pages/warranty',
    async run() {
      const out = [];
      const seen = new Set();
      // llms.txt points AI clients at /category/*; every catalogue category we carry is here
      const CATS = ['iphone', 'ipad', 'airpods', 'apple-watch', 'mac'];
      for (const cat of CATS)
      for (let page = 1; page <= 12; page++) {
        const html = await get(`https://ispace.am/category/${cat}${page > 1 ? '?page=' + page : ''}`);
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
        // one listing per catalogue category we carry; each returns its whole list in one response
        const MC = ['phones/138/0', 'tablets/139/0', 'smart-watches/141/175', 'headphone/146/156', 'computers/144/0'];
        const hits = [];
        for (const cat of MC) {
        const html = await get(`https://mobilecentre.am/category/${cat}/`);
        await sleep(DELAY_MS);
        if (!html) continue;
        const blocks = html.split('class="listitem"').slice(1);
        if (!blocks.length) continue;
        for (const b of blocks) {
          const url = (b.match(/href="(https:\/\/mobilecentre\.am\/product\/[^"]+)"/) || [])[1];
          const title = clean((b.match(/<h3[^>]*>([\s\S]{2,120}?)<\/h3>/) || [])[1] || '');
          // the credit-calculator link carries the price as a clean integer
          const price = Number((b.match(/data-price="(\d+)"/) || [])[1])
            || Number(((b.match(/Գին՝\s*<\/span>\s*([\d,]+)\s*դր/) || [])[1] || '').replace(/,/g, ''));
          if (!url || !title || !price || !safeUrl(url)) continue;
          const id = matchPhone(title + ' ' + url);
          if (!id) continue;
          hits.push({ id, price, title, url });
        }
        }
        // The listing h3 is just the model name. The product page carries the real SKU in
        // og:title - "iPhone 17 Pro 256GB Dual eSIM (Cosmic Orange)" - so capacity and colour
        // come from there instead of being left blank. Only matched products are fetched.
        for (const h of hits) {
          const page = await get(h.url); await sleep(DELAY_MS);
          const og = page && clean((page.match(/property="og:title" content="([^"]+)"/) || [])[1] || "");
          const SEP = " - ";                                    // og:title is "Mobile Centre. - <sku>"
          const title = og ? (og.includes(SEP) ? og.slice(og.indexOf(SEP) + SEP.length) : og) : h.title;
          const img = page && (page.match(/property="og:image" content="([^"]+)"/) || [])[1];
          out.push({ id: h.id, price: h.price, storage: storageOf(title) ?? storageOf(h.url), title, url: h.url,
            image: img && safeUrl(img) ? img : null, inStock: true });
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
      const PX = ['phones', 'tablets', 'watches', 'headphones', 'laptops'];
      for (const section of PX)
      for (let page = 1; page <= 12; page++) {
        const part = await get(`https://www.pixel.am/am/products/${section}?show=32&page=${page}`);
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
        // Phone pages carry a variant blob with every SKU price. Tablet, watch and laptop
        // pages do not - there the price is only in the <title>.
        if (!prices.length) {
          const ti = h.indexOf("<title>"), te = h.indexOf("</title>");
          const head = ti >= 0 && te > ti ? h.slice(ti, te) : "";
          const at = head.indexOf("Դրամ");
          if (at > 0) {
            let e = at - 1, s = e;
            const sep = " ,. ";
            while (s >= 0 && (sep.indexOf(head[s]) >= 0 || (head[s] >= "0" && head[s] <= "9"))) s--;
            const n = Number(head.slice(s + 1, e + 1).replace(/[^0-9]/g, ""));
            if (n > 1000) prices.push(n);
          }
        }
        if (!title || !prices.length) continue;
        const id = matchPhone(title + ' ' + u);
        const safe = safeUrl(u);
        if (!id || !safe) continue;
        // the 800_ render is the shot the shop displays, so its filename names the variant on show
        let shot = null;
        for (let at = h.indexOf('/uploads/products/'); at >= 0 && !shot; at = h.indexOf('/uploads/products/', at + 1)) {
          const from = h.lastIndexOf('http', at);
          if (from < 0) continue;
          let to = at;
          const STOP = String.fromCharCode(34, 39) + " >";   // quote, apostrophe, space, gt
          while (to < h.length && STOP.indexOf(h[to]) < 0) to++;
          const u2 = h.slice(from, to);
          if (u2.includes('800_')) shot = u2;
        }
        const color = shot ? colorFromImage(shot, (phoneById[id] || {}).colors) : null;
        out.push({ id, price: Math.min(...prices), storage: storageOf(title) ?? storageOf(u), title, url: safe,
          image: shot && safeUrl(shot) ? shot : null, color, inStock: true });
      }
      return out;
    }
  },


  ucom: {
    name: 'Ucom', site: 'https://shop.ucom.am', note: 'operator shop',
    async run() {
      const out = [];
      // robots.txt disallows every URL with a query string, so pagination is off limits and
      // each category contributes only its first page. Categories, not pages, give breadth.
      const CATS = ['smartphones', 'tablets', 'smart-watches-bands', 'headphones', 'apple-products'];
      for (const cat of CATS) {
        const html = await get(`https://shop.ucom.am/am/${cat}.html`);
        await sleep(DELAY_MS);
        if (!html) continue;
        // Magento product grid: one <a class="product-item-link"> and one data-price-amount each
        const blocks = html.split('product-item-info').slice(1);
        for (const b of blocks) {
          const hi = b.indexOf(D + "https://shop.ucom.am/am/");
          const url = hi < 0 ? null : b.slice(hi + 1, b.indexOf(D, hi + 1));
          const li = b.indexOf("product-item-link");
          const gt = li < 0 ? -1 : b.indexOf(">", li);
          const title = gt < 0 ? "" : clean(b.slice(gt + 1, b.indexOf("<", gt)));
          const pi = b.indexOf("data-price-amount=" + D);
          const price = pi < 0 ? 0 : Math.round(Number(b.slice(pi + 19, b.indexOf(D, pi + 19))));
          if (!url || !title || !price || !safeUrl(url)) continue;
          const id = matchPhone(title + ' ' + url);
          if (!id) continue;
          const mi = b.indexOf(D + "https://shop.ucom.am/media/catalog/");
          const img = mi < 0 ? null : b.slice(mi + 1, b.indexOf(D, mi + 1));
          out.push({ id, price, storage: storageOf(title) ?? storageOf(url), title, url,
            image: img && safeUrl(img) ? img : null, inStock: true });
        }
      }
      return out;
    }
  },

  telecom: {
    name: 'Telecom Armenia', site: 'https://www.telecomarmenia.am', note: 'operator shop',
    async run() {
      const out = [];
      // Listing pages carry no price at all, so each matched product page is fetched. The page
      // shows TWO numbers: e-shop__main-price is the cash price, product-start-price is the
      // monthly instalment. Reading the wrong one would list a phone at a fiftieth of its price.
      const CATS = ['smartphones', 'notebooks-and-tablets'];
      const seen = new Set();
      for (const cat of CATS) {
        const list = await get(`https://www.telecomarmenia.am/eshop/hy/${cat}/`);
        await sleep(DELAY_MS);
        if (!list) continue;
        const key = `/eshop/hy/${cat}/`;
        const urls = [];
        for (let at = list.indexOf(D + 'https://www.telecomarmenia.am' + key); at >= 0;
             at = list.indexOf(D + 'https://www.telecomarmenia.am' + key, at + 1)) {
          const u = list.slice(at + 1, list.indexOf(D, at + 1));
          if (u.length > key.length + 40 && !seen.has(u)) { seen.add(u); urls.push(u); }
        }
        for (const u of urls) {
          if (!matchPhone(u)) continue;                 // only fetch pages that can match
          const h = await get(u); await sleep(DELAY_MS);
          if (!h) continue;
          const title = clean((h.match(/<title>([^<|]*)/) || [])[1] || '');
          const price = priceAfter(h, 'e-shop__main-price');
          const id = matchPhone(title + ' ' + u);
          if (!id || !price || price < 5000 || !safeUrl(u)) continue;
          const img = (h.match(/property="og:image" content="([^"]+)"/) || [])[1];
          out.push({ id, price, storage: storageOf(title) ?? storageOf(u), title, url: u,
            image: img && safeUrl(img) ? img : null, inStock: true });
        }
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
        const price = priceAfter(html, 'class="price is-action"');
        const title = clean((html.match(/<title>([^<|]*)/) || [])[1] || '');
        if (!price || !title) continue;
        if (!safeUrl(u)) continue;
        out.push({ id, price, storage: storageOf(title) ?? storageOf(u), title, url: u, inStock: true,
          image: (html.match(/https:\/\/istore\.am\/[^"']*?\.(?:jpg|png|webp)/) || [])[0] || null });
      }
      return out;
    }
  },

  allsell: {
    name: 'AllSell', site: 'https://allsell.am', note: 'electronics retailer',
    async run() {
      // Magento, and its robots.txt names the sitemaps. Same shape as iStore: filter the sitemap
      // by matchPhone first so only pages that can be one of our products are fetched.
      const xml = await get('https://allsell.am/media/sitemap/en.xml');
      await sleep(DELAY_MS);
      const urls = [...xml.matchAll(/<loc>(https:\/\/allsell\.am\/en\/[^<]+)<\/loc>/g)].map(m => m[1]);
      const out = [], perPhone = {};
      for (const u of urls) {
        const id = matchPhone(u);
        if (!id) continue;
        perPhone[id] = (perPhone[id] || 0) + 1;
        if (perPhone[id] > 6) continue;               // cap requests per model
        const html = await get(u); await sleep(DELAY_MS);
        if (!html) continue;
        // data-price-amount is Magento's machine-readable final price, the same marker Ucom uses;
        // the visible span carries thousands separators and a currency sign.
        const pi = html.indexOf('data-price-amount=' + D);
        if (pi < 0) continue;
        const price = Math.round(Number(html.slice(pi + 19, html.indexOf(D, pi + 19))));
        const title = clean((html.match(/<title>([^<|]*)/) || [])[1] || '');
        if (!price || price < 5000 || !title || !safeUrl(u)) continue;
        // Magento marks a sold-out product with this schema.org value in the page head
        const inStock = !/OutOfStock/i.test(html.slice(0, 200000));
        const img = (html.match(/https:\/\/allsell\.am\/media\/catalog\/product\/[^"']*?\.(?:jpg|png|webp)/) || [])[0] || null;
        out.push({ id, price, storage: storageOf(title) ?? storageOf(u), title, url: u, inStock, image: img });
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
if (fs.existsSync(PRICES_FILE)) {
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
  let got = [], threw = false;
  try { got = await s.run(); } catch (e) { threw = true; console.warn('adapter failed:', e.message); }
  if (threw) {
    // keep what this shop had last night rather than dropping every one of its prices
    const kept = Object.values(prev.offers || {}).flat().filter(o => o.shop === key);
    for (const o of kept) (offers[o.id] ||= []).push(o);
    console.log(`kept ${kept.length} offer(s) from the previous run`);
    report.push({ shop: key, offers: kept.length, models: new Set(kept.map(o => o.id)).size, stale: true });
    continue;
  }
  // keep the cheapest offer per (phone, storage)
  const best = new Map();
  let dropped = 0;
  for (const raw of got) {
    const o = enrich(raw);
    // A price on a sold-out page is not an offer anyone can take, so it has no business on a
    // price-comparison site. Only an explicit false counts - adapters that cannot read stock
    // leave it undefined, and dropping those would empty the catalogue.
    if (o.inStock === false) { dropped++; continue; }
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
