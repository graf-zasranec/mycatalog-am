import assert from 'node:assert/strict';
import fs from 'node:fs';
import {vlvTitleColor, applyVlvTitleColors} from './vlv-colors.mjs';
for(const [title,color] of [
 ['JBL T530BT BEG','Beige'],['JBL CHARGE 6 BLU (AM)','Blue'],
 ['CANON EOS R50 BK RFS 18-45','Black'],['BRAUN KF7020.BK','Black'],
 ['MARSHALL Stanmore III (1006080) (Brown)','Brown'],
 ['Roborock Saros Z70 Silver (SZ7002-02)','Silver'],
 ['SONY WH-CH520/BZ','Black'],['SONY WH-CH720N/WCE','White'],
 ['SAMSUNG A37 (A376) 128GB GrayGreen','Gray Green'],
 ['JBL Tune 530BT Lavender','Lavender']
])assert.equal(vlvTitleColor(title)?.color,color,title);
for(const title of ['SONY WH-CH520','SONY WH 1000XM5','XIAOMI Redmi Bluetooth headphones','SAMSUNG RB34T600FWW/WT','LG 27US550-W','MODEL GR BL'])
 assert.equal(vlvTitleColor(title),null,'model letters, Bluetooth and ambiguous abbreviations do not prove color: '+title);
assert.equal(vlvTitleColor('Headset Black / White'),null,'two competing finishes cannot silently choose one');
assert.equal(vlvTitleColor('Headset White Purple',['White Purple'])?.color,'White Purple','an explicit compound palette finish stays intact');
assert.equal(vlvTitleColor('POCO C81 Pro Gold',['Light Gold'])?.color,'Light Gold','merchant shorthand keeps the existing canonical finish');
assert.equal(vlvTitleColor('Marshall Black And Brass',['Black Brass'])?.color,'Black Brass','compound finishes must not be reduced to Black');
assert.equal(vlvTitleColor('HONOR Pad X8b Space Gray',['Gray'])?.color,'Gray','known basic palette name does not become a duplicate swatch');
assert.equal(vlvTitleColor('Headset Light Blue',['Dark Blue'])?.color,'Light Blue','an explicitly different shade cannot inherit the only catalogue shade');
const products=[{id:'charge',colors:['Black','Purple']}];
const offers={charge:[{shop:'vlv',url:'https://vlv.am/en/Product/1',title:'JBL CHARGE 6 BLU (AM)',color:null,price:52900,storage:null,ram:null},{shop:'other',url:'https://other.test/1',title:'JBL CHARGE 6 Red',color:null,price:58900}]};
const before=structuredClone(offers);const changes=applyVlvTitleColors(products,offers);
assert.equal(offers.charge[0].color,'Blue','a missing catalogue swatch cannot erase explicit merchant evidence');
assert.equal(offers.charge[0].colorRaw,'BLU');
assert.equal(offers.charge[0].colorSource,'vlv:title');
assert.ok(products[0].colors.includes('Blue'),'verified new finish must be selectable on product/offer filters');
assert.equal(offers.charge[0].price,before.charge[0].price);
assert.deepEqual(offers.charge[1],before.charge[1],'other shops stay untouched');
assert.equal(changes.length,1);assert.equal(applyVlvTitleColors(products,offers).length,0,'repair is idempotent');
const scraper=fs.readFileSync('scrape.mjs','utf8');const builder=fs.readFileSync('build.mjs','utf8');
assert.match(scraper,/vlvTitleColor\(title/,'adapter reads color before merchant-offer deduplication');
assert.ok(scraper.indexOf('applyVlvTitleColors(phones, offers')>scraper.indexOf('offer colour(s) the product does not come in'),'palette quarantine cannot erase verified VLV colors again');
assert.match(builder,/applyVlvTitleColors\(phones, PRICES.offers/,'rebuild repairs already cached offers too');
console.log('VLV_COLORS_PASS: title evidence, abbreviations, safe model-code handling, incomplete palettes, retained prices and idempotence');
// Exercise the real adapter with its numeric URL/title-index boundary.
const prefix=scraper.slice(0,scraper.indexOf('const report = [];')).replace('process.argv.slice(2)','[]').replace(/from ['"]\.\/tools\/([^'"]+)['"]/g,(_,file)=>"from '"+new URL('./'+file,import.meta.url).href+"'");
const harness=`
export async function fixture(){
 const read=fs.readFileSync;
 fs.readFileSync=(file,...args)=>String(file)==='data/vlv-index.json'?JSON.stringify({'48548':'JBL CHARGE 6 BLU (AM)'}):read(file,...args);
 get=async()=>'<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'JBL CHARGE 6 BLU (AM)',offers:{price:52900,availability:'https://schema.org/InStock'}})+'</script>';
 vlvInfo=async()=>({price:52900,image:''});
 try{return (await SHOPS.vlv.run()).map(o=>enrich(o));}finally{fs.readFileSync=read;}
}`;
const {fixture}=await import('data:text/javascript;base64,'+Buffer.from(prefix+harness).toString('base64'));
const realAdapter=await fixture();
assert.equal(realAdapter.length,1);
assert.equal(realAdapter[0].color,'Blue','title color survives real adapter and enrich before deduplication');
assert.equal(realAdapter[0].colorRaw,'BLU');
console.log('VLV_ADAPTER_PASS: numeric product URL and title-index crawl retain explicit Blue');
