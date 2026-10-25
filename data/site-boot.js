(() => {
  const urls = document.currentScript.dataset.src.split(' ');
  const main = document.getElementById('main');
  if (document.documentElement.classList.contains('route-pending')) main.dataset.loading = document.documentElement.dataset.routeLabel;
  const append = url => new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = url; s.async = false;
    s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
  const start = async () => {
    try {
      // Start catalogue downloads after the prerendered heading has painted.
      // Preloading in the deferred boot script competed with first-paint fonts.
      for (const url of urls) {
        const link = document.createElement('link'); link.rel = 'preload'; link.as = 'script'; link.href = url;
        document.head.appendChild(link);
      }
      // The prerendered photo loads independently at high priority. A slow image
      // must not delay working colour, configuration and shop controls.
      await Promise.all([append(urls[0]), append(urls[1])]);
      const m = location.hash.match(/^#\/(?:p|offers)\/([a-z0-9-]+)$/) || location.pathname.match(/\/p\/([a-z0-9-]+)\/?$/);
      const p = m && DATA.find(p => p.id === m[1]);
      if (p && DETAIL_CHUNKS[p._detailChunk]) await append(DETAIL_CHUNKS[p._detailChunk]);
      await append(urls[2]);
    } catch {
      // Crawlable pages stay available. Failed deep-route startup offers a real retry.
      document.documentElement.classList.remove('route-pending');
      const notice = document.createElement('p');
      const l = document.documentElement.lang;
      notice.textContent = ({hy:'Կայքը չբեռնվեց։ Խնդրում ենք կրկին փորձել։',ru:'Не удалось загрузить сайт. Повторите попытку.',en:'Could not load the site. Please try again.'})[l] || 'Could not load the site. Please try again.';
      const retry = document.createElement('button'); retry.className = 'btn';
      retry.textContent = ({hy:'Կրկին փորձել',ru:'Повторить',en:'Retry'})[l] || 'Retry';
      retry.onclick = () => location.reload(); notice.appendChild(retry); main.prepend(notice);
    }
  };
  requestAnimationFrame(() => setTimeout(start, 0));
  // Installable app (owner, 2026-10-16): registered after load so it never delays the first paint.
  if ('serviceWorker' in navigator && location.protocol === 'https:')
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
})();
