// Render the owned vector wordmark icon to stable, crawlable PNG assets.
import fs from 'node:fs';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [96, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${fs.readFileSync('images/favicon.svg', 'utf8')}`);
    await page.screenshot({ path: `images/${size === 96 ? 'favicon-96' : 'brand-icon-512'}.png`, omitBackground: true });
  }
} finally { await browser.close(); }
