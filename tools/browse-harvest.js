// Harvest a shop's own search results from inside a browser tab already open on that shop.
//
// Why this exists: eldorado and zigzag answer our crawler with 403, and this project does not
// fake a user agent to get past that. A person's own browser is not a bypass - it is a person
// looking at a shop - so when the catalogue needs prices or photographs from those two, someone
// opens the shop and this reads the search results the same way they would, only faster.
//
// It also costs this machine nothing. The shop does the work; there is no model, no matting, no
// CPU. That is what makes it the right tool for the 403 shops AND for photographs.
//
// Paste into the browser console on the shop's own origin (the fetches are same-origin, so the
// session and cookies are the person's own), then:
//
//   H.start('eldorado', ['VA249HG', 'QE43Q60BA', ...])   begin, returns immediately
//   H.status()                                           how far along
//   H.save()                                             download the TSV when done
//
// H.start is resumable: terms already answered are skipped, so a tab that was closed mid-run
// picks up where it stopped.

(() => {
  // Each shop needs two things: where its search lives, and what a result looks like. Everything
  // else - the price, the picture - is found by walking up from the product's own link until a
  // block holds both, which is true of every Magento and WooCommerce theme tried here.
  const SHOPS = {
    eldorado: { search: q => '/en/catalogsearch/result/?q=' + encodeURIComponent(q), link: 'a.product_name' },
    zigzag:   { search: q => '/am/catalogsearch/result/?q=' + encodeURIComponent(q), link: 'a.product-item-link, a.product_name' },
    ibolit:   { search: q => '/?s=' + encodeURIComponent(q) + '&post_type=product', link: 'a.woocommerce-LoopProduct-link, h2.woocommerce-loop-product__title' },
    pixel:    { search: q => '/en/search?q=' + encodeURIComponent(q), link: 'a[href*="/product/"]' },
    istyle:   { search: q => '/search?q=' + encodeURIComponent(q), link: 'a[href*="/product"]' },
    generic:  { search: q => '/?s=' + encodeURIComponent(q), link: 'a[href*="product"]' },
  };

  const PRICE = /([\d][\d\s, ]{2,})\s*(?:AMD|֏|դր|драм)/gi;

  function read(doc, cfg) {
    return [...doc.querySelectorAll(cfg.link)].map(a => {
      const href = a.getAttribute('href') || (a.closest('a') || {}).href;
      let box = a, img = null, prices = [];
      for (let i = 0; i < 9 && box; i++) {
        box = box.parentElement;
        if (!box) break;
        img = box.querySelector('img[src*="catalog"],img[data-src*="catalog"],img[data-original*="catalog"],img[src*="/uploads/"],img[src*="/media/"]');
        prices = [...(box.textContent || '').matchAll(PRICE)].map(m => +m[1].replace(/[\s, ]/g, ''));
        if (img && prices.length) break;
      }
      return {
        n: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
        u: href ? new URL(href, location.origin).href : null,
        i: img ? new URL(img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original'), location.origin).href : null,
        p: [...new Set(prices)].filter(x => x > 100).sort((a, b) => b - a).slice(0, 2),
      };
    }).filter(h => h.u);
  }

  const H = {
    res: {}, shop: null, busy: false, todo: 0,

    // Several at once, because a search is all waiting: the shop answers in its own time and
    // three in flight is three times less waiting without being three times the load. Sequential
    // took eight seconds a term; this takes under three.
    async start(shop, terms, lanes = 3) {
      const cfg = SHOPS[shop] || SHOPS.generic;
      H.shop = shop; H.busy = true;
      const queue = terms.filter(q => !H.res[q]);
      H.todo = queue.length;
      const worker = async () => {
        for (;;) {
          const q = queue.shift();
          if (q === undefined) return;
          try {
            const r = await fetch(cfg.search(q), { credentials: 'include' });
            H.res[q] = r.ok ? read(new DOMParser().parseFromString(await r.text(), 'text/html'), cfg).slice(0, 4)
                            : [{ err: 'HTTP ' + r.status }];
          } catch (e) { H.res[q] = [{ err: String(e).slice(0, 60) }]; }
          await new Promise(s => setTimeout(s, 250));
        }
      };
      Promise.all(Array.from({ length: lanes }, worker)).then(() => { H.busy = false; });
      return `started ${queue.length} term(s) on ${shop}, ${lanes} at a time`;
    },

    status() {
      const done = Object.keys(H.res);
      const found = done.filter(q => (H.res[q] || []).some(h => h.u));
      const withImg = done.filter(q => (H.res[q] || []).some(h => h.i));
      return { busy: H.busy, done: done.length, of: H.todo, found: found.length, withImage: withImg.length };
    },

    // The PICTURES have to come back through the browser as well, not just their urls. eldorado
    // 403s our fetcher on its image CDN exactly as it does on its pages, so a harvested url is
    // worth nothing on its own - the bytes have to travel with it. Fetched here they are
    // same-origin and ordinary, packed into one file rather than 133 downloads.
    // A search grid shows a THUMBNAIL. Magento serves it from /cache/<32 hex>/ and keeps the
    // untouched original at the same path with that segment removed - 300px against 800px, which
    // is the difference between under the floor and over it. Ask for the original, fall back to
    // the thumbnail rather than come away with nothing.
    async images(lanes = 4) {
      H.img = H.img || {};
      const want = [];
      for (const [q, hits] of Object.entries(H.res)) {
        const h = (hits || [])[0];
        if (h && h.i) want.push({ q, url: h.i.replace(/\/cache\/[0-9a-f]{32}\//, '/'), thumb: h.i });
      }
      const queue = want.filter(w => !H.img[w.q]);
      H.todo = queue.length; H.busy = true;
      const grab = async u => {
        const r = await fetch(u, { credentials: 'include' });
        if (!r.ok) return null;
        const buf = new Uint8Array(await r.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        const bmp = await createImageBitmap(new Blob([buf]));
        return { b64: btoa(s), w: bmp.width, h: bmp.height, url: u };
      };
      const worker = async () => {
        for (;;) {
          const w = queue.shift();
          if (!w) return;
          try { H.img[w.q] = (await grab(w.url)) || (await grab(w.thumb)) || { err: 'both failed' }; }
          catch (e) {
            try { H.img[w.q] = (await grab(w.thumb)) || { err: String(e).slice(0, 40) }; }
            catch (e2) { H.img[w.q] = { err: String(e2).slice(0, 40) }; }
          }
        }
      };
      await Promise.all(Array.from({ length: lanes }, worker));
      H.busy = false;
      const ok = Object.values(H.img).filter(v => v.b64);
      const sizes = ok.map(v => Math.max(v.w, v.h)).sort((a, b) => a - b);
      return { fetched: ok.length, failed: Object.keys(H.img).length - ok.length,
               over600: sizes.filter(s => s >= 600).length, median: sizes[sizes.length >> 1] };
    },

    // Saved in pieces, because a browser will let a site download ONE file by itself and then
    // blocks the rest until someone allows it - and because a single blob much over 6MB does not
    // arrive at all. Roughly 25 pictures to a file keeps both limits happy.
    saveImages(per = 25) {
      const keys = Object.keys(H.img).filter(q => H.img[q].b64);
      const parts = [];
      for (let i = 0; i < keys.length; i += per) {
        const out = {};
        for (const q of keys.slice(i, i + per)) { const v = H.img[q]; out[q] = { b64: v.b64, w: v.w, h: v.h, url: v.url }; }
        const s = JSON.stringify(out);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([s], { type: 'application/json' }));
        a.download = `${H.shop}-img-${(i / per | 0) + 1}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        parts.push(`${a.download} (${(s.length / 1048576).toFixed(1)}MB)`);
      }
      return parts;
    },

    // The result leaves as a file rather than as a return value: a console result is truncated
    // long before 131 products fit in it, and the file drops straight into Downloads.
    save(name) {
      const out = [['term', 'name', 'url', 'img', 'priceHigh', 'priceLow'].join('\t')];
      for (const [q, hits] of Object.entries(H.res))
        for (const h of (hits || []).slice(0, 3))
          if (h.u) out.push([q, (h.n || '').replace(/\t/g, ' '), h.u, h.i || '', (h.p || [])[0] || '', (h.p || [])[1] || ''].join('\t'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/tab-separated-values' }));
      a.download = name || `${H.shop}-lookup.tsv`;
      document.body.appendChild(a); a.click(); a.remove();
      return `${out.length - 1} row(s) -> ${a.download}`;
    },
  };

  window.H = H;
  return 'H.start(shop, terms) / H.status() / H.save() - shops: ' + Object.keys(SHOPS).join(', ');
})();
