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
const damaged={phone:[{shop:'shop',url:'https://shop.example/sku',storage:64,ram:null,price:1999000},{shop:'shop',url:'https://shop.example/sku',storage:1024,ram:null,price:1800000}]};
const correction={phone:[{shop:'shop',url:'https://shop.example/sku',checked:'2026-10-30',matchAxes:{storage:64},correctAxes:{storage:2048},offerAxes:{ram:64}}]};attachVerifiedOfferAxes(damaged,correction);assert.equal(damaged.phone[0].storage,2048,'verified RAM-as-storage error must remain corrected after a refresh');assert.equal(damaged.phone[0].ram,64);assert.equal(damaged.phone[0].price,1999000);assert.equal(damaged.phone[1].storage,1024);assert.equal(damaged.phone[1].ram,null);
const unscoped={phone:[{shop:'shop',url:'https://shop.example/sku',storage:64}]};attachVerifiedOfferAxes(unscoped,{phone:[{...correction.phone[0],matchAxes:undefined}]});assert.equal(unscoped.phone[0].storage,64,'explicit corrections require a source configuration constraint');console.log('VERIFIED_AXES_CORRECTION_PASS');
