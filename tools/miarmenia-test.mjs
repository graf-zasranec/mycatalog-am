import assert from 'node:assert/strict';
import {readMiArmenia,miReviewMatches} from './miarmenia.mjs';
const h=(title,spec,cart='<a id="add-to-cart" class="btn">Add to Cart</a>')=>`<h1>${title}</h1><li id="discount-price">Was: 239900 AMD</li><li class="price" id="old-price"><span>Price:</span><strong>191920 AMD</strong></li><div id="productCart">${cart}</div><table><tr><td>${spec}</td></tr></table><aside>Related product 10000 AMD</aside>`;
const read=(title,spec,cart)=>readMiArmenia(h(title,spec,cart),'https://miarmenia.am/en/product/1/test');
assert.equal(read('Redmi 17 8/512','Internal Storage: 256 GB RAM: 8 GB').conflict,true);
assert.equal(read('Redmi 17 8/256','Internal Storage: 256 GB RAM: 8 GB').conflict,false);
assert.equal(read('Redmi 17 8/256','Internal Storage: 256 GB RAM: 8 GB').price,191920);
assert.equal(read('Redmi 17 8/256','','<span>Out of stock</span>').inStock,false);
assert.equal(read('Redmi 17 8/256','','<a id="add-to-cart" class="disabled">Add to Cart</a>').inStock,false);
assert.equal(read('Smart Kettle 2','').storage,null);
assert.throws(()=>readMiArmenia('<h1>Access denied</h1>','https://miarmenia.am'),/markup/);
console.log('MiArmenia: scoped cash price, exact memory conflict and stock checks passed');

assert.equal(read('POCO C81 Pro 4GB/128G','').storage,128);
assert.equal(miReviewMatches(read('POCO C81 Pro 4GB/128G',''),{storage:256}),false);
{ const {readMiArmenia}=await import('./miarmenia.mjs');
  const pg=b=>`<div class="not-available">${b}</div><h1>Xiaomi TV A 43</h1><li id="old-price">177 900 AMD</li><div id="productCart"><a id="add-to-cart">Add to Cart</a></div><div class="not-available">Pre-order</div>`;
  if(readMiArmenia(pg('Pre-order'),'u').preorder!==true||readMiArmenia(pg('New'),'u').preorder!==undefined)throw new Error('MiArmenia preorder ribbon');console.log('MIARMENIA_PREORDER_PASS'); }
