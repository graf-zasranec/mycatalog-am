import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// A slow hero download must not prevent an already rendered product page from
// gaining working controls. Exercise the actual boot script with decode pending.
const appended = [];
const main = { dataset: { prerenderProduct: 'honor-x8c' } };
const boot = {
  document: {
    currentScript: { dataset: { src: 'products.js prices.js app.js' } },
    documentElement: { classList: { contains: () => false }, lang: 'en' },
    getElementById: id => id === 'main' ? main : { decode: () => new Promise(() => {}) },
    createElement: tag => ({ tag }),
    head: { appendChild: el => { if (el.tag === 'script') { appended.push(el.src); queueMicrotask(() => el.onload()); } } }
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

// Model CacheStorage and the network boundary; run the real service worker's
// fetch handler so version changes and unversioned prices exercise its branches.
const entries = new Map(), calls = [], listeners = {};
let revision = 'first';
const cache = {
  match: async req => entries.get(req.url)?.clone(),
  put: async (req, res) => { entries.set(req.url, res.clone()); }
};
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
  URL, location: { origin: 'https://better.am' },
  self: { addEventListener: (name, f) => { listeners[name] = f; } },
  caches: { open: async () => cache, match: cache.match },
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
assert.equal(await read('/data/site-app.js?v=invalid'), 'fifth', 'only valid content-hash versions are immutable');
console.log('STARTUP_PASS: slow photos, ordered data, cached reopening and fresh price versions');
