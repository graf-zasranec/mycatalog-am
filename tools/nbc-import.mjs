// Notebook Centre bars automated readers, so its prices come from the owner's own Web Scraper run
// (sitemap: Videos/Cline/notebookcentre/sitemap.json). This puts that export back into listings.csv.
//
//   node tools/nbc-import.mjs <export.csv>            what it would do
//   node tools/nbc-import.mjs <export.csv> --write    do it
//
// A page with no price is a sold-out or deleted product: its rows are removed.
import fs from 'node:fs';

const [file] = process.argv.slice(2);
const write = process.argv.includes('--write');
if (!file) { console.log('usage: node tools/nbc-import.mjs <export.csv> [--write]'); process.exit(1); }

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
const [head, ...lines] = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
const H = parse(head), iu = H.indexOf('web-scraper-start-url'), ip = H.indexOf('price');
if (iu < 0 || ip < 0) { console.log('export needs web-scraper-start-url and price columns, got:', H.join(', ')); process.exit(1); }

const got = {};
for (const l of lines) {
  const f = parse(l), n = +(f[ip] || '').replace(/[^\d]/g, '');
  got[f[iu]] = n >= 10000 ? n : 0;   // under 10,000 AMD is never a real device price
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
