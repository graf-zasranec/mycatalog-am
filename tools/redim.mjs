import fs from 'node:fs';

const rows = JSON.parse(fs.readFileSync('C:/Users/hastv/AppData/Local/Temp/opencode/fetchable-ogs.json', 'utf8'));
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
const UA = 'ImpulseBot/0.1 (+price comparison; respects robots.txt)';
const out = [];
for (const r of rows) {
  const row = { ...r, w2: 0, h2: 0 };
  if (r.url) {
    try {
      const res = await fetch(r.url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
      if (res.ok) {
        const b = Buffer.from(await res.arrayBuffer());
        [row.w2, row.h2] = dimensions(b);
      }
    } catch {}
    await new Promise(s => setTimeout(s, 250));
  }
  out.push(row);
}
fs.writeFileSync('C:/Users/hastv/AppData/Local/Temp/opencode/fetchable-ogs.json', JSON.stringify(out));
const ok = out.filter(r => Math.max(r.w2, r.h2) >= 600);
console.log('redimensioned; >=600px now:', ok.length);
for (const r of ok) console.log(r.id, r.w2 + 'x' + r.h2, r.url);