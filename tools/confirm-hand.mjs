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
const TODAY = new Date().toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Every shop here is Magento, WooCommerce or a bespoke store, and between them they state the
// price in one of four ways. Tried in order of how specific each one is: a ld+json Product says
// which product it belongs to, a bare data-price-amount does not.
function priceOf(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = n => {
        if (!n || typeof n !== 'object') return null;
        if (Array.isArray(n)) { for (const x of n) { const r = walk(x); if (r) return r; } return null; }
        if (/product/i.test(n['@type'] || '') && n.offers) {
          const o = Array.isArray(n.offers) ? n.offers[0] : n.offers;
          const p = Number(o.price ?? o.lowPrice);
          if (p > 0) return { price: Math.round(p), how: 'ld+json', stock: /InStock/i.test(String(o.availability || '')) };
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
  if (m) return { price: Math.round(+m[1]), how: 'og-meta', stock: !/out-of-stock|OutOfStock/i.test(html) };
  m = html.match(/itemprop="price"[^>]*content="([\d.]+)"/i);
  if (m) return { price: Math.round(+m[1]), how: 'itemprop', stock: !/out-of-stock|OutOfStock/i.test(html) };
  // Magento prints dozens of these on one page for its recommendations, so take the one inside
  // the main product block and nowhere else.
  const main = html.match(/product-info-main([\s\S]{0,8000})/i);
  if (main) {
    const f = main[1].match(/data-price-amount="([\d.]+)"[^>]*data-price-type="finalPrice"/i)
           || main[1].match(/data-price-amount="([\d.]+)"/i);
    if (f) return { price: Math.round(+f[1]), how: 'magento-main', stock: !/out-of-stock/i.test(html) };
  }
  return null;
}

const rows = fs.readFileSync('data/listings.csv', 'utf8').split('\n');
const head = rows[0];
const body = rows.slice(1).filter(l => l.trim()).map(l => l.split(','));
let todo = body.filter(f => f.length > 5 && f[4] && /^https?:/.test(f[4])
  && !/^\d{4}-\d{2}-\d{2}$/.test((f[8] || '').trim())
  && (!only.size || only.has(f[0]))
  && !NEVER.some(h => f[4].includes(h)));

// A page that sells every capacity from one url states ONE price, and it is the cheapest one.
// Ucom serves the iPhone 18 Pro's 256GB, 512GB, 1TB and 2TB from /iphone18pro.html at 642,900;
// confirming all four against it would have flattened 743,900, 943,900 and 1,256,900 to the
// base price and called the result verified. A url shared by rows that differ in capacity or
// memory cannot settle any of them, so none of them is touched.
const configs = new Map();
for (const f of todo) {
  const k = f[0] + '|' + f[4];
  (configs.get(k) || configs.set(k, new Set()).get(k)).add((f[2] || '') + '/' + (f[6] || ''));
}
const shared = todo.filter(f => configs.get(f[0] + '|' + f[4]).size > 1);
const sharedKeys = new Set(shared.map(f => f[0] + '|' + f[4]));
if (sharedKeys.size) console.log(`${shared.length} row(s) share ${sharedKeys.size} url(s) across different capacities - one page cannot price them, skipped`);
todo = todo.filter(f => !sharedKeys.has(f[0] + '|' + f[4]));

console.log(`${todo.length} row(s) to confirm${only.size ? ' at ' + [...only].join(', ') : ''}${dry ? '  (dry)' : ''}\n`);
let ok = 0, moved = 0, gone = [], nop = [], how = {};
for (let i = 0; i < todo.length; i++) {
  const f = todo[i];
  let html = '';
  try {
    const r = await fetch(f[4], { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
    if (r.ok) html = await r.text(); else gone.push([f[0], f[1], f[4], 'HTTP ' + r.status]);
  } catch (e) { gone.push([f[0], f[1], f[4], e.name]); }
  await sleep(DELAY);
  if (!html) continue;
  const p = priceOf(html);
  if (!p) { nop.push([f[0], f[1], f[4]]); continue; }
  how[p.how] = (how[p.how] || 0) + 1;
  if (+f[5] !== p.price) { moved++; console.log(`  ${f[0].padEnd(13)} ${f[1].slice(0, 40).padEnd(42)} ${f[5]} -> ${p.price}`); }
  while (f.length < 9) f.push('');
  f[5] = String(p.price); f[8] = TODAY;
  ok++;
  if (i % 50 === 49) console.log(`  ... ${i + 1}/${todo.length}`);
}
// Re-read the file and apply only what this run confirmed, keyed by the row's own shop and url.
// Holding the whole file in memory for a 700-row pass and writing it back at the end silently
// reverts anything added meanwhile - a new shop's 262 rows went in during this very run and
// would have vanished the moment it finished.
if (!dry) {
  const changed = new Map();
  for (const f of todo) if (/^\d{4}-\d{2}-\d{2}$/.test(f[8] || '')) changed.set(f[0] + '|' + f[4], [f[5], f[8]]);
  const now = fs.readFileSync('data/listings.csv', 'utf8').split('\n');
  const merged = now.map((l, i) => {
    if (!i || !l.trim()) return l;
    const f = l.split(',');
    const c = f.length > 5 && changed.get(f[0] + '|' + f[4]);
    if (!c) return l;
    while (f.length < 9) f.push('');
    f[5] = c[0]; f[8] = c[1];
    return f.join(',');
  });
  fs.writeFileSync('data/listings.csv', merged.filter(l => l.trim()).join('\n') + '\n');
  console.log(`merged ${changed.size} row(s) into data/listings.csv as it stands now`);
}
console.log(`\nconfirmed ${ok}, of which ${moved} had moved on the shop's own page`);
console.log('read from:', Object.entries(how).map(([k, v]) => `${k} ${v}`).join(', ') || 'nothing');
if (nop.length) { console.log(`\n${nop.length} page(s) with no price this could read:`); for (const n of nop.slice(0, 15)) console.log('  ', n[0].padEnd(13), n[1].slice(0, 38).padEnd(40), n[2].slice(0, 60)); }
if (gone.length) { console.log(`\n${gone.length} page(s) gone - a person decides what happens to these:`); for (const g of gone.slice(0, 15)) console.log('  ', g[0].padEnd(13), g[1].slice(0, 34).padEnd(36), g[3], g[2].slice(0, 52)); }
