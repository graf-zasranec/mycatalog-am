// Statistics for the catalogue health dashboard, and the list of prices nobody can stand behind.
//
//   node tools/dash.mjs        writes .dash.json
//   node tools/dash.mjs --doubts   prints the doubtful prices as text
//
// Everything here is counted off data/, never asserted. A number this file cannot derive is
// absent rather than estimated - the point of the dashboard is to say what is actually known.
import fs from 'node:fs';

const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const DATA = rd('data/phones.json');
const P = rd('data/prices.json');
const HIST = fs.existsSync('data/history.json') ? rd('data/history.json') : { points: {} };
const IMG = fs.existsSync('data/pageonly.json') ? rd('data/pageonly.json') : {};

const byId = id => DATA.find(p => p.id === id);
const cat = p => p.category || 'phone';
const name = p => `${p.brand} ${p.name}`;
const all = Object.values(P.offers || {}).flat();
const TODAY = new Date().toISOString().slice(0, 10);
const daysAgo = d => Math.round((Date.parse(TODAY) - Date.parse(d)) / 864e5);

// Shops this crawler will never read, because their robots.txt names ClaudeBot with Disallow: /.
// A price recorded from one of them is somebody's own observation and can only be rechecked by
// a person standing in front of the shelf.
const BLOCKED = new Set(Object.keys(P.excluded || {}).map(h => h.replace(/\.(am|mobi)$/, '')));
const blockedShop = s => BLOCKED.has(s) || BLOCKED.has(s.replace(/[^a-z]/g, ''));

/* ---------- photographs ---------- */
const cutDir = 'images/cut';
const cuts = fs.existsSync(cutDir) ? fs.readdirSync(cutDir).filter(f => /\.(webp|png)$/i.test(f)) : [];
// images/cut/<id>__main.webp is the product's own shot; every other __<colour> is a swatch
const mainShots = new Set(cuts.filter(f => f.endsWith('__main.webp')).map(f => f.replace('__main.webp', '')));
const colourShots = cuts.filter(f => f.includes('__') && !f.endsWith('__main.webp')).length;

/* ---------- the doubts ---------- */
const doubts = { unverifiable: [], hand: [], single: [], none: [], outlier: [], unstated: [], stale: [] };
const med = a => { const v = [...a].sort((x, y) => x - y); return v[v.length >> 1]; };

for (const p of DATA) {
  const offs = P.offers[p.id] || [];
  if (!offs.length) { doubts.none.push({ id: p.id, name: name(p), cat: cat(p), price: p.priceAmd }); continue; }
  if (new Set(offs.map(o => o.shop)).size === 1)
    doubts.single.push({ id: p.id, name: name(p), shop: offs[0].shop, price: offs[0].price, hand: !!offs[0].seeded });

  // An outlier is only meaningful against a consensus: three shops quoting the same
  // configuration. Two prices that disagree are a disagreement, not an error.
  const groups = {};
  for (const o of offs) (groups[o.storage ?? '?'] ||= []).push(o);
  for (const [size, g] of Object.entries(groups)) {
    if (g.length < 3) continue;
    const m = med(g.map(o => o.price));
    for (const o of g) {
      const off = Math.abs(o.price - m) / m;
      if (off >= 0.35) doubts.outlier.push({ id: p.id, name: name(p), size, shop: o.shop, price: o.price, median: m, off: +(off * 100).toFixed(0), url: o.url });
    }
  }
  // A price with no capacity against a product sold in several is a price for something
  // unspecified - it cannot be compared with the others and it cannot be checked.
  const sizes = new Set((p.variants || []).map(v => v.storage).filter(v => v != null));
  if (sizes.size > 1) for (const o of offs) if (o.storage == null)
    doubts.unstated.push({ id: p.id, name: name(p), shop: o.shop, price: o.price, url: o.url });
}
for (const o of all) {
  const p = byId(o.id);
  const row = { id: o.id, name: p ? name(p) : o.id, shop: o.shop, price: o.price, title: o.title, url: o.url };
  if (blockedShop(o.shop)) doubts.unverifiable.push(row);
  else if (o.seeded) doubts.hand.push(row);
  else if (o.seen && daysAgo(o.seen) > 14) doubts.stale.push({ ...row, seen: o.seen, days: daysAgo(o.seen) });
}

/* ---------- the dashboard's own figures ---------- */
const cats = [...new Set(DATA.map(cat))];
const out = {
  generated: new Date().toISOString(),
  products: DATA.length,
  withOffer: DATA.filter(p => (P.offers[p.id] || []).length).length,
  offers: all.length,
  shops: Object.keys(P.shops || {}).length,
  photos: { main: DATA.filter(p => mainShots.has(p.id) || IMG[p.id]).length, colour: colourShots },
  freshness: { dated: all.filter(o => o.seen).length, hand: all.filter(o => o.seeded).length },
  stock: { inStock: all.filter(o => o.inStock === true).length, out: all.filter(o => o.inStock === false).length,
           unknown: all.filter(o => o.inStock === undefined).length },
  sim: { esim: all.filter(o => o.esim === true).length, tray: all.filter(o => o.esim === false).length,
         unstated: all.filter(o => o.esim === undefined).length },
  historyDays: new Set(Object.values(HIST.points || {}).flat().map(pt => pt.d || pt.day)).size,
  byShop: Object.keys(P.shops || {}).map(k => ({
    shop: k, offers: all.filter(o => o.shop === k).length,
    models: new Set(all.filter(o => o.shop === k).map(o => o.id)).size,
    hand: all.filter(o => o.shop === k && o.seeded).length,
  })).filter(r => r.offers).sort((a, b) => b.offers - a.offers),
  byCat: cats.map(c => {
    const items = DATA.filter(p => cat(p) === c);
    return { cat: c, n: items.length, priced: items.filter(p => (P.offers[p.id] || []).length).length,
             photos: items.filter(p => mainShots.has(p.id) || IMG[p.id]).length };
  }).sort((a, b) => b.n - a.n),
  noPrice: DATA.filter(p => !(P.offers[p.id] || []).length).map(p => p.id),
  doubts: Object.fromEntries(Object.entries(doubts).map(([k, v]) => [k, v.length])),
};
fs.writeFileSync('.dash.json', JSON.stringify(out, null, 1));
fs.writeFileSync('.doubts.json', JSON.stringify(doubts, null, 1));

if (process.argv.includes('--doubts')) {
  const shop = s => (P.shops[s] || {}).name || s;
  const title = (h, n) => console.log(`\n== ${h} (${n}) ==`);
  title('Can never be checked by this crawler - robots.txt says no', doubts.unverifiable.length);
  for (const r of doubts.unverifiable) console.log(`  ${shop(r.shop).padEnd(16)} ${String(r.price).padStart(9)}  ${r.name}`);
  title('Recorded by hand, and the crawl did not confirm it', doubts.hand.length);
  for (const r of doubts.hand) console.log(`  ${shop(r.shop).padEnd(16)} ${String(r.price).padStart(9)}  ${r.name}`);
  title('One shop only - nothing to check it against', doubts.single.length);
  for (const r of doubts.single) console.log(`  ${shop(r.shop).padEnd(16)} ${String(r.price).padStart(9)}  ${r.name}${r.hand ? '  [by hand]' : ''}`);
  title('No price at all - the catalogue is showing an estimate', doubts.none.length);
  for (const r of doubts.none) console.log(`  ${String(r.price).padStart(9)}  ${r.name} (${r.cat})`);
  title('Far from what everyone else charges', doubts.outlier.length);
  for (const r of doubts.outlier) console.log(`  ${shop(r.shop).padEnd(16)} ${String(r.price).padStart(9)} vs ${r.median} (${r.off}% off)  ${r.name} ${r.size}`);
  title('Price with no capacity stated, on a product sold in several', doubts.unstated.length);
  for (const r of doubts.unstated) console.log(`  ${shop(r.shop).padEnd(16)} ${String(r.price).padStart(9)}  ${r.name}`);
  title('Last read more than a fortnight ago', doubts.stale.length);
  for (const r of doubts.stale) console.log(`  ${shop(r.shop).padEnd(16)} ${String(r.price).padStart(9)}  ${r.name}  (${r.days} days)`);
}
console.log(`\n.dash.json + .doubts.json written - ${Object.values(doubts).reduce((n, v) => n + v.length, 0)} price(s) worth a second look`);
