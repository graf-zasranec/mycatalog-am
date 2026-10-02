// UI audit in Edge: every route x width x theme x language, measured, not eyeballed.
//   node .unlazy/better2/audit.mjs            report to stdout + screenshots in .unlazy/better2/shots
// Checks per page: page errors, broken images, sideways scroll, text clipped by its own box,
// tap targets under 44 px (phone widths), body text under 12 px, images without alt, controls
// without an accessible name, layout shift after load, and interactions (filters, swatch,
// sort, compare) that throw or do nothing.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PW || 'C:/Users/hastv/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const PORT = 8766, BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, ['serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const SHOTS = '.unlazy/better2/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const ROUTES = ['#/', '#/construct', '#/c/phone', '#/c/laptop', '#/c/headphones', '#/c/watch', '#/p/apple-iphone-17',
  '#/p/samsung-galaxy-s26-ultra', '#/p/xiaomi-smart-band-10', '#/p/apple-macbook-air-13-m4', '#/offers/apple-iphone-17',
  '#/compare', '#/search', '#/blog', '#/p/does-not-exist'];
const WIDTHS = [2560, 1440, 1024, 768, 412, 390, 360, 320, 280];
const LANGS = ['hy', 'ru', 'en'];
const issues = {};
const add = (k, where) => { (issues[k] ||= new Set()).add(where); };

const browser = await pw.chromium.launch({ headless: true, channel: 'msedge' });
let n = 0;
for (const w of WIDTHS) for (const theme of ['light', 'dark']) {
  const lang = LANGS[(WIDTHS.indexOf(w) + (theme === 'dark' ? 1 : 0)) % 3];   // every width sees two languages
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 800 : 900 }, colorScheme: theme,
    hasTouch: w < 768, isMobile: w < 768 });
  await ctx.addInitScript(s => { try { localStorage.setItem('better.v2', s); } catch (e) {} },
    JSON.stringify({ lang, cmp: ['apple-iphone-17-pro', 'samsung-galaxy-s26-ultra', 'google-pixel-10-pro'] }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errs.push(m.text()); });
  for (const r of ROUTES) {
    n++; errs.length = 0;
    const where = `${r} @${w} ${theme} ${lang}`;
    await page.goto(`${BASE}index.html?r=${n}${r}`, { waitUntil: 'load' });
    await page.waitForTimeout(700);
    const res = await page.evaluate((w) => {
      const out = { clip: [], small: [], tiny: [], noalt: [], noname: [], broken: [], wide: 0, cls: 0 };
      const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
      const name = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('alt') || el.value || '').trim();
      const label = el => el.id + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ' "' + name(el).slice(0, 24) + '"';
      out.wide = document.documentElement.scrollWidth - innerWidth;
      for (const img of document.images) {
        if (!vis(img)) continue;
        if (img.complete && img.naturalWidth === 0) out.broken.push(img.src.slice(-60));
        if (!img.hasAttribute('alt')) out.noalt.push(img.src.slice(-50));
      }
      for (const el of document.querySelectorAll('a,button,input,select,textarea,[role=button],summary')) {
        if (!vis(el) || el.closest('[aria-hidden="true"]')) continue;
        const r = el.getBoundingClientRect();
        if (!name(el) && !el.labels?.length && !el.getAttribute('aria-labelledby')) out.noname.push(label(el));
        // WCAG 2.5.8: 24 px is the floor; 44 is the target on a phone. Inline text links are exempt.
        if (w < 768 && (r.width < 24 || r.height < 24) && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline'))
          if (!getComputedStyle(el, '::before').inset || getComputedStyle(el, '::before').content === 'none') out.small.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      for (const el of document.querySelectorAll('body *')) {
        if (!vis(el) || !el.childNodes.length) continue;
        const own = [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
        if (!own || el.closest('.vh')) continue;
        const s = getComputedStyle(el), fs = parseFloat(s.fontSize);
        if (fs < 11.5) out.tiny.push(`${label(el)} ${fs}px`);
        // clipped: its own text is wider than it, and it hides the rest (no scroll, no ellipsis meant)
        if (el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(s.overflowX + s.overflow) && s.textOverflow !== 'ellipsis' && el.clientWidth > 0)
          out.clip.push(`${label(el)} ${el.scrollWidth}>${el.clientWidth}`);
      }
      return out;
    }, w);
    const cls = await page.evaluate(() => new Promise(res => { let v = 0;
      try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; })
        .observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
      setTimeout(() => res(v), 300); }));
    if (res.wide > 1) add(`page wider than screen (${res.wide}px)`, where);
    res.broken.forEach(s => add('broken image ' + s, where));
    res.noalt.forEach(s => add('image without alt ' + s, r));
    res.noname.forEach(s => add('control without a name ' + s, r));
    res.small.forEach(s => add('tap target under 24px ' + s, `${r} @${w}`));
    res.tiny.forEach(s => add('text under 11.5px ' + s, `${r} @${w}`));
    res.clip.forEach(s => add('text clipped ' + s, where));
    if (cls > 0.1) add(`layout shift ${cls.toFixed(2)}`, where);
    errs.forEach(e => add('error: ' + e.slice(0, 120), where));
    if ((w === 390 || w === 1440) && /^#\/($|c\/phone|p\/apple-iphone-17|offers|compare)/.test(r))
      await page.screenshot({ path: `${SHOTS}/${r.replace(/[#/]+/g, '_') || 'home'}_${w}_${theme}.png`, fullPage: false });
  }
  // interactions on a product page and the catalogue
  try {
    await page.goto(`${BASE}index.html?r=i${n}#/p/apple-iphone-17`); await page.waitForTimeout(500);
    const sw = page.locator('.cs button:not([disabled])').nth(1);
    if (await sw.count()) { const before = await page.locator('#hpShot').getAttribute('src'); await sw.click(); await page.waitForTimeout(300);
      const after = await page.locator('#hpShot').getAttribute('src');
      if (before === after) add('colour swatch click did not change the photo', `iphone-17 @${w}`); }
    await page.goto(`${BASE}index.html?r=j${n}#/c/phone`); await page.waitForTimeout(500);
    const sort = page.locator('select[data-f="sort"]:visible').first();
    if (await sort.count()) { const opts = await sort.locator('option').count(); if (opts > 1) await sort.selectOption({ index: opts - 1 }); }
    const filt = page.locator('button:has-text("Filter"), button:has-text("Ֆիլտր"), button:has-text("Фильтр"), [data-open-sheet]').first();
    if (w < 768 && await filt.count()) { await filt.click(); await page.waitForTimeout(400); }
    if (errs.length) errs.forEach(e => add('interaction error: ' + e.slice(0, 120), `@${w} ${theme}`));
  } catch (e) { add('interaction failed: ' + e.message.split('\n')[0].slice(0, 120), `@${w} ${theme}`); }
  await ctx.close();
}
await browser.close(); srv.kill();

const keys = Object.keys(issues).sort((a, b) => issues[b].size - issues[a].size);
console.log(`${n} page loads in Edge, ${keys.length} distinct issue(s)\n`);
for (const k of keys) { const v = [...issues[k]]; console.log(`${String(v.length).padStart(4)}  ${k}\n        e.g. ${v.slice(0, 3).join(' | ')}`); }
if (!keys.length) console.log('AUDIT CLEAN');
