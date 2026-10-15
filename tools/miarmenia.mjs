import {htmlText,existingConfiguration} from './appzone.mjs';
import {storageGB} from './spec-values.mjs';
import fs from 'node:fs';

export function readMiArmenia(html,url) {
  const title=htmlText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const priceBlock=html.match(/<li\b(?=[^>]*\bid=["']old-price["'])[^>]*>([\s\S]*?)<\/li>/i)?.[1];
  const price=Number(htmlText(priceBlock).match(/\d[\d\s]*(?=\s*AMD)/)?.[0].replace(/\s/g,''));
  const cart=html.match(/<div\b(?=[^>]*\bid=["']productCart["'])[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if(!title||priceBlock==null||cart==null||!Number.isFinite(price))throw new Error('MiArmenia product markup missing');
  const button=cart.match(/<a\b(?=[^>]*\bid=["']add-to-cart["'])[^>]*>/i)?.[0];
  const inStock=Boolean(button)&&!/\bdisabled\b/i.test(button)&&/Add to Cart/i.test(htmlText(cart));
  const specs=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(m=>htmlText(m[1])).join(' ');
  const pair=title.match(/\b(\d+)\s*(?:GB)?\s*\/\s*(\d+)\s*(GB|TB|G)?\b/i);
  const storage=pair?storageGB(pair[2]+(pair[3]?.toUpperCase()==='G'?'GB':pair[3]||'GB')):storageGB(title.match(/\b\d+\s*(?:GB|TB)\b/i)?.[0]);
  const ram=Number(pair?.[1])||null;
  const statedStorage=storageGB(specs.match(/(?:Internal Storage|Storage Capacity)\s*:\s*(\d+\s*(?:GB|TB))/i)?.[1]);
  const statedRam=Number(specs.match(/\bRAM\s*:\s*(\d+)\s*GB/i)?.[1])||null;
  // Several retailer descriptions were copied between capacities. Do not choose
  // one conflicting source value silently or infer a capacity from the price.
  const conflict=(storage&&statedStorage&&storage!==statedStorage)||(ram&&statedRam&&ram!==statedRam);
  return {url,title,price:Math.round(price),inStock,storage,ram,conflict:Boolean(conflict),statedStorage,statedRam,specs};
}

export function miReviewMatches(page,review) {
  return !page.conflict && (!review.title || review.title===page.title) &&
    !(page.ram && review.ram && page.ram!==review.ram) &&
    !(page.storage && review.storage && page.storage!==review.storage);
}
export async function collectMiArmenia({get,pause}) {
  const reviews=JSON.parse(fs.readFileSync('data/miarmenia-map.json','utf8')),rows=[];
  const products=new Map(JSON.parse(fs.readFileSync('data/phones.json','utf8')).map(p=>[p.id,p]));
  for(const [url,review]of Object.entries(reviews)){
    const page=readMiArmenia(await get(url),url);await pause();
    if(!miReviewMatches(page,review)||!products.has(review.id)||!existingConfiguration(products.get(review.id),review)){
      rows.push({id:review.id,title:page.title,url,price:0,inStock:false});continue;
    }
    const {reviewed,title,...config}=review;
    rows.push({title:page.title,url,price:page.price,inStock:page.inStock,...config});
  }
  return rows;
}
