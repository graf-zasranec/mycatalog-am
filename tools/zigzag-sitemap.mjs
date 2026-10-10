// Lists the Zigzag product pages worth reading, from the sitemap their robots.txt publishes.
//
//   node tools/zigzag-sitemap.mjs        -> data/zigzag-sitemap.txt (one url per line)
//
// Zigzag's category pages page with ?p=, which their server refuses, so the category crawl only
// ever saw a dozen products per aisle. The sitemap names all ~23,000 pages. Reading every one would
// take a day; a url whose slug the catalogue's own matcher recognises (and that is not an
// accessory) is a page that can price something here - about 1,400 of them (2026-10-10).
// tools/zigzag-fetch.py reads this file alongside data/zigzag-seed.txt.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const UA = 'BetterBot/1.0 (+https://better.am)';
const src = fs.readFileSync('scrape.mjs', 'utf8');
const body = src.slice(0, src.indexOf('const report = [];')).replace('process.argv.slice(2)', '[]');
const { matchPhone, looksLikeAccessory } = await import('data:text/javascript;base64,' +
  Buffer.from(body + '\nexport { matchPhone, looksLikeAccessory };\n', 'utf8').toString('base64'));

// curl, not fetch(): Cloudflare answers Node's fetch with 403 and curl with the file
let xml = '';
try { xml = execFileSync('curl', ['-sL', '--max-time', '120', '-A', UA, 'https://www.zigzag.am/sitemap/hy_AM/sitemap.xml'], { maxBuffer: 64e6 }).toString(); } catch { }
if (!xml.includes('<urlset')) { console.error('sitemap: not readable - keeping the previous list'); process.exit(0); }
const urls = [...xml.matchAll(/<loc>(https:\/\/www\.zigzag\.am\/am\/[a-z0-9-]+\.html)<\/loc>/g)].map(m => m[1]);
const keep = urls.filter(u => {
  const words = u.split('/').pop().replace(/\.html$/, '').replace(/-/g, ' ');
  return matchPhone(words) && !looksLikeAccessory(words);
});
if (keep.length < 200) { console.error(`sitemap: only ${keep.length} match - keeping the previous list`); process.exit(0); }
fs.writeFileSync('data/zigzag-sitemap.txt', keep.join('\n') + '\n');
console.log(`zigzag sitemap: ${urls.length} pages, ${keep.length} match the catalogue -> data/zigzag-sitemap.txt`);
