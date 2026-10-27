import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertCaseStableBrands} from './brand-integrity.mjs';
const products=JSON.parse(fs.readFileSync('data/phones.json','utf8'));
const brands=new Map();
for(const p of products){const key=p.brand.trim().toLowerCase();assert.ok(!brands.has(key)||brands.get(key)===p.brand,`Case-variant brand splits filters: ${brands.get(key)} / ${p.brand}`);brands.set(key,p.brand);}
console.log('BRAND_INTEGRITY_PASS: brand spelling consistent across catalogue');

assertCaseStableBrands(products);
assert.doesNotThrow(()=>assertCaseStableBrands([{id:'a',brand:'ASUS'},{id:'b',brand:'Apple'}]));
assert.throws(()=>assertCaseStableBrands([{id:'a',brand:'ASUS'},{id:'b',brand:'Asus'}]),/Case-variant brand/);
