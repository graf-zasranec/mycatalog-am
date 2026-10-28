import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// A slow hero download must not prevent an already rendered product page from
// gaining working controls. Exercise the actual boot script with decode pending.
const appended = [];
const priorities = [];
const main = { dataset: { prerenderProduct: 'honor-x8c' }, querySelectorAll:()=>[] };
const boot = {
  document: {
    currentScript: { dataset: { src: 'products.js prices.js app.js' } },
    documentElement: { classList: { contains: () => false }, lang: 'en' },
    getElementById: id => id === 'main' ? main : { decode: () => new Promise(() => {}) },
    createElement: tag => ({ tag }),
    head: { appendChild: el => { if (el.tag === 'script') { appended.push(el.src); priorities.push(el.fetchPriority); queueMicrotask(() => el.onload()); } } }
  },
  DATA: [{ id: 'honor-x8c', _detailChunk: 0 }], DETAIL_CHUNKS: ['detail.js'],
  location: { hash: '', pathname: '/en/p/honor-x8c/', protocol: 'http:' },
  navigator: {}, requestAnimationFrame: f => f(),
  setTimeout: f => { queueMicrotask(f); return 0; },
  addEventListener() {}, Promise
};
// Preserve the real image timeout rather than letting a synthetic timer resolve it.
boot.setTimeout = (f, delay = 0) => { if (!delay) queueMicrotask(f); return 0; };
vm.runInNewContext(fs.readFileSync('tools/site-boot.js', 'utf8'), boot);
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(appended, ['products.js', 'prices.js', 'detail.js', 'app.js'], 'image decoding cannot hold product controls hostage');
assert.deepEqual(priorities,['high','high','high','high'],'post-paint interactive data takes priority over offscreen images');

// Canonical product pages can use the smaller complete-category seed. The full
// catalogue must not be requested before their controls initialize.
const seeded=[],preloaded=[];
const seededBoot={...boot,document:{...boot.document,currentScript:{dataset:{src:'products.js prices.js app.js',productSeed:'phone-seed.js'}},head:{appendChild:el=>{if(el.tag==='link')preloaded.push(el.href);if(el.tag==='script'){seeded.push(el.src);queueMicrotask(()=>el.onload());}}}}};
vm.runInNewContext(fs.readFileSync('tools/site-boot.js','utf8'),seededBoot);
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(seeded,['phone-seed.js','detail.js','app.js'],'direct-product controls use their category before full global listing data');
assert.ok(!preloaded.includes('products.js')&&!preloaded.includes('prices.js'),'no speculative full catalogue download on the critical path');

// Model CacheStorage and the network boundary; run the real service worker's
// fetch handler so version changes and unversioned prices exercise its branches.
const entries = new Map(), calls = [], listeners = {};
let revision = 'first', failWrites = false, failOpen = false, failRead = false;
const cache = {
  match: async req => { if (failRead) throw new Error('cache read unavailable'); return entries.get(req.url)?.clone(); },
  put: async (req, res) => { if (failWrites) throw new Error('QuotaExceededError'); entries.set(req.url, res.clone()); }
};
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
  URL, location: { origin: 'https://better.am' },
  self: { addEventListener: (name, f) => { listeners[name] = f; } },
  caches: { open: async () => { if (failOpen) throw new Error('cache unavailable'); return cache; }, match: cache.match },
  fetch: async req => { calls.push(req.url); return new Response(revision); }
});
async function read(path) {
  let response; const pending = [];
  listeners.fetch({ request: new Request('https://better.am' + path),
    respondWith: p => { response = p; }, waitUntil: p => pending.push(p) });
  const body = await (await response).text(); await Promise.all(pending); return body;
}
const bundle = '/data/site-prices.js?v=123456abcd';
assert.equal(await read(bundle), 'first');
revision = 'second';
assert.equal(await read(bundle), 'first', 'same content version reopens from cache');
assert.equal(calls.filter(url => url.endsWith(bundle)).length, 1, 'reopening a versioned bundle skips the network');
assert.equal(await read('/data/site-prices.js?v=abcdef1234'), 'second', 'a new price version fetches fresh data');
assert.equal(await read('/data/prices.json'), 'second');
revision = 'third';
assert.equal(await read('/data/prices.json'), 'third', 'unversioned prices remain network-first');
assert.equal(await read('/en/'), 'third');
revision = 'fourth';
assert.equal(await read('/en/'), 'fourth', 'HTML always checks for current bundle versions');
assert.equal(await read('/data/site-app.js?v=invalid'), 'fourth');
revision = 'fifth';
const appBundle = '/data/site-app.123456abcd.js?v=123456abcd';
assert.equal(await read(appBundle),'fifth');
revision = 'new-app';
assert.equal(await read(appBundle),'fifth','fingerprinted application code reopens from local cache');
assert.equal(await read('/data/details/chunk-0.abcdef1234.js?v=abcdef1234'),'new-app');
revision = 'new-details';
assert.equal(await read('/data/details/chunk-0.abcdef1234.js?v=abcdef1234'),'new-app','fingerprinted product details reuse cache');
revision = 'fifth';
assert.equal(await read('/data/site-app.js?v=invalid'), 'fifth', 'only valid content-hash versions are immutable');
const style = '/data/site-ui.123456abcd.css?v=123456abcd';
assert.equal(await read(style), 'fifth');
revision = 'style-update';
assert.equal(await read(style), 'fifth', 'fingerprinted styles reuse the local cache');
assert.equal(await read('/data/site-ui.abcdef1234.css?v=abcdef1234'), 'style-update', 'a new stylesheet pathname cannot reuse the previous design');
revision = 'fifth';
const seedBundle='/data/startup/category-phone.123456abcd.js?v=123456abcd';
revision='seed-first';assert.equal(await read(seedBundle),'seed-first');revision='seed-second';
assert.equal(await read(seedBundle),'seed-first','versioned product startup reopens without the network');
const globalBundle='/data/startup/catalogue.abcdef1234.js?v=abcdef1234';
assert.equal(await read(globalBundle),'seed-second');revision='new-catalogue';
assert.equal(await read(globalBundle),'seed-second','a tab can reuse its exact full catalogue version');
assert.equal(await read('/data/startup/catalogue.555555aaaa.js?v=555555aaaa'),'new-catalogue','new price/canonical versions never inherit stale listing data');
revision='fifth';
failWrites = true;
assert.equal(await read('/data/site-app.js?v=555555aaaa'), 'fifth', 'storage exhaustion cannot discard a successful asset download');
failWrites = false; failRead = true;
assert.equal(await read('/data/site-app.js?v=666666aaaa'), 'fifth', 'a failed cache read falls back to the network');
failRead = false; failOpen = true;
assert.equal(await read('/data/site-app.js?v=777777aaaa'), 'fifth', 'unavailable CacheStorage cannot disable startup');
console.log('STARTUP_PASS: slow photos, ordered data, cached reopening and fresh price versions');
