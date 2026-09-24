// Runs the real _app.js under Node and asserts the behaviour the browser depends on.
//
//   node tools/app-test.mjs        (build.mjs runs this too, so a bad build fails loudly)
//
// Until now every check lived in scrape.mjs and build.mjs: the scraper was well covered and the
// 1800 lines the visitor actually touches were not. Three bugs shipped from there in one day -
// the SIM picker reading an unlabelled offer as a tray, "Where you save most" comparing two
// different configurations, and category counts left stale after the search box was cleared.
// None of them would have survived an assertion. _app.js only touches the DOM through seven
// listeners, so the whole file loads here behind a stub rather than being sliced up.
import fs from 'node:fs';

const rd = f => fs.readFileSync(f, 'utf8');
const phones = JSON.parse(rd('data/phones.json'));
const prices = JSON.parse(rd('data/prices.json'));
// shaped exactly as build.mjs shapes it, so the app sees what it sees in the browser
const STR = { hy: {}, ru: {}, en: {} };
for (const r of JSON.parse(rd('data/strings.json'))) { STR.hy[r.key] = r.hy; STR.ru[r.key] = r.ru; STR.en[r.key] = r.en; }
const VERD = {};
for (const { id, ...r } of JSON.parse(rd('data/verdicts.json'))) VERD[id] = r;
const TERMS = JSON.parse(rd('data/terms.json'));

const noop = () => {};
const el = () => ({ innerHTML: '', textContent: '', value: '', className: '', classList: { add: noop, remove: noop, contains: () => false },
  style: {}, dataset: {}, hidden: false, setAttribute: noop, removeAttribute: noop, getAttribute: () => null,
  focus: noop, blur: noop, appendChild: noop, insertAdjacentHTML: noop, scrollIntoView: noop, click: noop,
  addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], closest: () => null,
  getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }) });

const stub = {
  document: { addEventListener: noop, querySelector: () => el(), querySelectorAll: () => [],
              getElementById: () => el(), documentElement: el(), body: el(), title: '', hidden: false,
              createElement: () => el(), head: el() },
  window: { addEventListener: noop, scrollTo: noop, scrollY: 0, innerHeight: 800, matchMedia: () => ({ matches: false, addEventListener: noop }) },
  localStorage: { getItem: () => null, setItem: noop },
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  performance: { now: () => 0 },
  setInterval: noop, setTimeout: noop, clearTimeout: noop, requestAnimationFrame: noop,
  location: { hash: '#/', href: '' }, history: { scrollRestoration: 'auto', replaceState: noop, pushState: noop },
  IMGDATA: {}, COLORIMG: {}, PAGEONLY: {}, COMING: { when: {}, items: [] },
  HISTORY: { points: {} },
};

// hand the module its data the same way build.mjs does, then ask for the pieces under test
const names = ['DATA', 'STR', 'PRICES', 'VERD', 'TERMS', ...Object.keys(stub)];
const vals = [phones, STR, prices, VERD, TERMS, ...Object.values(stub)];
const exports_ = `; return { hayMatch, bestTier, visibleOffers, matches, offersFor, bestOf,
  activeFilterCount, seenTag, pageCount, hay, fullName, sold,
  GROUPS, specVal, filterBar, askable, keepsQuery, waterOf, mpOf, hoursOf, cpuOf, bandCuts, shopRows, cdText, unsureRow,
  get st(){return st}, set st(v){st = v}, get SEL(){return SEL}, set SEL(v){SEL = v}, PMIN, PMAX };`;
// The file ends by painting the page. There is no page here, and a stub DOM deep enough to
// satisfy the renderer would be a second implementation to keep in step with the first - so the
// bootstrap call is dropped and the functions are exercised directly. Everything above it,
// including the listener wiring, still runs.
const whole = rd('_app.js');
const MARK = '\nrender();';
const cut = whole.lastIndexOf(MARK);
const src = cut > 0 ? whole.slice(0, cut) : whole;
const app = new Function(...names, src + exports_)(...vals);

let bad = 0, n = 0;
const is = (got, want, what) => {
  n++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { bad++; console.log(`FAIL  ${what}\n  got  ${g}\n  want ${w}`); }
};

/* --- search: every word counts, in any order ------------------------------------------ */
const fold8 = phones.find(p => p.id === 'samsung-galaxy-z-fold-8');
is(app.hayMatch(fold8, 'samsung fold'), true, 'two words, not contiguous, still match');
is(app.hayMatch(fold8, 'fold samsung'), true, 'word order does not matter');
is(app.hayMatch(fold8, ''), true, 'an empty query matches everything');
is(app.hayMatch(fold8, 'samsung flip'), false, 'a word that is absent fails the whole query');

/* --- savings: the two prices must be the same thing ------------------------------------ */
const tierOf = offs => {
  const fake = { id: 'x', variants: [{ storage: 256, ram: 8 }, { storage: 512, ram: 8 }] };
  prices.offers.x = offs;
  const r = app.bestTier(fake);
  delete prices.offers.x;
  return r;
};
is(tierOf([{ id: 'x', price: 500, storage: 256, esim: true }, { id: 'x', price: 900, storage: 256, esim: false }]),
   null, 'an eSIM price and a tray price are not a saving');
is(tierOf([{ id: 'x', price: 500, storage: null }, { id: 'x', price: 900, storage: null }]),
   null, 'unstated capacity on a product sold in two sizes is not a saving');
is(tierOf([{ id: 'x', price: 500, storage: 256, esim: true }, { id: 'x', price: 700, storage: 256, esim: true }])?.gap,
   200, 'two eSIM prices at one capacity are');

/* --- the SIM picker: three states, not two --------------------------------------------- */
const p17 = phones.find(p => p.id === 'apple-iphone-17-pro-max');
app.SEL = { id: p17.id, color: null, storage: null, ram: null, esim: false };
const trays = app.visibleOffers(p17);
is(trays.every(o => o.esim === false), true, 'the tray button shows only offers that state a tray');
app.SEL = { ...app.SEL, esim: true };
is(app.visibleOffers(p17).every(o => o.esim === true), true, 'the eSIM button shows only stated eSIM');
const unstated = app.offersFor(p17).filter(o => o.esim === undefined).length;
is(unstated > 0 && trays.length < app.offersFor(p17).length, true,
   'an offer whose build nobody stated backs neither button');

/* --- the tray always costs more -------------------------------------------------------- */
// Per shop, and only per shop: a shop charges more for the tray build than for the eSIM build of
// the same phone at the same capacity. Across shops it says nothing - iBolit's 512 GB tray at
// 445,000 is under Pixel's 512 GB eSIM at 465,000 because iBolit is cheaper, not because either
// price is wrong, and comparing the two cheapest numbers in the country reported that as a bug.
for (const p of phones) {
  const offs = app.offersFor(p);
  for (const c of new Set(offs.map(o => o.storage))) {
    // Colour too. iBolit sells the iPhone 18 Pro 256 GB tray in Glacier, Silver and Black at
    // 799,000 and the eSIM only in Burgundy at 879,000: there is no colour it sells both ways,
    // so the 80,000 between them is a colour difference, a SIM difference, or both, and nothing
    // on either page separates them. Comparing them anyway invents a reading of that gap.
    for (const s of new Set(offs.map(o => o.shop))) for (const col of new Set(offs.map(o => o.color))) {
      const at = offs.filter(o => o.storage === c && o.shop === s && o.color === col);
      const e = at.filter(o => o.esim === true).map(o => o.price);
      const t = at.filter(o => o.esim === false).map(o => o.price);
      if (!e.length || !t.length) continue;
      n++;
      if (Math.min(...t) <= Math.min(...e)) { bad++; console.log(`FAIL  ${p.id} ${c} at ${s}: tray ${Math.min(...t)} is not above eSIM ${Math.min(...e)}`); }
    }
  }
}

/* --- filters and paging ---------------------------------------------------------------- */
app.st = { ...app.st, brands: [], scrs: [], pmin: app.PMIN, pmax: app.PMAX, ram: 0, stor: 0, batt: 0, hz: 0, g5: false, nfc: false };
is(app.activeFilterCount(), 0, 'nothing selected counts as no filters');
app.st = { ...app.st, brands: ['Apple'], g5: true };
is(app.activeFilterCount(), 2, 'the button counts what is actually narrowing the list');
is([app.pageCount(0), app.pageCount(36), app.pageCount(37)], [1, 1, 2], 'paging rounds up and never returns 0');

/* --- freshness is not borrowed --------------------------------------------------------- */
const today = (prices.generated || '').slice(0, 10);
is(app.seenTag({ seen: today }), '', 'a price read today needs no tag');
is(/by hand|ձեռքով|вручную/.test(app.seenTag({})), true, 'a hand-recorded price says so');
is(/\d\d\.\d\d/.test(app.seenTag({ seen: '2026-01-09' })), true, 'an older price shows its own day');

/* --- filters are questions about THIS category ----------------------------------------- */
// A pair of AirPods has no RAM and no screen. The bar used to offer both because the numbers
// varied across whatever happened to be in view, which is not the same as the question making
// sense. These read the real bar, so a new category cannot quietly reintroduce it.
const barKeys = cat => {
  app.st = { ...app.st, cat, fopen: true, q: '' };
  const h = app.filterBar();
  return [...h.matchAll(/data-drop="([^"]+)"/g)].map(m => m[1])
    .concat([...h.matchAll(/class="toggle" data-f="([^"]+)"/g)].map(m => m[1]))
    .filter(k => k !== 'sort');
};
const hasNone = (keys, banned) => banned.filter(k => keys.includes(k));
is(hasNone(barKeys('headphones'), ['ram', 'stor', 'batt', 'hz', 'scr']), [], 'headphones are not asked about RAM or screens');
is(hasNone(barKeys('watch'), ['ram', 'batt', 'hz', 'cam']), [], 'a watch is not asked about refresh rate or RAM');
is(hasNone(barKeys('laptop'), ['hz', 'cam', 'g5', 'nfc']), [], 'a laptop is not asked about 5G or cameras');
is(barKeys('phone').includes('cam'), true, 'phones are asked about the camera');
is(barKeys('laptop').includes('cpu') && barKeys('laptop').includes('gpu'), true, 'laptops are asked about CPU and GPU');
is(barKeys('headphones').includes('anc'), true, 'headphones are asked about noise cancelling');
// e-catalog's headphone column: what kind, wired or not, which plug, gaming
is(['hform', 'hconn', 'hplug', 'gaming'].filter(k => !barKeys('headphones').includes(k)), [], 'headphones are asked type, connection, connector, gaming');
is(barKeys('speaker').includes('spk'), true, 'speakers are asked what kind');
is(barKeys('laptop').includes('res'), true, 'laptops are asked the screen resolution');
is(phones.filter(p => p.category === 'earbuds').map(p => p.id), [], 'earbuds and headphones are one section');
is(phones.filter(p => p.category === 'headphones' && !p.audio?.form).map(p => p.id), [], 'every headphone has a type (node tools/audio.mjs)');
const wired = phones.filter(p => p.audio?.conn === 'wired').map(p => p.id);
is(['apple-earpods-usb-c', 'samsung-eo-ic100-usb-type-c'].filter(id => !wired.includes(id)), [], 'EarPods and the Samsung Type-C earphones are wired');
// With no category chosen the page is showing phones beside fridges: only the questions that
// apply to a purchase rather than to hardware survive.
// With no category the bar used to offer nothing but brand, price and shop, which read as a
// catalogue that had lost its filters. It offers the spec questions now; what protects the
// AirPods from a RAM filter is still the rule below - the items in view have to DIFFER on it.
is(barKeys('').length > 3, true, 'the whole catalogue can still be asked spec questions');
is(hasNone(barKeys('headphones'), ['ram', 'stor', 'cpu', 'gpu']), [], 'headphones are not asked about RAM or CPUs');
is(barKeys('').includes('shop'), true, 'the shop filter applies everywhere');
app.st = { ...app.st, cat: '', fopen: false };

// Construct asks the same questions the bar does, so a watch is not asked about milliamp-hours
is([app.askable('batt','watch'), app.askable('hz','watch'), app.askable('touch','laptop'), app.askable('touch','phone')],
   [false, false, true, false], 'Construct and the filter bar agree on what a category can be asked');

/* --- screen bands are cut from the category, not from phones --------------------------- */
const pb = app.bandCuts('phone'), lb = app.bandCuts('laptop');
is(pb[1] < 9 && lb[0] > 9, true, 'a laptop band is not a phone band');

/* --- the readings behind the new filters ----------------------------------------------- */
const w = ip => app.waterOf({ body: { ip } });
is([w('IP68'), w('IPX4'), w('IP52'), w('5 ATM'), w('IP6X, 50 m water resistant'), w('')],
   ['dip', 'splash', null, 'dip', 'dip', null], 'water resistance reads the water digit, not the dust one');
is(app.mpOf({ camera: { main: '48MP Fusion, 24mm, f/1.78, OIS' } }), 48, 'the main camera number');
is(app.mpOf({ camera: {} }), null, 'no camera block, no number invented');
is(app.hoursOf({ battery: { life: '8.5 hours (30 with the case)' } }), 8.5, 'battery life is the buds\' own figure');
is(app.cpuOf({ chipset: { name: 'Intel Core i5-13500H' } }), 'Intel Core i5', 'CPU cut at the tier');
is(app.cpuOf({ chipset: { name: 'Apple M5 Pro' } }), 'Apple M5 Pro', 'M5 Pro is not an M5');

/* --- a card shows one price per shop, cheapest first ------------------------------------ */
const withOffers = phones.find(p => new Set((prices.offers[p.id] || []).map(o => o.shop)).size > 2);
const rws = app.shopRows(withOffers, 3);
is(new Set(rws.map(r => r[0])).size, rws.length, 'one row per shop');
is(rws.map(r => r[1]).every((v, i, a) => !i || v >= a[i - 1]), true, 'cheapest shop first');

/* --- a figure the data flags as unconfirmed says so ------------------------------------ */
const uns = { unsure: ['battery.capacity', 'connectivity'] };
is(app.unsureRow(uns, 'f.capacity'), true, 'an unconfirmed field is marked');
is(app.unsureRow(uns, 'f.wifi'), true, 'a whole unconfirmed block covers its rows');
is(app.unsureRow(uns, 'f.weight'), false, 'a confirmed field is not marked');
is(app.unsureRow({}, 'f.capacity'), false, 'nothing flagged, nothing marked');

/* --- no spec cell prints a formatted hole ---------------------------------------------- */
// The comparison read the getters raw and showed "undefined × undefined × undefined mm" and
// "NaN mAh" for every laptop and earbud missing a field. Every getter, every product.
const holes = [];
for (const p of phones) for (const [, defs] of app.GROUPS) for (const [k, get] of defs) {
  const v = app.specVal(get, p);
  if (v != null && /undefined|NaN|null/.test(String(v))) holes.push(p.id + ' ' + k);
}
is(holes.slice(0, 3), [], 'no spec value renders undefined / NaN / null');
is(app.specVal(p => p.body.height + ' mm', { body: {} }), null, 'a missing dimension is no row, not "undefined mm"');
is(app.specVal(() => { throw 0; }, {}), null, 'a getter that throws is no row');

/* --- the countdown counts down, and stops ---------------------------------------------- */
is(app.cdText('2000-01-01'), '', 'a date that has passed shows no clock');
is(/\d/.test(app.cdText(new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10))), true, 'a future date shows a figure');

/* --- the search box does not follow you home ------------------------------------------- */
is(app.keepsQuery('/search'), true, 'the results page keeps the query');
is(app.keepsQuery('/p/apple-iphone-17'), true, 'so does a product, so back returns to results');
is(app.keepsQuery('/'), false, 'the front page does not');
is(app.keepsQuery(''), false, 'nor does a bare url');
is(app.keepsQuery('/c/phone'), false, 'nor does a category');

console.log(bad ? `${bad} of ${n} app checks FAILED` : `app self-test: ${n} checks pass`);
process.exit(bad ? 1 : 0);
