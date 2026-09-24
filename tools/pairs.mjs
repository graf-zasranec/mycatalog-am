// "Compare with" cards for every product page: up to two models from the same maker, then one
// rival from another maker. build.mjs calls pairs() on every build - the nightly one too - so a
// product added by a crawl is paired the same night. `node tools/pairs.mjs` prints a summary and
// runs the self-check.
//
// 1. Curated lines (LINES) - lines whose generations are clear: newer model first, then the
//    previous one; the newest model gets its previous one plus its stronger sibling instead.
// 2. TVs and monitors (the owner's rule): the same series in another size; where a series has
//    only one size, the same size one price step up and one down.
// 3. Everything else: the same maker, one price step up and one down, same family name first.
// 4. The rival: another maker, same category (same screen size for TVs and monitors), the
//    closest price within 20%.
// A roles is a key of CW_ROLE in _app.js.

const A = 'apple-', S = 'samsung-';
export const LINES = {
  'iPhone': [['e', 'base', 'plus', 'pro', 'promax'], [
    { base: [A + 'iphone-15'], pro: [A + 'iphone-15-pro'] },
    { e: [A + 'iphone-16e'], base: [A + 'iphone-16'], plus: [A + 'iphone-16-plus'], pro: [A + 'iphone-16-pro'], promax: [A + 'iphone-16-pro-max'] },
    // the Air took the Plus's place in the 2025 line-up
    { e: [A + 'iphone-17e'], base: [A + 'iphone-17'], plus: [A + 'iphone-air'], pro: [A + 'iphone-17-pro'], promax: [A + 'iphone-17-pro-max'] },
    { pro: [A + 'iphone-18-pro'], promax: [A + 'iphone-18-pro-max'] }]],
  'Galaxy S': [['fe', 'base', 'plus', 'ultra'], [
    // the Edge sits with the + : same chip, same price band, not a step up from it
    { fe: [S + 'galaxy-s25-fe'], base: [S + 'galaxy-s25'], plus: [S + 'galaxy-s25-plus', S + 'galaxy-s25-edge'], ultra: [S + 'galaxy-s25-ultra'] },
    { fe: [S + 'galaxy-s26-fe'], base: [S + 'galaxy-s26'], plus: [S + 'galaxy-s26-plus'], ultra: [S + 'galaxy-s26-ultra'] }]],
  'Galaxy A': [['a0', 'a1', 'a2', 'a3', 'a5'], [
    { a3: [S + 'galaxy-a34'] },
    { a1: [S + 'a15'], a2: [S + 'a25'], a3: [S + 'galaxy-a35'], a5: [S + 'galaxy-a55'] },
    { a0: [S + 'galaxy-a06'], a1: [S + 'galaxy-a16'], a2: [S + 'galaxy-a26'], a3: [S + 'galaxy-a36'], a5: [S + 'galaxy-a56'] },
    { a0: [S + 'galaxy-a07', S + 'galaxy-a07s'], a1: [S + 'galaxy-a17'], a2: [S + 'galaxy-a27'], a3: [S + 'galaxy-a37'], a5: [S + 'galaxy-a57'] },
    { a0: [S + 'galaxy-a08'] }]],
  'Z Fold': [['fold', 'ultra'], [{ fold: [S + 'galaxy-z-fold-7'] }, { fold: [S + 'galaxy-z-fold-8'], ultra: [S + 'galaxy-z-fold-8-ultra'] }]],
  'Z Flip': [['fe', 'flip'], [{ fe: [S + 'galaxy-z-flip-7-fe'], flip: [S + 'galaxy-z-flip-7'] }, { flip: [S + 'galaxy-z-flip-8'] }]],
  'Apple Watch': [['se', 'series', 'ultra'], [
    { series: [A + 'watch-series-10', A + 'watch-s10-42mm-with-sport-band'], ultra: [A + 'ultra-2'] },
    { se: [A + 'watch-se-3'], series: [A + 'watch-series-11'], ultra: [A + 'watch-ultra-3'] },
    { series: [A + 'watch-series-12-gps-42mm'], ultra: [A + 'watch-ultra-4-gps-plus-cellular-plus-band'] }]],
  // SM-L705F is the 2024 Ultra, which shops also list as "Watch 7 Ultra", "Ultra 2024" and "Ultra
  // LTE"; "Ultra 2025" is its refresh; one shop names "Ultra 2" as the 2026 model.
  'Galaxy Watch': [['fit', 'fe', 'base', 'classic', 'ultra'], [
    { base: [S + 'galaxy-active-2'] },
    { base: [S + 'galaxy-watch-3-41mm'] }, { base: [S + 'galaxy-watch4-40-mm'] }, { classic: [S + 'galaxy-6-classic-43mm-r950'] },
    { fit: [S + 'galaxy-watch-fit-3'], fe: [S + 'galaxy-fe'], base: [S + 'galaxy-watch-7'],
      ultra: [S + 'galaxy-7-ultra-47mm-sm-l705f', S + 'galaxy-ultra-47mm-2024', S + 'galaxy-watch-ultra-47mm-lte'] },
    { base: [S + 'galaxy-watch-8'], classic: [S + 'galaxy-watch-8-classic'], ultra: [S + 'galaxy-ultra-47mm-2025'] },
    { base: [S + 'galaxy-9-44mm'], ultra: [S + 'galaxy-watch-ultra-2'] }]],
  'AirPods': [['base', 'anc', 'pro'], [
    { base: [A + 'tws-bluetooth-headsets-3rd-generation'] },
    { base: [A + 'airpods-4'], anc: [A + 'airpods-4-anc'], pro: [A + 'airpods-pro-2'] },
    { base: [A + 'airpods-5'], pro: [A + 'airpods-pro-3'] }]],
  'EarPods': [['wired'], [{ wired: [A + 'earpods-lightning'] }, { wired: [A + 'earpods-usb-c'] }]],
  'Galaxy Buds': [['core', 'fe', 'base', 'pro'], [
    { base: [S + 'galaxy-buds-live'], pro: [S + 'galaxy-buds-pro-r190'] },
    { fe: [S + 'galaxy-buds-fe'], base: [S + 'galaxy-2'], pro: [S + 'galaxy-2-pro'] },
    { core: [S + 'galaxy-buds-core'], fe: [S + 'galaxy-3-fe'], base: [S + 'galaxy-3'], pro: [S + 'galaxy-buds-3-pro'] },
    { base: [S + 'galaxy-buds-4'], pro: [S + 'galaxy-buds-4-pro'] }]],
  'HomePod': [['mini', 'full'], [{ mini: [A + 'homepod-mini', A + 'homepod-mini-mj2e3ll-a'], full: [A + 'homepod-2'] }]],
  'Mac desktop': [['mini', 'imac'], [{ mini: [A + 'mac-mini-m4'], imac: [A + 'imac-24-m4'] }]],
  'Galaxy Book': [['book'], [{ book: [S + 'galaxy-book-4-np750xgk-ks2us'] }, { book: [S + 'galaxy-book-6-np760xjg'] }]],
  // 2023 part numbers: MRX33/MRX43 are the 14" M3 Pro, MRW23/MRW63 the 16" M3 Max
  'MacBook Pro': [['base', 'pro', 'max'], [
    { base: [A + 'macbook-pro-14-2023-mtl73', A + 'macbook-pro-14-mr7j3-2023'],
      pro: [A + 'macbook-pro-14-mrx33-2023', A + 'macbook-pro-14-mrx43-2023'],
      max: [A + 'macbook-pro-16-mrw23', A + 'macbook-pro-16-mrw63-2023'] },
    { base: [A + 'macbook-pro-14-m4'], pro: [A + 'macbook-pro-14-m4-pro'], max: [A + 'macbook-pro-14-m4-max'] },
    { base: [A + 'macbook-pro-14-m5'], pro: [A + 'macbook-pro-14-m5-pro'], max: [A + 'macbook-pro-14-m5-max'] }]],
  'MacBook Air': [['neo', 'air'], [
    { air: [A + 'macbook-air-13-m1-2024', A + 'macbook-air-13-mgn63-m1-2020', A + 'macbook-air-13-mgn93-m1-2020',
      A + 'macbook-air-13-mgnd3-m1-2020', A + 'macbook-air-mgn63-late-2020', A + 'macbook-air-mgn93-late-2020'] },
    { air: [A + 'macbook-air-13-m4'] },
    { neo: [A + 'macbook-neo-13'], air: [A + 'macbook-air-13-m5'] }]],
  'iPad': [['base'], [
    { base: [A + 'ipad-9'] }, { base: [A + 'ipad-10-9-wi-fi-a14-mpqa3rk-a'] },
    { base: [A + 'ipad-a16', A + 'ipad-10-a16-wi-fi-2025', A + 'ipad-11', A + 'ipad-wi-fi-11'] }]],
  'iPad mini': [['mini'], [{ mini: [A + 'ipad-mini-6'] }, { mini: [A + 'ipad-mini-7', A + 'ipad-mini-7-wifi'] }]],
  'iPad Air': [['a11', 'a13'], [
    { a11: [A + 'ipad-air-5-wi-fi-plus-cellular-2022'] },
    { a11: [A + 'ipad-air-11-wi-fi-2024', A + 'ipad-air-11-wi-fi-plus-cellular-2024'], a13: [A + 'ipad-air-13-wi-fi-2024', A + 'ipad-air-13-wi-fi-plus-cellular-2024'] },
    { a11: [A + 'ipad-air-11-m3'], a13: [A + 'ipad-air-13-m3'] },
    { a11: [A + 'ipad-air-11-m4'], a13: [A + 'ipad-air-13-m4'] }]],
  'iPad Pro': [['p11', 'p13'], [
    { p11: [A + 'ipad-11-pro-wi-fi-m2-mnxg3rk-a'], p13: [A + 'ipad-pro-12-9-m2-wifi-s-grey-mnxp3rk-a', A + 'ipad-pro-12-9-m2-wifi-silver-mnxq3rk-a', A + 'ipad-pro-12-9-m2-cell-spacegray-mp5x3'] },
    { p11: [A + 'ipad-pro-11-m4'], p13: [A + 'ipad-pro-13-m4', A + 'ipad-pro-13-m4-wi-fi-plus-cellular-2024', A + 'ipad-pro-13-wi-fi-plus-cellular-2024', A + 'ipad-pro-13-wi-fi-2024'] },
    { p11: [A + 'ipad-pro-11-m5'], p13: [A + 'ipad-pro-13-m5'] }]],
  'Galaxy Tab S': [['fe', 'base', 'plus', 'ultra'], [
    { base: [S + 'galaxy-tab-s8'], plus: [S + 'galaxy-tab-s8-plus'] },
    { fe: [S + 'galaxy-tab-s9-fe-x510', S + 'galaxy-tab-s9-fe-x516'], base: [S + 'galaxy-tab-s9'], plus: [S + 'galaxy-tab-s9-plus'], ultra: [S + 'galaxy-tab-s9-ultra'] },
    { fe: [S + 'galaxy-tab-s10-fe'], ultra: [S + 'galaxy-tab-s10-ultra'] },
    { ultra: [S + 'galaxy-tab-s11-ultra'] }]],
  'Galaxy Tab A': [['a', 'aplus'], [
    { a: [S + 'galaxy-tab-a8-10-5-x200', S + 'galaxy-tab-a8-10-5-x205'] },
    { a: [S + 'galaxy-tab-a9-x110', S + 'galaxy-tab-a9-x115'], aplus: [S + 'galaxy-tab-a9plus-x210', S + 'galaxy-tab-a9plus-x216'] },
    { a: [S + 'galaxy-tab-a11'], aplus: [S + 'galaxy-tab-a11-plus'] }]],
};
// where a line runs out, its natural step up
const UP = { 'iPad': 'iPad Air', 'iPad mini': 'iPad Air', 'iPad Air': 'iPad Pro', 'MacBook Air': 'MacBook Pro',
  'EarPods': 'AirPods', 'Galaxy Tab A': 'Galaxy Tab S', 'Z Flip': 'Z Fold', 'Galaxy A': 'Galaxy S' };
// a different SHAPE rather than more power: "more powerful" than an iPhone 17 is the 17 Pro, not the Air
const NOT_A_STEP_UP = { 'iPhone': new Set(['plus']) };

function curated(have) {
  const out = {};
  const newest = {};
  for (const [line, [tiers, gens]] of Object.entries(LINES))
    for (const row of gens) for (const t of tiers) if (row[t] && have(row[t][0])) { newest[line] = row[t][0]; break; }
  for (const [line, [tiers, gens]] of Object.entries(LINES)) {
    const cells = new Map(), canon = new Map(), key = (g, t) => g + ',' + t;
    gens.forEach((row, g) => { for (const [t, ids] of Object.entries(row)) {
      const live = ids.filter(have), ti = tiers.indexOf(t);
      if (ti < 0) throw new Error(`${line}: unknown tier ${t}`);
      cells.set(key(g, ti), live);
      if (live.length) canon.set(key(g, ti), live[0]);
    } });
    const skip = NOT_A_STEP_UP[line] || new Set();
    const at = (g, t) => canon.get(key(g, t));
    const genStep = (g, t, d) => { for (g += d; g >= 0 && g < gens.length; g += d) if (at(g, t)) return at(g, t); };
    const tierStep = (g, t, d) => { for (t += d; t >= 0 && t < tiers.length; t += d) if (at(g, t) && !(d > 0 && skip.has(tiers[t]))) return at(g, t); };
    const all = [...canon].map(([k, id]) => { const [g, t] = k.split(',').map(Number); return { g, t, id }; });
    for (const [k, ids] of cells) {
      if (!ids.length) continue;
      const [g, t] = k.split(',').map(Number), mine = ids[0], pair = [];
      const add = (x, r) => { if (x && x !== mine && !pair.some(p => p[0] === x) && pair.length < 2) pair.push([x, r]); };
      const newer = genStep(g, t, 1), older = genStep(g, t, -1), stronger = tierStep(g, t, 1), cheaper = tierStep(g, t, -1);
      const s1 = [[newer, 'newer'], [stronger, 'stronger'], [cheaper, 'cheaper']].find(([x]) => x);
      if (s1) add(...s1);
      const s2 = [[older, 'older'], [stronger, 'stronger'], [cheaper, 'cheaper']].find(([x]) => x && x !== (s1 && s1[0]));
      if (s2) add(...s2);
      // still short: a stronger model elsewhere in the line, the line one step up, a cheaper model
      // in this line, then any other generation of the same tier
      const by = f => (a, b) => { const p = f(a), q = f(b); const i = p.findIndex((v, k) => v !== q[k]); return i < 0 ? 0 : p[i] < q[i] ? -1 : 1; };
      for (const c of all.filter(c => c.t > t && !skip.has(tiers[c.t])).sort(by(c => [Math.abs(c.g - g), c.t, c.id]))) add(c.id, 'stronger');
      add(newest[UP[line]], 'stronger');
      for (const c of all.filter(c => c.t < t).sort(by(c => [Math.abs(c.g - g), -c.t, c.g, c.id]))) add(c.id, c.g < g ? 'older' : c.g > g ? 'newer' : 'cheaper');
      for (const c of all.filter(c => c.t === t && c.g !== g).sort(by(c => [Math.abs(c.g - g), c.g]))) add(c.id, c.g > g ? 'newer' : 'older');
      for (const i of ids) out[i] = pair.filter(p => p[0] !== i);
    }
  }
  return out;
}

// screen size in inches, from the spec or the model code ("QE55Q60D" -> 55, "PA248QV" -> 24)
export function sizeOf(p) {
  const s = p.display && +p.display.size;
  if (s) return s;
  for (const m of String(p.name).matchAll(/(?<!\d)(\d{2,3})/g)) {
    for (const n of [+m[1], +m[1].slice(0, 2)]) if (n >= 19 && n <= 120) return n;
  }
  return null;
}
// the series a TV or monitor belongs to: its model code with the size taken out
export const seriesOf = (p, size) => String(p.name).toUpperCase().replace(String(Math.round(size)), '').replace(/[\s-]+/g, '');
const family = p => String(p.name).toLowerCase().split(/[^a-z0-9]+/).find(Boolean) || '';

export function pairs(phones, offers) {
  const price = {};
  for (const p of phones) { const l = (offers[p.id] || []).map(o => o.price); if (l.length) price[p.id] = Math.min(...l); }
  const live = phones.filter(p => price[p.id]);
  const byId = Object.fromEntries(live.map(p => [p.id, p]));
  const out = curated(id => !!byId[id]);
  for (const id of Object.keys(out)) if (!out[id].length) delete out[id];
  const screen = p => p.category === 'tv' || p.category === 'monitor';
  const size = {};
  for (const p of live) if (screen(p)) size[p.id] = sizeOf(p);
  const peers = {};                                   // category -> products
  for (const p of live) (peers[p.category] ||= []).push(p);
  // one price step up and one down among `pool`, at least 3% apart (so two listings of one
  // device do not pair with each other) and within 2x - "the next model", not any model
  const steps = (p, pool) => {
    const x = price[p.id];
    const up = pool.filter(q => price[q.id] >= x * 1.03 && price[q.id] <= x * 2).sort((a, b) => price[a.id] - price[b.id])[0];
    const dn = pool.filter(q => price[q.id] <= x / 1.03 && price[q.id] >= x / 2).sort((a, b) => price[b.id] - price[a.id])[0];
    return [up && [up.id, 'stepup'], dn && [dn.id, 'cheaper']].filter(Boolean);
  };
  for (const p of live) {
    if (out[p.id]) continue;
    const same = peers[p.category].filter(q => q.brand === p.brand && q.id !== p.id);
    let pick = [];
    if (screen(p) && size[p.id]) {
      const ser = seriesOf(p, size[p.id]);
      const sib = same.filter(q => size[q.id] && size[q.id] !== size[p.id] && seriesOf(q, size[q.id]) === ser);
      const big = sib.filter(q => size[q.id] > size[p.id]).sort((a, b) => size[a.id] - size[b.id])[0];
      const small = sib.filter(q => size[q.id] < size[p.id]).sort((a, b) => size[b.id] - size[a.id])[0];
      pick = [big && [big.id, 'bigger'], small && [small.id, 'smaller']].filter(Boolean);
      if (pick.length < 2) pick.push(...steps(p, same.filter(q => size[q.id] && Math.abs(size[q.id] - size[p.id]) <= 1)));
    } else {
      const fam = same.filter(q => family(q) === family(p));
      pick = steps(p, fam);
      for (const s of steps(p, same)) if (!pick.some(x => x[1] === s[1])) pick.push(s);
    }
    const uniq = [];
    for (const s of pick) if (!uniq.some(u => u[0] === s[0]) && uniq.length < 2) uniq.push(s);
    if (uniq.length) out[p.id] = uniq;
  }
  // the rival: another maker's closest price in the same category, within 20%
  for (const p of live) {
    const x = price[p.id], mine = out[p.id] || [];
    const pool = peers[p.category].filter(q => q.brand !== p.brand && price[q.id] >= x / 1.2 && price[q.id] <= x * 1.2
      && (!screen(p) || !size[p.id] || (size[q.id] && Math.abs(size[q.id] - size[p.id]) <= 1)));
    const r = pool.sort((a, b) => Math.abs(price[a.id] - x) - Math.abs(price[b.id] - x) || (a.id < b.id ? -1 : 1))[0];
    if (r && !mine.some(m => m[0] === r.id)) out[p.id] = [...mine, [r.id, 'alternative']];
  }
  return out;
}

// node tools/pairs.mjs - summary + self-check
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const fs = await import('node:fs');
  const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
  const offers = JSON.parse(fs.readFileSync('data/prices.json', 'utf8')).offers;
  const out = pairs(phones, offers), byId = Object.fromEntries(phones.map(p => [p.id, p]));
  const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } };
  for (const [id, list] of Object.entries(out)) for (const [q, r] of list) {
    assert(byId[q] && q !== id, `${id} -> ${q}`);
    assert(byId[q].category === byId[id].category, `${id} -> ${q}: other category`);
    assert((r === 'alternative') === (byId[q].brand !== byId[id].brand), `${id} -> ${q}: ${r} but brands ${byId[id].brand}/${byId[q].brand}`);
  }
  assert(JSON.stringify(out['apple-iphone-17-pro'].slice(0, 2)) === '[["apple-iphone-18-pro","newer"],["apple-iphone-16-pro","older"]]', '17 Pro pairing');
  assert(sizeOf({ name: 'QE55Q60D' }) === 55 && sizeOf({ name: 'PA248QV' }) === 24 && sizeOf({ name: '100E7Q PRO' }) === 100, 'sizeOf');
  const n = phones.filter(p => out[p.id]).length;
  const cats = {};
  for (const p of phones) { const c = cats[p.category] ||= [0, 0]; c[1]++; if (out[p.id]) c[0]++; }
  console.log(`${n} of ${phones.length} products have compare cards`);
  console.log(Object.entries(cats).map(([c, [a, b]]) => `${c} ${a}/${b}`).join(', '));
  for (const id of process.argv.slice(2)) console.log(id, '->', JSON.stringify(out[id]));
}
