import {htmlText,existingConfiguration} from './appzone.mjs';
import fs from 'node:fs';
import {storageGB} from './spec-values.mjs';

const amount=value=>Number(String(value??'').replace(/[\s,\u00a0]/g,''));
export function likeMobileMemory(title,description='') {
  const pair=title.match(/\b(\d+)\s*(?:GB)?\s*\/\s*(\d+)\s*(GB|TB)\b/i);
  const ram=Number(pair?.[1])||Number(description.match(/\b(?:RAM|Working memory)\s*[-:]?\s*(\d+)\s*GB/i)?.[1])||null;
  const storage=pair?storageGB(pair[2]+pair[3]):storageGB(title.match(/\b\d+\s*(?:GB|TB)\b/i)?.[0])||storageGB(description.match(/\b(?:ROM|Internal Storage|Storage Capacity)\s*[-:]?\s*(\d+\s*(?:GB|TB))/i)?.[1]);
  return {ram,storage};
}
export function readLikeMobile(html) {
  const raw=html.match(/<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if(!raw)throw new Error('LikeMobile product data missing');
  const page=JSON.parse(raw).props?.pageProps;
  if(!page||page.selectedRate?.code!=='AMD')throw new Error('LikeMobile currency is not AMD');
  const links=new Map();
  for(const m of html.matchAll(/<a\b[^>]*href=["'](\/en\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const title=htmlText(m[2]);if(!title)continue;
    if(!links.has(title))links.set(title,new Set());links.get(title).add('https://likemobile.am'+m[1]);
  }
  return {page,links};
}
export function likeMobileRows({page,links},today=new Date().toISOString().slice(0,10)) {
  const source=page.productsList?.data;if(!Array.isArray(source))throw new Error('LikeMobile inventory missing');
  return source.flatMap(p=>{
    // Parent prices are minima, not an extra purchasable configuration. Children
    // are separately listed with their own actual storefront links and stock.
    if(p.type!=='simple')return[];
    const f=p.flats?.find(f=>f.locale==='en'),urls=links.get(f?.name?.trim());
    if(!f||urls?.size!==1)return[];
    const regular=amount(f.price),special=amount(f.special_price);
    const sale=special>0&&special<regular&&(!f.special_price_from||f.special_price_from.slice(0,10)<=today)&&(!f.special_price_to||f.special_price_to.slice(0,10)>=today);
    const price=sale?special:regular;if(!Number.isFinite(price)||price<=0)return[];
    const quantities=p.qty||[],known=quantities.length>0&&quantities.every(n=>Number.isFinite(amount(n)));
    const inStock=Number(f.status)===1&&known&&quantities.reduce((n,q)=>n+amount(q),0)>0&&p.isProductInStock!==false;
    const image=p.images?.[0];
    return [{title:f.name.trim(),url:[...urls][0],price:Math.round(price),inStock,sku:String(p.id),
      image:image?'https://likemobile.am/'+image.replace(/^\/?(?:storage\/)?/,'storage/'):null,
      description:htmlText(f.description||'')}];
  });
}

// Hand verification of an exact shop link must use its selected SKU, never a
// configurable parent's minimum or a related product's price.
export function readLikeMobileProduct(html,url,today) {
  const parsed=readLikeMobile(html),page=parsed.page,root=page.serverSideProduct;
  const slug=decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1));
  if(!root||page.productSlug!==slug)throw new Error('LikeMobile detail identity missing');
  const candidates=root.type==='simple'?[root]:(root.variants||[]);
  const exact=candidates.filter(p=>p.type==='simple'&&p.flats?.some(f=>f.locale==='en'&&f.url_key===slug));
  if(exact.length!==1)throw new Error('LikeMobile detail SKU is ambiguous');
  const title=exact[0].flats.find(f=>f.locale==='en').name.trim();
  const rows=likeMobileRows({page:{...page,productsList:{data:exact}},links:new Map([[title,new Set([url])]])},today);
  if(rows.length!==1)throw new Error('LikeMobile detail price missing');
  return rows[0];
}

export async function collectLikeMobile({get,pause,match}) {
  const reviews=JSON.parse(fs.readFileSync('data/likemobile-map.json','utf8'));
  const products=new Map(JSON.parse(fs.readFileSync('data/phones.json','utf8')).map(p=>[p.id,p]));
  const {page:home}=readLikeMobile(await get('https://likemobile.am/en'));await pause();
  const wanted=new Set(['phones','notebooks','watches1','tablets','audio-equipment','game-consoles','beauty-and-care','small-household-appliances','large-household-appliances','tvs','smart-gadgets']);
  const flatten=items=>(items||[]).flatMap(c=>[c,...flatten(c.children)]);
  const categories=flatten(home.categories?.[0]?.children).filter(c=>wanted.has(c.slug));
  if(categories?.length!==wanted.size)throw new Error('LikeMobile category inventory changed');
  const rows=new Map();
  for(const cat of categories){
    let pageCount=1;const signatures=new Set();
    for(let n=1;n<=pageCount;n++){
      const url='https://likemobile.am'+cat.frontLink+(n>1?'?page='+n:'');
      const data=readLikeMobile(await get(url));await pause();
      const inventory=data.page.productsList;pageCount=Number(inventory?.pageCount);
      if(!Number.isInteger(pageCount)||pageCount<1||pageCount>100)throw new Error('LikeMobile invalid pagination');
      const signature=(inventory.data||[]).map(p=>p.id).join(',');
      if(signatures.has(signature))throw new Error('LikeMobile repeated inventory page');signatures.add(signature);
      for(const o of likeMobileRows(data)){
        const review=reviews[o.url];
        if(!review){match(o.title,{price:o.price,url:o.url});continue;}
        if(!products.has(review.id)||!existingConfiguration(products.get(review.id),review))continue;
        if(review.title&&review.title.trim()!==o.title.trim())continue;
        const current=likeMobileMemory(o.title,o.description);
        if((current.ram&&review.ram&&current.ram!==review.ram)||(current.storage&&review.storage&&current.storage!==review.storage))continue;
        const {reviewed,title,...config}=review;
        const {description,...offer}=o;
        rows.set(o.sku,{...offer,...config});
      }
    }
  }
  const found=new Set([...rows.values()].map(o=>o.url));
  // A complete inventory read reaches here; disappeared SKUs are not carried forward.
  const removed=Object.entries(reviews).filter(([url])=>!found.has(url)).map(([url,r])=>({id:r.id,url,title:r.title||'',price:0,inStock:false}));
  return [...rows.values(),...removed];
}
