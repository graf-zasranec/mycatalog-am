// Picks the SHARPEST photo available for every product and colour.
//
// Every shop that lists a product also publishes a photo of it, at wildly different sizes:
// Mobile Centre serves 550x550 previews, Pixel serves 800x1067, iSpace varies. Taking the
// first offer's image (what this used to do) meant a product sold by Mobile Centre got a
// 550px source, which the 1200px cutout canvas then upscaled into mush - the Galaxy Buds.
//
// So: download every candidate, measure it, keep the biggest. Re-runnable; it only replaces
// a source when it finds a genuinely larger one.
//
//   node tools/photos.mjs            refresh every product
//   node tools/photos.mjs --dry      report what it would change
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const PLACEHOLDER = fs.existsSync('data/placeholders.json')
  ? JSON.parse(fs.readFileSync('data/placeholders.json', 'utf8')) : {};

const UA = 'MyCatalogBot/0.1 (+price comparison; respects robots.txt)';   // same string scrape.mjs sends
const SRC = 'images/_src';
const MIN_EDGE = 700;                 // below this a photo visibly softens on the product page
const dry = process.argv.includes('--dry');
// Named products only, when any are named. Re-measuring 1,425 products to improve ten of them is
// an hour of somebody else's bandwidth for nothing.
const only = new Set(process.argv.slice(2).filter(a => !a.startsWith('--')));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// enough of a decoder to read width/height out of the header, no dependency needed
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

// storech (pixel.am) serves the same file at several widths behind a numeric prefix; 800_ is
// the largest they publish, and the unprefixed original is SMALLER, so ask for 800_ explicitly.
function upscaleCandidates(url) {
  const out = [url];
  const at = url.lastIndexOf('/');
  // iSpace/iStore sit behind an imgproxy CDN that renders whatever size the path asks for.
  // It defaults to a 900px, 15KB thumbnail; asking for 1600px at q:92 costs one request and
  // gives a photo that survives a 1200px canvas without turning to mush.
  // Magento serves a resized copy under /cache/<hash>/; the untouched original sits at the
  // same path with that segment removed.
  const cache = url.indexOf('/cache/');
  if (cache > 0) {
    const after = url.indexOf('/', cache + 7);
    if (after > 0) out.push(url.slice(0, cache) + url.slice(after));
  }
  // The default path renders a 900px thumbnail. rt:fit with an explicit w/h renders up to the
  // stored original - 2400px on Apple product shots. q: is not a valid option here and made
  // the CDN fall back to the 900px default, which is why this used to change nothing.
  if (url.includes('asbis.io') && url.includes('/rt:fill/')) {
    for (const opt of ['rt:fit/w:2400/h:2400/', 'rt:fit/w:1600/h:1600/'])
      out.push(url.replace('/rt:fill/', '/' + opt));
  }
  if (at > 0 && url.includes('cdn.storech.com')) {
    const dir = url.slice(0, at + 1), file = url.slice(at + 1).replace(/^\d+_/, '');
    for (const p of ['800_', '300_', '']) out.push(dir + p + file);
  }
  return [...new Set(out)];
}

const ext = ct => ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';

// An offer that came from a hand-collected export carries a product url but no picture, so the
// loop below used to skip the product entirely - 478 of them. The page behind that url names its
// own main image in the og:image meta tag, which is what the tag is for, so one fetch turns a
// link we already hold into a photo candidate. Shops that answer a crawler with a block page
// simply yield nothing here; none of this reaches past a refusal.
const ogSeen = new Map();
async function ogImage(url) {
  if (ogSeen.has(url)) return ogSeen.get(url);
  let out = null;
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
    if (r.ok) {
      const h = await r.text();
      const m = h.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
             || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (m) out = new URL(m[1].replace(/&amp;/g, '&'), url).href;
    }
    await new Promise(r => setTimeout(r, 250));
  } catch { /* a shop being down must not stop the pass */ }
  ogSeen.set(url, out);
  return out;
}

// Does the file declare an alpha channel? The header says so without decoding anything, the same
// way dimensions() reads the size. A JPEG never carries one; a PNG names its colour type; WebP
// sets a flag. This reports what the FORMAT declares, not whether any pixel is actually see-
// through - a PNG can carry a fully opaque alpha channel - so it is used only to break a tie,
// never to throw away a bigger photo.
function declaresAlpha(b) {
  if (b[0] === 0xFF && b[1] === 0xD8) return false;                       // JPEG
  if (b[0] === 0x89 && b[1] === 0x50) {
    const type = b[25];                                                   // IHDR colour type
    if (type === 4 || type === 6) return true;                            // grey+A, RGBA
    return type === 3 && b.includes(Buffer.from('tRNS'));                 // palette with transparency
  }
  const s = b.toString('latin1', 0, Math.min(b.length, 64));
  const i = s.indexOf('VP8');
  if (i < 0) return false;
  if (s.slice(i, i + 4) === 'VP8X') return (b[i + 8] & 0x10) !== 0;        // alpha bit in the flags
  if (s.slice(i, i + 4) === 'VP8L') return (b[i + 9 + 4] & 0x10) !== 0;    // alpha_is_used
  return false;                                                           // plain lossy VP8
}

// A source that arrives already cut out skips the matting model entirely - about a minute and a
// half of this machine, per photo - and skips the tearing the model has to be guarded against.
// So a transparent candidate wins a close call: it must still clear the 600px floor and come
// within this much of the biggest candidate, because a photo too small for the canvas is not a
// bargain at any speed.
const ALPHA_TIEBREAK = 0.8;
const FLOOR = 600;                    // the same floor build.mjs reports a photo as too small below

function beats(a, b) {
  // Transparency only ever decides a close call. Either side can win it, so a big opaque photo
  // still beats a tiny transparent one, and the rule cannot quietly shrink the catalogue.
  if (a.alpha !== b.alpha) {
    const [t, o] = a.alpha ? [a, b] : [b, a];
    if (t.edge >= FLOOR && t.edge >= o.edge * ALPHA_TIEBREAK) return a.alpha;
  }
  return a.edge > b.edge;
}

async function best(urls) {
  let win = null;
  for (const u of urls.flatMap(upscaleCandidates)) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
      if (!r.ok) continue;
      const b = Buffer.from(await r.arrayBuffer());
      // A shop with no photo still answers with an image: its own "no image" square. It is a
      // 1200px file, so it wins on size and lands on the product page looking like a photo.
      // Byte-identity alone cannot spot these - four sizes of one Hisense TV share one render
      // quite legitimately - so this refuses only the exact files confirmed by eye.
      if (PLACEHOLDER[createHash('md5').update(b).digest('hex')]) continue;
      const [w, h] = dimensions(b);
      const edge = Math.max(w, h);
      const cand = { b, edge, w, h, alpha: declaresAlpha(b), ext: ext(r.headers.get('content-type') || ''), url: u };
      if (edge && (!win || beats(cand, win))) win = cand;
      await new Promise(r => setTimeout(r, 250));
    } catch { /* a shop being down must not stop the pass */ }
  }
  return win;
}

const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const PR = JSON.parse(fs.readFileSync('data/prices.json', 'utf8'));
// A record of what each saved source measured, so a re-run does not re-download to learn what it
// already knows. It is a cache, not data: images/_src is gitignored, so on a fresh clone there is
// none, and the honest answer to that is to measure again rather than to refuse to run.
const man = fs.existsSync(`${SRC}/manifest.json`)
  ? JSON.parse(fs.readFileSync(`${SRC}/manifest.json`, 'utf8')) : {};
// Manufacturer press shots, collected by tools/press.mjs. Where a shop only publishes a 550px
// preview these are the same product at 1920px with a transparent background, so they simply
// join the candidate list and win on size.
const PRESS = fs.existsSync('data/press.json') ? JSON.parse(fs.readFileSync('data/press.json', 'utf8')) : {};
const NO_FETCH = Object.keys(PR.excluded || {});
// Photos a person looked at and said no to, with the reason: a Space Black MacBook filed as
// Silver, a sponsorship banner with no television in it. Until now only harvest-colors.py read
// this, so the picker downloaded a rejected photo again on the very next run and the reading was
// worth nothing. A reading outranks the biggest-wins rule, the same way a pin in links.csv
// outranks the matcher.
const REJECT = fs.existsSync('data/photo-rejects.json')
  ? JSON.parse(fs.readFileSync('data/photo-rejects.json', 'utf8')) : {};
const rejected = id => new Set(Object.values(REJECT[id] || {}).map(r => r && r.url).filter(Boolean));

let improved = 0, kept = 0, weak = [], refused = 0;
for (const p of P) {
  if (only.size && !only.has(p.id)) continue;
  const no = rejected(p.id);
  const offers = (PR.offers[p.id] || []).filter(o => o.image);
  // Nobody photographed it into the price file, but somebody linked it: read the picture off the
  // product page. Three links is enough to find one - past that the product has no photo anywhere.
  if (!offers.length && !PRESS[p.id]) {
    // prices.json names the shops this project will not fetch, and says of them: no listings, no
    // product pages, no images. A hand-typed price for one of those shops is somebody's own
    // reading and is carried; its url is still a page we do not request. Read the list from
    // there rather than keeping a second copy that can drift out of step with it.
    const links = [...new Set((PR.offers[p.id] || []).map(o => o.url).filter(Boolean))]
      .filter(u => !NO_FETCH.some(host => { try { return new URL(u).hostname.endsWith(host); } catch { return false; } }))
      .slice(0, 3);
    for (const url of links) { const image = await ogImage(url); if (image) { offers.push({ url, image, color: null }); break; } }
  }
  if (!offers.length && !PRESS[p.id]) continue;
  // one job per slot: the main shot, plus one per colour the shops actually photograph
  const slots = [{ slug: 'main', color: null, urls: [...Object.values(PRESS[p.id] || {}), ...offers.map(o => o.image)] }];
  for (const c of p.colors || []) {
    const urls = offers.filter(o => o.color === c).map(o => o.image);
    if (urls.length) slots.push({ slug: slug(c), color: c, urls });
  }
  for (const s of slots) { const press = (PRESS[p.id] || {})[s.slug]; if (press) s.urls = [press, ...s.urls]; }
  for (const s of slots) {
    const have = (man[p.id] || []).find(e => e.slug === s.slug);
    // A hand-picked shot wins on framing, not on pixel count: the shops sell the Smart Band 10
    // with a 550px photo of the wrong thing, which beat a correct 590px crop on size alone and
    // silently undid the fix. pin:true means leave this slot alone.
    if (have && have.pin) { kept++; continue; }
    const havePath = have && `${SRC}/${have.src}`;
    const haveEdge = havePath && fs.existsSync(havePath) ? Math.max(...dimensions(fs.readFileSync(havePath))) : 0;
    const ok = s.urls.filter(u => !no.has(u));
    refused += s.urls.length - ok.length;
    const win = await best(ok);
    if (!win) continue;
    if (win.edge <= haveEdge) { kept++; if (haveEdge < MIN_EDGE) weak.push(`${p.id} ${s.slug} ${haveEdge}px`); continue; }
    console.log(`  ${p.id} ${s.slug}: ${haveEdge || 'none'} -> ${win.w}x${win.h}`);
    if (win.edge < MIN_EDGE) weak.push(`${p.id} ${s.slug} ${win.edge}px`);
    improved++;
    if (dry) continue;
    for (const old of fs.readdirSync(SRC).filter(f => f.startsWith(`${p.id}__${s.slug}.`))) fs.unlinkSync(`${SRC}/${old}`);
    const name = `${p.id}__${s.slug}.${win.ext}`;
    fs.writeFileSync(`${SRC}/${name}`, win.b);
    const list = (man[p.id] || []).filter(e => e.slug !== s.slug);
    list.push({ color: s.color, slug: s.slug, src: name, shop: 'best-of-offers' });
    man[p.id] = list;
  }
}
if (!dry) fs.writeFileSync(`${SRC}/manifest.json`, JSON.stringify(man, null, 1));
// SOURCES.txt used to be written by hand and drifted the moment a photo was replaced. It is a
// copyright record, so it has to match what is actually on disk: regenerate it from the manifest.
if (!dry) {
  // The shop each photo came from stays in manifest.json, which is a working file. SOURCES.txt
  // is served from the site root, and a competitor's name belongs in the price list, nowhere else.
  const rows = Object.entries(man).flatMap(([id, list]) => list.map(e => e.src)).sort();
  fs.writeFileSync('images/SOURCES.txt', [
    'Product photos in images/_src/ were downloaded from the Armenian shops that list the product,',
    'and from the manufacturers own press pages (samsung.com) where a shop only publishes a small',
    'preview. They are manufacturer press renders and remain COPYRIGHTED by the phone makers.',
    '',
    'Status: fine for a prototype or a client pitch. For a public launch, license them, replace them',
    'with your own photography, or ask each shop for permission to mirror theirs.',
    '',
    'Regenerated by tools/photos.mjs - do not edit by hand.',
    '', ...rows, ''
  ].join(String.fromCharCode(10)));
}
console.log(`\n${dry ? 'would improve' : 'improved'} ${improved}, already best ${kept}` +
            (refused ? `, ${refused} candidate(s) refused by data/photo-rejects.json` : ''));
if (weak.length) console.log(`still under ${MIN_EDGE}px (no shop publishes better):\n  ` + weak.join('\n  '));
