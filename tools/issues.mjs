// One list of everything this catalogue is not sure about, for a person to settle.
//
//   node tools/issues.mjs          print it
//   node tools/issues.mjs --csv    ...and write data/issues.csv
//
// Nothing here is a crash or a failing check - those get fixed rather than listed. These are the
// questions the data cannot answer about itself, and each row says what would settle it.
//
// What this is NOT is every imperfect row. A first version listed 3,019 things, which is a way
// of listing nothing: 1,017 products sold by a single shop (normal), 802 without a photo (one
// backlog, not 802 questions) and 413 "possible duplicates" that included the iPhone 17 against
// the iPhone 17 Pro Max. Counts belong in the summary; only a real doubt earns a row.
import fs from 'node:fs';

const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const { offers } = JSON.parse(fs.readFileSync('data/prices.json', 'utf8'));
const cut = new Set(fs.existsSync('images/cut') ? fs.readdirSync('images/cut').map(f => f.split('__')[0]) : []);
const links = fs.existsSync('data/links.csv')
  ? fs.readFileSync('data/links.csv', 'utf8').trim().split(/\r?\n/).slice(1).map(l => l.split(',')) : [];

const rows = [];
const add = (kind, id, detail, settles) => rows.push({ kind, id, detail, settles });
const squash = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// --- a name that is still a shop's sentence ---------------------------------------------------
// A model name is Latin, short, and has no market code in it. Anything else is the shop's own
// prose that survived the importer, and only the maker's own name will settle it.
for (const p of phones) {
  const bad = /[а-яա-ֆ]/i.test(p.name) ? 'non-Latin words'
    : /\b(RU|EU|CN|INT|Global)\b/.test(p.name) ? 'a market code'
    : /[™®]/.test(p.name) ? 'a trademark sign'
    : p.name.length > 40 ? 'far too long' : null;
  if (bad) add('name to check', p.id, `${p.brand} ${p.name}`, `the name carries ${bad} — what should it be called?`);
}

// --- two entries that really might be one ------------------------------------------------------
// Not "the names look similar" - that flagged the iPhone 17 against the 17 Pro Max. One name
// contained WHOLE inside the other, at the same make and kind, is the shape a duplicate takes.
const byBrandCat = {};
for (const p of phones) (byBrandCat[p.brand + '|' + p.category] ||= []).push(p);
for (const list of Object.values(byBrandCat)) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = squash(list[i].name), b = squash(list[j].name);
    if (a === b || !(a.startsWith(b) || b.startsWith(a))) continue;
    // and the tail that differs is not a word that names a different model. "Pro", "Max",
    // "Ultra" and the rest are the whole point of a range: the iPhone 17 and the 17 Pro are two
    // phones, and a check that cannot tell them apart reports 72 duplicates and finds none.
    const tail = (a.length > b.length ? a.slice(b.length) : b.slice(a.length));
    if (/^(pro|max|ultra|plus|mini|se|fe|lite|air|e|promax|proxl|xl)$/i.test(tail)) continue;
    if (tail.length > 3) continue;
    add('maybe one product', list[i].id, `${list[i].brand} ${list[i].name}  vs  ${list[j].name}`,
        'are these two products or one?');
  }
}

// --- a price nothing else in the country corroborates -----------------------------------------
for (const p of phones) {
  const ps = (offers[p.id] || []).map(o => o.price).sort((a, b) => a - b);
  if (ps.length < 2) continue;
  if (ps[ps.length - 1] > ps[0] * 2)
    add('prices too far apart', p.id, `${p.brand} ${p.name} — ${ps[0]} to ${ps[ps.length - 1]} AMD`,
        'which of these is not this product, or not this configuration?');
}

// --- sold by one shop, at a price unlike what that product should cost -------------------------
// One shop alone is ordinary. One shop alone AND well away from the catalogue's own figure is
// a reading nothing corroborates and something contradicts.
for (const p of phones) {
  const list = offers[p.id] || [];
  if (new Set(list.map(o => o.shop)).size !== 1 || !p.priceAmd) continue;
  const lo = Math.min(...list.map(o => o.price));
  if (lo < p.priceAmd * 0.6 || lo > (p.priceAmdMax || p.priceAmd) * 1.6)
    add('one shop, odd price', p.id, `${p.brand} ${p.name} — ${list[0].shop} says ${lo}, we say ${p.priceAmd}`,
        'is that shop right?');
}

const byKind = {};
for (const r of rows) (byKind[r.kind] ||= []).push(r);
const noPhoto = phones.filter(p => !cut.has(p.id)).length;
const noLink = new Set(links.filter(c => c[0] && c[2] && !c[9]).map(c => c[0])).size;

console.log(`${phones.length} products. ${rows.length} need a decision:\n`);
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`-- ${k} (${v.length})`);
  for (const r of v.slice(0, 12)) console.log(`   ${r.id.padEnd(36)} ${r.detail.slice(0, 64)}`);
  if (v.length > 12) console.log(`   ... and ${v.length - 12} more`);
  console.log('');
}
console.log('and two backlogs, which are counts rather than questions:');
console.log(`   ${noPhoto} product(s) with no photo`);
console.log(`   ${noLink} product(s) priced from an export that carried no link`);

if (process.argv.includes('--csv')) {
  const esc = v => String(v ?? '').replace(/[,\r\n]+/g, ' ').trim();
  fs.writeFileSync('data/issues.csv', 'what,id,detail,what would settle it\n' +
    rows.map(r => [r.kind, r.id, r.detail, r.settles].map(esc).join(',')).join('\n') + '\n');
  console.log('\n  -> data/issues.csv');
}
