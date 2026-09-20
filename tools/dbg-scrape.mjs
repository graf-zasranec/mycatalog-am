const UA = 'ImpulseBot/0.1 (+price comparison; respects robots.txt)';
const url = 'https://mobilecentre.am/product/xiaomi-poco-m7/32829/';
const r = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
const html = await r.text();
console.log('status', r.status, 'len', html.length);
const imgs = [...html.matchAll(/(?:src|data-src|data-original|content)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)]
  .map(m => m[1]).filter(u => !/logo|icon|banner|payment|shablon|favicon/i.test(u));
console.log('imgs:', imgs.length);
for (const u of imgs.slice(0, 10)) console.log('  ', u);