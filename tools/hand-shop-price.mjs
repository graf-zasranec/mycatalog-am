import {readLikeMobileProduct,likeMobileMemory} from './likemobile.mjs';
import {readAppzone,appzoneOffers} from './appzone.mjs';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function readShopHandPrice(html,row){
 const host=new URL(row[4]).hostname.replace(/^www\./,'');
 if(!['likemobile.am','appzone.am'].includes(host))return null;
 try{
  const cap=Number(row[2])||null,legacyRam=cap!=null&&cap<=192&&/\bRAM\b/i.test(row[1]);
  const ram=Number(row[6])||(legacyRam?cap:null),storage=legacyRam?null:cap;
  let offers;
  if(host==='likemobile.am'){
   const o=readLikeMobileProduct(html,row[4]);offers=[{...o,...likeMobileMemory(o.title,o.description)}];
  }else offers=appzoneOffers(readAppzone(html,row[4]));
  const wantedColor=norm(row[3]),wantedSim=/\bNano[ -]?SIM\b/i.test(row[1])?false:/\beSIM\b/i.test(row[1])?true:null;
  const hits=offers.filter(o=>Number.isFinite(o.price)&&o.price>0
   &&(storage==null||o.storage===storage)&&(ram==null||o.ram===ram)
   &&(!wantedColor||norm(o.color)===wantedColor||!o.color&&new RegExp('(?:^|[^a-z0-9])'+wantedColor.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z0-9])').test(norm(o.title+' '+(o.description||''))))
   &&(wantedSim==null||o.esim===wantedSim));
  if(!hits.length||new Set(hits.map(o=>o.price)).size!==1)return null;
  return {price:hits[0].price,how:host==='likemobile.am'?'likemobile-sku':'appzone-sku',
   stock:hits.some(o=>o.inStock===true)?true:hits.every(o=>o.inStock===false)?false:undefined};
 }catch{return null;}
}
