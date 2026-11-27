// SmartBox (smartbox.am, Next.js). Product pages are /en/shop/view/<id>/ with no name in the URL,
// so like VLV an id -> title index (data/smartbox-index.json) is built from the sitemap once
// (node tools/smartbox.mjs --index) and the nightly re-reads only ids that match our products.
// Price: the "now" span inside .tag-price (the struck "was" is ignored). Stock: the FIRST
// <span class="st"> / "st off" on the page; later ones belong to recommendation cards.
export const smartboxUrl = id => `https://www.smartbox.am/en/shop/view/${id}/`;

export function parseSmartbox(html) {
  const title = ((html.match(/<h1 class="disp"[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '')
    .replace(/<[^>]+>/g, ' ').replace(/\s*\/\s*/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const box = html.slice(html.indexOf('class="tag-price"'));
  const now = html.includes('class="tag-price"') ? (box.match(/<span class="now">([\d\s ,]+)/) || [])[1] : '';
  const price = Number(String(now || '').replace(/\D/g, '')) || 0;
  const st = (html.match(/<span class="st( off)?">/) || []);
  return { title, price, inStock: !!st[0] && !st[1] };
}

export async function collectSmartbox({ get, pause, matchPhone, pinnedIds = [], index = {} }) {
  const ids = [...new Set([...Object.entries(index).filter(([id, t]) => matchPhone(t + ' ' + smartboxUrl(id))).map(([id]) => id), ...pinnedIds])];
  const out = [];
  for (const id of ids) {
    const url = smartboxUrl(id);
    const html = await get(url); await pause();
    if (!html) continue;
    const p = parseSmartbox(html);
    const pid = matchPhone(p.title + ' ' + url);
    if (!pid || p.price < 5000) continue;
    out.push({ id: pid, title: p.title, url, price: p.price, inStock: p.inStock });
  }
  return out;
}

// node tools/smartbox.mjs --index : rebuild data/smartbox-index.json from the sitemap (~1 req/s).
if (process.argv[1]?.endsWith('smartbox.mjs') && process.argv.includes('--index')) {
  const fs = await import('node:fs');
  const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36' };
  const xml = await (await fetch('https://www.smartbox.am/sitemap-en.xml', { headers: UA })).text();
  const ids = [...new Set([...xml.matchAll(/\/en\/shop\/view\/(\d+)\//g)].map(m => m[1]))];
  const F = 'data/smartbox-index.json';
  const index = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : {};
  let n = 0;
  for (const id of ids) {
    if (index[id]) continue;
    try { const r = await fetch(smartboxUrl(id), { headers: UA }); if (r.ok) { const t = parseSmartbox(await r.text()).title; if (t) index[id] = t; } } catch { }
    if (++n % 100 === 0) { fs.writeFileSync(F, JSON.stringify(index, null, 0)); console.log(n, '/', ids.length); }
    await new Promise(r => setTimeout(r, 700));
  }
  fs.writeFileSync(F, JSON.stringify(Object.fromEntries(Object.entries(index).sort((a, b) => a[0] - b[0])), null, 0));
  console.log('indexed', Object.keys(index).length, 'of', ids.length);
}
