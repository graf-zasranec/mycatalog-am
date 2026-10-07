(() => {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  // Measure without granting cookie storage or advertising permissions.
  gtag('consent', 'default', {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied'
  });
  gtag('js', new Date());
  gtag('config', 'G-VN0T8DTQWX', { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  let lastPath;
  const view = () => {
    const route = location.hash.slice(1).split('?')[0];
    const publicRoute = /^\/(?:p|offers|c|blog)\/[a-z0-9-]+$/.test(route)
      || /^\/(?:compare|search|privacy|terms|contact|blog|catalog)$/.test(route);
    const path = location.pathname + (publicRoute ? '#' + route : '');
    if (path === lastPath) return;
    lastPath = path;
    let referrer = '';
    try { referrer = new URL(document.referrer).origin; } catch {}
    gtag('event', 'page_view', { page_location: location.origin + path, page_title: 'Better.am', page_referrer: referrer });
  };
  // Queue measurements immediately, then load the library after the first render.
  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-VN0T8DTQWX';
    document.head.appendChild(script);
  };
  const schedule = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 1500 });
    else setTimeout(load, 0);
  }));
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') load(); });
  view();
  window.addEventListener('hashchange', view);
})();
