// Builds data/vlv-index.json: the id -> title map for vlv.am.
//
// Their sitemap lists every product as /Product/<number> with no name in the URL, so there is
// nothing to filter on before fetching. The title is on the page, so the whole catalogue is read
// ONCE into an index and the nightly scrape then re-reads only the products that matched one of
// ours - about a hundred requests instead of thirteen thousand.
//
//   node tools/vlv-index.mjs            refresh the whole index
//   node tools/vlv-index.mjs 500        stop after 500 products (a smoke run)
import fs from 'node:fs';

const UA = 'MyCatalogBot/0.1 (+price comparison; respects robots.txt)';
const OUT = 'data/vlv-index.json';
const DELAY = 300;
const limit = Number(process.argv[2]) || Infinity;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const c = AbortSignal.timeout(25000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: c });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
}

const xml = await get('https://vlv.am/sitemap.xml');
const ids = [...xml.matchAll(/<loc>https:\/\/vlv\.am\/Product\/(\d+)<\/loc>/g)].map(m => m[1]);
console.log(ids.length, 'products in the sitemap');

let index = {};
try { index = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { }

let done = 0, added = 0;
for (const id of ids) {
  if (done >= limit) break;
  if (index[id]) continue;                       // resumable: a stopped run picks up where it left
  const html = await get(`https://vlv.am/en/Product/${id}`);
  await sleep(DELAY);
  done++;
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  // "Buy Apple iPhone 17 256GB Black Smartphones in the VLV online store at the best price"
  const name = title.replace(/^\s*Buy\s+/i, '').replace(/\s+in the VLV[^]*$/i, '').trim();
  if (!name || /page not found/i.test(title)) continue;
  index[id] = name;
  added++;
  if (added % 100 === 0) {
    fs.writeFileSync(OUT, JSON.stringify(index));
    console.log(`${done}/${ids.length} fetched, ${Object.keys(index).length} titles`);
  }
}
fs.writeFileSync(OUT, JSON.stringify(index));
console.log(`done: ${Object.keys(index).length} titles in ${OUT}`);
