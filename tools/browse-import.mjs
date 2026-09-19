// Reads what tools/browse-harvest.js downloaded and puts it back into the catalogue.
//
//   node tools/browse-import.mjs <shop> <file.tsv>            what it would do
//   node tools/browse-import.mjs <shop> <file.tsv> --write    do it
//
// Two things come back from a shop's own search results, and they are worth different amounts:
//
//   the PICTURE, which is permanent. eldorado's page html answers our crawler with 403 but its
//   image CDN does not, so a url harvested once feeds the ordinary photo pipeline for ever. It
//   goes into data/hand-images.json and is then subject to the 600px floor, the placeholder
//   hashes and photo-rejects.json like any other candidate.
//
//   the PRICE, which is true for a day. It is reported, never written: the catalogue's prices
//   come from a crawl or from a person reading a shelf, and a number scraped out of a search
//   result is neither. What this does is tell you which of ours have drifted, and by how much.
//
// A term is matched back to a product by counting how many words of our model name appear in the
// shop's title. A shop that answers a search for "VA249HG" with a scented candle scores zero and
// is dropped, which is most of what the threshold is for.
import fs from 'node:fs';

const [shop, file] = process.argv.slice(2);
const write = process.argv.includes('--write');
if (!shop || !file) { console.log('usage: node tools/browse-import.mjs <shop> <file.tsv> [--write]'); process.exit(1); }

const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const prices = JSON.parse(fs.readFileSync('data/prices.json', 'utf8'));
const offers = prices.offers || {};
const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).slice(1).map(l => l.split('\t'));

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
// The model code is the best thing to search a shop for: a token carrying both letters and
// digits, longest first. Without one, the last two words of the name will have to do.
const termOf = name => {
  const t = name.split(/[\s(),\/]+/).filter(w => /[a-z]/i.test(w) && /\d/.test(w) && w.length >= 4)
                .sort((a, b) => b.length - a.length)[0];
  return t || name.split(/\s+/).slice(-2).join(' ');
};

const mine = phones.filter(p => (offers[p.id] || []).some(o => o.shop === shop));
const byTerm = new Map();
for (const r of rows) (byTerm.get(r[0]) || byTerm.set(r[0], []).get(r[0])).push(r);

const hand = fs.existsSync('data/hand-images.json')
  ? JSON.parse(fs.readFileSync('data/hand-images.json', 'utf8')) : {};
const rejects = fs.existsSync('data/photo-rejects.json')
  ? JSON.parse(fs.readFileSync('data/photo-rejects.json', 'utf8')) : {};

// A url several different products answer to is not a photograph of any of them - a shop logo, a
// "no image" file, a picture pasted down a column. The same test the spreadsheet import uses.
const claims = new Map();
for (const r of rows) if (r[3]) (claims.get(r[3]) || claims.set(r[3], new Set()).get(r[3])).add(r[2]);

let hadPhoto = 0, gotPhoto = 0, shared = 0, refused = 0, unmatched = [];
const drift = [];
for (const p of mine) {
  const full = `${p.brand} ${p.name}`.replace(/\s+/g, ' ').trim();
  const cands = byTerm.get(termOf(full)) || [];
  let best = null, score = -1;
  for (const c of cands) {
    const t = norm(c[1]);
    let s = 0;
    for (const w of full.split(/[\s(),\/]+/).filter(w => w.length > 2)) if (t.includes(norm(w))) s++;
    if (s > score) { score = s; best = c; }
  }
  if (!best || score < 1) { unmatched.push(full); continue; }

  // the picture
  const img = best[3];
  if (img) {
    if ((claims.get(img) || new Set()).size > 1) shared++;
    else if (Object.values(rejects[p.id] || {}).some(r => r && r.url === img)) refused++;
    else if (fs.existsSync(`images/cut/${p.id}__main.webp`)) hadPhoto++;
    else { (hand[p.id] ||= {}).main ||= img; gotPhoto++; }
  }

  // the price, reported only
  const high = +best[4] || null, low = +best[5] || null;
  const now = low || high;
  const ours = Math.min(...(offers[p.id] || []).filter(o => o.shop === shop).map(o => o.price));
  if (now && Number.isFinite(ours) && Math.abs(now - ours) > 1)
    drift.push({ name: full, ours, high, low, url: best[2] });
}

console.log(`${mine.length} of our ${shop} products, ${rows.length} harvested row(s)`);
console.log(`  photos: ${gotPhoto} new, ${hadPhoto} already had one, ${shared} url shared by several products (refused), ${refused} already rejected`);
console.log(`  no confident match: ${unmatched.length}`);
if (drift.length) {
  console.log(`\n  ${drift.length} price(s) that differ from ours - reported, not written:`);
  for (const d of drift.slice(0, 30))
    console.log(`     ${d.name.slice(0, 42).padEnd(44)} ours ${String(d.ours).padStart(9)}` +
                `   site ${String(d.high).padStart(9)}${d.low ? ' / ' + String(d.low).padStart(9) : ''}`);
  if (drift.length > 30) console.log(`     ... and ${drift.length - 30} more`);
}

if (write) {
  fs.writeFileSync('data/hand-images.json', JSON.stringify(hand, null, 1));
  fs.writeFileSync(`data/${shop}-prices-seen.tsv`,
    ['product\toursAMD\tsiteHigh\tsiteLow\turl', ...drift.map(d => [d.name, d.ours, d.high, d.low ?? '', d.url].join('\t'))].join('\n') + '\n');
  console.log(`\nwritten: data/hand-images.json, data/${shop}-prices-seen.tsv`);
} else {
  console.log('\npass --write');
}
