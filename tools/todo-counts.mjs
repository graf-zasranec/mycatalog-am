// How much is left to check, measured from the data: photos, specs, prices, memory, colours.
//   node tools/todo-counts.mjs          counts per section
//   node tools/todo-counts.mjs --list   plus the ids behind each count
import fs from 'node:fs';

const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const P = rd('data/phones.json'), O = rd('data/prices.json').offers;
const list = process.argv.includes('--list');
const CUT = 'images/cut';
const webpW = f => { const b = fs.readFileSync(f).subarray(0, 40), t = b.toString('ascii', 12, 16);
  return t === 'VP8X' ? (b[24] | (b[25] << 8) | (b[26] << 16)) + 1 : t === 'VP8L' ? (b[21] | ((b[22] & 0x3f) << 8)) + 1 : t === 'VP8 ' ? b.readUInt16LE(26) & 0x3fff : 0; };
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const get = (o, path) => path.split('.').reduce((a, k) => a == null ? a : a[k], o);
const today = new Date('2026-09-24');
const days = d => d ? (today - new Date(d)) / 864e5 : Infinity;

// the fields a buyer compares in each section - a product missing any of them needs specs
const KEY = {
  phone: ['display.size', 'display.resolution', 'chipset.name', 'battery.capacity', 'body.weight', 'camera.main'],
  tablet: ['display.size', 'display.resolution', 'chipset.name', 'battery.capacity', 'body.weight'],
  laptop: ['display.size', 'display.resolution', 'chipset.name', 'body.weight'],
  desktop: ['chipset.name'],
  tv: ['display.size', 'display.resolution', 'display.type', 'display.refresh'],
  monitor: ['display.size', 'display.resolution', 'display.type', 'display.refresh'],
  watch: ['display.size', 'battery.capacity', 'body.weight'],
  headphones: ['audio.type', 'connectivity.bluetooth', 'body.weight'],
  speaker: ['connectivity.bluetooth', 'body.weight'],
};

const out = {};
const add = (k, id) => (out[k] ||= new Set()).add(id);
for (const p of P) {
  const offs = O[p.id] || [];
  // photos
  const main = `${CUT}/${p.id}__main.webp`;
  if (!fs.existsSync(main)) add('photo: no main photo', p.id);
  else if (webpW(main) < 600) add('photo: main under 600 px', p.id);
  for (const c of p.colors || []) if (!fs.existsSync(`${CUT}/${p.id}__${slug(c)}.webp`)) { add('photo: a colour without its own photo', p.id); break; }
  // specs
  for (const f of KEY[p.category] || []) if (get(p, f) == null || get(p, f) === '') { add(`specs: missing a key field (${p.category})`, p.id); break; }
  // prices
  if (offs.some(o => !o.seen || days(o.seen) > 7)) add('price: an offer not read in the last 7 days', p.id);
  if (offs.some(o => o.price < 10000)) add('price: an offer under 10 000 AMD', p.id);
  if (offs.length === 1) add('price: only one shop', p.id);
  // memory: several configurations, and an offer that does not say which
  const stor = new Set((p.variants || []).map(v => v.storage).filter(Boolean));
  const ram = new Set((p.variants || []).map(v => v.ram).filter(Boolean));
  if (!p.variantUnit && stor.size > 1 && offs.some(o => o.storage == null)) add('memory: offer without storage on a multi-storage product', p.id);
  if (ram.size > 1 && offs.some(o => o.ram == null)) add('memory: offer without RAM on a multi-RAM product', p.id);
  // colours
  const cols = (p.colors || []).map(c => c.toLowerCase());
  if (cols.length > 1 && offs.some(o => !o.color)) add('colour: offer without colour on a multi-colour product', p.id);
  if (cols.length && offs.some(o => o.color && !cols.includes(String(o.color).toLowerCase()))) add('colour: offer colour not in the product\'s colour list', p.id);
}
console.log(`${P.length} products`);
for (const [k, s] of Object.entries(out).sort()) {
  console.log(String(s.size).padStart(5), ' ', k);
  if (list) console.log('        ' + [...s].join(' '));
}
