(() => {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  window.goatcounter = {
    no_onload: true,
    path: () => location.pathname,
    title: 'Better.am',
    referrer: () => { try { return new URL(document.referrer).origin; } catch { return ''; } }
  };
  const pending = [];
  window.betterGoatCount = path => {
    if (typeof window.goatcounter.count === 'function') window.goatcounter.count({path, title: 'Better.am', event: false});
    else pending.push(path);
  };
  const load = () => {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.dataset.goatcounter = "https://grafzasranec.goatcounter.com/count";
    script.onload = () => {
      if (typeof window.goatcounter.count !== 'function') return;
      const paths = pending.length ? pending.splice(0) : [location.pathname];
      for (const path of paths) window.goatcounter.count({path, title: 'Better.am', event: false});
    };
    document.head.appendChild(script);
  };
  const idle = () => 'requestIdleCallback' in window ? requestIdleCallback(load, {timeout:3000}) : setTimeout(load, 1000);
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, {once:true});
})();
