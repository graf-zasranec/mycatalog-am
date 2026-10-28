import fs from'node:fs';import assert from'node:assert/strict';import {execFileSync}from'node:child_process';
let harness=fs.readFileSync('tools/app-test.mjs','utf8').split('let bad = 0, n = 0;')[0].replace("from './analytics.mjs'",'from '+JSON.stringify(new URL('./analytics.mjs',import.meta.url).href)).replace('PMIN, PMAX };','setBounds,render,paintSuggest,D,get PMIN(){return PMIN},get PMAX(){return PMAX} };');
if(process.argv.includes('--baseline'))harness=harness.replace("const whole = rd('_app.js');",'const whole='+JSON.stringify(execFileSync('git',['show','HEAD:_app.js'],{encoding:'utf8'}))+';');
const checks=`
let complete;let calls=0;
stub.window.betterCatalogueState={ready:false,load:()=>{calls++;return new Promise(resolve=>{complete=()=>{stub.window.betterCatalogueState.ready=true;resolve()}})}};
app.st={...app.D,cat:'laptop',bounds:[10000,1000000],pmin:25000,pmax:750000,brands:['Acer'],cmp:['honor-x8c']};
app.setBounds();
assert.deepEqual(app.st.bounds,[10000,1000000],'partial startup must not reset saved bounds from incomplete offers');
assert.equal(app.st.pmin,25000);assert.equal(app.st.pmax,750000);assert.deepEqual(app.st.cmp,['honor-x8c']);
app.st.q='';app.paintSuggest();assert.equal(calls,0,'cleared search never waits for global data or shows a retry');
console.log('PRODUCT_ROUTING_PASS: partial startup preserves saved catalogue choices');`;
await import('data:text/javascript;base64,'+Buffer.from("import assert from 'node:assert/strict';\n"+harness+checks).toString('base64'));
