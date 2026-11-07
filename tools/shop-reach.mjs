// One polite request per shop from this machine: which shops answer, and from which country.
//   node tools/shop-reach.mjs            print the table
//   node tools/shop-reach.mjs --require  exit 1 unless this is an Armenian IP and every shop answers
// Run this before turning the Mac crawler on (tools/mac-refresh.sh).
import fs from 'node:fs';
const prices = JSON.parse(fs.readFileSync('data/prices.json', 'utf8'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36';
const sample = {};
for (const list of Object.values(prices.offers)) for (const o of list) if (/^https:\/\//.test(o.url || '')) sample[o.shop] ||= o.url;
const country = await fetch('https://ipinfo.io/country').then(r => r.text()).then(s => s.trim()).catch(() => '?');
console.log('This machine is seen from: ' + country);
let refused = 0;
for (const [shop, url] of Object.entries(sample).sort()) {
  const status = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000), redirect: 'follow' })
    .then(r => r.status).catch(() => 0);
  // 404 is an answer about one product; the shop itself let us in.
  const ok = status === 200 || status === 404;
  if (!ok) refused++;
  console.log(`${ok ? 'ok     ' : 'REFUSED'} ${String(status).padEnd(4)} ${shop}`);
}
console.log(`${Object.keys(sample).length - refused} of ${Object.keys(sample).length} shops answered`);
if (process.argv.includes('--require') && (country !== 'AM' || refused)) process.exit(1);
