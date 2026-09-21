// Which unmatched shelf titles are a product this catalogue ALREADY has?
//
//   node tools/shelf-pins.mjs           the candidates, best evidence first
//   node tools/shelf-pins.mjs --csv     as rows ready to paste into data/links.csv
//
// data/unmatched.json is every title on every shelf the crawl could not place. Most of them are
// products nobody here has entered yet - those need tools/add.mjs. But some are products that
// ARE in the catalogue, whose title the matcher simply did not recognise, and those are worse:
// the product page is live, somebody is reading it, and a real price is missing from it.
//
// Nothing is pinned automatically. A pin says "this url IS this product" in a human's voice, and
// a wrong one puts another phone's price on a page - so this prints evidence and a person picks.
import fs from 'node:fs';

const csv = process.argv.includes('--csv');
const PH = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const U = JSON.parse(fs.readFileSync('data/unmatched.json', 'utf8'));

const BRANDS = new Set(PH.map(p => String(p.brand || '').toLowerCase()).filter(Boolean));
const titleOf = t => String(t && t.title != null ? t.title : t)
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/https?:\/\/\S+/g, '').trim();
const urlOf = t => (String(t && t.title != null ? t.title : t).match(/https?:\/\/\S+/) || [''])[0];

// A model code names one product and one product only: MD3Y4TY/A, NX.KHJER.004, 83GS00E6RK.
// "512GB" is not one of those, and letters-plus-digits alone let it through - which pinned three
// different HP laptops, FD0127DX, FD0458NIA and FD0641NIA, onto one catalogue entry, because all
// three ship with 512GB. A capacity, a memory size, a wattage, a refresh rate: things a thousand
// products share name nothing.
const codes = s => (String(s).toUpperCase().match(/\b[A-Z0-9][A-Z0-9./-]{4,}\b/g) || [])
  .filter(c => (c.match(/[A-Z]/g) || []).length >= 2 && (c.match(/\d/g) || []).length >= 3
    && !/^\d+(GB|TB|MB|W|HZ|MM|MAH|NITS?)$/.test(c));
const words = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
  .filter(w => w.length > 1);
const NOISE = new Set(['the', 'and', 'with', 'for', 'new', 'gb', 'tb', 'mm', 'wifi', 'wi', 'fi',
  'cellular', 'esim', 'nano', 'sim', 'dual', 'notebooks', 'notebook', 'smartphone', 'tablet',
  'core', 'ryzen', 'ultra', 'intel', 'amd', 'ssd', 'ram', 'inch', 'fhd', 'oled', 'w11', 'dos']);
// A processor is not a model. "Lenovo V15 Gen5 IRL / Core i5-13420H / 16GB" scored 0.43 against
// the IdeaPad Slim 5 16IRH10 purely on lenovo, 16, i5 and 13420h - the brand, the memory size and
// the CPU - while ideapad, slim and 16irh10, the words that actually name the machine, matched
// nothing. Anything that describes what is INSIDE a computer is shared by hundreds of them.
const SPEC = w => /^i[3579]$/.test(w) || /^\d{3,5}[a-z]{0,2}$/.test(w) || /^\d+$/.test(w)
  || /^(rtx|gtx|mx)\d{3,4}$/.test(w);

// what the catalogue knows a product by: its name, and anything a person has already aliased
const cat = PH.map(p => {
  const names = [p.name, ...(p.aliases || [])].filter(Boolean);
  return {
    id: p.id, brand: String(p.brand || '').toLowerCase(),
    keys: names.map(n => words(`${p.brand} ${n}`).filter(w => !NOISE.has(w) && !SPEC(w))),
    codes: new Set(names.flatMap(n => codes(n))),
  };
});

// ...and the same reasoning, applied by counting instead of by guessing. "512GB" was excluded by
// hand; "i5-13420H" is a processor and would need excluding next, then a GPU, then a screen. But
// a code worth pinning on names ONE product, so a code that appears in two catalogue entries is
// by definition not one - whatever kind of thing it is. That is what pinned a Lenovo V15 Gen5
// onto an IdeaPad Slim 5: they share a CPU.
const codeCount = new Map();
for (const c of cat) for (const k of c.codes) codeCount.set(k, (codeCount.get(k) || 0) + 1);
for (const c of cat) c.codes = new Set([...c.codes].filter(k => codeCount.get(k) === 1));

const out = [];
for (const [shop, list] of Object.entries(U.shops || {})) {
  for (const raw of list) {
    const t = titleOf(raw);
    const brand = words(t)[0];
    if (!BRANDS.has(brand)) continue;               // same bar the dashboard uses
    const tw = new Set(words(t).filter(w => !NOISE.has(w) && !SPEC(w)));
    const tc = codes(t);
    let best = null;
    for (const c of cat) {
      if (c.brand !== brand) continue;
      // a shared model code is proof; shared words are a suggestion
      const codeHit = tc.some(x => c.codes.has(x));
      let share = 0;
      for (const k of c.keys) {
        // A key of one or two words is almost always just the brand once the spec words are gone,
        // and then every product of that brand matches it at 100%: "Apple TV 4K", "Apple Vision
        // Pro" and "Apple Watch Series 12" all landed on apple-ultra-2 that way. A key that short
        // cannot carry a match on words alone.
        if (k.length < 3) continue;
        const n = k.filter(w => tw.has(w)).length / k.length;
        if (n > share) share = n;
      }
      const score = (codeHit ? 100 : 0) + share * 10;
      if (score > 0 && (!best || score > best.score)) best = { id: c.id, score, codeHit, share };
    }
    // A shared code is strong evidence, not proof, and counting how often it appears in the
    // catalogue does not catch a processor: i5-13420H sits in exactly one entry here - it is even
    // in that entry's id - and in a thousand laptops out there. So a code has to be accompanied
    // by the titles looking something like each other. "Lenovo V15 Gen5 IRL" and "Lenovo IdeaPad
    // Slim 5 16IRH10" share a CPU and nothing else, and they are not the same computer.
    if (best && ((best.codeHit && best.share >= 0.35) || best.share >= 0.9))
      out.push({ shop, title: t, url: urlOf(raw), ...best });
  }
}
out.sort((a, b) => b.score - a.score || a.shop.localeCompare(b.shop));

if (csv) {
  // data/links.csv is id,product,shop,shopTitle,storage,color,esim,price,seen,url - the id
  // first and the url last, which is the pair scrape.mjs reads before any heuristic runs.
  const q = v => /[",]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  console.log('id,product,shop,shopTitle,storage,color,esim,price,seen,url');
  // Only the code-backed ones. A pin is a person's word that this url IS this product, and the
  // word-overlap tier is not good enough to put words in anyone's mouth.
  for (const r of out) if (r.url && r.codeHit) console.log([r.id, '', r.shop, q(r.title), '', '', '', '', '', r.url].join(','));
} else {
  const byShop = {};
  for (const r of out) byShop[r.shop] = (byShop[r.shop] || 0) + 1;
  console.log(`${out.length} shelf title(s) look like a product the catalogue already has`);
  console.log('  ' + Object.entries(byShop).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') + '\n');
  // Two tiers, because they deserve different trust. A model code that names exactly one
  // catalogue entry, with the titles agreeing too, is evidence somebody can check in seconds.
  // A word overlap on its own is a hunch. Even the first tier is read, never pinned blind: an
  // "IdeaPad Slim 3 15IRH10 i7-13620H" and our i5 entry share 15IRH10 and are different machines.
  const sure = out.filter(r => r.codeHit), maybe = out.filter(r => !r.codeHit);
  console.log(`MODEL CODE (${sure.length}) - the code names one entry and the titles agree:`);
  for (const r of sure.slice(0, 30))
    console.log(`  ${r.shop.padEnd(14)} ${r.title.slice(0, 52).padEnd(54)} -> ${r.id}`);
  console.log(`\nWORD OVERLAP ONLY (${maybe.length}) - a hunch, read before believing:`);
  for (const r of maybe.slice(0, 10))
    console.log(`  ${String(Math.round(r.share * 100)).padStart(3)}% ${r.shop.padEnd(14)} ${r.title.slice(0, 52).padEnd(54)} -> ${r.id}`);
  console.log(`\n--csv emits the ${sure.filter(r => r.url).length} code matches carrying a url, for data/links.csv`);
}
