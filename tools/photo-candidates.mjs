// Replacement photos for the cutouts photo-audit.py flagged: every shop image our offers already
// name for that product, downloaded and measured, so a person can pick one on a sheet.
// Resumable: what is downloaded stays in images/_cand/ and is not fetched again.
//   node tools/photo-candidates.mjs <photo-audit report.json> [ids...]
// Eldorado and Zigzag answer 403 to plain fetch; their images come from tools/*-fetch.py's route.
import fs from 'node:fs';
import path from 'node:path';

const UA = 'BetterBot/0.1 (+price comparison; respects robots.txt)';
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const only = process.argv.slice(3);
const O = JSON.parse(fs.readFileSync('data/prices.json', 'utf8')).offers;
const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const OUT = 'images/_cand';
fs.mkdirSync(OUT, { recursive: true });
const BLOCKED = new Set(['eldorado', 'zigzag']);

// the products to re-shoot: flagged main photos, plus both sides of a shared photo between
// products whose names share no model code (a Harman Onyx Studio 7 showing a Studio 8)
const ids = new Set(only);
if (!only.length) {
  for (const [f, why] of Object.entries(report.issues || {}))
    if (f.endsWith('__main.webp') && why.some(w => /too small|soft|blurry|fragment|halo/.test(w))) ids.add(f.split('__')[0]);
  const byId = Object.fromEntries(P.map(p => [p.id, p]));
  const codes = f => { const id = f.split('__')[0], p = byId[id] || { name: id };
    return new Set(`${p.name} ${id}`.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 4 && /\d/.test(t) && /[a-z]/.test(t)).map(t => t.replace(/(\d)[a-z]{1,2}$/, '$1'))); };
  for (const [a, b] of report.samePhoto || []) {
    const A = [...codes(a)], B = [...codes(b)];
    if (!A.some(x => B.some(y => x === y || x.startsWith(y) || y.startsWith(x)))) { ids.add(a.split('__')[0]); ids.add(b.split('__')[0]); }
  }
}

// image size from the header bytes: PNG, JPEG, WebP
function size(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf.toString('ascii', 8, 12) === 'WEBP') {
    const t = buf.toString('ascii', 12, 16);
    if (t === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
    if (t === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
    if (t === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i < buf.length - 9;) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  return [0, 0];
}

const ledgerFile = path.join(OUT, 'ledger.json');
const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : {};
for (const id of ids) {
  const imgs = [...new Map((O[id] || []).filter(o => o.image && /^https:/.test(o.image) && !BLOCKED.has(o.shop)).map(o => [o.image, o.shop])).entries()];
  for (const [url, shop] of imgs) {
    if (ledger[url]) continue;
    const ext = (url.split('?')[0].match(/\.(png|jpe?g|webp)$/i) || [, 'jpg'])[1].toLowerCase();
    const file = path.join(OUT, `${id}__${shop}-${Object.keys(ledger).filter(u => ledger[u].id === id).length}.${ext}`);
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA } });
      const buf = Buffer.from(await r.arrayBuffer());
      const [w, h] = r.ok ? size(buf) : [0, 0];
      if (r.ok && w) fs.writeFileSync(file, buf);
      ledger[url] = { id, shop, status: r.status, w, h, file: r.ok && w ? file : null };
    } catch (e) { ledger[url] = { id, shop, status: 0, err: String(e).slice(0, 60) }; }
    fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1));
    await new Promise(r => setTimeout(r, 500));
  }
}
const best = {};
for (const e of Object.values(ledger)) if (e.file && ids.has(e.id) && Math.min(e.w, e.h) > Math.min(best[e.id]?.w ?? 0, best[e.id]?.h ?? 0)) best[e.id] = e;
const ok = Object.values(best).filter(e => Math.min(e.w, e.h) >= 600);
console.log(`${ids.size} products to re-shoot; ${Object.keys(best).length} have a shop image, ${ok.length} of them 600px or more`);
fs.writeFileSync(path.join(OUT, 'best.json'), JSON.stringify(best, null, 1));
