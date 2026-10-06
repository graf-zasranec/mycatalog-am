(() => {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  window.goatcounter = {
    path: () => location.pathname,
    title: 'Better.am',
    referrer: () => { try { return new URL(document.referrer).origin; } catch { return ''; } }
  };
  const load = () => {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.dataset.goatcounter = "https://grafzasranec.goatcounter.com/count";
    document.head.appendChild(script);
  };
  const idle = () => 'requestIdleCallback' in window ? requestIdleCallback(load, {timeout:3000}) : setTimeout(load, 1000);
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, {once:true});
})();
