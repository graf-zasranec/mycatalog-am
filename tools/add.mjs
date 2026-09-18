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
const { matchPhone, looksLikeAccessory, COLOR_WORDS } = await import('data:text/javascript;base64,' +
  Buffer.from(body + '\nexport { matchPhone, looksLikeAccessory, COLOR_WORDS };\n', 'utf8').toString('base64'));

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
  [/\bSmartphone\b|Սմարթֆոն|Սմարթ ?հեռախոս|смартфон/i, 'phone'],
];
// A shop's own section is a better witness than a word that is not there: a row scraped off
// .../smartphones/... is a phone even when its title only says "Samsung A07".
const SECTIONS = [[/smartphone|\/phones?\//i, 'phone'], [/tablet/i, 'tablet'],
  [/laptop|notebook/i, 'laptop'], [/watch/i, 'watch'], [/headphone|audio/i, 'headphones'],
  [/monitor/i, 'monitor'], [/[/-]tv(-\d+)?\b|\btelevision/i, 'tv'], [/speaker|acoustic/i, 'speaker']];

// A television's size and panel are written into its model number, the way every maker writes
// them. The same reading that built the 97 sets already here, so a set arriving from a different
// shop lands beside them with the same two facts rather than with none.
function tvSpec(model) {
  let m;
  if ((m = model.match(/^OLED(\d{2,3})/i))) return { size: +m[1], type: 'OLED' };
  if ((m = model.match(/^(\d{2,3})QNED/i))) return { size: +m[1], type: 'QNED Mini-LED' };
  if ((m = model.match(/^(\d{2,3})NANO/i))) return { size: +m[1], type: 'NanoCell LED' };
  if ((m = model.match(/^(\d{2,3})(UR|UT|US|UA|NU|QNED)/i))) return { size: +m[1], type: 'LED' };
  if ((m = model.match(/^(?:QE|MRE)(\d{2,3})QN9/i))) return { size: +m[1], type: 'Neo QLED' };
  if ((m = model.match(/^(?:QE|MRE)(\d{2,3})S9/i))) return { size: +m[1], type: 'OLED' };
  if ((m = model.match(/^(?:QE|MRE)(\d{2,3})QN/i))) return { size: +m[1], type: 'Neo QLED' };
  if ((m = model.match(/^(?:QE|MRE)(\d{2,3})Q/i))) return { size: +m[1], type: 'QLED' };
  if ((m = model.match(/^UE(\d{2,3})/i))) return { size: +m[1], type: 'LED' };
  if ((m = model.match(/^(\d{2,3})(C|P|X|V|T|A|U)\d/i)))
    return { size: +m[1], type: /[CX]/i.test(m[2]) ? 'QLED' : 'LED' };
  if ((m = model.match(/\bK[DE]?-?(\d{2,3})/i))) return { size: +m[1], type: 'LED' };
  return null;
}

// Most of these exports are listing pages: no kind-word in the title, no section in the url,
// just "JBL Flip 6 Gray" or "MacBook Air 13 MGN93 M1 2020 Silver". What a thing is, though, is
// written in its family name - that is what a family name is for - and 897 rows were refused for
// want of this table. Every entry here is a real product line, not a guess about one.
const FAMILY = [
  [/\bMacBook\b|\bThinkPad\b|\bIdeaPad\b|\bVivobook\b|\bZenbook\b|\bExpertBook\b|\bOmniBook\b|\bProBook\b|\bEliteBook\b|\bPavilion\b|\bEnvy\b|\bVictus\b|\bOmen\b|\bInspiron\b|\bLatitude\b|\bVostro\b|\bXPS\b|\bAspire\b|\bNitro\b|\bPredator\b|\bSwift\b|\bTravelMate\b|\bMagicBook\b|\bMateBook\b|\bGalaxy Book\b|\bSurface Laptop\b|\bLegion\b|\bLOQ\b|\bYoga\b|\bROG\b|\bTUF\b|\bKatana\b|\bModern\b|\bCyborg\b|\bRedmiBook\b/i, 'laptop'],
  [/\biPad\b|\bGalaxy Tab\b|\bHonor Pad\b|\bMatePad\b|\bRedmi Pad\b|\bMi Pad\b|\bLenovo Tab\b|\bSurface Pro\b/i, 'tablet'],
  [/\biMac\b|\bMac mini\b|\bMac Studio\b|\bMac Pro\b|\bAll[- ]?in[- ]?One\b/i, 'desktop'],
  [/\bStudio Display\b|\bPro Display\b|\bOdyssey\b|\bUltraGear\b|\bUltraFine\b|\bProArt\b|\bZOWIE\b|\bNitro (XV|VG|KG|EI)\b/i, 'monitor'],
  [/\bPlayStation\b|\bPS5\b|\bXbox\b|\bNintendo Switch\b|\bSteam Deck\b|\bROG Ally\b|\bLegion Go\b/i, 'console'],
  [/\bAirPods\b|\bGalaxy Buds\b|\bFreeBuds\b|\bRedmi Buds\b|\bBuds\b|\bWF-\w|\bLiveBuds\b|\bEarbuds\b|\bMomentum True\b/i, 'earbuds'],
  [/\bWH-\w|\bQuietComfort\b|\bBeoplay H\d|\bJBL (Tune|Live|Quantum)\b|\bHD \d{3}\b|\bSolo \d\b|\bStudio Pro\b|\bMomentum \d\b/i, 'headphones'],
  [/\bHomePod\b|\bSoundLink\b|\bBeosound\b|\bPartyBox\b|\bBoombox\b|\bCharge \d\b|\bFlip \d\b|\bClip \d\b|\bXtreme \d\b|\bGo \d\b|\bStanmore\b|\bWoburn\b|\bActon\b|\bEmberton\b|\bUxbridge\b|\bMiddleton\b|\bWillen\b|\bKilburn\b|\bOnyx Studio\b|\bSonos\b|\bYandex ?Station\b/i, 'speaker'],
  [/\bForerunner\b|\bFenix\b|\bVenu\b|\bInstinct\b|\bVivoactive\b|\bCIRQA\b|\bSmart Band\b|\bMi Band\b|\bGalaxy Watch\b|\bApple Watch\b|\bWatch (SE|Ultra|Series)\b|\bWhoop\b|\bFitbit\b/i, 'watch'],
  [/\bKindle\b|\bPaperwhite\b|\bPocketBook\b|\breMarkable\b/i, 'ereader'],
  [/\bAirwrap\b|\bSupersonic\b|\bAirStrait\b|\bAirStarit\b|\bElectric Kettle\b|\bKettle\b|\bBlender\b|\bAir ?Purifier\b|\bVacuum\b|\bRobot Vacuum\b/i, 'appliance'],
  [/\bGeForce\b|\bRadeon RX\b|\bRTX \d{4}\b|\bArc A\d{3}\b/i, 'component'],
  // a phone family is the last thing asked, because "Redmi" and "Galaxy" also name tablets,
  // earbuds and watches, all of which are matched above before this line is reached
  [/\biPhone\b|\bGalaxy (S|A|Z|M|F)\d|\bRedmi (Note )?\d|\bPoco \w\d|\bPixel \d|\bHonor (X|Magic|Play)\d|\bReno\d*\b|\bNord\b|\bXperia\b|\bnova \d/i, 'phone'],
];

// Of the things that go inside a computer, only video cards and processors.
const PC_PART = /\bSSD\b|\bHDD\b|\bNVMe\b|\bDIMM\b|\bDDR[45]\b|motherboard|материнск|блок питания|power supply/i;
const IS_CHIP = /\bRTX\s?\d|\bGTX\s?\d|Radeon RX|GeForce|Ryzen \d|Core i\d|Core Ultra|видеокарт|процессор/i;

const slug = s => s.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// A colour is not a model. "Xiaomi Poco X7 / Green" and "Xiaomi Poco X7 / Silver" are one phone,
// and left alone they became two products; "Redmi 17 /256GB Oak Green" and "Redmi 17 8/256GB Oak
// Green RU (2606FRN72Y)" became two more. The vocabulary is the scraper's own list plus every
// word the catalogue already uses to name a colour, which is the only list that can keep up with
// what the makers invent - Oak, Sage, Glacier, Lemongrass, Moonstone were all in it already.
const HUES = new Set([...COLOR_WORDS,
  ...phones.flatMap(p => (p.colors || []).flatMap(c => String(c).toLowerCase().split(/[^a-z]+/))),
  'sandy', 'oak', 'nightfall', 'phantom', 'mystic', 'stellar'].filter(Boolean));
// A maker sells a phone in a colour named after the range it belongs to - there is a POCO Yellow -
// so the catalogue's own colour list contains the word POCO, and stripping colours turned
// "Xiaomi Poco X7" into "Xiaomi X7". A brand is never a colour, whatever a swatch is called.
for (const b of BRANDS) HUES.delete(b.toLowerCase());
for (const w of ['pro', 'max', 'ultra', 'plus', 'lite', 'air', 'mini', 'note', 'edge', 'fold', 'flip'])
  HUES.delete(w);
// Everything a shop writes after the model that is about this particular box rather than about
// the model: the colour, the configuration, the region it was imported for, and the part number.
function modelOnly(name) {
  return name
    .replace(/\([^)]*\)/g, ' ')                          // (2606FRN72Y), (LAB-LX1)
    .replace(/\b\d{1,3}\s*\/\s*\d{2,4}\s*(GB|TB)?\b/gi, ' ')   // 8/256GB - a configuration
    .replace(/\b\d+\s*(GB|TB|ԳԲ|ՏԲ)\b/gi, ' ')             // 256GB
    .replace(/(^|\s)\/(\s|$)/g, ' ')                      // the bare slash left behind
    .replace(/\b(RU|EU|CN|INT|Global|Dual|NFC)\b/gi, ' ')   // which market it was imported for
    .split(/\s+/).filter(w => w && !HUES.has(w.toLowerCase().replace(/[^a-z]/g, '')))
    .join(' ').replace(/\s{2,}/g, ' ').replace(/^[\s|,\/-]+|[\s|,\/-]+$/g, '');
}
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
  // "Apple Backpack TOMTOC Navigator T68 Backpack Black for MacBook Pro 14" came through the
  // family table as a laptop, which is exactly the trap a family table sets.
  if (/\bbackpack\b|\bbag\b|\bbriefcase\b|\bpouch\b|\bearphones?\b|\bmotherboard\b|\bSoC\b|\bLGA ?\d/i.test(r.name))
    { refused.push(['accessory', r]); continue; }
  // This catalogue carries new stock only. "iPhone 16 Pro 2SIM USED" says so on the shelf.
  if (/\bused\b|\bsecond[- ]?hand\b|\brefurb\w*\b|\bopen ?box\b|б\/у|օգտագործված/i.test(r.name))
    { refused.push(['second-hand', r]); continue; }
  // A screen protector that never says "tempered": 'glass' alone cannot be banned outright,
  // because the iPad Pro is sold with standard and nano-texture glass.
  if (/\b(uv|unipro|hydrogel|privacy)\b[^,]{0,14}\bglass\b|\bglass\b[^,]{0,10}\bprotect/i.test(r.name))
    { refused.push(['accessory', r]); continue; }

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
    || (SECTIONS.find(([re]) => re.test(r.url || '')) || [])[1]
    || (FAMILY.find(([re]) => re.test(title)) || [])[1]
    // last, and only when nothing the row itself says has answered: the aisle it was read from
    || (SECTIONS.find(([re]) => re.test(r.from || '')) || [])[1];
  if (!kind) { refused.push(['no category', r]); continue; }

  // the model is what is left once the brand and the kind-word are taken out of the shop's title
  // Strip the word that says what KIND of thing this is - but not a word that is part of the
  // thing's NAME. "Airwrap", "Supersonic" and "AirStrait" are Dyson's model lines, and taking
  // them out of the middle left "Dyson Nural er" and "Dyson multi- Wave+Curl diffuser".
  const FAMILY_WORD = /Airwrap|Supersonic|AirStrait|AirStarit|Buds|AirPods|Watch|Tablet|Speaker/i;
  let name = title;
  for (const [re] of KINDS) {
    const keep = [...(title.match(new RegExp(re.source, 'gi')) || [])].some(w => FAMILY_WORD.test(w));
    if (!keep) name = name.replace(new RegExp(re.source, 'gi'), ' ');
  }
  // ...and a trademark sign is punctuation the maker owns, not part of what it is called
  name = name.replace(/[™®©]/g, ' ');
  name = name.replace(reBrand(brand, 'ig'), ' ')
             .replace(/\(\s*\)/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s|,-]+|[\s|,-]+$/g, '');
  // A model name is written in Latin letters by every maker on these shelves. What is left in
  // Armenian or Russian after the kind-word has gone is the shop's own prose - a colour, mostly -
  // and "Xiaomi REDMI մանուշակագույն" is not a product name.
  name = modelOnly(name).split(/\s+/).filter(w => !/[\u0530-\u058F\u0400-\u04FF]/.test(w)).join(' ');
  if (name.length < 2 || !/[a-z0-9]/i.test(name)) { refused.push(['no model', r]); continue; }
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
             // Some exports label the RAM column "memory", so "6/128GB" arrives with storage 6.
             // Nothing here is sold with six gigabytes of storage: of the readings available,
             // the largest real one is the capacity and the rest are memory.
             storage: [cap(r.storage), cap(r.name)].filter(v => v >= 8).sort((a, b) => b - a)[0] ?? null, price: r.price, shop: r.shop,
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
  // These are open questions for a person, not a derived value, so this file MERGES. It used to be
  // rewritten from scratch on every run - including a run without --write - which silently threw
  // away every question nobody had answered yet. A run may add a question; only a person removes one.
  const HAND = 'data/check-by-hand.csv', HEAD = 'id,samePriceAs,price,shopTitle,url';
  const rows = new Map();
  if (fs.existsSync(HAND))
    for (const line of fs.readFileSync(HAND, 'utf8').split(/\r?\n/).slice(1)) {
      const c = line.split(',');
      if (line.trim()) rows.set(c[0] + '|' + c[c.length - 1], line);
    }
  for (const s of suspect)
    rows.set(s.id + '|' + s.url, [s.id, s.twin, s.price, s.title.replace(/,/g, ' '), s.url].join(','));
  fs.writeFileSync(HAND, [HEAD, ...rows.values()].join('\n') + '\n');
  console.log(`   -> ${HAND} (${rows.size} open, ${suspect.length} from this run)`);
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
    display: o.category === 'tv' && tvSpec(o.name)
      ? { size: tvSpec(o.name).size, type: tvSpec(o.name).type, resolution: '3840 x 2160' } : {},
    battery: {},
    summaryEn: `${o.brand} ${o.name}.`,
    // Nothing on the listing states a screen, a chip or a battery, so nothing here claims one.
    unsure: o.category === 'tv' && tvSpec(o.name)
      ? ['popularity', 'display.resolution', 'chipset']
      : ['popularity', 'display', 'chipset', 'battery.capacity'],
  });
  for (const x of list)
    csv.push([x.shop, x.title.replace(/,/g, ' '), x.storage || '', '', x.url, x.price].join(','));
}
fs.writeFileSync('data/phones.json', JSON.stringify([...phones, ...added], null, 1));
const old = fs.readFileSync('data/listings.csv', 'utf8').replace(/\n+$/, '');
fs.writeFileSync('data/listings.csv', old + '\n' + csv.join('\n') + '\n');
console.log(`\n${added.length} product(s) and ${csv.length} listing(s) written`);
