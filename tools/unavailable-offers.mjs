// Dated evidence for exact redirects or explicit primary-product sold-out stock.
export function verifiedUnavailable(offer, evidence) {
  if (!evidence || evidence.url !== offer.url || evidence.status !== 200
      || !['homepage_redirect', 'primary_product_sold_out'].includes(evidence.reason) || !/^\d{4}-\d{2}-\d{2}$/.test(evidence.checked)) return false;
  // A later successful scrape can restore the URL without a permanent block.
  if (offer.seen && offer.seen > evidence.checked) return false;
  try {
    const from = new URL(evidence.url), to = new URL(evidence.finalUrl);
    if (evidence.reason === 'primary_product_sold_out') return offer.shop === 'yerevanmobile'
      && from.hostname === 'www.yerevanmobile.am' && to.href === from.href
      && from.pathname.startsWith('/en/') && evidence.stock === 'unavailable';
    return offer.shop === 'istore' && from.hostname === 'istore.am' && to.hostname === from.hostname
      && from.pathname.startsWith('/product/') && ['', '/', '/index.php', '/index.php/'].includes(to.pathname);
  } catch { return false; }
}
