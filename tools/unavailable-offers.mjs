// Dated evidence for exact redirects or explicit primary-product sold-out stock.
export function verifiedUnavailable(offer, evidence) {
  if (evidence?.reason === 'exact_variant_sold_out') {
    if (evidence.url !== offer.url || evidence.shop !== offer.shop || evidence.status !== 200
        || evidence.stock !== false || !/^\d{4}-\d{2}-\d{2}$/.test(evidence.checked || '')
        || !Number.isFinite(Date.parse(evidence.checkedAt))) return false;
    if (offer.seen && offer.seen > evidence.checked) return false;
    if (offer.checkedAt && Date.parse(offer.checkedAt) > Date.parse(evidence.checkedAt)) return false;
    const scope = evidence.scope;
    if (!scope || !Object.keys(scope).length || Object.keys(scope).some(k => !['storage','ram','color','esim'].includes(k))) return false;
    return Object.entries(scope).every(([key,value]) => value != null && offer[key] === value);
  }

  if (evidence?.url === offer.url && evidence.shop === offer.shop
      && evidence.reason === 'http_not_found' && [404,410].includes(evidence.status)
      && /^\d{4}-\d{2}-\d{2}$/.test(evidence.checked || '')) {
    if (offer.seen && offer.seen > evidence.checked) return false;
    if (offer.checkedAt && evidence.checkedAt && Date.parse(offer.checkedAt) > Date.parse(evidence.checkedAt)) return false;
    return true;
  }

  if (!evidence || evidence.url !== offer.url || evidence.status !== 200
      || !['homepage_redirect', 'primary_product_sold_out', 'primary_product_missing'].includes(evidence.reason) || !/^\d{4}-\d{2}-\d{2}$/.test(evidence.checked)) return false;
  // A later successful scrape can restore the URL without a permanent block.
  if (offer.seen && offer.seen > evidence.checked) return false;
  try {
    const from = new URL(evidence.url), to = new URL(evidence.finalUrl);
    if (evidence.reason === 'primary_product_missing') return offer.shop === 'redstore'
      && from.hostname === 'redstore.am' && to.href === from.href
      && from.pathname.startsWith('/en/product/') && evidence.productFound === false
      && evidence.primaryBuyBoxFound === false;
    if (evidence.reason === 'primary_product_sold_out') return offer.shop === 'yerevanmobile'
      && from.hostname === 'www.yerevanmobile.am' && to.href === from.href
      && from.pathname.startsWith('/en/') && evidence.stock === 'unavailable';
    return offer.shop === 'istore' && from.hostname === 'istore.am' && to.hostname === from.hostname
      && from.pathname.startsWith('/product/') && ['', '/', '/index.php', '/index.php/'].includes(to.pathname);
  } catch { return false; }
}
