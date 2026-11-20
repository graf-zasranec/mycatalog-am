// Run after node build.mjs: node tools/pdp2-phone-test.mjs  (needs Brave; local serve.mjs on 8819)
// Tests the v2 phone product page on the local build: sizes x themes x products, every option click.
import { chromium } from 'playwright'; import { spawn } from 'node:child_process';
const PORT = 8819; const srv = spawn('node', ['serve.mjs', String(PORT)], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 1500));
const IDS = ['apple-iphone-18-pro', 'apple-ipad-mini-a20-pro', 'samsung-galaxy-s26-ultra', 'apple-macbook-air-13-m5', 'sony-ps5-slim', 'apple-airpods-pro-3', 'samsung-qe65s90haexpy', 'acer-anv15-52-99cv', 'ray-ban-meta-headliner-gen-2-matte-black-polar-gradient-graphite-size50'];
const sizes = [[320, 568], [360, 780], [393, 852], [430, 932]];
const b = await chromium.launch({ executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' });
const bugs = new Set(); let checks = 0; const bug = (c, m) => bugs.add(`${c}: ${m}`);
const audit = p => p.evaluate(() => {
  const out = [], vis = el => el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push('sideways scroll ' + document.documentElement.scrollWidth);
  const bar = document.querySelector('.p2-bar'), nav = document.querySelector('.bx-mobile-nav');
  if (nav && vis(nav) && document.querySelector('.pdp2')) out.push('tab bar still shown');
  for (const el of document.querySelectorAll('.p2-bar strong,.p2-go,.p2-more,.pdp2 .bs button,.pdp2 h1')) if (vis(el) && el.scrollWidth > el.clientWidth + 1) out.push('text overflows: ' + el.textContent.trim().slice(0, 30));
  for (const el of document.querySelectorAll('.p2-go,.p2-more,.pdp2 .bs button,.pdp2 .cs button')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.height < 43.5) out.push(`small tap ${Math.round(r.width)}x${Math.round(r.height)} ${el.textContent.trim().slice(0, 16) || el.getAttribute('aria-label')}`); }
  if (bar && vis(bar)) { const a = bar.querySelector('div').getBoundingClientRect(), g = bar.querySelector('.p2-go').getBoundingClientRect(); if (a.right > g.left - 4) out.push('bar price runs into button');
    const first = document.querySelector('#offList .orow .op,#offList .orow b'); }
  const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
  const bgOf = el => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)/.test(b) && b !== 'transparent') return b; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor; };
  for (const el of document.querySelectorAll('.p2-bar small,.p2-bar strong,.p2-bar span,.p2-go,.p2-more,.p2-more span,.p2-keys li,.p2-keys li span')) { if (!vis(el)) continue; const cs = getComputedStyle(el);
    const r = (Math.max(lum(cs.color), lum(bgOf(el))) + .05) / (Math.min(lum(cs.color), lum(bgOf(el))) + .05); if (r < 4.5) out.push(`contrast ${r.toFixed(2)}: ${el.textContent.trim().slice(0, 20)}`); }
  const img = document.getElementById('hpShot'); if (img && (!img.complete || !img.naturalWidth)) out.push('photo not loaded');
  return out; });
const barMatches = p => p.evaluate(() => { const bar = document.querySelector('.p2-bar strong'); const pp = document.querySelector('.pp-row b'); if (!bar) return null; return [bar.textContent.trim(), pp ? pp.textContent.trim() : null]; });
for (const scheme of ['light', 'dark']) for (const [w, h] of sizes) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && !/favicon|ERR_BLOCKED|gtag|goatcounter|facebook/i.test(m.text()) && errs.push(m.text()));
  for (const id of IDS) {
    const ctx = `${w} ${scheme} ${id}`;
    await p.goto(`http://127.0.0.1:${PORT}/#/p/${id}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
    if (!(await p.$('.pdp2'))) { bug(ctx, 'v2 not rendered'); continue; }
    (await audit(p)).forEach(m => bug(ctx, m)); checks++;
    const hasOffers = await p.$('#offList'); const bar = await p.$('.p2-bar');
    if (!!hasOffers !== !!bar) bug(ctx, `bar ${bar ? 'shown' : 'missing'} with${hasOffers ? '' : 'out'} offers`);
    const m = await barMatches(p); if (m && m[1] && m[0] !== m[1]) bug(ctx, `bar price ${m[0]} vs page ${m[1]}`);
    // every option button
    for (const sel of ['[data-color]', '[data-storage]', '[data-ram]', '[data-size]', '[data-esim]', '[data-cell]', '[data-nt]']) {
      const n = await p.locator(`.pdp2 ${sel}`).count();
      for (let i = 0; i < n; i++) { const el = p.locator(`.pdp2 ${sel}`).nth(i); if (!(await el.isVisible()) || await el.isDisabled()) continue;
        await el.click(); await p.waitForTimeout(120); await p.waitForFunction(() => { const i = document.getElementById('hpShot'); return !i || i.complete; }, null, { timeout: 5000 }).catch(() => {}); checks++;
        const mm = await barMatches(p); if (mm && mm[1] && mm[0] !== mm[1]) bug(ctx, `after ${sel}#${i}: bar ${mm[0]} vs page ${mm[1]}`);
        (await audit(p)).forEach(x => bug(ctx, `after ${sel}#${i}: ${x}`)); }
    }
    // all specs scrolls and keeps the route
    const sp = await p.$('[data-p2-specs]'); if (sp) { await sp.click(); await p.waitForTimeout(700); const st = await p.evaluate(() => [location.hash, Math.round(document.getElementById('specs').getBoundingClientRect().top)]);
      if (!st[0].includes(id)) bug(ctx, 'all specs changed the route ' + st[0]); if (st[1] > 300 || st[1] < -50) bug(ctx, 'all specs did not scroll there ' + st[1]); checks++; }
    const sh = await p.$('.p2-shops'); if (sh && !(await sh.getAttribute('href')).includes(id)) bug(ctx, 'all shops link wrong');
    if (w === 393 && ['apple-iphone-18-pro', 'apple-macbook-air-13-m5', 'acer-anv15-52-99cv'].includes(id)) { await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200); await p.screenshot({ path: `/tmp/igm/pdp2/${scheme}-${id}-top.png` }); await p.evaluate(() => scrollTo(0, 650)); await p.waitForTimeout(200); await p.screenshot({ path: `/tmp/igm/pdp2/${scheme}-${id}-mid.png` }); }
  }
  if (errs.length) bug(`${w} ${scheme}`, 'console: ' + [...new Set(errs)].slice(0, 3).join(' | '));
  await c.close();
}
// old page still reachable, desktop unchanged
{ const c = await b.newContext({ viewport: { width: 393, height: 852 } }); const p = await c.newPage();
  await p.goto(`http://127.0.0.1:${PORT}/?pdp=0#/p/apple-iphone-18-pro`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  if (await p.$('.pdp2')) bug('?pdp=0', 'still v2'); if (!(await p.$('.pprice2 .pp-row'))) bug('?pdp=0', 'old price block missing');
  await p.goto(`http://127.0.0.1:${PORT}/?pdp=1#/p/apple-iphone-18-pro`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500); if (!(await p.$('.pdp2'))) bug('?pdp=1', 'v2 not back'); await c.close(); checks += 2;
  const d = await b.newContext({ viewport: { width: 1440, height: 900 } }); const q = await d.newPage(); await q.goto(`http://127.0.0.1:${PORT}/#/p/apple-iphone-18-pro`, { waitUntil: 'networkidle' }); await q.waitForTimeout(500);
  const vis = await q.evaluate(() => [...document.querySelectorAll('.p2-bar,.p2-arc,.p2-keys,.p2-more')].filter(e => e.offsetParent !== null).length); if (vis) bug('desktop 1440', `${vis} phone-only pieces visible`);
  await q.screenshot({ path: '/tmp/igm/pdp2/desktop.png' }); await d.close(); checks++; }
await b.close(); srv.kill();
const kinds = {}; for (const x of bugs) { const k = x.replace(/^\d+ (light|dark) /, '').replace(/after [^:]+: /, ''); (kinds[k] ||= new Set()).add(x.split(' ').slice(0, 2).join(' ')); }
console.log(`checks: ${checks}, problems: ${bugs.size}, distinct: ${Object.keys(kinds).length}`); for (const [k, v] of Object.entries(kinds).slice(0, 50)) console.log(' - ' + k + '  [' + [...v].join(', ') + ']');
