(() => {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  const consentKey = 'better.analytics-consent.v1';
  let choice;
  try { choice = localStorage.getItem(consentKey); } catch {}
  let accepted = choice === 'granted';
  window['ga-disable-G-VN0T8DTQWX'] = !accepted;
  // Analytics storage is enabled only by the visitor; advertising stays disabled.
  gtag('consent', 'default', {
    analytics_storage: accepted ? 'granted' : 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied'
  });
  gtag('js', new Date());
  gtag('config', 'G-VN0T8DTQWX', { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  let lastPath;
  const view = () => {
    if (!accepted) return;
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
    if (loaded || !accepted) return;
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
  const labels = {
    hy: ['Ընտրովի վիճակագրություն', 'Թույլատրե՞լ Google Analytics-ի վիճակագրական cookie-ները՝ կայքը բարելավելու համար։ Գովազդային հետևում չենք միացնում։', 'Թույլատրել', 'Չթույլատրել'],
    ru: ['Необязательная статистика', 'Разрешить статистические cookie Google Analytics для улучшения сайта? Рекламное отслеживание отключено.', 'Разрешить', 'Отказаться'],
    en: ['Optional analytics', 'Allow Google Analytics cookies to help improve the website? Advertising tracking stays disabled.', 'Allow', 'Decline']
  };
  const showChoice = () => {
    document.getElementById('analytics-choice')?.remove();
    const copy = labels[document.documentElement.lang] || labels.hy;
    const box = document.createElement('section');
    box.id = 'analytics-choice'; box.setAttribute('aria-label', copy[0]);
    box.style.cssText = 'position:fixed;z-index:1000;bottom:12px;left:12px;right:12px;margin:auto;max-width:680px;padding:16px;border:1px solid var(--line,#ddd);border-radius:14px;background:var(--surface,#fff);color:var(--text,#161c28);box-shadow:0 4px 24px #0002;font:inherit';
    const title = document.createElement('strong'); title.textContent = copy[0];
    const text = document.createElement('p'); text.textContent = copy[1];
    text.style.cssText = 'margin:8px 0 12px;font-size:14px;line-height:1.45';
    const actions = document.createElement('div'); actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px';
    for (const [value, label] of [['granted',copy[2]],['denied',copy[3]]]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.style.cssText = 'min-height:44px;padding:8px 18px;border:1px solid var(--line2,#bbb);border-radius:24px;background:var(--surface2,#f1ebe1);color:inherit;cursor:pointer;font:inherit';
      button.addEventListener('click', () => {
        accepted = value === 'granted';
        window['ga-disable-G-VN0T8DTQWX'] = !accepted;
        try { localStorage.setItem(consentKey, value); } catch {}
        gtag('consent','update',{analytics_storage:value});
        box.remove();
        if (accepted) { view(); schedule(); }
        else {
          // Remove only Google's Analytics cookies when a previous choice is withdrawn.
          for (const cookie of document.cookie.split(';')) {
            const name = cookie.trim().split('=')[0];
            if (!/^_ga(?:_|$)/.test(name)) continue;
            for (const domain of ['',location.hostname,'.'+location.hostname]) {
              document.cookie = name+'=; Max-Age=0; Path=/'+(domain ? '; Domain='+domain : '')+'; SameSite=Lax';
            }
          }
        }
      });
      actions.append(button);
    }
    box.append(title,text,actions); document.body.append(box);
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-analytics-settings]')) showChoice(); });
  new MutationObserver(() => { if (document.getElementById('analytics-choice')) showChoice(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if (choice !== 'granted' && choice !== 'denied') showChoice();
  view();
  window.addEventListener('hashchange', view);
})();
