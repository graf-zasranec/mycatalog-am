// Turns the unmatched rows of a converted export into catalogue entries.
//
//   node tools/add.mjs rows.json             what it would add, and what it refuses
//   node tools/add.mjs rows.json --refused   also why each refusal was refused
//   node tools/add.mjs rows.json --write     write them
//
// A row becomes a product only if it carries a price. No price, no entry: a comparison with
// nothing to compare is an empty page wearing a product's name.
//
// Nothing here invents a specification. Brand, model, capacity and category are read off the
// shop's own title and its own url, and a row that does not say enough is refused rather than
// filled in. What is refused is printed, so the refusals can be read rather than trusted.
import fs from 'node:fs';

const src = fs.readFileSync('scrape.mjs', 'utf8');
const body = src.slice(0, src.indexOf('const report = [];')).replace('process.argv.slice(2)', '[]');
const { matchPhone, looksLikeAccessory } = await import('data:text/javascript;base64,' +
  Buffer.from(body + '\nexport { matchPhone, looksLikeAccessory };\n', 'utf8').toString('base64'));

const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const BRANDS = [...new Set(phones.map(p => p.brand))]
  .concat(['OPPO', 'Vivo', 'Motorola', 'Nokia', 'ZTE', 'Infinix', 'Tecno', 'Fitbit', 'Whoop',
           'Garmin', 'Anker', 'Logitech', 'Hisense', 'Panasonic', 'Toshiba'])
  // longest first, so "Bang & Olufsen" is not read as nothing at all
  .sort((a, b) => b.length - a.length);
const reBrand = (b, flags) => new RegExp('(^|\\s)' + b.replace(/[+&()[\]{}.*?^$|\\]/g, '\\$&') + '(\\s|$)', flags);

// The word a shop puts in front of a thing to say what kind of thing it is. Armenian, Russian
// and English in one table, because one shop uses all three in the same export.
// No \b anywhere near an Armenian or Russian word. JavaScript's word boundary is defined on
// ASCII, so \bՆոթբուք\b can never match: a space followed by Ն is two non-word characters and
// therefore no boundary at all. Every one of these silently matched nothing, which is why
// "Նոթբուք" stayed inside the model name and "Պլանշետ Apple iPad" had no category to be filed
// under. Laptop is asked before tablet, because a shop that sells both puts both words in one url.
const KINDS = [
  [/Նոթբուք|\bNotebook\b|\bLaptop\b|ноутбук/i, 'laptop'],
  [/Պլանշետ|\bTablet\b|планшет/i, 'tablet'],
  [/Մոնոբլոկ|համակարգիչ|\bAll-in-One\b|\bDesktop\b|моноблок/i, 'desktop'],
  [/Մոնիտոր|\bMonitor\b|монитор/i, 'monitor'],
  [/հեռուստացույց|телевизор|\bSmart TV\b/i, 'tv'],
  [/Speaker system|\bSpeaker\b|բարձրախոս|колонк/i, 'speaker'],
  [/\bHeadphone\b|\bHeadset\b|ականջակալ|наушник/i, 'headphones'],
  [/\bEarbuds\b|\bBuds\b|\bAirPods\b/i, 'earbuds'],
  // "Tracker" and "traker" both appear, in the same export, for the same device
  [/(Smart ?)?fitness trac?k?er|\bSmart ?watch\b|\bWatch\b|ժամացույց|часы/i, 'watch'],
  [/\bStyler\b|Airwrap|hair ?dry|Supersonic|փոշեկուլ|пылесос/i, 'appliance'],
  [/\bSmartphone\b|Սմարթ ?հեռախոս|смартфон/i, 'phone'],
];
// A shop's own section is a better witness than a word that is not there: a row scraped off
// .../smartphones/... is a phone even when its title only says "Samsung A07".
const SECTIONS = [[/smartphone|\/phones?\//i, 'phone'], [/tablet/i, 'tablet'],
  [/laptop|notebook/i, 'laptop'], [/watch/i, 'watch'], [/headphone|audio/i, 'headphones'],
  [/monitor/i, 'monitor'], [/\/tv\b/i, 'tv']];

// Of the things that go inside a computer, only video cards and processors.
const PC_PART = /\bSSD\b|\bHDD\b|\bNVMe\b|\bDIMM\b|\bDDR[45]\b|motherboard|материнск|блок питания|power supply/i;
const IS_CHIP = /\bRTX\s?\d|\bGTX\s?\d|Radeon RX|GeForce|Ryzen \d|Core i\d|Core Ultra|видеокарт|процессор/i;

const slug = s => s.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cap = t => {
  const m = String(t ?? '').match(/(\d+)\s*(GB|TB|ԳԲ|ՏԲ)/i);
  if (!m) return null;
  const v = +m[1];
  return /tb|տբ/i.test(m[2]) && v < 16 ? v * 1024 : v;
};

// Two shops write the same machine in a different order and the matcher, which reads left to
// right, sees two machines: Telecom's "MacBook Pro M5 14" against our "MacBook Pro 14 M5", and
// "MacBook Pro 14.2"" against "MacBook Pro 14". Comparing the words as a SET rather than a
// sequence catches both, and catches nothing else - a set is still every word, in any order.
const inches = s => String(s).replace(/(\d+)[.,]\d+\s*(["”]|inch|-inch)?/g, '$1');
// Two readings of the same name, because shops break it in two different ways. The BAG ignores
// word order - Telecom's "MacBook Pro M5 14" against our "MacBook Pro 14 M5". The SQUASH ignores
// where the spaces fell - "IdeaPad Slim 3 15 IRH10R" against "IdeaPad Slim 3 15IRH10R", the same
// laptop listed twice at 291,900 and 299,900. Neither reading loses a letter, so neither can
// merge two products that really differ.
const bag = s => inches(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).sort().join(' ');
const squash = s => inches(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const KNOWN = new Map();
for (const p of phones) {
  KNOWN.set(p.brand.toLowerCase() + '|' + bag(p.name), p.id);
  KNOWN.set(p.brand.toLowerCase() + '|' + squash(p.name), p.id);
}
// The price does not get to decide anything. Two Xiaomi phones at 84,900 are two phones, and a
// guard that refused on price alone threw out a real Redmi Note 14S. It only marks a row for a
// person to look at, and the row is added either way.
const SAME_PRICE = new Map();
for (const p of phones) SAME_PRICE.set(p.brand.toLowerCase() + '|' + p.category + '|' + p.priceAmd, p.id);
const suspect = [];

const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter(r => r.price);
const out = [], refused = [];
for (const r of rows) {
  if (matchPhone(r.name)) continue;                       // already a product here
  if (looksLikeAccessory(r.name)) { refused.push(['accessory', r]); continue; }
  if (PC_PART.test(r.name) && !IS_CHIP.test(r.name)) { refused.push(['pc part', r]); continue; }

  // The capacity arrives twice: after the '|' this shop joins two columns with, and again inside
  // the title - "Samsung A165 256GB | 256 GB". Neither is part of a name. "Honor 200Lite 8/256"
  // writes the memory as a pair, which is a configuration and not a model either.
  const title = r.name.replace(/\s*\|\s*\d+\s*(GB|TB|ԳԲ|ՏԲ)?\s*$/i, '')
                      .replace(/\s+\d+\s*(GB|TB|ԳԲ|ՏԲ)\b/gi, ' ')
                      .replace(/\s+\d{1,2}\/\d{2,4}\b/g, ' ')
                      .replace(/\s{2,}/g, ' ').trim();
  // A shop drops the maker's name when the model already carries it: "iPad Pro 11 Wi-Fi" and
  // "Galaxy Buds4 Pro" name their makers as surely as the word Apple or Samsung would.
  const OWNED = [[/\b(iPhone|iPad|MacBook|AirPods|iMac|Mac mini|Apple Watch)\b/i, 'Apple'],
                 [/\bGalaxy\b/i, 'Samsung'], [/\bRedmi\b|\bPoco\b/i, 'Xiaomi'], [/\bPixel\b/i, 'Google']];
  const brand = BRANDS.find(b => reBrand(b, 'i').test(title))
    || (OWNED.find(([re]) => re.test(title)) || [])[1];
  if (!brand) { refused.push(['no brand', r]); continue; }

  const kind = (KINDS.find(([re]) => re.test(title)) || [])[1]
    || (SECTIONS.find(([re]) => re.test(r.url || '')) || [])[1];
  if (!kind) { refused.push(['no category', r]); continue; }

  // the model is what is left once the brand and the kind-word are taken out of the shop's title
  let name = title;
  for (const [re] of KINDS) name = name.replace(new RegExp(re.source, 'gi'), ' ');
  name = name.replace(reBrand(brand, 'ig'), ' ')
             .replace(/\(\s*\)/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s|,-]+|[\s|,-]+$/g, '');
  if (name.length < 2) { refused.push(['no model', r]); continue; }
  const b = brand.toLowerCase();
  const already = KNOWN.get(b + '|' + bag(name)) || KNOWN.get(b + '|' + squash(name));
  if (already) { refused.push(['already ' + already, r]); continue; }
  const twin = SAME_PRICE.get(b + '|' + kind + '|' + r.price);
  if (twin) suspect.push({ id: slug(brand + ' ' + name), twin, title: r.name.replace(/\s{2,}/g, ' ').trim(), price: r.price, url: r.url || '' });

  // The model is the shop's title with the brand and the kind-word taken OUT OF THE MIDDLE, and
  // the matcher reads a key as a run of consecutive words - so "Styler Dyson HS08 Airwrap I.D"
  // became "HS08 I.D", which appears nowhere in that title, and the product it was created from
  // could not find its own listing. The catalogue already has the answer for a shop that spells
  // a thing its own way: the product carries that spelling as an alias.
  out.push({ id: slug(brand + ' ' + name), brand, name, category: kind, alias: title,
             storage: cap(r.storage) ?? cap(r.name), price: r.price, shop: r.shop,
             url: r.url || '', title: r.name.replace(/\s{2,}/g, ' ').trim() });
}

// one entry per id, every listing kept - and the squash reading applies within this batch too,
// since the same export lists the same laptop under both spellings
const canon = new Map();
for (const o of out) {
  const k = o.brand.toLowerCase() + '|' + squash(o.name);
  if (canon.has(k)) o.id = canon.get(k); else canon.set(k, o.id);
}
const byId = new Map();
for (const o of out) (byId.get(o.id) || byId.set(o.id, []).get(o.id)).push(o);
const have = new Set(phones.map(p => p.id));
const fresh = [...byId].filter(([id]) => !have.has(id));

console.log(`${rows.length} row(s): ${out.length} placeable, ${refused.length} refused`);
console.log(`${byId.size} distinct product(s), ${fresh.length} not already here\n`);
const byKind = {};
for (const [, list] of fresh) (byKind[list[0].category] ||= []).push(list[0]);
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`-- ${k} (${v.length})`);
  for (const o of v.sort((a, b) => a.id.localeCompare(b.id)))
    console.log(`   ${String(o.price).padStart(8)}  ${o.id.padEnd(34)} ${o.brand} ${o.name}`);
}
if (suspect.length) {
  console.log(`\n== ${suspect.length} to check by hand: same make, same kind, exactly the same price ==`);
  for (const s of suspect) console.log(`   ${String(s.price).padStart(8)}  ${s.id.padEnd(30)} vs ${s.twin}`);
  fs.writeFileSync('data/check-by-hand.csv',
    'id,samePriceAs,price,shopTitle,url\n' +
    suspect.map(s => [s.id, s.twin, s.price, s.title.replace(/,/g, ' '), s.url].join(',')).join('\n') + '\n');
  console.log('   -> data/check-by-hand.csv');
}
if (process.argv.includes('--refused')) {
  console.log('\n== refused ==');
  for (const [why, r] of refused) console.log(`  ${why.padEnd(34)} ${r.name.replace(/\s{2,}/g, ' ').slice(0, 68)}`);
}

if (!process.argv.includes('--write')) { console.log('\npass --write to add them'); process.exit(0); }

const added = [], csv = [];
for (const [id, list] of fresh) {
  const o = list[0], prices = list.map(x => x.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const tiers = [...new Set(list.map(x => x.storage).filter(Boolean))].sort((a, b) => a - b);
  added.push({
    id, category: o.category, brand: o.brand, name: o.name,
    aliases: [...new Set(list.map(x => x.alias).filter(a => a && a.toLowerCase() !== (o.brand + ' ' + o.name).toLowerCase()))],
    tier: lo < 100000 ? 'budget' : lo < 300000 ? 'mid' : lo < 700000 ? 'upper-mid' : 'flagship',
    priceAmd: lo, priceAmdMax: hi, popularity: 40, accent: '#5C6470',
    variants: tiers.length
      ? tiers.map(s => ({ ram: null, storage: s,
          priceAmd: Math.min(...list.filter(x => x.storage === s).map(x => x.price)) }))
      : [{ ram: null, storage: null, priceAmd: lo }],
    display: {}, battery: {},
    summaryEn: `${o.brand} ${o.name}.`,
    // Nothing on the listing states a screen, a chip or a battery, so nothing here claims one.
    unsure: ['popularity', 'display', 'chipset', 'battery.capacity'],
  });
  for (const x of list)
    csv.push([x.shop, x.title.replace(/,/g, ' '), x.storage || '', '', x.url, x.price].join(','));
}
fs.writeFileSync('data/phones.json', JSON.stringify([...phones, ...added], null, 1));
const old = fs.readFileSync('data/listings.csv', 'utf8').replace(/\n+$/, '');
fs.writeFileSync('data/listings.csv', old + '\n' + csv.join('\n') + '\n');
console.log(`\n${added.length} product(s) and ${csv.length} listing(s) written`);
