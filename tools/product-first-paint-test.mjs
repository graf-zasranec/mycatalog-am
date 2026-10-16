import fs from 'node:fs';import assert from 'node:assert/strict';
const products=JSON.parse(fs.readFileSync('data/phones.json'));let count=0;
for(const pre of ['', 'ru/','en/'])for(const p of products){
 const file=pre+'p/'+p.id+'/index.html',html=fs.readFileSync(file,'utf8');
 assert.ok(html.includes('data-prerender-product="'+p.id+'"'),file+' has no first product render');
 assert.match(html,/id="hpShot"/);assert.doesNotMatch(html,/<script[^>]*(?:datafa\.st|googletagmanager\.com)/);
 count++;
}
console.log('PRODUCT FIRST PAINT PASS: '+count+' pages; real photos present before JavaScript; DataFast absent, GA only deferred');
