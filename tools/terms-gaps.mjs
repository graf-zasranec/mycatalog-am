// Lists the English words still showing in the Armenian and Russian spec tables.
//
//   node tools/terms-gaps.mjs          the words, most frequent first, with one example each
//   node tools/terms-gaps.mjs --check  exit 1 if any remain (the build's gate)
//
// Every spec value goes through the site's own tr() and data/terms.json, exactly as a page shows
// it; what is left in Latin letters is either a name (Snapdragon, Wi-Fi, AMOLED - product names
// stay as they are, see terms.json's _note) or a gap. NAMES holds the names.
import fs from 'node:fs';

const rd = f => fs.readFileSync(f, 'utf8');
const P = JSON.parse(rd('data/phones.json'));
const TERMS = JSON.parse(rd('data/terms.json'));
const src = rd('_app.js');
const noop = () => {};
const el = () => ({ innerHTML: '', textContent: '', value: '', hidden: false, childNodes: [{ nodeValue: '' }], children: [],
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, style: {}, dataset: {}, setAttribute: noop,
  removeAttribute: noop, getAttribute: () => null, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
  closest: () => null, focus: noop, getBoundingClientRect: () => ({}) });
const stub = { document: { addEventListener: noop, querySelector: () => el(), querySelectorAll: () => [], getElementById: () => el(),
  documentElement: el(), body: el(), createElement: () => el(), head: el() }, window: { addEventListener: noop, scrollTo: noop,
  matchMedia: () => ({ matches: false, addEventListener: noop }) }, localStorage: { getItem: () => null, setItem: noop },
  matchMedia: () => ({ matches: false, addEventListener: noop }), performance: { now: () => 0 }, setInterval: noop, setTimeout: noop,
  clearTimeout: noop, requestAnimationFrame: noop, location: { hash: '#/', replace: noop }, history: { replaceState: noop, pushState: noop },
  IMGDATA: {}, THUMBDATA: {}, COLORIMG: {}, COLORTHUMB: {}, PAGEONLY: {}, COMING: { when: {}, items: [] }, HISTORY: { points: {} },
  MERGED: {}, COMPARE_WITH: {}, DROPS: [] };
const STR = { hy: {}, ru: {}, en: {} };
for (const r of JSON.parse(rd('data/strings.json'))) { STR.hy[r.key] = r.hy; STR.ru[r.key] = r.ru; STR.en[r.key] = r.en; }
const names = ['DATA', 'STR', 'PRICES', 'VERD', 'TERMS', ...Object.keys(stub)];
const app = new Function(...names, src.slice(0, src.lastIndexOf('\nrender();')) + '; return { GROUPS, specVal, tr };')(
  P, STR, { shops: {}, offers: {} }, {}, TERMS, ...Object.values(stub));

// names, not words: they stay in Latin letters in every language
const NAMES = new Set(`apple google oneblade samsung qualcomm snapdragon mediatek helio dimensity exynos tensor kirin hisilicon unisoc tiger jlq
 adreno mali immortalis xclipse powervr img arm dxt bxm ios ipados android hyperos miui oneui one ui magicos oxygenos coloros realme
 wi fi wifi bluetooth nfc oled amoled lcd ips pls tft ltps ltpo miniled mini led poled super retina xdr dynamic promotion lte esim
 sim nano ghz mhz mp mpx nm mah usb type gorilla victus ceramic shield bionic pro max ultra plus gen lite elite gpu cpu soc hdr
 dolby vision atmos tpu ip dci display cortex apl sm mt ai npu fusion telephoto ghz
 intel nvidia geforce rtx gtx amd ryzen radeon arc uhd iris xe windows macos watchos chrome dos qled qned neo nanocell hdmi vga
 displayport thunderbolt gigabit ethernet gps corning armor oryon phoenix alice wva atm zen rdna pdaf microsd wear ppi fps ois
 mali immortalis xbox playstation huawei xiaomi celeron athlon pixelsense truedepth wuxga wqxga fhd qhd uhd sip kindle ink
 nothing sonos jbl bose dualsense imagination c-series mil-std everest sawtooth
 tws vidaa tizen webos garmin ipx usb-c cortex a x g c home wayfarer watch galaxy transitions anc headliner meta hstn iphone mmwave
 link khz cmos sony prizm dlp paperwhite audible homepod tandem prores raw log genlock mimo extreme actua boost cxtp harmonyos alexa
 assistant armorshell light hunter fluid poco dragon crystal series citation sapphire skyler fury starfire kylie edition premium airplay
 lightning sequoia pixel drop playtime flow mohs turbo earc portal pssr aux imx trichroma tvos chromeos qvga panda nappa ray-ban
 amethyst ruby water aac mbps sim graphics core for wear oneui
 mil std sub always full mesh dual pd video wireless xbox
 os on cellular grade rf`.split(/\s+/).filter(Boolean));

const gaps = new Map();
for (const p of P) for (const [, defs] of app.GROUPS) for (const [k, get] of defs) {
  const v = app.specVal(get, p);
  if (v == null) continue;
  for (const lang of ['hy', 'ru']) {
    // product names that contain an ordinary word: Intel Core i7, Intel Arc Graphics, Center Stage
    const out = app.tr(String(v), lang).replace(/\b(Intel )?Core (Ultra|i\d)\b|\b(Arc|UHD|Iris Xe|Radeon|Adreno|Iris)( \w+)? Graphics\b|\bCenter Stage\b|\bShield Glass\b|\bGorilla Glass\b|\bCrystal Glass\b|\bPrizm( [A-Z][a-z]+){1,2}\b/gi, ' ');
    for (const w of out.match(/[A-Za-z][A-Za-z-]{2,}/g) || []) {
      const lw = w.toLowerCase();
      // a hyphen can carry an Armenian or Russian ending ("SIM-ով", "ANC-ом"): the empty part is not a word
      if (NAMES.has(lw) || lw.split('-').filter(Boolean).every(x => NAMES.has(x) || /^\d/.test(x))) continue;
      const g = gaps.get(lw) || { n: 0, ex: `${p.id} ${k}: "${String(v).slice(0, 60)}"` };
      g.n++; gaps.set(lw, g);
    }
  }
}
const list = [...gaps].sort((a, b) => b[1].n - a[1].n);
for (const [w, g] of list) console.log(String(g.n).padStart(5), w.padEnd(16), g.ex);
console.log(`${list.length} English word(s) left in the Armenian / Russian spec tables`);
if (process.argv.includes('--check') && list.length) process.exit(1);
