// Distinct model codes, without memory sizes, CPU/GPU names or family-only codes.
const MODEL_CODE = /^(?:h\d{3}|bpd\d{3}[a-z]{0,4}|\d{2}[a-z0-9]{6,9}|[a-z]{2,4}\d{3,4}[a-z]{0,4}-\d{2}-[a-z0-9]{4,6}|[a-z]{2,4}\d{3,4}[a-z]{0,4}-[a-z]{2}\d{3,5}[a-z]{0,3})$/i;

function modelCodes(value) {
  const words = value.toLowerCase().match(/[a-z0-9]+/g) || [];
  const codes = new Set();
  for (let i = 0; i < words.length; i++) {
    for (let count = 1; count <= 3 && i + count <= words.length; count++) {
      const candidate = words.slice(i, i + count).join('-');
      if (!MODEL_CODE.test(candidate)) continue;
      codes.add(/^bpd\d{3}/.test(candidate) ? candidate.slice(0, 6) : candidate);
    }
  }
  return codes;
}

function urlKey(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.href;
  } catch {
    return '';
  }
}

export function knownRetailListings(products, linkRows, prices) {
  const links = new Set(linkRows.map(row => urlKey(row[9])).filter(Boolean));
  for (const rows of Object.values(prices.offers || {})) {
    for (const offer of rows) {
      const key = urlKey(offer.url);
      if (key) links.add(key);
    }
  }
  const brandsByCode = new Map();
  for (const { id, name, brand, aliases = [] } of products) {
    for (const code of modelCodes([id, name, ...aliases].join(' / '))) {
      if (!brandsByCode.has(code)) brandsByCode.set(code, new Set());
      brandsByCode.get(code).add(brand.toLowerCase());
    }
  }
  return (title, url) => {
    if (links.has(urlKey(url))) return true;
    const words = new Set(title.toLowerCase().match(/[a-z0-9]+/g) || []);
    for (const code of modelCodes(title)) {
      const brands = brandsByCode.get(code);
      if (brands && [...brands].some(brand => words.has(brand))) return true;
    }
    return false;
  };
}
