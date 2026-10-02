// Key spec fields still empty, weight and battery mAh left out (owner, 2026-10-02: "if no info,
// disregard"). A field searched for and not published anywhere goes in the product's `specNA`
// with the reason, and stops counting. --check exits 1 while anything is left.
import fs from 'fs';
const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const KEY = {
  phone: ['display.size', 'display.resolution', 'chipset.name', 'camera.main'],
  tablet: ['display.size', 'display.resolution', 'chipset.name'],
  laptop: ['display.size', 'display.resolution', 'chipset.name'],
  desktop: ['chipset.name'],
  tv: ['display.size', 'display.resolution', 'display.type', 'display.refresh'],
  monitor: ['display.size', 'display.resolution', 'display.type', 'display.refresh'],
  watch: ['display.size'],
  headphones: ['audio.form', 'connectivity.bluetooth'],
  speaker: ['connectivity.bluetooth'],
};
const get = (o, f) => f.split('.').reduce((a, k) => a == null ? a : a[k], o);
const left = [];
for (const p of P) for (const f of KEY[p.category] || []) {
  const v = get(p, f);
  if ((v == null || v === '') && !(p.specNA || {})[f]) left.push(`${p.id} ${f}`);
}
console.log(left.join('\n'));
console.log(`${left.length} key spec field(s) left`);
if (left.length === 0) console.log('SPECS COMPLETE');
if (process.argv.includes('--check') && left.length) process.exit(1);
