// Downloads one colour-accurate product photo per (phone, colour) from the shops
// that actually sell that colour, into images/_src/.
//
//   node tools/colors.mjs
//
// Source preference: Vega (serves a clean 500x500 render) then iSpace. Both are shops we
// already read prices from; the photo shown for a colour comes from a shop selling it.
// Run tools/cutout.mjs afterwards to turn these into transparent PNGs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'MyCatalogBot/0.1 (+price comparison; respects robots.txt)';
const OUT = path.join(ROOT, 'images', '_src');
fs.mkdirSync(OUT, { recursive: true });

export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const prices = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prices.json'), 'utf8'));
const phones = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'phones.json'), 'utf8'));

const RANK = { vega: 0, ispace: 1, mobilecentre: 2 };
const picks = new Map();                       // "<phoneId>|<colourSlug>" -> {url, phone, color}

for (const p of phones) {
  for (const o of prices.offers[p.id] || []) {
    if (!o.image) continue;
    // per-colour shot, plus a "main" shot sourced from a shop rather than a spec site
    const keys = [`${p.id}|main`];
    if (o.color) keys.push(`${p.id}|${slug(o.color)}`);
    for (const key of keys) {
      const prev = picks.get(key);
      if (!prev || (RANK[o.shop] ?? 9) < (RANK[prev.shop] ?? 9)) {
        picks.set(key, { url: o.image, shop: o.shop, phone: p.id, color: key.endsWith('|main') ? null : o.color });
      }
    }
  }
}

console.log(`${picks.size} colour photos to fetch`);
let ok = 0, fail = 0;
const manifest = {};

for (const [key, v] of picks) {
  const ext = (v.url.match(/\.(jpg|jpeg|png|webp)(?:$|\?)/i) || [, 'jpg'])[1].toLowerCase();
  const file = `${key.replace('|', '__')}.${ext}`;
  const dest = path.join(OUT, file);
  // Vega only pre-generates some cache sizes per image, so try the big one then fall back
  // biggest first: the cutout trims to the phone's bounding box, so a small source
  // leaves a soft image on the product panel. Vega pre-generates only some sizes.
  const candidates = [...new Set([
    v.url.replace(/-\d+x\d+\.jpg$/, '-1500x1500.jpg'),
    v.url.replace(/-\d+x\d+\.jpg$/, '-800x800.jpg'),
    v.url,
    v.url.replace(/-\d+x\d+\.jpg$/, '-500x500.jpg'),
    v.url.replace(/-\d+x\d+\.jpg$/, '-250x250.jpg')
  ])];
  try {
    let buf = null, lastErr = 'no candidate';
    for (const u of candidates) {
      try {
        const r = await fetch(u, { headers: { 'user-agent': UA, referer: 'https://vega.am/' }, signal: AbortSignal.timeout(25000) });
        if (!r.ok) { lastErr = 'HTTP ' + r.status; continue; }
        const b = Buffer.from(await r.arrayBuffer());
        if (b.length < 2000) { lastErr = 'too small'; continue; }
        buf = b; break;
      } catch (e) { lastErr = e.message; }
    }
    if (!buf) throw new Error(lastErr);
    fs.writeFileSync(dest, buf);
    (manifest[v.phone] ||= []).push({ color: v.color, slug: v.color ? slug(v.color) : 'main', src: file, shop: v.shop });
    ok++;
  } catch (e) {
    fail++;
    console.warn('  ! ' + key + ' -> ' + e.message);
  }
  await new Promise(r => setTimeout(r, 250));
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`downloaded ${ok}, failed ${fail} -> images/_src/`);
console.log(`${Object.keys(manifest).length} phones have at least one colour photo`);
