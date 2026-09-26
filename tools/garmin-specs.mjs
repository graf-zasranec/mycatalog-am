// Garmin watch specs (screen size, weight) from garmin.com, whose robots.txt allows this client.
// Our shops' links carry Garmin part numbers (010-02969-10); the US store opens the product at the
// same number with the region suffix -00. A product page covers a whole family (42/47/51 mm), each
// with its own "Weight" and "Display Size", so a family is only used when it has one size, or when
// the screen size we already have picks the matching column. Otherwise the watch is left alone.
// Results go to data/specs/shop-watch.json as shop "garmin"; tools/shop-specs.mjs watch applies them.
//   node tools/garmin-specs.mjs
import fs from 'node:fs';

const UA = 'BetterBot/0.1 (+price comparison; respects robots.txt)';
const g = (o, f) => f.split('.').reduce((a, k) => a == null ? a : a[k], o);
const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const O = JSON.parse(fs.readFileSync('data/prices.json', 'utf8')).offers;
const FILE = 'data/specs/shop-watch.json';
const got = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
// Part numbers read off garmin.com's own search (2026-09-26), for watches whose shop links carry none.
const KNOWN = {
  'garmin-forerunner-170': '010-03920', 'garmin-forerunner-170-music': '010-03920', 'garmin-forerunner-70': '010-04307',
  'garmin-instinct-3-50mm-solar': '010-02935', 'garmin-forerunner-965-black-powder': '010-02809', 'garmin-forerunner-570': '010-02970',
};
const inch = s => +((String(s).match(/(\d(?:\.\d+)?)\s*["”″]/) || [])[1] || 0);

for (const p of P.filter(p => p.brand === 'Garmin' && p.category === 'watch' && (g(p, 'display.size') == null || g(p, 'body.weight') == null))) {
  const pns = [...new Set((O[p.id] || []).flatMap(o => `${o.url} ${o.title || ''}`.match(/010-\d{5}-\d{2}/g) || []).map(x => x.slice(0, 9)).concat(KNOWN[p.id] || []))];
  if (!pns.length) { console.log(p.id.padEnd(46), 'no part number in our links'); continue; }
  let blocks = null, url = null;
  for (const base of pns) {
    url = `https://www.garmin.com/en-US/p/pn/${base}-00`;
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    await new Promise(res => setTimeout(res, 1200));
    if (!r.ok) continue;
    // the spec table is inside the page's data script, escaped - so scripts are kept, not stripped
    const t = (await r.text()).replace(/\\[nrt]/g, '\n').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\\"/g, '"').split('\n').map(s => s.trim()).filter(Boolean);
    blocks = [];
    for (let i = 0; i + 1 < t.length; i++) {
      if (t[i] === 'Weight') blocks.push({ w: t[i + 1] });
      if (t[i] === 'Display Size' && blocks.length) blocks[blocks.length - 1].s ??= t[i + 1];
    }
    // the page repeats the first family member's specs; keep each size once
    blocks = [...new Map(blocks.filter(b => b.s).map(b => [inch(b.s) + '|' + b.w, b])).values()];
    if (blocks.length) break;
  }
  if (!blocks || !blocks.length) { console.log(p.id.padEnd(46), 'no spec table found', pns.join(',')); continue; }
  const sizes = new Set(blocks.map(b => inch(b.s)));
  const ours = g(p, 'display.size');
  const pick = sizes.size === 1 ? blocks[0] : ours ? blocks.find(b => Math.abs(inch(b.s) - ours) < 0.06) : null;
  if (!pick) { console.log(p.id.padEnd(46), `family of ${sizes.size} sizes, cannot tell which`); continue; }
  // "30 g (47 g with included band)": the watch as sold, like every other Garmin weight here
  const withBand = (pick.w.match(/(\d+(?:\.\d+)?)\s*g with included band/) || [])[1];
  got[url + '#' + p.id] = { id: p.id, shop: 'garmin', status: 200, spec: { 'Screen Size': pick.s, Weight: withBand ? withBand + ' g' : pick.w } };
  console.log(p.id.padEnd(46), pick.s, '|', pick.w);
}
fs.writeFileSync(FILE, JSON.stringify(got, null, 1));
