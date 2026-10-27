// The listing index must answer every existing catalogue question exactly as a full model does.
import fs from 'node:fs';
const harness="import assert from 'node:assert/strict';\n"+fs.readFileSync('tools/app-test.mjs','utf8').split('let bad = 0, n = 0;')[0]
 .replace("from './analytics.mjs'",'from '+JSON.stringify(new URL('./analytics.mjs',import.meta.url).href))
 .replace('PMIN, PMAX };','PMIN, PMAX, D, card, hasReal, catOf, hay, SORTS };');
const checks=`
const {catalogueIndex}=await import(${JSON.stringify(new URL('./catalogue-index.mjs',import.meta.url).href)});
const indexedPhones=phones.map(catalogueIndex);
const indexed=new Function(...names,src+exports_)(indexedPhones,...vals.slice(1));
let compared=0;
for(const cat of ['',...new Set(phones.map(p=>p.category||'phone'))]){
 app.st={...app.D,cat,pmin:0,pmax:Infinity};indexed.st={...indexed.D,cat,pmin:0,pmax:Infinity};
 for(const sort of Object.keys(app.SORTS)){app.st.sort=sort;indexed.st.sort=sort;assert.deepEqual(indexed.results().map(p=>p.id),app.results().map(p=>p.id),'same models and '+sort+' order in '+cat);}
 for(let i=0;i<phones.length;i++){
  const p=phones[i],q=indexedPhones[i];if(cat&&(p.category||'phone')!==cat)continue;
  assert.equal(indexed.hay(q),app.hay(p),'search tokens for '+p.id);
  for(const [key,f]of Object.entries(app.FILT)){
   if(f.of)assert.deepEqual(indexed.FILT[key].of(q,indexed.st),f.of(p,app.st),key+' facet '+p.id);
   if(f.all)assert.deepEqual(indexed.FILT[key].all(q),f.all(p),key+' configurations '+p.id);
  }
  compared++;
 }
}
for(const lang of ['hy','en','ru']){
 app.st={...app.D,lang,pmin:0,pmax:Infinity};indexed.st={...indexed.D,lang,pmin:0,pmax:Infinity};
 for(let i=0;i<phones.length;i++)if(app.hasReal(phones[i]))assert.equal(indexed.card(indexedPhones[i]),app.card(phones[i]),'identical card '+lang+' '+phones[i].id);
}
const sample=phones.find(p=>p.aliases?.length);assert.ok(!('aliases' in indexedPhones.find(p=>p.id===sample.id)),'non-rendered aliases are deferred');
assert.equal(phones.find(p=>p.aliases?.length).aliases.length>0,true,'original records untouched');
// Detail-only annotations must not ride the initial listing download. Canonical input stays intact.
const annotations={id:'annotation-control',unsure:['body.weight'],specNA:{'camera.front':'Not published'},updates:{os:7},specSource:'https://example.com/specs',settled:true,notes:'Evidence',releaseDate:'2026-10-27',priceAmdMax:120000};
const initial=catalogueIndex(annotations);
for(const key of Object.keys(annotations).filter(k=>k!=='id'))assert.ok(!(key in initial),'detail metadata deferred: '+key);
assert.equal(annotations.notes,'Evidence','canonical detail metadata untouched');
console.log('CATALOGUE_INDEX_PASS: '+compared+' model/category pairs, every facet, search and multilingual card preserved');`;
await import('data:text/javascript;base64,'+Buffer.from(harness+checks).toString('base64'));
