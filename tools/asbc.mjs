import {storageGB} from './spec-values.mjs';

// ASBC's public Nuxt payload holds exact SKU prices and stock. Only the requested
// category's products are read; promotion/similar-product cards are not offers.
export function readAsbc(html) {
  const raw=html.match(/<script\b[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) throw new Error('ASBC Nuxt data missing');
  const nodes=JSON.parse(raw), memo=new Map();
  function decode(i) {
    if (i<0) return null;
    if (memo.has(i)) return memo.get(i);
    const x=nodes[i];
    if (Array.isArray(x)) {
      if (['ShallowReactive','Reactive','Ref','ShallowRef'].includes(x[0])) return decode(x[1]);
      const out=[]; memo.set(i,out); for (const v of x) out.push(decode(v)); return out;
    }
    if (x && typeof x==='object') {
      const out={};memo.set(i,out);for (const [k,v] of Object.entries(x)) out[k]=decode(v);return out;
    }
    return x;
  }
  for (const v of Object.values(decode(0)?.data || {})) {
    if (v?.categoryBySlug) return {products:v.categoryBySlug.products || [],total:v.categoryBySlug.products_meta_count};
    if (v?.product) return {products:[v.product],total:1};
  }
  throw new Error('ASBC product data missing');
}
export const asbcFeatures=p=>Object.fromEntries((p.feature_groups||[]).flatMap(g=>(g.features||[]).map(f=>[f.external_cf_id,f.value])));
const text=s=>String(s||'').replace(/\s+/g,' ').replace(/Wi[‑–]Fi/g,'Wi-Fi').trim();
export function asbcMatchName(p) {
  const name=text(p.name), f=asbcFeatures(p);
  if (/^Apple TV.*\bA2843\b/i.test(name)) return 'Apple TV 4K A2843';
  if (/^AirPods 5 with Wireless Charging Case\b/i.test(name)) return 'Apple AirPods 5 Wireless';
  if (/Apple Watch/i.test(name)) {
    const series=name.match(/Apple Watch (Series \d+|Ultra \d+|SE \d+)/i)?.[1];
    if (series) return 'Apple Watch '+series.replace(/^SE (\d+)$/i,'SE Gen.$1')+(/Series 12|Ultra 4/i.test(series)?' GPS'+(/Ultra/.test(series)?' + Cellular':''):'');
  }
  if (/iPad/i.test(name)) {
    const family=/iPad\s+(Pro|Air|mini)/i.exec(name)?.[1] || '';
    const chip=/Apple\s+(M\d|A\d+)/i.exec(f.CPU||'')?.[1];
    // Screen size remains a configuration, not part of model matching.
    if (chip && !/mini/i.test(family)) return `Apple iPad${family?' '+family:''} ${chip}`;
  }
  if (/AirPods/i.test(name)) return 'Apple '+name.split(/,?\s*Model\b/i)[0].trim();
  return 'Apple '+name.replace(/^Apple\s+/i,'');
}
export function asbcOffer(p) {
  const title=text(p.name), f=asbcFeatures(p), price=Number(p.final_price);
  if (p.currency!=='AMD'||!Number.isFinite(price)||price<=0||!/^[a-z0-9][a-z0-9-]*$/i.test(p.slug||'')) return null;
  const watch=/\bWatch\b/i.test(title), tablet=/\biPad\b/i.test(title);
  const size=watch ? Number(title.match(/\b(\d{2})mm\b/i)?.[1])||null
    : Number(title.match(/\b(\d{1,2}(?:\.\d+)?)-inch\b/i)?.[1])||null;
  let color=text(f.EXTERNAL_COLOR).replace(/\s+Alumini?um$/i,'') ||
    title.match(/\b(?:Glacier|Burgundy|Black|Silver|White|Pink|Blue|Green)\b/i)?.[0] || null;
  if (/Watch Ultra 3/i.test(title) && /^(Black|Natural)$/i.test(color||'')) color+=' Titanium';
  const ram=Number(String(f.RAM_SIZE||f.RAM||'').match(/^(\d+)\s*GB$/i)?.[1])||null;
  const image=p.variations?.find(v=>v.sku===p.sku)?.images?.[0];
  const band=watch ? title.match(/\b(Milanese Loop|Trail Loop|Alpine Loop|Ocean Band|Sport Band|Sport Loop)\b/i)?.[0]||null:null;
  return {title,url:`https://catalog.asbc.am/en/product/${p.slug}`,sku:p.sku,price:Math.round(price),
    storage:watch?size:storageGB(f.INTERNAL_MEMORY_SIZE||f.STORAGE_CAPACITY)||storageGB(title.match(/\b\d+\s*(?:GB|TB)\b/i)?.[0]),
    ram,size,color,band,...(tablet?{cell:/Cellular/i.test(title)}:{}),
    image:image?`https://prod-cdn.prod.asbis.io/s3size/el:t/f:webp/rt:fill/plain/s3:/${image}`:null,
    inStock:Number.isFinite(p.real_stock)&&p.real_stock>0&&p.available_action==='add_to_cart'&&
      (p.condition==null||p.condition===1)&&(p.status==null||p.status===1)};
}
export async function collectAsbc({get,match,pause}) {
  const out=[], seen=new Set();
  for (const category of ['iphone','ipad','apple-watch','airpods']) {
    let count=0, total=Infinity;
    for(let page=1;count<total&&page<=30;page++) {
      const url=`https://catalog.asbc.am/en/category/${category}?limit=100&page=${page}`;
      const html=await get(url);await pause();
      const data=readAsbc(html);total=data.total;
      if(!Number.isFinite(total)||!data.products.length) throw new Error(`ASBC incomplete category: ${category}`);
      let fresh=0;
      for(const p of data.products) {
        if(seen.has(p.slug)) continue;seen.add(p.slug);fresh++;count++;
        const o=asbcOffer(p);if(!o) continue;
        const id=match(asbcMatchName(p));if(id) out.push({...o,id});
      }
      if(!fresh&&count<total) throw new Error(`ASBC pagination repeated before completion: ${category}`);
    }
    if(count<total) throw new Error(`ASBC category truncated: ${category}`);
  }
  const tv=readAsbc(await get('https://catalog.asbc.am/en/product/apple-tv-mn893rua')).products[0];
  const o=asbcOffer(tv), id=match(asbcMatchName(tv));if(o&&id)out.push({...o,id});
  return out;
}
