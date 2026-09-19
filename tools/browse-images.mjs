// Unpacks the picture files tools/browse-harvest.js downloaded into images/_src, where the
// ordinary photo pipeline picks them up.
//
//   node tools/browse-images.mjs <shop> <file...> [--write]
//
// These come through a browser because they cannot come any other way: eldorado answers this
// project's fetcher with 403 on its pages AND on its image CDN, cached path or original. A person
// looking at the shop in their own browser is not a bypass, so the bytes travel with the url.
//
// Everything after that is the normal road: the 600px floor still applies, so a thumbnail that
// slipped through is written but will be passed over by cutout.py until something larger turns
// up, and the file is only written when it beats what is already on disk.
import fs from 'node:fs';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const write = process.argv.includes('--write');
const [shop, ...files] = args;
if (!shop || !files.length) { console.log('usage: node tools/browse-images.mjs <shop> <file...> [--write]'); process.exit(1); }

const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const offers = JSON.parse(fs.readFileSync('data/prices.json', 'utf8')).offers || {};
const SRC = 'images/_src';
const man = fs.existsSync(`${SRC}/manifest.json`) ? JSON.parse(fs.readFileSync(`${SRC}/manifest.json`, 'utf8')) : {};

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const termOf = name => {
  const t = name.split(/[\s(),\/]+/).filter(w => /[a-z]/i.test(w) && /\d/.test(w) && w.length >= 4)
                .sort((a, b) => b.length - a.length)[0];
  return t || name.split(/\s+/).slice(-2).join(' ');
};
const ext = b => (b[0] === 0x89 && b[1] === 0x50) ? 'png' : (b[0] === 0xFF && b[1] === 0xD8) ? 'jpg' : 'webp';

const packs = {};
for (const f of files) Object.assign(packs, JSON.parse(fs.readFileSync(f, 'utf8')));
console.log(`${Object.keys(packs).length} picture(s) in ${files.length} file(s)`);

const mine = phones.filter(p => (offers[p.id] || []).some(o => o.shop === shop));
let wrote = 0, small = 0, worse = 0, nomatch = 0;
for (const p of mine) {
  const full = `${p.brand} ${p.name}`.replace(/\s+/g, ' ').trim();
  const hit = packs[termOf(full)];
  if (!hit || !hit.b64) { nomatch++; continue; }
  // the term found the product, but the picture has to be of it: the url should carry some of
  // the model's own words, or this is a search that landed on a scented candle
  const u = norm(hit.url || '');
  const words = full.split(/[\s(),\/]+/).filter(w => w.length > 2);
  if (!words.some(w => u.includes(norm(w)))) { nomatch++; continue; }

  const edge = Math.max(hit.w || 0, hit.h || 0);
  const have = (man[p.id] || []).find(e => e.slug === 'main');
  const havePath = have && `${SRC}/${have.src}`;
  const haveEdge = havePath && fs.existsSync(havePath)
    ? (() => { const b = fs.readFileSync(havePath);
               return b[0] === 0x89 ? b.readUInt32BE(16) : 0; })() : 0;
  if (haveEdge && edge <= haveEdge) { worse++; continue; }
  if (edge < 600) small++;

  if (write) {
    const b = Buffer.from(hit.b64, 'base64');
    const name = `${p.id}__main.${ext(b)}`;
    for (const old of fs.readdirSync(SRC).filter(f => f.startsWith(`${p.id}__main.`))) fs.unlinkSync(`${SRC}/${old}`);
    fs.writeFileSync(`${SRC}/${name}`, b);
    man[p.id] = [...(man[p.id] || []).filter(e => e.slug !== 'main'), { color: null, slug: 'main', src: name, shop }];
  }
  wrote++;
}
console.log(`  ${wrote} picture(s) placed${write ? '' : ' (would be)'}, of which ${small} under the 600px floor`);
console.log(`  ${worse} we already hold something larger, ${nomatch} no confident match`);
if (write) { fs.writeFileSync(`${SRC}/manifest.json`, JSON.stringify(man, null, 1)); console.log('written to images/_src'); }
else console.log('\npass --write');
