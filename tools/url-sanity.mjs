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
  // istyle writes the product's real name into the path with the spaces percent-encoded, so an
  // un-decoded path reads as one long word and agrees with nothing.
  let path = url.replace(/^https?:\/\/[^/]+/, '');
  try { path = decodeURIComponent(path); } catch { }
  const t = words(title), u = new Set(words(path));
  if (!t.length) continue;
  // "/en/Product/49085" yields the word "product", so a plain emptiness test does not catch it.
  // What makes a url unjudgeable is having no word that could ever name a product.
  const PATHY = new Set(['product', 'products', 'item', 'items', 'shop', 'store', 'catalog',
    'catalogue', 'page', 'index', 'html', 'php', 'www', 'com', 'net', 'org', 'ru', 'en', 'am', 'hy']);
  if (![...u].some(w => !PATHY.has(w))) continue;           // numeric id: unjudgeable, not a fault
  // A model code - letters AND digits together, five characters or more - is the one thing in a
  // title that names exactly one product: 25062PC34G, 90NB11D1-M00N40, L65MA-ARU, 83GS00E6RK.
  // When the row carries one and the url carries a different one, no amount of shared vocabulary
  // makes them the same thing. "POCO M7 6GB/128GB (25062PC34G)" against a url ending
  // -redmi-pad-2-4gb-128gb-ru-25040rp0ag- shared the word "128gb" and passed on that alone, and
  // 43 eldorado rows were sitting behind a link to some other product because of it.
  // Five characters or more, at least three digits and at least two letters, and not a capacity.
  // That bar keeps 25062PC34G, 90NB11D1, M00N40, NZ0147, RP473 and 83GS00E6RK, and rejects the
  // things that look like codes and name a whole family instead: 256GB, 12GB, iphone17, S26, A17.
  // Ucom sells every capacity and colour of a phone from one page, and those links are RIGHT.
  const codes = s => (String(s).toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(c => c.length >= 5 && (c.match(/\d/g) || []).length >= 3
      && (c.match(/[a-z]/g) || []).length >= 2 && !/^\d+[gtmk]b$/.test(c));
  const tc = codes(title), uc = codes(path);
  const codeAgrees = tc.some(c => uc.some(x => x === c || x.includes(c) || c.includes(x)));
  if (tc.length && uc.length && !codeAgrees) { bad.push({ shop, title, url, listing: LISTING(url), code: true }); continue; }
  if (codeAgrees) continue;
  // A bare number is far weaker evidence than a code, and two digits is no evidence at all -
  // every capacity in the catalogue shares "128" with every other.
  // A model year is not evidence either: a 2026 television and a 2026 laptop share it, and four
  // Xiaomi TVs sat behind a link to an Honor MagicBook on the strength of that one number.
  const nums = (String(title).match(/\d{4,}/g) || []).filter(n => !/^(19|20)\d\d$/.test(n));
  // ...and a slug may run a word straight into its number: Ucom serves the iPhone 17 at
  // /en/iphone17.html, so "iphone" never appears as a word of its own in that path.
  if (t.some(w => u.has(w) || [...u].some(x => x.startsWith(w) || w.startsWith(x)))
      || nums.some(n => url.includes(n))) continue;
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

/* ============ repairing the eldorado and zigzag ones from the shop's own catalogue ============
   Reporting a wrong link only moves the work; for these two shops the right link is already on
   disk. tools/{eldorado,zigzag}-fetch.py leaves the shop's whole listing - url, title, price -
   in data/*.json, and a title carries the model code that names exactly one product in it. So
   the repair is a lookup, not a search: find the listing whose title or url carries a code this
   row names, and only rewrite when exactly ONE product answers.
     node tools/url-sanity.mjs --fix       rewrite them
     node tools/url-sanity.mjs --fix --dry say what it would rewrite                            */
if (process.argv.includes('--fix')) {
  const dry = process.argv.includes('--dry');
  const tidy = u => String(u || '').trim().replace(/\/+$/, '').toLowerCase();
  // Looser than the code test above on purpose. Up there a code is compared against a url and
  // has to stand alone; here it is looked up in one shop's own catalogue, which is a far stronger
  // test - if "l43mb" names one product at eldorado, it names one product.
  const key = s => (String(s).toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(c => c.length >= 4 && /\d/.test(c) && /[a-z]/.test(c) && !/^\d+[gtmk]b$/.test(c)
      && !/^(19|20)\d\d$/.test(c));
  let done = 0, ambiguous = 0, nohit = 0;
  const changed = new Map();
  for (const [shop, file] of [['eldorado', 'data/eldorado.json'], ['zigzag', 'data/zigzag.json']]) {
    let list = [];
    try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const idx = new Map();
    for (const c of list) {
      if (!c || !c.url) continue;
      for (const k of new Set([...key(c.title), ...key(c.url.split('/').pop())]))
        (idx.get(k) || idx.set(k, new Set()).get(k)).add(c.url);
    }
    for (const f of rows) {
      if (f[0] !== shop) continue;
      const ks = key(f[1]);
      if (!ks.length) continue;
      if (ks.some(k => tidy(f[4]).includes(k))) continue;        // the link already names it
      const hits = new Set();
      for (const k of ks) for (const u of idx.get(k) || []) hits.add(u);
      if (!hits.size) { nohit++; continue; }
      let cand = [...hits];
      // The same model in six colours is six urls carrying the same code. The row names its
      // colour, and the shop writes it into the slug, so that is what tells them apart.
      if (cand.length > 1) {
        const col = String(f[3] || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2);
        const m = col.length ? cand.filter(u => col.every(w => tidy(u).includes(w))) : [];
        if (m.length === 1) cand = m;
      }
      if (cand.length > 1) { ambiguous++; continue; }              // two answers is no answer
      const to = cand[0];
      if (tidy(to) === tidy(f[4])) continue;                       // already there
      console.log(`  ${f[1].slice(0, 44).padEnd(46)}\n      ${f[4].slice(-58)}\n   -> ${to.slice(-58)}`);
      changed.set(f[0] + '|' + f[4] + '|' + f[1], to);
      done++;
    }
  }
  console.log(`\n${done} link(s) the shop's own catalogue answers${dry ? ' (dry)' : ''}` +
    `, ${ambiguous} with more than one answer, ${nohit} it does not list`);
  if (done && !dry) {
    // Re-read and rewrite line by line, keyed on shop+url+title, so anything added meanwhile stays.
    const now = fs.readFileSync('data/listings.csv', 'utf8').split('\n');
    let n = 0;
    const out = now.map((l, i) => {
      if (!i || !l.trim()) return l;
      const f = l.split(',');
      const to = f.length > 5 && changed.get(f[0] + '|' + f[4] + '|' + f[1]);
      if (!to) return l;
      f[4] = to;
      // the price and the date belonged to the OLD page, and this row has never seen the new one
      while (f.length < 9) f.push('');
      f[8] = '';
      n++;
      return f.join(',');
    });
    fs.writeFileSync('data/listings.csv', out.filter(l => l.trim()).join('\n') + '\n');
    console.log(`${n} row(s) relinked in data/listings.csv; their seen date is cleared - run tools/confirm-hand.mjs to price them against the page they now point at`);
  }
}
