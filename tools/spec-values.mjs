// A shop occasionally labels its 512 GB SSD "512 TB". Never multiply a
// capacity already expressed as a GB-sized number into an impossible laptop SSD.
export function storageGB(value) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(GB|TB)\s*$/i.exec(String(value || ''));
  if (!m) return null;
  const n = +m[1];
  const gb = m[2].toUpperCase() === 'TB' && n < 16 ? n * 1024 : n;
  return [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192].includes(gb) ? gb : null;
}

export function caseSize(offer, allowed) {
  for (const text of [offer.title, offer.url]) {
    const matches = [...String(text || '').matchAll(/\b(\d{2})\s*(?:mm\b|մմ)/gi)]
      .map(m => +m[1]).filter(n => allowed.includes(n));
    const unique = [...new Set(matches)];
    if (unique.length === 1) return unique[0];
    if (unique.length > 1) return null;
  }
  return null;
}

export function cpu(v) {
  v = String(v || '').replace(/[®™]/g, '').replace(/\(.*$/, '').replace(/\bProcessor\b/i, '').replace(/\s*[-–]\s*/g, ' ')
    .replace(/\s+/g, ' ').trim().replace(/^\d+th Generation /i, '').replace(/^Intel (Ultra \d)/i, 'Intel Core $1').replace(/Ryzen R(\d)/i, 'Ryzen $1');
  let m;
  if ((m = v.match(/^(?:Intel )?(Celeron |Pentium (?:Silver |Gold )?)?(N\d{3,4})$/i))) return `Intel ${m[1] || ''}${m[2].toUpperCase()}`;
  // i-series models have 4-5 digits (i5-13420H); Core 5 / Core Ultra 5 have 3 (210H, 255H, N355)
  if ((m = v.match(/^(?:Intel )?Core (i[3579]) ?(\d{4,5}[A-Z]{0,3}\d?)$/i) || v.match(/^(?:Intel )?Core (Ultra [579]|[3579]) ?([A-Z]?\d{3}[A-Z]{0,3})$/i))) return `Intel Core ${m[1].toLowerCase().replace('ultra', 'Ultra')}-${m[2].toUpperCase()}`;
  if ((m = v.match(/^(?:AMD )?Ryzen ([3579]|AI [579]) (?:PRO )?(\d{3,4}[A-Z]{0,3})$/i))) return `AMD Ryzen ${m[1]} ${m[2].toUpperCase()}`;
  if ((m = v.match(/^(?:Apple )?(M[1-5](?: Pro| Max)?)$/i))) return `Apple ${m[1].toUpperCase().replace('PRO', 'Pro').replace('MAX', 'Max')}`;
  return null;
}

export function megabytePhoneMemory(product, variant) {
  return product.category === 'phone' && product.connectivity?.network === '2G'
    && [variant.ram, variant.storage].every(n => Number.isFinite(n) && n > 0 && n < 1 && Number.isInteger(n * 1024));
}
