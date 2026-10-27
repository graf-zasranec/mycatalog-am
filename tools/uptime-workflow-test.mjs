// Exercise the actual Bash workflow against working and broken response fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const source=fs.readFileSync('.github/workflows/uptime.yml','utf8');
const script=source.split('        run: |\n')[1].split('\n').map(line=>line.replace(/^          /,'')).join('\n');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'better-uptime-'));
const mock=`curl() {
 case "\${@: -1}" in
  https://better.am/) cat "$FIXTURE_HOME" ;;
  https://better.am/data/*) test "\${@: -1}" = "https://better.am/$PRICE_ASSET" && test "$FAIL_PART" != price ;;
  https://better.am/p/apple-iphone-17/) if [ "$FAIL_PART" = product ]; then printf 'Missing'; else printf 'Better.am'; fi ;;
  *) return 22 ;;
 esac
}\n`;
const run=(html,priceAsset,failPart='')=>{
 const file=path.join(dir,'home.html');fs.writeFileSync(file,html);
 return spawnSync('bash',['-e','-o','pipefail'],{input:mock+script,encoding:'utf8',env:{...process.env,FIXTURE_HOME:file,PRICE_ASSET:priceAsset,FAIL_PART:failPart}});
};
try{
 const current=fs.readFileSync('index.html','utf8');
 const hashed=current.match(/data\/site-prices\.[a-f0-9]+\.js/)[0];
 let r=run(current,hashed);assert.equal(r.status,0,r.stdout+r.stderr);
 r=run('<script src="data/site-prices.js"></script>','data/site-prices.js');assert.equal(r.status,0,r.stdout+r.stderr);
 assert.notEqual(run('<h1>Unrelated site</h1>',hashed).status,0,'wrong homepage must fail');
 assert.notEqual(run(current,hashed,'price').status,0,'missing current price asset must fail');
 assert.notEqual(run(current,hashed,'product').status,0,'missing product content must fail');
 console.log('UPTIME_WORKFLOW_PASS: current hashed and legacy assets; wrong page, missing prices and missing product rejected');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
