// Reads data/links.csv and says which rows disagree with themselves.
//
//   node tools/recheck.mjs [--colour] [--storage] [--title] [--price] [--all]
//
// Every check here is a contradiction between two things the SAME row already says, so none of
// them needs the network or a judgement call. A row that survives all four is not necessarily
// right, but a row that fails one is wrong in a way somebody has to decide about.
//
// Nothing is written. The fix is to correct the id column in data/links.csv, which pins it.
import fs from 'node:fs';

// the crawler's own matcher, so "what would this title match on its own?" is asked with exactly
// the code that assigned the id in the first place
const src = fs.readFileSync('scrape.mjs', 'utf8');
const body = src.slice(0, src.indexOf('const report = [];')).replace('process.argv.slice(2)', '[]');
const { matchPhone, colorOf } = await import('data:text/javascript;base64,' +
  Buffer.from(body + '\nexport { matchPhone, colorOf };\n', 'utf8').toString('base64'));

const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const byId = new Map(phones.map(p => [p.id, p]));
const rows = fs.readFileSync('data/links.csv', 'utf8').trim().split(/\r?\n/).slice(1)
  .map(l => { const [id, product, shop, title, storage, color, esim, price, seen, url] = l.split(',');
              return { id, product, shop, title, storage, color, esim, price: +price, seen, url }; })
  .filter(r => r.url && r.price);

const OFFICIAL = new Set(['zigzag', 'eldorado', 'ucom', 'telecom', 'ispace']);
const want = process.argv.slice(2);
const on = n => want.includes('--' + n) || want.includes('--all') || !want.some(a => a.startsWith('--'));
const hits = [];
const flag = (kind, r, why) => hits.push({ kind, r, why });

for (const r of rows) {
  const p = byId.get(r.id);
  if (!p) { flag('id', r, `no such product`); continue; }

  // The MacBook complaint, generalised: read the shop's title on its own and see whether it says
  // a different product than the url did. Air M4 vs Air M5 differ by one character in a slug and
  // by a whole generation on the shelf.
  if (on('title')) {
    const alone = matchPhone(r.title);
    if (alone && alone !== r.id) flag('title', r, `title alone reads as ${alone}`);
  }

  // A colour is right or wrong against the shop's own words, not against a palette. AllSell's
  // "...1TB MDHJ4 Sky Blue" came through as Midnight: the page named the colour and we did not
  // take it, which means it was read off something else on the page.
  if (on('colour') && r.color) {
    const fromTitle = colorOf(r.title, p.colors);
    if (fromTitle && fromTitle !== r.color) flag('colour', r, `title says ${fromTitle}`);
  }

  // Capacity is a number with a unit and shops drop the unit. "1" is a terabyte read as a
  // gigabyte; anything under 8 is not a storage size any of these products is sold in.
  if (on('storage') && r.storage) {
    const s = +r.storage;
    const tiers = (p.variants || []).map(v => v.storage).filter(v => v != null);
    if (s < 8) flag('storage', r, `${s} GB is not a size - a dropped TB?`);
    else if (tiers.length && !tiers.includes(s)) flag('storage', r, `${s} not among ${tiers.join('/')}`);
  }

  // An official representative imports through the official channel and that channel brings the
  // nano tray only. One of their pages claiming an eSIM-only build is either a reading of the
  // wrong words or a shop that is not the representative we think it is.
  if (on('sim') && OFFICIAL.has(r.shop) && r.esim === 'esim' && byId.get(r.id)?.category === 'phone')
    flag('sim', r, `${r.shop} is an official rep - nano tray only`);

  // A price far outside what every other shop charges is usually a different product, an
  // instalment figure, or a trade-in price read off the same page.
  if (on('price')) {
    const ref = p.priceAmd, top = p.priceAmdMax || ref;
    if (ref && r.price < ref * 0.5) flag('price', r, `${r.price} is under half of ${ref}`);
    else if (top && r.price > top * 2) flag('price', r, `${r.price} is over twice ${top}`);
  }
}

const byKind = {};
for (const h of hits) (byKind[h.kind] ||= []).push(h);
console.log(`${rows.length} live row(s), ${hits.length} disagree with themselves\n`);
for (const [kind, list] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n== ${kind} (${list.length}) ==`);
  for (const { r, why } of list.sort((a, b) => a.r.id.localeCompare(b.r.id)))
    console.log(`  ${r.id.padEnd(34)} ${r.shop.padEnd(14)} ${why.padEnd(38)} ${r.title.slice(0, 52)}`);
}
