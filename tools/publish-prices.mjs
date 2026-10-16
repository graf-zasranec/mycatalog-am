// Publish what the local refresh read (owner, 2026-10-16). AllSell answers GitHub's servers 403 and
// iStore returns nothing there, so the nightly cloud run only ever "kept" their old offers. This PC
// reads them fine. This commits ONLY the price data onto origin/main - built in a temporary index,
// so the checked-out branch (often someone's work in progress) is never touched or pushed. No
// generated pages: the next cloud refresh rebuilds the site from main's own code.
//   node tools/publish-prices.mjs          (refresh.cmd runs it after a successful local refresh)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Only files a scrape rewrites whole; history and hand rows can carry newer edits on main.
const FILES = ['data/prices.json', 'data/soldout.json',
  'data/zigzag.json', 'data/eldorado.json', 'data/eldorado-refresh-report.json'].filter(f => fs.existsSync(f));
const index = path.join(os.tmpdir(), `better-publish-${process.pid}.index`);
const git = (args, env = {}) => execFileSync('git', args, { encoding: 'utf8', env: { ...process.env, ...env } }).trim();
const day = new Date().toISOString().slice(0, 10);
try {
  for (let attempt = 1; attempt <= 3; attempt++) {
    git(['fetch', '-q', 'origin', 'main']);
    const base = git(['rev-parse', 'origin/main']);
    const env = { GIT_INDEX_FILE: index };
    git(['read-tree', base], env);
    git(['add', '--', ...FILES], env);
    const tree = git(['write-tree'], env);
    if (tree === git(['rev-parse', base + '^{tree}'])) { console.log('publish-prices: main already has these prices'); process.exit(0); }
    const commit = git(['commit-tree', tree, '-p', base, '-m', `prices (local PC): ${day}\n\nAllSell and iStore read from the owner's PC; GitHub's servers are blocked by them.`]);
    try { git(['push', '-q', 'origin', commit + ':refs/heads/main']); console.log('publish-prices: pushed ' + commit.slice(0, 10)); process.exit(0); }
    catch { console.log(`publish-prices: main moved, retry ${attempt}`); }
  }
  process.exit(1);
} finally { fs.rmSync(index, { force: true }); }
