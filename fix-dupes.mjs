// One-off (2026-10-17, Claude): duplicate/mis-grouped fixes after the LikeMobile add.
// 1) apple-airpods-3rd-generation duplicated apple-tws-bluetooth-headsets-3rd-generation: merge into the old id.
// 2) Emberton II / "Emberton 2" offers sat on marshall-emberton (gen 1): move to marshall-emberton-ii.
// 3) iBolit "Revolve+ II Silver" (-silver-2 URL, checked live) sat on bose-soundlink-revolve-ii: move to the plus.
// Moves prices.json offers and the matching data/links.csv pins (url -> id). Run from the repo root.
import fs from 'node:fs';
const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8')), PR = JSON.parse(fs.readFileSync('data/prices.json', 'utf8'));
const LM = JSON.parse(fs.readFileSync('data/likemobile-map.json', 'utf8')), M = JSON.parse(fs.readFileSync('data/merged.json', 'utf8'));
const byId = id => P.find(p => p.id === id);
const moved = new Map(); // url -> new id
const move = (from, to, test) => {
  const keep = [];
  for (const o of PR.offers[from] || []) if (test(o)) { (PR.offers[to] ||= []).push({ ...o, id: to }); moved.set(o.url, to); } else keep.push(o);
  PR.offers[from] = keep;
};
// 1) AirPods 3
const OLD = 'apple-tws-bluetooth-headsets-3rd-generation', NEW = 'apple-airpods-3rd-generation';
move(NEW, OLD, () => true); delete PR.offers[NEW];
Object.assign(byId(OLD), { name: 'AirPods (3rd generation)' });
byId(OLD).aliases = [...new Set([...(byId(OLD).aliases || []), ...byId(NEW).aliases])];
P.splice(P.findIndex(p => p.id === NEW), 1);
for (const [u, v] of Object.entries(LM)) if (v.id === NEW) v.id = OLD;
M[NEW] = OLD;
fs.rmSync(`images/cut/${NEW}__main.webp`, { force: true });
// 2) Emberton II
move('marshall-emberton', 'marshall-emberton-ii', o => /Emberton\s*(II|2)\b/i.test(o.title));
// 3) Revolve+ II
move('bose-soundlink-revolve-ii', 'bose-soundlink-revolve-plus-ii', o => /revolve-ii-silver-2\/?$/.test(o.url));
// Refresh price ranges and colours on touched products.
for (const id of [OLD, 'marshall-emberton', 'marshall-emberton-ii', 'bose-soundlink-revolve-ii', 'bose-soundlink-revolve-plus-ii']) {
  const p = byId(id), ps = PR.offers[id].map(o => o.price).filter(Boolean);
  p.priceAmd = Math.min(...ps); p.priceAmdMax = Math.max(...ps); for (const v of p.variants) v.priceAmd = p.priceAmd;
}
byId('marshall-emberton').colors = ['Black', 'Green', 'Cream']; // Allsell sells gen 1 in Cream
// Pins: rewrite id + product name for moved URLs.
const csv = fs.readFileSync('data/links.csv', 'utf8').split('\n').map(l => {
  const url = l.slice(l.lastIndexOf(',') + 1).trim(), to = moved.get(url); if (!to) return l;
  const p = byId(to), c = l.split(','); c[0] = to; c[1] = `${p.brand} ${p.name}`.replace(/,/g, ''); return c.join(',');
});
fs.writeFileSync('data/links.csv', csv.join('\n'));
fs.writeFileSync('data/phones.json', JSON.stringify(P, null, 1).replace(/\n/g, '\r\n') + '\r\n');
fs.writeFileSync('data/prices.json', JSON.stringify(PR, null, 1) + '\n');
fs.writeFileSync('data/likemobile-map.json', JSON.stringify(LM, null, 2) + '\n');
fs.writeFileSync('data/merged.json', JSON.stringify(M, null, 1) + '\n');
console.log('moved offers', moved.size, [...moved].map(([u, id]) => id + ' <- ' + u).join('\n'));
