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
for (const p of phones) {
  const offs = app.offersFor(p);
  const caps = new Set(offs.map(o => o.storage));
  for (const c of caps) {
    const e = offs.filter(o => o.storage === c && o.esim === true).map(o => o.price);
    const t = offs.filter(o => o.storage === c && o.esim === false).map(o => o.price);
    if (!e.length || !t.length) continue;
    n++;
    if (Math.min(...t) <= Math.min(...e)) { bad++; console.log(`FAIL  ${p.id} ${c}: tray ${Math.min(...t)} is not above eSIM ${Math.min(...e)}`); }
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

console.log(bad ? `${bad} of ${n} app checks FAILED` : `app self-test: ${n} checks pass`);
process.exit(bad ? 1 : 0);
