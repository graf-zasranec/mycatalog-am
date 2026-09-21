// Collects real smartphone prices from Armenian online shops into data/prices.json.
//
//   node scrape.mjs            all shops
//   node scrape.mjs ispace     one shop
//   node scrape.mjs vlv allsell   several
//
// Politeness / rules this respects:
//   * vega.am disallows ?limit= ?sort= ?order= ?search= — only ?page= is used.
//   * zigzag.am and eldorado.am 403 a plain fetch. Both allow product pages in robots.txt and
//     name no crawler they refuse, so tools/{zigzag,eldorado}-fetch.py read them with scrapling.
//   * yerevanmobile.am and zigzag.am disallow every URL with a query string, so neither is
//     paginated or searched — only clean paths.
//   * ispace.am publishes llms.txt pointing AI clients at /category/* — that is what is used.
//   * one request at a time per host, with a delay between them.
//
// If a shop changes its markup an adapter returns 0 offers and says so. It never guesses:
// a phone with no offers keeps its estimated price in phones.json and is labelled as such.

import fs from 'node:fs';

const UA = 'ImpulseBot/0.1 (+price comparison; respects robots.txt)';   // tools/*.mjs use the same string
const DELAY_MS = 400;
const TIMEOUT_MS = 30000;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s).toLowerCase().split(String.fromCharCode(43)).join(" plus ").replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

async function vlvPrice(vid) {
  try {
    const r = await fetch(`https://vlv.am/api/product-info/${vid}`, { method: 'POST', redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': UA, 'content-type': 'application/json', accept: 'application/json' }, body: '{}' });
    if (!r.ok) return 0;
    const t = await r.text();
    // Regex literals, not RegExp(string): a built-up pattern needs the backslash doubled, and
    // getting that wrong fails silently - every product falls back and the fix looks applied.
    const promo = Number((t.match(/"promo_price":(\d+)/) || [])[1]) || 0;
    const sell = Number((t.match(/"selling_price":(\d+)/) || [])[1]) || 0;
    return promo || sell;
  } catch { return 0; }
}

// The status of the last request, for the one caller that needs to tell "this page is gone"
// from "the network hiccuped". A retry can fix the second; nothing fixes the first.
let LAST_STATUS = 0;
async function get(url, tries = 2) {
  LAST_STATUS = 0;
  for (let i = 0; i < tries; i++) {
    try {
      const c = AbortSignal.timeout(TIMEOUT_MS);
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*' }, signal: c, redirect: 'follow' });
      LAST_STATUS = r.status;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      // A 404 is an answer. Asking again wastes a request and the wait in front of it.
      if (LAST_STATUS >= 400 && LAST_STATUS < 500) { console.warn('    ! ' + url.slice(0, 90) + ' -> ' + e.message); return ''; }
      if (i === tries - 1) { console.warn('    ! ' + url.slice(0, 90) + ' -> ' + e.message); return ''; }
      await sleep(1200);
    }
  }
  return '';
}

/* ---------- phone matching ---------- */
const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const fullName = p => p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.name : p.brand + ' ' + p.name;

// each phone gets one or more keys; the LONGEST key that matches a listing wins,
// so "iphone 17" never steals a listing for "iphone 17 pro max".
const KEYS = [];
for (const p of phones) {
  const V = new Set();
  const add = k => {
    k = norm(k);
    if (!k) return;
    V.add(k);
    if (/ 5g$/.test(k)) V.add(k.replace(/ 5g$/, ''));   // shops often drop the "5G"
  };
  add(fullName(p));
  // shops write some names differently ("Apple Watch SE GPS Gen.3"). An item can list the
  // spellings it also answers to rather than us loosening the matcher for everyone.
  for (const al of p.aliases || []) add(al);
  // shops usually omit the brand in slugs ("iphone-17-pro-...", "galaxy-s25-ultra-...").
  // only trust a brand-less key when it is specific enough to stand alone.
  // Operator shops drop "Galaxy" from the slug: telecomarmenia writes samsung-a37-6-128-graygreen
  // and samsung-s26ultra-12-512gb-skyblue, never "galaxy".
  if (/^galaxy /i.test(p.name)) add(p.brand + ' ' + p.name.replace(/^galaxy /i, ''));
  const bare = norm(p.name);
  if (bare.length >= 8 && bare.includes(' ')) add(bare);   // "iphone 17 pro", "iphone air"
  else if (bare.length >= 5 && /\d/.test(bare)) add(bare);
  for (const k of V) KEYS.push({ id: p.id, key: k, full: norm(fullName(p)) });
}
KEYS.sort((a, b) => b.key.length - a.key.length);

// space-delimited containment == whole-token matching, without regex escaping traps.
// " apple iphone 17e " does NOT contain " iphone 17 ", so the 17e never lands on the 17.
// Model words that turn a phone into a DIFFERENT phone. Keys are tried longest-first, so if
// one of these still trails the best match, the listing is a variant we don't carry -> no match.
// Without this, "Apple iPhone 16 Pro Max" would be priced as an iPhone 16.
// 'xl' earns its place here: telecomarmenia's "Google Pixel 10 Pro XL" was being priced as a
// Pixel 10 Pro, which is a different, cheaper phone.
const QUALIFIERS = new Set(['pro', 'max', 'plus', 'ultra', 'mini', 'air', 'fe', 'lite', 'neo', 'edge', 'e', 'se', 'xl', 'fold', 'flip']);

// The mirror of QUALIFIERS, for words that PRECEDE the match. Xiaomi calls its flagship
// "17 Pro Max", which earns a brand-less bare key, and that key sits inside "Redmi Note 17 Pro
// Max" - a different phone at a third of the price. It was the flagship's best offer on the live
// site: 174,900 against a real 559,000. A prefix only disqualifies a key that does not carry the
// word itself, so "Redmi Note 14 Pro" still matches its own product.
const PREFIXES = new Set(['note', 'redmi', 'poco', 'nord']);

// A second-hand phone is not the product. The catalogue prices new stock only, and
// ibolit's "used-17-pro-max-256-blue" was sitting in the Xiaomi 17 Pro Max's offer list.
const SECONDHAND = ['used', 'refurbished', 'renewed', 'preowned', 'уценка', 'восстановленный'];

// Shops list accessories under the phone's own name ("Clear Case with MagSafe for iPhone 15"),
// and those were being priced AS the phone. Anything that names an accessory, or is sold
// "for" a phone, is not the phone.
// Plain substring list rather than one big regex: an alternation that silently breaks in
// editing means accessories get priced as phones, which is exactly what happened.
const ACCESSORY_WORDS = [
  // Things sold FOR a device. airpods / apple watch / headphone / earphone / headset used to
  // live here; they are catalogue categories now, so rejecting them would hide real products.
  // NOT 'glass': the iPad Pro is sold with 'standard glass' / 'nano-texture glass'.
  // Screen protectors are still caught by protector / protection / tempered / պաշտպան / защит.
  'case', 'cover', 'bumper', 'sleeve', 'pouch', 'wallet', 'folio', 'protector',
  'protection', 'tempered', 'film', 'skin', 'charger', 'charging', 'cable', 'adapter',
  'adaptor', 'dock', 'holder', 'mount', 'strap', 'lens', 'magsafe', 'powerbank', 'power bank',
  'airtag', 'pencil', 'keyboard', 'stylus', 'dongle', 'hub',
  'պատյան', 'պաշտպան', 'լիցքավոր', 'մալուխ', 'ադապտեր',
  'чехол', 'защит', 'кабел', 'зарядн', 'адаптер', 'держател',
  'накладк', 'бампер', 'пленк', 'плёнк'
];
// a phone is never sold "for" another phone
const FOR_WORDS = [' for iphone', ' for galaxy', ' for redmi', ' for poco', ' for pixel',
  ' for honor', ' for realme', ' for oneplus', ' for xiaomi',
  ' для iphone', ' для galaxy', ' для redmi', ' для xiaomi'];
// No regex here on purpose: every escaped pattern written into this file so far has lost its
// backslashes in editing, and a silently-broken normaliser means accessories pass as phones.
// A letter is any char whose upper and lower case differ - true for Latin, Cyrillic, Armenian.
function tokenized(text) {
  let out = ' ';
  for (const ch of String(text).toLowerCase()) {
    const isLetter = ch.toLowerCase() !== ch.toUpperCase();
    const isDigit = ch >= '0' && ch <= '9';
    out += (isLetter || isDigit) ? ch : ' ';
  }
  return out + ' ';
}
function looksLikeAccessory(text) {
  const h = tokenized(text).replace(/  +/g, ' ');
  if (ACCESSORY_WORDS.some(w => h.includes(' ' + w + ' '))) return true;
  if (FOR_WORDS.some(w => h.includes(w + ' '))) return true;
  return false;
}
// Which shop is being crawled right now, so a title nothing in the catalogue answers to can be
// filed under it. Deciding what to add next used to be guesswork; this makes it a reading.
let CURSHOP = '';
const MISSED = new Map();
// data/links.csv, column 0 against column 9: the id a human gave a shop page. Most call sites
// below pass the url either alone or glued to the shop's title, so the url is read back out of
// whatever was handed in rather than asking all twenty-odd of them to pass it separately.
const PINS = new Map();
// ...and column 6, the SIM build, when it is written with a '!' after it. A shop can state the
// build wrongly on its own page: iBolit slugs the iPhone 18 Pro eSIM build '...-256gb-sim-...'
// and the tray build '...-esim-...', so every reading off that url is backwards and no amount of
// care with the words can recover it. Without the bang the column is just what the crawl derived
// and is re-derived freely; with it, somebody checked.
const SIMPINS = new Map();
try {
  const seenTwice = new Set();
  for (const line of fs.readFileSync('data/links.csv', 'utf8').trim().split(/\r?\n/).slice(1)) {
    const c = line.split(',');
    if (!c[9]) continue;
    // A url two different products answer to names no single product, so it settles nothing. The
    // file should not contain one, and a pin taken from one would be applied to every row it
    // touches: 128 Yerevan Mobile rows share one .../tablets.html.
    if (PINS.has(c[9]) && PINS.get(c[9]) !== c[0]) { seenTwice.add(c[9]); continue; }
    if (c[0]) PINS.set(c[9], c[0]);
    if (c[6] === 'esim!' || c[6] === 'nano!') SIMPINS.set(c[9], c[6] === 'esim!');
  }
  for (const u of seenTwice) { PINS.delete(u); SIMPINS.delete(u); }
  if (seenTwice.size) console.warn(`links.csv: ${seenTwice.size} url(s) name more than one product - not pinned`);
} catch (e) { if (e.code !== 'ENOENT') console.warn('links.csv:', e.message); }
const urlIn = text => String(text).match(/https?:\/\/\S+/)?.[0].replace(/[),.;]+$/, '');
function pinnedId(text) {
  const u = urlIn(text);
  return u ? PINS.get(u) : undefined;
}
// A phone sold with earbuds in the box is neither product at either product's price. Vega's
// "...poco-c85-8gb-256gb-green-plus-redmi-buds-6-active-25078pc3eg" used to match nothing only
// because the catalogue did not carry the POCO C85; now that it does, the bundle would hand that
// phone a price that includes a pair of earbuds.
//
// What marks a bundle is a joining word with a real model name on BOTH sides. "Galaxy S26+"
// tokenises to "galaxy s26 plus" with nothing after the joiner, and "Redmi Note 13 Pro+ 5G"
// leaves only "5g" - one token, which is a radio, not a product. Two tokens and a digit-bearing
// model on the right is a second thing in the box.
function looksLikeBundle(text) {
  const h = tokenized(text).replace(/  +/g, ' ');
  for (const j of [' plus ', ' and ', ' with ']) {
    const at = h.indexOf(j);
    if (at < 0) continue;
    const left = h.slice(0, at).trim(), right = h.slice(at + j.length).trim();
    const words = right.split(' ').filter(Boolean);
    if (words.length < 2 || left.split(' ').filter(Boolean).length < 2) continue;
    // a second product names itself: a word of its own and a number belonging to it
    if (words.some(w => /^[a-z]{3,}$/.test(w)) && words.some(w => /\d/.test(w))) return true;
  }
  return false;
}
function matchPhone(text, meta) {
  // A human reading data/links.csv and correcting the id column has settled this page for good.
  // Checked before every heuristic below, because a heuristic is a guess and this is a reading:
  // no amount of cleverness about titles should be allowed to re-open a question already answered.
  // '-' in that column says "not a product this catalogue carries", which is also an answer.
  const pin = pinnedId(text);
  if (pin !== undefined) return pin === '-' ? null : pin;
  if (looksLikeAccessory(text)) return null;
  if (looksLikeBundle(text)) return null;
  const h = tokenized(text).replace(/  +/g, ' ');
  if (SECONDHAND.some(w => h.includes(' ' + w + ' '))) return null;
  // Shops compress the model in a slug ("samsung-s26ultra", "google-pixel10"). Splitting the
  // digit/letter joins gives an ordinary title back unchanged and recovers the model name from a
  // compressed one, so each reading gets its own attempt instead of loosening the matcher.
  const base = norm(text);
  // A shop writes the configuration in the middle of the name - "Pro 11 512GB WiFi 2024 Space
  // Black" - so the model and the year it is sold by never sit next to each other. Dropping the
  // capacity and the radio puts them back together. Tried LAST, so an exact reading always wins.
  const lean = base.replace(/\b\d+\s?(gb|tb)\b|\bwi ?fi\b|\b5g\b|\blte\b|\bcellular\b/g, ' ')
                   .replace(/\s+/g, ' ').trim();
  // The split readings are guesses about a compressed slug, so they are held to a stricter
  // rule than the shop's own words: see matchIn.
  // Apple's part number sits in the MIDDLE of the name on half these shelves - "MacBook Air 15
  // MC6K4 M4 24GB,512GB Starlight", "iPad Air 13 M3 WiFi 128GB Starlight /MCNK4*" - and a key is
  // read as a run of consecutive words, so "macbook air 15 m4" is not in that title at all. Two
  // readings put it back: drop the " /PARTNO" tail some shops append, and drop a bare five-
  // character letters-and-digits token, which is the shape of an Apple part number and of almost
  // nothing else. Tried LAST of all, after every exact reading has had its turn, so a real model
  // name of that shape - and there are none this short - could not be thrown away while it still
  // had a chance to match.
  const detail = base.replace(/\s*\/\s*[a-z0-9*\/-]+\s*$/i, ' ')
                     .replace(/(^|\s)(?=[a-z]*\d)(?=\d*[a-z])[a-z0-9]{5}(?=\s|$)/g, ' ')
                     .replace(/\s+/g, ' ').trim();
  const tries = [[base, false], [base.replace(/(\d)([a-z])/g, '$1 $2'), true],
                 [base.replace(/([a-z])(\d)/g, '$1 $2'), true], [lean, false],
                 [detail, false], [detail.replace(/\b\d+\s?(gb|tb)\b/g, ' ').replace(/\s+/g, ' ').trim(), false]];
  for (const [v, split] of tries) {
    const id = matchIn(' ' + v + ' ', split);
    if (id) return capacityFits(id, text) && brandFits(id, text) ? id : null;
  }
  // A real product on a real shelf that this catalogue has no entry for. A URL says less than a
  // title, so a title wins when both readings of the same item miss.
  if (CURSHOP && !/^https?:/i.test(text)) {
    // Record what the shop was asking as well as what it called the thing. A title on its own is
    // a thing to type in by hand; a title with a price and a page is a row tools/add.mjs can turn
    // into a catalogue entry, and its rule - no price, no entry - can only be applied if the
    // price came along. Adapters that have the row pass it; the rest still record the title.
    (MISSED.get(CURSHOP) || MISSED.set(CURSHOP, new Map()).get(CURSHOP))
      .set(norm(text), meta && meta.price
        ? { title: String(text).trim(), price: Math.round(+meta.price) || null, url: meta.url || null }
        : { title: String(text).trim() });
  }
  return null;
}
// A pair of earbuds is never sold as "8GB/256GB". Vega listed a POCO C85 phone bundled with
// Redmi Buds 6 Active - "...poco-c85-8gb-256gb-green-plus-redmi-buds-6-active..." - and the buds
// in the slug won the match, so a phone-and-buds bundle became the cheapest Xiaomi Buds 6 in the
// country at 62,900 against a real 111,900. The shop's own words settle it: a product with no
// storage to choose cannot be the thing a gigabyte figure belongs to.
const STORELESS = new Set(phones.filter(p => !(p.variants || []).some(v => v.storage != null)).map(p => p.id));
function capacityFits(id, text) {
  if (!STORELESS.has(id)) return true;
  return !capacitiesOf(text).some(c => c >= 32);
}
// AllSell's "HP OmniBook Flip 7 16-AU0070WM" is a laptop, and "flip 7" in it matched the JBL
// Flip 7 speaker - a 410,000 dram laptop filed among 48,000 dram speakers. The shop names the
// maker, so: if a title names a brand this catalogue knows and it is not the matched product's
// brand, the match is wrong. A title that names no brand at all (shops write "MacBook Neo 13")
// still matches, and a title naming several keeps the one whose brand is actually there.
// 'Nothing' is left out of the test - it is an ordinary English word before it is a brand.
const BRANDS = [...new Set(phones.map(p => norm(p.brand)))].filter(b => b && b !== 'nothing');
const brandOfId = Object.fromEntries(phones.map(p => [p.id, norm(p.brand)]));
function brandFits(id, text) {
  const h = ' ' + norm(text) + ' ';
  const mine = brandOfId[id];
  if (mine && h.includes(' ' + mine + ' ')) return true;
  return !BRANDS.some(b => b !== mine && h.includes(' ' + b + ' '));
}
function matchIn(h, split = false) {
  for (const k of KEYS) {
    const needle = ' ' + k.key + ' ';
    const i = h.indexOf(needle);
    if (i < 0) continue;
    const prev = h.slice(0, i).trim().split(' ').pop();
    if (prev && PREFIXES.has(prev) && !k.full.includes(prev)) return null;
    const next = h.slice(i + needle.length).trim().split(' ')[0];
    // 'ultra' marks a different phone (Galaxy S25 Ultra) but is also an Intel chip tier
    // ('Core Ultra 7 255U'), which was making every Core Ultra laptop unmatchable.
    const intelUltra = next === 'ultra' && (h.includes(' core ultra ') || h.includes(' ultra 5 ') || h.includes(' ultra 7 ') || h.includes(' ultra 9 '));
    if (next && QUALIFIERS.has(next) && !intelUltra) return null;
    // A split reading manufactures the letter that follows: "Xiaomi 15T Pro" becomes
    // "xiaomi 15 t pro", and the plain 15's key then matched with a stray "t" after it - a
    // 15T Pro's 319,000 on the wrong phone. In the shop's own words a trailing single letter
    // is ordinary; in a reading we invented it is the rest of a model name we just cut in half.
    if (split && next && next.length === 1) return null;
    return k.id;
  }
  return null;
}
// every "<n> GB/TB" figure in a title, in GB
// Capacities that are actually sold. Anything else read off a title or a slug is two numbers
// that ran together, not a product.
const REAL_CAPACITY = new Set([2, 3, 4, 6, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128, 192,
                               250, 256, 500, 512, 750, 1000, 1024, 1536, 2000, 2048, 3072,
                               4000, 4096, 6144, 8192]);
// "12/512GB" and "16GB/1TB" name the RAM and the storage with the unit written once, and the
// slash is the only thing that says the first figure is a capacity at all - normalising it to a
// space leaves "12 512gb", which is the shape of "Redmi Note 12 256GB", where the 12 is a model
// number. So the pair is read off the raw text, before the slash is gone. Pixel sells the Xiaomi
// 17 Pro Max as "12/512GB" and every row of it landed with no RAM at all, so the phone offered
// no 12 GB to choose.
const RAM_SLASH = /(?:^|[^\p{L}\p{N}])(\d+)\s*(?:gb|ԳԲ)?\s*\/\s*(\d+)\s*(?:tb|ՏԲ|gb|ԳԲ)(?![\p{L}\p{N}])/iu;
function capacitiesOf(text) {
  // keep unicode letters: norm() strips ԳԲ / ՏԲ before they can be read
  const h = String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // AllSell writes the MacBook Air as "16GB I 512TB". Nothing on sale here holds more than 8 TB,
  // so a terabyte figure that large is the shop meaning gigabytes.
  const withUnit = [...h.matchAll(/(\d+)\s*(tb|տբ|gb|գբ)(?:\s|$)/g)]
    .map(m => { const v = +m[1], tb = /tb|տբ/.test(m[2]); return tb && v < 16 ? v * 1024 : v; })
    // A capacity nobody manufactures is the shop's url with the model number glued to the
    // capacity: REDstore writes "Paperwhite 12(16GB)" and slugs it "paperwhite-1216gb", which
    // was published as 1216 GB - "1.1875 TB" on the page. An Alienware read 1,625,016 GB.
    .filter(v => REAL_CAPACITY.has(v));
  if (withUnit.length) {
    const m = String(text).match(RAM_SLASH), ram = m ? +m[1] : 0;
    return ram && REAL_CAPACITY.has(ram) && ram < Math.max(...withUnit) ? [ram, ...withUnit] : withUnit;
  }
  // iBolit writes the capacity with no unit at all - "iPHONE 17 256 Lavander ESIM" - and those
  // offers landed with storage null, which makes them stand in for the base capacity of every
  // configuration. Only a bare number that is EXACTLY a real capacity counts, so a model number
  // ("Galaxy A56", "Redmi Note 13") cannot be read as one.
  const SIZES = new Set([64, 128, 256, 512, 1024, 2048]);
  return [...h.matchAll(/(?:^|\s)(\d+)(?=\s|$)/g)].map(m => +m[1]).filter(v => SIZES.has(v));
}
// titles like "SM-S938B/DS 12GB 256GB" list RAM first, then storage -> larger is storage
// A title that names ONE capacity is naming memory as often as storage: AllSell lists the
// MacBook Air as "... M5 16GB" and that 16 was being published as a 16 GB SSD, which does not
// exist. Nothing in this catalogue ships under 64 GB of storage, so a lone figure below that is
// the RAM and there is no storage figure to report.
const storageOf = text => { const c = capacitiesOf(text); if (!c.length) return null;
  const m = Math.max(...c); return m >= 64 ? m : null; };
// one capacity from a single label ("512 GB", "16GB") - a shop's own attribute value, which is
// not a title and needs none of the guessing storageOf does
// A shop naming BOTH a physical SIM and eSIM is selling the phone WITH a tray.
const TRAY = /\b[12]\s*-?\s*sim\b|\bdual\s*sim\b|\bnano\b|սիմ|sim\s*card|\+\s*sim|sim\s*\+/i;
// e-?sim, because 3DPlanet writes the tray-less option "E-Sim" with a hyphen. "Nano-SIM" does
// not match it: there is no e immediately before the -sim.
const ESIM_ONLY = t => /(^|[^a-z])e-?sim([^a-z]|$)/i.test(t) && !TRAY.test(t);
// Three states, not two. A shop that says nothing about the SIM build is not asserting a tray,
// and treating it as one put prices under a button the shop never agreed to: Pixel's 559 000
// iPhone 17 Pro Max 512 GB appeared as the "Nano-SIM" price, below the 625 000 eSIM, which is
// backwards - the tray hardware always costs more. Returns true (eSIM-only), false (a tray the
// shop named), or undefined (not stated).
// A bare "sim" that is not "esim" IS the shop naming a tray - it is how iBolit distinguishes
// .../512gb-sim-deep-blue from .../512gb-silver-esim.
const SIM_WORD = /(^|[^a-z])sim([^a-z]|$)/i;
const simBuild = t => ESIM_ONLY(t) ? true : (TRAY.test(t) || SIM_WORD.test(t)) ? false : undefined;
const capOf = lbl => { const c = capacitiesOf(lbl || ''); return c.length ? c[0] : null; };
// The JSON object that starts at the first { after an anchor. Brace counting has to skip
// strings, or a } inside a product name ends the object early.
function jsonAfter(html, anchor) {
  const a = html.indexOf(anchor); if (a < 0) return null;
  const start = html.indexOf('{', a); if (start < 0) return null;
  let depth = 0, str = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
    if (c === '"') str = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; } }
  }
  return null;
}
// REDstore sells a Sky Blue Galaxy S26 and the catalogue lists Black, White and Cobalt Violet.
// Saying nothing is worse than saying what the shop says, so a run of colour words in the slug is
// reported as the shop wrote it. The vocabulary is fixed, or a slug word becomes a colour.
const COLOR_WORDS = new Set(('black white blue green pink yellow red purple violet gray grey silver gold '
  + 'titanium graphite midnight starlight cream lavender lilac mint navy orange beige bronze sand olive '
  + 'teal ivory charcoal jade obsidian porcelain indigo peach coral sky cobalt moonstone jet ultramarine '
  + 'desert natural pistachio aqua amber ruby onyx pearl slate frost snow shadow icy awesome deep light dark')
  .split(' '));
function colorWords(text) {
  const w = tokenized(text).split(' ').filter(Boolean);
  const runs = [];
  for (let i = 0; i < w.length; i++) {
    if (!COLOR_WORDS.has(w[i])) continue;
    const from = i;
    while (i + 1 < w.length && COLOR_WORDS.has(w[i + 1])) i++;
    runs.push(w.slice(from, i + 1));
  }
  // two separate colour runs in one slug is a two-tone render or a comparison, not an answer
  if (runs.length !== 1) return null;
  const r = runs[0].filter(x => !['light', 'dark', 'deep', 'awesome'].includes(x) || runs[0].length > 1);
  return r.length ? r.map(x => x[0].toUpperCase() + x.slice(1)).join(' ') : null;
}
// A shop that names its colours in Armenian against a catalogue that names them in English:
// terms.json already holds that translation, so read it backwards. Armenian inflects the ending
// (Silver is Արծաթե in the dictionary and Արծաթագույն on pixel.am), so it compares on the stem.
const TERMS_FILE = fs.existsSync('data/terms.json') ? JSON.parse(fs.readFileSync('data/terms.json', 'utf8')) : {};
function colorTranslated(label, colors) {
  const stem = t => String(t).toLowerCase().replace(/[^\p{L}]/gu, '').slice(0, 5);
  const a = stem(label);
  if (a.length < 4) return null;
  const hits = (colors || []).filter(c => (TERMS_FILE[c] || []).some(t => stem(t) === a));
  return hits.length === 1 ? hits[0] : null;
}
// pixel.am states its variants in plain HTML. A dimension with exactly ONE option is the variant
// on sale and can be reported; a dimension with several cannot, because the page carries a single
// price and attributing it to one combination would be a guess.
function pixelVariants(html, colors) {
  const out = { storage: null, color: null };
  for (const m of html.matchAll(/<div class="variant-property"[\s\S]*?<input/g)) {
    const opts = [...m[0].matchAll(/class="variant-option[^"]*"[^>]*>/g)]
      .map(o => clean((o[0].match(/title="([^"]*)"/) || [])[1] || ''))
      .filter(Boolean);
    const texts = [...m[0].matchAll(/class="variant-option[^"]*"[^>]*>([^<]+)</g)].map(o => clean(o[1])).filter(Boolean);
    const vals = opts.length ? opts : texts;
    if (vals.length !== 1) continue;
    const cap = capOf(vals[0]);
    // The same rule storageOf() uses on a title: nothing here ships under 64 GB of storage, so a
    // lone 16 is the RAM. pixel.am lists "16ԳԲ" as the MacBook Air's only memory option, and it
    // was being published as a 16 GB SSD - a capacity that does not exist.
    if (cap != null) { if (cap >= 64) out.storage ??= cap; else out.ram ??= cap; }
    else out.color ??= colorOf(vals[0], colors) || colorTranslated(vals[0], colors);
  }
  return out;
}
// One pixel page is a MATRIX, not a price. The iPhone 17 Pro Max sells there in four capacities
// and two SIM builds at eight different figures, and this adapter published exactly one of them -
// so the 1 TB and the tray builds existed on the shop's own page and nowhere on ours, and the
// rows that did exist had to be typed in by hand afterwards. Same reasoning as magentoChildren
// below: a page that describes its real SKUs yields one offer per SKU.
//
// Colour is collapsed to one row per build, because pixel prices every colour of a build
// identically and three rows differing only in a word read as the listing repeated.
function pixelMatrix(html, colors) {
  const m = html.match(/var\s+PRODUCT_VARIANTS\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return [];
  let vs;
  try { vs = JSON.parse(m[1]); } catch { return []; }
  const best = new Map();
  for (const v of vs) {
    // The property NAMES are whatever language the page is in - the crawl reads /am/, where they
    // are Գույն, Հիշողություն and Սիմ Քարտ - so each one is recognised by what its value looks
    // like instead: a capacity is a capacity in any language, a SIM build is written in Latin on
    // both, and whatever is left over is the colour. Keying on the English names read every
    // Armenian page as a single option with no capacity at all.
    let mem = '', simVal = '', col = '';
    for (const x of v.properties || []) {
      const val = String(x.valueTitle || '').trim();
      if (!val) continue;
      if (!simVal && /sim/i.test(val)) simVal = val;
      else if (!mem && capOf(val) != null) mem = val;
      else if (!col) col = val;
    }
    const p = { memory: mem, color: col, 'sim card': simVal };
    // wholesalePrice is the CASH price - see pixelCash() - while "price" is the instalment
    // figure. Reading the wrong one inflated every pixel offer by about a tenth.
    const price = Math.round(Number(v.wholesalePrice) > 0 ? Number(v.wholesalePrice)
      : Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(v.price));
    if (!(price > 1000)) continue;
    const cap = capOf(p.memory);
    const sim = simBuild(p['sim card'] || '');
    const k = [cap ?? '', sim === true ? 'e' : sim === false ? 'n' : '?'].join('|');
    const row = {
      price,
      storage: cap != null && cap >= 64 ? cap : null,
      ram: cap != null && cap < 64 ? cap : null,
      esim: sim,
      color: colorOf(p.color || '', colors) || colorTranslated(p.color || '', colors) || null,
      inStock: Number(v.quantity) > 0,
      // The shop named this build in its own variant data. That outranks anything the eSIM
      // post-pass could infer from a title, which is the same title on all eight rows.
      simFromPage: sim !== undefined || undefined,
    };
    const had = best.get(k);
    if (!had || row.price < had.price) best.set(k, row);
  }
  return [...best.values()];
}
// A Magento configurable page describes every one of its real SKUs here: per-child price,
// stock, colour and capacity. One page therefore yields several offers, each true.
function magentoChildren(html, colors) {
  const cfg = jsonAfter(html, '"jsonConfig":');
  if (!cfg || !cfg.optionPrices || !cfg.index || !cfg.attributes) return [];
  const attrs = Object.values(cfg.attributes);
  const text = a => ((a.code || '') + ' ' + (a.label || ''));
  const drive = attrs.find(a => /drive|storage|internal/i.test(text(a)));
  const color = attrs.find(a => /colou?r/i.test(text(a)));
  const ram = attrs.find(a => a !== drive && /\bram\b|memory/i.test(text(a)));
  const label = (a, child) => {
    if (!a) return null;
    const want = String((cfg.index[child] || {})[a.id] ?? '');
    const opt = (a.options || []).find(o => String(o.id) === want);
    return opt ? clean(opt.label) : null;
  };
  const out = [];
  for (const [child, pr] of Object.entries(cfg.optionPrices)) {
    const price = Math.round(Number((pr.finalPrice || {}).amount || 0));
    if (!price || price < 5000) continue;
    const col = label(color, child);
    out.push({ price, storage: capOf(label(drive, child)), ram: capOf(label(ram, child)),
      // A colour Magento states that none of the product's own colours will map to is not a
      // colour we can trust - AllSell's Pixel 10 said "Yellow" and it was published verbatim,
      // a fifth swatch next to the four the product actually ships in. Unmapped is unstated.
      color: (col && colorOf(col, colors)) || null, inStock: pr.is_in_stock !== false });
  }
  return out;
}
// 3DPlanet renders its buy-box options from this endpoint, one call per variation id covering
// every dimension at once - colour, and on an iPhone, SIM build too. is_active is 0 for an
// option the shop has sold out of; the page itself says nothing about which you can actually
// buy. Colour's own price is a delta on the tier (almost always 0); SIM's is not a delta at
// all - "E-Sim" repeats the tier's own price back exactly, "1 Sim kard + Esim" (the nano tray)
// states the tray build's OWN full price - the standing rule that the tray always costs more
// than eSIM, confirmed on 3DPlanet's own numbers rather than assumed.
async function planetModifiers(varId) {
  let data;
  try { data = JSON.parse(await get('https://3dplanet.am/variations/' + varId + '/modifiers')); } catch { return {}; }
  const out = {};
  for (const m of (Array.isArray(data) ? data : [])) {
    const name = ((m.specification || {}).translations || [])[0]?.name || '';
    const key = /^colou?r$/i.test(name) ? 'color' : /^sim$/i.test(name) ? 'sim' : null;
    if (!key) continue;
    out[key] = (m.values || []).map(v => ({
      name: clean(((v.value || {}).value) || ''),
      price: Math.round(Number(v.price || 0)),
      active: v.is_active !== 0
    })).filter(c => c.name);
  }
  return out;
}
// ...and the smaller one is RAM, but only when the title really lists both
// Two capacities that are the SAME capacity are one figure written twice - telecom titles the
// Galaxy A16 "Samsung A165 256GB | 256 GB" - and the smaller of them is not a RAM size.
const ramOf = text => { const c = capacitiesOf(text); const lo = Math.min(...c);
  return c.length >= 2 && lo < Math.max(...c) ? lo : null; };
// colour, matched against the colours we already know this phone ships in
// Shops and manufacturers spell one colour several ways. Samsung's own name is "Awesome Grey";
// viva slugs it "gray", REDstore "gray", eldorado "awesome-gray". "Awesome Icyblue" is "iceblue"
// at viva. Each spelling that reaches the page as its own word makes one phone look like two.
const cword = w => String(w).toLowerCase().replace(/[^a-z]/g, '')
  .replace(/^grey$/, 'gray').replace(/^ice(blue)$/, 'icy$1').replace(/^icy$/, 'ice');
function colorOf(text, colors) {
  const h = String(text).toLowerCase();
  let hit = null;
  for (const c of colors || []) if (h.includes(String(c).toLowerCase()) && (!hit || c.length > hit.length)) hit = c;
  if (hit) return hit;
  // The shop wrote the distinctive half and dropped the house adjective: every shop selling the
  // Galaxy A57 slugs it "navy", and the catalogue calls it "Awesome Navy". Match on the last
  // word when it names exactly ONE of this product's colours, so the row reports the catalogue's
  // own name rather than a word of its own - which is what put "Navy" and "Awesome Navy" side by
  // side as if they were different phones, and left "iceblue" with no colour at all.
  const words = new Set(h.split(/[^a-z]+/).filter(Boolean).map(cword));
  const cand = (colors || []).filter(c => {
    const tail = cword(String(c).split(/\s+/).pop());
    return tail.length > 2 && words.has(tail);
  });
  return cand.length === 1 ? cand[0] : null;
}
// pixel.am never names the variant in the title, but its product photo does:
// ".../17-pro-orng-1.png". Expand the shop's abbreviations, then match a word of one of
// the colours we list for that phone, so the row can say "Cosmic Orange" instead of nothing.
const IMG_HUE = { orng: 'orange', ormg: 'orange', oringe: 'orange', blu: 'blue', blk: 'black', wht: 'white',
  slv: 'silver', silv: 'silver', gld: 'gold', grn: 'green', pnk: 'pink', prpl: 'purple',
  ylw: 'yellow', gry: 'gray', grey: 'gray', ttn: 'titanium', titan: 'titanium', lav: 'lavender',
  mid: 'midnight', ultra: 'ultramarine', jet: 'jetblack' };
function colorFromImage(src, colors) {
  const words = tokenized(src).split(' ').filter(Boolean).map(w => IMG_HUE[w] || w);
  let hit = null;
  const hits = [];
  for (const c of colors || []) {
    const cw = tokenized(c).split(' ').filter(Boolean);
    if (cw.some(w => words.includes(w))) { hits.push(c); if (!hit || c.length > hit.length) hit = c; }
  }
  // two colours in one filename ("a06-blk-blue") is a two-tone render, not an answer
  return hits.length === 1 ? hit : null;
}
// Offer URLs end up in an href. iSpace's come from a third party's JSON-LD, so the scheme is
// not ours to trust: anything but http(s) is dropped rather than rendered.
function safeUrl(u) {
  try {
    const url = new URL(String(u));
    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
  } catch { return null; }
}
// A double quote, spelled out: writing one inline inside these scanners is what keeps
// breaking when the file is edited through a shell.
const D = String.fromCharCode(34);
// Both Telecom and iStore mark the real price with a class and then nest spans inside it. A
// fixed-width slice after the tag, or a regex over literal nbsp characters, spliced two numbers
// into a plausible-looking wrong price whenever the markup shifted. Anchor, strip tags, take the
// first number.  ponytail: 8-digit cap, fine until something here costs over 99,999,999 AMD.
const priceAfter = (html, anchor, span = 240) => {
  const i = html.indexOf(anchor);
  if (i < 0) return 0;
  // The anchor is a class attribute, so it lands INSIDE the opening tag and every attribute
  // after it is in reading range. iStore added style="color: #000000" to its price span and the
  // first number found became 000000, which is how a working shop silently went to zero offers.
  // Start at the end of that tag, where the text actually begins.
  const j = html.indexOf('>', i);
  const from = j < 0 ? i : j + 1;
  const m = clean(html.slice(from, from + span)).match(/\d[\d\s.,  ]*\d|\d/);
  return m ? Number(m[0].replace(/[^\d]/g, '').slice(0, 8)) : 0;
};
// Magento's own stock class, the one the page actually renders next to the price.
const stockOf = html => !/class="stock\s+unavailable"/i.test(html);
const clean = s => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, String.fromCharCode(34)).replace(/&#0?39;|&apos;/g, String.fromCharCode(39)).replace(/\s+/g, ' ').trim();
const ldJson = html => [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap(m => { try { const j = JSON.parse(m[1]); return Array.isArray(j) ? j : [j]; } catch { return []; } });

// REDstore and 3DPlanet both publish a schema.org Product on the page, which is the price the
// shop means rather than whatever number the markup happens to show. One reader serves both.
// The cash price, read out of the product's own price block so a related item's price cannot
// stand in for it. Returns 0 when the page does not state one.
// Mobile Centre's cash price: the number after "Գին՝" inside this product's own block.
function mcCash(block) {
  // the listing closes the span between label and number ("<span>Գին՝ </span> 174,900դր.")
  // while the product page runs them together. Allow either.
  const m = block.match(/Գին՝\s*(?:<\/span>)?\s*([\d,  ]+)\s*դր/);
  return m ? +m[1].replace(/[^0-9]/g, '') : 0;
}

function pixelCash(html) {
  const at = html.indexOf('product-info-price');
  if (at < 0) return 0;
  const blk = html.slice(at, at + 500);
  const m = blk.match(/class="cash-price[^"]*"[^>]*>[^<]*<b>\s*([\d,  ]+)/);
  return m ? +m[1].replace(/[^0-9]/g, '') : 0;
}

const ldProduct = html => ldJson(html).flatMap(j => j['@graph'] || j).find(j => j && j['@type'] === 'Product');
const ldOffer = p => { const o = p && p.offers; return Array.isArray(o) ? o[0] : o; };

/* ---------- self-test:  node scrape.mjs --selftest  (no network) ---------- */
if (process.argv[2] === '--selftest') {
  const cases = [
    // the multi-brand shops reached beyond phones; these slugs must land on the right item
    // A bare key must not match when another product line precedes it. Xiaomi's "17 Pro Max"
    // sits inside "Redmi Note 17 Pro Max", which sold at a third of the flagship's price.
    // a laptop whose model name contains a speaker's. The shop says HP; the speaker is a JBL.
    [null, 'HP OmniBook Flip 7 16-AU0070WM'],
    // REDstore's url for the Tab S8+ says "tab-s8"; only its title says plus. crawlLd reads
    // both, and this is the pair that makes the difference visible.
    ['samsung-galaxy-tab-s8', 'samsung-galaxy-tab-s8-8gb128gb-wifi-x800-graphite'],
    ['samsung-galaxy-tab-s8-plus', 'Samsung Galaxy Tab S8+ 8GB/128GB WiFi X800 Graphite samsung-galaxy-tab-s8-8gb128gb-wifi-x800-graphite'],
    // splitting "15T" to recover a compressed slug must not let the plain 15 take a 15T Pro.
    // The Pro is carried now, so the phone that proves the rule is the Ultra, which is not.
    ['xiaomi-15t-pro', 'Xiaomi 15T Pro'],
    [null, 'Xiaomi 15 Ultra'],
    ['xiaomi-15t', 'Xiaomi 15T'],
    ['xiaomi-15', 'Xiaomi 15'],
    ['jbl-flip-7', 'JBL Flip 7 Squad'],
    ['jbl-flip-7', 'Portable speaker JBL Flip 7 Black'],
    // shops drop the brand all the time, and that must still match
    ['apple-macbook-neo-13', 'MacBook Neo 13" A18 Pro (6C CPU/5C GPU), 8 GB, 256 GB, Silver'],
    // the plain Pixel 10 sits between two products already in the catalogue, and neither may
    // absorb its listings - nor it theirs
    ['google-pixel-10', 'Google Pixel 10'],
    ['google-pixel-10a', 'Google Pixel 10a'],
    ['google-pixel-10-pro', 'Google Pixel 10 Pro'],
    ['jbl-go-4', 'JBL Go 4'],
    ['dell-inspiron-16', 'Dell PC Notebook Inspiron 16 / Core 5 120U / 8GB RAM / 512GB SSD / 16 inch WUXGA Touch / WIN11 (Ice Blue)'],
    // laptops VLV stocks, matched off the shop's own title
    ['lenovo-loq-15', 'LENOVO LOQ 15IRX9  i5-13450HX 16GB 1TB RTX4050 15.6" (83DV0069RK) Notebooks'],
    ['lenovo-loq-15', 'LENOVO LOQ 15IRX9 i5-13450HX 16GB 1TB RTX3050 15.6" (83DV01CJRK) Notebooks'],
    // A different generation, and it must not be filed as the IRX9. It used to be absent from
    // the catalogue and the assertion was null; it is carried now, so the same title proves the
    // same thing by landing on its OWN entry rather than on its predecessor's.
    ['lenovo-loq-15irx10', 'LENOVO LOQ 15IRX10 i7-13645HX 16GB SSD512 RTX5050 15.6" 83JE0189RK Notebooks'],
    ['hp-victus-15', 'HP Victus 15-fa2262ci Core 5 - 210H/15.6 8/512 RT3050 DR9V2EA Notebooks'],
    ['acer-aspire-15', 'ACER ASPIRE AL15-72P-57CM i5-13420H 16/512 15.6" NX.D5HEM.002 Notebooks'],
    // REDstore calls every Apple Watch an iWatch
    ['apple-watch-se-3', 'https://redstore.am/en/product/iwatch-se3-40mm-midnight-band'],
    ['apple-watch-series-11', 'https://redstore.am/en/product/iwatch-series-11-42mm-jet-black-band'],
    ['apple-watch-ultra-3', 'https://redstore.am/en/product/iwatch-ultra-3-49mm-black-ti-black-ocean-band'],
    // ...but an iWatch we do not carry must stay unmatched, not fall onto the nearest one
    [null, 'https://redstore.am/en/product/iwatch-series-12-42mm-black-band'],
    [null, 'https://redstore.am/en/product/iwatch-ultra-4-49mm-black-ti-black-band'],
    // a shop that names an iPad by its year, with the capacity in between
    ['apple-ipad-pro-11-m4', 'https://redstore.am/en/product/ipad-pro-11-512gb-wifi-2024-space-black'],
    ['apple-ipad-air-11-m4', 'https://redstore.am/en/product/ipad-air-11-128gb-wifi-2026-blue'],
    ['apple-ipad-air-11-m3', 'https://redstore.am/en/product/ipad-air-11-256gb-wifi-2025-blue'],
    ['apple-ipad-pro-13-m5', 'https://redstore.am/en/product/ipad-pro-13-512gb-wifi-2025-space-black'],
    // and the chip-named readings every other shop uses must keep working
    ['apple-ipad-pro-11-m4', 'https://ibolit.mobi/product/ipad-pro-11-m4-256gb-wi-fi-standard-glass-silver/'],
    ['apple-ipad-air-11-m3', 'https://www.pixel.am/am/product/ipad-air-11-m3'],
    // stripping the capacity must not turn one phone into another
    ['samsung-galaxy-a57', 'Samsung Galaxy A57 5G SM-A576B 8GB 128GB Awesome Navy'],
    // carried since the Eldorado and iBolit exports were read; it must be itself, not a Note 17
    ['xiaomi-redmi-note-17-pro-max-5g', 'https://redstore.am/en/product/xiaomi-redmi-note-17-pro-max-5g-8gb256g'],
    // a phone sold with earbuds in the box is neither product's price
    [null, 'https://vega.am/home-appliances/phones-and-gadgets/smart-phones/smart-phone-xiaomi-poco-c85-8gb-256gb-green-plus-redmi-buds-6-active-25078pc3eg.html'],
    // A bundle is rejected whichever of its two products the catalogue happens to carry.
    [null, 'Xiaomi POCO C85 8GB 256GB Green plus Redmi Buds 6 Active'],
    // ...and the ordinary readings a "+" appears in are not bundles
    ['samsung-galaxy-s26-plus', 'Samsung Galaxy S26+ 256GB'],
    ['xiaomi-redmi-note-17-pro-max-5g', 'https://redstore.am/en/product/xiaomi-redmi-note-17-pro-max-5g-8gb256g'],
    ['xiaomi-redmi-note-17-pro-max-5g', 'https://mobilecentre.am/product/xiaomi-redmi-note-17-pro-max/34553/'],
    ['xiaomi-17-pro-max', 'https://redstore.am/en/product/xiaomi-17-pro-max-16gb512gb-black'],
    // second-hand stock is not the product
    [null, 'https://ibolit.mobi/product/used-17-pro-max-256-blue/'],
    ['xiaomi-pad-7-pro', 'https://www.pixel.am/am/product/xiaomi-pad-7-pro'],
    ['xiaomi-pad-7', 'https://www.pixel.am/am/product/xiaomi-pad-7-8-256-gray'],
    ['hp-15-fd2747nr', 'HP PC Notebook 15-FD2747NR / Ultra 7 255U / 16GB RAM / 512GB SSD'],
    // Mobile Centre lists the Plus as "S25+". The Plus is in the catalogue now, so the assertion
    // is its real id - which still proves the qualifier guard works: a broken guard answers
    // samsung-galaxy-s25 here.
    ['samsung-galaxy-s25-plus', 'Samsung Galaxy S25+ 256GB (Silver Shadow)'],
    ['samsung-galaxy-s25', 'Samsung Galaxy S25 128GB (Navy)'],
    ['apple-iphone-17-pro', 'iphone-17-pro-512-gb-deep-blue-mg8k4af-a'],
    ['apple-iphone-17', 'apple-iphone-17-256gb-black-mg6j4af-a.html'],
    // Both are in the catalogue now, so the assertion is the real id - which still proves the
    // qualifier guard works: a broken guard answers apple-iphone-17 / apple-iphone-16 here.
    ['apple-iphone-17e', 'Apple iPhone 17e'],
    ['apple-iphone-16-pro-max', 'Apple iPhone 16 Pro Max'],
    ['samsung-galaxy-s25-ultra', 'samsung-galaxy-s25-ultra-512gb'],
    ['samsung-galaxy-s25', 'samsung-galaxy-s25-256gb'],
    ['apple-iphone-17', 'Սմարթ հեռախոս APPLE iPhone 17 256GB (Lavender) (A3520)'],
    // REDstore's Pixel 10 Pro Fold was being sold as a Pixel 10 Pro, at 725,000 instead of 475,900
    [null, 'google-pixel-10-pro-fold-16gb256gb-moonstone'],
    ['xiaomi-15t', 'xiaomi-15t-256gb'],
    ['poco-x7-pro', 'poco-x7-pro-512gb'],
    ['apple-iphone-17-pro-max', 'apple-iphone-17-pro-max-2tb'],
    ['samsung-galaxy-a56', 'Samsung Galaxy A56 5G 256GB'],
    ['xiaomi-redmi-note-14-pro', 'redmi-note-14-pro-256gb'],
    ['realme-c75', 'realme-c75-128gb'],
    ['apple-iphone-air', 'iphone-air-256-gb'],
    [null, 'USB-C dongle for iPhone 15'],                         // accessory, not the phone
    [null, 'APPLE Clear Case with MagSafe for iPhone 15'],        // accessory, not the phone
    [null, 'https://istore.am/product/silicone-case-for-iphone-17-pro-black'],
    [null, 'Tempered Glass for iPhone 15'],
    [null, 'Чехол для iPhone 15 Pro'],
    [null, 'Պատյան iPhone 15-ի համար'],
    // Was asserted to match nothing while the catalogue had no Series 10. It carries one now,
    // so the right assertion is that it finds that watch rather than falling through to a phone.
    ['apple-watch-series-10', 'Apple Watch Series 10'],
    ['apple-iphone-15', 'Սմարթ հեռախոս APPLE IPHONE 15 128GB (BK) (MTP03HX/A)'],   // still a phone
    ['apple-iphone-15', 'iPhone 15, 128 ԳԲ, Pink'],
  ];
  let bad = 0;
  for (const [want, txt] of cases) {
    const got = matchPhone(txt);
    if (got !== want) { bad++; console.log(`FAIL  got=${got}  want=${want}  <- ${txt}`); }
  }
  // "eSIM" in a name does NOT mean eSIM-ONLY. A shop that also names a physical tray is selling
  // the phone WITH one, and filing it under the wrong button moves a price by 80,000.
  const simCases = [
    [true, 'iPHONE 17 256 Lavander ESIM'], [true, 'E-Sim'],
    [true, 'iphone-18-pro-256gb-burgundy-esim'], [true, 'iphone-17-pro-256gb-esim-silver'],
    [false, '1 Սիմ քարտ + Esim'], [false, '1 SIM + eSIM'], [false, 'Dual SIM + eSIM'],
    [false, 'Nano-SIM + eSIM'], [false, 'iPhone 17 Pro 256GB (Silver) 1 -SIM'],
    [false, 'iphone-18-pro-256gb-burgundy'],
  ];
  for (const [want, txt] of simCases) {
    const got = ESIM_ONLY(txt);
    if (got !== want) { bad++; console.log(`FAIL  eSIM-only=${got} want=${want}  <- ${txt}`); }
  }
  // The tray build always costs more than the eSIM build, so a pair that comes back the other
  // way round is a mislabel at the shop. The prices must come out swapped, not published as-is.
  const flipCases = [
    // [esimPrice, trayPrice, does the pair keep its eSIM label?]
    [569000, 525000, false],   // tray cheaper: unrankable, label dropped
    [625000, 625000, false],   // equal: carries no signal either, label dropped
    [525000, 569000, true],    // tray dearer: the normal case, left alone
  ];
  for (const [e0, t0v, keep] of flipCases) {
    const esim = { shop: 's', storage: 256, price: e0, url: 'e', esim: true };
    const tray = { shop: 's', storage: 256, price: t0v, url: 't', esim: false };
    dropUnrankableSim([esim, tray]);
    if (!!esim.esim !== keep || esim.price !== e0 || tray.price !== t0v) {
      bad++; console.log(`FAIL  sim ${e0}/${t0v} -> esim=${!!esim.esim} want ${keep} (prices must not move)`);
    }
  }

  // a lone price far under what the other shops agree on is a misread, not a deal
  const medCases = [[[100, 100, 100], 100], [[90, 100, 110], 100], [[40, 100, 100, 100], 100]];
  for (const [arr, want] of medCases) {
    const got = medianOf(arr);
    if (got !== want) { bad++; console.log(`FAIL  median ${got} want ${want}`); }
  }

  // Pixel's own markup: the higher number is the instalment price, the lower one is the price
  // Mobile Centre prints the instalment total in data-price and the real price after "Գին՝"
  const mcCases = [
    ['<a data-price="549900"> Գինս 519,900դր.', 0],
    ['<a data-price="549900"> Գին՝ 519,900դր.', 519900],
    ['<span style="x">Գին՝ </span> 174,900դր.', 174900],
    ['<a data-price="549900">no cash price here</a>', 0],
  ];
  for (const [html, want] of mcCases) {
    const got = mcCash(html);
    if (got !== want) { bad++; console.log(`FAIL  mcCash=${got} want=${want}`); }
  }

  const pixCases = [
    ['<div class="product-info-price"> <span class="mr5">Ապառիկ:</span> '
     + '<span class="actual-price">129,000 Դրամ</span> '
     + '<div class="cash-price pt10">Գինը: <b>119,000 Դրամ</b></div> </div>', 119000],
    ['<div class="product-info-price"><span class="actual-price">45,900</span>'
     + '<div class="cash-price"><b>42,900</b></div></div>', 42900],
    ['<div class="product-info-price"><span class="actual-price">99,000</span></div>', 0],
    ['no price block here', 0],
  ];
  for (const [html, want] of pixCases) {
    const got = pixelCash(html);
    if (got !== want) { bad++; console.log(`FAIL  pixelCash=${got} want=${want}`); }
  }

  // AllSell's Pixel 10 page states its colour as "Yellow" - a real colour word, but not one
  // of the four the product actually ships in (Obsidian, Frost, Indigo, Lemongrass). Publishing
  // it made a fifth swatch appear that matched nothing real. An unmapped colour must come back
  // null, so enrich()'s own fallback chain - colorFromImage, then the url's colour words - gets
  // a chance to run; that chain never fires while the adapter's own guess is still truthy.
  {
    const fakeCfg = { attributes: { 93: { id: 93, code: 'color', label: 'Color', options: [{ id: 7, label: 'Yellow' }] } },
      index: { '501': { 93: 7 } }, optionPrices: { '501': { finalPrice: { amount: 329900 } } } };
    const html = '<script>"jsonConfig":' + JSON.stringify(fakeCfg) + '</script>';
    const kids = magentoChildren(html, ['Obsidian', 'Frost', 'Indigo', 'Lemongrass']);
    if (kids[0]?.color !== null) { bad++; console.log(`FAIL  magentoChildren color=${kids[0]?.color} want=null (unmapped "Yellow")`); }
  }

  const buildCases = [
    [true, 'iPhone 17 Pro Max 512GB Silver Esim'], [true, 'E-Sim'],
    [false, '1 Սիմ քարտ + Esim'], [false, 'iphone-17-pro-max-512gb-sim-deep-blue'],
    [false, 'Nano-SIM'], [false, 'Dual SIM'],
    [undefined, 'iPhone 17 Pro Max 512GB'], [undefined, 'www.pixel.am/am/product/iphone-17-pro-max'],
  ];
  for (const [want, txt] of buildCases) {
    const got = simBuild(txt);
    if (got !== want) { bad++; console.log(`FAIL  simBuild=${got} want=${want}  <- ${txt}`); }
  }

  // a capacity with no unit at all, and the model numbers that must not be read as one
  const capCases = [[256, 'iPHONE 17 256 Lavander ESIM'], [512, 'Galaxy S25 512 Black'],
    [null, 'Samsung Galaxy A56 5G'], [null, 'Redmi Note 13 Pro'], [null, 'Apple Watch 44']];
  for (const [want, txt] of capCases) {
    const got = capOf(txt);
    if (got !== want) { bad++; console.log(`FAIL  capOf=${got} want=${want}  <- ${txt}`); }
  }
  const st = [['iphone 17 pro 512 gb', 512], ['2tb', 2048], ['256gb', 256], ['1 ՏԲ', 1024], ['128 ԳԲ', 128],
    ['SAMSUNG Galaxy S25 Ultra 5G SM-S938B/DS 12GB 256GB', 256],   // RAM listed first, storage is the larger
    ['ONEPLUS 13 16GB 512GB (Arctic Down)', 512],
    ['Apple iPhone 17', null],
    ['MacBook Air 13 M5 16GB', null],            // 16 is the memory, there is no 16 GB SSD
    ['MacBook Air 13-inch M5 16GB/512GB', 512],
    ['Xbox Series S 512 GB', 512],
    ['Macbook Air 15" M5 16GB I 512TB MDVH4 Midnight', 512],   // shop typo: 512 TB does not exist
    ['Mac Studio M4 Max 8TB', 8192],
    // REDstore slugs "Paperwhite 12(16GB)" as "paperwhite-1216gb"; 1216 GB was published as
    // "1.1875 TB". A model number glued to a capacity is not a capacity.
    ['amazon-kindle-paperwhite-1216gb', null],
    ['dell-alienware-16-aurora-ac1625016gb-rtx-5060', null],
    ['Xiaomi 17 Pro Max 12/512GB (Black)', 512], ['Galaxy S26 Ultra 16GB/1TB', 1024]];
  const ramCases = [['SAMSUNG Galaxy S25 Ultra 5G SM-S938B/DS 12GB 256GB', 12], ['XIAOMI POCO X7 Pro 5G 8GB 256GB (Black)', 8],
    ['iPhone 17 Pro, 256 ԳԲ, Silver', null],
    // "12/512GB" writes the unit once, and the slash is the only thing separating it from
    // "Redmi Note 12 256GB", where the 12 is a model number and there is no RAM figure at all.
    ['Xiaomi 17 Pro Max 12/512GB (Black)', 12], ['Redmi Note 14 8/256GB', 8],
    ['POCO X7 Pro 12 GB / 512 GB', 12], ['Galaxy S26 Ultra 16GB/1TB', 16],
    ['Redmi Note 12 256GB', null], ['iPhone 17 Pro Max 256GB', null],
    ['Samsung A165 256GB | 256 GB', null]];
  for (const [txt, want] of ramCases) {
    const got = ramOf(txt);
    if (got !== want) { bad++; console.log(`FAIL ram got=${got} want=${want} <- ${txt}`); }
  }
  // pixel's variant blob, in the language the crawl actually reads it in. The property NAMES
  // are Armenian and only the values give away what each one is; keying on the English names
  // read every Armenian page as one option with no capacity, which is how a phone sold in two
  // capacities reached the site as a single price.
  const PXV = 'var PRODUCT_VARIANTS = ' + JSON.stringify([
    { quantity: 3, price: 328000, salePrice: 0, wholesalePrice: 299000,
      properties: [{ title: 'Գույն', valueTitle: 'Black' },
                   { title: 'Հիշողություն', valueTitle: '128 ԳԲ' }] },
    { quantity: 3, price: 369000, salePrice: 0, wholesalePrice: 339000,
      properties: [{ title: 'Գույն', valueTitle: 'Black' },
                   { title: 'Հիշողություն', valueTitle: '256 ԳԲ' }] },
    { quantity: 3, price: 599000, salePrice: 0, wholesalePrice: 559000,
      properties: [{ title: 'Գույն', valueTitle: 'Black' },
                   { title: 'Հիշողություն', valueTitle: '256 ԳԲ' },
                   { title: 'Սիմ Քարտ', valueTitle: 'Nano-SIM+eSIM' }] },
  ]) + ';';
  {
    const m = pixelMatrix(PXV, null).sort((a, b) => a.price - b.price);
    // two capacities, and the tray build kept apart from the eSIM one at the same capacity
    const want = [[299000, 128, undefined], [339000, 256, undefined], [559000, 256, false]];
    if (m.length !== want.length) { bad++; console.log(`FAIL pixelMatrix got ${m.length} sku(s), want ${want.length}`); }
    else for (let i = 0; i < want.length; i++) {
      const g = m[i];
      if (g.price !== want[i][0] || g.storage !== want[i][1] || g.esim !== want[i][2]) {
        bad++; console.log(`FAIL pixelMatrix ${g.price}/${g.storage}/${g.esim} want ${want[i].join('/')}`);
      }
    }
  }
  const colCases = [['iPhone 17 Pro, 256 ԳԲ, Deep Blue', ['Cosmic Orange', 'Deep Blue', 'Silver'], 'Deep Blue'],
    ['APPLE iPhone 17 Pro 256GB (Cosmic Orange) (A3523)', ['Cosmic Orange', 'Deep Blue'], 'Cosmic Orange'],
    ['Apple iPhone 17 Pro', ['Cosmic Orange', 'Deep Blue'], null]];
  const urlCases = [['https://vega.am/x.html', true], ['http://shop.am/x', true],
    ['javascript:alert(1)', false], ['data:text/html,<script>', false], ['/relative/path', false], ['', false]];
  for (const [txt, ok] of urlCases) {
    const got = safeUrl(txt);
    if (!!got !== ok) { bad++; console.log(`FAIL url got=${got} want=${ok ? 'accepted' : 'rejected'} <- ${txt}`); }
  }
  for (const [txt, cols, want] of colCases) {
    const got = colorOf(txt, cols);
    if (got !== want) { bad++; console.log(`FAIL colour got=${got} want=${want} <- ${txt}`); }
  }
  for (const [txt, want] of st) {
    const got = storageOf(txt);
    if (got !== want) { bad++; console.log(`FAIL storage got=${got} want=${want} <- ${txt}`); }
  }
  // priceAfter is the money path: a wrong number here is published as a real price.
  const NB = String.fromCharCode(160), NN = String.fromCharCode(8239);
  const priceCases = [
    ['<span class="e-shop__main-price"><span>479' + NB + '900</span> AMD</span>', 'e-shop__main-price', 479900],
    ['<div class="price is-action"> 1' + NN + '274' + NB + '900 </div>', 'class="price is-action"', 1274900],
    ['<b class="e-shop__main-price">45900</b>', 'e-shop__main-price', 45900],
    ['<p>no price class here</p>', 'e-shop__main-price', 0],
    // the number must come from the anchored block, not from a capacity sitting before it
    ['256 GB <span class="e-shop__main-price">89' + NB + '900</span>', 'e-shop__main-price', 89900],
    // an attribute after the anchor is still inside the tag: the colour must not be the price
    ['<span class="price is-action" style="color: #000000"> 397' + NB + '900 </span>', 'class="price is-action"', 397900],
  ];
  const stockCases = [
    ['<div class="stock available" title="Availability"><span>In stock</span></div>', true],
    ['<div class="stock unavailable" title="Availability"><span>Out of stock</span></div>', false],
    // the swatch config flag is not a stock state; it appears on every configurable product
    ['{"canDisplayShowOutOfStockStatus":true,"channel":"website"}', true],
  ];
  for (const [html, want] of stockCases) {
    const got = stockOf(html);
    if (got !== want) { bad++; console.log(`FAIL stock got=${got} want=${want} <- ${html.slice(0, 60)}`); }
  }
  for (const [html, anchor, want] of priceCases) {
    const got = priceAfter(html, anchor);
    if (got !== want) { bad++; console.log(`FAIL  priceAfter got=${got} want=${want}  <- ${html}`); }
  }
  // The pin has to beat every heuristic below it, including the accessory reject and a title
  // that names a different product outright - that is the whole point of writing one by hand.
  PINS.set('https://example.am/p/1', 'apple-iphone-17-pro');
  PINS.set('https://example.am/p/2', '-');
  const pinCases = [
    ['apple-iphone-17-pro', 'https://example.am/p/1'],
    ['apple-iphone-17-pro', 'Case for Galaxy S26 https://example.am/p/1'],
    [null, 'iPhone 17 Pro https://example.am/p/2'],
    // a url nobody pinned still goes through the ordinary matcher
    ['apple-iphone-17-pro', 'iPhone 17 Pro https://example.am/p/3'],
  ];
  for (const [want, text] of pinCases) {
    const got = matchPhone(text);
    if (got !== want) { bad++; console.log(`FAIL  pin got=${got} want=${want}  <- ${text}`); }
  }
  PINS.delete('https://example.am/p/1'); PINS.delete('https://example.am/p/2');
  // and the SIM build a human checked beats the slug, which is the only way to read a shop that
  // has its own two builds the wrong way round
  const simPinCases = [
    ['https://ibolit.mobi/product/apple-iphone-18-pro-256gb-sim-glacier/', true],
    ['https://ibolit.mobi/product/apple-iphone-18-pro-256gb-esim-burgundy/', false],
  ];
  for (const [url, want] of simPinCases) {
    const got = SIMPINS.has(url) ? SIMPINS.get(url) : simBuild(url);
    if (got !== want) { bad++; console.log(`FAIL  sim pin got=${got} want=${want}  <- ${url}`); }
  }
  console.log(bad ? `${bad} failure(s)` : `all ${cases.length + st.length + ramCases.length + colCases.length + urlCases.length + priceCases.length + stockCases.length + simCases.length + pixCases.length + mcCases.length + medCases.length + buildCases.length + flipCases.length + capCases.length + pinCases.length + simPinCases.length + 1} checks pass`);
  process.exit(bad ? 1 : 0);
}

// Shared by the two JSON-LD shops: filter candidate URLs by matchPhone first so only pages that
// can be one of our products are fetched, then read name/price/stock out of the Product block.
async function crawlLd(urls, cap = 6) {
  const out = [], per = {};
  // How many of these urls this will actually ask for, said before it starts asking. REDstore's
  // sitemap lists 7,200 products; matchPhone refuses most of them without a request and the cap
  // trims the rest, but the run printed nothing at all for the 25 minutes that took, so a shop
  // doing its job was indistinguishable from a shop that had hung.
  const want = [];
  const seen = {};
  for (const u of urls) {
    const id = matchPhone(u);
    if (!id) continue;
    seen[id] = (seen[id] || 0) + 1;
    if (seen[id] <= cap) want.push(u);
  }
  if (want.length > 200)
    process.stdout.write(`
  ${want.length} page(s) to read of ${urls.length} listed, about ${Math.round(want.length * (DELAY_MS + 600) / 60000)} min: `);
  let done = 0;
  for (const u of urls) {
    const urlId = matchPhone(u);
    if (!urlId) continue;
    per[urlId] = (per[urlId] || 0) + 1;
    if (per[urlId] > cap) continue;              // cap requests per model
    if (want.length > 200 && ++done % 250 === 0) process.stdout.write(`${done} `);
    const html = await get(u); await sleep(DELAY_MS);
    if (!html) continue;
    const p = ldProduct(html), o = ldOffer(p);
    if (!o) continue;
    const price = Math.round(Number(o.price));
    const title = clean(p.name || '');
    // The url only decides which pages are worth fetching; what the shop CALLS the thing is in
    // the title, and every other adapter reads both. REDstore slugs the Tab S8 and the Tab S8+
    // alike as "tab-s8", and the plus tablet's price landed on the plain one.
    const id = matchPhone(title + ' ' + u) || urlId;
    if (!price || price < 5000 || !title || !safeUrl(u)) continue;
    const img = Array.isArray(p.image) ? p.image[0] : p.image;
    out.push({
      id, price, title, url: u,
      storage: storageOf(title) ?? storageOf(u),
      // Only an explicit out-of-stock value drops the offer; a missing availability means the
      // shop did not say, and those are kept the way every other adapter keeps them.
      inStock: !/OutOfStock|SoldOut|Discontinued|BackOrder|PreOrder/i.test(String(o.availability || '')),
      image: safeUrl(String(img || '')) || null,
      sku: p.sku || null
    });
  }
  return out;
}

const phoneById = Object.fromEntries(phones.map(p => [p.id, p]));

// A MacBook Air is one product in two screens, so an offer has to say WHICH screen or it would
// show under both. Shops write it as "MacBook Air 13 M4", "Air 13.6\"/M5/16GB" or "Pro 16 M5 Pro".
// The lookahead is what keeps "16GB" and "512GB" out: a number that is immediately a unit is a
// capacity, not a screen. Laptops only - a 15 in a phone title is not inches.
function screenOf(title, id) {
  if ((phoneById[id] || {}).category !== 'laptop') return undefined;
  const m = String(title || '').match(/(13\.6|13\.3|13|14|15\.3|15|16)(?!\s*(?:GB|TB|ԳԲ|ՏԲ|\d))/i);
  if (!m) return undefined;
  const n = +m[1];
  return n === 13.6 || n === 13.3 ? 13 : n === 15.3 ? 15 : n;
}
// A product sold in exactly one capacity, or one colour, needs no shop to state it: there is
// only one answer. 133 offers were showing no capacity for a product that has a single tier.
const soleValue = list => { const v = [...new Set((list || []).filter(x => x != null))]; return v.length === 1 ? v[0] : null; };
const enrich = (o) => ({
  ...o,
  storage: o.storage ?? soleValue(((phoneById[o.id] || {}).variants || []).map(v => v.storage)),
  ram: o.ram ?? ramOf(o.title),
  // iSpace titles name the colour in Armenian ("Սև", "Արծաթագույն") but every shop slugs the
  // English name into the product URL, so the slug is the reliable place to read it from.
  // Last resort, and it works surprisingly often: the shop names the colour in its own photo
  // filename ("...17-pro-orng-1.png"). pixel.am was the only adapter using this; every shop
  // that publishes an image gets it now, which is 32 more offers that can say what they are.
  color: o.color ?? colorOf(o.title + ' ' + String(o.url || '').replace(/[^a-zA-Z0-9]+/g, ' '), (phoneById[o.id] || {}).colors)
    ?? (o.image ? colorFromImage(o.image, (phoneById[o.id] || {}).colors) : null)
    ?? soleValue((phoneById[o.id] || {}).colors)
    ?? colorWords(String(o.url || '').replace(/[^a-zA-Z0-9]+/g, ' '))
});

/* ---------- shops ---------- */
const SHOPS = {
  ispace: {
    name: 'iSpace', site: 'https://ispace.am', note: 'Apple Premium Reseller',
    async run() {
      const out = [];
      const seen = new Set();
      // llms.txt points AI clients at /category/*; every catalogue category we carry is here
      const CATS = ['iphone', 'ipad', 'airpods', 'apple-watch', 'mac'];
      for (const cat of CATS)
      for (let page = 1; page <= 12; page++) {
        const html = await get(`https://ispace.am/category/${cat}${page > 1 ? '?page=' + page : ''}`);
        await sleep(DELAY_MS);
        if (!html) break;
        const list = ldJson(html).find(j => j['@type'] === 'ItemList');
        const urls = (list?.itemListElement || []).map(i => i.url).filter(Boolean);
        if (!urls.length) break;
        const fresh = urls.filter(u => !seen.has(u) && matchPhone(u));
        urls.forEach(u => seen.add(u));
        // A product page names its own siblings. The category listing shows ONE build of each
        // phone - the 256 GB Silver - and every other capacity and colour is rendered on that
        // page as <a aria-label="Go to product variant">, server-side, pointing at its own
        // product url. Not following them is why one iPhone 17 Pro reached us where the shop
        // sells five, and why so much of this site stood unchecked: the rows existed, the pages
        // existed, and nothing ever asked for them.
        const queue = [...fresh];
        for (let qi = 0; qi < queue.length && qi < 600; qi++) {
          const u = queue[qi];
          const ph = await get(u); await sleep(DELAY_MS);
          if (!ph) continue;
          for (const m of ph.matchAll(/<a[^>]*aria-label="Go to product variant"[^>]*>/gi)) {
            const href = (m[0].match(/href="(\/product\/[a-z0-9-]+)"/) || [])[1];
            if (!href) continue;
            const sib = 'https://ispace.am' + href;
            if (seen.has(sib) || !matchPhone(sib)) continue;
            seen.add(sib); queue.push(sib);
          }
          const pr = ldJson(ph).find(j => j['@type'] === 'Product');
          const price = Number(pr?.offers?.price);
          if (!pr || !price) continue;
          const id = matchPhone(pr.name + ' ' + u);
          const safe = safeUrl(u);
          if (!id || !safe) continue;
          out.push({ id, price, storage: storageOf(pr.name) ?? storageOf(u), title: pr.name, url: safe,
            sku: pr.sku || null, image: (Array.isArray(pr.image) ? pr.image[0] : pr.image) || null,
            inStock: /InStock/i.test(pr.offers.availability || '') });
        }
      }
      return out;
    }
  },

  vega: {
    name: 'Vega', site: 'https://vega.am', note: 'electronics retailer',
    async run() {
      const out = [];
      for (let page = 1; page <= 6; page++) {
        // robots.txt disallows limit/sort/order/search params — page is allowed
        const html = await get(`https://vega.am/home-appliances/phones-and-gadgets/smart-phones${page > 1 ? '?page=' + page : ''}`);
        await sleep(DELAY_MS);
        if (!html) break;
        const blocks = html.split('class="product-thumb').slice(1);
        if (!blocks.length) break;
        for (const b of blocks) {
          const url = (b.match(/href="(https:\/\/vega\.am\/[^"]*\.html)"/) || [])[1];
          const title = clean((b.match(/alt="([^"]{10,})"/) || [])[1] || '');
          const price = Number((b.match(/data-price-value="(\d+)"/) || [])[1]);
          if (!url || !title || !price || !safeUrl(url)) continue;
          const id = matchPhone(title + ' ' + url);
          if (!id) continue;
          // the listing serves 250x250; the same path also serves 500x500 (and 1500x1500)
          const thumb = (b.match(/src="(https:\/\/vega\.am\/image\/cache\/catalog\/[^"]+?\.jpg)"/) || [])[1];
          // Vega marks every tile: instock is "Առկա է", and outofstock covers "Առկա չէ",
          // "Պատվերով" (to order) and "Ճշտել առկայությունը" (ask us) - none of which is a
          // phone you can walk out with. This adapter used to assert inStock: true for all of
          // them, and 60 sold-out Vega listings were being published as buyable offers.
          const stock = (b.match(/class="stock-status (instock|outofstock)"/) || [])[1];
          out.push({ id, price, storage: storageOf(title) ?? storageOf(url), title, url,
            inStock: stock ? stock === 'instock' : undefined,
            image: thumb ? thumb.replace(/-250x250\.jpg$/, '-500x500.jpg') : null });
        }
        if (blocks.length < 5) break;
      }
      return out;
    }
  },

  mobilecentre: {
    name: 'Mobile Centre', site: 'https://mobilecentre.am', note: 'phone retail chain',
    async run() {
      const out = [];
      // this category ignores ?page= and returns its whole listing in one response,
      // so paging it just refetches the same 140 products
      {
        // one listing per catalogue category we carry; each returns its whole list in one response
        const MC = ['phones/138/0', 'tablets/139/0', 'smart-watches/141/175', 'headphone/146/156', 'computers/144/0'];
        const hits = [];
        for (const cat of MC) {
        const html = await get(`https://mobilecentre.am/category/${cat}/`);
        await sleep(DELAY_MS);
        if (!html) continue;
        const blocks = html.split('class="listitem"').slice(1);
        if (!blocks.length) continue;
        for (const b of blocks) {
          const url = (b.match(/href="(https:\/\/mobilecentre\.am\/product\/[^"]+)"/) || [])[1];
          const title = clean((b.match(/<h3[^>]*>([\s\S]{2,120}?)<\/h3>/) || [])[1] || '');
          // Two numbers again. data-price belongs to the credit calculator and is the
          // instalment total - the listing labels it "Ապառիկ գին". The price a buyer pays is
          // the one after "Գին՝", and it is lower: 519 900 against 549 900 on the iPhone 16 Pro
          // Max. The old fallback expected a </span> that is not in the markup, so it never
          // matched and the instalment figure always won.
          const price = mcCash(b) || Number((b.match(/data-price="(\d+)"/) || [])[1]);
          if (!url || !title || !price || !safeUrl(url)) continue;
          const id = matchPhone(title + ' ' + url);
          if (!id) continue;
          hits.push({ id, price, title, url });
        }
        }
        // The listing h3 is just the model name. The product page carries the real SKU in
        // og:title - "iPhone 17 Pro 256GB Dual eSIM (Cosmic Orange)" - so capacity and colour
        // come from there instead of being left blank. Only matched products are fetched.
        for (const h of hits) {
          const page = await get(h.url); await sleep(DELAY_MS);
          const og = page && clean((page.match(/property="og:title" content="([^"]+)"/) || [])[1] || "");
          const SEP = " - ";                                    // og:title is "Mobile Centre. - <sku>"
          const title = og ? (og.includes(SEP) ? og.slice(og.indexOf(SEP) + SEP.length) : og) : h.title;
          const img = page && (page.match(/property="og:image" content="([^"]+)"/) || [])[1];
          out.push({ id: h.id, price: h.price, storage: storageOf(title) ?? storageOf(h.url), title, url: h.url,
            image: img && safeUrl(img) ? img : null, inStock: true });
        }
      }
      return out;
    }
  },

  pixel: {
    name: 'Pixel', site: 'https://www.pixel.am', note: 'phone retailer',
    async run() {
      const out = [];
      let cat = '';
      // Nine sections, not five. Dyson lives under hair-dryer, the DJI mics under microphone,
      // and neither is reachable from the five this used to walk - which is why 15 Dyson rows sat
      // unlinked while their pages existed all along.
      const PX = ['phones', 'tablets', 'watches', 'headphones', 'laptops',
                  'accessories', 'pods', 'gamepad', 'hair-dryer', 'microphone', 'drone', 'smart-gadget'];
      for (const section of PX)
      // show=128, not 32: with 32 the listing stopped paginating after page 8 and the walk quietly
      // ended a third of the way through phones.
      for (let page = 1; page <= 12; page++) {
        const part = await get(`https://www.pixel.am/am/products/${section}?show=128&page=${page}`);
        await sleep(DELAY_MS);
        if (!part) break;
        cat += part;
        if (!/\/am\/product\//.test(part)) break;
      }
      if (!cat) return out;
      // Match on the LINK TEXT as well as the url. Pixel's slug for the Nothing Phone 3 is
      // /product/nothng-phone-3 - misspelled on their side - so a url-only filter can never reach
      // it, while the anchor text says "Nothing Phone 3" plainly.
      const named = new Map();
      for (const m of cat.matchAll(/<a[^>]+href="(https:\/\/www\.pixel\.am\/am\/product\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
        const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text && !named.has(m[1])) named.set(m[1], text);
      }
      const urls = [...new Set([...cat.matchAll(/https:\/\/www\.pixel\.am\/am\/product\/[a-z0-9-]+/g)].map(m => m[0]))]
        .filter(u => matchPhone(u) || matchPhone(named.get(u) || ''));
      for (const u of urls) {
        const h = await get(u); await sleep(DELAY_MS);
        if (!h) continue;
        // <title> is "<name>՝ գինը 274,000 Դրամ"; the variant blob carries every SKU price
        const title = clean((h.match(/<title>([^<]*)<\/title>/) || [])[1] || '').replace(/՝\s*գին[^]*$/, '').trim();
        const prices = [...h.matchAll(/"price":(\d{4,})/g)].map(m => +m[1]).filter(n => n > 1000);
        // Phone pages carry a variant blob with every SKU price. Tablet, watch and laptop
        // pages do not - there the price is only in the <title>.
        if (!prices.length) {
          const ti = h.indexOf("<title>"), te = h.indexOf("</title>");
          const head = ti >= 0 && te > ti ? h.slice(ti, te) : "";
          const at = head.indexOf("Դրամ");
          if (at > 0) {
            let e = at - 1, s = e;
            const sep = " ,. ";
            while (s >= 0 && (sep.indexOf(head[s]) >= 0 || (head[s] >= "0" && head[s] <= "9"))) s--;
            const n = Number(head.slice(s + 1, e + 1).replace(/[^0-9]/g, ""));
            if (n > 1000) prices.push(n);
          }
        }
        if (!title || !prices.length) continue;
        const id = matchPhone(title + ' ' + u);
        const safe = safeUrl(u);
        if (!id || !safe) continue;
        // the 800_ render is the shot the shop displays, so its filename names the variant on show
        let shot = null;
        for (let at = h.indexOf('/uploads/products/'); at >= 0 && !shot; at = h.indexOf('/uploads/products/', at + 1)) {
          const from = h.lastIndexOf('http', at);
          if (from < 0) continue;
          let to = at;
          const STOP = String.fromCharCode(34, 39) + " >";   // quote, apostrophe, space, gt
          while (to < h.length && STOP.indexOf(h[to]) < 0) to++;
          const u2 = h.slice(from, to);
          if (u2.includes('800_')) shot = u2;
        }
        const cols = (phoneById[id] || {}).colors;
        const v = pixelVariants(h, cols);
        const color = v.color || (shot ? colorFromImage(shot, cols) : null);
        // Pixel prints TWO numbers and the class names are backwards. .actual-price is labelled
        // "Ապառիկ" - instalment - and is the higher one; the cash price a buyer actually pays is
        // in .cash-price. PRODUCT_VARIANTS carries the instalment price too, so taking its
        // minimum published an inflated figure for every Pixel offer: the Galaxy A37 read
        // 129 000 against a shelf price of 119 000.
        const cash = pixelCash(h);
        const img = shot && safeUrl(shot) ? shot : null;
        // Every build the page sells, each with its own price. Only when there is more than one
        // - a page with a single SKU says nothing the cash price has not already said, and going
        // through the matrix for it would swap a figure read off the page for one read out of a
        // blob for no gain.
        const matrix = pixelMatrix(h, cols);
        if (matrix.length > 1) {
          for (const mv of matrix)
            out.push({ id, price: mv.price,
              storage: mv.storage ?? storageOf(title) ?? storageOf(u) ?? v.storage,
              ram: mv.ram ?? undefined, esim: mv.esim, simFromPage: mv.simFromPage,
              title, url: safe, image: img, color: mv.color || color, inStock: mv.inStock });
          continue;
        }
        out.push({ id, price: cash || Math.min(...prices),
          storage: storageOf(title) ?? storageOf(u) ?? v.storage, title, url: safe,
          image: img, color, inStock: true });
      }
      return out;
    }
  },


  ucom: {
    name: 'Ucom', site: 'https://shop.ucom.am', note: 'operator shop',
    async run() {
      const out = [], found = [];
      // robots.txt disallows every URL with a query string, so pagination is off limits and
      // each category contributes only its first page. Categories, not pages, give breadth.
      // Their own nav links 32 category pages and this used to walk five of them. Breadth is the
      // only lever here - no pagination means each category gives one page, so a category we do
      // not name is a page we never see. Accessories, cases, chargers and numbers stay out: the
      // catalogue does not carry them.
      const CATS = ['smartphones', 'tablets', 'smart-watches-bands', 'headphones', 'apple-products',
                    'macbooks', 'notebooks', 'tv', 'speakers', 'gadgets', 'cameras',
                    'smart-home-devices', '5g'];
      for (const cat of CATS) {
        const html = await get(`https://shop.ucom.am/am/${cat}.html`);
        await sleep(DELAY_MS);
        if (!html) continue;
        // Magento product grid: one <a class="product-item-link"> and one data-price-amount each
        const blocks = html.split('product-item-info').slice(1);
        for (const b of blocks) {
          const hi = b.indexOf(D + "https://shop.ucom.am/am/");
          const url = hi < 0 ? null : b.slice(hi + 1, b.indexOf(D, hi + 1));
          const li = b.indexOf("product-item-link");
          const gt = li < 0 ? -1 : b.indexOf(">", li);
          const title = gt < 0 ? "" : clean(b.slice(gt + 1, b.indexOf("<", gt)));
          const pi = b.indexOf("data-price-amount=" + D);
          const price = pi < 0 ? 0 : Math.round(Number(b.slice(pi + 19, b.indexOf(D, pi + 19))));
          if (!url || !title || !price || !safeUrl(url)) continue;
          const id = matchPhone(title + ' ' + url);
          if (!id) continue;
          const mi = b.indexOf(D + "https://shop.ucom.am/media/catalog/");
          const img = mi < 0 ? null : b.slice(mi + 1, b.indexOf(D, mi + 1));
          found.push({ id, price, title, url, image: img && safeUrl(img) ? img : null });
        }
      }

      // The grid shows ONE price - whichever colour and capacity Magento decided to show first -
      // so a phone sold in four capacities arrived here as a single number, and the picker on
      // the product page had nothing to pick between. Every real SKU is described on the product
      // page itself, in the same jsonConfig every other Magento shop here is read through.
      //
      // robots.txt disallows /*? , /catalog/ , /index.php/ and the rest; a product page is
      // .../en/<slug>.html and is none of those, so it may be fetched.
      const seen = new Set();
      for (const f of found) {
        if (seen.has(f.url)) continue;
        seen.add(f.url);
        const page = await get(f.url);
        await sleep(DELAY_MS);
        const kids = page ? magentoChildren(page, (phoneById[f.id] || {}).colors) : [];
        if (!kids.length) {
          // a simple product, with one price and nothing to choose: the grid already had it
          out.push({ ...f, storage: storageOf(f.title) ?? storageOf(f.url), inStock: true });
          continue;
        }
        for (const k of kids)
          out.push({ id: f.id, title: f.title, url: f.url, image: f.image,
                     price: k.price, storage: k.storage ?? storageOf(f.title) ?? storageOf(f.url),
                     ram: k.ram, color: k.color, inStock: k.inStock !== false });
      }
      return out;
    }
  },

  telecom: {
    name: 'Telecom Armenia', site: 'https://www.telecomarmenia.am', note: 'operator shop',
    async run() {
      const out = [];
      // Listing pages carry no price at all, so each matched product page is fetched. The page
      // shows TWO numbers: e-shop__main-price is the cash price, product-start-price is the
      // monthly instalment. Reading the wrong one would list a phone at a fiftieth of its price.
      // Two of the seventeen categories their own eshop links. The four added here are the ones
      // the catalogue actually carries; accessories, memory and connectivity are left out.
      const CATS = ['smartphones', 'notebooks-and-tablets', 'smart-watches', 'audio',
                    'devices', 'game-pad'];
      const seen = new Set();
      for (const cat of CATS) {
        const list = await get(`https://www.telecomarmenia.am/eshop/hy/${cat}/`);
        await sleep(DELAY_MS);
        if (!list) continue;
        const key = `/eshop/hy/${cat}/`;
        const urls = [];
        for (let at = list.indexOf(D + 'https://www.telecomarmenia.am' + key); at >= 0;
             at = list.indexOf(D + 'https://www.telecomarmenia.am' + key, at + 1)) {
          const u = list.slice(at + 1, list.indexOf(D, at + 1));
          if (u.length > key.length + 40 && !seen.has(u)) { seen.add(u); urls.push(u); }
        }
        for (const u of urls) {
          if (!matchPhone(u)) continue;                 // only fetch pages that can match
          const h = await get(u); await sleep(DELAY_MS);
          if (!h) continue;
          const title = clean((h.match(/<title>([^<|]*)/) || [])[1] || '');
          const price = priceAfter(h, 'e-shop__main-price');
          const id = matchPhone(title + ' ' + u);
          if (!id || !price || price < 5000 || !safeUrl(u)) continue;
          const img = (h.match(/property="og:image" content="([^"]+)"/) || [])[1];
          out.push({ id, price, storage: storageOf(title) ?? storageOf(u), title, url: u,
            image: img && safeUrl(img) ? img : null, inStock: true });
        }
      }
      return out;
    }
  },

  istore: {
    name: 'iStore', site: 'https://istore.am', note: 'authorised Apple reseller',
    async run() {
      // istore publishes a product sitemap with descriptive slugs, so only pages that already
      // look like one of our phones are fetched. robots.txt disallows /product/search - unused.
      const xml = await get('https://istore.am/sitemaps/sitemap-products-1.xml');
      await sleep(DELAY_MS);
      const urls = [...xml.matchAll(/<loc>(https:\/\/istore\.am\/product\/[^<]+)<\/loc>/g)].map(m => m[1]);
      const out = [], perPhone = {};
      for (const u of urls) {
        const id = matchPhone(u);
        if (!id) continue;
        perPhone[id] = (perPhone[id] || 0) + 1;
        if (perPhone[id] > 8) continue;               // cap requests per model
        const html = await get(u); await sleep(DELAY_MS);
        if (!html) continue;
        // ".price is-action" is the live price; ".price text-muted" is the struck-through old one
        const price = priceAfter(html, 'class="price is-action"');
        const title = clean((html.match(/<title>([^<|]*)/) || [])[1] || '');
        if (!price || !title) continue;
        if (!safeUrl(u)) continue;
        out.push({ id, price, storage: storageOf(title) ?? storageOf(u), title, url: u, inStock: true,
          image: (html.match(/https:\/\/istore\.am\/[^"']*?\.(?:jpg|png|webp)/) || [])[0] || null });
      }
      return out;
    }
  },

  allsell: {
    name: 'AllSell', site: 'https://allsell.am', note: 'electronics retailer',
    async run() {
      // Magento, and its robots.txt names the sitemaps. Same shape as iStore: filter the sitemap
      // by matchPhone first so only pages that can be one of our products are fetched.
      const xml = await get('https://allsell.am/media/sitemap/en.xml');
      await sleep(DELAY_MS);
      const urls = [...xml.matchAll(/<loc>(https:\/\/allsell\.am\/en\/[^<]+)<\/loc>/g)].map(m => m[1]);
      const out = [], perPhone = {};
      for (const u of urls) {
        const id = matchPhone(u);
        if (!id) continue;
        perPhone[id] = (perPhone[id] || 0) + 1;
        if (perPhone[id] > 6) continue;               // cap requests per model
        const html = await get(u); await sleep(DELAY_MS);
        if (!html) continue;
        // data-price-amount is Magento's machine-readable final price, the same marker Ucom uses;
        // the visible span carries thousands separators and a currency sign.
        const pi = html.indexOf('data-price-amount=' + D);
        if (pi < 0) continue;
        const price = Math.round(Number(html.slice(pi + 19, html.indexOf(D, pi + 19))));
        const title = clean((html.match(/<title>([^<|]*)/) || [])[1] || '');
        if (!price || price < 5000 || !title || !safeUrl(u)) continue;
        // Magento prints class="stock available" / class="stock unavailable". The old test looked
        // for the bare word OutOfStock anywhere in the page, and every configurable product
        // carries "canDisplayShowOutOfStockStatus":true in its swatch config - so 103 of
        // AllSell's 113 offers were being thrown away as sold out.
        const inStock = stockOf(html);
        const img = (html.match(/https:\/\/allsell\.am\/media\/catalog\/product\/[^"']*?\.(?:jpg|png|webp)/) || [])[0] || null;
        // A configurable product is ONE page and SEVERAL real SKUs. The visible price and title
        // belong to whichever child Magento happened to preselect; jsonConfig carries every
        // child's own price, stock, colour and capacity. Reading it is why the colour used to
        // say "variant not stated", why a sold-out colour was published as available, and why
        // the capacity came from parsing a title.
        const kids = magentoChildren(html, (phoneById[id] || {}).colors);
        if (kids.length) { for (const k of kids) out.push({ id, title, url: u, image: img, ...k }); continue; }
        out.push({ id, price, storage: storageOf(title) ?? storageOf(u), title, url: u, inStock, image: img });
      }
      return out;
    }
  },

  redstore: {
    name: 'REDstore', site: 'https://redstore.am', note: 'electronics retailer',
    async run() {
      // robots.txt allows /product/ and names no sitemap, but /sitemap.xml is a normal index.
      const idx = await get('https://redstore.am/sitemap.xml'); await sleep(DELAY_MS);
      const maps = [...idx.matchAll(/<loc>(https:\/\/redstore\.am\/sitemaps\/products\/\d+\.xml)<\/loc>/g)].map(m => m[1]);
      const urls = [];
      for (const m of maps) {
        const xml = await get(m); await sleep(DELAY_MS);
        // each product is listed three times, once per locale; the English page is the one we read
        for (const u of xml.matchAll(/<loc>(https:\/\/redstore\.am\/en\/product\/[^<]+)<\/loc>/g)) urls.push(u[1]);
      }
      return crawlLd(urls);
    }
  },

  planet3d: {
    name: '3DPlanet', site: 'https://3dplanet.am', note: 'Apple and electronics retailer',
    async run() {
      // Their sitemap lists four pages and no products, so the store index and the category
      // pages it links to are the crawl. robots.txt forbids query strings, so the filtered
      // category links (?brands[]=3) are dropped here rather than requested.
      const pages = new Set(['https://3dplanet.am/en/store']);
      const prods = new Set();
      for (const page of pages) {                 // a Set visits values added while iterating
        const html = await get(page); await sleep(DELAY_MS);
        if (!html) continue;
        for (const m of html.matchAll(/href="(https:\/\/3dplanet\.am\/en\/store\/[^"?]+)"/g)) {
          if (m[1].includes('/product/')) prods.add(m[1]);
          else if (pages.size < 40) pages.add(m[1]);
        }
      }
      const out = [];
      for (const u of prods) {
        const id = matchPhone(u); if (!id) continue;
        const html = await get(u); await sleep(DELAY_MS);
        if (!html || !safeUrl(u)) continue;
        const p = ldProduct(html), o = ldOffer(p);
        const title = clean((p && p.name) || '');
        const img = safeUrl(String((Array.isArray(p && p.image) ? p.image[0] : p && p.image) || '')) || null;
        // Each capacity is its own button with its own price and its own variation id, and
        // /variations/<id>/modifiers answers with the colours, their price deltas and - the part
        // that matters - is_active, which is 0 for a colour the shop has sold out of.
        const tiers = [...html.matchAll(/class="storage-btn[^"]*"([^>]*)>\s*([^<]+?)\s*</g)].map(m => ({
          price: Math.round(Number((m[1].match(/data-price="([\d.]+)"/) || [])[1] || 0)),
          varId: (m[1].match(/data-id="(\d+)"/) || [])[1],
          storage: capOf(m[2])
        })).filter(t => t.price >= 5000 && t.varId);
        if (!tiers.length) {
          const price = Math.round(Number((o && o.price) || 0));
          if (price >= 5000 && title) out.push({ id, price, title, url: u, image: img,
            storage: storageOf(title) ?? storageOf(u), inStock: true });
          continue;
        }
        for (const t of tiers) {
          const mod = await planetModifiers(t.varId); await sleep(DELAY_MS);
          const cols = mod.color || [];
          const sims = mod.sim || [];
          // Every real combination is SIM build x colour. A dimension this product does not
          // offer contributes exactly one pass-through option, so the loop still runs once per
          // colour on an Android phone and once per SIM build on a lone-colour iPhone.
          const simOpts = sims.length ? sims : [{ name: null, price: t.price, active: true }];
          const colOpts = cols.length ? cols : [{ name: null, price: 0, active: true }];
          for (const s of simOpts) for (const c of colOpts) {
            if (!s.active || !c.active) continue;
            out.push({
              id, url: u, image: img, storage: t.storage,
              // SIM's own value already IS the final price for that build; a colour delta rides
              // on top of it exactly as it would on the plain tier price.
              price: (sims.length ? s.price : t.price) + c.price,
              // same rule as magentoChildren: a colour name of 3DPlanet's own that maps to
              // none of the product's colours is left unstated rather than invented
              color: c.name ? (colorOf(c.name, (phoneById[id] || {}).colors) || null) : null,
              // The SIM build's own label rides in the title too, the way every other shop's
              // does - ibolit's url says "-1sim", redstore's title says "eSim". A later pass
              // re-derives esim from title+url for every shop and would DELETE a value it
              // cannot itself confirm; without the label in the title that pass saw a plain
              // "Apple iPhone 18 Pro" and erased the very field this line sets.
              title: sims.length ? `${title} (${s.name})` : title,
              esim: sims.length ? simBuild(s.name) : undefined,
              inStock: true
            });
          }
        }
      }
      return out;
    }
  },

  vlv: {
    name: 'VLV', site: 'https://vlv.am', note: 'electronics and home retailer',
    // promo_price while a promotion is running, selling_price otherwise. robots.txt allows this
    // path - the price endpoints it does disallow (/price/ajax, /getHomeActionPrice) are other
    // paths, and are not touched. 0 means "could not tell", and the caller keeps the ld+json.
    async price(vid) { return vlvPrice(vid); },
    async run() {
      // Their sitemap lists 13 003 products as /Product/<number> with no name in the URL, so
      // there is nothing to filter on before fetching. The title IS on the page, so the id ->
      // title map is built once into data/vlv-index.json and only the products that matched one
      // of ours are re-read each night. Rebuild it with: node tools/vlv-index.mjs
      const IDX = 'data/vlv-index.json';
      let index = {};
      try { index = JSON.parse(fs.readFileSync(IDX, 'utf8')); } catch { }
      const ids = Object.entries(index).filter(([, title]) => matchPhone(title)).map(([id]) => id);
      // No index yet: fall back to the handful of products we already know the numbers for, so
      // the shop still reports prices instead of nothing.
      const SEEDS = ['44014', '41419', '39879'];
      const out = [];
      // A product VLV has withdrawn stays in the index for ever and is asked for again every
      // night: ten of them 404'd in one run, which is ten requests and ten warnings for pages
      // that will never come back. A 404 takes the id out of the index; anything else - a
      // timeout, a 500 - leaves it alone, because that is the shop having a bad moment.
      const withdrawn = [];
      for (const vid of (ids.length ? ids : SEEDS)) {
        const u = `https://vlv.am/en/Product/${vid}`;
        const html = await get(u); await sleep(DELAY_MS);
        if (!html && LAST_STATUS === 404) withdrawn.push(vid);
        if (!html || !safeUrl(u)) continue;
        const p = ldProduct(html), o = ldOffer(p);
        const title = clean((p && p.name) || (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '')
          .replace(/^s*Buys+/i, '').replace(/s+in the VLV[^]*$/i, '');
        // the URL is /Product/44014 and names nothing, so the product is identified by its title
        const id = matchPhone(title);
        // The ld+json price is the catalogue figure and is neither always current nor ever the
        // discounted one: the 65" S95F printed 1,111,000 on the page while its ld+json still said
        // 1,587,000 and its own selling_price said 1,325,810. Three numbers, and the one the
        // customer pays is the smallest. So ask the endpoint the page itself asks.
        const live = await vlvPrice(vid); await sleep(DELAY_MS);
        const price = live || Math.round(Number((o && o.price) || 0));
        if (!id || !price || price < 5000) continue;
        const img = safeUrl(String((Array.isArray(p.image) ? p.image[0] : p.image) || '')) || null;
        out.push({ id, price, title, url: u, image: img,
          storage: storageOf(title), ram: ramOf(title),
          inStock: !/OutOfStock|SoldOut/i.test(String((o && o.availability) || '')) });
      }
      if (withdrawn.length) {
        for (const vid of withdrawn) delete index[vid];
        try { fs.writeFileSync(IDX, JSON.stringify(index)); } catch { }
        console.log(`  ${withdrawn.length} product(s) withdrawn by the shop, dropped from ${IDX}`);
      }
      return out;
    }
  },

  eldorado: {
    name: 'Eldorado', site: 'https://eldorado.am', note: 'electronics retailer',
    async run() {
      // eldorado.am sits behind a WAF that answers 403 to plain fetch(), robots.txt included.
      // Read through a browser-grade client their robots.txt allows product pages - it disallows
      // only checkout, search and Magento's internal paths, and names no crawler it refuses - so
      // tools/eldorado-fetch.py reads the category listings with scrapling at the 7-second delay
      // their robots asks of Googlebot, and leaves the result here. This adapter only matches and
      // prices it, so a machine without Python simply reports the last fetch instead of nothing.
      let rows = [];
      try { rows = JSON.parse(fs.readFileSync('data/eldorado.json', 'utf8')); } catch { }
      const out = [];
      for (const r of rows) {
        const id = matchPhone(r.title);
        if (!id || !r.price || r.price < 5000 || !safeUrl(r.url)) continue;
        out.push({ id, price: r.price, title: r.title, url: r.url,
          storage: storageOf(r.title), ram: ramOf(r.title), inStock: r.inStock !== false });
      }
      return out;
    }
  },

  ibolit: {
    name: 'iBolit', site: 'https://ibolit.mobi', note: 'audio and gadget retailer',
    async run() {
      // WooCommerce: the sitemap index names four product sitemaps, and every product page
      // carries a schema.org Product inside an @graph, which crawlLd already reads.
      const idx = await get('https://ibolit.mobi/wp-sitemap.xml'); await sleep(DELAY_MS);
      const maps = [...idx.matchAll(/<loc>([^<]*wp-sitemap-posts-product[^<]*)<\/loc>/g)].map(m => m[1]);
      const urls = [];
      for (const m of maps) {
        const xml = await get(m); await sleep(DELAY_MS);
        urls.push(...[...xml.matchAll(/<loc>(https:\/\/ibolit\.mobi\/product\/[^<]+)<\/loc>/g)].map(a => a[1]));
      }
      return crawlLd(urls);
    }
  },

  istyle: {
    name: 'iStyle', site: 'https://istyle.am', note: 'Apple and premium audio retailer',
    async run() {
      // robots.txt is "Allow: /" with a published sitemap, so this is an ordinary crawl. The only
      // awkwardness is where the price lives: the page renders it with JavaScript, but the data is
      // already in the HTML as an HTML-escaped JSON payload - "price_override":125000 inside a
      // variants array. Unescape and read it; no browser needed.
      const idx = await get('https://istyle.am/sitemap-en.xml'); await sleep(DELAY_MS);
      const urls = [...idx.matchAll(/<loc>([^<]*\/product\/[^<]+)<\/loc>/g)].map(m => m[1]);
      const out = [];
      for (const raw of urls) {
        // the sitemap prints the product name unencoded, spaces and all
        const name = clean(decodeURIComponent(raw.split('/product/')[1] || '')).replace(/\s+/g, ' ').trim();
        const id = matchPhone(name);
        if (!id) continue;
        const u = raw.split('/product/')[0] + '/product/' + encodeURIComponent(name);
        if (!safeUrl(u)) continue;
        const html = await get(u); await sleep(DELAY_MS);
        if (!html) continue;
        const json = html.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'");
        // The page also carries the variants of everything it recommends. The first block is this
        // product's - the one whose price the page prints at the top.
        const at = json.indexOf('"variants":[');
        if (at < 0) continue;
        const slice = json.slice(at, at + 4000);
        const first = /\{[^{}]*"price_override":(\d+)[^{}]*\}/.exec(slice);
        if (!first) continue;
        const listed = +first[1];
        const sale = /"is_on_sale":true[^}]*?"sale_price":(\d+)/.exec(slice);
        // a shop that is running a sale is asking the sale price, so that is the price
        const price = sale ? +sale[1] : listed;
        const stock = /"stock":(\d+)/.exec(first[0]);
        const active = /"is_active":true/.test(first[0]);
        if (!price || price < 5000) continue;
        out.push({ id, price, title: name, url: u,
          storage: storageOf(name), ram: ramOf(name),
          inStock: active && (!stock || +stock[1] > 0) });
      }
      return out;
    }
  },

  yerevanmobile: {
    name: 'Yerevan Mobile', site: 'https://www.yerevanmobile.am', note: 'phone retailer',
    async run() {
      // Crawled since 2026-09-20. Their robots.txt is one User-agent: * block with fourteen path
      // rules and nothing about AI at all; product pages are allowed. "Disallow: /*?" rules out
      // pagination, so as with Ucom the breadth has to come from categories rather than pages.
      // Accessories is left out: the catalogue does not carry them.
      const CATS = ['phones', 'tablets', 'watches', 'computers'];
      const out = [];
      for (const cat of CATS) {
        const html = await get(`https://www.yerevanmobile.am/en/electronics/${cat}.html`);
        await sleep(DELAY_MS);
        if (!html) continue;
        // Magento product grid. Ucom's index-scanning does not transfer: here the anchor writes
        // href BEFORE class, so reading "the first url in the block" picks up a hover widget
        // rather than the product. Match the anchor itself.
        const A = /<a[^>]*href="(https:\/\/www\.yerevanmobile\.am\/en\/[^"]+\.html)"[^>]*class="[^"]*product-item-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i;
        for (const b of html.split('product-item-info').slice(1)) {
          const a = A.exec(b);
          if (!a) continue;
          const url = a[1];
          const title = clean(a[2].replace(/<[^>]+>/g, ' '));
          const pi = b.indexOf('data-price-amount=' + D);
          const price = pi < 0 ? 0 : Math.round(Number(b.slice(pi + 19, b.indexOf(D, pi + 19))));
          if (!url || !title || !price || price < 5000 || !safeUrl(url)) continue;
          if (/\/electronics\//.test(url)) continue;         // a category, not a product
          const id = matchPhone(title, { price, url }) || matchPhone(url);
          if (!id) continue;
          out.push({ id, price, title, url,
            storage: storageOf(title) ?? storageOf(url), ram: ramOf(title), inStock: true });
        }
      }
      return out;
    }
  },

  // Notebook Centre has no adapter, and not for want of permission: their robots.txt allows
  // product pages and names six AI crawlers it refuses, none of them this one. The site simply
  // cannot be read. Every product page is a client-rendered shell - 2,345 characters of body
  // text, and neither the product's name nor its SKU appears in the server HTML, only the slug
  // already in the url. The data arrives from /get-products, which their robots.txt disallows.
  //
  // So their 216 rows stay hand-recorded. Reading them would mean either running their JavaScript
  // or fetching the endpoint they asked crawlers not to touch.
  notebookcentre: { name: 'Notebook Centre', site: 'https://notebookcentre.am', note: 'electronics retailer' },

  zigzag: {
    name: 'Zigzag', site: 'https://www.zigzag.am', note: 'electronics retailer',
    async run() {
      // zigzag.am sits behind a WAF that answers 403 to plain fetch(). Their robots.txt allows
      // product pages - it disallows checkout, Magento's internals and every URL with a query
      // string - and names no crawler it refuses, so tools/zigzag-fetch.py reads them with
      // scrapling and leaves the result here. This adapter only matches and prices it, so a
      // machine without Python reports the last fetch instead of nothing.
      //
      // The query-string ban is why that fetcher walks known product urls rather than their
      // catalogue: pagination is ?p=2 and search is ?q=, and both are off limits.
      let rows = [];
      try { rows = JSON.parse(fs.readFileSync('data/zigzag.json', 'utf8')); } catch { }
      const out = [];
      for (const r of rows) {
        const id = matchPhone(r.title) || matchPhone(r.url);
        if (!id || !r.price || r.price < 5000 || !safeUrl(r.url)) continue;
        out.push({ id, price: r.price, title: r.title, url: r.url,
          storage: storageOf(r.title) ?? storageOf(r.url), ram: ramOf(r.title),
          inStock: r.inStock !== false });
      }
      return out;
    }
  }
};

/* ---------- run ---------- */
// One shop or several: a whole run takes hours and the shops that matter for one question are
// usually two or three of them.
const picked = process.argv.slice(2).filter(a => !a.startsWith('--'));
// --handonly fetches nothing and only re-runs the merge below over data/listings.csv. An export
// arrives as a spreadsheet of prices with no urls in it, and crawling seventeen shops to publish
// numbers somebody has already read off the shelf is an hour of network for no new fact.
const names = process.argv.includes('--handonly') ? []
  : Object.keys(SHOPS).filter(k => picked.length ? picked.includes(k) : !SHOPS[k].disabled);
const unknown = picked.filter(k => !SHOPS[k]);
if (unknown.length) { console.error('no such shop: ' + unknown.join(', ')); process.exit(1); }

// Running one shop must not throw away the others. Start from what is already on disk and
// replace only the shops this run actually covers.
const TODAY = new Date().toISOString().slice(0, 10);
const PRICES_FILE = 'data/prices.json';
let prev = { shops: {}, offers: {} };
if (fs.existsSync(PRICES_FILE)) {
  try { prev = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8')); } catch { }
}
for (const [k, s] of Object.entries(SHOPS)) if (s.disabled && !names.includes(k)) console.log(`[${s.name}] skipped — ${s.disabled}`);
const offers = {};
for (const [id, list] of Object.entries(prev.offers || {})) {
  // Hand rows are rebuilt from data/listings.csv further down, so the previous run's copies are
  // dropped here. Inheriting them made the csv write-only: a row whose url was corrected still
  // lost to the stale copy sitting in the base, because dedupe keys on shop+storage+build and
  // the old one got there first. 23 dead links and 38 category urls survived several edits that
  // way.
  // ...and re-derived, not just copied. enrich() only ever FILLS a null - it cannot overwrite
  // what a shop said - so running it again is idempotent except where a rule has got better
  // since, which is the whole point: teaching capacitiesOf that "12/512GB" names a RAM gave 362
  // offers across twelve shops a memory figure they had been missing, and without this they
  // would each have waited for their own shop's next crawl to get it.
  const keep = list.filter(o => !names.includes(o.shop) && !o.seeded).map(o => {
    // ...and WITHOUT the SIM build it was written with. That field is an output of the post-pass
    // at the bottom of this file, which re-decides it from title, url, SIMPINS and NANO_ONLY on
    // every run - so carrying it forward feeds a conclusion back in as evidence. The hand-row
    // merge compares it before that post-pass runs, so a carried offer was being judged on last
    // night's answer while a freshly crawled one was judged on the raw reading, and the two
    // disagreed: REDstore's 519,000 Silver and 579,000 Dual iPhone 17 Pros were dropped as
    // duplicates of an eSIM row that only looked like a tray row because last night said so.
    // ...unless the adapter read it off the shop's own variant data, which is a fact the page
    // stated rather than a conclusion drawn from a title, and is not re-derivable from one:
    // pixel gives all eight builds of a phone the same title.
    const { esim, ...rest } = o;
    return enrich(o.simFromPage ? o : rest);
  });
  // An offer we are not re-fetching keeps the date it already had. One that predates the field
  // gets the date of the file it came out of, which is when it was last confirmed present -
  // borrowing today's would be the same false claim the field exists to remove.
  for (const o of keep) if (!o.seen) o.seen = (prev.generated || '').slice(0, 10) || TODAY;
  if (keep.length) offers[id] = keep;
}
const report = [];

// A whole run's work used to live only in memory until the very end, so anything that stopped
// the process - and on this machine that means the OS reclaiming memory - threw away every shop
// already crawled. One run died 77 minutes in, during the twelfth of eighteen shops, and the
// eleven behind it went with it.
//
// Each shop's offers are now written out as it finishes. A run started again the same day reads
// them back and skips those shops, so a death costs the shop it happened in rather than the day.
// --fresh ignores the file and crawls everything, which is what the nightly job wants.
const PARTIAL = '.scrape-partial.json';
const fresh = process.argv.includes('--fresh');
let done = { date: '', shops: {} };
if (!fresh && fs.existsSync(PARTIAL)) {
  try {
    const d = JSON.parse(fs.readFileSync(PARTIAL, 'utf8'));
    if (d.date === TODAY) {
      done = d;
      const have = Object.keys(done.shops).filter(k => names.includes(k));
      if (have.length) console.log(`resuming: ${have.length} shop(s) already read today (${have.join(', ')}) - --fresh to ignore`);
    }
  } catch { }
}

for (const key of names) {
  const s = SHOPS[key];
  CURSHOP = key;
  // Already read today, in a run that did not finish. Take it rather than ask the shop again.
  if (done.shops[key]) {
    for (const o of done.shops[key]) (offers[o.id] ||= []).push(o);
    const models = new Set(done.shops[key].map(o => o.id));
    console.log(`[${s.name}] ${done.shops[key].length} offers across ${models.size} models (already read today)`);
    report.push({ shop: key, offers: done.shops[key].length, models: models.size });
    continue;
  }
  process.stdout.write(`[${s.name}] `);
  let got = [], threw = false;
  try { got = await s.run(); } catch (e) { threw = true; console.warn('adapter failed:', e.message); }
  if (threw) {
    // keep what this shop had last night rather than dropping every one of its prices
    const kept = Object.values(prev.offers || {}).flat().filter(o => o.shop === key);
    for (const o of kept) (offers[o.id] ||= []).push(o);
    console.log(`kept ${kept.length} offer(s) from the previous run`);
    report.push({ shop: key, offers: kept.length, models: new Set(kept.map(o => o.id)).size, stale: true });
    continue;
  }
  // keep the cheapest offer per (phone, storage)
  const best = new Map();
  // Two different reasons, counted apart. A sold-out listing is perfectly plausible; calling it
  // implausible in the log made a third of AllSell's catalogue look like a parsing fault.
  let soldOut = 0, tooCheap = 0;
  for (const raw of got) {
    const o = enrich(raw);
    // A price on a sold-out page is not an offer anyone can take, so it has no business on a
    // price-comparison site. Only an explicit false counts - adapters that cannot read stock
    // leave it undefined, and dropping those would empty the catalogue.
    if (o.inStock === false) { soldOut++; continue; }
    // Catches accessories that do not use any of the words above: nothing legitimately sells
    // at under a third of the model's own reference price.
    const ref = (phoneById[o.id] || {}).priceAmd;
    if (ref && o.price < ref * 0.3) { tooCheap++; continue; }
    // A Nano-SIM build is a genuinely more expensive product, not a worse price on the same
    // one - and it was losing every time. The key that decides "same offer, keep the cheaper"
    // did not include the SIM build, so a shop's own Nano-SIM row was always more expensive
    // than its own eSIM row for the same phone/storage/colour and got silently thrown away
    // here, before esim/tray labelling or the pairing logic below ever saw it. Three states,
    // not two, in the key as much as in the field: true, false and unstated must each survive.
    const k = [o.id, o.storage ?? '?', o.color ?? '?', o.esim === true ? 'e' : o.esim === false ? 'n' : '?'].join('|');
    if (!best.has(k) || o.price < best.get(k).price) best.set(k, o);
  }
  // An adapter returning nothing is not the same as a shop having nothing in stock. A WAF page,
  // a changed layout or a redirect all parse to zero offers WITHOUT throwing, and since this run
  // has already dropped the shop's previous rows, that silently deletes every price it had. It
  // is how the nightly job published 1165 offers over 11 shops on the same day a local run found
  // 1482 over 13. Yesterday's price is stale; no price at all is worse.
  // Crawled rows only, on both sides. This counted the shop's HAND rows too, so a shop the
  // catalogue carries mostly by hand always looked like it had collapsed: Yerevan Mobile has
  // found 7 or 8 offers by crawl for as long as there are records, and its 103 seeded rows made
  // that read as "COLLAPSED from 104" every single night. Comparing a crawl against a crawl is
  // the only comparison that means anything, and it is what makes a real collapse visible.
  const had = Object.values(prev.offers || {}).flat().filter(o => o.shop === key && !o.seeded);
  if (!best.size && had.length) {
    for (const o of had) (offers[o.id] ||= []).push(o);
    console.log(`parsed 0 - kept ${had.length} offer(s) from the previous run`);
    report.push({ shop: key, offers: had.length, models: new Set(had.map(o => o.id)).size, stale: true });
    continue;
  }
  // Read from the shop's own page just now, so it is dated. An offer carried over from a shop
// that failed keeps whatever date it already had, which is the point of having one.
const rows = [...best.values()].map(o => ({ ...o, shop: key, seen: TODAY, size: screenOf(o.title, o.id) }));
  for (const o of rows) (offers[o.id] ||= []).push(o);
  // Written now, not at the end: this shop is read and should stay read even if the run dies in
  // the next one. Small enough that the cost is nothing beside the hour it saves.
  done.date = TODAY; done.shops[key] = rows;
  try { fs.writeFileSync(PARTIAL, JSON.stringify(done)); } catch { }
  const models = new Set([...best.values()].map(o => o.id));
  const collapse = had.length >= 20 && best.size < had.length * 0.25 ? `  <- COLLAPSED from ${had.length}` : '';
  const why = [soldOut && `${soldOut} sold out`, tooCheap && `${tooCheap} too cheap to be the product`].filter(Boolean);
  console.log(`${best.size} offers across ${models.size} of ${phones.length} models` + (why.length ? ` (${why.join(', ')})` : '') + collapse);
  report.push({ shop: key, offers: best.size, models: models.size });
}

// Hand-collected listings. A category crawl only sees what the shop chose to put on the pages it
// walks, so Eldorado's own laptop and audio aisles never reached data/eldorado.json, and zigzag
// refuses non-browser clients outright. Rows recorded by hand in data/listings.csv fill exactly
// those gaps. They are a floor, never an override: a row is added only when the live scrape found
// nothing for that shop, product and capacity, so a real price always wins.
// robots.txt governs what this crawler may FETCH, not what a price is: rows for the shops that
// disallow us (yerevanmobile, list.am, notebookcentre) are recorded by hand and carried here.
let seeded = 0;
try {
  const raw = fs.readFileSync('data/listings.csv', 'utf8').trim().split(/\r?\n/).slice(1)
    // A seventh column, and the rows written before it existed simply leave it empty. Ucom prices
    // the Galaxy A17 at 65,900 with 4 GB of memory and 73,900 with 6, both at 128 GB and in the
    // same three colours - two real configurations that nothing in six columns could tell apart.
    // A ninth column, seen: the day somebody opened that shop's own product page and read this
    // price off it. Without it every hand row printed "not checked" forever, including the ones
    // just confirmed - the crawl is the only thing that ever dated an offer, and these are the
    // rows no crawl can reach. Blank still means unverified, which is the honest default.
    .map(line => { const [shop, title, cap, color, url, price, ram, check, seen] = line.split(','); return { shop, title, cap, color, url, price, ram, check, seen }; });
  const shared = new Map();
  for (const r of raw) if (r.url) shared.set(r.url, (shared.get(r.url) || 0) + 1);
  const rows = raw
    // A hand row's url is read ONLY when somebody pinned it AND no other row names that same
    // url. Pixel's DJI mic kits say "Charging case" in their titles, the accessory filter threw
    // all four out, and the pin written to overrule that was keyed by url and so was never
    // consulted. But a third of these rows carry the url of the LISTING they were read off -
    // .../electronics/tablets.html, ...&page=3 - and 128 Yerevan Mobile rows share one of them.
    // The count comes from this file, which is the only place that knows: prices.json cannot
    // say, because by the time it is written the rows in question have already been thrown away.
    .map(r => ({ ...r, id: (PINS.has(r.url) && shared.get(r.url) === 1) ? matchPhone(r.url)
                           : matchPhone(r.title),
                 storage: r.cap ? +r.cap : null, ram: r.ram ? +r.ram : ramOf(r.title),
                 esim: simBuild(`${r.title} ${r.url}`) }))
    .filter(r => r.id && r.price);

  // pixel.am serves one product page under both /am/ and /en/. The crawl reads the Armenian
  // path and a hand row was written against the English one, so comparing the two literally
  // meant pass 1 never recognised the row it was meant to tag and pass 2 added a second copy
  // beside it - the same shop, the same price, the same colour, twice on the offers page. Only
  // a leading two-letter segment is dropped, which is a locale everywhere it appears here.
  const canonUrl = u => String(u || '').replace(/\/+$/, '')
    .replace(/^(https?:\/\/[^/]+)\/[a-z]{2}(\/)/i, '$1$2');

  // Pass 1 - TAG, not add. A crawler can only read the axes the page exposes, and 3DPlanet's
  // page shows no SIM option at all: its four prices are the eSIM build, which nothing on the
  // page says. A hand row carrying that shop's own price for a row we already have is telling us
  // which build it is, so it lends the row its title and the eSIM post-pass below re-reads it.
  let tagged = 0;
  for (const r of rows) {
    // url as well as price: a hand row names one page, and matching on shop+storage+price alone
    // tagged whichever row happened to share that price - two redstore rows at the same price got
    // opposite flags, the dedupe below then kept whichever came first, and the build alternated.
    const hit = (offers[r.id] || []).find(o => o.shop === r.shop && canonUrl(o.url) === canonUrl(r.url)
      && (o.storage ?? null) === r.storage && o.price === +r.price);
    if (hit && !!hit.esim !== !!r.esim) { hit.title = r.title; hit.esim = r.esim; tagged++; }
  }

  // Pass 2 - ADD the builds still missing. Split from pass 1 so a file that happens to list the
  // tray row before the eSIM row cannot change the outcome.
  for (const r of rows) {
    const list = offers[r.id] ||= [];
    // Colour belongs in this key as much as SIM build does: AirPods Max has no storage variant
    // at all, so every one of its colours shared the same (shop, storage, esim) key, and only
    // the first hand row ever written for a given shop could exist - iBolit's Red, Silver and
    // Sky Blue were silently dropped in favour of whichever colour got crawled or seeded first.
    // Colour alone still was not enough: iBolit's "Red" and "Silver" are not among the five
    // colours this product is actually catalogued in, so colorOf() left both null - the same
    // null, colliding with each other the moment the second one was checked against the first,
    // which this very loop had just pushed. Each hand row names its own real product page, so
    // the url is what tells two same-null-colour rows apart when colour itself cannot.
    if (list.some(o => o.shop === r.shop && (o.storage ?? null) === r.storage
                     // Read the same way on both sides, off the shop's own words. One side's
                     // stored flag is a previous run's conclusion and the other's is today's raw
                     // reading, and comparing the two made REDstore's 519,000 Silver vanish into
                     // its 509,000 eSIM sibling - a different page, a different price, a
                     // different phone. Where the ADAPTER read the build out of the shop's own
                     // variant data, that is the shop's word and the title is not consulted:
                     // pixel gives all eight builds of a phone one title, so deriving from it
                     // would fail to match the hand row that says the same thing and the two
                     // would sit side by side at the same price.
                     && !!(o.simFromPage ? o.esim : simBuild(`${o.title || ''} ${o.url || ''}`)) === !!r.esim
                     // A hand row with no colour in it is not a DIFFERENT colour, it is an
                     // unspecified one - and against a crawled row of the same build at the same
                     // price it says nothing the crawl has not already said today. 73 offers sat
                     // on the site twice for exactly this reason: pixel's iPhone 17 Pro 256GB at
                     // 474,000 read off the shop this morning, and beside it the same shop, the
                     // same capacity, the same 474,000, saying "not checked".
                     && ((o.color || null) === (r.color || null)
                         || (!r.color && !o.seeded && o.price === +r.price))
                     && (o.ram ?? null) === (r.ram ?? null)
                     // ...but only between two HAND rows. A crawled row is the shop's own page
                     // read today, and it covers this configuration whatever url somebody once
                     // wrote the hand row against - which is usually a category listing, or
                     // nothing at all. Requiring the urls to match here meant every hand row
                     // survived beside the crawled one it duplicates: zigzag showed 147 rows for
                     // 66 real offers, half of them dated and linked, half saying "not checked".
                     && (!o.seeded || canonUrl(o.url) === canonUrl(r.url)))) continue;
    // the title has to travel with the row: the eSIM post-pass re-derives o.esim from title+url,
    // and without it a seeded row is re-judged on its url alone.
    // enrich(), exactly as a crawled offer gets. It only ever fills a null, and a hand row
    // arrives with more nulls than any crawled one: the colour is usually not in the csv at all
    // but is sitting in plain sight in the url the row names. Four viva rows for the Galaxy A57
    // at 166,900 - .../a57-8gb-128gb-navy/, -iceblue/, -gray/, -lilac/ - all published with no
    // colour, so the page showed the same shop four times at one price with nothing to tell them
    // apart, and every one of them wearing a "check colour" badge over a link that says navy.
    list.push(enrich({ id: r.id, shop: r.shop, title: r.title, price: +r.price, storage: r.storage,
                ram: r.ram ?? undefined, size: screenOf(r.title, r.id),
                color: r.color || undefined, url: r.url, seeded: true, esim: r.esim,
                seen: /^\d{4}-\d{2}-\d{2}$/.test((r.seen || '').trim()) ? r.seen.trim() : undefined,
                checkColor: (r.check || '').trim() === 'color' || undefined,
                // this shop prices the configuration, not the page: tools/confirm-hand.mjs has
                // checked that the link opens the product, which is the only thing there is to
                // check, so the site says "by hand" rather than "not checked".
                pickOnSite: (r.check || '').trim() === 'config' || undefined }));
    seeded++;
  }
  if (tagged) console.log(`${tagged} crawled offer(s) had their SIM build named by a hand row`);
} catch (e) { if (e.code !== 'ENOENT') console.warn('listings.csv:', e.message); }
if (seeded) console.log(`\n${seeded} hand-recorded listing(s) filled gaps the crawl could not reach`);

// A shop page that names no capacity still has a price, and the other shops say what each
// capacity costs. If that price falls inside exactly ONE tier's band and outside every other,
// the tier is not a guess - AllSell's 278 500 iPhone 15 sits inside the 128 GB band (262 000 to
// 299 900) and nowhere near the 256 GB one, so it is a 128 GB. Ambiguous prices stay unstated.
let placed = 0;
for (const list of Object.values(offers)) {
  const band = new Map();
  for (const o of list) {
    if (o.storage == null) continue;
    const b = band.get(o.storage) || { lo: Infinity, hi: -Infinity };
    b.lo = Math.min(b.lo, o.price); b.hi = Math.max(b.hi, o.price);
    band.set(o.storage, b);
  }
  if (band.size < 2) continue;
  for (const o of list) {
    if (o.storage != null) continue;
    const fits = [...band].filter(([, b]) => o.price >= b.lo && o.price <= b.hi);
    if (fits.length === 1) { o.storage = fits[0][0]; placed++; }
  }
}
if (placed) console.log(`${placed} capacity-less offers placed in a tier by their price`);

for (const id of Object.keys(offers)) offers[id].sort((a, b) => a.price - b.price);

const shops = { ...(prev.shops || {}) };
for (const k of names) shops[k] = { name: SHOPS[k].name, site: SHOPS[k].site, note: SHOPS[k].note };
// A shop that only ever appears in data/listings.csv has no adapter, so nothing above names it.
// Without an entry here the offer row would print the raw key - "miarmenia" rather than "Mi Armenia".
const HAND = {
  miarmenia: { name: 'Mi Armenia', site: 'https://miarmenia.am', note: 'Xiaomi brand store' },
  mtech: { name: 'MTech', site: 'https://www.mtech.am', note: 'electronics retailer' },
  zigzag: { name: 'Zigzag', site: 'https://www.zigzag.am', note: 'electronics retailer' },
  // Viva's own shop, added 2026-09-20 from an export the owner took that day. Its robots.txt is
  // "Allow: /" with a sitemap and its product pages carry ld+json prices, so this is a shop that
  // could be crawled rather than carried by hand - the rows are here because the export was what
  // arrived, not because the shop refuses anything.
  viva: { name: 'Viva', site: 'https://shop.viva.am', note: 'mobile operator shop' },
};
for (const [k, v] of Object.entries(HAND)) if (!shops[k]) shops[k] = { ...v };

// "eSIM" in the name does NOT mean eSIM-only. 3DPlanet's two options read "E-Sim" and
// "1 Սիմ քարտ + Esim" - the second is the phone WITH a nano tray, and matching on esim alone
// would file it as the tray-less build and put its price under the wrong button.
// Shops that are official representatives import through the official channel, and that channel
// brings the physical nano tray only - so their listing never states a SIM build because there is
// only one to state, and reading nothing is not the same as there being nothing to read.
// A human's '!' still wins: this is a rule about a shop, and a rule can have an exception.
// viva, istore, vega and redstore import the same way, confirmed by the owner on 2026-09-21:
// if their listing does not say otherwise in its own name, it is the nano tray.
const NANO_ONLY = new Set(['zigzag', 'eldorado', 'ucom', 'telecom', 'ispace',
  'viva', 'istore', 'vega', 'redstore']);
// Only where a SIM build means anything. A laptop has no tray to charge more for, and stamping
// one on it would put a nano-SIM badge on a MacBook.
const HAS_SIM = new Set(phones.filter(p => p.category === 'phone').map(p => p.id));
for (const [id, list] of Object.entries(offers)) {
  for (const o of list) {
    // The shop's own words first, the shop's import channel only where it said nothing. This
    // rule exists because those shops never state a build, so it has no business overruling one
    // that did: REDstore titles 27 of its iPhones "... eSim" and every one of them was being
    // published as Nano-SIM, which is the opposite of what the shop wrote on its own page.
    const said = simBuild(`${o.title || ''} ${o.url || ''}`);
    // A build the ADAPTER read out of the shop's own variant data is not a guess and is not
    // re-derived here. pixel gives all eight builds of a phone the same title, so re-reading
    // that title would collapse the distinction the page went to the trouble of stating.
    const b = o.simFromPage ? o.esim
      : SIMPINS.has(o.url) ? SIMPINS.get(o.url)
      : said !== undefined ? said
      : (NANO_ONLY.has(o.shop) && HAS_SIM.has(id)) ? false
      : undefined;
    if (b === undefined) delete o.esim; else o.esim = b;
  }
}

// The physical nano tray ALWAYS costs more than the eSIM-only build - a shop never charges less
// for the extra hardware. A pair that comes back the other way round is therefore mislabelled,
// and the one thing we must not do is guess which half is wrong: an earlier version swapped the
// two prices, which flipped the urls, which made the next run re-read the labels off the swapped
// urls and swap them straight back - the price under each button alternated nightly.
// So we drop the claim instead. Both rows keep their own price and their own page; they simply
// stop asserting which build they are, the SIM picker does not appear, and nobody is shown a
// price under the wrong button. Deleting is idempotent, which swapping was not.
// One shop's price against every other shop's, which is a far better test of "is this real"
// than the static reference price: that one passes anything above 30% of a spec-sheet figure,
// and iBolit's iPhone 17 Pro Max 512 GB came back at 279 000 against a 668 900 median and sailed
// through - then led "Where you save most" on the front page with a 390 000 saving that did not
// exist. The shop's own page reads 625 000, so the crawl misread it. A price under half what
// three or more shops agree the same capacity costs is a scrape error, not a bargain.
let outliers = 0;
for (const [id, list] of Object.entries(offers)) {
  const byCap = new Map();
  for (const o of list) {
    const k = String(o.storage ?? 'base');
    (byCap.get(k) || byCap.set(k, []).get(k)).push(o);
  }
  for (const group of byCap.values()) {
    if (group.length < 3) continue;                 // too few to call anything a consensus
    const floor = medianOf(group.map(o => o.price)) * 0.5;
    for (const o of group) {
      if (o.price >= floor) continue;
      offers[id] = offers[id].filter(v => v !== o);
      outliers++;
      console.warn(`    ! ${id} ${o.shop} ${o.price} dropped: under half the ${Math.round(floor * 2)} median for this capacity`);
    }
  }
}
if (outliers) console.log(`${outliers} price(s) dropped as scrape errors`);

function medianOf(a) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

let simDropped = 0;
for (const list of Object.values(offers)) simDropped += dropUnrankableSim(list);
if (simDropped) console.log(`${simDropped} eSIM/nano pair(s) unlabelled (the tray was priced at or below the eSIM)`);

// Declared as a function so it hoists above the --selftest block, which exercises this exact
// code rather than a copy of it.
function dropUnrankableSim(list) {
  // Group ALL rows per key, not one representative each: prices.json is re-read as the base of
  // the next run, so a rule that depends on which row it happened to look at first changes its
  // mind every night. Comparing the cheapest of each side, and clearing every eSIM row in the
  // group, is order-independent and settles after one pass.
  const groups = new Map();
  for (const o of list) {
    const k = `${o.shop}|${o.storage ?? ''}|${(o.color || '').toLowerCase()}`;
    const g = groups.get(k) || { esim: [], tray: [] };
    if (o.esim === true) g.esim.push(o); else if (o.esim === false) g.tray.push(o);
    groups.set(k, g);
  }
  let n = 0;
  for (const { esim, tray } of groups.values()) {
    if (!esim.length || !tray.length) continue;
    const lowE = Math.min(...esim.map(o => o.price));
    const lowT = Math.min(...tray.map(o => o.price));
    if (lowT > lowE) continue;                  // the tray costs more: nothing to question
    for (const o of esim) delete o.esim;
    n++;
  }
  return n;
}

// An offer that arrived without a capacity but whose title states one. iBolit writes
// "iPHONE 17 256 Lavander ESIM" with no GB, so those rows used to land with storage null - and a
// null-capacity offer stands in for the BASE configuration of the product, which put a 256GB
// price on the cheapest tier of a phone that also sells at 512GB and 1TB. Re-derived on every
// run, so rows already on disk heal without a re-crawl.
let recap = 0;
for (const list of Object.values(offers)) {
  for (const o of list) {
    if (o.storage != null || !o.title) continue;
    const c = capacitiesOf(o.title);
    if (c.length === 1) { o.storage = c[0]; recap++; }
  }
}
if (recap) console.log(`${recap} offer(s) given the capacity their title states`);

// The opposite mistake: a capacity that is really the memory. A laptop titled "16GB/512GB" or
// "8ԳԲ/256ԳԲ" states both, and whichever parsed first won the capacity column - so the offers
// page offered "16 GB" and "24 GB" as storage tiers beside 512 GB and 1 TB. No laptop ships a
// 16 GB disk, so when the title names a bigger capacity, the small number was the memory all
// along. Only laptops and desktops: a watch's 44 is millimetres and a Kindle's 16 GB is real.
let remem = 0;
for (const [id, list] of Object.entries(offers)) {
  const c = (phoneById[id] || {}).category;
  if (c !== 'laptop' && c !== 'desktop') continue;
  for (const o of list) {
    if (o.storage == null || o.storage >= 64 || !o.title) continue;
    // "SSD512" and "SSD 1TB" state a capacity with no GB after the number, which capacitiesOf
    // cannot see, and that is exactly how these titles are written.
    const ssd = [...o.title.matchAll(/SSD\s*(\d{3,4})\b/gi)].map(m => +m[1]);
    const big = [...capacitiesOf(o.title), ...ssd].filter(v => v >= 64);
    if (big.length) {
      if (o.ram == null) o.ram = o.storage;
      o.storage = Math.min(...big);
      remem++;
      continue;
    }
    // No capacity anywhere in the title. It does not matter what the title calls the number:
    // no laptop ships a disk under 64 GB, so this is the memory whether the shop said so or
    // not. Admitting the disk is unknown beats publishing a 16 GB one.
    if (o.ram == null) o.ram = o.storage;
    o.storage = null;
    remem++;
  }
}
if (remem) console.log(`${remem} laptop offer(s) had memory in the capacity column`);

// Which SIM you get is normally not a choice a shop prices - but for the iPhone 17 and 18 Pro
// families it is: REDstore sells the 18 Pro 256GB at 799,000 as dual-eSIM and 879,000 with a
// tray. Tagging the offer lets the product page turn SIM into a real picker exactly where the
// two differ, and leave it as a stated fact everywhere else.

// One shop page can be reached under several colours, and each reading wrote its own row: the
// Xiaomi 17 Pro Max carried the same allsell URL four times, and 328 of 1600 offers site-wide
// were exact repeats. Deduping here rather than in each adapter covers the crawl, the hand-kept
// listings and any adapter added later - all of them land in `offers` before this point.
let deduped = 0;
for (const [id, list] of Object.entries(offers)) {
  const seen = new Set();
  offers[id] = list.filter(o => {
    // the SIM build belongs in the key: without it two rows for one page that differ only by
    // build collapse into whichever the loop reached first, and since this file is re-read as the
    // next run's base, the survivor alternated from night to night.
    // Colour belongs in it for the same reason the SIM build does. Ucom sells the iPhone 18 Pro
    // in four colours at one price from one page, and without colour here those four rows are
    // one row: the phone arrived with a single swatch and the picker had nothing to pick. An
    // exact repeat still collapses, because an exact repeat repeats the colour too.
    const k = [o.shop, o.url, o.price, o.storage ?? '', o.color ?? '', o.ram ?? '',
               o.esim === true ? 'e' : o.esim === false ? 'n' : '?'].join('|');
    return seen.has(k) ? (deduped++, false) : (seen.add(k), true);
  });
}
if (deduped) console.log(`${deduped} duplicate offer row(s) collapsed`);

// What the shops are selling that this catalogue does not list. Only the shops that ran are
// rewritten, so a single-shop run does not erase the others' readings.
const MISSF = 'data/unmatched.json';
const missPrev = fs.existsSync(MISSF) ? JSON.parse(fs.readFileSync(MISSF, 'utf8')) : { shops: {} };
for (const [shop, m] of MISSED)
  missPrev.shops[shop] = [...m.values()].sort((a, b) => a.title.localeCompare(b.title));
missPrev.generated = new Date().toISOString();
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(MISSF, JSON.stringify(missPrev, null, 1));
const missN = [...MISSED.values()].reduce((n, m) => n + m.size, 0);
const missPriced = [...MISSED.values()].reduce((n, m) => n + [...m.values()].filter(r => r.price).length, 0);
console.log(`${missN} title(s) on the shelves that the catalogue has no entry for -> ${MISSF}`);
if (missPriced) console.log(`   ${missPriced} of them carry a price and a link, so tools/add.mjs can read them`);

fs.writeFileSync('data/prices.json', JSON.stringify({
  generated: new Date().toISOString(),
  shops, offers
}, null, 1));

/* ---------- price history ----------
   History cannot be backfilled: it only exists from the first run that records it. Each run
   appends ONE point per phone per day (cheapest offer + how many shops), replacing the point
   if the same day is scraped twice. The chart stays honest - it plots only days we actually saw. */
const HIST = 'data/history.json';
const hist = fs.existsSync(HIST) ? JSON.parse(fs.readFileSync(HIST, 'utf8')) : { points: {} };
hist.points ||= {};
const day = new Date().toISOString().slice(0, 10);
let hadded = 0;
for (const [id, list] of Object.entries(offers)) {
  if (!list.length) continue;
  const lo = Math.min(...list.map(o => o.price));
  const hi = Math.max(...list.map(o => o.price));
  const shops = new Set(list.map(o => o.shop)).size;
  // History is what the site's credibility rests on, so a point is only recorded if it is
  // plausible. An accessory once slipped through as a 20 900 AMD "iPhone 15" and was baked
  // into day one; these guards stop a bad scrape becoming permanent history.
  const ref = (phoneById[id] || {}).priceAmd;
  if (ref && lo < ref * 0.45) { console.warn(`    ! history skipped ${id}: lo ${lo} implausible vs ${ref}`); continue; }
  if (hi / lo > 3) { console.warn(`    ! history skipped ${id}: spread ${lo}-${hi} too wide`); continue; }
  const prev = (hist.points[id] || []).filter(pt => pt.d !== day).slice(-1)[0];
  if (prev && Math.abs(lo - prev.lo) / prev.lo > 0.5) {
    console.warn(`    ! history skipped ${id}: ${prev.lo} -> ${lo} is a >50% jump`); continue;
  }
  const arr = (hist.points[id] ||= []);
  const i = arr.findIndex(pt => pt.d === day);
  const pt = { d: day, lo, hi, shops };
  if (i >= 0) arr[i] = pt; else { arr.push(pt); hadded++; }
  arr.sort((a, b) => a.d.localeCompare(b.d));
  if (arr.length > 400) arr.splice(0, arr.length - 400);   // ~13 months, plenty
}
hist.updated = day;
fs.writeFileSync(HIST, JSON.stringify(hist));
const days = new Set(Object.values(hist.points).flat().map(p => p.d)).size;
console.log(`data/history.json - ${hadded} new points, ${days} day(s) tracked so far`);

const covered = Object.keys(offers).length;
console.log(`\ndata/prices.json written — ${covered}/${phones.length} models have at least one real offer`);
const missing = phones.filter(p => !offers[p.id]).map(p => p.id);
if (missing.length) console.log('no offers found for:', missing.join(', '));
