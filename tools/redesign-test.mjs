import fs from'node:fs';
// Reuse the catalogue's real isolated data/DOM harness, adding presentation exports.
const harness="import assert from 'node:assert/strict';\n"+fs.readFileSync('tools/app-test.mjs','utf8').split('let bad = 0, n = 0;')[0]
 .replace("from './analytics.mjs'",'from '+JSON.stringify(new URL('./analytics.mjs',import.meta.url).href))
 .replace('PMIN, PMAX };','PMIN, PMAX, bxFilterForm, bxFilterOptions, bxFilterSignature, bxHeroOffers, mastHero, bxPriceRange, routeLinkClick, priceBounds };');
const checks=`
const tvBounds=app.priceBounds('tv');assert.equal(app.bxPriceRange('1000000','',tvBounds.min,tvBounds.max).valid,true,'blank maximum uses target TVs range');
assert.equal(app.bxPriceRange('','100000',105000,2500000).valid,true,'blank minimum permits a cheaper category budget');
assert.equal(app.bxPriceRange('200000','100000').valid,false,'explicit reversed price range rejected');
assert.equal(app.bxPriceRange('0','300000',105000,2500000).min,0,'zero is a real selected minimum');
let prevented=false;const link={dataset:{},getAttribute:()=> '#/compare',hasAttribute:()=>false,target:''};
app.routeLinkClick({target:{closest:()=>link},button:0,preventDefault(){prevented=true}});
assert.equal(prevented,true,'ordinary hash links routed locally under locale base');
assert.equal(stub.location.hash,'#/compare');prevented=false;
app.routeLinkClick({target:{closest:()=>link},button:0,ctrlKey:true,preventDefault(){prevented=true}});
assert.equal(prevented,false,'modified clicks retain normal browser behavior');
app.filterBodies.clear();
const form=app.bxFilterForm();
assert.ok(form.includes('data-bx-set="brand"'),'cold prerender hydration retains brand choices');
assert.ok(app.filterBodies.has('price'),'native option bodies initialized without opening hidden panels');
assert.ok(app.bxFilterOptions('stor').some(v=>v.value==='256'),'actual256GB option remains');
assert.ok(app.mastHero().includes('bx-categories'),'approved desktop tiles remain');
const css=fs.readFileSync('_shell.html','utf8');
assert.ok(!css.includes('>:is(.chips,.resbar,#searchhint,#gridbox,#pager)'), 'conflicting high-specificity heading rule removed');
assert.ok(css.includes('>#results.resbar{grid-column:1/-1'),'heading explicitly spans filters/products');
assert.ok(!fs.readFileSync('_app.js','utf8').includes("heading.insertAdjacentHTML('afterbegin',bxCategoryIcon(st.cat))"),'heading icon not recreated');
for(const [file,lang]of[['index.html','hy'],['en/index.html','en'],['ru/index.html','ru']]){
 const html=fs.readFileSync(file,'utf8');
 assert.ok(html.includes('data-prerender="'+lang+'"'),file+' is interactive/prerendered');
 assert.ok(html.includes('class="bx-filter-sidebar"'),file+' reserves sidebar before hydration');
 assert.ok(html.includes('/data/site-ui.css?v='),file+' uses shared versioned CSS');
 const preload=html.match(/<link[^>]*rel="preload"[^>]*imagesrcset="([^"]+)"/);
 assert.ok(preload,file+' preloads responsive hero');
 assert.ok(preload[1].split(',').every(v=>v.trim().startsWith('/images/')),file+' preload paths resolve before locale base element');
 assert.ok(!html.includes('assets/'),file+' no local draft asset paths');
 assert.ok(!html.includes('hybrid-preview'),file+' no isolated draft preference key');
}
const appjs=fs.readFileSync('data/site-app.js','utf8');
assert.ok(!appjs.includes('.codex/reports'),'production runtime has no local report paths');
console.log('REDESIGN_PASS: native form cold hydration,256GB, real tiles, heading fix, translated home and shared assets');`;
await import('data:text/javascript;base64,'+Buffer.from(harness+checks).toString('base64'));
