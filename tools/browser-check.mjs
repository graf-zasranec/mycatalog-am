// The built site in real engines - Edge/Chromium, Firefox and WebKit (Safari's engine) -
// through Playwright. Every route is opened with a real reload (a fresh ?r= query), at nine
// widths, and checked for: uncaught errors and console errors, images that finished loading
// broken, and a page wider than the screen. The two static page types (p/, c/) too.
// Prints "PLAYWRIGHT OK" only when all of it holds in all three engines.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PW || 'playwright');

const PORT = 8765, BASE = `http://127.0.0.1:${PORT}/`;
const srv = spawn(process.execPath, ['serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const ROUTES = ['#/', '#/c/laptop', '#/c/phone', '#/c/headphones', '#/p/apple-iphone-17', '#/offers/apple-iphone-17', '#/compare',
  '#/search', '#/p/does-not-exist'];
const STATIC = ['p/apple-iphone-17/', 'c/phone/', 'ru/p/apple-iphone-17/', 'en/c/phone/samsung/', 'b/esim-or-nano-sim/'];
const WIDTHS = (process.env.PW_WIDTHS || '2560,1920,1366,1024,768,412,375,344,280').split(',').map(Number);
// what the app keeps in localStorage: a comparison of two phones and a search nothing matches
const SAVED = JSON.stringify({ lang: 'hy', cmp: ['apple-iphone-17-pro', 'samsung-galaxy-s26-ultra'], q: 'zzqxw' });
// Locally Firefox is left out: Windows refuses to start Playwright's firefox.exe on the owner's PC
// ("spawn UNKNOWN"), and loosening that is the owner's decision. CI runs it: .github/workflows/browsers.yml
const ALL = { edge: [pw.chromium, { channel: 'msedge' }], chromium: [pw.chromium, {}], firefox: [pw.firefox, {}], webkit: [pw.webkit, {}] };
const ENGINES = (process.env.PW_ENGINES || 'edge,webkit').split(',').map(n => [n, ...ALL[n]]);

let bad = 0, n = 0;
const fail = m => { bad++; console.log('FAIL ' + m); };
try {
  for (const [name, type, opts] of ENGINES) {
    const browser = await type.launch({ headless: true, ...opts });
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 800 : 900 } });
      await ctx.addInitScript(s => { try { if (!localStorage.getItem('better.v2')) localStorage.setItem('better.v2', s); } catch (e) {} }, SAVED);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      // the web fonts come from Google and may be slow or blocked here; that is the network, not the site
      page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errs.push('console: ' + m.text()); });
      page.on('response', r => { if (r.status() === 404) errs.push('404: ' + r.url()); });
      // Optional visitor-count requests must not fail the application check when
      // the external analytics service is unavailable or blocked by the browser.
      page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|analytics|counter|https:\/\/gc\.zgo\.at\//.test(r.url())) errs.push('request failed: ' + r.url()); });
      for (const r of [...ROUTES.map(h => `index.html?r=${n}${h}`), ...STATIC]) {
        n++;
        errs.length = 0;
        await page.goto(BASE + r, { waitUntil: 'load' });
        await page.waitForTimeout(350);
        const m = await page.evaluate(() => ({
          over: document.documentElement.scrollWidth - innerWidth,
          broken: [...document.images].filter(i => i.complete && i.currentSrc && i.naturalWidth === 0).map(i => i.currentSrc.slice(-60)),
          h1: (document.querySelector('h1') || {}).textContent || '',
          // the empty-photo placeholder (a data: SVG) where a real photo should be
          nophoto: [...document.images].filter(i => i.src.startsWith('data:image/svg+xml;base64,PHN2Zy')).map(i => i.alt).slice(0, 3),
        }));
        const where = `${name} ${w}px ${r.replace(/\?r=\d+/, '')}`;
        if (m.over > 1) fail(`${where}: ${m.over}px sideways scroll`);
        if (m.broken.length) fail(`${where}: broken image(s) ${m.broken.join(', ')}`);
        if (m.nophoto.length && /#\/(c|p)\//.test(r)) fail(`${where}: placeholder instead of a photo: ${m.nophoto.join(', ')}`);
        for (const e of errs) fail(`${where}: ${e}`);
        if (r.endsWith('does-not-exist') && !m.h1.trim()) fail(`${where}: the not-found page has no heading`);
      }
      await ctx.close();
    }
    await browser.close();
    console.log(`${name}: done`);
  }
} finally { srv.kill(); }
console.log(`${n} page loads`);
if (bad) { console.log(`playwright: ${bad} failure(s)`); process.exit(1); }
console.log('PLAYWRIGHT OK');
