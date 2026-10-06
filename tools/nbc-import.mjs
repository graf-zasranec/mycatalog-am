// Notebook Centre prices: read by --fetch, or from the owner's own Web Scraper export
// (sitemap: Videos/Cline/notebookcentre/sitemap.json). Either way the result goes into listings.csv.
//
//   node tools/nbc-import.mjs <export.csv>            what it would do
//   node tools/nbc-import.mjs <export.csv> --write    do it
//   node tools/nbc-import.mjs --fetch --write         read the pages itself (refresh.cmd does this)
//
// --fetch exists because the shop gave the owner permission on 2026-10-03. It stays polite: plain
// requests, one every 1.5 s, product pages only - the price is the product:price:amount meta and
// a page whose JSON-LD availability is not InStock counts as sold out.
//
// Remove only explicit sold-out or deleted pages; an unreadable page retains its rows.
import fs from 'node:fs';

const file = process.argv.slice(2).find(a => !a.startsWith('--'));
const write = process.argv.includes('--write'), fetchIt = process.argv.includes('--fetch');
if (!file && !fetchIt) { console.log('usage: node tools/nbc-import.mjs <export.csv>|--fetch [--write]'); process.exit(1); }

// Web Scraper quotes every field; titles can hold commas.
const parse = l => {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  return [...out, cur];
};
const got = {};
if (fetchIt) {
  const urls = [...new Set(fs.readFileSync('data/listings.csv', 'utf8').split(/\r?\n/).map(l => l.split(','))
    .filter(f => f[0] === 'notebookcentre').map(f => f[4]))];
  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(30000) });
      if (r.status === 404 || r.status === 410) got[u] = 0;
      else if (r.ok) {
        const h = await r.text(), p = +(h.match(/product:price:amount" content="([\d.]+)/) || [])[1];
        if (/"availability":\s*"https?:\/\/schema.org\/(OutOfStock|Discontinued|SoldOut)/.test(h)) got[u] = 0;
        else if (/"availability":\s*"https?:\/\/schema.org\/InStock/.test(h) && p >= 10000) got[u] = Math.round(p);
        else console.warn('Unrecognized price/stock; keeping previous row: ' + u);
      }   // any other failure leaves the row as it was, to be tried next run
    } catch { }
    await new Promise(r => setTimeout(r, 1500));
  }
} else {
const [head, ...lines] = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
const H = parse(head), iu = H.indexOf('web-scraper-start-url'), ip = H.indexOf('price');
if (iu < 0 || ip < 0) { console.log('export needs web-scraper-start-url and price columns, got:', H.join(', ')); process.exit(1); }

for (const l of lines) {
  const f = parse(l), n = +(f[ip] || '').replace(/[^\d]/g, '');
  got[f[iu]] = n >= 10000 ? n : 0;   // under 10,000 AMD is never a real device price
}
}

const P = 'data/listings.csv', raw = fs.readFileSync(P, 'utf8'), nl = raw.includes('\r\n') ? '\r\n' : '\n';
const today = new Date().toISOString().slice(0, 10);
let same = 0, changed = 0, gone = 0, missing = 0;
const out = raw.split(nl).filter(l => {
  const f = l.split(',');
  if (f[0] !== 'notebookcentre') return true;
  if (!(f[4] in got)) { missing++; return true; }
  if (!got[f[4]]) { gone++; return false; }
  return true;
}).map(l => {
  const f = l.split(',');
  if (f[0] !== 'notebookcentre' || !got[f[4]]) return l;
  String(got[f[4]]) === f[5] ? same++ : changed++;
  f[5] = String(got[f[4]]); f[8] = today; return f.join(',');
});
console.log(`same ${same}, changed ${changed}, removed (no price) ${gone}, not in export ${missing}`);
if (write) fs.writeFileSync(P, out.join(nl));
else console.log('dry run - add --write');
