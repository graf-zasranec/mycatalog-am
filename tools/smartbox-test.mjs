import assert from 'node:assert/strict';
import { parseSmartbox } from './smartbox.mjs';
const page = '<h1 class="disp">Apple / iPhone 17 Pro 256GB</h1><div class="tag-price"><div class="price x"><span class="was"><s>650 000 ֏</s></span><span class="now">599 000 ֏</span></div></div><p class="tag-line"><span class="st">In stock</span></p><div class="rec"><span class="st off">Out of stock</span></div>';
assert.deepEqual(parseSmartbox(page), { title: 'Apple iPhone 17 Pro 256GB', price: 599000, inStock: true });
assert.equal(parseSmartbox(page.replace('<span class="st">', '<span class="st off">')).inStock, false);
assert.equal(parseSmartbox('<h1 class="disp">X</h1>').price, 0);
// real page 2026-11-27 (/en/shop/view/1832/): now first, struck was after, recommendation cards below
const live = '<h1 class="disp">Earphones SENNHEISER HD 350BT WIRELESS</h1><div class="tag-price"><div class="price lg has-was"><span class="now">30 000 ֏</span><span class="was"><s>50 000 ֏</s><em class="off">−<!-- -->40<!-- -->%</em></span></div></div><p class="tag-line"><span class="st">In stock</span></p><div><span class="was"><s>99 000 ֏</s></span><span class="st off">Out of stock</span></div>';
assert.deepEqual(parseSmartbox(live), { title: 'Earphones SENNHEISER HD 350BT WIRELESS', price: 30000, inStock: true });
console.log('SMARTBOX_PASS');
