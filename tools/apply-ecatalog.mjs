// Laptop specs from e-catalog.com / ek.ua, read in the owner's Chrome and saved as
// data/specs/ecatalog-laptop.json: { ourId: { how: exact|series, slug, row: "inch|WxH|Hz|panel|cpu series|cpu model|kg|battery" } }.
// Fills missing fields only; a differing value we already have is logged, never replaced. A series
// match (same chassis, another configuration) gives only screen size and weight - the screen panel
// and the chip change between configurations.
//   node tools/apply-ecatalog.mjs [--write]
import fs from 'node:fs';

const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const M = JSON.parse(fs.readFileSync('data/specs/ecatalog-laptop.json', 'utf8'));
const write = process.argv.includes('--write');

// our naming: Intel Core i7-1355U, Intel Core Ultra 7-258V, AMD Ryzen 7 7445HS, Apple M1
function chip(series, model) {
  if (/^Apple/.test(series)) return series;
  if (!model || model.length < 3) return null;
  if (/^Ryzen/.test(series)) return `AMD ${series} ${model}`;
  if (/^Core/.test(series)) return `Intel ${series}-${model}`;
  return series ? `Intel ${series} ${model}` : null;
}

const log = { filled: [], same: 0, conflict: [] };
for (const p of P) {
  const e = M[p.id];
  if (!e || !e.row || /^\|*$/.test(e.row)) continue;
  const [inch, res, hz, panel, cs, cm, kg] = e.row.split('|');
  const got = {
    'display.size': +inch || null,
    'body.weight': +kg ? Math.round(+kg * 1000) : null,
    ...(e.how === 'exact' && {
      'display.resolution': (res.match(/^\d+x\d+/) || [])[0] || null,
      'display.refresh': +hz || null,
      'display.type': panel ? panel.replace('TN+film', 'TN') : null,
      'chipset.name': chip(cs, cm),
    }),
  };
  for (const [f, v] of Object.entries(got)) {
    if (v == null) continue;
    const [a, b] = f.split('.'), o = p[a] ||= {};
    if (o[b] == null || o[b] === '') { o[b] = v; log.filled.push(`${p.id} ${f}=${v}`); }
    else if (String(o[b]) === String(v)) log.same++;
    else log.conflict.push(`${p.id} ${f}: ours ${o[b]}, e-catalog ${v} (${e.how})`);
  }
  if (!(p.sources ||= []).includes('e-catalog')) p.sources.push('e-catalog');
}
console.log(`filled ${log.filled.length}, confirmed ${log.same}, conflicts ${log.conflict.length}`);
for (const l of log.conflict) console.log('conflict', l);
if (write) fs.writeFileSync('data/phones.json', JSON.stringify(P, null, 2) + '\n');

console.assert(chip('Core i7', '1355U') === 'Intel Core i7-1355U');
console.assert(chip('Ryzen 5', '7535HS') === 'AMD Ryzen 5 7535HS');
console.assert(chip('Ryzen 5', '40') === null);
console.assert(chip('Apple M1', '') === 'Apple M1');
