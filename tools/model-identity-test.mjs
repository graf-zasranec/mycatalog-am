import assert from 'node:assert/strict';
import fs from 'node:fs';
import {specOfferAllowed} from './allsell-specs.mjs';
import {attachOfferConfigs} from './offer-configs.mjs';

// The production final offer gate must reject a generic HP 15 sold with a
// different processor, including adapter IDs and offers carried from old caches.
const target='hp-15-intel-core-5-120u';
const source=JSON.parse(fs.readFileSync(new URL('./fixtures/hp15-identity-offers.json',import.meta.url),'utf8'));
const legitimate=source.find(o=>o.shop==='appzone');
assert.ok(legitimate?.cpu,'fixture must retain the actual parsed merchant CPU');
for(const offer of source.filter(o=>o.shop!=='appzone'))
  assert.equal(specOfferAllowed(offer,[],target),false,`${offer.shop}: another HP 15 cannot be this Core 5-120U`);
assert.equal(specOfferAllowed(legitimate,[],target),true,'the confirmed AppZone offer survives');

for(const title of ['HP 15','HP LAPTOP 15','HP 15 8GB/512GB'])
  assert.equal(specOfferAllowed({id:target,title},[]),false,'memory or generic family name is not CPU evidence');
assert.equal(specOfferAllowed({id:target,title:'HP 15',chipset:{name:'Intel Core 5-120U'}},[]),false,'catalogue chipset is not merchant evidence');
for(const title of ['HP 15 Intel Core 5-120U','HP 15 CORE 5 120U','HP 15 Core5–120U'])
  assert.equal(specOfferAllowed({id:target,title},[]),true,title);
for(const cpu of ['Core i3-N305','i3-N305','Core 3-100U','Core i5-1334U','Core i5-1135G7','Core Ultra 5-225U','Ryzen 5 7530U','Intel N100'])
  assert.equal(specOfferAllowed({id:target,title:`HP 15 ${cpu}`,cpu:'Intel Core 5-120U'},[]),false,'conflicting source title defeats a positive CPU field: '+cpu);
assert.equal(specOfferAllowed({id:target,title:'HP 15',configSpecs:{chipset:{name:'Intel Core 5-120U'}}},[]),true,'actual parsed source attributes establish identity');
assert.equal(specOfferAllowed({title:'HP 15',cpu:'Intel Core 5-120U'},[],target),true,'bucket ID covers legacy rows without an embedded ID');
assert.equal(specOfferAllowed({id:'another-laptop',title:'Generic laptop'},[]),true,'unrelated products keep their existing behavior');
assert.equal(specOfferAllowed({id:target,title:'HP 15',cpu:'Intel Core 5-120U',specConflict:['ram']},[]),false,'existing hardware conflict gate remains active');
const carried={[target]:[{title:'HP 15 Core 3-100U',price:100000,ram:8,storage:512}]};
attachOfferConfigs([{id:target,category:'laptop',name:'15 (Core 5-120U)'}],carried);
assert.equal(carried[target].length,0,'build-time configuration attachment also guards rows without embedded IDs');

// A55-inch TV may not supply the65-inch model's headline price.
const tv='xiaomi-s-pro-mini-led-65';
const wrongTv={title:'Xiaomi TV S Pro Mini LED 55" 2026 (L55MB-SME)',url:'https://www.zigzag.am/am/xiaomi-tv-s-pro-mini-led-55-2026-l55mb-sme.html'};
assert.equal(specOfferAllowed(wrongTv,[],tv),false,'55-inch source cannot price65-inch catalogue TV');
for(const title of ['Xiaomi TV S Pro Mini LED 65" 2026 (L65MB-SME)',"Xiaomi TV S Pro Mini Led 65'' 2026",'XIAOMI S Pro Mini LED 65 (L65MB-SRU)'])
 assert.equal(specOfferAllowed({title},[],tv),true,'exact65-inch sources remain available');
assert.equal(specOfferAllowed({title:'Xiaomi TV S Pro Mini LED'},[],tv),false,'unlabelled size does not establish65-inch identity');

const scraper=fs.readFileSync('scrape.mjs','utf8');
const prefix=scraper.slice(0,scraper.indexOf('const report = [];')).replace('process.argv.slice(2)','[]');
const {matchPhone}=await import('data:text/javascript;base64,'+Buffer.from(prefix+'\nexport {matchPhone};').toString('base64'));
for(const offer of source.filter(o=>o.shop!=='appzone'))
  assert.equal(matchPhone(offer.url),null,'reviewed wrong-model URL remains denied: '+offer.shop);
assert.equal(matchPhone(legitimate.url),target,'valid merchant mapping survives');
assert.equal(matchPhone('HP 15 Intel Core 5-120U'),target,'qualified model name still matches its processor');
assert.equal(matchPhone('HP LAPTOP 15'),null,'unqualified family name cannot absorb another processor');

console.log('MODEL_IDENTITY_PASS: wrong-model offers, merchant CPU proof, conflicts, carried rows and unrelated products');

// Exact generation codes defeat broad family-name matches and carried URLs.
for (const title of ['Yandex Station Lite 2', 'Yandex Station Light 2', 'Yandex YNDX-00026PNK'])
  assert.equal(specOfferAllowed({title}, [], 'yandex-station-lite'), false, title);
assert.equal(specOfferAllowed({title:'Yandex Station Lite',url:'https://shop.ucom.am/en/yandex-smart-speaker-station-light-2-with-alice-gpt.html'}, [], 'yandex-station-lite'),false);
assert.equal(specOfferAllowed({title:'Yandex Station Lite YNDX-00025'}, [], 'yandex-station-lite'),true);
assert.equal(specOfferAllowed({title:'Yandex Station Lite 2'}, [], 'yandex-station-lite-2'),true);
for (const title of ['Samsung A165 256GB','Samsung Galaxy SM-A165F','Samsung Galaxy A16 LTE','Samsung A16 4G'])
  assert.equal(specOfferAllowed({title}, [], 'samsung-galaxy-a16'),false,title);
assert.equal(specOfferAllowed({title:'Samsung Galaxy A16',url:'https://www.telecomarmenia.am/eshop/hy/smartphones/samsung-a165-256gb-grey/2078/'}, [], 'samsung-galaxy-a16'),false);
assert.equal(specOfferAllowed({title:'Samsung Galaxy A16 5G SM-A166P'}, [], 'samsung-galaxy-a16'),true);
assert.equal(specOfferAllowed({title:'Samsung Galaxy A16'}, [], 'samsung-galaxy-a16'),true,'generic primary listing with separately verified 5G specs remains accepted');
console.log('MODEL_GENERATION_PASS: Lite/Lite2 and A165 LTE/A16 5G remain separated');

for(const title of ['HP 15-FD2006ci Ultra 5 225U 16GB I 1TB (BK2X0EA#UUQ)','HP 15 N100 8GB/256GB'])
  assert.equal(specOfferAllowed({title,cpu:'Intel Core 5-120U'},[],target),false,'bare merchant CPU defeats stale positive: '+title);
const honorID='honor-magicbook-pro-16-ultra-5-125h-24-1-w11h-5301ajjg';
const wrongHonor={title:'Honor MagicBook Pro 16 Ultra 9-285H 32GB/1TB RTX5060 W11H White /5301APWK',ram:32,storage:1024,price:859900};
assert.equal(specOfferAllowed(wrongHonor,[],honorID),false,'Ultra9 cannot verify Ultra5 canonical RAM');
assert.equal(specOfferAllowed({...wrongHonor,cpu:'Intel Core Ultra 5-125H'},[],honorID),false,'conflicting source defeats carried CPU');
assert.equal(specOfferAllowed({title:'Honor MagicBook Pro 16 Ultra 5-125H 24/1 Purple W11H /5301AJJE'},[],honorID),true);
const honorOffers={[honorID]:[wrongHonor]};attachOfferConfigs([{id:honorID,category:'laptop'}],honorOffers);
assert.equal(honorOffers[honorID].length,0,'build-time gate cannot reinstate mismatched Honor configuration');
console.log('FINAL_REVIEW_REGRESSIONS_PASS: bare processors and fixed-CPU Honor identity');

const actualHolds=JSON.parse(fs.readFileSync('data/price-review-holds.json'));
for(const lang of ['am','en','ru']) assert.equal(specOfferAllowed({title:'Samsung Galaxy A16 5G',url:`https://shop.ucom.am/${lang}/samsung-galaxy-a16.html`},actualHolds,'samsung-galaxy-a16'),false,'verified G99/LTE page cannot return through a carried 5G title');

const buds6BaseID='xiaomi-redmi-buds-6';
assert.equal(specOfferAllowed({title:'Redmi Buds 6',url:'https://www.pixel.am/am/product/xiaomi-buds-6'},[],buds6BaseID),true);
for(const title of ['Redmi Buds 6 Active','Redmi Buds 6 Lite','Redmi Buds 6 Play','Xiaomi Buds 6'])
  assert.equal(specOfferAllowed({title},[],buds6BaseID),false,'another product cannot enter Redmi Buds 6: '+title);
const buds6ActiveID='xiaomi-redmi-buds-6-active';
for(const title of ['Xiaomi Redmi Buds 6','Redmi Buds 6 Lite','Redmi Buds 6 Play','Xiaomi Buds 6'])
  assert.equal(specOfferAllowed({title,url:'https://example.test/redmi-buds-6'},[],buds6ActiveID),false,'another Buds 6 model cannot enter the Active product: '+title);
assert.equal(specOfferAllowed({title:'Redmi Buds 6 Active Black'},[],buds6ActiveID),true);
assert.equal(specOfferAllowed({title:'Wireless earbuds',url:'https://shop.viva.am/en/product/redmi-buds-6-active-black-m2344e1/'},[],buds6ActiveID),true);
assert.equal(specOfferAllowed({title:'Xiaomi M2344E1'},[],buds6ActiveID),true);
assert.equal(specOfferAllowed({title:'Redmi Buds 6 Lite',url:'https://example.test/redmi-buds-6-active'},[],buds6ActiveID),false,'an explicit competing model defeats an Active URL');
console.log('BUDS6_ACTIVE_IDENTITY_PASS: Active hardware stays separate from base, Lite and Play');
assert.equal(specOfferAllowed({title:'Xiaomi Buds 6'},[],'xiaomi-buds-6'),true);
assert.equal(specOfferAllowed({title:'Redmi Buds 6 Active',url:'https://example.test/xiaomi-buds-6'},[],'xiaomi-buds-6'),false);
