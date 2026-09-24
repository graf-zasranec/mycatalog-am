// TV specs from kitele.com (Kimovil's TV sheets), read in the owner's Chrome and saved as
// data/specs/kitele-tv.json: { slug: "inches,width px,panel,Hz,backlight,dots" } - panel O(LED) L(CD) ?,
// backlight M(ini) S(elf-lit) F(ALD) E(dge) D(irect) U(nknown), dots N(ano cell) Q(uantum) T(riluminos) -.
// Fills missing display.resolution / type / refresh; a value we already have and that differs is
// logged, never replaced. A sheet whose diagonal is not our size is the wrong TV and is skipped.
//   node tools/apply-kitele.mjs [--write]
import fs from 'node:fs';

const P = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const { map } = JSON.parse(fs.readFileSync('data/specs/kitele-tv-map.json', 'utf8'));
const rows = JSON.parse(fs.readFileSync('data/specs/kitele-tv.json', 'utf8'));
const write = process.argv.includes('--write');

// our panel vocabulary: LED, QLED, Neo QLED, NanoCell LED, QNED Mini-LED, OLED
function panel(brand, pnl, back, qd) {
  if (pnl === 'O') return 'OLED';
  const mini = back === 'M', dots = qd.includes('Q'), nano = qd.includes('N');
  if (pnl === '?' && !dots && !nano && !mini) return null;
  if (brand === 'LG') return dots ? (mini ? 'QNED Mini-LED' : 'QNED') : nano ? 'NanoCell LED' : 'LED';
  if (brand === 'Samsung' && dots) return mini ? 'Neo QLED' : 'QLED';
  return dots ? (mini ? 'QLED Mini-LED' : 'QLED') : mini ? 'Mini-LED' : 'LED';
}

const log = { filled: [], same: 0, conflict: [], skipped: [] };
for (const p of P) {
  const m = map[p.id], row = m && rows[m.slug];
  if (!row) continue;
  const [inch, w, pnl, hz, back, qd] = row.split(',');
  const res = { 7680: '7680 x 4320', 3840: '3840 x 2160', 1920: '1920 x 1080', 1366: '1366 x 768' }[w];
  const d = p.display ||= {};
  if (d.size && Math.abs(+inch - d.size) > 1) { log.skipped.push(`${p.id}: sheet ${inch}" vs ours ${d.size}"`); continue; }
  const got = {
    resolution: res || null,
    refresh: Math.max(...(hz.match(/\d+/g) || []).map(Number)) || null,
    type: pnl ? panel(p.brand, pnl, back, qd) : null,
  };
  for (const [k, v] of Object.entries(got)) {
    if (v == null || v === -Infinity) continue;
    if (d[k] == null || d[k] === '') {
      d[k] = v; log.filled.push(`${p.id} ${k}=${v}`);
      // a regional twin (US/Spain code) can differ in refresh rate from the set sold here
      if (m.how === 'series' && k === 'refresh' && !(p.unsure ||= []).includes('display.refresh')) p.unsure.push('display.refresh');
    }
    else if (String(d[k]) === String(v)) log.same++;
    // Our type came from shop titles and often stops at "LED"; an exact sheet that is more specific
    // wins (LED -> QLED/OLED/Mini-LED, QLED -> QLED Mini-LED, 4K -> 8K). The other direction -
    // kitele's plain "LED" for a set sold as QNED or QLED - is the marketing class, so ours stays.
    else if (m.how !== 'series' && (k === 'type' && (d[k] === 'LED' || (d[k] === 'QLED' && v === 'QLED Mini-LED'))
      || k === 'resolution' && v === '7680 x 4320')) { log.filled.push(`${p.id} ${k}: ${d[k]} -> ${v}`); d[k] = v; }
    else log.conflict.push(`${p.id} ${k}: ours ${d[k]}, kitele ${v} (${m.how})`);
  }
  if (!(p.sources ||= []).includes('kitele')) p.sources.push('kitele');
}
console.log(`filled ${log.filled.length}, confirmed ${log.same}, conflicts ${log.conflict.length}, skipped ${log.skipped.length}`);
for (const k of ['conflict', 'skipped']) for (const l of log[k]) console.log(k, l);
if (write) fs.writeFileSync('data/phones.json', JSON.stringify(P, null, 2) + '\n');

// self-check of the panel mapping
console.assert(panel('LG', 'O', 'S', '-') === 'OLED');
console.assert(panel('Samsung', 'L', 'M', 'Q') === 'Neo QLED');
console.assert(panel('LG', 'L', 'E', 'NQ') === 'QNED');
console.assert(panel('Hisense', 'L', 'D', '-') === 'LED');
console.assert(panel('Hisense', '?', 'U', '-') === null);
