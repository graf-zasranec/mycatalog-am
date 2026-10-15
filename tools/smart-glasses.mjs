import fs from'node:fs';import {htmlText} from './appzone.mjs';
export function readSmartGlasses(html,review,url){
 const products=[];const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(v['@type']==='Product'||Array.isArray(v['@type'])&&v['@type'].includes('Product'))products.push(v);if(v['@graph'])visit(v['@graph']);}};
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(m[1]));}catch{}}
 const product=products.find(p=>htmlText(p.name)===review.title);
 if(!products.length)throw Error('Smart-glasses product schema missing: '+url);
 if(!product)return {id:review.id,url,title:review.title,price:0,inStock:false};
 const offers=Array.isArray(product.offers)?product.offers:[product.offers];const own=offers.filter(o=>o&&o.priceCurrency==='AMD'&&Number.isFinite(Number(o.price))&&Number(o.price)>0);
 if(own.length!==1)throw Error('Smart-glasses exact AMD offer missing: '+url);
 const o=own[0],price=Math.round(Number(o.price));const cash=html.match(/<span\b(?=[^>]*\bid=["']price_small["'])[^>]*data-price=["']([\d, ]+)["']/i)?.[1];
 if(cash&&Number(cash.replace(/\D/g,''))!==price)throw Error('Smart-glasses cash/schema conflict: '+url);
 if(!['https://schema.org/InStock','http://schema.org/InStock','https://schema.org/OutOfStock','http://schema.org/OutOfStock','https://schema.org/PreOrder','http://schema.org/PreOrder'].includes(o.availability))throw Error('Smart-glasses stock unknown: '+url);
 return {id:review.id,url,title:review.title,price,storage:32,color:review.color,inStock:/\/InStock$/.test(o.availability)};
}
export async function collectSmartGlasses({get,pause}){
 const file='data/smart-glasses-map.json';if(!fs.existsSync(file))return[];
 const reviews=JSON.parse(fs.readFileSync(file,'utf8')),rows=[];
 for(const [url,review]of Object.entries(reviews)){rows.push(readSmartGlasses(await get(url),review,url));await pause();}return rows;
}
