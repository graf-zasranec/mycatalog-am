import assert from 'node:assert/strict';
import {storageGB, caseSize} from './spec-values.mjs';
import {attachOfferConfigs} from './offer-configs.mjs';
for (const [input, want] of [['512 TB',512],['0.5 TB',512],['1 TB',1024],['2 TB',2048],['256 GB',256],['524288 GB',null],['512 MB',null],['16 GB RAM',null]])
  assert.equal(storageGB(input), want, input);
const id = 'lenovo-thinkpad-e16-gen-2-21ma004vrt';
const offers = {[id]: [{url:'https://ibolit.mobi/product/lenovo-thinkpad-e16-gen-2-21ma004vrt/',storage:512,ram:16}]};
attachOfferConfigs([{id,category:'laptop',name:'Lenovo ThinkPad E16 Gen 2 21MA004VRT'}], offers);
assert.equal(offers[id][0].storage,512,'the actual shop cache must not turn 512 GB into 524288 GB at build time');
assert.equal(caseSize({url:'https://shop.ucom.am/en/apple-watch-series-12-gps-46mm.html'},[42,46]),46);
assert.equal(caseSize({title:'Watch 42mm',url:'https://shop/watch-46mm.html'},[42,46]),42,'own title precedes decorative URL');
assert.equal(caseSize({title:'Watch 42mm / 46mm'},[42,46]),null,'configurable pages cannot be assigned one case size');
assert.equal(caseSize({title:'Watch 64GB'},[42,46]),null);
assert.equal(caseSize({title:'Apple Watch Series 12 GPS 42մմ Սև'},[42,46]),42);
console.log('SPEC_VALUES_PASS: real laptop cache, capacity units and exact watch case sizes');
