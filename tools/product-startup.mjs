import {groupCatalogue,pack,unpackSource,catalogueSource}from'./compact-data.mjs';
// All identities remain present for saved brands/categories/comparison. Only the
// active category's listing specifications, prices and photos are needed initially.
export function categorySeed(products,maps,prices,drops,category){
  const ids=new Set(products.filter(p=>category==null||(p.category||'phone')===category).map(p=>p.id));
  if(!ids.size)throw new Error('Unknown startup category');
  const records=products.map(p=>ids.has(p.id)?p:{id:p.id,brand:p.brand,name:p.name,category:p.category||'phone',_detailChunk:p._detailChunk});
  const pick=m=>Object.fromEntries(Object.entries(m||{}).filter(([id])=>ids.has(id)));
  return {catalogue:groupCatalogue(records,Object.fromEntries(Object.entries(maps).map(([k,m])=>[k,pick(m)]))),prices:{...prices,offers:pick(prices.offers)},drops:drops.filter(d=>ids.has(d.id))};
}
export function mergeCatalogue(target,payload,hydrated,decodeCatalogue){
  const incoming=decodeCatalogue(payload.catalogue),byId=new Map(target.DATA.map(p=>[p.id,p]));
  if(incoming.DATA.length!==target.DATA.length||incoming.DATA.some(p=>!byId.has(p.id)))throw new Error('Catalogue identity mismatch');
  const ready=new Set(hydrated||[]);
  for(const p of incoming.DATA)if(!ready.has(p._detailChunk)){
    const existing=byId.get(p.id);for(const key of Object.keys(existing))if(!(key in p))delete existing[key];
    Object.assign(existing,p);
  }
  for(const key of ['IMGDATA','THUMBDATA','COLORIMG','COLORTHUMB','PBOX'])Object.assign(target[key],incoming[key]);
  for(const [id,rows]of Object.entries(payload.prices.offers))if(!ready.has(byId.get(id)?._detailChunk))target.PRICES.offers[id]=rows;
  Object.assign(target.PRICES.shops,payload.prices.shops);target.PRICES.generated=payload.prices.generated;
  target.DROPS.splice(0,target.DROPS.length,...payload.drops);
}
export function installCatalogueLoader(target,url,decodeCatalogue,merge,host){
  const state={ready:false,request:null,url};
  host.betterApplyCatalogue=payload=>{merge(target,payload,host.betterDetailChunks,decodeCatalogue);state.ready=true;};
  state.load=()=>{
    if(state.ready)return Promise.resolve();
    if(state.request)return state.request;
    state.request=new Promise((resolve,reject)=>{
      const script=host.document.createElement('script');script.src=url;script.fetchPriority='high';
      const fail=()=>{script.remove();reject(new Error('Catalogue unavailable'));};
      script.onload=()=>state.ready?resolve():fail();script.onerror=fail;host.document.head.appendChild(script);
    }).finally(()=>{state.request=null;});
    return state.request;
  };
  host.betterCatalogueState=state;return state;
}
export function productSeedSource(seed,{chunks,extrasUrl,catalogueUrl}){
  const J=x=>JSON.stringify(x).replace(/</g,'\\u003c');
  return unpackSource+catalogueSource+`const startupSeed=betterUnpack(${J(pack(seed))});\nconst {DATA,IMGDATA,THUMBDATA,COLORIMG,COLORTHUMB,PBOX}=betterCatalogue(startupSeed.catalogue);\nconst PRICES=startupSeed.prices;const DROPS=startupSeed.drops;\nconst DETAIL_CHUNKS=${J(chunks)};const DETAIL_DATA_URL=${J(extrasUrl)};\nconst HEROPREVIEWS={};let COMPARE_WITH={};\n(${installCatalogueLoader.toString()})({DATA,IMGDATA,THUMBDATA,COLORIMG,COLORTHUMB,PBOX,PRICES,DROPS},${J(catalogueUrl)},betterCatalogue,${mergeCatalogue.toString()},window);`;
}
export function fullCatalogueSource(payload){return `window.betterApplyCatalogue(betterUnpack(${JSON.stringify(pack(payload)).replace(/</g,'\\u003c')}));`;}
