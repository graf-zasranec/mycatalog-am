(() => {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const publicUrl = () => {
    const route = location.hash.slice(1).split('?')[0];
    const safe = /^\/(?:p|offers|c|blog)\/[a-z0-9-]+$/.test(route)
      || /^\/(?:compare|search|privacy|terms|contact|blog|catalog)$/.test(route);
    return location.origin + location.pathname + (safe ? '#' + route : '');
  };
  let referrer = '';
  try { referrer = new URL(document.referrer).origin; } catch {}
  window.ym(113520709, 'init', {
    ssr: true, webvisor: true, clickmap: true, ecommerce: 'dataLayer',
    referrer, url: publicUrl(), accurateTrackBounce: true, trackLinks: true
  });
  let lastUrl = publicUrl();
  window.addEventListener('hashchange', () => {
    const url = publicUrl();
    if (url === lastUrl) return;
    window.ym(113520709, 'hit', url, { referer: lastUrl, title: 'Better.am' });
    lastUrl = url;
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://mc.yandex.ru/metrika/tag.js?id=113520709';
  document.head.appendChild(script);
})();
