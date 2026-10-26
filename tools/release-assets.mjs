// A built page must never publish a reference to an omitted fingerprinted bundle.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function releaseAssets(root, {staged = false} = {}) {
  const assets = new Set();
  for (const page of ['index.html', 'en/index.html', 'ru/index.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    for (const match of html.matchAll(/(?:src|href|data-src)="([^"]+)"/g)) {
      for (const ref of match[1].split(/\s+/)) {
        const file = ref.replace(/^\//, '').split('?')[0];
        if (/^data\/[\w./-]+\.(?:js|css)$/.test(file)) assets.add(file);
      }
    }
  }
  if (!assets.size) throw new Error('No release assets found');
  for (const file of [...assets]) {
    if (!/site-products\.[a-f0-9]+\.js$/.test(file)) continue;
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of text.matchAll(/data\/details\/chunk-\d+\.[a-f0-9]+\.js/g)) assets.add(m[0]);
  }
  for (const file of assets) {
    const built = fs.readFileSync(path.join(root, file));
    if (staged) {
      let published;
      try { published = execFileSync('git', ['show', ':' + file], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']}); }
      catch { throw new Error('Release asset is not staged: ' + file); }
      if (!built.equals(published)) throw new Error('Staged release asset differs from built asset: ' + file);
    }
  }
  return [...assets];
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const assets = releaseAssets(process.cwd(), {staged: process.argv.includes('--staged')});
  console.log('RELEASE_ASSETS_PASS:', assets.length, 'referenced bundles' + (process.argv.includes('--staged') ? ' staged' : ' exist'));
}
