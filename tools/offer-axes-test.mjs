import assert from 'node:assert/strict';
import {attachVerifiedOfferAxes} from './offer-configs.mjs';
const url='https://istyle.am/en/product/iPhone%2018%20Pro?color=138&variant=742_color_138&SIM=11';
const facts={'apple-iphone-18-pro':[{url,shop:'istyle',checked:'2026-10-29',offerAxes:{storage:256}}]};
const offer={shop:'istyle',url,storage:null,price:549000,esim:true,color:'Burgundy',seen:'2026-10-29'};
const variants={'apple-iphone-18-pro':[structuredClone(offer),{...offer,url:url.replace('742','743')},{...offer,url:url.replace('138','140')},{...offer,storage:512},{...offer,shop:'other'}]};
attachVerifiedOfferAxes(variants,facts);assert.equal(variants['apple-iphone-18-pro'][0].storage,256);
assert.equal(variants['apple-iphone-18-pro'][1].storage,null);assert.equal(variants['apple-iphone-18-pro'][2].storage,null);assert.equal(variants['apple-iphone-18-pro'][3].storage,512);assert.equal(variants['apple-iphone-18-pro'][4].storage,null);
assert.deepEqual({...variants['apple-iphone-18-pro'][0],storage:null},offer,'verified axis must not alter price, stock, SIM or date');
console.log('VERIFIED_OFFER_AXES_PASS');
// One merchant URL can expose capacities with different physical RAM.
const scopedFacts={phone:[{shop:'shop',url:'https://shop.example/phone',checked:'2026-10-30',matchAxes:{storage:128},offerAxes:{ram:4}}]};
const scoped={phone:[{shop:'shop',url:'https://shop.example/phone',storage:128,ram:null,price:74000},{shop:'shop',url:'https://shop.example/phone',storage:256,ram:null,price:99000},{shop:'shop',url:'https://shop.example/phone',storage:null,ram:null,price:74000}]};
attachVerifiedOfferAxes(scoped,scopedFacts);assert.equal(scoped.phone[0].ram,4);assert.equal(scoped.phone[1].ram,null,'128GB RAM fact must not leak into 256GB quote');assert.equal(scoped.phone[2].ram,null,'unknown capacity cannot satisfy a capacity-specific source fact');
const invalid={phone:[{shop:'shop',url:'https://shop.example/phone',storage:128,ram:null}]};attachVerifiedOfferAxes(invalid,{phone:[{...scopedFacts.phone[0],matchAxes:{storge:128}}]});assert.equal(invalid.phone[0].ram,null,'misspelled scope must fail closed');
console.log('VERIFIED_OFFER_SCOPE_PASS');
