// Focused bugs: canonical brand filters, restored appliance thresholds and keyboard suggestions.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,firefox,webkit} from 'playwright';
const base=process.env.INTERACTION_BASE||'http://127.0.0.1:8774';
const server=process.env.INTERACTION_BASE?null:spawn(process.execPath,['serve.mjs','8774'],{stdio:'ignore'});
if(server)await new Promise(resolve=>setTimeout(resolve,700));
const engines=(process.env.INTERACTION_ENGINES||'chromium').split(',');let checks=0;const failures=[];
try { for(const name of engines){const browser=await({chromium,firefox,webkit})[name].launch(name==='chromium'&&process.env.TEST_CHROMIUM_EXECUTABLE?{executablePath:process.env.TEST_CHROMIUM_EXECUTABLE}:{});
try{for(const width of [390,1440])for(const lang of ['en','ru','hy'])for(const scenario of ['brands','keyboard','saved-filter','home-reset','legacy-reset','focus-ring']){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 if(scenario==='saved-filter')await ctx.addInitScript(()=>localStorage.setItem('better.v2',JSON.stringify({cat:'largeappliance',apower:'invalid',avol:-1,aload:'Infinity',abtu:'abc',asets:'abc',chg:'abc',pmin:0,pmax:1e9,bounds:[0,1e9]})));
 if(scenario==='home-reset')await ctx.addInitScript(()=>localStorage.setItem('better.v2',JSON.stringify({cat:'largeappliance',apower:1000,shops:['eldorado'],cmp:['honor-x8d'],pmin:0,pmax:1e9,bounds:[0,1e9]})));
 if(scenario==='legacy-reset')await ctx.addInitScript(()=>localStorage.setItem('better.v2',JSON.stringify({cat:'laptop',scrmin:17,pmin:0,pmax:1e9,bounds:[0,1e9]})));
 if(scenario==='brands')await ctx.addInitScript(()=>localStorage.setItem('better.v2',JSON.stringify({cat:'laptop',brands:['Asus'],pmin:0,pmax:1e9,bounds:[0,1e9]})));
 ctx.setDefaultTimeout(10000);
 await ctx.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'}));
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{await p.goto(base+(lang==='hy'?'/':`/${lang}/`)+(['saved-filter','home-reset'].includes(scenario)?'#/c/largeappliance':['brands','legacy-reset'].includes(scenario)?'#/c/laptop':''),{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
 if(scenario==='brands'){
  if(width<801)await p.locator('[data-bx-mobile-category]').click();
  const labels=await p.locator('.bx-filter-form [data-bx-set="brand"] input').evaluateAll(es=>es.map(e=>e.value));
  assert.deepEqual(labels.filter(v=>v.toLowerCase()==='asus'),['ASUS'],'one ASUS brand choice');
  assert.equal(await p.locator('.bx-filter-form [data-bx-set="brand"] input[value="ASUS"]').isChecked(),true,'legacy Asus selection preserved');
  assert.ok(await p.locator('.pcard').count(),'legacy brand preference still produces results');checks+=3;
 }else if(scenario==='saved-filter'){
  assert.ok(await p.locator('.pcard').count(),'invalid restored appliance numbers must not empty catalogue');
  assert.ok(!/NaN/.test(await p.locator('#main').innerText()),'no NaN filter labels');checks+=2;
 }else if(scenario==='home-reset'){
  await p.locator('.logo').click();await p.waitForURL(/#\/$/);
  const state=await p.evaluate(()=>JSON.parse(localStorage.getItem('better.v2')));
  assert.deepEqual(state.shops,[],'Home clears shop filter');assert.equal(state.apower,0,'Home clears appliance thresholds');assert.deepEqual(state.cmp,['honor-x8d'],'Home preserves comparison');checks+=3;
 }else if(scenario==='legacy-reset'){
  if(width<801)await p.locator('[data-bx-mobile-category]').click();
  await p.locator('.bx-filter-form [data-rm="all"]').click();
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('better.v2')).scrmin),0,'Reset clears legacy screen threshold');checks++;
 }else if(scenario==='focus-ring'){
  const q=p.locator('#q');await q.press('Shift+Tab');await p.keyboard.press('Tab');
  const ring=await q.evaluate(el=>({style:getComputedStyle(el).outlineStyle,width:parseFloat(getComputedStyle(el).outlineWidth)}));
  assert.notEqual(ring.style,'none','keyboard search focus has an actual outline');assert.ok(ring.width>=2,'focus outline is visible');checks+=2;
  const langs=await p.locator('#langs a[data-lang]').count();assert.equal(langs,3,'language choices are crawlable anchors');checks++;
 }else{
  const q=p.locator('#q');await q.fill('honor x8d');await p.locator('#sugg').waitFor({state:'visible'});await q.press('ArrowDown');
  const active=await q.getAttribute('aria-activedescendant');assert.ok(active,'ArrowDown activates a suggestion');
  assert.equal(await p.locator('#'+active).getAttribute('aria-selected'),'true');
  await q.press('Enter');await p.waitForURL(/#\/p\/honor-x8d$/);await p.waitForSelector('#hpShot');checks+=3;
  await q.fill('iphone');await p.locator('#sugg').waitFor({state:'visible'});await q.press('ArrowUp');assert.ok(await q.getAttribute('aria-activedescendant'));
  await q.press('Escape');assert.equal(await q.getAttribute('aria-expanded'),'false');assert.equal(await q.getAttribute('aria-activedescendant'),null);checks+=3;assert.equal(await q.inputValue(),'iphone','Escape dismisses suggestions without erasing the query');checks++;
  await q.press('Enter');await p.waitForURL(/#\/search$/);checks++;await p.waitForFunction(()=>document.querySelector('#results h1')?.textContent.trim()==='iphone');
  await q.fill('honor x8d');await p.locator('#sugg').waitFor({state:'visible'});await q.press('ArrowDown');
  await q.fill('samsung');await q.press('Enter');await p.waitForURL(/#\/search$/);assert.equal(await q.inputValue(),'samsung','edited query cannot open an old active suggestion');checks++;

 }
 assert.deepEqual(errors,[]);checks++;
 }catch(e){failures.push(`${name}/${width}/${lang}/${scenario}: ${e.message}`);console.error(failures.at(-1));}finally{await ctx.close();}
}}finally{await browser.close();}}
} finally {server?.kill();}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`INTERACTION_REGRESSIONS_PASS: ${checks} checks`);
