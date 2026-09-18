// Attaches Eldorado's product-page urls to the rows that were priced from its spreadsheets.
//
//   node tools/eldorado-urls.mjs <eldorado_products_with_page_urls.csv> [--write]
//
// Eldorado's exports carry a name, a price and a picture, and no link at all - so 318 of its
// rows have a price nobody can go back and recheck. This file supplies the page each of those
// names belongs to. Matched on the shop's own Armenian title, which is the one field both sides
// wrote independently, so a match means the two are talking about the same shelf entry.
import fs from 'node:fs';

// quoted fields hold commas; a hand-rolled split would cut a product name in half
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const src = parseCsv(fs.readFileSync(process.argv[2], 'utf8'));
const head = src[0].map(h => h.trim());
const iName = head.indexOf('name'), iUrl = head.indexOf('product_page_url');
const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const page = new Map();
for (const r of src.slice(1)) {
  const u = (r[iUrl] || '').trim();
  if (u.startsWith('http')) page.set(norm(r[iName]), u);
}

const lines = fs.readFileSync('data/listings.csv', 'utf8').replace(/\n+$/, '').split(/\r?\n/);
let hit = 0, miss = 0;
const out = lines.map((l, i) => {
  if (!i) return l;
  const c = l.split(',');
  if (c[0] !== 'eldorado' || c[4]) return l;
  const u = page.get(norm(c[1]));
  if (!u) { miss++; return l; }
  c[4] = u; hit++;
  return c.join(',');
});

console.log(`${page.size} page url(s) offered`);
console.log(`${hit} eldorado row(s) matched a page, ${miss} still have none`);
if (process.argv.includes('--write')) {
  fs.writeFileSync('data/listings.csv', out.join('\n') + '\n');
  console.log('written to data/listings.csv');
} else {
  console.log('\npass --write');
}
