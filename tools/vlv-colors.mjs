// VLV's numeric URLs carry no finish. Read the exact merchant title, preserving
// evidence even when our older catalogue palette has not listed that finish yet.
import {canonicalColors} from './canonical-colors.mjs';
const names=['Midnight Black','Rose Gold','Space Gray','Space Grey','Gray Green','GrayGreen','Stainless Steel','Jet Black','White','Black','Brown','Blue','Gray','Grey','Green','Silver','Inox','Gold','Pink','Purple','Beige','Lavender','Yellow','Orange','Burgundy','Graphite','Cream','Ivory','Charcoal','Navy','Teal','Mint','Violet','Champagne'];
for(const prefix of ['Light','Dark']) for(const color of ['Black','Blue','Gray','Grey','Green','Gold','Silver','Purple','Pink']) names.push(`${prefix} ${color}`);
const short={BEG:'Beige',BK:'Black',BLK:'Black',WH:'White',WHT:'White',BLU:'Blue',GRY:'Gray',GY:'Gray',GRN:'Green',PNK:'Pink',SLV:'Silver',GLD:'Gold'};
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const norm=s=>String(s).toLowerCase().replace(/\band\b/g,' ').replace(/grey/g,'gray').replace(/graygreen/g,'gray green').replace(/[^a-z]+/g,' ').trim();
export function vlvTitleColor(title,palette=[]){
 const text=String(title||'').replace(/^BLACK\s*[+&]\s*DECKER\b/i,'');
 const hits=[];
 // Sony's WH prefix means wireless headphones, never White. Only these
 // explicit audio-SKU slash suffixes establish a finish; other model letters do not.
 const sony=/\bSONY\s+(?:WH|WF|WI)[\s-]?[A-Z0-9-]+\/(B(?:Z|ME)|W(?:Z|C|CE))(?=$|[\s)])/i.exec(text);
 if(sony)hits.push({color:/^B/i.test(sony[1])?'Black':'White',colorRaw:sony[1],start:sony.index,end:sony.index+sony[0].length});
 const ordered=[...new Set([...palette.filter(c=>typeof c==='string'),...names])].sort((a,b)=>b.length-a.length);
 for(const label of ordered){
  const re=new RegExp('(^|[^\\p{L}\\p{N}])('+esc(label).replaceAll(' ','(?:\\s+(?:and\\s+)?|\\s*[&/]\\s*)')+')(?=$|[^\\p{L}\\p{N}])','giu');
  for(const m of text.matchAll(re)){
   const start=m.index+m[1].length,end=start+m[2].length;
   if(hits.some(h=>start<h.end&&end>h.start))continue;
   hits.push({color:label==='GrayGreen'?'Gray Green':label.replace(/Grey/g,'Gray'),colorRaw:m[2],start,end});
  }
 }
 // Standalone abbreviations only: WH-CH520, BL model letters, SIM codes and
 // region suffixes must not accidentally become colours.
 for(const m of text.matchAll(/(?:^|[\s(,])(?:((?:BEG|BK|BLK|WH|WHT|BLU|GRY|GY|GRN|PNK|SLV|GLD)))(?=$|[\s),;])/gi)){
  const start=m.index+m[0].lastIndexOf(m[1]),end=start+m[1].length;
  if(m[1].toUpperCase()==='WH' && /\bSONY\s*$/i.test(text.slice(0,start)))continue;
  if(!hits.some(h=>start<h.end&&end>h.start))hits.push({color:short[m[1].toUpperCase()],colorRaw:m[1],start,end});
 }
 const braun=/\bBRAUN\b.*\.((?:BK|WH|WHT|BLU|GY))(?=$|[\s),])/i.exec(text);
 if(braun)hits.push({color:short[braun[1].toUpperCase()],colorRaw:braun[1]});
 const distinct=[...new Set(hits.map(h=>norm(h.color)))];
 if(distinct.length!==1)return null;
 const hit=hits[0],exact=palette.find(c=>norm(c)===norm(hit.color));
 const base=c=>norm(c).replace(/^(?:awesome|space|light|dark|cosmic|jet|midnight|matte) /,'');
 const shorthand=palette.filter(c=>base(c)===base(hit.color) && (norm(hit.color)===base(hit.color)||norm(c)===base(c)));
 return {color:exact||(shorthand.length===1?shorthand[0]:hit.color),colorRaw:hit.colorRaw,colorSource:'vlv:title'};
}
export function applyVlvTitleColors(products,offers,aliases={}){
 const changes=[];
 for(const p of products)for(const o of offers[p.id]||[]){
  if(o.shop!=='vlv'||!/^https:\/\/(?:www\.)?vlv\.am\/(?:[a-z]{2}\/)?Product\/\d+\/?$/i.test(o.url||''))continue;
  const found=vlvTitleColor(o.title,p.colors||[]);if(!found)continue;
  found.color=canonicalColors(p.id,[found.color],aliases)[0];
  if(o.color!==found.color||o.colorRaw!==found.colorRaw||o.colorSource!==found.colorSource)changes.push({id:p.id,url:o.url,title:o.title,before:o.color??null,after:found.color,raw:found.colorRaw});
  Object.assign(o,found);
  if(!(p.colors||[]).includes(found.color))p.colors=[...(p.colors||[]),found.color];
 }
 return changes;
}
