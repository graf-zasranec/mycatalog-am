// istyle names colours its own way ("Deep Blue" on a Galaxy A57 we call "Awesome Navy"), so the
// colour a reader picks on our page missed that offer. istyle's page gives each colour's exact
// shade as a hex code; this reads those codes and PROPOSES, per product, the nearest of OUR
// colours by the same swatch() the site draws its dots with. Only proposes: on 2026-09-25 half
// of its picks were wrong (a band colour read as the case, JBL Pink as White), because our
// swatches are guessed from names. A person copies the right ones into data/color-aliases.json,
// which scrape.mjs applies to every shop's offers.
//   node tools/color-aliases.mjs
import fs from 'node:fs';

const UA = 'BetterBot/0.1 (+price comparison; respects robots.txt)';
const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const O = JSON.parse(fs.readFileSync('data/prices.json', 'utf8')).offers;

// the site's own swatch(), lifted from _app.js so the two cannot disagree
const app = fs.readFileSync('_app.js', 'utf8');
const from = app.indexOf('const SWATCH = {');
const end = /\r?\n\}\r?\n/g;              // the swatch() body closes on a line of its own; _app.js is CRLF
end.lastIndex = app.indexOf('function swatch(name)');
end.exec(app);
const to = end.lastIndex;
const swatch = new Function(app.slice(from, to) + '\nreturn swatch;')();

const rgb = h => { const m = String(h).replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m && m.slice(1).map(x => parseInt(x, 16)); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// istyle colour name -> hex, read off the page's variant payload
async function istyleHexes(url) {
  const h = (await (await fetch(url.split('?')[0], { headers: { 'user-agent': UA } })).text()).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const out = {};
  for (const m of h.matchAll(/"value":\{"en":"(#[0-9A-Fa-f]{6})"[^}]*\},"color_label":\{"en":"([^"]+)"/g)) out[m[2].trim()] = m[1];
  return out;
}

const proposals = [];
const pages = new Map();
for (const p of P) {
  const cols = p.colors || [];
  if (!cols.length) continue;
  const low = cols.map(c => c.toLowerCase());
  for (const o of (O[p.id] || []).filter(o => o.shop === 'istyle' && o.color && !low.includes(o.color.toLowerCase()))) {
    const page = o.url.split('?')[0];
    if (!pages.has(page)) { pages.set(page, await istyleHexes(page)); await new Promise(r => setTimeout(r, 500)); }
    const hex = pages.get(page)[o.color];
    if (!hex) { proposals.push([p.id, o.color, null, 'no shade on the page']); continue; }
    const ranked = cols.map(c => [c, dist(rgb(hex), rgb(swatch(c)))]).sort((a, b) => a[1] - b[1]);
    // a clear winner only: the nearest must be close, and clearly nearer than the runner-up
    const [best, second] = ranked;
    const sure = best[1] < 110 && (!second || second[1] - best[1] > 25);
    proposals.push([p.id, o.color, sure ? best[0] : null, `${hex} -> ${ranked.map(([c, d]) => `${c} ${d.toFixed(0)}`).join(', ')}`]);
  }
}
const seen = new Set();
for (const [id, theirs, ours, why] of proposals) {
  const k = id + '|' + theirs;
  if (seen.has(k)) continue; seen.add(k);
  console.log(`${ours ? 'MAP ' : 'SKIP'} ${id.padEnd(40)} ${theirs.padEnd(18)} -> ${String(ours || '-').padEnd(18)} ${why}`);
}
