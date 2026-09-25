// Official gallery shots from a samsung.com product page, for photos too small or soft to keep.
// The page's HTML names only one gallery thumbnail ("...-thumb-540079828"); the full gallery is
// loaded by script, but its images are numbered just below the thumbnail's number and the image
// server renders any of them at 2052x1641 with transparency. samsung.com's robots.txt does not
// restrict this client. Downloads what answers into images/_cand/<id>__samsung-<n>.png for a
// person to choose from; nothing is placed automatically.
//   node tools/samsung-gallery.mjs <product id> <samsung.com product url>
import fs from 'node:fs';

const [id, page] = process.argv.slice(2);
const UA = 'BetterBot/0.1 (+price comparison; respects robots.txt)';
const html = await (await fetch(page, { headers: { 'user-agent': UA } })).text();
const m = html.match(/images\.samsung\.com\/is\/image\/samsung\/(p6pim\/[a-z]+\/[a-z0-9-]+\/gallery\/[a-z0-9-]+?)-thumb-(\d+)/i);
if (!m) { console.log(id, 'no gallery thumbnail on the page'); process.exit(0); }
const [, base, num] = m;
fs.mkdirSync('images/_cand', { recursive: true });
const got = [];
for (let n = +num - 24; n <= +num + 2; n++) {
  for (const name of [`${base}-${n}`, `${base}-thumb-${n}`]) {
    const r = await fetch(`https://images.samsung.com/is/image/samsung/${name}?$2052_1641_PNG$`, { headers: { 'user-agent': UA } });
    if (r.ok) { const f = `images/_cand/${id}__samsung-${n}${name.includes('-thumb-') ? 't' : ''}.png`; fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); got.push(f); }
    await new Promise(res => setTimeout(res, 250));
  }
}
console.log(id, got.length, 'gallery image(s)');
