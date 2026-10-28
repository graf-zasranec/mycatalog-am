// Better.am service worker (owner, 2026-10-16: installable app). Prices must never be stale, so
// pages and unversioned data come from the network first; the cache is a fallback when offline.
// Fonts, thumbnails and bundles with a content-hash version are served from the cache first -
// which also makes the fonts appear instantly on refresh. Other images keep their name when a
// photo is replaced, so they stay network-first like everything else.
const VERSION = 'better-v1';
const STATIC = /^\/(fonts\/|images\/thumb\/)/;
const VERSIONED = /^\/data\/(?:site-(?:products|prices|app|boot)(?:\.[a-f0-9]{10})?\.js|site-ui(?:\.[a-f0-9]{10})?\.css|details\/chunk-\d+(?:\.[a-f0-9]{10})?\.js|product-extras\.json|startup\/(?:category-[a-z]+|catalogue)\.[a-f0-9]{10}\.js)$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // shops, analytics: untouched
  if (STATIC.test(url.pathname) || (VERSIONED.test(url.pathname) && /^[a-f0-9]{10}$/.test(url.searchParams.get('v') || ''))) {
    e.respondWith((async () => {
      let c;
      try {
        c = await caches.open(VERSION);
        const hit = await c.match(req);
        if (hit) return hit;
      } catch { /* Storage may be unavailable; the network still works. */ }
      const res = await fetch(req);
      if (res.ok && c) {
        try { await c.put(req, res.clone()); } catch { /* A full cache must not discard the response. */ }
      }
      return res;
    })());
    return;
  }
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
      return res;
    } catch {
      const hit = await caches.match(req);
      if (hit) return hit;
      throw new Error('offline');
    }
  })());
});
