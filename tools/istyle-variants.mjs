// Shared exact iStyle matrix reader for crawls and hand-price checks.
const capOf = value => {
  const s=String(value||'').replace(/գբ|гб/gi,'GB').replace(/տբ|тб/gi,'TB');
  const values=[...s.matchAll(/([\d.]+)\s*(GB|TB)/gi)].map(m=>Math.round(+m[1]*(/TB/i.test(m[2])?1024:1)));
  return values.length?Math.max(...values):null;
};
export function istyleVariants(html) {
  const j = html.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'");
  const at = j.indexOf('"variants":[');
  if (at < 0) return [];
  const start = j.indexOf('[', at);
  const BS = String.fromCharCode(92);            // a backslash, without writing one
  let depth = 0, i = start, instr = false, esc = false;
  for (; i < j.length; i++) {
    const c = j[i];
    if (instr) { if (esc) esc = false; else if (c === BS) esc = true; else if (c === '"') instr = false; continue; }
    if (c === '"') instr = true;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) break;
  }
  let arr;
  try { arr = JSON.parse(j.slice(start, i + 1)); } catch { return []; }
  const best = new Map();
  for (const v of arr) {
    if (v.is_active === false) continue;
    const price = Math.round(Number(v.is_on_sale && v.sale_price ? v.sale_price : v.price_override));
    if (!(price > 5000)) continue;
    const attr = {};
    for (const av of v.attribute_values || []) {
      const n = ((av.attribute || {}).name || {}).en;
      // 1 TB and 2 TB carry only an Armenian label, "1T" / "2T"
      const val = (av.value || {}).en ?? String((av.value || {}).hy ?? '').replace(/^([0-9]+) *T$/i, '$1TB');
      if (n) attr[String(n).toLowerCase()] = val;
    }
    // "No Sim" is the eSIM-only build and "1SIM" the one with a tray - the shop is counting
    // physical slots, so the wording is the opposite way round from every other site here.
    // The iPhone 18 line labels the tray-less build plainly "esim" (value 11) next to "1SIM".
    const q = String(attr['sim card quantity'] || '');
    const sim = /no\s*sim|^\s*e-?sim\s*$/i.test(q) ? true : /\d\s*sim/i.test(q) ? false : undefined;
    const cap = capOf(attr['internal memory'] || '');
    const colours = (v.attribute_values || []).filter(av => /^colou?r$/i.test(((av.attribute || {}).name || {}).en || ''))
      .map(av => ({ name: ((av.color_label || {}).en || '').trim() || null, id: av.id }));
    for (const c of colours.length ? colours : [{ name: null, id: null }]) {
      const configuration = Object.entries(attr).filter(([name]) => !/^colou?r$/i.test(name)).sort(([a], [b]) => a.localeCompare(b));
      const k = JSON.stringify([configuration, c.name]);
      const query = new URLSearchParams();
      if (c.id != null) query.set('color', String(c.id));
      if (v.id != null) query.set('variant', colours.length > 1 && c.id != null ? `${v.id}_color_${c.id}` : String(v.id));
      // iStyle's picker restores each attribute by its Armenian name and value ID.
      for (const av of v.attribute_values || []) {
        const names = av.attribute?.name || {};
        if (/^colou?r$/i.test(names.en || '') || av.id == null) continue;
        const name = names.hy || names.en;
        if (name) query.set(name, String(av.id));
      }
      const ram = capOf(attr['ram'] || attr['operating memory'] || attr['random access memory'] || '');
      const row = { price, storage: cap != null && cap >= 64 ? cap : null,
                    ram: ram != null && ram <= 192 ? ram : undefined,
                    esim: sim, simFromPage: sim !== undefined || undefined,
                    inStock: Number(v.stock) > 0, color: c.name,
                    variant: query.size ? '?' + query.toString() : '' };
      const had = best.get(k);
      // in stock beats out of stock; below that, the cheaper one
      if (!had || (row.inStock && !had.inStock) || (row.inStock === had.inStock && row.price < had.price))
        best.set(k, row);
    }
  }
  return [...best.values()];
}
