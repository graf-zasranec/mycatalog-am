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
  const verified = !!(titleRam && tableRam && titleStorage && tableStorage && a && b && !conflicts.length);
  return {title,ram:tableRam??titleRam,storage:tableStorage??titleStorage,conflicts,verified};
}

// HP's generic "15" family spans incompatible processors. Only merchant
// evidence can establish this entry; catalogue specifications cannot do so.
function modelIdentityAllowed(id, offer) {
  const identity = `${offer.title || ''} ${offer.url || ''}`;
  // "Wave" alone is also a coffeeware pattern. Flex, 300TWS and Buds 2 are
  // different hardware; cached rows must pass this gate as well as new matches.
  if (id === 'honor-pad-x8b-ndl2-w09' && /ndl2[\s_-]*l09\b/i.test(identity)) return false;
  if (id === 'jbl-wave') {
    if (/\bwave[\s_-]*(?:flex|300[\s_-]*tws)|\bwave[\s_-]*buds[\s_-]*2\b/i.test(identity)) return false;
    return /\bjbl[\s_-]*wave[\s_-]*buds\b/i.test(identity);
  }

  // The model is fixed at65 inches; a cheaper55-inch sibling is a different TV.
  if (id === 'xiaomi-s-pro-mini-led-65') {
    let source = identity;
    try { source = decodeURIComponent(source); } catch {}
    const sizes = [...source.matchAll(/\bl(\d{2,3})mb\b|\b(\d{2,3})(?=\s*(?:["'″]|inches?\b))/gi)]
      .map(m => +(m[1] || m[2]));
    return sizes.length > 0 && sizes.every(size => size === 65);
  }

  if (id === 'xiaomi-redmi-buds-6') {
    return /\bredmi[\s_-]*buds[\s_-]*6\b/i.test(identity)
      && !/\bredmi[\s_-]*buds[\s_-]*6[\s_-]*(?:active|lite|play|pro)\b|\bm2344e1\b/i.test(identity);
  }
  if (id === 'xiaomi-redmi-buds-6-active') {
    if (/\bredmi[\s_-]*buds[\s_-]*6[\s_-]*(?:lite|play|pro)\b/i.test(identity)) return false;
    return /\bredmi[\s_-]*buds[\s_-]*6[\s_-]*active\b|\bm2344e1\b/i.test(identity);
  }
  if (id === 'xiaomi-buds-6')
    return /\bxiaomi[\s_-]*buds[\s_-]*6\b/i.test(identity)
      && !/\bredmi\b|\bbuds[\s_-]*6[\s_-]*(?:active|lite|play|pro)\b/i.test(identity);
  if (id === 'yandex-station-lite')
    return !/(?:lite|light|лайт)[\s_-]*2\b|yndx[\s_-]*00026/i.test(identity);
  if (id === 'samsung-galaxy-a16')
    return !/\b(?:sm[\s_-]*)?a165[a-z0-9]*\b|\ba16\b[^\n]{0,20}\b(?:lte|4g)\b/i.test(identity);
  const hp = id === 'hp-15-intel-core-5-120u';
  const honor = id === 'honor-magicbook-pro-16-ultra-5-125h-24-1-w11h-5301ajjg';
  if (!hp && !honor) return true;
  const fields = [offer.title, offer.cpu, offer.configSpecs?.chipset?.name]
    .map(v => String(v || '').toLowerCase().replace(/[\u2010-\u2015\u2212]/g, '-'));
  const expected = hp ? /\b(?:intel\s+)?core\s*5[\s-]*120u\b/g
    : /\b(?:intel\s+)?(?:core\s*)?ultra\s*5[\s-]*125h\b/g;
  if (!fields.some(v => new RegExp(expected.source).test(v))) return false;
  // Any explicit competing processor defeats another positive source field.
  const competing = /\b(?:core\s*(?:i[3579]|ultra|[3579])|ultra\s*[3579]|n\d{2,3}\b|i[3579][\s-]*(?:[a-z][\s-]*)?\d|ryzen|celeron|pentium|athlon|snapdragon|intel\s+(?:n\d|processor)|apple\s+m[1-9])/;
  return fields.every(v => !competing.test(v.replace(expected, '')));
}

export function specOfferAllowed(offer, holds, id = offer.id) {
  if (!modelIdentityAllowed(id, offer)) return false;
  if (offer.specConflict?.length) return false;
  const key=u=>String(u||'').replace(/\/+$/,'').replace(/^(https?:\/\/[^/]+)\/(?:en|am|ru)\//,'$1/');
  const hold=holds.find(row=>key(row.url)===key(offer.url));
  return !hold || (/^\d{4}-\d{2}-\d{2}$/.test(offer.specReviewed||'') && offer.specReviewed>=hold.checked);
}
