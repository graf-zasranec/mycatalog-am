export const cacheOfferKey = (shop, url) => shop + '|' + String(url || '').replace(/\/+$/, '')
  .replace(/^(https?:\/\/[^/]+)\/(?:am|en|ru)(\/)/i, '$1$2');

export const purchasableOffer = o => o.inStock !== false && Number.isFinite(+o.price) && +o.price > 0;

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

export function unavailableSourceKeys(shop, rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.url) continue;
    const key = cacheOfferKey(shop, row.url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups].filter(([,group]) => group.every(o => o.inStock === false)).map(([key]) => key);
}
