// Exercise actual comparison choices, prices and localized control alignment.
import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.BASE || 'http://127.0.0.1:8814/';
const engines={chromium,firefox,webkit};
const widths=[1366,1024,768,412,375,280];
const out='.codex/reports/ui'; fs.mkdirSync(out,{recursive:true});
let checks=0;
for(const name of (process.env.PW_ENGINES || 'chromium,firefox,webkit').split(',')) {
  const browser=await engines[name].launch({headless:true});
  try {
    for(const lang of ['hy','ru','en'])for(const theme of ['light','dark']) {
      const context=await browser.newContext();
      await context.addInitScript(s=>localStorage.setItem('better.v2',JSON.stringify(s)),{lang,theme,cmp:['apple-macbook-air-13-m5']});
      const page=await context.newPage();
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+'#/compare',{waitUntil:'load'});
      await page.locator('.cmp-options select').first().waitFor();
      for(const width of widths) {
        await page.setViewportSize({width,height:900});
        const geometry=await page.locator('.cmp-options select').evaluateAll(controls=>controls.map(el=>{
          const r=el.getBoundingClientRect();return {y:Math.round(r.top),height:r.height,width:r.width,label:el.getAttribute('aria-label')};
        }));
        assert(geometry.length===4,`${name}/${lang}: all MacBook configuration fields present`);
        assert(geometry.every(r=>r.height>=43.99&&r.width>0&&r.label),`${name}/${lang}/${width}: usable labeled controls`);
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
        assert(overflow<=1,`${name}/${lang}/${width}: page overflow ${overflow}`);
        if(width===1366){
          const rows=Map.groupBy(geometry,r=>r.y);
          assert([...rows.values()].every(row=>row.length===2||row.length===4),`${name}/${lang}: controls form balanced rows`);
          assert([...rows.values()].every(row=>Math.max(...row.map(r=>r.width))-Math.min(...row.map(r=>r.width))<1),`${name}/${lang}: equal widths within each row`);
        }
        if(name==='chromium'&&(width===1366||width===375))await page.screenshot({path:`${out}/comparison-${lang}-${theme}-${width}.png`,fullPage:true});
        checks++;
      }
      const mainHandle=await page.locator('main').elementHandle(), sizeHandle=await page.locator('[data-cmp-axis="size"]').elementHandle();
      await page.locator('[data-cmp-axis="size"]').scrollIntoViewIfNeeded();
      await page.locator('[data-cmp-axis="size"]').focus();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const scrollBefore=await page.evaluate(()=>scrollY);
      await page.locator('[data-cmp-axis="size"]').selectOption('15');
      assert(await sizeHandle.evaluate(el=>el.isConnected&&el===document.activeElement),`${name}/${lang}: the original selector keeps keyboard focus`);
      assert(await mainHandle.evaluate(el=>el.isConnected),`${name}/${lang}: configuration changes do not redraw the page`);
      const scrollAfter=await page.evaluate(()=>scrollY);
      assert(Math.abs(scrollAfter-scrollBefore)<=1,`${name}/${lang}: configuration changes keep the page position (${scrollBefore} → ${scrollAfter})`);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.locator('[data-cmp-axis="size"]').selectOption('13');
      assert(await page.locator('.ctable').evaluate(el=>el.getAnimations({subtree:true}).length===0),`${name}/${lang}: reduced motion skips the result fade`);
      await page.locator('[data-cmp-axis="size"]').selectOption('15');
      const body=await page.locator('main').innerText();
      assert(body.includes('15.3')||body.includes('15,3'),`${name}/${lang}: actual larger screen diagonal`);
      assert(body.includes('2880')&&body.includes('1864'),`${name}/${lang}: larger display resolution`);
      assert(!/Front camera|Фронтальная камера|Դիմային տեսախցիկ/.test(body),`${name}/${lang}: laptop omits phone camera fields`);
      assert(!errors.length,errors.join('; '));
      await context.close();
    }
    console.log(name+': configuration layout and choices passed');
  }finally{await browser.close();}
}
console.log(`${checks} localized/theme/viewport checks passed`);
