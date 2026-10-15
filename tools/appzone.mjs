import {storageGB,cpu} from './spec-values.mjs';
import fs from 'node:fs';
export const htmlText=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&#x([a-f0-9]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&nbsp;|\u00a0/g,' ').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const decode=s=>String(s||'').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,'&');
const money=s=>Number(htmlText(s).match(/\d[\d\s]*(?=\s*AMD)/)?.[0].replace(/\s/g,''))||0;
export function readAppzone(html,url) {
  const title=htmlText(html.match(/<h1\b[^>]*class=["'][^"']*product_title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  if(!title)throw new Error('AppZone product title missing: '+url);
  const table=html.match(/<table\b[^>]*class=["'][^"']*woocommerce-product-attributes[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)?.[1]||'';
  const specs=Object.fromEntries([...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[htmlText(m[1].match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)?.[1]),htmlText(m[1].match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1])]).filter(([k])=>k));
  const raw=html.match(/\bdata-product_variations=(['"])([\s\S]*?)\1/i)?.[2];
  const variations=raw?JSON.parse(decode(raw)):[];
  if(raw&&!Array.isArray(variations))throw new Error('AppZone variations require another request: '+url);
  const priceHtml=html.match(/<p\b[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]||'';
  const price=money(priceHtml.match(/<ins\b[^>]*>([\s\S]*?)<\/ins>/i)?.[1]||priceHtml);
  const cart=html.match(/<button\b[^>]*class=["'][^"']*single_add_to_cart_button[^"']*["'][^>]*>([\s\S]*?)<\/button>/i)?.[0]||'';
  const inStock=/Add to cart/i.test(htmlText(cart))&&!/\bdisabled\b/.test(cart)&&!/<p\b[^>]*class=["'][^"']*out-of-stock/i.test(html);
  const image=decode(html.match(/\bdata-large_image=["']([^"']+)["']/i)?.[1]||html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1]);
  return {url,title,specs,variations,price,inStock,image,description:htmlText(html.match(/<div\b[^>]*class=["'][^"']*woocommerce-product-details__short-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])};
}
const singleCapacity=s=>{const all=[...String(s||'').matchAll(/\b(\d+)\s*(GB|TB)\b/gi)].map(m=>storageGB(m[1]+m[2])).filter(Boolean);return new Set(all).size===1?all[0]:null;};
const ramGB=s=>Number(String(s||'').match(/^(\d+)\s*GB\b/i)?.[1])||null;
export function appzoneOffers(p) {
  const s=p.specs||{},variants=p.variations?.length?p.variations:[{display_price:p.price,is_in_stock:p.inStock,is_purchasable:p.inStock,variation_is_active:true,variation_is_visible:true,attributes:{}}];
  return variants.flatMap(v=>{
    const price=Number(v.display_price);if(!Number.isFinite(price)||price<=0)return[];
    const a=v.attributes||{},memory=a.attribute_pa_memory||'',pair=memory.match(/^(\d+)-(\d+)\s*gb$/i);
    const storage=pair?storageGB(pair[2]+'GB'):(singleCapacity(memory.replace(/-/g,' '))??singleCapacity(s.Memory));
    const ram=Number(pair?.[1])||ramGB((a.attribute_pa_ram||'').replace(/-/g,' '))||ramGB(s['Working memory'])||
      Number(p.description?.match(/\b(\d+)\s*GB\s*(?:DDR\d\s*)?RAM\b/i)?.[1])||null;
    const size=parseFloat(String(s.Screen||s['Էկրանի անկյունագիծ (դյույմ)']||'').replace(',','.'))||Number(p.title.match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:[″”"]|inch)/i)?.[1])||null;
    const color=a.attribute_pa_color||null;
    let processor=String(s.Processor||'').replace(/^ULTRA\s+/i,'Intel Core Ultra ').replace(/^CORE\s+/i,'Intel Core ').replace(/^RYZEN\s+/i,'AMD Ryzen ');
    processor=cpu(processor.replace(/\s+\d+[- ]Core.*$/i,''))||(/Apple/i.test(s.Processor||'')?s.Processor:null);
    if(!processor)processor=cpu(p.description||'');
    const gpu=s['Video card']||null,screenType=/\b(OLED|IPS|TN|VA)\b/i.exec(s.Screen||s['Screen type']||'')?.[1].toUpperCase();
    const resolution=s['Screen resolution']?.match(/\d{3,4}\s*[x×]\s*\d{3,4}/)?.[0].replace(/\s/g,'').replace('×','x');
    const configSpecs={...(processor?{chipset:{name:processor}}:{}),...(size||screenType||resolution?{display:{...(size?{size}:{}),...(screenType?{type:screenType}:{}),...(resolution?{resolution}:{})}}:{}),...(gpu?{graphics:{name:gpu,type:/RTX|GTX|Radeon RX/i.test(gpu)?'discrete':'integrated'}}:{})};
    const esim=a['attribute_pa_sim-card-quantity']==='esim'?true:a['attribute_pa_sim-card-quantity']==='1sim'?false:/\(eSIM\)/i.test(p.title)?true:/Nano-SIM/i.test(p.title)?false:undefined;
    return [{url:p.url,title:p.title,price:Math.round(price),storage,ram,size,color,image:v.image?.full_src||v.image?.url||p.image||null,sku:v.variation_id?String(v.variation_id):null,
      attributes:a,inStock:v.is_in_stock===true&&v.is_purchasable===true&&v.variation_is_active!==false&&v.variation_is_visible!==false,
      ...(esim!==undefined?{esim,simFromPage:true}:{}),...(a.attribute_pa_connectivity?{cell:/cellular/i.test(a.attribute_pa_connectivity)}:{}),configSpecs}];
  });
}

export function existingConfiguration(product, offer) {
  if (!['phone','tablet','laptop','desktop','console','ereader'].includes(product.category)) return true;
  return (product.variants || []).some(v =>
    (offer.storage == null || v.storage === offer.storage) &&
    (offer.ram == null || v.ram == null || v.ram === offer.ram) &&
    (offer.size == null || v.size == null || Math.floor(v.size) === Math.floor(offer.size)));
}

export function reviewAppzoneOffer(offer,product,review) {
  if(!review||review.hold||review.holdColors?.includes(offer.attributes?.attribute_pa_color))return null;
  const o={...offer,id:review.id};
  if(o.color) {
    const raw=o.color;
    o.color=review.colors?.[raw]||null;
    // A new or conflicting shop colour requires review, rather than showing the
    // same unidentified offer under every colour on Better.am.
    if(!o.color)return null;
  } else if(product.colors?.length===1) o.color=product.colors[0];
  if(review.storage!=null)o.storage=review.storage;
  if(review.ram!=null)o.ram=review.ram;
  if(review.size!=null)o.size=review.size;
  if(review.cpu){o.configSpecs ||= {};o.configSpecs.chipset={name:review.cpu};}
  if(o.size!=null&&product.variants?.some(v=>v.size===Math.floor(o.size)))o.size=Math.floor(o.size);
  if(o.ram==null&&o.storage!=null){const ram=[...new Set((product.variants||[]).filter(v=>v.storage===o.storage&&(v.size==null||o.size==null||v.size===o.size)).map(v=>v.ram).filter(v=>v!=null))];if(ram.length===1){o.ram=ram[0];o.ramFromCatalog=true;}}
  if(review.cell!=null)o.cell=review.cell;
  if(product.category!=='laptop')delete o.configSpecs;
  else {
    if(product.brand==='Apple')delete o.configSpecs.display;
    for(const block of review.ignoreSpecBlocks||[])delete o.configSpecs[block];
    o.cpu=o.configSpecs?.chipset?.name||null;
  }
  if(!existingConfiguration(product,o))return null;
  delete o.attributes;
  return o;
}

export async function collectAppzone({get,match,pause,products}) {
  const reviews=JSON.parse(fs.readFileSync('data/appzone-map.json','utf8'));
  const urls=new Set(Object.keys(reviews));
  for(const category of ['phones','computers','headphones','tablets']){
    let url=`https://appzone.am/en/product-category/${category}/`;
    const visited=new Set();
    while(url){
      if(visited.has(url)||visited.size>=20)throw new Error('AppZone pagination loop: '+category);
      visited.add(url);const html=await get(url);await pause();
      if(!html||!html.includes('/en/Assortment/'))throw new Error('AppZone category unreadable: '+url);
      for(const m of html.matchAll(/href=["'](https:\/\/appzone\.am\/en\/Assortment\/[^"'?#]+\/?)["']/gi))urls.add(m[1]);
      url=[...html.matchAll(/<a\b[^>]*class=["'][^"']*\bnext\b[^"']*page-numbers[^"']*["'][^>]*>/gi)].map(m=>m[0].match(/href=["']([^"']+)/i)?.[1]).find(u=>u?.startsWith(`https://appzone.am/en/product-category/${category}/page/`))||null;
    }
  }
  const out=[];
  for(const url of urls){
    const html=await get(url);await pause();const page=readAppzone(html,url);
    let review=reviews[url];
    if(!review){match(page.title,{price:page.price||appzoneOffers(page)[0]?.price,url});continue;}
    const product=products.find(p=>p.id===review.id);if(!product)continue;
    for(const raw of appzoneOffers(page)){const o=reviewAppzoneOffer(raw,product,review);if(o)out.push(o);}
  }
  return out;
}
