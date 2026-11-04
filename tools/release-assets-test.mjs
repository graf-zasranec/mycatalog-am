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
  // Run real generated-asset staging command in a disposable Git index.
  // Price changes write new hashes and fallback JSON, so stale staged versions fail.
  const staging=fs.readFileSync('.github/workflows/deploy.yml','utf8').split('\n').map(s=>s.trim()).filter(s=>s.startsWith("git add 'data/site-*.js'"));
  assert.equal(staging.length,1);
  fs.writeFileSync(path.join(root,'data/photo-native-metrics.json'),'{"native":"sha-bound measurements"}');
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
    assert.equal(releaseAssets(root,{staged:true}).length,7,'the publication command stages every current payload');
    assert.equal(execFileSync('git',['show',':data/photo-native-metrics.json'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}),'{"native":"sha-bound measurements"}','publication preserves native measurements instead of resetting all photos to unmeasured');
  }
  console.log('RELEASE_ASSETS_TEST_PASS: omitted index/detail assets and unstaged files rejected');
} finally { fs.rmSync(root,{recursive:true,force:true}); }

// A completed crawl can fail while committing; its data must still be recoverable.
const workflow=fs.readFileSync('.github/workflows/deploy.yml','utf8');
assert.match(workflow, /source_commit=\$\(git rev-parse HEAD\)/, 'save a source-only commit before staging generated pages');
assert.match(workflow, /git reset --keep "\$source_commit"\s+git rebase -X ours origin\/main/, 'drop the generated commit before replaying source changes');
const checkpoint=workflow.indexOf('- name: Save interrupted refresh checkpoint');
assert.ok(checkpoint>workflow.indexOf('- name: Commit refreshed prices and history'),'save checkpoint after the commit step so publication failures are captured');
assert.match(workflow.slice(checkpoint),/if:.*always\(\).*failure\(\)/,'a successful crawl followed by failed publication must save a checkpoint');
assert.ok(workflow.indexOf('run: node tools/release-assets-test.mjs')<workflow.indexOf('- name: Refresh caches, hand rows, shop prices and build'),'exercise actual staging commands before the expensive crawl');
console.log('REFRESH_PUBLICATION_RECOVERY_PASS: fail-fast staging preflight and post-publication failure checkpoint');

// Replay the workflow against a real non-fast-forward push. The builder fixture
// makes it observable whether the generated HTML came from the merged inputs.
if (process.platform !== 'win32') {
const raceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'better-publish-race-'));
try {
  const remote = path.join(raceRoot,'remote.git');
  const crawl = path.join(raceRoot,'crawl');
  const owner = path.join(raceRoot,'owner');
  const git = (cwd,...args) => execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const put = (dir,file,value) => {
    const target = path.join(dir,file);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,value);
  };
  const commit = (dir,message) => {
    git(dir,'add','-A');
    git(dir,'-c','user.name=Test','-c','user.email=test@example.com','commit','-m',message);
  };
  const publish = workflow.split('- name: Commit refreshed prices and history')[1]
    .split('- name: Save interrupted refresh checkpoint')[0].split('run: |\n')[1];
  git(raceRoot,'init','--bare','-b','main',remote);
  git(raceRoot,'clone',remote,crawl);
  for (const line of publish.split('\n').map(l=>l.trim()).filter(l=>l.startsWith('git add '))) {
    for (const token of line.slice(8).match(/'[^']+'|\S+/g)) {
      const name = token.replace(/^'|'$/g,'').replaceAll('*','fixture');
      put(crawl,path.extname(name) ? name : name+'/index.html','base\n');
    }
  }
  put(crawl,'tools/release-assets.mjs','');
  for (const producer of ['photo-box','thumbnails','social']) {
    put(crawl,`tools/${producer}.py`,`from pathlib import Path\nPath('images/thumb/${producer}.txt').write_text('rebuilt')\n`);
  }
  put(crawl,'build.mjs',`import fs from 'node:fs'; fs.writeFileSync('index.html',fs.readFileSync('data/prices.json','utf8')+fs.readFileSync('data/phones.json','utf8'));`);
  commit(crawl,'initial files');
  git(crawl,'push','-u','origin','main');
  git(raceRoot,'clone',remote,owner);
  put(owner,'data/phones.json','owner catalogue edit\n');
  put(owner,'c/index.html','owner category edit\n');
  commit(owner,'concurrent owner update');
  git(owner,'push');
  put(crawl,'data/prices.json','fresh price\n');
  put(crawl,'index.html','stale generated page\n');
  fs.unlinkSync(path.join(crawl,'c/index.html'));
  execFileSync('bash',['-e','-c',publish],{cwd:crawl,stdio:['ignore','pipe','pipe']});
  assert.equal(fs.readFileSync(path.join(crawl,'index.html'),'utf8'),'fresh price\nowner catalogue edit\n');
  assert.equal(fs.readFileSync(path.join(crawl,'c/index.html'),'utf8'),'owner category edit\n');
  for (const producer of ['photo-box','thumbnails','social']) {
    assert.equal(fs.readFileSync(path.join(crawl,`images/thumb/${producer}.txt`),'utf8'),'rebuilt');
  }
  assert.equal(git(crawl,'rev-parse','HEAD'),git(crawl,'ls-remote','origin','refs/heads/main').split(/\s/)[0]);
  console.log('PUBLISH_RACE_PASS: fresh data and concurrent owner edits preserved, generated pages rebuilt');
  git(owner,'pull','--ff-only');
  put(owner,'data/prices.json','owner verified prices\n');
  commit(owner,'concurrent verified price update');
  git(owner,'push');
  put(crawl,'data/prices.json','second crawl prices\n');
  assert.throws(() => execFileSync('bash',['-e','-c',publish],{cwd:crawl,stdio:['ignore','pipe','pipe']}),
    error => String(error.stderr).includes('Concurrent catalogue source update: data/prices.json'));
  assert.equal(git(owner,'show','HEAD:data/prices.json'),'owner verified prices');
  assert.equal(git(crawl,'ls-remote','origin','refs/heads/main').split(/\s/)[0],git(owner,'rev-parse','HEAD'));
  console.log('PRICE_REPLAY_GUARD_PASS: preserve the verified upstream snapshot on an overlapping refresh');

} finally {
  fs.rmSync(raceRoot,{recursive:true,force:true});
}
}
