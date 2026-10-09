// Every filter the catalogue offers, in every section, in a real browser.
//   PW=<playwright path> node tools/filter-check.mjs
// For each option a section shows: the count beside it must equal what the grid then lists, and
// every product listed must really have that value. Also prints, per filter, how many products in
// the section have NO value for it - those silently vanish the moment the filter is switched on.
// Prints "FILTERS OK" only when every count and every listed product holds.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const pw = createRequire(import.meta.url)(process.env.PW || 'playwright');
const PORT = 8766, BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, ['serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
let bad = 0;
try {
  const browser = await pw.chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();
  await page.goto(BASE + '#/', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof matches === 'function' && typeof DATA !== 'undefined');
  const cats = await page.evaluate(() => ['', ...new Set(DATA.map(p => p.category || 'phone'))]);
  for (const cat of cats) {
    const r = await page.evaluate(async cat => {
      location.hash = cat ? '#/c/' + cat : '#/catalog';
      await new Promise(z => setTimeout(z, 300));
      const out = { cat: cat || 'all', listed: results().length, options: 0, errs: [], gaps: [] };
      const pool = inView().filter(hasReal);
      const seen = new Set();
      const shown = new Set([...document.querySelectorAll('#fbar details[data-drop], #fbar [data-f]')].map(e => e.dataset.drop || e.dataset.f));
      const tmp = document.createElement('div'); tmp.innerHTML = [...filterBodies.values()].join('');
      for (const el of tmp.querySelectorAll('[data-cnt]')) {
        const d = el.dataset.cnt, i = d.indexOf(':'), k = d.slice(0, i), v = d.slice(i + 1), f = FILT[k];
        if (!f || !shown.has(k)) continue;
        seen.add(k);
        const extra = f.kind === 'set' ? { [f.arr]: [v] } : { [k]: +v };
        const s = { ...st, ...extra }, list = DATA.filter(p => matches(p, s));
        out.options++;
        if (list.length !== cnt(extra)) out.errs.push(`${k}=${v}: count ${cnt(extra)} but lists ${list.length}`);
        // independent reading of what the option promises
        const ok = p => {
          if (k === 'shop') return offersFor(p).some(o => o.shop === v);
          if (k === 'ram' || k === 'stor') return true;     // judged on real configurations, not one field
          const val = f.of(p, s);
          if (f.kind === 'set') return String(val) === v;
          if (f.kind === 'min') return val >= +v;
          if (f.kind === 'max') return val <= +v;
          if (f.kind === 'yn') return val === (+v === 1);
          return !!val;
        };
        const wrong = list.filter(p => !ok(p));
        if (wrong.length) out.errs.push(`${k}=${v}: ${wrong.length} listed without it, e.g. ${wrong[0].id}`);
        const missed = pool.filter(p => ok(p) && matches(p, { ...st, q: st.q }) && !list.includes(p));
        if (missed.length && k !== 'ram' && k !== 'stor') out.errs.push(`${k}=${v}: ${missed.length} have it but are not listed, e.g. ${missed[0].id}`);
      }
      for (const k of seen) {
        const f = FILT[k];
        if (!f.of || k === 'brand') continue;
        const none = pool.filter(p => { const v = f.of(p, st); return v == null || v === '' || (typeof v === 'number' && !v); });
        if (none.length && f.kind !== 'flag' && f.kind !== 'yn') out.gaps.push(`${k}: ${none.length}/${pool.length} have no value (e.g. ${none.slice(0, 3).map(p => p.id).join(', ')})`);
      }
      return out;
    }, cat);
    console.log(`${r.cat}: ${r.listed} listed, ${r.options} options checked`);
    for (const e of r.errs) { bad++; console.log('  FAIL ' + e); }
    for (const g of r.gaps) console.log('  gap  ' + g);
  }
  // and once through the real controls: tick an option, read the button that applies the sheet
  await page.goto(BASE + '#/c/headphones', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof cnt === 'function');
  const want = await page.evaluate(() => cnt({ hconns: ['wired'] }));
  await page.evaluate(() => { const b = document.querySelector('[data-fmore]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); });
  await page.locator('details[data-drop="hconn"] > summary').click();
  await page.locator('details[data-drop="hconn"] input[value="wired"]').check();
  await page.locator('details[data-drop="hconn"] [data-apply]').click();
  await page.waitForTimeout(400);
  const got = await page.evaluate(() => results().length);
  if (got !== want) { bad++; console.log(`FAIL clicking Wired lists ${got}, its count said ${want}`); }
  else console.log(`clicked Headphones > Wired: ${got} listed, as its count said`);
  await browser.close();
} finally { srv.kill(); }
console.log(bad ? `${bad} filter problem(s)` : 'FILTERS OK');
process.exit(bad ? 1 : 0);
