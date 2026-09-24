// Fills the operating system where the brand and product line settle it.
//
//   node tools/software.mjs            what it would set
//   node tools/software.mjs --write    write it into data/phones.json
//
// The Software block was empty on most product pages: 95 of 164 phones, every one of 251 TVs.
// Most of those answers are not in doubt - an iPhone runs iOS, a Samsung TV runs Tizen - but they
// are worked out from the brand, not read off the maker's sheet for that model, so every value
// written here also adds "os" to the product's `unsure` list and the page marks it unconfirmed.
//
// Where the line does NOT settle it, nothing is written: a Windows laptop may be sold with DOS
// (the shop's title says which only 10 times in 181), Toshiba TVs ship with three different
// systems, a Galaxy Watch Fit runs Samsung's own firmware. A field already filled is never
// overwritten.
import fs from 'node:fs';

const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const write = process.argv.includes('--write');
const year = p => +(String(p.released || '').match(/^(\d{4})/) || [])[1] || 0;

// Android phones and tablets: the maker's own interface on top, where it has had one name for as
// long as anything still on sale. Xiaomi changed MIUI to HyperOS in late 2023, so the year decides.
const SKIN = {
  Samsung: 'One UI', Honor: 'MagicOS', OPPO: 'ColorOS', Realme: 'realme UI', OnePlus: 'OxygenOS',
  Nothing: 'Nothing OS', Google: '', Sony: '', Motorola: '', Lenovo: '',
};
// Without a year the model number says it: HyperOS arrived with the Xiaomi 14, the Redmi 13 and
// Note 13, and POCO's sixth generation (C65 on the budget line).
function hyperOSEra(p) {
  const n = p.name.toLowerCase(), num = +(n.match(/(\d+)/) || [])[1] || 0;
  if (/redmi note/.test(n)) return num >= 13;
  if (/redmi/.test(n)) return num >= 13;
  if (/poco\s*c/.test(n)) return num >= 65;
  if (/poco/.test(n)) return num >= 6;
  return num >= 14;
}
const xiaomiSkin = p => year(p) >= 2024 || (!year(p) && hyperOSEra(p)) ? 'HyperOS'
  : year(p) && year(p) < 2023 ? 'MIUI' : 'HyperOS or MIUI';

function osFor(p) {
  const n = p.brand + ' ' + p.name, c = p.category;
  if (c === 'phone') {
    if (p.brand === 'Apple') return 'iOS';
    if (p.brand === 'Xiaomi') return 'Android, ' + xiaomiSkin(p);
    if (p.brand in SKIN) return 'Android' + (SKIN[p.brand] ? ', ' + SKIN[p.brand] : '');
    return null;
  }
  if (c === 'tablet') {
    if (p.brand === 'Apple') return 'iPadOS';
    if (p.brand === 'Huawei') return 'HarmonyOS';
    if (p.brand === 'Xiaomi') return 'Android, ' + xiaomiSkin(p);
    if (p.brand in SKIN) return 'Android' + (SKIN[p.brand] ? ', ' + SKIN[p.brand] : '');
    return null;
  }
  if (c === 'watch') {
    if (p.brand === 'Apple') return 'watchOS';
    if (p.brand === 'Garmin') return 'Garmin (own system)';
    if (p.brand === 'Samsung' && !/\bfit\b/i.test(n)) {
      // Galaxy Watch 4 (2021) moved from Tizen to Wear OS
      const m = n.match(/watch\s?(\d+)/i);
      if (/active|watch\s?3\b/i.test(n)) return 'Tizen';
      if ((m && +m[1] >= 4) || /\b(fe|ultra|classic)\b/i.test(n)) return 'Wear OS, One UI Watch';
    }
    if (p.brand === 'Google' && /pixel watch/i.test(n)) return 'Wear OS';
    return null;
  }
  if (c === 'tv') {
    return { Samsung: 'Tizen', LG: 'webOS', Sony: 'Google TV', TCL: 'Google TV', Xiaomi: 'Google TV', Hisense: 'VIDAA' }[p.brand] || null;
  }
  if (c === 'laptop' || c === 'desktop') {
    if (p.brand === 'Apple') return 'macOS';
    if (p.brand === 'Microsoft' && /surface/i.test(n)) return 'Windows 11';
    return null;
  }
  if (c === 'speaker') {
    if (/homepod/i.test(n)) return 'HomePod software';
    if (p.brand === 'Sonos') return 'Sonos app';
    return null;
  }
  return null;
}

const set = [], tally = {};
for (const p of phones) {
  if (p.os && !/HyperOS or MIUI/.test(p.os)) continue;   // our own undecided answer may be sharpened
  const os = osFor(p);
  if (!os || os === p.os) continue;
  p.os = os;
  p.unsure = [...new Set([...(p.unsure || []), 'os'])];
  set.push(p);
  tally[p.category] = (tally[p.category] || 0) + 1;
}
console.log(`${set.length} product(s) given an operating system:`, JSON.stringify(tally));
if (process.argv.includes('-v')) for (const p of set) console.log(`  ${p.id.padEnd(48)} ${p.os}`);
if (!write) { console.log('\npass --write'); process.exit(0); }
fs.writeFileSync('data/phones.json', JSON.stringify(phones, null, 1));
console.log('written');
