export const cacheOfferKey = (shop, url) => shop + '|' + String(url || '').replace(/\/+$/, '')
  .replace(/^(https?:\/\/[^/]+)\/(?:am|en|ru)(\/)/i, '$1$2');

export const purchasableOffer = o => !o.specConflict?.length && o.inStock !== false && Number.isFinite(+o.price) && +o.price > 0;

export function unavailableCacheKeys(shop, rows) {
  return rows.filter(row => row.url && (row.inStock === false ||
    (row.price !== null && row.price !== '' && Number(row.price) === 0)))
    .map(row => cacheOfferKey(shop, row.url));
}


// Magento renders recommendations outside its own purchase form.
export function magentoCartState(html) {
  const form = String(html || '').match(/<form\b(?=[^>]*\bid=["']product_addtocart_form["'])[^>]*>([\s\S]*?)<\/form>/i)?.[1];
  if (form == null) return null;
  const button = form.match(/<button\b(?=[^>]*\bid=["']product-addtocart-button["'])[^>]*>/i)?.[0];
  if (!button) return false;
  return /\sdisabled(?:\s|=|>)/i.test(button) ? null : true;
}

// iStore repeats its primary controls for desktop and mobile, and renders
// other products on the same page. Only an exact product ID can set stock.
export function istoreCartState(html, url) {
  const id = String(url || '').match(/-(\d+)\/?$/)?.[1];
  if (!id) return null;
  const states = new Set();
  for (const [, attrs] of String(html || '').matchAll(/<(?:a|button)\b([^>]*)>/gi)) {
    const classes = attrs.match(/\sclass=["']([^"']*)["']/i)?.[1].split(/\s+/) || [];
    if (!classes.includes('add-to-cart-button') ||
        attrs.match(/\sdata-product_id=["'](\d+)["']/i)?.[1] !== id) continue;
    if (classes.includes('make-preorder')) states.add(false);
    if (classes.includes('add-to-cart-pv') && !/\sdisabled(?:\s|=|$)/i.test(attrs)) states.add(true);
  }
  return states.size === 1 ? [...states][0] : null;
}

export function istoreCachedRows(snapshot, today) {
  const now = Date.parse(today);
  return (snapshot?.rows || []).flatMap(row => {
    const seen = row.checkedAt?.slice(0, 10) || row.seen || snapshot.fetched;
    const age = (now - Date.parse(seen)) / 864e5;
    return age >= 0 && age <= 3 ? [{...row, seen}] : [];
  });
}

export function unavailableSourceKeys(shop, rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.url) continue;
    const key = cacheOfferKey(shop, row.url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups].filter(([,group]) => group.every(o => o.inStock === false || o.specConflict?.length)).map(([key]) => key);
}

export function checkpointShopRows(shop, rows, kept, fresh) {
  const unavailable = new Set(unavailableSourceKeys(shop, fresh));
  const surviving = kept.filter(o => !unavailable.has(cacheOfferKey(shop, o.url)));
  return rows.concat(surviving, fresh.filter(o => o.inStock === false || o.specConflict?.length));
}
