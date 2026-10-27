import assert from 'node:assert/strict';
import fs from 'node:fs';
// Exercise the CLI's real normalizer without fetching retailer sitemaps.
const src=fs.readFileSync('tools/new-products.mjs','utf8');
const declaration=src.split('\n').find(line=>line.startsWith('const bare = '));
assert.ok(declaration,'discovery normalizer remains explicit');
const bare=new Function(declaration+'; return bare;')();
for(const [title,model]of [
 ['Samsung Galaxy A07 8/256GB','Samsung Galaxy A07'],
 ['Apple MacBook Air M4 16GB 512GB','Apple MacBook Air M4'],
 ['Samsung Galaxy S26 Ultra 1TB','Samsung Galaxy S26 Ultra'],
 ['Honor MagicBook X16 16/512','Honor MagicBook X16'],
 ['JBL Tune 520C','JBL Tune 520C'],
 ['Lenovo IdeaPad 83K1002CRK','Lenovo IdeaPad 83K1002CRK'],
 ['POCO C95 Pro 6 GB 128 GB','POCO C95 Pro'],
])assert.equal(bare(title).trim(),model,`${title}: memory configuration is not a new model`);
console.log('NEW_PRODUCTS_NORMALIZATION_PASS:7 real-title variant/model controls');
