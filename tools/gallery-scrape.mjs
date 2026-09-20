// Crawl each fetchable shop product page, extract its gallery images, measure them with the
// same decoder photos.mjs uses, and keep the best >=600px per product (either dimension).
import fs from 'node:fs';

const UA = 'ImpulseBot/0.1 (+price comparison; respects robots.txt)';
function dimensions(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2;
    while (i < b.length - 8) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
    return [0, 0];
  }
  const s = b.toString('latin1'), i = s.indexOf('VP8');
  if (i < 0) return [0, 0];
  if (s.slice(i, i + 4) === 'VP8X') return [1 + b.readUIntLE(i + 12, 3), 1 + b.readUIntLE(i + 15, 3)];
  if (s.slice(i, i + 4) === 'VP8L') { const x = b.readUInt32LE(i + 9); return [(x & 0x3fff) + 1, ((x >> 14) & 0x3fff) + 1]; }
  return [b.readUInt16LE(i + 14) & 0x3fff, b.readUInt16LE(i + 16) & 0x3fff];
}
const ext = ct => ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
const BAD = /logo|icon|banner|payment|shablon|favicon|placeholder|no[-\s]?image|sprite|loading/i;
const dedupe = a => [...new Set(a)];

async function fetchBuf(u) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    return r.ok ? { b: Buffer.from(await r.arrayBuffer()), ct: r.headers.get('content-type') || '' } : null;
  } catch { return null; }
}

const target = JSON.parse(fs.readFileSync('C:/Users/hastv/AppData/Local/Temp/opencode/fetchable-ogs.json', 'utf8'))
  .filter(r => r.url).map(r => ({ id: r.id, url: r.url }));

const out = [];
const PAGES = 4;
let ti = 0;
async function worker() {
  for (;;) {
    const t = target[ti++];
    if (!t) return;
    try {
      const r = await fetch(t.url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
      const html = r.ok ? await r.text() : '';
      const imgs = dedupe([...html.matchAll(/(?:src|data-src|data-original|content)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)]
        .map(m => { try { return new URL(m[1], t.url).href; } catch { return null; } }).filter(Boolean))
        .filter(u => !BAD.test(u));
      let win = null;
      for (const u of imgs) {
        const got = await fetchBuf(u);
        if (!got) continue;
        const [w, h] = dimensions(got.b);
        const edge = Math.max(w, h);
        if (edge >= 600 && (!win || edge > win.edge)) win = { url: u, w, h, edge, ext: ext(got.ct) };
        await new Promise(s => setTimeout(s, 200));
      }
      out.push({ id: t.id, page: t.url, imgCount: imgs.length, best: win });
    } catch {}
    if (out.length % 10 === 0) {
      fs.writeFileSync('C:/Users/hastv/AppData/Local/Temp/opencode/gallery-scrape.json', JSON.stringify(out));
      console.log('  ' + out.length);
    }
  }
}
await Promise.all(Array.from({ length: PAGES }, worker));
fs.writeFileSync('C:/Users/hastv/AppData/Local/Temp/opencode/gallery-scrape.json', JSON.stringify(out));
const ok = out.filter(o => o.best);
console.log('products:', out.length, '| with best>=600px:', ok.length);
for (const o of ok) console.log(o.id, o.best.w + 'x' + o.best.h, o.best.url);