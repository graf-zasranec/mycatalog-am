import assert from'node:assert/strict';import fs from'node:fs';import{readVesta,readVestaPhoneAxes,collectVesta}from'./vesta.mjs';
const url='https://vesta.am/tv/TCL-55C6K';const box=(available=true)=>'<p class="price">9,900 ֏</p><div class="product-right"><h1 class="product-title">TCL 55C6K</h1><ul class="list-unstyled price">'+(available?'<li><h2>249,000 ֏</h2></li>':'')+'</ul><p>Ապառիկ՝ 8,900 դրամ</p><input name="product_id" value="123">'+(available?'<button id="button-cart">Գնել հիմա</button>':'')+'<li><span>Ապրանքի կոդը</span>TCL 55C6K</li><li><span>Հասանելիությունը</span>'+(available?'Առկա է':'Հասանելի չէ')+'</li></div><script>recommendation()</script>';
assert.equal(readVesta(box(),url,{expectedTitle:'TCL 55C6K'}).price,249000);assert.equal(readVesta(box(false),url).inStock,false);assert.equal(readVesta(box(false),url).price,0);assert.throws(()=>readVesta(box(),url,{expectedTitle:'TCL 65C6K'}),/identity/);assert.throws(()=>readVesta(box().replace('249,000 ֏','0 ֏'),url),/cash price/);assert.throws(()=>readVesta(box().replace('Առկա է','Պատվերով'),url),/availability/);assert.throws(()=>readVesta(box(),'https://elsewhere.test/tv/55C6K'),/host/);console.log('VESTA_PASS: exact identity, primary cash price, unavailable products, installment/recommendation rejection');

const phone=box().replaceAll('TCL 55C6K','HONOR 200 12/512 Emerald Green')+'<div id="tab-description"><table><tr><td>Ընդհանուր հիշողություն:</td><td>512 GB</td></tr><tr><td>Ներքին հիշողություն:</td><td>12 GB</td></tr><tr><td>SIM Card:</td><td>Առկա է</td></tr></table></div><div id="tab-review">';
const axes=readVestaPhoneAxes(phone);assert.equal(axes.ram,12);assert.equal(axes.storage,512);assert.equal(axes.cell,true);
const row={id:'honor-200',kind:'phone',title:'HONOR 200 12/512 Emerald Green',productId:'123',url:'https://vesta.am/Mobile-phones/MOBILE/HONOR-200',axes:{ram:12,storage:512,color:'Green'}};
const product={id:row.id,variants:[{ram:12,storage:512}]};let warnings=[];
const collect=(html,extra={})=>collectVesta({get:async()=>html,pause:async()=>{},products:[product],rows:[row],previous:[],warn:(...args)=>warnings.push(args),...extra});
assert.equal((await collect(phone))[0].price,249000);
assert.equal((await collect(phone.replace('512 GB','256 GB'))).length,0,'changed hardware held');
assert.equal((await collect(phone.replace('value="123"','value="999"'))).length,0,'reused URL held');
assert.equal((await collect(phone,{products:[{id:row.id,variants:[{ram:8,storage:256}]}]})).length,0,'unsupported config held');
const old={id:row.id,url:row.url,shop:'vesta',price:240000,seen:'2026-11-01',checkedAt:'2026-11-01T10:00:00Z'};
assert.deepEqual(await collect('',{previous:[old]}),[old],'failure keeps dated evidence');
const unavailable=phone.replace('Առկա է</li>','Հասանելի չէ</li>').replace('<button id="button-cart">Գնել հիմա</button>','');
assert.equal((await collect(unavailable,{previous:[old]}))[0].inStock,false,'confirmed unavailability replaces previous stock');
const manifest=JSON.parse(fs.readFileSync('data/vesta-catalogue.json')),products=JSON.parse(fs.readFileSync('data/phones.json'));
assert.equal(new Set(manifest.map(x=>x.url)).size,manifest.length,'unique exact URLs');
for(const r of manifest){assert.ok(r.productId&&r.title&&r.sourceSHA256);const p=products.find(p=>p.id===r.id);assert.ok(p,'known model');if(['phone','tablet'].includes(r.kind)){assert.ok(p.variants.some(v=>v.ram===r.axes.ram&&v.storage===r.axes.storage));assert.ok(p.colors.includes(r.axes.color));if(r.kind==='tablet')assert.equal(typeof r.axes.cell,'boolean');}}
console.log('VESTA_COLLECTOR_PASS: hardware and product ID guards, unavailable and dated failure handling, manifest integrity');

const consoleRow={id:'sony-ps5-slim-digital',kind:'console',title:'SONY PS5 Slim Digital Edition Game pack Top Bundle',productId:'123',url:'https://vesta.am/consoles/sony-ps5-slim-digital',axes:{storage:825}};
const consolePage=box().replaceAll('TCL 55C6K',consoleRow.title)+'<div id="tab-description"><table><tr><td>SSD:</td><td>825 GB</td></tr></table></div><div id="tab-review">';
const readConsole=html=>collectVesta({get:async()=>html,pause:async()=>{},products:[{id:consoleRow.id,variants:[{ram:16,storage:825},{ram:16,storage:1024}]}],rows:[consoleRow],previous:[],warn:()=>{}});
assert.equal((await readConsole(consolePage))[0].storage,825);
assert.equal((await readConsole(consolePage.replace('825 GB','1 TB'))).length,0,'changed console SSD must not retain the old 825 GB label');
assert.equal((await readConsole(consolePage.replace('SSD:','Other:'))).length,0,'missing console storage must be held');
console.log('VESTA_CONSOLE_PASS: selected SSD is rechecked at every refresh');
