(() => {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  if (window.betterMetaPixel) return;
  window.betterMetaPixel = true;
  const key = 'better.marketing-consent.v1';
  let accepted = false;
  try { accepted = localStorage.getItem(key) === 'granted'; } catch {}
  let loaded = false, lastPath;
  const view = () => {
    if (!accepted || !loaded) return;
    const route = location.hash.slice(1).split('?')[0];
    const path = (route || location.pathname.replace(/^\/(?:en|ru)(?=\/)/, '')).replace(/\/$/, '') || '/';
    if (path === lastPath) return;
    lastPath = path;
    window.fbq('track', 'PageView');
  };
  const load = () => {
    if (!accepted) return;
    if (!loaded) {
      loaded = true;
      // Meta's queue API; its library loads asynchronously after consent.
      if (!window.fbq) {
        const n = window.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!window._fbq) window._fbq = n;
        n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      }
      window.fbq.disablePushState = true;
      window.fbq('set', 'autoConfig', false, '1658738078984776');
      window.fbq('consent', 'grant');
      window.fbq('init', '1658738078984776');
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    } else window.fbq('consent', 'grant');
    view();
  };
  const schedule = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(load, {timeout:1500});
    else setTimeout(load, 0);
  };
  window.addEventListener('better:marketing-consent', e => {
    const wasAccepted = accepted;
    accepted = e.detail === 'granted';
    if (accepted) { if (!wasAccepted) lastPath = undefined; schedule(); }
    else {
      if (loaded) window.fbq('consent', 'revoke');
      for (const cookie of document.cookie.split(';')) {
        const name = cookie.trim().split('=')[0];
        if (!/^_fb[pc]$/.test(name)) continue;
        for (const domain of ['', location.hostname, '.' + location.hostname])
          document.cookie = name + '=; Max-Age=0; Path=/' + (domain ? '; Domain=' + domain : '') + '; SameSite=Lax';
      }
    }
  });
  window.addEventListener('hashchange', view);
  if (accepted) {
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, {once:true});
  }
})();
