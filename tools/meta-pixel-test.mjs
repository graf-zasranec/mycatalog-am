import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Catch accidental tracking before marketing consent, duplicate initialization,
// and measurements continuing after withdrawal. Network is an external boundary.
assert.ok(fs.existsSync('tools/meta-pixel.js'), 'Meta Pixel runtime must exist');
const source = fs.readFileSync('tools/meta-pixel.js', 'utf8');
function boot(choice, navigator = {}) {
  const listeners = {}, scripts = [], timers = [];
  const storage = new Map(choice ? [['better.marketing-consent.v1', choice]] : []);
  const ctx = { navigator, location: {hostname:'better.am',pathname:'/en/',hash:''},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    document:{readyState:'complete',cookie:'',createElement:tag=>({tag}),head:{appendChild:s=>scripts.push(s)}},
    setTimeout:f=>timers.push(f),requestIdleCallback:f=>timers.push(f),
    addEventListener:(name,f)=>(listeners[name]??=[]).push(f) };
  ctx.window=ctx; vm.createContext(ctx); vm.runInContext(source,ctx);
  return {ctx,scripts,flush:()=>{while(timers.length)timers.shift()();},
    emit:(name,detail)=>listeners[name]?.forEach(f=>f({detail})),
    grant(value){storage.set('better.marketing-consent.v1',value);this.emit('better:marketing-consent',value);}};
}
const fresh=boot(); fresh.flush();
assert.equal(fresh.scripts.length,0,'no Meta request without separate advertising consent');
assert.equal(fresh.ctx.fbq,undefined);
fresh.grant('granted'); fresh.flush();
assert.equal(fresh.scripts.length,1,'consent loads one async library');
assert.equal(fresh.scripts[0].async,true);
const calls=()=>Array.from(fresh.ctx.fbq.queue,x=>Array.from(x));
assert.equal(calls().filter(x=>x[0]==='init').length,1);
assert.equal(calls().filter(x=>x[1]==='PageView').length,1);
fresh.grant('granted'); fresh.flush();
assert.equal(calls().filter(x=>x[1]==='PageView').length,1,'saving the same permission does not count the page again');
fresh.emit('hashchange');
assert.equal(calls().filter(x=>x[1]==='PageView').length,1,'unchanged route does not double count');
fresh.ctx.location.hash='#/p/honor-x8c'; fresh.emit('hashchange');
assert.equal(calls().filter(x=>x[1]==='PageView').length,2,'product navigation produces a page view');
fresh.ctx.location.hash='#/p/honor-x8c?color=purple'; fresh.emit('hashchange');
assert.equal(calls().filter(x=>x[1]==='PageView').length,2,'variant choice does not count another page view');
fresh.grant('denied'); fresh.ctx.location.hash='#/catalog'; fresh.emit('hashchange');
assert.equal(calls().filter(x=>x[1]==='PageView').length,2,'withdrawal stops measurements');
assert.ok(calls().some(x=>x[0]==='consent'&&x[1]==='revoke'));
fresh.grant('granted'); fresh.flush();
assert.equal(fresh.scripts.length,1,'regrant does not load another library');
for (const signal of [{globalPrivacyControl:true},{doNotTrack:'1'}]) {
  const blocked=boot('granted',signal); blocked.flush(); blocked.grant('granted'); blocked.flush();
  assert.equal(blocked.scripts.length,0,'browser privacy signal overrides saved consent');
}
const saved=boot('granted');saved.flush();
assert.equal(saved.scripts.length,1,'explicit saved marketing consent survives navigation');
const denied=boot('denied');denied.flush();assert.equal(denied.scripts.length,0);
const direct=boot('granted');direct.ctx.location.pathname='/en/p/honor-x8c/';direct.flush();
direct.ctx.location.hash='#/p/honor-x8c';direct.emit('hashchange');
assert.equal(direct.ctx.fbq.queue.filter(x=>x[1]==='PageView').length,1,'canonical URL and its router hash describe the same page');
console.log('Meta Pixel: consent, async loading, SPA deduplication, revocation and privacy signals passed');

// Exercise the real consent UI: old analytics permission must never imply ads permission.
function consentUI() {
  const elements=[], events=[], storage=new Map([['better.analytics-consent.v1','granted']]);
  const element=tag=>{const el={tag,style:{},children:[],setAttribute(){},append(...xs){this.children.push(...xs);},remove(){},addEventListener(n,f){this[n]=f;}};elements.push(el);return el;};
  const doc={currentScript:{dataset:{metaPixel:'true'}},documentElement:{lang:'en'},readyState:'complete',
    getElementById:()=>null,createElement:element,body:element('body'),head:element('head'),addEventListener(){}};
  const ctx={navigator:{},document:doc,location:{pathname:'/en/',hash:'',origin:'https://better.am',hostname:'better.am'},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    requestAnimationFrame:()=>{},addEventListener(){},dispatchEvent:e=>events.push(e),
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},
    MutationObserver:class {observe(){}}};ctx.window=ctx;
  vm.runInNewContext(fs.readFileSync('tools/google-analytics.js','utf8'),ctx);
  return {elements,events,storage};
}
const ui=consentUI();
const check=ui.elements.find(x=>x.type==='checkbox');
assert.ok(check,'advertising has an independent checkbox');
assert.equal(check.checked,false,'existing analytics permission does not grant advertising');
check.checked=true;
ui.elements.find(x=>x.tag==='button').click();
assert.equal(ui.storage.get('better.marketing-consent.v1'),'granted');
assert.ok(ui.events.some(x=>x.type==='better:marketing-consent'&&x.detail==='granted'));
const untouched=consentUI();untouched.elements.find(x=>x.tag==='button').click();
assert.equal(untouched.storage.get('better.marketing-consent.v1'),'denied','unchecked advertising stays disabled');
console.log('Consent UI: separate advertising choice and analytics-only permission passed');
