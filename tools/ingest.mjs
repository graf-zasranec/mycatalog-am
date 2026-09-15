// Reads a shop export and says what the catalogue already knows and what it does not.
//
//   node tools/ingest.mjs <rows.json> [--unmatched] [--matched]
//
// The rows.json is whatever a Web Scraper export was flattened into: [{name, price, cat}].
// Every row is put through the SAME matcher the crawler uses, so "unmatched" here means exactly
// what it means at crawl time - a product on a shelf that this catalogue has no entry for.
//
// It writes nothing. Deciding what to add is a judgement, and the file is evidence for it.
import fs from 'node:fs';

const src = fs.readFileSync('scrape.mjs', 'utf8');
// the scraper ends by crawling; everything above the shop loop is the matcher and its tables
const cut = src.indexOf('const report = [];');
// That slice still carries the scraper's own argument parsing, which would read OUR arguments as
// shop names and exit before matching anything. It has no shops to run here, so it gets none.
const body = src.slice(0, cut).replace('process.argv.slice(2)', '[]');
const mod = 'data:text/javascript;base64,' +
  Buffer.from(body + '\nexport { matchPhone };\n', 'utf8').toString('base64');
const { matchPhone } = await import(mod);

const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const name = id => { const p = phones.find(q => q.id === id); return p ? p.brand + ' ' + p.name : id; };

const hit = [], miss = [];
for (const r of rows) (matchPhone(r.name) ? hit : miss).push({ ...r, id: matchPhone(r.name) });

const byCat = {};
for (const r of rows) (byCat[r.cat] ||= { n: 0, hit: 0 }).n++;
for (const r of hit) byCat[r.cat].hit++;

console.log(`${rows.length} row(s): ${hit.length} match a product here, ${miss.length} do not\n`);
for (const [c, v] of Object.entries(byCat).sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${c.padEnd(14)} ${String(v.hit).padStart(4)} / ${v.n}`);

if (process.argv.includes('--matched')) {
  console.log('\n== already in the catalogue ==');
  for (const r of hit.sort((a, b) => a.id.localeCompare(b.id)))
    console.log(`  ${String(r.price).padStart(8)}  ${r.id.padEnd(32)} ${r.name.slice(0, 60)}`);
}
if (process.argv.includes('--unmatched')) {
  console.log('\n== on the shelf, not in the catalogue ==');
  for (const c of Object.keys(byCat)) {
    const m = miss.filter(r => r.cat === c);
    if (!m.length) continue;
    console.log(`\n-- ${c} (${m.length})`);
    for (const r of m.sort((a, b) => a.name.localeCompare(b.name)))
      console.log(`  ${String(r.price).padStart(8)}  ${r.name.slice(0, 72)}`);
  }
}
