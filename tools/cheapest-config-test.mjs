import fs from'node:fs';
const harness="import assert from 'node:assert/strict';\n"+fs.readFileSync('tools/app-test.mjs','utf8').split('let bad = 0, n = 0;')[0].replace("from './analytics.mjs'",'from '+JSON.stringify(new URL('./analytics.mjs',import.meta.url).href)).replace('PMIN, PMAX };','PMIN, PMAX,D,bxHeroOffers,mastHero };');
const checks=`
const p={id:'__cheapest_default',category:'phone',colors:['Silver','Black'],variants:[{ram:16,storage:512},{ram:4,storage:64},{ram:8,storage:128}]};
prices.offers[p.id]=[{shop:'expensive',price:500,ram:16,storage:512,esim:false,color:'Black'},{shop:'cheap',price:100,ram:4,storage:64,esim:true,color:'Silver'},{shop:'soldout',price:1,ram:4,storage:64,esim:false,inStock:false},{shop:'tie',price:100,ram:8,storage:128,esim:false}];
app.st={...app.D,ram:16,stor:512,shops:['expensive']};
assert.deepEqual(Object.fromEntries(['ram','storage','esim','color'].map(k=>[k,app.initialConfig(p)[k]])),{ram:4,storage:64,esim:true,color:'Silver'},'catalogue filters cannot force a dearer product default');
assert.equal(app.selectionOffers(p,app.initialConfig(p))[0].price,100);
// Lower memory may cost more; choose a real cheapest combination, never mix axes.
prices.offers[p.id]=[{shop:'small',price:110,ram:4,storage:64,esim:false},{shop:'sale',price:90,ram:8,storage:128,esim:true}];
assert.equal(app.initialConfig(p).storage,128);assert.equal(app.initialConfig(p).ram,8);assert.equal(app.initialConfig(p).esim,true);
// Unstated SIM/RAM stays unstated; unknown watch sizes cannot exclude the cheapest offer.
const watch={id:'__cheapest_watch',variantUnit:'mm',variants:[{storage:46},{storage:42}]};prices.offers[watch.id]=[{shop:'unknown',price:10},{shop:'known',price:20,storage:42}];
assert.equal(app.initialConfig(watch).storage,null);assert.equal(app.initialConfig(watch).ram,null);assert.equal(app.initialConfig(watch).esim,null);assert.equal(app.selectionOffers(watch,app.initialConfig(watch))[0].price,10);
app.st={...app.D,ram:32,stor:2048,shops:['nonexistent']};
let count=0;for(const model of phones){const all=app.offersFor(model);if(!all.length)continue;const selected=app.initialConfig(model);assert.equal(app.selectionOffers(model,selected)[0]?.price,all[0].price,'globally cheapest default '+model.id);count++}
const hero=phones.find(p=>p.id==='apple-iphone-18-pro');assert.equal(app.bxHeroOffers()[0].price,app.offersFor(hero)[0].price,'feature tile follows same cheapest selection');
console.log('CHEAPEST_CONFIG_PASS:'+count+'real models,filter independence,tied minima,stock,unknown facts,feature alignment');`;
try{await import('data:text/javascript;base64,'+Buffer.from(harness+checks).toString('base64'))}catch(e){console.error(e.name+': '+e.message);process.exitCode=1}
