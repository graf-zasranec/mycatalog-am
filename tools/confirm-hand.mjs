// Open the page a hand row names, read the shop's own price off it, and date the row.
//
//   node tools/confirm-hand.mjs            every shop, every unconfirmed row
//   node tools/confirm-hand.mjs ibolit     one shop
//   node tools/confirm-hand.mjs --dry      report, change nothing
//
// A hand row is a price somebody typed in. Until today the only thing that could ever date an
// offer was the crawl, and these are the rows the crawl does not reach - so the site said "not
// checked" against 815 real prices. This does for every shop what was done by hand for
// notebookcentre, yerevanmobile, zigzag and eldorado: fetch the url the row already carries,
// read the price the shop is asking now, write it and the date into data/listings.csv.
//
// It never invents a link. A row with no url, or one whose page is gone, is reported and left
// alone for a person - the answer to "this page 404s" is a decision, not a default.
import fs from 'node:fs';

const UA = 'ImpulseBot/0.1 (+price comparison; respects robots.txt)';
const DELAY = 700;
const dry = process.argv.includes('--dry');
const only = new Set(process.argv.slice(2).filter(a => !a.startsWith('--')));
// notebookcentre.am names anthropic-ai and Claude-Web in robots.txt with Disallow: / , so it is
// confirmed by a person opening the shop, never from here. Same list as tools/check-links.py.
const NEVER = ['notebookcentre.am'];
// These two answer 403 to any plain fetch - which is why they are read through scrapling by
// tools/{eldorado,zigzag}-fetch.py in the first place. Asking them from HERE filed 120 live
// pages as "gone", the same wrong conclusion the link checker used to reach. But that fetcher
// has already written the shop's own {url, title, price, inStock} to disk, so a row whose url is
// in it is answered with no second request at all - and dated the day the FETCHER ran, which is
// the day the price was really read. A row these two do not list is left alone, never asked.
const CACHED = [['eldorado.am', 'data/eldorado.json'], ['zigzag.am', 'data/zigzag.json']];
const noFetch = u => CACHED.some(([host]) => u.includes(host));
const tidy = u => String(u || '').trim().replace(/\/+$/, '').toLowerCase();
const TODAY = new Date().toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Every shop here is Magento, WooCommerce or a bespoke store, and between them they state the
// price in one of four ways. Tried in order of how specific each one is: a ld+json Product says
// which product it belongs to, a bare data-price-amount does not.
// A shop states 0 for something it has stopped selling, and the og / itemprop / Magento readers
// took that at face value - this was about to write 0 over real prices on Ucom's discontinued
// iPads and phones. Nothing in this catalogue costs under a thousand drams, so a figure below
// that is the page saying "no", not a price.
const FLOOR = 1000;

// pixel.am is the one shop here that states no price on the page at all. It ships every BUILD of
// a product as JSON instead - var PRODUCT_VARIANTS = [...] - each with its own price, sale price,
// stock, colour, memory and SIM card, and the visible figure is assembled from it in the browser.
// All four readers below came back empty on 268 pages for exactly this reason.
// Because the page prices each build separately, a pixel url shared by rows of different
// capacities is NOT the trap the guard further down exists for: this can answer each of them.
const BUILDS = ['pixel.am'];
// ucom is NOT on that list and must not be added. Its pages are Magento and do carry the whole
// configurable matrix, so reading them looks easy - but the page does not show a capacity's price
// until that capacity is chosen, and what it serves until then is the base build. Confirming from
// it wrote 642,900 over the iPhone 18 Pro's 743,900, 943,900 and 1,256,900, which is the same
// flattening two earlier runs were stopped for. Checked on the shop by the owner on 2026-09-21:
// you have to select 2TB before a 2TB price appears. Ucom's hand rows are right; leave them.
// Ucom is one of these: the price is CHOSEN on the page, not printed on it. There is no figure
// for this tool to read, and the one it can read is the wrong one. The useful question about such
// a row is the other one - does the link open the product it names, the page where a person picks
// the memory, the RAM and the colour? That is what CONFIG rows are checked for, and a row that
// passes is marked check=config so the site can stop calling a hand-read price "not checked".
const CONFIG = ['shop.ucom.am'];
const isConfig = u => CONFIG.some(h => u.includes(h));
// Ucom labels its options in whichever language it is asked for, and its English page is the one
// whose title this can read.
const readUrl = u => u.includes('shop.ucom.am') ? u.replace('/am/', '/en/').replace('/ru/', '/en/') : u;

// Does the page name the product the row names? The page names the FAMILY and the row names the
// build, so the containment runs that way round: "iPhone 18 Pro" belongs inside "Apple iPhone 18
// Pro 256GB Burgundy", never the reverse.
const NOISE = new Set(['the', 'and', 'with', 'for', 'new', 'gb', 'tb', 'mm', 'wi', 'fi', 'wifi',
  'cellular', 'esim', 'nano', 'sim', 'dual', 'black', 'white', 'silver', 'gold', 'blue', 'green',
  'red', 'pink', 'grey', 'gray', 'purple', 'violet', 'orange', 'yellow', 'titanium', 'graphite',
  'midnight', 'starlight', 'space', 'inch', 'awesome', 'phantom', 'cosmic', 'jetblack', 'shadow',
  'series', 'smartphone', 'phone', 'buy', 'price', 'shop', 'ucom', 'am']);
// Digits are kept: "AirPods 4" is not "AirPods Pro 3", and dropping the 4 left one word to judge
// by. What goes is the build - a capacity, a memory size - because the page names the family.
const nwords = z => [...new Set(String(z).toLowerCase().match(/[a-z0-9]+/g) || [])]
  .filter(w => w.length > 1 && !NOISE.has(w) && !/^\d+(gb|tb|mb)$/.test(w));
function namesTheProduct(html, title) {
  const h1 = (html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i) || [])[1] || '';
  const tt = (html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i) || [])[1] || '';
  const page = nwords((h1 + ' ' + tt).replace(/<[^>]+>/g, ' '));
  if (!page.length) return false;
  const mine = nwords(title);
  if (!mine.length) return false;
  // Either side may be the fuller one. Ucom writes "Yandex Smart Speaker Station Mini" where the
  // row says "Yandex Station Mini", and "iPhone 18 Pro" where the row says "Apple iPhone 18 Pro
  // 256GB Burgundy". One of the two has to sit inside the other; which one does not matter.
  const shared = page.filter(w => mine.includes(w)).length;
  const bare = z => String(z).toLowerCase().replace(/[^a-z0-9]/g, '');
  return Math.max(shared / page.length, shared / mine.length) >= 0.8
    || bare(title).includes(bare(page.join('')));
}
const capOf = s => {
  const m = String(s || '').match(/([\d.]+)\s*(TB|GB)/i);
  return m ? Math.round(parseFloat(m[1]) * (/tb/i.test(m[2]) ? 1024 : 1)) : null;
};
function buildPrice(html, f) {
  if (!BUILDS.some(h => f[4].includes(h))) return null;
  let vs = null;
  const m = html.match(/var\s+PRODUCT_VARIANTS\s*=\s*(\[[\s\S]*?\]);/);
  if (m) {
    try {
      vs = JSON.parse(m[1]).map(v => {
        const p = Object.fromEntries((v.properties || [])
          .map(x => [String(x.title).toLowerCase().trim(), String(x.valueTitle || '').trim()]));
        // pixel quotes TWO prices and "price" is the dearer one. On the Galaxy Buds 2 page the
        // JSON says price 47000 / wholesalePrice 42000, and the page itself prints "47,000" as
        // the credit figure with "Գինը: 42,000" - the cash price - beside it. Our own row says
        // 42,000. So wholesalePrice is not a trade price despite the name: it is what a person
        // pays, which is also the figure this catalogue quotes everywhere.
        // Reading "price" instead would have raised 73 pixel offers by about a tenth each,
        // uniformly, which is what gave it away - a whole shop does not reprice by 10% overnight.
        const price = Math.round(Number(v.wholesalePrice) > 0 ? Number(v.wholesalePrice)
          : Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(v.price));
        return { price, stock: Number(v.quantity) > 0, cap: capOf(p.memory), color: p.color || '' };
      }).filter(v => v.price >= FLOOR);
    } catch { }
  }
  // A product sold in one build only ships no variant array. Those pages carry both figures too:
  // .actual-price holds the CREDIT price and .cash-price the cash one - the PS5 vertical stand
  // reads "Credit: 32,000 AMD / Price: 29,000 AMD", and our row says 29,000. Take the cash one.
  // og:title is no good either: it carries a rounded "price from" that is sometimes days stale.
  if (!vs || !vs.length) {
    const a = html.match(/class="[^"]*cash-price[^"]*"[^>]*>([\s\S]{0,160}?)<\/(?:div|span|p)>/i);
    const n = a && Number((String(a[1]).replace(/<[^>]+>/g, ' ').match(/[\d, ]{4,}/g) || [''])
      .map(x => Number(x.replace(/[^\d]/g, ''))).filter(x => x >= FLOOR)[0] || 0);
    vs = n >= FLOOR ? [{ price: n, stock: true, cap: null, color: '', only: true }] : [];
  }
  if (!vs.length) return null;
  const cap = Number(f[2]) || null, col = (f[3] || '').trim().toLowerCase();
  let hit = vs.filter(v => cap == null || v.cap === cap);
  if (col) { const c = hit.filter(v => v.color.toLowerCase() === col); if (c.length) hit = c; }
  if (!hit.length) return null;
  // Several builds that all cost the same are not an ambiguity - there is nothing to disagree
  // about. Several at different prices are, and this tool does not guess between them.
  if (hit.length > 1 && new Set(hit.map(v => v.price)).size !== 1) return null;
  return { price: hit[0].price, how: hit[0].only ? 'pixel-cash' : 'pixel-builds', stock: hit[0].stock, only: !!hit[0].only };
}

function priceOf(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = n => {
        if (!n || typeof n !== 'object') return null;
        if (Array.isArray(n)) { for (const x of n) { const r = walk(x); if (r) return r; } return null; }
        if (/product/i.test(n['@type'] || '') && n.offers) {
          const o = Array.isArray(n.offers) ? n.offers[0] : n.offers;
          const p = Number(o.price ?? o.lowPrice);
          if (p >= FLOOR) return { price: Math.round(p), how: 'ld+json', stock: /InStock/i.test(String(o.availability || '')) };
        }
        for (const v of Object.values(n)) { const r = walk(v); if (r) return r; }
        return null;
      };
      const r = walk(JSON.parse(m[1].trim()));
      if (r) return r;
    } catch { }
  }
  let m = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([\d.]+)"/i)
       || html.match(/<meta[^>]+content="([\d.]+)"[^>]+property="product:price:amount"/i);
  if (m && +m[1] >= FLOOR) return { price: Math.round(+m[1]), how: 'og-meta', stock: !/out-of-stock|OutOfStock/i.test(html) };
  m = html.match(/itemprop="price"[^>]*content="([\d.]+)"/i);
  if (m && +m[1] >= FLOOR) return { price: Math.round(+m[1]), how: 'itemprop', stock: !/out-of-stock|OutOfStock/i.test(html) };
  // Magento prints dozens of these on one page for its recommendations, so take the one inside
  // the main product block and nowhere else.
  const main = html.match(/product-info-main([\s\S]{0,8000})/i);
  if (main) {
    const f = main[1].match(/data-price-amount="([\d.]+)"[^>]*data-price-type="finalPrice"/i)
           || main[1].match(/data-price-amount="([\d.]+)"/i);
    if (f && +f[1] >= FLOOR) return { price: Math.round(+f[1]), how: 'magento-main', stock: !/out-of-stock/i.test(html) };
  }
  return null;
}

// A hand row can carry the wrong url, and then this tool copies a stranger's price onto it.
// Thirteen such rows were stopped by the move guard further down - seven products all pointing
// at one ASUS all-in-one, three HONOR Magic8 Pro rows pointing at an X9d. Eight more moved by
// less than half and would have gone straight in: a Xiaomi TV priced from a HONOR laptop, a POCO
// phone from a Redmi tablet, Sony PULSE earbuds from a JBL Pulse speaker. So when the shop's own
// listing names one brand and the row names another, neither is confirmed and both are reported.
// poco and redmi are model families rather than brands in data/phones.json, but they are how a
// shop writes the title, and telling a POCO from a Redmi is exactly what this has to do.
const BRANDS = [...new Set(JSON.parse(fs.readFileSync('data/phones.json', 'utf8'))
  .map(p => String(p.brand || '').toLowerCase()).filter(b => b.length > 2)), 'poco', 'redmi'];
const brandsIn = t => BRANDS.filter(b => String(t || '').toLowerCase().includes(b));

const CACHE = new Map();
for (const [host, file] of CACHED) {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { console.log(`no ${file} yet - ${host} rows stay unconfirmed`); continue; }
  const day = fs.statSync(file).mtime.toISOString().slice(0, 10);
  let n = 0;
  for (const c of list) {
    const price = Math.round(Number(c && c.price));
    if (!c || !c.url || !(price >= FLOOR)) continue;
    CACHE.set(tidy(c.url), { price, how: host.split('.')[0] + '-listing', stock: c.inStock !== false, day, title: c.title || '' });
    n++;
  }
  console.log(`${file}: ${n} listing(s), read ${day}`);
}

const rows = fs.readFileSync('data/listings.csv', 'utf8').split('\n');
const head = rows[0];
const body = rows.slice(1).filter(l => l.trim()).map(l => l.split(','));
let todo = body.filter(f => f.length > 5 && f[4] && /^https?:/.test(f[4])
  && !/^\d{4}-\d{2}-\d{2}$/.test((f[8] || '').trim())
  && (!only.size || only.has(f[0]))
  && !NEVER.some(h => f[4].includes(h))
  // a row at one of the two cached shops is only reachable if the cache happens to list it
  && (!noFetch(f[4]) || CACHE.has(tidy(f[4]))));

// A page that sells every capacity from one url states ONE price, and it is the cheapest one.
// Ucom serves the iPhone 18 Pro's 256GB, 512GB, 1TB and 2TB from /iphone18pro.html at 642,900;
// confirming all four against it would have flattened 743,900, 943,900 and 1,256,900 to the
// base price and called the result verified.
// Capacity was the wrong thing to key on, though - it only caught the Ucom shape. Eleven rows
// point at one ASUS all-in-one with eleven different prices between them, and they all carry no
// capacity at all, so that guard let them through. The evidence that matters is simply this: if
// the rows themselves disagree about what this url costs, one page cannot settle any of them.
const configs = new Map();
for (const f of todo) {
  const k = f[0] + '|' + f[4];
  (configs.get(k) || configs.set(k, new Set()).get(k)).add((f[2] || '') + '/' + (f[6] || '') + '/' + (f[5] || ''));
}
const shared = todo.filter(f => configs.get(f[0] + '|' + f[4]).size > 1);
const sharedKeys = new Set(shared.map(f => f[0] + '|' + f[4]));
if (sharedKeys.size) console.log(`${shared.length} row(s) share ${sharedKeys.size} url(s) but disagree on the capacity or the price - one page cannot settle them, skipped`);
// A page that prices each BUILD separately is not the trap this guard exists for - it can answer
// each row on its own terms. But only the page can say whether it does that, so those rows stay
// in the run and are judged after it has been read, further down.
todo = todo.filter(f => !sharedKeys.has(f[0] + '|' + f[4]) || BUILDS.some(h => f[4].includes(h)));
// ...and a CONFIG shop's rows are never skipped for that reason either: a url shared by every
// capacity is exactly what a configurator looks like, and the question asked of it is the link,
// not the price.
for (const f of body)
  if (f.length > 5 && f[4] && /^https?:/.test(f[4]) && isConfig(f[4])
      && (!only.size || only.has(f[0])) && !(f[7] || '').trim() && !todo.includes(f)) todo.push(f);

console.log(`${todo.length} row(s) to confirm${only.size ? ' at ' + [...only].join(', ') : ''}${dry ? '  (dry)' : ''}\n`);
let ok = 0, moved = 0, gone = [], nop = [], how = {}, wild = [], wrongLink = [], disputed = [], linked = 0;
for (let i = 0; i < todo.length; i++) {
  const f = todo[i];
  let p = CACHE.get(tidy(f[4])) || null;
  if (p && p.title) {
    const mine = brandsIn(f[1]), theirs = brandsIn(p.title);
    if (mine.length && theirs.length && !mine.some(b => theirs.includes(b))) {
      wrongLink.push([f[0], f[1], p.title, f[4]]);
      continue;
    }
  }
  if (!p) {
    if (noFetch(f[4])) continue;          // belt and braces: these two are never asked directly
    let html = '';
    try {
      const r = await fetch(readUrl(f[4]), { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
      if (r.ok) html = await r.text(); else gone.push([f[0], f[1], f[4], 'HTTP ' + r.status]);
    } catch (e) { gone.push([f[0], f[1], f[4], e.name]); }
    await sleep(DELAY);
    if (!html) continue;
    // A configurator states no price to read. Check the link instead and mark the row.
    if (isConfig(f[4])) {
      if (namesTheProduct(html, f[1])) { f.marked = true; linked++; }
      else wrongLink.push([f[0], f[1], '(the page does not name it)', f[4]]);
      continue;
    }
    p = buildPrice(html, f) || priceOf(html);
    // This row was kept past the disputed-url guard only because its shop prices builds
    // separately. If the page turned out to carry one figure for everything, it cannot settle a
    // url that five different Dyson colours point at - five rows, five prices, one page.
    if (p && p.only && sharedKeys.has(f[0] + '|' + f[4])) { disputed.push([f[0], f[1], f[4]]); continue; }
    if (!p) { nop.push([f[0], f[1], f[4]]); continue; }
  }
  how[p.how] = (how[p.how] || 0) + 1;
  // A price that moves by more than half is either a real sale or a page that is not about this
  // row, and from here the two look identical. Reported, never applied: two runs today were
  // stopped for writing exactly this kind of change, and a wrong price is worse than an undated one.
  const was = Number(f[5]) || 0;
  if (was && (p.price > was * 1.6 || p.price < was * 0.5)) {
    wild.push([f[0], f[1], was, p.price, f[4]]);
    continue;
  }
  if (was !== p.price) { moved++; console.log(`  ${f[0].padEnd(13)} ${f[1].slice(0, 40).padEnd(42)} ${f[5]} -> ${p.price}`); }
  while (f.length < 9) f.push('');
  f[5] = String(p.price); f[8] = p.day || TODAY;
  ok++;
  if (i % 50 === 49) console.log(`  ... ${i + 1}/${todo.length}`);
}
// Re-read the file and apply only what this run confirmed, keyed by the row's own shop and url.
// Holding the whole file in memory for a 700-row pass and writing it back at the end silently
// reverts anything added meanwhile - a new shop's 262 rows went in during this very run and
// would have vanished the moment it finished.
if (!dry) {
  const changed = new Map();
  for (const f of todo) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(f[8] || '')) changed.set(f[0] + '|' + f[4], [f[5], f[8], null]);
    else if (f.marked) changed.set(f[0] + '|' + f[4], [null, null, 'config']);
  }
  const now = fs.readFileSync('data/listings.csv', 'utf8').split('\n');
  const merged = now.map((l, i) => {
    if (!i || !l.trim()) return l;
    const f = l.split(',');
    const c = f.length > 5 && changed.get(f[0] + '|' + f[4]);
    if (!c) return l;
    while (f.length < 9) f.push('');
    if (c[0] != null) { f[5] = c[0]; f[8] = c[1]; }
    if (c[2] && !(f[7] || '').trim()) f[7] = c[2];
    return f.join(',');
  });
  fs.writeFileSync('data/listings.csv', merged.filter(l => l.trim()).join('\n') + '\n');
  console.log(`merged ${changed.size} row(s) into data/listings.csv as it stands now`);
}
console.log(`\nconfirmed ${ok}, of which ${moved} had moved on the shop's own page`);
if (linked) console.log(`${linked} row(s) at a shop that prices by configuration: the link opens the product they name, so the price a person read stands and the site can stop calling it unchecked`);
console.log('read from:', Object.entries(how).map(([k, v]) => `${k} ${v}`).join(', ') || 'nothing');
if (nop.length) { console.log(`\n${nop.length} page(s) with no price this could read:`); for (const n of nop.slice(0, 15)) console.log('  ', n[0].padEnd(13), n[1].slice(0, 38).padEnd(40), n[2].slice(0, 60)); }
if (wild.length) { console.log(`
${wild.length} price(s) moved too far to apply without a person looking:`); for (const w of wild.slice(0, 20)) console.log('  ', w[0].padEnd(13), String(w[1]).slice(0, 36).padEnd(38), `${w[2]} -> ${w[3]}`, w[4].slice(0, 46)); }
if (disputed.length) console.log(`
${disputed.length} row(s) share a url with rows that disagree about its price, and the page turned out to carry only one figure - left alone`);
if (wrongLink.length) {
  console.log(`\n${wrongLink.length} row(s) whose link opens a different product - price left alone, the LINK needs fixing:`);
  for (const w of wrongLink) console.log('  ', w[0].padEnd(10), w[1].slice(0, 40).padEnd(42), '->', w[2].slice(0, 40).padEnd(42), w[3].slice(0, 58));
}
// A shop turning the checker away is not a missing page, and calling it one throws away a real
// price on a live product. 403, 401 and 429 are the shop saying no to US.
const refused = gone.filter(g => /40[13]|429/.test(String(g[3])));
const missing = gone.filter(g => !/40[13]|429/.test(String(g[3])));
if (refused.length) console.log(`
${refused.length} page(s) refused this checker - the page is there, it will not answer us`);
if (missing.length) { console.log(`
${missing.length} page(s) gone - a person decides what happens to these:`); for (const g of missing.slice(0, 15)) console.log('  ', g[0].padEnd(13), g[1].slice(0, 34).padEnd(36), g[3], g[2].slice(0, 52)); }
