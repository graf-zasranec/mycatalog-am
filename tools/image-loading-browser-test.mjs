// Check real photo requests, scroll/focus loading, and a JavaScript-free fallback.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,firefox,webkit} from 'playwright';
const port=8771,base=process.env.IMAGE_BASE||`http://127.0.0.1:${port}`;
const server=process.env.IMAGE_BASE?null:spawn(process.execPath,['serve.mjs',String(port)],{stdio:'ignore'});
if(server)await new Promise(r=>setTimeout(r,700));
try{for(const name of (process.env.IMAGE_ENGINES||'chromium,webkit').split(',')){
 const engine={chromium,firefox,webkit}[name],browser=await engine.launch();
 try{for(const width of [390,820,1440]){
  const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
  await ctx.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'}));
  const p=await ctx.newPage(),requests=[];p.on('request',r=>requests.push(r.url()));
  await p.goto(base+'/en/');await p.waitForFunction(()=>document.documentElement.dataset.appReady==='true');await p.waitForTimeout(300);
  const card=p.locator('.pcard').nth(10),id=await card.getAttribute('data-id');
  assert.ok(!requests.some(url=>url.includes('/images/thumb/'+id+'__')),'distant photo does not compete with startup');
  await card.locator('button.fav').focus();
  await card.locator('img.pimg').waitFor({state:'visible'});
  await p.waitForFunction(id=>{const img=document.querySelector(`.pcard[data-id="${id}"] img.pimg`);return img?.complete&&img.naturalWidth>0},id);
  assert.equal(await card.locator('noscript[data-card-photo]').count(),0,'fallback removed when image activates');
  await p.evaluate(()=>location.hash='#/c/laptop');await p.waitForFunction(()=>document.querySelector('[data-bx-category]:checked')?.value==='laptop');
  await p.locator('.pcard').first().locator('.fav').focus();await p.waitForFunction(()=>{const img=document.querySelector('.pcard img.pimg');return img?.complete&&img.naturalWidth>0});
  await ctx.close();
  const nojs=await browser.newContext({viewport:{width,height:844},javaScriptEnabled:false});const q=await nojs.newPage();
  await q.goto(base+'/en/');const fallback=q.locator('.pcard').nth(10).locator('noscript img');
  await fallback.scrollIntoViewIfNeeded();await fallback.evaluate(img=>img.complete&&img.naturalWidth?true:new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject}));
  assert.ok(await fallback.isVisible(),'catalogue photo works without JavaScript');await nojs.close();
  console.log(`${name} ${width}px: deferred, focus, route replacement, no-JS photos OK`);
 }
 // Older or constrained browsers retain normal loading when IntersectionObserver is unavailable.
 const ctx=await browser.newContext();await ctx.addInitScript(()=>{window.IntersectionObserver=undefined;Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'})});const p=await ctx.newPage();
 await p.goto(base+'/en/');await p.waitForFunction(()=>document.documentElement.dataset.appReady==='true');assert.equal(await p.locator('template[data-card-photo]').count(),0);await ctx.close();
 }finally{await browser.close()}
}
console.log('IMAGE_LOADING_PASS');
}finally{server?.kill()}
