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
const STATIC = ['p/apple-iphone-17/', 'c/phone/', 'ru/p/apple-iphone-17/', 'en/p/apple-iphone-18-pro/', 'en/c/phone/samsung/', 'b/esim-or-nano-sim/'];
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
      // Route and layout checks opt out of analytics, avoiding synthetic visits and
      // third-party network failures. Live analytics is verified separately.
      await ctx.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }));
      await ctx.addInitScript(s => { try { if (!localStorage.getItem('better.v2')) localStorage.setItem('better.v2', s); } catch (e) {} }, SAVED);
      for (const r of [...ROUTES.map(h => `index.html?r=${n}${h}`), ...STATIC]) {
        n++;
        // Keep each route's events on its own page, so a closing document
        // cannot send a late request failure to the next route.
        const page = await ctx.newPage();
        const errs = [];
        const aborted = /2152398850|NS_(?:BINDING_ABORTED|ERROR_ABORT)|net::ERR_ABORTED|^Load request cancelled$/i;
        page.on('pageerror', e => errs.push('pageerror: ' + e.message));
        page.on('console', m => {
          if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && !aborted.test(m.text())) errs.push('console: ' + m.text());
        });
        page.on('response', response => {
          if (response.status() === 404) errs.push('404: ' + response.url());
        });
        page.on('requestfailed', request => {
          const error = request.failure()?.errorText || '';
          if (!/fonts\.(googleapis|gstatic)|analytics|counter|https:\/\/gc\.zgo\.at\//.test(request.url()) && !aborted.test(error))
            errs.push('request failed: ' + request.url() + ' (' + error + ')');
        });
        await page.goto(BASE + r, { waitUntil: 'load' });
        // Boot deliberately waits for the first product photo to decode before
        // loading details. A fixed 350ms delay could navigate away mid-download
        // and report Safari's cancellation against the following route.
        // Wait for the real application and route, retaining all request errors.
        if (await page.locator('script[data-src][src*="site-boot"]').count()) await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' &&
          !document.documentElement.classList.contains('route-pending'), null, { timeout: 15000 }).catch(e => { throw new Error(`${name} ${w}px ${r}: application not ready; ${errs.join('; ')}; ${e.message}`); });
        // A picture may switch sources during application startup. Give the
        // final visible image time to load, then still fail on broken images.
        const imagesReady = await page.waitForFunction(() => [...document.images].every(image => {
          const box = image.getBoundingClientRect();
          const visible = box.width && box.height && box.bottom > 0 && box.top < innerHeight
            && box.right > 0 && box.left < innerWidth && getComputedStyle(image).visibility !== 'hidden';
          return !visible || !image.getAttribute('src') || (image.complete && image.naturalWidth > 0);
        }), null, { timeout: 8000 }).then(() => true, error => {
          if (error.name !== 'TimeoutError') throw error;
          return false;
        });
        const m = await page.evaluate(() => ({
          over: document.documentElement.scrollWidth - innerWidth,
          broken: [...document.images].filter(i => i.complete && i.currentSrc && i.naturalWidth === 0).map(i => i.currentSrc.slice(-60)),
          h1: (document.querySelector('h1') || {}).textContent || '',
          // the empty-photo placeholder (a data: SVG) where a real photo should be
          nophoto: [...document.images].filter(i => i.src.startsWith('data:image/svg+xml;base64,PHN2Zy')).map(i => i.alt).slice(0, 3),
        }));
        const where = `${name} ${w}px ${r.replace(/\?r=\d+/, '')}`;
        if (m.over > 1) fail(`${where}: ${m.over}px sideways scroll`);
        if (!imagesReady && !m.broken.length) fail(`${where}: visible images did not finish loading`);
        if (m.broken.length) fail(`${where}: broken image(s) ${m.broken.join(', ')}`);
        if (m.nophoto.length && /#\/(c|p)\//.test(r)) fail(`${where}: placeholder instead of a photo: ${m.nophoto.join(', ')}`);
        for (const e of errs) fail(`${where}: ${e}`);
        if (r.endsWith('does-not-exist') && !m.h1.trim()) fail(`${where}: the not-found page has no heading`);
        await page.close();
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
