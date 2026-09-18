// Removes every product nothing in the country sells.
//
//   node tools/prune.mjs            list them
//   node tools/prune.mjs --write    remove them
//
// A price comparison with no price to compare is an empty page wearing a product's name. The
// entry goes, and with it its summary, its price history, its share page and any listing row
// left pointing at it.
//
// Run this AFTER a crawl, never during one: a shop that was down that day has no offers either,
// and this cannot tell that apart from a product genuinely gone. data/prices.json carries the
// previous run's offers forward for a shop that failed, so a normal run is safe.
import fs from 'node:fs';

const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const { offers } = JSON.parse(fs.readFileSync('data/prices.json', 'utf8'));
const dead = phones.filter(p => !(offers[p.id] || []).length);

console.log(`${dead.length} product(s) with no offer anywhere:`);
for (const p of dead) console.log(`  ${p.category.padEnd(10)} ${p.id.padEnd(38)} ${p.brand} ${p.name}`);
if (!dead.length || !process.argv.includes('--write')) {
  if (dead.length) console.log('\npass --write to remove them');
  process.exit(0);
}

const gone = new Set(dead.map(p => p.id));
fs.writeFileSync('data/phones.json', JSON.stringify(phones.filter(p => !gone.has(p.id)), null, 1));

// An array, so deleting by key leaves a hole that serialises as null and the build dies
// destructuring it. Filtered, not deleted.
const V = JSON.parse(fs.readFileSync('data/verdicts.json', 'utf8'));
const keptV = V.filter(v => v && !gone.has(v.id));
const cut = V.length - keptV.length;
fs.writeFileSync('data/verdicts.json', JSON.stringify(keptV, null, 1));

const H = JSON.parse(fs.readFileSync('data/history.json', 'utf8'));
let hist = 0;
for (const k of Object.keys(H.points || {})) if (gone.has(k)) { delete H.points[k]; hist++; }
fs.writeFileSync('data/history.json', JSON.stringify(H));

// A listing row for a product that is no longer here would put it straight back on the next run.
const lines = fs.readFileSync('data/listings.csv', 'utf8').trim().split(/\r?\n/);
const kept = [lines[0], ...lines.slice(1).filter(l => {
  const t = (l.split(',')[1] || '').toLowerCase();
  return ![...gone].some(id => t.includes(id.replace(/-/g, ' ')));
})];
fs.writeFileSync('data/listings.csv', kept.join('\n') + '\n');

let pages = 0;
for (const id of gone) {
  const dir = 'p/' + id;
  if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true }); pages++; }
}
console.log(`\nremoved ${gone.size} product(s), ${cut} summary(ies), ${hist} price series, ` +
            `${lines.length - kept.length} listing row(s), ${pages} share page(s)`);
