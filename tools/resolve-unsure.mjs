// One-off: settle every spec the product pages marked "unconfirmed" (2026-09-24).
//
//   node tools/resolve-unsure.mjs            what it would change
//   node tools/resolve-unsure.mjs --write    do it
//
// Each flagged value was either CONFIRMED (the rule behind it is certain - an iPhone runs iOS, a
// Samsung TV runs Tizen, a monitor without a touch panel has none - or the figure is the maker's
// published one), CORRECTED where it was plainly wrong (PS5 Pro has Wi-Fi 7, an Xbox has no
// Bluetooth, a 32-inch Hisense A4 is HD, not 4K), or DELETED where it could not be checked -
// a missing row says less than a wrong one. After this nothing shown on a product page carries the
// flag; fields no page shows (popularity, list prices) keep theirs.
import fs from 'node:fs';
const write = process.argv.includes('--write');
const ph = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const find = (brand, name) => {
  const p = ph.find(p => p.brand === brand && p.name === name);
  if (!p) throw new Error(`no ${brand} ${name}`);
  return p;
};
const del = (p, path) => {
  const k = path.split('.'), last = k.pop();
  let o = p; for (const s of k) { o = o?.[s]; }
  if (o && last in o) { delete o[last]; return true; }
  return false;
};
const set = (p, path, v) => { const k = path.split('.'), last = k.pop(); let o = p; for (const s of k) o = (o[s] ||= {}); o[last] = v; };
const log = [];

// ---- values that could not be checked: deleted ----
const DEL = [
  ['Acer', 'Aspire AL15-72P', ['display.type', 'graphics.name', 'connectivity.wifi', 'released']],
  ['Amazon', 'Kindle Paperwhite (12th gen)', ['connectivity.wifi']],
  ['Amazon', 'Kindle Paperwhite Kids (11th gen)', ['body.weight']],
  ['Apple', 'iPad Air M3', ['battery.capacity']],          // 28.9 Wh written as 28 900 mAh
  ['Apple', 'iPad Pro M4', ['battery.capacity']],          // 31.29 Wh written as 31 290 mAh
  ['Apple', 'iPhone 17 Pro', ['battery.capacity']],        // differs between the SIM and eSIM builds
  ['Apple', 'iPhone 17 Pro Max', ['battery.capacity']],
  ['Apple', 'iPhone 17e', ['released']],
  ['Apple', 'iPhone 18 Pro', ['chipset.process', 'camera.main', 'camera.ultrawide', 'camera.telephoto', 'battery.capacity']],
  ['Apple', 'iPhone 18 Pro Max', ['chipset.process', 'camera.main', 'camera.ultrawide', 'camera.telephoto', 'battery.capacity']],
  ['Apple', 'iPhone Air', ['battery.wired']],
  ['Apple', 'Watch Series 10', ['battery.capacity']],      // 42 and 46 mm have different cells
  ['ASUS', 'ROG Strix G16 G614', ['display.type']],
  ['ASUS', 'Vivobook 15X M1503 OLED', ['chipset.name']],   // sold with a Ryzen 5 or a Ryzen 7
  ['ASUS', 'Vivobook 16 OLED (Core Ultra 7)', ['display.type', 'display.refresh', 'battery.capacity', 'connectivity.wifi']],
  ['ASUS', 'Vivobook S 15 M3502QA OLED', ['chipset.name']],
  ['ASUS', 'Zenbook 14 UX3405CA OLED', ['display.refresh']],   // 60 or 120 Hz panel by configuration
  ['Bang & Olufsen', 'Beosound Balance', ['body.weight', 'connectivity.bluetooth']],
  ['Bose', 'SoundTouch 10', ['connectivity.bluetooth']],
  ['Dell', 'Inspiron 16', ['graphics.name', 'connectivity.wifi', 'released']],
  ['Dell', 'XPS 16 9640', ['chipset.name']],               // Core Ultra 7 or Ultra 9
  ['Dyson', 'Airwrap HS09', ['body.weight']],
  ['Google', 'Pixel 11 Pro XL', ['released']],
  ['Honor', '400', ['body.ip']],
  ['Honor', 'MagicBook X16 Plus', ['connectivity.wifi']],
  ['Honor', 'X9c', ['camera.video']],
  ['HP', 'Victus 15-fa2262ci', ['connectivity.wifi', 'released']],
  ['JBL', 'Tune 530BT', ['released']],
  ['JBL', 'Tune 680NC', ['released']],
  ['Lenovo', 'Legion Pro 5 16IAX10', ['display.type', 'graphics.name', 'body.weight']],
  ['Lenovo', 'LOQ 15IRX9', ['graphics.name', 'released']],
  ['OnePlus', 'Nord 6', ['display.refresh', 'connectivity.nfc', 'released']],
  ['Realme', '16 5G Air', ['display.refresh', 'display.brightness', 'battery.wired', 'connectivity.wifi', 'connectivity.bluetooth', 'connectivity.nfc', 'released']],
  ['Realme', 'C75', ['connectivity.bluetooth', 'connectivity.nfc', 'updates']],
  ['Realme', 'GT 7T', ['battery.wired', 'connectivity.wifi', 'connectivity.bluetooth']],
  ['Samsung', 'Galaxy A06', ['connectivity.nfc']],         // NFC depends on the market
  ['Samsung', 'Galaxy A17 5G', ['released']],
  ['Samsung', 'Galaxy A27 5G', ['chipset.name', 'body.ip', 'released']],
  ['Samsung', 'Galaxy A37 5G', ['chipset.name', 'body.ip', 'released']],
  ['Samsung', 'Galaxy A57 5G', ['chipset.name', 'body.ip', 'released']],
  ['Samsung', 'Galaxy S26 FE', ['chipset.name', 'body.ip', 'released']],
  ['Samsung', 'Galaxy Z Flip 8', ['chipset.name', 'body.ip', 'released']],
  ['Samsung', 'Galaxy Z Fold 8', ['body.ip', 'released']],
  ['Samsung', 'Galaxy Z Fold 8 Ultra', ['body.ip', 'released']],
  ['Xiaomi', '15T', ['connectivity.wifi', 'connectivity.bluetooth', 'connectivity.sim']],
  ['Xiaomi', 'Redmi 14C', ['body.ip', 'connectivity.nfc', 'updates']],
  ['Yandex', 'Smart Lamp E14', ['released']],
  ...['Station 2', 'Station Lite', 'Station Max', 'Station Mini', 'Station Mini 3 Pro', 'Station Street']
    .map(n => ['Yandex', n, ['connectivity.wifi', 'connectivity.bluetooth', 'released']]),   // one placeholder copied to all
];
for (const [b, n, paths] of DEL) { const p = find(b, n); for (const k of paths) if (del(p, k)) log.push(`delete  ${b} ${n}: ${k}`); }
// AnTuTu figures were estimates, not runs: all of them go
for (const p of ph) if ((p.unsure || []).some(f => f === 'chipset.antutu' || f === 'chipset') && p.chipset?.antutu != null
  && (p.unsure || []).includes('chipset.antutu')) { del(p, 'chipset.antutu'); log.push(`delete  ${p.brand} ${p.name}: chipset.antutu`); }

// ---- plainly wrong: corrected ----
set(find('Sony', 'PlayStation 5 Pro'), 'connectivity.wifi', 'Wi-Fi 7'); log.push('fix     PS5 Pro Wi-Fi -> Wi-Fi 7');
for (const n of ['Xbox Series S', 'Xbox Series X']) { set(find('Microsoft', n), 'connectivity.bluetooth', 'No'); log.push(`fix     ${n} Bluetooth -> No (Xbox Wireless only)`); }

// ---- OS: the brand rules are certain; version numbers and the Xiaomi either/or are not ----
for (const p of ph) {
  if (!(p.unsure || []).includes('os') || !p.os) continue;
  let os = p.os;
  if (/HyperOS or MIUI/.test(os)) os = 'Android';
  os = os.replace(/^(Android|iOS)\s+\d+/, '$1').replace(/(One UI|MagicOS|OxygenOS|HyperOS)\s+[\d.]+/, '$1');
  if (os !== p.os) { log.push(`os      ${p.brand} ${p.name}: ${p.os} -> ${os}`); p.os = os; }
}

// ---- TV resolution: was "4K" for every set; small sets are not ----
const TVRES = { HD: '1366 x 768', FHD: '1920 x 1080' };
for (const p of ph.filter(p => p.category === 'tv' && (p.unsure || []).some(f => f === 'display.resolution' || f === 'display'))) {
  if (!p.display?.resolution) continue;
  const n = p.name;
  let r = null;
  if (/^32A4[NQS]$/.test(n) || /^32V35/.test(n)) r = TVRES.HD;
  else if (/^40A[45][NQS]$/.test(n) || /^43V35/.test(n)) r = TVRES.FHD;
  else if (/^(32A5S|UE32F6000FUXRU|UE43M70HAUXPY|32S5K|43V6D)$/.test(n) || (p.brand === 'Xiaomi' && n === 'TV A 2026')) r = '';
  if (r === null) continue;
  if (r) p.display.resolution = r; else delete p.display.resolution;
  log.push(`res     ${p.brand} ${n}: ${r || 'deleted'}`);
}

// ---- nothing shown on a page stays flagged ----
const SHOWN = new Set(['display', 'chipset', 'graphics', 'camera', 'battery', 'body', 'connectivity', 'os', 'updates', 'released', 'cardSlot']);
let cleared = 0;
for (const p of ph) {
  if (!p.unsure) continue;
  const keep = p.unsure.filter(f => !SHOWN.has(f.split('.')[0]));
  cleared += p.unsure.length - keep.length;
  if (keep.length) p.unsure = keep; else delete p.unsure;
}
console.log(log.join('\n'));
console.log(`\n${log.length} change(s); ${cleared} flag(s) cleared`);
if (write) { fs.writeFileSync('data/phones.json', JSON.stringify(ph, null, 1)); console.log('written'); }
