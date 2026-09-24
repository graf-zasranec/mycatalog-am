// Applies spec sheets read from kimovil.com to data/phones.json and clears the "unconfirmed"
// marks (the `unsure` list) on every field a sheet confirms.
//
//   node tools/apply-specs.mjs data/specs/kimovil.json            what it would change
//   node tools/apply-specs.mjs data/specs/kimovil.json --write    do it
//
// The sheets are read in the owner's own browser - kimovil answers every other client with a
// Cloudflare challenge - and saved as { id: parsed sheet }. Rules:
//  - a field we do not have is filled in
//  - a field the sheet agrees with is kept as written (ours is often the fuller text) and its
//    unsure mark goes
//  - a measurable figure the sheet disagrees with (screen size, resolution, refresh, battery,
//    weight, dimensions, AnTuTu) takes the sheet's value, and the change is printed
//  - a sheet whose own title does not name our product is skipped whole: a wrong match must
//    never write a single field
import fs from 'node:fs';

const [file] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const write = process.argv.includes('--write');
const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
// saved as { keys: [...], rows: { id: [values in key order] } } - the sheets come back through a
// tool that truncates long text, so they travel as columns; expanded here to the parsed shape
const RAW = JSON.parse(fs.readFileSync(file, 'utf8'));
const S = RAW.keys ? Object.fromEntries(Object.entries(RAW.rows).map(([id, r]) => {
  const v = Object.fromEntries(RAW.keys.map((k, i) => [k, r[i]]));
  return [id, { title: v.title, display: { size: v.size, type: v.type, resolution: v.res, refresh: v.hz, ppi: v.ppi, peak: v.peak },
    chipset: { name: v.chip, process: v.nm, gpu: v.gpu }, antutu: v.antutu,
    battery: { capacity: v.mah, wired: v.wired, wirelessW: v.wirelessW }, body: { weight: v.g, dimensions: v.dims, materials: v.materials, ip: v.ip },
    connectivity: { network: v.net, bluetooth: v.bt, wifi: v.wifi, nfc: v.nfc, sim: v.sim }, cardSlot: v.sd,
    camera: { modules: v.cams, main: v.main, aperture: v.f, front: v.front, video: v.video }, os: v.os, released: v.released }];
})) : RAW;
const byId = Object.fromEntries(P.map(p => [p.id, p]));
const CHECKED = new Set(RAW.checked || []);

const MONTHS = { January: '01', February: '02', March: '03', April: '04', May: '05', June: '06', July: '07',
  August: '08', September: '09', October: '10', November: '11', December: '12' };
const toks = s => new Set(String(s).toLowerCase().replace(/\+/g, ' plus').split(/[^a-z0-9]+/).filter(t => t && !/^(5g|4g|lte|wi|fi|wifi|cellular|global|international)$/.test(t)));
// The sheet must be this product, in both directions: nothing in its title that our name does not
// say (a "Pro" or a "Lite" we are not), and nothing in our name it leaves out except model codes
// ("JMS-W09", "/GU0NP", "MPQA3RK"). Matches settled by hand - kimovil names iPads by year, "iPad
// (2021)" for our "iPad 9" - are listed in the file's `checked` and skip this test.
const CODE = t => (/\d/.test(t) && /[a-z]/.test(t) && t.length >= 4) || /^(m\d|a\d{2}|20\d\d)$/.test(t);
const sameDevice = (p, title) => {
  const A = toks(p.brand + ' ' + p.name.replace(/\s*\/.*$/, '').replace(/\b[A-Z0-9]{2,5}-[A-Z0-9]{2,5}\b/g, ' '));
  const T = toks(title);
  // our brand may go unsaid: kimovil titles Xiaomi's POCO line "POCO C75"
  const brand = toks(p.brand);
  return [...T].every(t => A.has(t)) && [...A].every(a => T.has(a) || CODE(a) || brand.has(a));
};
// kimovil writes one GPU five ways ("5 core GPU", "Apple 5 cores GPU", "Apple GPU (9-core graphics)");
// the "N-core GPU" form is the one data/terms.json translates
const gpuNorm = (v, brand) => {
  if (v == null) return v;
  const t = String(v).trim();
  if (/Neural/.test(t)) return t;
  const m = t.match(/^(?:Apple\s+)?(\d+)[ -]cores?\s+(?:Apple\s+)?GPU(?:\s+graphics)?(?:\s+\d+\s*MHz)?$/i)
    || t.match(/^Apple\s+GPU\s+\((\d+)-core graphics\)$/i) || t.match(/^Apple\s+GPU\s+(\d+)\s+Cores$/i);
  return m ? (brand === 'Apple' ? 'Apple ' : '') + m[1] + '-core GPU' : t;
};
const resNorm = r => { const m = /(\d+)\s*[x×]\s*(\d+)/.exec(String(r || '')); return m ? [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])] : null; };
// within 2 px: one sheet says 1170x2531 for the 1170x2532 panel
const resSame = (a, b) => { const x = resNorm(a), y = resNorm(b); return !!x && !!y && Math.abs(x[0] - y[0]) <= 2 && Math.abs(x[1] - y[1]) <= 2; };

const log = { filled: {}, confirmed: {}, replaced: [], conflicts: [], skipped: [], cleared: 0 };
const bump = (k, f) => (log[k][f] = (log[k][f] || 0) + 1);

for (const [id, s] of Object.entries(S)) {
  const p = byId[id];
  if (!p) continue;
  if (!s.title || !(CHECKED.has(id) || sameDevice(p, s.title))) { log.skipped.push(`${id}: sheet is "${s.title}"`); continue; }
  const ok = new Set();                     // unsure paths this sheet settles
  const obj = k => (p[k] ||= {});
  // fill when missing, confirm when equal (by `same`), replace when `hard` and different
  const put = (path, v, same = (a, b) => a === b, hard = false) => {
    if (v == null || v === '' || Number.isNaN(v)) return;
    const [a, b] = path.split('.');
    const o = b ? obj(a) : p, k = b || a, cur = o[k];
    if (cur == null || cur === '') { o[k] = v; bump('filled', path); }
    else if (same(cur, v)) bump('confirmed', path);
    // a figure we had confirmed stands against the sheet (kimovil has typos too); one we never
    // confirmed takes the sheet's value
    else if (hard && (p.unsure || []).some(u => u === path || u === a)) { log.replaced.push(`${id} ${path}: ${JSON.stringify(cur)} -> ${JSON.stringify(v)}`); o[k] = v; }
    else if (hard) { log.conflicts.push(`${id} ${path}: ours ${JSON.stringify(cur)}, sheet ${JSON.stringify(v)}`); return; }
    else return;                            // a text field that reads differently: ours stays, still unsure
    ok.add(path);
  };
  const near = eps => (a, b) => Math.abs(+a - +b) <= eps;
  const c = s.chipset || {}, cn = s.connectivity || {}, cam = s.camera || {};
  // One product sold in two screen sizes (the 11- and 13-inch iPad Air) has no single screen,
  // battery, weight or size: a sheet is for one of them, so those fields are left alone.
  const sized = new Set((p.variants || []).map(v => v.size).filter(Boolean)).size > 1;
  const d = sized ? {} : s.display || {}, bt = sized ? {} : s.battery || {}, bd = sized ? { materials: (s.body || {}).materials, ip: (s.body || {}).ip } : s.body || {};
  put('display.size', d.size, near(0.05), true);
  put('display.resolution', d.resolution, resSame, true);
  put('display.refresh', d.refresh, (a, b) => +a === +b, true);
  put('display.ppi', d.ppi, near(3));
  put('display.brightness', d.peak, near(50));
  put('display.type', d.type && d.type.replace(/^Oled$/, 'OLED').replace(/^Amoled$/, 'AMOLED'), (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase().replace(/^o?led$/, 'oled')));
  // a 60 Hz panel's sheet often gives no refresh figure; size and resolution then settle the screen
  if (ok.has('display.size') && ok.has('display.resolution') && (ok.has('display.refresh') || d.refresh == null)) ok.add('display');
  // "Snapdragon 8 Gen 1" and "Qualcomm Snapdragon 8 Gen1 (SM8450)" are one chip: maker words, part
  // numbers in brackets and spacing do not count
  const chipKey = v => String(v).toLowerCase().replace(/(.*?)/g, '').replace(/(qualcomm|mediatek|samsung|apple|google|huawei|hisilicon|unisoc|bionic)/g, '').replace(/[^a-z0-9]/g, '');
  const chipSame = (a, b) => { const x = chipKey(a), y = chipKey(b); return !!x && !!y && (x.includes(y) || y.includes(x)); };
  put('chipset.name', c.name, chipSame, true);
  if (ok.has('chipset.name')) ok.add('chipset');
  put('chipset.process', c.process, (a, b) => String(a).replace(/\s/g, '') === String(b).replace(/\s/g, ''));
  put('chipset.gpu', gpuNorm(c.gpu, p.brand), () => true);
  // no AnTuTu: the catalogue dropped the score everywhere (one benchmark, easy to game)
  put('battery.capacity', bt.capacity, near(20), true);
  put('battery.wired', bt.wired, (a, b) => +a === +b);
  if (bt.wirelessW) put('battery.wireless', bt.wirelessW, (a, b) => +a === +b);
  put('body.weight', bd.weight, near(1), true);
  const dm = /([\d.]+) × ([\d.]+) × ([\d.]+)/.exec(bd.dimensions || '');
  // kimovil writes a phone width-first and a tablet height-first; a device stands taller than it is wide
  if (dm) { put('body.height', Math.max(+dm[1], +dm[2]), near(0.5), true); put('body.width', Math.min(+dm[1], +dm[2]), near(0.5), true); put('body.thickness', +dm[3], near(0.3), true); }
  put('body.materials', bd.materials, () => true);
  put('body.ip', bd.ip, (a, b) => String(a).includes(b));
  put('connectivity.network', cn.network, (a, b) => String(a).startsWith(b));
  put('connectivity.bluetooth', cn.bluetooth, (a, b) => parseFloat(a) === parseFloat(b));
  put('connectivity.wifi', cn.wifi, (a, b) => String(a).startsWith(b));
  put('connectivity.nfc', cn.nfc);
  put('connectivity.sim', cn.sim, () => true);
  if (['connectivity.network', 'connectivity.nfc'].every(k => ok.has(k))) ok.add('connectivity');
  if (p.cardSlot == null && s.cardSlot != null) { p.cardSlot = s.cardSlot; bump('filled', 'cardSlot'); }
  put('camera.modules', cam.modules, (a, b) => +a >= +b);
  if (cam.main) put('camera.main', `${cam.main.replace(' Mpx', ' MP')}${cam.aperture ? ', f/' + cam.aperture : ''}`, (a, b) => parseInt(a) === parseInt(b));
  if (cam.front) put('camera.front', cam.front.replace(' Mpx', ' MP'), (a, b) => parseInt(a) === parseInt(b));
  put('camera.video', cam.video, (a, b) => String(a).includes(b));
  put('os', s.os, (a, b) => String(a).split(/[ ,]/)[0].toLowerCase() === String(b).split(/[ ,]/)[0].toLowerCase());
  const rel = /([A-Z][a-z]+) (\d{4})/.exec(s.released || '');
  if (rel && MONTHS[rel[1]]) put('released', `${rel[2]}-${MONTHS[rel[1]]}`, (a, b) => String(a).slice(0, 4) === b.slice(0, 4));
  // the marks this sheet settles go; a mark on something the sheet does not cover stays
  const before = (p.unsure || []).length;
  p.unsure = (p.unsure || []).filter(u => !ok.has(u));
  log.cleared += before - p.unsure.length;
  if (!p.unsure.length) delete p.unsure;
  (p.sources ||= []).includes('kimovil') || p.sources.push('kimovil');
}

console.log('filled   ', JSON.stringify(log.filled));
console.log('confirmed', JSON.stringify(log.confirmed));
console.log(`replaced  ${log.replaced.length}`);
for (const r of log.replaced) console.log('   ' + r);
console.log(`conflicts ${log.conflicts.length} (ours was confirmed, kept, still flagged for a look)`);
for (const r of log.conflicts) console.log('   ' + r);
console.log(`skipped   ${log.skipped.length} (sheet title does not name our product)`);
for (const r of log.skipped) console.log('   ' + r);
console.log(`unsure marks cleared: ${log.cleared}`);
if (write) { fs.writeFileSync('data/phones.json', JSON.stringify(P, null, 1)); console.log('written'); }
else console.log('pass --write');
