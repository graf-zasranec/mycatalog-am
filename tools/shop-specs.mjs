// Specs from the shop's own product page, for products no spec site has (owner, 2026-09-24:
// "if you can't find specs, just use the page of the price"). Reads only the product's own
// specification block - the "Related products" under it list other models' specs.
// Resumable: pages already read are kept in data/specs/shop-<category>.json.
//   node tools/shop-specs.mjs laptop [--write]     (fetch missing pages, then fill missing fields)
import fs from 'node:fs';

const cat = process.argv[2] || 'laptop', write = process.argv.includes('--write');
const UA = 'BetterBot/0.1 (+price comparison; respects robots.txt)';
const FILE = `data/specs/shop-${cat}.json`;
const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const O = JSON.parse(fs.readFileSync('data/prices.json', 'utf8')).offers;
const got = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
// the fields a buyer compares in each section (same list as tools/todo-counts.mjs)
const KEY = {
  laptop: ['display.size', 'display.resolution', 'chipset.name', 'body.weight'],
  monitor: ['display.size', 'display.resolution', 'display.type', 'display.refresh'],
  watch: ['display.size', 'battery.capacity', 'body.weight'],
  headphones: ['audio.form', 'connectivity.bluetooth', 'body.weight'],
  speaker: ['connectivity.bluetooth', 'body.weight'],
}[cat];
const g = (o, f) => f.split('.').reduce((a, k) => a == null ? a : a[k], o);
const lines = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&#215;/g, 'x').replace(/&#8211;/g, '-').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
  .split('\n').map(s => s.trim()).filter(Boolean);

// shop -> label/value pairs of the product's own spec block
const PARSE = {
  ibolit: t => {
    const a = t.indexOf('Specification'), b = t.findIndex((l, i) => i > a && /^(Customer Reviews|Related Products)$/.test(l));
    if (a < 0) return {};
    const s = t.slice(a + 1, b < 0 ? a + 40 : b).filter(l => l !== 'Overview'), o = {};
    for (let i = 0; i + 1 < s.length; i += 2) o[s[i]] = s[i + 1];
    return o;
  },
};

// our naming: Intel Core i7-1355U, Intel Core Ultra 7-258V, Intel Core 7-150U, AMD Ryzen 7 7730U, Apple M4
export function cpu(v) {
  v = String(v || '').replace(/[®™]/g, '').replace(/\(.*$/, '').replace(/\bProcessor\b/i, '').replace(/\s*[-–]\s*/g, ' ')
    .replace(/\s+/g, ' ').trim().replace(/^\d+th Generation /i, '').replace(/^Intel (Ultra \d)/i, 'Intel Core $1').replace(/Ryzen R(\d)/i, 'Ryzen $1');
  let m;
  if ((m = v.match(/^(?:Intel )?(Celeron |Pentium (?:Silver |Gold )?)?(N\d{3,4})$/i))) return `Intel ${m[1] || ''}${m[2].toUpperCase()}`;
  // i-series models have 4-5 digits (i5-13420H); Core 5 / Core Ultra 5 have 3 (210H, 255H, N355)
  if ((m = v.match(/^(?:Intel )?Core (i[3579]) ?(\d{4,5}[A-Z]{0,3}\d?)$/i) || v.match(/^(?:Intel )?Core (Ultra [579]|[3579]) ?([A-Z]?\d{3}[A-Z]{0,3})$/i))) return `Intel Core ${m[1].toLowerCase().replace('ultra', 'Ultra')}-${m[2].toUpperCase()}`;
  if ((m = v.match(/^(?:AMD )?Ryzen ([3579]|AI [579]) (?:PRO )?(\d{3,4}[A-Z]{0,3})$/i))) return `AMD Ryzen ${m[1]} ${m[2].toUpperCase()}`;
  if ((m = v.match(/^(?:Apple )?(M[1-5](?: Pro| Max)?)$/i))) return `Apple ${m[1].toUpperCase().replace('PRO', 'Pro').replace('MAX', 'Max')}`;
  return null;
}
const inch = v => { const m = String(v || '').match(/(\d{2}(?:\.\d)?)/); return m && +m[1] >= 10 && +m[1] <= 19 ? +m[1] : null; };
const res = v => { const m = String(v || '').match(/(\d{3,4})\s*[x×х*]\s*(\d{3,4})/); return m && +m[1] >= 1280 ? `${m[1]}x${m[2]}` : null; };

const gaps = P.filter(p => p.category === cat && KEY.some(f => g(p, f) == null || g(p, f) === ''));
for (const p of gaps) for (const o of O[p.id] || []) {
  if (!PARSE[o.shop] || got[o.url]) continue;
  const r = await fetch(o.url, { headers: { 'user-agent': UA } }).catch(() => null);
  got[o.url] = { id: p.id, shop: o.shop, status: r ? r.status : 0, spec: r && r.ok ? PARSE[o.shop](lines(await r.text())) : {} };
  fs.writeFileSync(FILE, JSON.stringify(got, null, 1));
  console.log(p.id, o.shop, got[o.url].status, Object.keys(got[o.url].spec).length);
  await new Promise(r => setTimeout(r, 800));
}

const log = { filled: [], same: 0, conflict: [] };
for (const e of Object.values(got)) {
  const p = P.find(x => x.id === e.id), s = e.spec;
  if (!p || !s) continue;
  // A wrongly linked offer brings the wrong laptop's page (the Zenbook UX3405CA carried a
  // UM3402YA one): when the name has a model code, the page's url must carry it too.
  const codes = `${p.name} ${(p.aliases || []).join(' ')}`.split(/[\s_(),/]+/).map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(t => t.length >= 5 && /\d/.test(t) && /[a-z]/.test(t) && !/^\d+(gb|tb|inch)$/.test(t));
  const url = (Object.keys(got).find(k => got[k] === e) || '').split('#')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  if (codes.length && !codes.some(c => url.includes(c))) { log.foreign = (log.foreign || 0) + 1; continue; }
  const sizes = new Set((p.variants || []).map(x => x.size).filter(Boolean));
  const v = { 'display.size': inch(s['Screen Size']), 'display.resolution': res(s['Screen Resolution']), 'chipset.name': cpu(s.CPU),
    'display.type': (String(s['Display type'] || '').match(/^(IPS|TN|OLED|VA|WVA)/) || [])[1] || null, 'display.refresh': +(String(s['Refresh rate'] || '').match(/^(\d{2,3})/) || [])[1] || null };
  for (const [f, val] of Object.entries(v)) {
    if (val == null || (sizes.size > 1 && f.startsWith('display.'))) continue;
    const [a, b] = f.split('.'), o = p[a] ||= {};
    if (o[b] == null || o[b] === '') { o[b] = val; log.filled.push(`${p.id} ${f}=${val}`); }
    else if (String(o[b]) === String(val) || (b === 'size' && Math.abs(o[b] - val) < 0.6)) log.same++;
    else log.conflict.push(`${p.id} ${f}: ours ${o[b]}, ${e.shop} page ${val}`);
  }
}
console.log(`filled ${log.filled.length}, confirmed ${log.same}, conflicts ${log.conflict.length}, pages of another model skipped ${log.foreign || 0}`);
for (const l of log.conflict) console.log('conflict', l);
if (write) fs.writeFileSync('data/phones.json', JSON.stringify(P, null, 2) + '\n');

console.assert(cpu('Core Ultra 7 150U') === 'Intel Core Ultra 7-150U');
console.assert(cpu('Core I9 - 13900H') === 'Intel Core i9-13900H');
console.assert(cpu('Ryzen 7 7730U') === 'AMD Ryzen 7 7730U');
console.assert(cpu('Core i7') === null);
console.assert(res('2880x1800') === '2880x1800' && inch("16 '' FHD+") === 16 && inch('14.0 inch') === 14);
console.assert(cpu('Intel® Core™ Ultra 7 Processor 255H') === 'Intel Core Ultra 7-255H');
console.assert(cpu('Intel Ultra 5 225H') === 'Intel Core Ultra 5-225H');
console.assert(cpu('Intel® Celeron® N4020') === 'Intel Celeron N4020' && cpu('Intel® N150') === 'Intel N150');
console.assert(cpu('Intel Core 5 120U (10 cores, up to 5.0 GHz)') === 'Intel Core 5-120U' && cpu('Intel® Core 3-100U') === 'Intel Core 3-100U');
console.assert(cpu('AMD Ryzen™ 5 7535HS') === 'AMD Ryzen 5 7535HS' && cpu('AMD Ryzen 5 150') === 'AMD Ryzen 5 150');
console.assert(cpu('Intel Core i5-210H') === null && cpu('Intel Core 3 N355') === 'Intel Core 3-N355' && cpu('Intel Core i7-1185G7') === 'Intel Core i7-1185G7');
console.assert(cpu('13th Generation Intel Core i5-13420H Processor') === 'Intel Core i5-13420H' && cpu('AMD Ryzen R5 4600H') === 'AMD Ryzen 5 4600H');
