// Offers whose shop page names a different model than the product they are filed under.
// Found 2026-09-25: the Zenbook 14 UX3405CA carried UM3402YA, UM3406HA and UX3405MA prices.
// When a product's name holds a model code (UX3405CA, 83DS0056US, QE65S95F...), the offer's
// url or title must hold it too. A report, not a gate: fix by pinning the url in data/links.csv
// to the right product, or to "-" when we do not carry it.
//   node tools/wrong-links.mjs
import fs from 'node:fs';

const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const O = JSON.parse(fs.readFileSync('data/prices.json', 'utf8')).offers;
const norm = s => { try { s = decodeURIComponent(s); } catch { } return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
export const codes = p => `${p.name}`.split(/[\s_(),/]+/).map(norm)
  .filter(t => t.length >= 5 && /\d/.test(t) && /[a-z]/.test(t) && !/^\d+(gb|tb|inch|mm|hz)$/.test(t) && !/^(19|20)\d\d[a-z]*$/.test(t));

const bad = [];
for (const p of P) {
  const c = codes(p);
  if (!c.length) continue;
  for (const o of O[p.id] || []) {
    const hay = norm(o.url) + norm(o.title || '');
    if (!c.some(k => hay.includes(k))) bad.push(`${p.id.padEnd(44)} ${o.shop.padEnd(13)} ${String(o.price).padStart(8)}  ${(o.title || '').slice(0, 60)}`);
  }
}
console.log(`${bad.length} offer(s) whose page does not name the product's model code`);
for (const l of bad) console.log('  ' + l);

// ...and a product with no code in its name ("Beats Studio") needs the other tell: a price nothing
// else of that product comes near. A Mac Studio M5 Max at 1,599,000 sat under Beats Studio.
const odd = [];
for (const p of P) {
  const l = (O[p.id] || []).map(o => o.price).filter(n => n > 0).sort((a, b) => a - b);
  if (l.length < 3) continue;
  const med = l[l.length >> 1];
  for (const o of O[p.id]) if (o.price > med * 2.5 || o.price < med * 0.4)
    odd.push(`${p.id.padEnd(44)} ${o.shop.padEnd(13)} ${String(o.price).padStart(8)} (median ${med})  ${(o.title || '').slice(0, 50)}`);
}
console.log(`${odd.length} offer(s) priced far from the rest of their product`);
for (const l of odd) console.log('  ' + l);

console.assert(codes({ name: 'Zenbook 14 UX3405CA OLED' }).join() === 'ux3405ca');
console.assert(codes({ name: 'iPhone 17 Pro 256GB' }).length === 0);
