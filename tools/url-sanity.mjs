// Does a hand row's url point at the product the row NAMES?
//
//   node tools/url-sanity.mjs
//
// Nothing else asks this. data/listings.csv carries a title and a url that were typed in by two
// separate acts, and when they disagree the site shows one shop's price under another product's
// name with a link to a third thing. Two were found by accident on 2026-09-20: the Xbox Headset
// carrying seven Xbox Controller offers, and honor-choice-ros-me01 - headphones - linked to a
// Honor X7d phone. Both had been live for weeks.
//
// Two kinds of url cannot be judged this way and are NOT reported, because a checker that cries
// wolf is a checker nobody runs:
//   * a numeric id - vlv.am/en/Product/49085 names no words at all, so it can never agree
//   * a transliterated slug - eldorado writes Yandex as "jandeks", which shares no letters
// What is left is sorted by how sure we can be, so the certain ones are read first.
import fs from 'node:fs';

const rows = fs.readFileSync('data/listings.csv', 'utf8').trim().split(/\r?\n/).slice(1)
  .map(l => l.split(',')).filter(f => f.length > 5 && f[4] && /^https?:/.test(f[4]));

const NOISE = new Set(['the', 'and', 'with', 'for', 'new', 'gb', 'tb', 'mm', 'wifi', 'wi', 'fi',
  'cellular', 'esim', 'nano', 'sim', 'dual', 'black', 'white', 'silver', 'gold', 'blue', 'green',
  'red', 'pink', 'grey', 'gray', 'purple', 'violet', 'orange', 'yellow', 'titanium', 'graphite',
  'midnight', 'starlight', 'space', 'inch', 'pro', 'max', 'plus', 'ultra', 'lite', 'mini', 'gen']);
const words = s => String(s).toLowerCase().split(/[^a-z0-9]+/)
  .filter(w => w.length > 2 && !NOISE.has(w) && !/^\d+$/.test(w));

// a url that points at a list of products rather than one product
// A url with /product/ in it is a product page whatever else the path says - 3dplanet serves
// its products under /en/store/product/..., and matching on /store/ alone called those
// category links and nearly rewrote one.
const LISTING = u => !/\/product\//i.test(u) &&
  /\/(category|categories|product-category|collection|collections|store)\/|\/(phones|speakers|headset|tablets|smartphones|notebooks|monitors)(\.html)?$/i.test(u);

const bad = [];
for (const f of rows) {
  const [shop, title, , , url] = f;
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  const t = words(title), u = new Set(words(path));
  if (!t.length) continue;
  // "/en/Product/49085" yields the word "product", so a plain emptiness test does not catch it.
  // What makes a url unjudgeable is having no word that could ever name a product.
  const PATHY = new Set(['product', 'products', 'item', 'items', 'shop', 'store', 'catalog',
    'catalogue', 'page', 'index', 'html', 'php', 'www', 'com', 'net', 'org', 'ru', 'en', 'am', 'hy']);
  if (![...u].some(w => !PATHY.has(w))) continue;           // numeric id: unjudgeable, not a fault
  const nums = String(title).match(/\d{2,}/g) || [];
  if (t.some(w => u.has(w)) || nums.some(n => url.includes(n))) continue;
  // A slug hyphenates what the name writes as one word: Ucom serves "AirPods 5" at
  // /air-pods-5.html, checked against their own h1 on 2026-09-20. Comparing letters only, with
  // every separator gone, is the general form of that.
  const bare = x => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (bare(path).includes(bare(title))) continue;
  // ...and a slug may transliterate what the name spells in Latin. eldorado writes Yandex as
  // "jandeks" and Station as "stancija" - a Russian reading of the word, romanised. These two
  // are the only ones this catalogue has met; each was confirmed against eldorado's own h1 on
  // 2026-09-20. Anything else still gets reported rather than quietly accepted.
  const TRANSLIT = { yandex: 'jandeks', station: 'stancija' };
  if (t.some(w => TRANSLIT[w] && u.has(TRANSLIT[w]))) continue;   // same 'any word agrees' bar as above
  bad.push({ shop, title, url, listing: LISTING(url) });
}

// A url repeated across rows that name different products was pasted, not looked up. That is the
// one pattern here that is certain rather than suspected, so it is reported first and counted.
const byUrl = {};
for (const b of bad) (byUrl[b.url] ||= []).push(b);
const pasted = Object.entries(byUrl).filter(([, v]) => v.length > 1 && !v[0].listing);
const listings = bad.filter(b => b.listing);
const singles = bad.filter(b => !b.listing && byUrl[b.url].length === 1);

console.log(`${rows.length} hand row(s) carry a url; ${bad.length} share no word with it\n`);
if (pasted.length) {
  console.log(`ONE URL ACROSS SEVERAL DIFFERENT PRODUCTS - pasted, not looked up:`);
  for (const [url, v] of pasted.sort((a, b) => b[1].length - a[1].length))
    console.log(`  ${String(v.length).padStart(3)} rows -> ${url}\n` +
      v.slice(0, 3).map(x => `        ${x.title.slice(0, 60)}`).join('\n') + (v.length > 3 ? '\n        ...' : ''));
  console.log();
}
if (listings.length) {
  console.log(`LINKS TO A LIST, NOT A PRODUCT (${listings.length}):`);
  for (const b of listings) console.log(`  ${b.shop.padEnd(12)} ${b.title.slice(0, 40).padEnd(42)} ${b.url.slice(0, 60)}`);
  console.log();
}
if (singles.length) {
  console.log(`ONE-OFF DISAGREEMENTS, may be transliteration (${singles.length}):`);
  for (const b of singles.slice(0, 20)) console.log(`  ${b.shop.padEnd(12)} ${b.title.slice(0, 40).padEnd(42)} ${b.url.slice(0, 60)}`);
}
if (!bad.length) console.log('  nothing to look at');
