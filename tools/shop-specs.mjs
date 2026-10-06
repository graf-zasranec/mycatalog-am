// Specs from the shop's own product page, for products no spec site has (owner, 2026-09-24:
// "if you can't find specs, just use the page of the price"). Reads only the product's own
// specification block - the "Related products" under it list other models' specs.
// Resumable: pages already read are kept in data/specs/shop-<category>.json.
//   node tools/shop-specs.mjs laptop [--write]     (fetch missing pages, then fill missing fields)
import fs from 'node:fs';
import { cpu } from './spec-values.mjs';
export { cpu };

const cat = process.argv[2] || 'laptop', write = process.argv.includes('--write');
const UA = 'BetterBot/0.1 (+price comparison; respects robots.txt)';
const FILE = `data/specs/shop-${cat}.json`;
const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const O = JSON.parse(fs.readFileSync('data/prices.json', 'utf8')).offers;
const got = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const saveCache = () => {
  const text = JSON.stringify(got, null, 1);
  for (let attempt = 0; ; attempt++) {
    try { fs.writeFileSync(FILE, text); return; }
    catch (error) { if (attempt >= 3) throw error; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); }
  }
};
// the fields a buyer compares in each section (same list as tools/todo-counts.mjs)
const KEY = {
  laptop: ['display.size', 'display.resolution', 'chipset.name', 'body.weight'],
  monitor: ['display.size', 'display.resolution', 'display.type', 'display.refresh'],
  watch: ['display.size', 'battery.capacity', 'body.weight'],
  headphones: ['audio.form', 'connectivity.bluetooth', 'body.weight'],
  speaker: ['connectivity.bluetooth', 'body.weight'],
  tv: ['display.size', 'display.resolution', 'display.type', 'display.refresh'],
}[cat] || ['display.size', 'connectivity.bluetooth', 'body.weight'];
const g = (o, f) => f.split('.').reduce((a, k) => a == null ? a : a[k], o);
const lines = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&#215;/g, 'x').replace(/&#8211;/g, '-').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
  .split('\n').map(s => s.trim()).filter(Boolean);

// shop -> label/value pairs of the product's own spec block
// REDstore prints "label | : | value" for the product first, then again lower down; the first
// reading of each label is the product's. Its labels are mapped onto the ones read below.
const RED = { 'Screen diagonal(inch)': 'Screen Size', 'Screen diagonal': 'Screen Size', 'Screen resolution': 'Screen Resolution',
  'Battery capacity': 'Battery', CPU: 'CPU', Weight: 'Weight', 'Refresh rate': 'Refresh rate', 'Bluetooth version': 'Bluetooth', Bluetooth: 'Bluetooth' };
// Pixel and Ucom print a label on one line and its value on the next. The same words occur in
// their menus ("Bluetooth" is a menu item), so a value is taken only when it looks like one.
const NEXT = [
  [/^(Display size|Screen size|Diagonal)$/i, 'Screen Size', /\d(\.\d+)?\s*("|”|″|inch)/i],
  [/^Resolution$/i, 'Screen Resolution', /\d{3,4}\s*[x×]\s*\d{3,4}/],
  [/^(Weight|Weight \(grams\))$/i, 'Weight', /^\d+(\.\d+)?\s*(g|kg|grams)?$/i],
  [/^(Battery|Battery capacity)$/i, 'Battery', /\d{2,5}\s*mAh/i],
  [/^Bluetooth$/i, 'Bluetooth', /^v?\d\.\d/],
];
const nextLine = t => {
  const o = {};
  for (let i = 0; i + 1 < t.length; i++) for (const [re, key, ok] of NEXT)
    if (!(key in o) && re.test(t[i]) && ok.test(t[i + 1])) o[key] = key === 'Weight' && !/[a-z]/i.test(t[i + 1]) ? t[i + 1] + ' g' : key === 'Bluetooth' ? 'Bluetooth ' + t[i + 1] : t[i + 1];
  return o;
};
const PARSE = {
  pixel: nextLine,
  ucom: nextLine,
  redstore: t => {
    const o = {};
    for (let i = 1; i + 1 < t.length; i++) if (t[i] === ':' && RED[t[i - 1]] && !(RED[t[i - 1]] in o)) o[RED[t[i - 1]]] = t[i + 1].replace(/&quot;/g, '"');
    if (o.Bluetooth && !/bluetooth/i.test(o.Bluetooth)) o.Bluetooth = 'Bluetooth ' + o.Bluetooth;
    return o;
  },
  ibolit: t => {
    const a = t.indexOf('Specification'), b = t.findIndex((l, i) => i > a && /^(Customer Reviews|Related Products)$/.test(l));
    if (a < 0) return {};
    const s = t.slice(a + 1, b < 0 ? a + 40 : b).filter(l => l !== 'Overview'), o = {};
    for (let i = 0; i + 1 < s.length; i += 2) o[s[i]] = s[i + 1];
    return o;
  },
};

// our naming: Intel Core i7-1355U, Intel Core Ultra 7-258V, Intel Core 7-150U, AMD Ryzen 7 7730U, Apple M4
// a screen size is only believed inside the range the section can have
const RANGE = { phone: [3, 9], tablet: [6, 17], ereader: [5, 14], laptop: [10, 19], monitor: [18, 57], watch: [0.9, 2.5], tv: [24, 120] }[cat] || [0, 0];
const inch = v => { const m = String(v || '').replace(',', '.').match(/(\d{1,3}(?:\.\d+)?)/); return m && +m[1] >= RANGE[0] && +m[1] <= RANGE[1] ? +m[1] : null; };
// "0.558 kg", "1․7 kg" (Armenian full stop), "5.3 g" -> grams
const grams = v => { const m = String(v || '').replace('․', '.').match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i); if (!m) return null; const n = parseFloat(m[1].replace(',', '.')) * (/kg/i.test(m[2]) ? 1000 : 1); return n > 0 && n < 60000 ? Math.round(n) : null; };
// laptops and watches write 1920x1080, monitors and TVs 1920 x 1080
const res = v => { const m = String(v || '').match(/(\d{3,4})\s*[x×х*]\s*(\d{3,4})/); if (!m || +m[1] < (cat === 'watch' ? 150 : 1280)) return null; return /monitor|tv/.test(cat) ? `${m[1]} x ${m[2]}` : `${m[1]}x${m[2]}`; };
const bt = v => (String(v || '').match(/Bluetooth\s*v?(\d\.\d)/i) || [])[1] || null;
const mah = v => { const m = String(v || '').match(/(\d{2,5})\s*mAh/i); return m ? +m[1] : null; };

const gaps = P.filter(p => p.category === cat && (process.argv.includes('--all') || KEY.some(f => g(p, f) == null || g(p, f) === '')));
const checkedURLs = new Set();
for (const p of gaps) for (const o of O[p.id] || []) {
  if (!PARSE[o.shop] || checkedURLs.has(o.url) || (got[o.url] && !process.argv.includes('--refresh'))
      || (process.argv.includes('--resume-refresh') && got[o.url]?.checked?.slice(0, 10) === new Date().toISOString().slice(0, 10))) continue;
  checkedURLs.add(o.url);
  const r = await fetch(o.url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) }).catch(() => null);
  got[o.url] = { id: p.id, shop: o.shop, status: r ? r.status : 0, checked: new Date().toISOString(), spec: r && r.ok ? PARSE[o.shop](lines(await r.text())) : {} };
  saveCache();
  console.log(p.id, o.shop, got[o.url].status, Object.keys(got[o.url].spec).length);
  await new Promise(r => setTimeout(r, 800));
}

const log = { filled: [], same: 0, conflict: [] };
// A shop's typo must not become a spec: zigzag gave one Sony earbud 314 g. A weight the category
// cannot have is dropped and printed. Earbuds are per bud, as everywhere in the catalogue, so a
// "31 g" that is the buds plus their case is dropped too rather than published as one bud.
const RANGE_G = { watch: [10, 150], laptop: [700, 5000], speaker: [50, 45000], headphones: [15, 500] };
const plausibleG = (p, g) => {
  if (g == null) return null;
  const [lo, hi] = p.category === 'headphones' && p.audio?.form === 'tws' ? [2, 15] : RANGE_G[p.category] || [1, 1e6];
  if (g >= lo && g <= hi) return g;
  log.implausible = (log.implausible || 0) + 1; console.log(`implausible weight ${p.id}: ${g} g, not used`); return null;
};
for (const e of Object.values(got)) {
  const p = P.find(x => x.id === e.id), s = e.spec;
  if (!p || !s) continue;
  // A wrongly linked offer brings the wrong laptop's page (the Zenbook UX3405CA carried a
  // UM3402YA one): when the name has a model code, the page's url must carry it too.
  const codes = `${p.name} ${(p.aliases || []).join(' ')}`.split(/[\s_(),/]+/).map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(t => t.length >= 5 && /\d/.test(t) && /[a-z]/.test(t) && !/^\d+(gb|tb|inch)$/.test(t));
  const url = (Object.keys(got).find(k => got[k] === e) || '').split('#')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  // a maker tool (asus-specs, garmin-specs) matched the model itself and marks its entries maker
  if (!e.maker && codes.length && !codes.some(c => url.includes(c))) { log.foreign = (log.foreign || 0) + 1; continue; }
  const sizes = new Set((p.variants || []).map(x => x.size).filter(Boolean));
  const v = { 'display.size': inch(s['Screen Size']), 'display.resolution': res(s['Screen Resolution']), 'chipset.name': cpu(s.CPU),
    'display.type': cat === 'tv' ? ((String(s['Display type'] || '').match(/^(QLED|OLED)$/) || [])[1] || (/^D?LED$/.test(s['Display type'] || '') ? 'LED' : null))
      : (String(s['Display type'] || '').match(/^(IPS|TN|OLED|VA|WVA)\b/) || [])[1] || null, 'display.refresh': +(String(s['Refresh rate'] || '').match(/(\d{2,3})\s*Hz/i) || [])[1] || null,
    'body.weight': plausibleG(p, grams(s.Weight)), 'connectivity.bluetooth': bt(s.Bluetooth), 'battery.capacity': ['phone', 'tablet', 'watch'].includes(cat) ? mah(s.Battery) : null };
  for (const [f, val] of Object.entries(v)) {
    if (val == null || (sizes.size > 1 && f.startsWith('display.'))) continue;
    const [a, b] = f.split('.'), o = p[a] ||= {};
    if (o[b] == null || o[b] === '') { o[b] = val; log.filled.push(`${p.id} ${f}=${val}`); }
    else if (String(o[b]) === String(val) || (b === 'size' && Math.abs(o[b] - val) < 0.6)
      || (f === 'chipset.name' && String(o[b]).split('/').some(model => cpu(model.trim()) === cpu(val)))
      || (f === 'display.type' && String(o[b]).replace(/\b(?:LCD|\d(?:\.\d)?K)\b/gi, '').trim() === val)) log.same++;
    else log.conflict.push(`${p.id} ${f}: ours ${o[b]}, ${e.shop} page ${val}`);
  }
}
console.log(`filled ${log.filled.length}, confirmed ${log.same}, conflicts ${log.conflict.length}, pages of another model skipped ${log.foreign || 0}, implausible weights dropped ${log.implausible || 0}`);
for (const l of log.conflict) console.log('conflict', l);
const reportFile = process.argv.find(a => a.startsWith('--report='))?.slice(9);
if (reportFile) fs.writeFileSync(reportFile, JSON.stringify(log, null, 2) + '\n');
if (write) fs.writeFileSync('data/phones.json', JSON.stringify(P, null, 2) + '\n');

console.assert(cpu('Core Ultra 7 150U') === 'Intel Core Ultra 7-150U');
console.assert(cpu('Core I9 - 13900H') === 'Intel Core i9-13900H');
console.assert(cpu('Ryzen 7 7730U') === 'AMD Ryzen 7 7730U');
console.assert(cpu('Core i7') === null);
if (cat === 'laptop') console.assert(res('2880x1800') === '2880x1800' && inch("16 '' FHD+") === 16 && inch('14.0 inch') === 14);
console.assert(cpu('Intel® Core™ Ultra 7 Processor 255H') === 'Intel Core Ultra 7-255H');
console.assert(cpu('Intel Ultra 5 225H') === 'Intel Core Ultra 5-225H');
console.assert(cpu('Intel® Celeron® N4020') === 'Intel Celeron N4020' && cpu('Intel® N150') === 'Intel N150');
console.assert(cpu('Intel Core 5 120U (10 cores, up to 5.0 GHz)') === 'Intel Core 5-120U' && cpu('Intel® Core 3-100U') === 'Intel Core 3-100U');
console.assert(cpu('AMD Ryzen™ 5 7535HS') === 'AMD Ryzen 5 7535HS' && cpu('AMD Ryzen 5 150') === 'AMD Ryzen 5 150');
console.assert(cpu('Intel Core i5-210H') === null && cpu('Intel Core 3 N355') === 'Intel Core 3-N355' && cpu('Intel Core i7-1185G7') === 'Intel Core i7-1185G7');
console.assert(cpu('13th Generation Intel Core i5-13420H Processor') === 'Intel Core i5-13420H' && cpu('AMD Ryzen R5 4600H') === 'AMD Ryzen 5 4600H');
console.assert(grams('0.558 kg') === 558 && grams('1․7 kg') === 1700 && grams('5.3 g') === 5 && grams('') === null);
console.assert(res('3840×2160') === (/monitor|tv/.test(cat) ? '3840 x 2160' : '3840x2160') && bt('Wireless, Bluetooth 5.3') === '5.3' && mah('Battery: 425 mAh') === 425);
