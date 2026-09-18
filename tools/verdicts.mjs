// Writes the Armenian and Russian one-liner for any product that has none.
//
//   node tools/verdicts.mjs            which products are missing one
//   node tools/verdicts.mjs --write    write them
//
// A product with no summary falls back to summaryEn, and the Armenian and Russian pages then
// show an English sentence. Nothing here says more than the catalogue already knows: what kind
// of thing it is, and the capacities it is sold in. A specification nobody read is not written.
import fs from 'node:fs';

const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const V = JSON.parse(fs.readFileSync('data/verdicts.json', 'utf8')).filter(Boolean);
const has = new Set(V.map(v => v.id));
const missing = phones.filter(p => !has.has(p.id));

// kind -> [Armenian noun, Russian noun]
const KIND = {
  phone: ['Սմարթֆոն', 'Смартфон'],
  laptop: ['Նոութբուք', 'Ноутбук'],
  tablet: ['Պլանշետ', 'Планшет'],
  desktop: ['Համակարգիչ', 'Компьютер'],
  monitor: ['Մոնիտոր', 'Монитор'],
  tv: ['Հեռուստացույց', 'Телевизор'],
  speaker: ['Բարձրախոս', 'Колонка'],
  headphones: ['Ականջակալ', 'Наушники'],
  earbuds: ['Անլար ականջակալ', 'Беспроводные наушники'],
  watch: ['Խելացի ժամացույց', 'Смарт-часы'],
  ereader: ['Էլեկտրոնային ընթերցիչ', 'Электронная книга'],
  console: ['Խաղային կոնսոլ', 'Игровая консоль'],
  appliance: ['Կենցաղային տեխնիկա', 'Бытовая техника'],
  component: ['Համակարգչային մաս', 'Комплектующее'],
  drone: ['Նկարահանման տեխնիկա', 'Техника для съёмки'],
};
// A capacity is a fact off the shop's own page, so it may be said. 1024 GB is a terabyte and
// every shop in the country writes it that way.
const size = n => n >= 1024 && n % 1024 === 0 ? [n / 1024 + ' ՏԲ', n / 1024 + ' ТБ'] : [n + ' ԳԲ', n + ' ГБ'];

const made = [];
for (const p of missing) {
  const k = KIND[p.category];
  if (!k) { console.warn(`  ! no wording for category ${p.category} (${p.id})`); continue; }
  const caps = [...new Set((p.variants || []).map(v => v.storage).filter(Boolean))].sort((a, b) => a - b);
  const full = p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? p.name : p.brand + ' ' + p.name;
  const tail = caps.length && !p.variantUnit
    ? [`՝ ${caps.map(c => size(c)[0]).join(' / ')} հիշողությամբ`, `, память ${caps.map(c => size(c)[1]).join(' / ')}`]
    : ['', ''];
  made.push({ id: p.id, s_hy: `${k[0]} ${full}${tail[0]}։`, s_ru: `${k[1]} ${full}${tail[1]}.` });
}

console.log(`${missing.length} product(s) with no summary; ${made.length} can be written`);
for (const m of made.slice(0, 8)) console.log(`  ${m.id.padEnd(34)} ${m.s_hy}`);
if (made.length > 8) console.log(`  ... and ${made.length - 8} more`);

if (process.argv.includes('--write')) {
  fs.writeFileSync('data/verdicts.json', JSON.stringify([...V, ...made], null, 1));
  console.log(`\n${made.length} summary(ies) written`);
} else if (made.length) {
  console.log('\npass --write to write them');
}
