// Better.am service worker (owner, 2026-10-16: installable app). Prices must never be stale, so
// pages and data always come from the network first; the cache is only a fallback when offline.
// Fonts and thumbnails (whose file names carry a content hash) are served from the cache first -
// which also makes the fonts appear instantly on refresh. Other images keep their name when a
// photo is replaced, so they stay network-first like everything else.
const VERSION = 'better-v1';
const STATIC = /^\/(fonts\/|images\/thumb\/)/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // shops, analytics: untouched
  if (STATIC.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
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
