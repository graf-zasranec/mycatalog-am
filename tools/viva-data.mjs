// The newer Viva product template differs from the /en/catalog/ listing cards.
// Scope every signal to its own buy box, never the recommendation tiles.
export function vivaProductPage(html) {
  html=String(html||'');
  const start=/<div\b[^>]*class=["'][^"']*\bviva-info-col\b[^"']*["'][^>]*>/i.exec(html);
  if(!start)return null;
  const tags=/<\/?div\b[^>]*>/gi;tags.lastIndex=start.index;let depth=0,end=null,match;
  while((match=tags.exec(html))){depth+=/^<\//.test(match[0])?-1:1;if(depth===0){end=tags.lastIndex;break}}
  if(end==null)return null;const box=html.slice(start.index,end);
  const text=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  const heading=box.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const amount=box.match(/<span\b[^>]*\bid=["']display_price["'][^>]*>([\s\S]*?)<\/span>/i);
  if(!heading||!amount)return null;const price=Number(text(amount[1]).replace(/[^0-9]/g,''));if(!(price>0))return null;
  const buy=box.match(/<a\b(?=[^>]*class=["'][^"']*\bviva-buy-btn\b)[^>]*>/i)?.[0]||'';
  const unavailable=/\bpre_order_button\b|\bdata-pre_order_date\s*=|\baria-disabled=["']true["']/i.test(buy);
  const inStock=unavailable?false:/\bonclick=["'][^"']*\baddTo(?:Cart|Basket)\s*\(/i.test(buy)?true:null;
  return {title:text(heading[1]),price,inStock};
}
