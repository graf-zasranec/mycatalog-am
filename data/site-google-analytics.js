(() => {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
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
  view();
  window.addEventListener('hashchange', view);
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-VN0T8DTQWX';
  document.head.appendChild(script);
})();
