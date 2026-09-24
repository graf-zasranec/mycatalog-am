// Renders the PNG sizes of the brand kit from the SVGs tools/brand.py writes.
//
//   node tools/brand-png.mjs            (then: python tools/brand-ico.py for favicon.ico)
//
// Each SVG is drawn by a real browser at the exact pixel size, with a transparent ground where the
// SVG has none, so the PNGs are the same shapes as the vectors - nothing is traced or resampled.
import { createRequire } from 'module';
import { readFileSync, readdirSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BRAND = join(dirname(fileURLToPath(import.meta.url)), '..', 'brand');

// [svg, [widths...]] - the height follows the SVG's own proportions
const JOBS = [
  ...readdirSync(join(BRAND, 'logo')).filter(f => f.startsWith('better-wordmark')).map(f => ['logo/' + f, [512, 1024, 2048]]),
  ['logo/better-mark.svg', [256, 512, 1024]],
  ['logo/better-mark-on-dark.svg', [256, 512, 1024]],
  ['icon/better-app-icon.svg', [512, 1024]],
  ['icon/better-app-icon-brick.svg', [512, 1024]],
  ['icon/better-app-icon-square.svg', [180, 192, 512, 1024]],
  ['icon/favicon.svg', [16, 32, 48, 64, 96]],
  ['social/share-1200x630.svg', [1200]],
  ['social/share-1200x630-dark.svg', [1200]],
  ['social/cover-1500x500.svg', [1500]],
  ['social/cover-1500x500-dark.svg', [1500]],
];
const NAMED = {  // the names platforms look for
  'icon/better-app-icon-square.svg@180': 'icon/apple-touch-icon.png',
  'icon/better-app-icon-square.svg@192': 'icon/android-chrome-192.png',
  'icon/better-app-icon-square.svg@512': 'icon/android-chrome-512.png',
};

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
const page = await browser.newPage();
for (const [rel, widths] of JOBS) {
  const svg = readFileSync(join(BRAND, rel), 'utf8');
  const [, , , vw, vh] = svg.match(/viewBox="(\S+) (\S+) (\S+) (\S+)"/).map(Number);
  for (const w of widths) {
    const h = Math.round(w * vh / vw);
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<style>*{margin:0}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`);
    const out = NAMED[`${rel}@${w}`] || `png/${rel.replace(/\.svg$/, '')}-${w}.png`;
    mkdirSync(dirname(join(BRAND, out)), { recursive: true });
    await page.screenshot({ path: join(BRAND, out), omitBackground: true });
    console.log('wrote', out, `${w}x${h}`);
  }
}
await browser.close();
