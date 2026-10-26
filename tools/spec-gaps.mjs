// Key spec fields still empty, weight and battery mAh left out (owner, 2026-10-02: "if no info,
// disregard"). A field searched for and not published anywhere goes in the product's `specNA`
// with the reason, and stops counting. --check exits 1 while anything is left.
import fs from 'fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

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
// --all adds weight and battery mAh (the second pass, owner 2026-10-02: "finish specs")
if (process.argv.includes('--all')) {
  for (const c of ['phone', 'tablet', 'laptop', 'watch', 'headphones', 'speaker']) KEY[c] = [...KEY[c], 'body.weight'];
  for (const c of ['phone', 'tablet', 'watch']) KEY[c] = [...KEY[c], 'battery.capacity'];
}
export function requiredSpecFields(p) {
  if (p.category === 'largeappliance') {
    const core = {fridge:'volume',freezer:'volume',washing_machine:'load',dryer:'load',dishwasher:'settings',air_conditioner:'btu'}[p.appliance?.type];
    const variantVolumes=p.appliance?.volumeByVariant;
    const volumeKey=core==='volume'&&!p.appliance.volume&&variantVolumes&&Object.keys(variantVolumes).length>0&&Object.values(variantVolumes).every(v=>Number.isFinite(v)&&v>0) ? 'volumeByVariant' : core;
    return ['appliance.type', ...(volumeKey ? ['appliance.' + volumeKey] : [])];
  }
  if (['kitchen','haircare','grooming','appliance','coffee'].includes(p.category)) return ['appliance.type'];
  return KEY[p.category] || [];
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const get = (o, f) => f.split('.').reduce((a, k) => a == null ? a : a[k], o);
const left = [];
for (const p of P) for (const f of requiredSpecFields(p)) {
  const v = get(p, f);
  if ((v == null || v === '') && !(p.specNA || {})[f]) left.push(`${p.id} ${f}`);
}
console.log(left.join('\n'));
console.log(`${left.length} key spec field(s) left`);
if (left.length === 0) console.log('SPECS COMPLETE');
if (process.argv.includes('--check') && left.length) process.exit(1);

}
