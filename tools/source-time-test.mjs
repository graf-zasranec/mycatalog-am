import fs from 'node:fs';import assert from 'node:assert/strict';
const s=fs.readFileSync('scrape.mjs','utf8');const block=s.slice(s.indexOf('async function get('),s.indexOf('async function plainGet('));
const times=new Map();let html='<h1>Product</h1>',status=200;
const get=new Function('FETCH_CHECKED','SCRAPLING_HOSTS','process','plainGet','scraplingGet','lastStatus',block+';return get;')(times,new Set(),{env:{}},async()=>html,async()=>html,()=>status);
await get('https://shop.test/product',2,'test');assert.ok(Number.isFinite(Date.parse(times.get('https://shop.test/product'))),'actual successful product read gets its timestamp');
assert.equal(times.has('https://shop.test/sibling'),false,'category or sibling read cannot date an unread URL');
html='';status=403;await get('https://shop.test/blocked',2,'test');assert.equal(times.has('https://shop.test/blocked'),false,'refused source has no success timestamp');
console.log('SOURCE_TIME_PASS');
