// One browser check for the whole site: every route, three engines, nine widths.
//
// It needs Playwright, which is deliberately not a dependency of this repo - the site itself has
// none. Install it anywhere and point Node at it:
//   npm i playwright --prefix %TEMP%\pw
//   set NODE_PATH=%TEMP%\pw\node_modules && node tools/check.mjs
// Serve the build first: node serve.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PW_PATH, 'playwright'].filter(Boolean)) {
  try { pw = req(p); break; } catch { }
}
if (!pw) { console.error('playwright not found - see the header of this file'); process.exit(2); }
const { chromium, firefox, webkit } = pw;

const BASE = process.env.BASE || 'http://127.0.0.1:8814/';
const BRAVE = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const U = h => BASE + '?v=' + Date.now() + '#' + h;

const ROUTES = ['/', '/c/phone', '/c/appliance', '/c/speaker', '/p/samsung-galaxy-s26',
  '/p/dyson-airwrap-hs09', '/offers/samsung-galaxy-s26', '/compare', '/construct', '/privacy', '/contact'];
const WIDTHS = [[2560, 1440, 'monitor'], [1920, 1080, 'pc'], [1680, 1050, 'imac'], [1440, 900, 'notebook'],
  [1280, 800, 'laptop'], [1024, 768, 'small-laptop'], [820, 1180, 'tablet'], [430, 932, 'phone-l'], [360, 740, 'phone-s']];

const found = [];

/* what every page must satisfy, whatever the engine or the width */
async function probe(page) {
  return page.evaluate(() => {
    const d = document.documentElement, main = document.querySelector('main');
    let rules = 0;
    for (const s of document.styleSheets) { try { rules += s.cssRules.length; } catch { } }
    const wide = [...document.querySelectorAll('body *')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > d.clientWidth + 2; })
      .slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + String(e.className || '').split(' ')[0]);
    const clipped = [...document.querySelectorAll('main *')]
      .filter(e => e.children.length === 0 && e.scrollWidth > e.clientWidth + 4 && getComputedStyle(e).overflowX !== 'auto')
      .slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + String(e.className || '').split(' ')[0]);
    return {
      over: d.scrollWidth - d.clientWidth, wide, clipped, rules,
      broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length,
      empty: !main || main.innerText.trim().length < 40,
      cards: document.querySelectorAll('.pcard').length,
    };
  });
}

async function sweep(name, launcher, opts, widths, routes) {
  let b;
  try { b = await launcher.launch(opts); } catch (e) { found.push(`${name}: will not launch - ${String(e).split('\n')[0].slice(0, 70)}`); return; }
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 130)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 130)); });
  await page.goto(U('/'), { waitUntil: 'load' });
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mycatalog.v2') || '{}'); s.cmp = ['apple-iphone-17-pro-max', 'apple-iphone-16']; localStorage.setItem('mycatalog.v2', JSON.stringify(s)); });
  for (const [w, h, vp] of widths) {
    await page.setViewportSize({ width: w, height: h });
    for (const r of routes) {
      errs.length = 0;
      await page.goto(U(r), { waitUntil: 'load' });
      await page.waitForTimeout(650);
      const p = await probe(page);
      const bad = [];
      if (p.over > 2) bad.push(`overflow ${p.over}px ${p.wide.join(',')}`);
      if (p.clipped.length) bad.push(`clipped ${p.clipped.join(',')}`);
      if (p.broken) bad.push(`${p.broken} broken image(s)`);
      if (p.empty) bad.push('main is empty');
      if (!p.rules) bad.push('stylesheet did not parse');
      if (errs.length) bad.push('console ' + [...new Set(errs)].join(' ~ '));
      if (bad.length) found.push(`${name}/${vp}${r}: ${bad.join(' | ')}`);
      if (r === '/c/phone' && name === 'chromium') found.push(`   [${vp} ${w}] ${p.cards} cards, ${p.rules} rules`);
    }
  }
  await b.close();
}

/* Chromium carries the width sweep - the engines differ on features, not on media queries.
   Firefox and WebKit run the routes at the two sizes that matter. */
await sweep('chromium', chromium, fs.existsSync(BRAVE) ? { executablePath: BRAVE } : {}, WIDTHS, ROUTES);
await sweep('firefox', firefox, {}, [[1440, 900, 'desktop'], [390, 844, 'phone']], ROUTES);
await sweep('webkit', webkit, {}, [[1440, 900, 'desktop'], [390, 844, 'phone']], ROUTES);

const bad = found.filter(l => !l.startsWith('   '));
console.log(found.join('\n'));
console.log(bad.length ? `\n${bad.length} finding(s)` : '\nno findings');
process.exit(bad.length ? 1 : 0);
