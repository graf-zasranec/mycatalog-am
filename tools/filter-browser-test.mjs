// Exercise the visible form, including category drafts, instead of the hidden legacy toolbar.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium,firefox,webkit} from 'playwright';
const port=8770,base=process.env.FILTER_BASE||`http://127.0.0.1:${port}`;
const catalogue=new Map(JSON.parse(fs.readFileSync('data/phones.json','utf8')).map(p=>[p.id,p]));
const server=process.env.FILTER_BASE?null:spawn(process.execPath,['serve.mjs',String(port)],{stdio:'ignore'});
if(server)await new Promise(r=>setTimeout(r,700));
let checks=0;
try{
for(const engine of (process.env.FILTER_ENGINES||'chromium,webkit').split(',')){
 const browser=await ({chromium,firefox,webkit})[engine].launch(engine==='chromium'&&process.env.FILTER_CHROME_PATH?{executablePath:process.env.FILTER_CHROME_PATH}:{});
 try{for(const width of [390,1440])for(const lang of ['en','ru','hy']){
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',hasTouch:width<800});
  await ctx.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'}));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+(lang==='hy'?'/':`/${lang}/`));
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
  const form=page.locator('.bx-filter-form');
  const openSection=async key=>{const section=form.locator(`[data-bx-section="${key}"]`);if(await section.getAttribute('open')===null)await section.locator('summary').click();};
  if(width<800)await page.locator('[data-bx-mobile-category]').click();
  await form.locator('.bx-category-choice:has(input[value="headphones"])').click();
  await page.waitForURL(/#\/c\/headphones$/);
  await page.waitForFunction(()=>document.querySelector('.bx-filter-form [data-bx-set="hform"]'));
  if(width<800)await page.locator('[data-bx-mobile-category]').click();
  assert.equal(await form.locator('[data-bx-category]').count(),0,'category page hides global categories');checks++;
  const ids=await page.locator('.pcard').evaluateAll(es=>es.map(e=>e.dataset.id));
  assert.ok(ids.length&&ids.every(id=>catalogue.get(id)?.category==='headphones'),'category click immediately changes results');checks++;
  await openSection('price');
  await form.locator('[data-bx-max]').fill('1000000');
  await form.locator('[data-bx-min]').fill('1200000');
  await form.locator(width<800?'.bx-apply':'.bx-filter-quick').click();
  assert.ok(await form.locator('[data-bx-max]').evaluate(el=>!el.validity.valid),'reversed price blocks Apply');checks++;
  await page.goto(base+(lang==='hy'?'/':`/${lang}/`));
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
  if(width<800)await page.locator('[data-bx-mobile-category]').click();
  await openSection('shop');
  const cards=await page.locator('.pcard').evaluateAll(es=>es.map(e=>e.dataset.id));
  const shop=form.locator('[data-bx-set="shop"] input').first();const shopValue=await shop.inputValue();await shop.check();
  assert.deepEqual(await page.locator('.pcard').evaluateAll(es=>es.map(e=>e.dataset.id)),cards,'shop remains draft until Apply');checks++;
  await form.locator(width<800?'.bx-apply':'.bx-filter-quick').click();
  await page.waitForFunction(value=>JSON.parse(localStorage.getItem('better.v2'))?.shops?.includes(value),shopValue);checks++;
  assert.deepEqual(errors,[],`${engine}/${width}/${lang}: no runtime errors`);checks++;
  await ctx.close();console.log(`${engine} ${width}px ${lang}: filters OK`);
 }}finally{await browser.close()}
}
console.log(`FILTER_BROWSER_PASS: ${checks} checks`);
}finally{server?.kill()}
