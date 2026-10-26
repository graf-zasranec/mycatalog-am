import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {releaseAssets} from './release-assets.mjs';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'better-assets-'));
try {
  for (const d of ['en','ru','data/details']) fs.mkdirSync(path.join(root,d),{recursive:true});
  for (const f of ['index.html','en/index.html','ru/index.html']) fs.writeFileSync(path.join(root,f),'<script data-src="data/site-products.123abc.js?v=123abc data/site-app.abc123.js"></script>');
  assert.throws(()=>releaseAssets(root), /ENOENT/);
  fs.writeFileSync(path.join(root,'data/site-products.123abc.js'),'const chunks=["data/details/chunk-1.123abc.js?v=123abc"];');
  fs.writeFileSync(path.join(root,'data/site-app.abc123.js'),'app');
  assert.throws(()=>releaseAssets(root), /ENOENT/, 'missing lazy detail bundle must fail too');
  fs.writeFileSync(path.join(root,'data/details/chunk-1.123abc.js'),'detail');
  assert.equal(releaseAssets(root).length,3);
  assert.throws(()=>releaseAssets(root,{staged:true}), /not staged/);
  console.log('RELEASE_ASSETS_TEST_PASS: omitted index/detail assets and unstaged files rejected');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
