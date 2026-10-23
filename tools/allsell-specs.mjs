import {htmlText} from './appzone.mjs';
import {storageGB} from './spec-values.mjs';

// Fixed-SKU pages only: configurable Magento children have their own attributes.
// A stale URL is not a hardware specification; compare the primary H1 and table.
export function reviewAllsellSpecs(html) {
  const title=htmlText(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const table=String(html).match(/<table\b[^>]*\bid=["']product-attribute-specs-table["'][^>]*>([\s\S]*?)<\/table>/i)?.[1]||'';
  const specs=Object.fromEntries([...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[
    htmlText(m[1].match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)?.[1]),
    htmlText(m[1].match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1])
  ]));
  const pair=title.match(/\b(\d+)\s*GB\s*(?:[I|/]\s*)(\d+(?:\.\d+)?\s*(?:GB|TB)(?:\s*\+\s*\d+(?:\.\d+)?\s*(?:GB|TB))*)/i);
  const titleRam=pair?+pair[1]:+(title.match(/\b(\d+)\s*GB\s*RAM\b/i)?.[1]||0)||null;
  const tableRam=+(specs.RAM?.match(/^\s*(\d+)\s*GB\s*$/i)?.[1]||0)||null;
  const disks=pair?.[2].split('+').map(v=>storageGB(v.trim()));
  const titleStorage=disks?.length&&disks.every(v=>v!=null)?disks.reduce((a,b)=>a+b,0):null;
  const tableStorage=storageGB(specs['Internal memory']);
  const chip=text=>String(text||'').replace(/[™®]/g,'').replace(/[\u2010-\u2015]/g,'-').match(/\bi[3579][\s-]+[a-z]?\d{3,5}[a-z]{0,3}\b|\bRyzen\s+(?:AI\s+)?[3579][\s-]+\d{3,4}[a-z]{0,3}\b/i)?.[0].toLowerCase().replace(/[^a-z0-9]/g,'');
  const a=chip(title),b=chip(specs['Processor type']);
  const conflicts=[];
  if(titleRam!=null&&tableRam!=null&&titleRam!==tableRam)conflicts.push('ram');
  if(titleStorage!=null&&tableStorage!=null&&titleStorage!==tableStorage)conflicts.push('storage');
  if(a&&b&&a!==b)conflicts.push('cpu');
  return {title,ram:tableRam??titleRam,storage:tableStorage??titleStorage,conflicts};
}

export function specOfferAllowed(offer, holds) {
  if (offer.specConflict?.length) return false;
  const key=u=>String(u||'').replace(/\/+$/,'').replace(/^(https?:\/\/[^/]+)\/(?:en|am|ru)\//,'$1/');
  const hold=holds.find(row=>key(row.url)===key(offer.url));
  return !hold || (/^\d{4}-\d{2}-\d{2}$/.test(offer.specReviewed||'') && offer.specReviewed>=hold.checked);
}
