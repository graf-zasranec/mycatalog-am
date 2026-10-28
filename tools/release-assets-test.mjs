import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
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
  fs.appendFileSync(path.join(root,'data/site-products.123abc.js'),'const DETAIL_DATA_URL="data/product-extras.json?v=proof";');
  assert.throws(()=>releaseAssets(root),/ENOENT/,'missing fallback JSON must fail too');
  fs.writeFileSync(path.join(root,'data/product-extras.json'),'{}');
  assert.equal(releaseAssets(root).length,4);
  fs.writeFileSync(path.join(root,'data/startup-manifest.json'),JSON.stringify({catalogue:'data/startup/catalogue.aaaaaaaaaa.js?v=aaaaaaaaaa',categories:{phone:'data/startup/category-phone.bbbbbbbbbb.js?v=bbbbbbbbbb'}}));
  assert.throws(()=>releaseAssets(root),/ENOENT/,'new product seeds and global intent payload cannot be omitted');
  fs.mkdirSync(path.join(root,'data/startup'));
  fs.writeFileSync(path.join(root,'data/startup/catalogue.aaaaaaaaaa.js'),'global'.repeat(250000));fs.writeFileSync(path.join(root,'data/startup/category-phone.bbbbbbbbbb.js'),'seed');
  assert.equal(releaseAssets(root).length,7);
  assert.throws(()=>releaseAssets(root,{staged:true}), /not staged/);
  // Run both real nightly/rebase staging commands in a disposable Git index.
  // Price changes write new hashes and fallback JSON, so stale staged versions fail.
  const staging=fs.readFileSync('.github/workflows/deploy.yml','utf8').split('\n').map(s=>s.trim()).filter(s=>s.startsWith('git add '));
  assert.equal(staging.length,2);
  execFileSync('git',['init','--quiet'],{cwd:root});
  for(const command of staging){
    const args=command.slice(8).match(/'[^']+'|\S+/g).map(token=>token.replace(/^'|'$/g,''));
    for(const token of args){
      const file=token.replaceAll('*','fixture');
      const full=path.join(root,file);
      if(fs.existsSync(full))continue;
      if(!path.extname(file)){fs.mkdirSync(full,{recursive:true});fs.writeFileSync(path.join(full,'fixture.txt'),'fixture');}
      else{fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,'fixture');}
    }
    execFileSync('git',['read-tree','--empty'],{cwd:root});
    execFileSync('git',['add',...args],{cwd:root});
    assert.equal(releaseAssets(root,{staged:true}).length,7,'each nightly/rebase command stages every current payload');
  }
  console.log('RELEASE_ASSETS_TEST_PASS: omitted index/detail assets and unstaged files rejected');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
