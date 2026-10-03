// What the nightly run should SAY, beyond the prices it wrote. Three readings, no judgements:
// nothing here decides anything, it only puts on screen the three things that go quietly wrong
// between runs and used to be found on the live site instead.
//
//   node tools/health.mjs
import fs from 'node:fs';

const P = JSON.parse(fs.readFileSync('data/prices.json', 'utf8'));
const D = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const PRODUCTS = Array.isArray(D) ? D : (D.products || D.phones);
const rows = Object.values(P.offers).flat();

// 1. Every "Go to shop" button has to land on the product. A row with no url, or one pointing at
//    a category listing, is a button that wastes the reader's click - there were 51 and 94 of
//    those on 2026-09-20 and both are meant to stay at zero.
// A query string marks a listing - except istyle's ?variant=N&color=N, which opens one colour
// of one product (every istyle offer carries one since 2026-09-25).
const LISTING = /[?](?!variant=\d+&color=\d+)|\/category\/|\/brand\/|electronics(\/|\.html)/;
const noLink = rows.filter(o => !o.url || !/^https?:/.test(o.url));
const listing = rows.filter(o => o.url && LISTING.test(o.url));

// 2. An offer nobody has confirmed. A crawled row is dated by the crawl; a hand row is dated by
//    the seen column in data/listings.csv, written the day somebody opened that shop's own page.
//    Blank means unverified, and the site says so on the row, so this is the size of that debt.
//    Except where the shop prices the CONFIGURATION rather than the page: Ucom shows a build's
//    price only once you pick the memory, the RAM and the colour, so there is no figure on the
//    page to check and never will be. Those rows are checked a different way - that the link
//    opens the product - and counted separately, because lumping them in made the debt look 116
//    rows larger than it is and pointed at work that cannot be done.
const pick = rows.filter(o => !o.seen && o.pickOnSite);
const unseen = rows.filter(o => !o.seen && !o.pickOnSite);
const byShop = {};
for (const o of unseen) byShop[o.shop] = (byShop[o.shop] || 0) + 1;

// A product every shop has stopped selling. Its page is still built and still in sitemap.xml,
// but no list on the site shows it, so this is the only place it is counted.
const dead = PRODUCTS.filter(p => !(P.offers[p.id] || []).length).length;
console.log(`  ${rows.length} offers`);
console.log(`  ${noLink.length} with no link, ${listing.length} pointing at a listing page   (both should be 0)`);
if (pick.length) console.log(`  ${pick.length} priced by configuration - no figure on the page to read; their links are checked instead`);
console.log(`  ${unseen.length} nobody has confirmed` + (unseen.length
  ? ': ' + Object.entries(byShop).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, n]) => `${s} ${n}`).join(', ')
  : ''));
if (dead) console.log(`  ${dead} product(s) nothing sells - hidden from the catalogue, page still served`);
