// Which Chromium the browser tests launch. Playwright's own download is not installed on the
// owner's Mac. TEST_CHROMIUM_EXECUTABLE / FILTER_CHROME_PATH win; otherwise the first installed
// Chromium below that can open a page (2026-11-22).
import fs from 'node:fs';
import { chromium } from 'playwright';
const CANDIDATES = [
  // not ego lite: with the owner's ego open, a second headless copy passes a blank page but its
  // tabs crash on the real site (Mach channel taken). Point TEST_CHROMIUM_EXECUTABLE at it when ego is closed.
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
let chosen;
async function works(path) {
  let b;
  try { b = await chromium.launch({ executablePath: path }); const p = await b.newPage(); await p.setContent('<p>ok</p>'); return (await p.textContent('p')) === 'ok'; }
  catch { return false; } finally { await b?.close().catch(() => {}); }
}
export async function launchOptions(engine = 'chromium') {
  if (engine !== 'chromium') return {};
  if (chosen === undefined) {
    chosen = process.env.TEST_CHROMIUM_EXECUTABLE || process.env.FILTER_CHROME_PATH || '';
    if (!chosen) for (const c of CANDIDATES) if (fs.existsSync(c) && await works(c)) { chosen = c; break; }
    if (chosen) console.log('browser tests: ' + chosen.split('/').pop());
  }
  return chosen ? { executablePath: chosen } : {};
}
// WebKit and Firefox come only from Playwright's own download; a run on a machine without it says
// so and tests the engines it has, instead of crashing before any check (CI installs them).
export async function installed(engines) {
  const pw = await import('playwright');
  const ok = [];
  for (const e of engines) {
    if (e === 'chromium' || fs.existsSync(pw[e].executablePath())) ok.push(e);
    else console.log(`browser tests: ${e} not installed here - skipped (npx playwright install ${e})`);
  }
  return ok;
}
