// Real startup, deferred global data, races and retry across browser engines.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,firefox,webkit} from 'playwright';
const port=8768,base=process.env.PRODUCT_STARTUP_BASE||`http://127.0.0.1:${port}`;
const server=process.env.PRODUCT_STARTUP_BASE?null:spawn(process.execPath,['serve.mjs',String(port)],{stdio:'ignore'});
if(server)await new Promise(r=>setTimeout(r,700));
let checks=0;
try{for(const engine of (process.env.PRODUCT_STARTUP_ENGINES||'chromium,webkit').split(',')){
 const browser=await({chromium,firefox,webkit})[engine].launch();
 try{for(const scenario of ['search','route-race','search-retry','route-retry','escape','escape-error','contradictory','ru','hy']){
  const ctx=await browser.newContext({viewport:{width:scenario==='search'?1440:390,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.addInitScript(()=>{Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});localStorage.setItem('better.v2',JSON.stringify({cat:'laptop',brands:['Acer'],cmp:['honor-x8c','acer-aspire-15'],pmin:25000,pmax:750000,bounds:[10000,1000000]}))});
  const p=await ctx.newPage(),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));p.setDefaultTimeout(15000);
  let held,arrived;const pending=new Promise(r=>arrived=r);let attempts=0;
  await p.route('**/data/startup/catalogue.*.js*',async route=>{attempts++;if(attempts===1){held=route;arrived();}else await route.continue()});
  try{
   const lang=['ru','hy'].includes(scenario)?scenario:'en',prefix=lang==='hy'?'':`/${lang}`;
   await p.goto(`${base}${prefix}/p/honor-x8c/${scenario==='contradictory'?'#/p/apple-airpods-pro-3':''}`,{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
   if(scenario==='contradictory'){
    assert.equal(await p.evaluate(()=>!!window.betterCatalogueState),false);assert.ok(requests.some(u=>/site-products\./.test(u)));assert.match(await p.locator('h1').innerText(),/AirPods/i);checks+=3;
   }else{
    assert.equal(await p.evaluate(()=>window.betterCatalogueState.ready),false);assert.ok(!requests.some(u=>/site-products\.|site-prices\./.test(u)),'no full listing files before intent');assert.equal(attempts,0);
    const state=await p.evaluate(()=>JSON.parse(localStorage.getItem('better.v2')));assert.equal(state.pmin,25000);assert.equal(state.pmax,750000);assert.deepEqual(state.cmp,['honor-x8c','acer-aspire-15']);checks+=6;
    const colors=p.locator('[data-color]:not(:disabled)');if(await colors.count()>1){const second=colors.nth(1);await second.click();assert.equal(attempts,0,'product color works before global data');checks++}
    if(scenario==='escape'||scenario==='escape-error'){
     const q=p.locator('#q');await q.fill('acer');await pending;await p.waitForTimeout(180);await q.press('Escape');assert.equal(await q.getAttribute('aria-expanded'),'false');
     if(scenario==='escape-error')await held.abort();else await held.continue();held=null;await p.waitForFunction(()=>window.betterCatalogueState.request===null);
     assert.equal(await p.locator('#sugg').evaluate(e=>e.hidden),true,'dismissed search must stay closed after delayed success/failure');assert.equal(await q.getAttribute('aria-expanded'),'false');checks+=3;
    }else if(scenario==='search'||scenario==='search-retry'){
     const q=p.locator('#q');await q.fill('acer');await pending;await q.fill('lenovo');await p.waitForTimeout(180);
     assert.equal(await p.locator('.sg-none').count(),0,'no false empty suggestions with partial records');assert.equal(attempts,1,'one shared global request');checks+=2;
     if(scenario==='search-retry'){await held.abort();await p.locator('[data-catalogue-search-retry]').waitFor({state:'visible'});await p.locator('[data-catalogue-search-retry]').click();}
     else await held.continue();held=null;
     await p.waitForFunction(()=>window.betterCatalogueState.ready);await p.locator('.sg-i').first().waitFor({state:'visible'});
     assert.match(await p.locator('.sg-i').first().innerText(),/Lenovo/i);await q.press('ArrowDown');assert.ok(await q.getAttribute('aria-activedescendant'));checks+=2;
     await q.press('Enter');await p.waitForURL(/#\/p\/lenovo-/);await p.waitForFunction(()=>/Lenovo/i.test(document.querySelector('h1')?.textContent));checks++;
    }else if(scenario==='route-race'||scenario==='route-retry'){
     await p.evaluate(()=>location.hash='#/');await pending;
     if(scenario==='route-retry'){
      await held.abort();held=null;await p.locator('[data-detail-retry]').click();await p.waitForFunction(()=>window.betterCatalogueState.ready);await p.waitForSelector('.pcard');assert.equal(attempts,2);checks++;
     }else{
      await p.evaluate(()=>location.hash='#main');await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>document.documentElement.classList.contains('route-pending')),false,'back to local anchor clears pending UI');
      await held.continue();held=null;await p.waitForFunction(()=>window.betterCatalogueState.ready);await p.waitForTimeout(100);assert.match(await p.locator('h1').innerText(),/Honor.*X8c/i);assert.equal(await p.locator('#results').count(),0,'stale global request cannot replace current product');checks+=3;
      await p.evaluate(()=>location.hash='#/c/laptop');await p.waitForSelector('.pcard');assert.ok(await p.locator('.pcard').count());checks++;
     }
    }else{
     assert.ok(await p.locator('#hpShot').isVisible());const body=await p.locator('body').evaluate(e=>({scroll:e.scrollWidth,view:innerWidth}));assert.ok(body.scroll<=body.view+1,'no horizontal overflow');checks+=2;
    }
   }
   assert.deepEqual(errors,[]);checks++;console.log(`${engine}/${scenario}: OK`);
  }finally{if(held)await held.abort().catch(()=>{});await ctx.close()}
 }}finally{await browser.close()}
}console.log(`PRODUCT_STARTUP_BROWSER_PASS: ${checks} checks`)}finally{server?.kill()}
