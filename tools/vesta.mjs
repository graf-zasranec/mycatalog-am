import fs from 'node:fs';
const text=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,hex,dec)=>String.fromCodePoint(parseInt(hex||dec,hex?16:10))).replace(/\s+/g,' ').trim();
const identity=s=>text(s).toUpperCase().replace(/[^A-Z0-9]/g,'');
export function readVesta(html,url,{expectedTitle}={}){
 if(!/^https:\/\/(?:www\.)?vesta\.am\//.test(url))throw Error('Unexpected Vesta host');
 const start=/<div\b[^>]*class="[^"]*\bproduct-right\b[^"]*"[^>]*>/i.exec(html);if(!start)throw Error('Missing product buy box');
 const box=html.slice(start.index).split('<script')[0];const title=text(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(box)?.[1]);
 const sku=text(/<li[^>]*>\s*<span[^>]*>Ապրանքի կոդը<\/span>([\s\S]*?)<\/li>/i.exec(box)?.[1]);
 const productId=/<input\b(?=[^>]*name="product_id")[^>]*value="(\d+)"/i.exec(box)?.[1];
 if(!title||!sku||!productId||(/\/tv\//i.test(new URL(url).pathname)&&identity(title)!==identity(sku))||expectedTitle&&identity(title)!==identity(expectedTitle))throw Error('Vesta product identity mismatch');
 const status=text(/<li[^>]*>\s*<span[^>]*>Հասանելիությունը<\/span>([\s\S]*?)<\/li>/i.exec(box)?.[1]);
 const inStock=status==='Առկա է'&&/<button\b[^>]*id="button-cart"/i.test(box);if(!inStock&&status!=='Հասանելի չէ')throw Error('Unknown Vesta availability');
 const prices=/<ul\b[^>]*class="[^"]*\bprice\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/i.exec(box)?.[1]||'';
 const priceText=text(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(prices)?.[1]);const price=Number(priceText.replace(/[^0-9]/g,''))||0;
 if(inStock&&(!priceText.includes('֏')||price<5000))throw Error('Missing Vesta cash price');
 return{title,sku,productId,price,inStock,url};
}
// Reviewed URLs keep immutable OpenCart IDs. A failed fetch keeps its original
// timestamp; an explicit unavailable product suppresses its previous offer.
export async function collectVesta({get,pause,products,
 rows=JSON.parse(fs.readFileSync('data/vesta-catalogue.json','utf8')),
 previous=Object.values(JSON.parse(fs.readFileSync('data/prices.json','utf8')).offers||{}).flat(),warn=console.warn}){
 const ids=new Map(products.map(p=>[p.id,p])),offers=[];
 for(const row of rows){if(!row.id||!ids.has(row.id))continue;try{
  const html=await get(row.url);await pause();if(!html)throw Error('Empty source response');
  const current=readVesta(html,row.url,{expectedTitle:row.title});
  if(current.productId!==row.productId)throw Error('Vesta product ID changed');
  if(['phone','tablet'].includes(row.kind)&&current.inStock){
   const fresh=readVestaPhoneAxes(html);
   if(fresh.ram!==row.axes?.ram||fresh.storage!==row.axes?.storage)throw Error('Vesta selected hardware changed');
   if(row.kind==='tablet'&&fresh.cell!==row.axes?.cell)throw Error('Vesta connectivity changed');
   if(!ids.get(row.id).variants?.some(v=>v.ram===fresh.ram&&v.storage===fresh.storage))throw Error('Unsupported catalogue configuration');
  }
  if(row.kind==='console'&&current.inStock&&row.axes?.storage!=null){
   const raw=readVestaPhoneAxes(html).fields?.SSD;
   const match=/^(\d+)\s*(GB|TB)$/i.exec(raw||'');
   const storage=match?Number(match[1])*(match[2].toUpperCase()==='TB'?1024:1):null;
   if(storage!==row.axes.storage)throw Error('Vesta console storage changed');
   if(!ids.get(row.id).variants?.some(v=>v.storage===storage))throw Error('Unsupported console configuration');
  }
  offers.push({...current,id:row.id,...(row.axes||{}),title:row.offerTitle||current.title,ramFromPage:row.axes?.ram!=null||undefined});
 }catch(e){const kept=previous.filter(o=>o.shop==='vesta'&&o.url===row.url&&!o.seeded);offers.push(...kept);warn('Vesta held:',row.url,e.message,'retained',kept.length,'with original dates');}}
 return offers;
}
export function readVestaPhoneAxes(html){
 const at=html.search(/id="tab-description"/i);if(at<0)return{};const part=html.slice(at).split(/id="tab-review"/i)[0],fields={};
 for(const m of part.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>text(x[1]));if(cells.length===2)fields[cells[0].replace(/:$/,'')]=cells[1];}
 const capacity=s=>{const m=/^(\d+)\s*(GB|TB)$/i.exec(s||'');return m?Number(m[1])*(m[2].toUpperCase()==='TB'?1024:1):null};
 const storage=capacity(fields['Ընդհանուր հիշողություն']),rawRam=capacity(fields['Ներքին հիշողություն']);
 return{storage,ram:rawRam&&rawRam<=192?rawRam:null,simText:fields['SIM Card']||fields.Card||null,cell:fields['SIM Card']==='Առկա չէ'?false:/^(?:1|2|Առկա է)$/.test(fields['SIM Card']||'')?true:undefined,fields};
}
