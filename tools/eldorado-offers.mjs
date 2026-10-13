const key = url => String(url || '').replace(/\/+$/, '')
  .replace(/^(https?:\/\/[^/]+)\/(?:am|en|ru)(\/)/i, '$1$2');

export function exactEldoradoEvidence(rows) {
  return new Map(rows.filter(r => r.detailVerified && /^\d{4}-\d{2}-\d{2}$/.test(r.checked || ''))
    .map(r => [key(r.url), r]));
}

export function keepEldoradoOffer(offer, evidence, product) {
  if (offer.shop !== 'eldorado') return true;
  const row = evidence.get(key(offer.url));
  if (!row || (offer.seen && offer.seen > row.checked)) return true;
  if (row.inStock === false || Number(row.price) <= 0) return false;
  if (Number(offer.price) !== Number(row.price)) return false;
  if (['phone', 'tablet', 'laptop', 'desktop'].includes(product?.category)) {
    if (row.ram != null && offer.ram !== row.ram) return false;
    if (row.storage != null && offer.storage !== row.storage) return false;
  }
  return true;
}
