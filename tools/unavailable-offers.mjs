// Exact product URLs verified as redirects, not network failures or sold-out stock.
export function verifiedUnavailable(offer, evidence) {
  if (!evidence || evidence.url !== offer.url || evidence.status !== 200
      || evidence.reason !== 'homepage_redirect' || !/^\d{4}-\d{2}-\d{2}$/.test(evidence.checked)) return false;
  // A later successful scrape can restore the URL without a permanent block.
  if (offer.seen && offer.seen > evidence.checked) return false;
  try {
    const from = new URL(evidence.url), to = new URL(evidence.finalUrl);
    return offer.shop === 'istore' && from.hostname === 'istore.am' && to.hostname === from.hostname
      && from.pathname.startsWith('/product/') && ['', '/', '/index.php', '/index.php/'].includes(to.pathname);
  } catch { return false; }
}
