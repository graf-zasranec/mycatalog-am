process.on('uncaughtException',e=>{console.error(e.message);process.exit(1);});
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('scrape.mjs','utf8').replaceAll("from './tools/", "from '" + new URL('./', import.meta.url).href); // a data: module has no base for scrape.mjs's relative imports
const prefix=source.slice(0,source.indexOf('const report = [];')).replace('process.argv.slice(2)','[]').replace(/from ['\"](\.\/tools\/[^'\"]+)['\"]/g,(_,file)=>"from '"+new URL('../'+file,import.meta.url).href+"'");
const harness=`
import {magentoCartState} from "${new URL('./cache-availability.mjs',import.meta.url).href}";
export async function fixture(page,colors,aliases){
 const saved=fs.readFileSync;
 fs.readFileSync=(file,...args)=>String(file)==='data/ucom-seed.txt'?'':String(file)==='data/color-aliases.json'?JSON.stringify({fixture:aliases}):saved(file,...args);
 get=async()=>page;catPages=async function*(){};
 prev.offers={fixture:[{shop:'ucom',url:'https://shop.ucom.am/am/fixture.html',price:109900,title:'Fixture'}]};
 phoneById.fixture={id:'fixture',colors};
 try{return await SHOPS.ucom.run();}finally{fs.readFileSync=saved;}
}
`;
const {fixture}=await import('data:text/javascript;base64,'+Buffer.from(prefix+harness).toString('base64'));
const cfg={attributes:{93:{id:93,code:'color',options:[{id:'1',label:'Մոխրագույն',products:['101']},{id:'2',label:'Gold',products:['102']},{id:'3',label:'Oxygen',products:['103']},{id:'4',label:'Sold out',products:[]}]}},index:{101:{93:'1'},102:{93:'2'},103:{93:'3'},104:{93:'4'}},optionPrices:{101:{finalPrice:{amount:109900}},102:{finalPrice:{amount:119900}},103:{finalPrice:{amount:109900}},104:{finalPrice:{amount:110900}}}};
const html='<script>"jsonConfig":'+JSON.stringify(cfg)+'</script>';
const offers=await fixture(html,['Gray Mist','Gold Tone','Anthracite Oxygen'],{'Մոխրագույն':'Gray Mist',Gold:'Gold Tone',Oxygen:'Anthracite Oxygen','Sold out':'Gray Mist'});
assert.deepEqual(offers.map(x=>[x.color,x.price]),[['Gray Mist',109900],['Gold Tone',119900],['Anthracite Oxygen',109900]],'all available swatches retain their own finish and price before deduplication');
assert.deepEqual(offers.map(x=>x.colorRaw),['Մոխրագույն','Gold','Oxygen'],'raw merchant labels survive for audit');
console.log('UCOM COLOURS PASS: Armenian labels, exact per-colour prices, aliases and unavailable child exclusion');

export {fixture};
