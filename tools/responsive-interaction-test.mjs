import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,firefox,webkit} from 'playwright';
const port=8773,base=process.env.RESPONSIVE_BASE||`http://127.0.0.1:${port}`;
const server=process.env.RESPONSIVE_BASE?null:spawn(process.execPath,['serve.mjs',String(port)],{stdio:'ignore'});
if(server)await new Promise(r=>setTimeout(r,700));
try{for(const name of (process.env.RESPONSIVE_ENGINES||'chromium,webkit').split(',')){
 const browser=await ({chromium,firefox,webkit})[name].launch();
 try{for(const lang of ['hy','en','ru'])for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme,reducedMotion:'reduce',hasTouch:true});
  await ctx.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'}));
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+(lang==='hy'?'/':`/${lang}/`));await p.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
  if(name==='chromium'){
   const strip=p.locator('.bx-categories'),r=await strip.boundingBox(),cdp=await ctx.newCDPSession(p);
   const y=r.y+r.height/2,right=r.x+r.width-25;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:right,y}]});
   for(let step=1;step<=6;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:right-step*35,y}]});await p.waitForTimeout(20);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await p.waitForTimeout(100);assert.ok(await strip.evaluate(el=>el.scrollLeft>0),'category strip responds to a native touch swipe');await cdp.detach();
  }
  await p.locator('[data-bx-mobile-category]').tap();
  await p.keyboard.press('Shift+Tab');
  assert.ok(await p.locator('.bx-filter-sidebar').evaluate(el=>el.contains(document.activeElement)),'modal retains keyboard focus');
  await p.setViewportSize({width:1024,height:768});
  // WebKit can deliver the media-query change after the viewport command returns.
  await p.waitForFunction(()=>!document.documentElement.classList.contains('fs-open'),null,{timeout:5000}).catch(async error=>{
   const state=await p.evaluate(()=>({width:innerWidth,desktop:matchMedia('(min-width: 801px)').matches,classes:document.documentElement.className,sidebar:getComputedStyle(document.querySelector('.bx-filter-sidebar')).position}));
   throw new Error(`${name}/${lang}/${theme}: resize did not close modal: ${JSON.stringify(state)}; ${error.message}`);
  });
  assert.equal(await p.locator('html.fs-open').count(),0,'desktop resize closes mobile modal and unlocks scrolling');
  assert.equal(await p.locator('.bx-filter-sidebar[aria-modal]').count(),0,'desktop sidebar is not a modal');
  for(const [width,height]of [[320,568],[568,320],[720,450],[800,600],[801,600],[820,1180],[1024,768],[1440,900],[2560,1080]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(60);
   const layout=await p.evaluate(()=>({over:document.documentElement.scrollWidth-innerWidth,search:document.querySelector('#q').getBoundingClientRect().width}));
   assert.ok(layout.over<=1,`${name}/${lang}/${theme}/${width}px: no horizontal page overflow (${layout.over})`);
   assert.ok(layout.search>=140,`${name}/${lang}/${theme}/${width}px: usable search width (${layout.search})`);
   if(width>800&&width<=1000)assert.ok(await p.locator('.pcard').first().evaluate(el=>el.getBoundingClientRect().width>=220),'tablet cards leave room for names and shop prices beside filters');
  }
  await p.setViewportSize({width:568,height:320});await p.locator('[data-bx-mobile-category]').tap();
  const apply=p.locator('.bx-apply');assert.ok(await apply.isVisible());
  const hit=await apply.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===el});
  assert.ok(hit,'landscape Apply button remains tappable');await apply.tap();
  assert.equal(await p.locator('html.fs-open').count(),0,'touch Apply closes the landscape filter sheet');
  assert.deepEqual(errors,[]);await ctx.close();console.log(`${name} ${lang} ${theme}: nine viewports, focus, resize, landscape OK`);
 }
 }finally{await browser.close()}
}
console.log('RESPONSIVE_INTERACTION_PASS');
}finally{server?.kill()}
