// Turns what tools/shelf.py read off a shop's product pages into catalogue entries.
//
//   node tools/shelf-add.mjs .shelf-monitors.json monitor        report only
//   node tools/shelf-add.mjs .shelf-monitors.json monitor --write
//
// Every field comes from the shop's own attribute list. Nothing is filled in from elsewhere:
// what the shop does not publish is absent, and the two figures that are ours rather than the
// shop's - the popularity number and the estimated price - say so in `unsure`.
import fs from 'node:fs';

// The crawler's own matcher, so a machine the catalogue already carries under a different
// spelling is recognised rather than added twice.
const scr = fs.readFileSync('scrape.mjs', 'utf8');
const mod = 'data:text/javascript;base64,' + Buffer.from(
  scr.slice(0, scr.indexOf('const report = [];')).replace('process.argv.slice(2)', '[]') +
  '\nexport { matchPhone };\n', 'utf8').toString('base64');
const { matchPhone } = await import(mod);

const [file, category] = process.argv.slice(2);
const write = process.argv.includes('--write');
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const DATA = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));

const num = s => { const m = /(-?[\d.]+)/.exec(String(s ?? '')); return m ? +m[1] : null; };
const clean = s => String(s ?? '').replace(/\\+/g, '').replace(/\s+/g, ' ').trim();
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Brands the catalogue already knows keep their spelling; a new one is taken from the title.
const BRANDS = [...new Set(DATA.map(p => p.brand))];
const brandOf = name => {
  const low = name.toLowerCase();
  const hit = BRANDS.find(b => low.startsWith(b.toLowerCase() + ' '));
  if (hit) return hit;
  const first = name.split(/\s+/)[0].toLowerCase();
  // A maker, or nothing. REDstore drops "MacBook" from its Apple laptop titles, so "Pro 16.2
  // M5 Max" arrived with Pro read as the maker - and keys like "pro 11" and "air 13" then
  // swallowed every iPad Pro, iPad Air and iPhone Air match in the catalogue. A row whose first
  // word is not a maker is left for a person rather than guessed at.
  return { aoc: 'AOC', hp: 'HP', benq: 'BenQ', asus: 'ASUS', lg: 'LG', msi: 'MSI', acer: 'Acer',
           dell: 'Dell', philips: 'Philips', huawei: 'Huawei', gigabyte: 'Gigabyte',
           lenovo: 'Lenovo', samsung: 'Samsung', xiaomi: 'Xiaomi', apple: 'Apple' }[first] || null;
};

const yes = v => /^(yes|true|1)$/i.test(String(v ?? '').trim());
// REDstore writes a processor as "Core I5 - 14450HX" and "Ryzen 5 7520U" - no maker, a capital
// I, a spaced dash. Left alone, each spelling becomes its own entry in the processor filter and
// a list of ninety appears where there should be a dozen. Put the maker back and join the part.
const cpu = s => clean(s)
  .replace(/^Core\s+(Ultra\s+)?([iI])?(\d)\s*-\s*/i, (m, u, i, n) => `Intel Core ${u ? 'Ultra ' : i ? 'i' : ''}${n}-`)
  .replace(/^Core\s+(Ultra\s+\d)\s+/i, 'Intel Core $1 ')
  .replace(/^Core\s+(Ultra\s+\d|\d)\s+(?=[A-Za-z0-9])/i, 'Intel Core $1 ')
  .replace(/^Ultra\s+(\d)\s*/i, 'Intel Core Ultra $1 ')
  .replace(/^(Ryzen|Athlon)/i, 'AMD $1')
  .replace(/^Intel Core i(\d)-\s*/i, 'Intel Core i$1-')
  .replace(/\s*-\s*/g, '-')
  .replace(/^Intel Core-/, 'Intel Core ');
const TIER = {
  laptop:  p => p >= 900000 ? 'flagship' : p >= 500000 ? 'upper-mid' : p >= 250000 ? 'mid' : 'budget',
  monitor: p => p >= 120000 ? 'upper-mid' : p >= 60000 ? 'mid' : 'budget',
};
const MAP = {
  notebooks: r => {
    const a = r.attrs;
    const gpu = clean(a['Graphic card']);
    const ram = num(a['RAM']), stor = num(a['Storage']);
    return {
      display: {
        ...(num(a['Screen diagonal(inch)']) ? { size: num(a['Screen diagonal(inch)']) } : {}),
        ...(a['Screen type'] ? { type: clean(a['Screen type']) } : {}),
        ...(a['Screen resolution'] ? { resolution: clean(a['Screen resolution']) } : {}),
        ...(num(a['Frame frequency(Hz)']) ? { refresh: num(a['Frame frequency(Hz)']) } : {}),
        ...(a['Touch screen'] ? { touch: yes(a['Touch screen']) } : {}),
      },
      ...(a['CPU'] ? { chipset: { name: cpu(a['CPU']) } } : {}),
      // discrete when the card is named as one; every other answer is the chip's own graphics
      ...(gpu ? { graphics: { name: gpu,
            type: /rtx|gtx|geforce|radeon rx|arc a\d/i.test(gpu) ? 'discrete' : 'integrated' } } : {}),
      ...(num(a['Weight(Kg)']) ? { body: { weight: Math.round(num(a['Weight(Kg)']) * 1000) } } : {}),
      ...(a['Operation system'] ? { os: clean(a['Operation system']) } : {}),
      ...(num(a['Year of manufacture']) ? { released: String(num(a['Year of manufacture'])) } : {}),
      _variant: { ram: ram || null, storage: stor || null },
      summaryEn: [num(a['Screen diagonal(inch)']) && `A ${num(a['Screen diagonal(inch)'])}-inch laptop`,
                  a['CPU'] && `with ${cpu(a['CPU'])}`,
                  /rtx|gtx|geforce/i.test(gpu) ? `and ${gpu}` : null].filter(Boolean).join(' ') + '.',
    };
  },
  monitor: r => {
    const a = r.attrs;
    const size = num(a['Screen size']);
    const hz = num(a['Refresh rate(Hz)']) || num(a['Frame frequency(Hz)']);
    return {
      display: {
        ...(size ? { size } : {}),
        ...(a['Panel type'] ? { type: clean(a['Panel type']) } : {}),
        ...(a['Resolution'] ? { resolution: clean(a['Resolution']).replace(/\s*\(.*\)$/, '') } : {}),
        ...(hz ? { refresh: hz } : {}),
        ...(num(a['Brightness(cd/m²)']) ? { brightness: num(a['Brightness(cd/m²)']) } : {}),
      },
      connectivity: { ...(a['Inputs'] ? { ports: clean(a['Inputs']).replace(/\s*,\s*/g, ', ') } : {}) },
      summaryEn: [size && `A ${size}-inch`, clean(a['Panel type']), 'monitor',
                  hz && `at ${hz} Hz`].filter(Boolean).join(' ') + '.',
    };
  },
};

const have = new Set(DATA.map(p => p.id));
const drafts = [], skipped = [], nobrand = [];
for (const r of rows) {
  const name = clean(r.name);
  const brand = brandOf(name);
  if (!brand) { nobrand.push(name); continue; }
  const short = name.toLowerCase().startsWith(brand.toLowerCase() + ' ') ? name.slice(brand.length + 1) : name;
  const id = slug(brand + ' ' + short);
  // the shop's own spelling for something we already carry
  const known = matchPhone(name) || matchPhone(r.url || '');
  if (known) { skipped.push(known); continue; }
  if (have.has(id)) { skipped.push(id); continue; }
  const body = MAP[category](r);
  // the export's word for the aisle is not the catalogue's word for the category
  const cat = { notebooks: 'laptop', monitors: 'monitor' }[category] || category;
  drafts.push({
    id, category: cat, brand, name: short,
    // price bands are per category: 389,000 is a flagship monitor and a mid-range laptop
    tier: TIER[cat] ? TIER[cat](r.price) : 'mid',
    priceAmd: r.price, priceAmdMax: r.price, popularity: 40,
    accent: '#5C6470',
    ...body, _variant: undefined,
    variants: [{ ram: body._variant?.ram ?? null, storage: body._variant?.storage ?? null, priceAmd: r.price }],
    battery: {},
    // the price is the shop's; the popularity number is ours and nothing measured it
    unsure: ['popularity'],
    _url: r.url, _image: r.image, _sku: r.sku,
  });
  have.add(id);
}

console.log(`${drafts.length} new, ${skipped.length} already in the catalogue, ${nobrand.length} with no maker in the title`);
for (const n of nobrand) console.log(`  no maker: ${n}`);
for (const d of drafts)
  console.log(`  ${String(d.priceAmd).padStart(7)}  ${d.id.padEnd(34)} ${d.display?.size ?? '?'}" ${d.display?.type ?? ''} ${d.display?.resolution ?? ''} ${d.display?.refresh ?? ''}`);

if (write) {
  for (const d of drafts) {
    const { _url, _image, _sku, _variant, ...p } = d;
    const at = DATA.findIndex(q => q.popularity < p.popularity);
    DATA.splice(at < 0 ? DATA.length : at, 0, p);
  }
  fs.writeFileSync('data/phones.json', JSON.stringify(DATA, null, 1));
  // the shop's own page and picture, for the rows and the photos that follow
  fs.writeFileSync(file.replace('.json', '-added.json'),
    JSON.stringify(drafts.map(d => ({ id: d.id, url: d._url, image: d._image, price: d.priceAmd })), null, 1));
  console.log(`\nwritten: ${DATA.length} products`);
}
