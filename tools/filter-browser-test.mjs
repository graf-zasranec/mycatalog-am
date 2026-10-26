// Exercise the visible form, including category drafts, instead of the hidden legacy toolbar.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const port=8770,base=process.env.FILTER_BASE||`http://127.0.0.1:${port}`;
const catalogue=new Map(JSON.parse(fs.readFileSync('data/phones.json','utf8')).map(p=>[p.id,p]));
const server=process.env.FILTER_BASE?null:spawn(process.execPath,['serve.mjs',String(port)],{stdio:'ignore'});
if(server)await new Promise(r=>setTimeout(r,700));
let checks=0;
try{
for(const engine of (process.env.FILTER_ENGINES||'chromium,webkit').split(',')){
 const browser=await ({chromium,webkit})[engine].launch();
 try{for(const width of [390,1440])for(const lang of ['en','ru','hy']){
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',hasTouch:width<800});
  await ctx.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'}));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+(lang==='hy'?'/':`/${lang}/`));
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
  const form=page.locator('.bx-filter-form');
  if(width<800)await page.locator('[data-bx-mobile-category]').click();
  const cards=await page.locator('.pcard').evaluateAll(els=>els.map(e=>e.dataset.id));
  await form.locator('.bx-category-choice:has(input[value="headphones"])').click();
  assert.equal(await form.locator('[data-bx-set="brand"] input[value="Dell"]').count(),0,'category draft removes unrelated brands');checks++;
  assert.ok(await form.locator('[data-bx-set="hform"]').count(),'headphone type appears before Apply');checks++;
  assert.deepEqual(await page.locator('.pcard').evaluateAll(els=>els.map(e=>e.dataset.id)),cards,'draft leaves results unchanged');checks++;
  await form.locator('[data-bx-set="brand"] input[value="Apple"]').check();
  await form.locator('[data-bx-budget="100000"]').click();
  await form.locator(width<800?'.bx-apply':'.bx-filter-quick').click();
  await page.waitForURL(/#\/c\/headphones$/);
  await page.waitForFunction(()=>JSON.parse(document.querySelector('.bx-filter-sidebar').dataset.signature)[1]==='headphones');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('better.v2'))?.cat==='headphones');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('better.v2')));
  assert.equal(state.pmax,100000);assert.deepEqual(state.brands,['Apple']);checks+=2;
  const ids=await page.locator('.pcard').evaluateAll(els=>els.map(e=>e.dataset.id));
  assert.ok(ids.length&&ids.every(id=>catalogue.get(id)?.category==='headphones'&&catalogue.get(id)?.brand==='Apple'),'category, brand and budget applied together');checks++;
  if(width<800){assert.equal(await page.locator('html.fs-open').count(),0);await page.locator('[data-bx-mobile-category]').click();checks++;}
  await form.locator('[data-rm="all"]').click();
  await form.locator('.bx-category-choice:has(input[value="laptop"])').click();
  assert.ok(await form.locator('[data-bx-set="cpu"]').count(),'laptop CPU appears in draft');checks++;
  await form.locator('[data-bx-max]').fill('1000000');
  await form.locator('[data-bx-min]').fill('1200000');
  await form.locator(width<800?'.bx-apply':'.bx-filter-quick').click();
  assert.ok(await form.locator('[data-bx-max]').evaluate(el=>!el.validity.valid),'reversed range blocks Apply');checks++;
  await form.locator('[data-bx-min]').fill('');
  await form.locator(width<800?'.bx-apply':'.bx-filter-quick').click();
  await page.waitForURL(/#\/c\/laptop$/);
  await page.waitForFunction(()=>JSON.parse(document.querySelector('.bx-filter-sidebar').dataset.signature)[1]==='laptop');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('better.v2')).pmax),1000000);checks++;
  if(width<800){await page.locator('[data-bx-mobile-category]').click();await form.locator('.bx-category-choice:has(input[value="phone"])').click();await page.keyboard.press('Escape');await page.locator('[data-bx-mobile-category]').click();assert.equal(await form.locator('[data-bx-category]:checked').inputValue(),'laptop','closing discards category draft');checks++;await page.keyboard.press('Escape');}
  assert.deepEqual(errors,[],`${engine}/${width}/${lang}: no runtime errors`);checks++;
  await ctx.close();console.log(`${engine} ${width}px ${lang}: filters OK`);
 }}finally{await browser.close()}
}
console.log(`FILTER_BROWSER_PASS: ${checks} checks`);
}finally{server?.kill()}
