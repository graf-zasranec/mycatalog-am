(() => {
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  const consentKey = 'better.analytics-consent.v1';
  const marketingEnabled = document.currentScript?.dataset.metaPixel === 'true';
  const marketingKey = 'better.marketing-consent.v1';
  let marketingChoice;
  try { marketingChoice = localStorage.getItem(marketingKey); } catch {}
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
    // GA drops everything after '#', so app routes are reported as their real page paths (/ru/p/<id>/).
    const lang = /^\/(ru|en)\//.test(location.pathname) ? location.pathname.slice(0, 3) : '';
    const path = publicRoute ? lang + route + '/' : location.pathname;
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
    const text = document.createElement('p'); text.textContent = marketingEnabled ? ({
      hy:'Թույլատրե՞լ Google Analytics-ի վիճակագրական cookie-ները՝ կայքը բարելավելու համար։ Գովազդային cookie-ները կամընտիր են։',
      ru:'Разрешить статистические cookie Google Analytics для улучшения сайта? Рекламные cookie необязательны.',
      en:'Allow Google Analytics cookies to help improve the website? Advertising cookies are optional.'
    })[document.documentElement.lang] || 'Allow optional analytics cookies?' : copy[1];
    const phone = innerWidth < 600;
    if (phone) box.style.padding = '12px';
    text.style.cssText = `margin:6px 0 ${phone ? 8 : 12}px;font-size:${phone ? 13 : 14}px;line-height:1.4`;
    const actions = document.createElement('div'); actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px';
    let marketing;
    if (marketingEnabled) {
      const label = document.createElement('label');
      label.style.cssText = `display:flex;align-items:center;gap:10px;min-height:44px;margin:${phone ? 4 : 8}px 0;font-size:${phone ? 13 : 14}px;line-height:1.4;cursor:pointer`;
      marketing = document.createElement('input'); marketing.type = 'checkbox';
      marketing.checked = marketingChoice === 'granted';
      const description = document.createElement('span');
      description.textContent = ({
        hy:'Թույլատրել նաև Meta Pixel-ը՝ գովազդի արդյունավետությունը չափելու համար (էջի դիտումներ և գովազդային cookie-ներ)։',
        ru:'Также разрешить Meta Pixel для измерения эффективности рекламы (просмотры страниц и рекламные cookie).',
        en:'Also allow Meta Pixel to measure advertising performance (page views and advertising cookies).'
      })[document.documentElement.lang] || 'Also allow Meta advertising cookies.';
      label.append(marketing, description); box.append(title, text, label);
    }
    for (const [value, label] of [['granted',copy[2]],['denied',copy[3]]]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.style.cssText = 'min-height:44px;padding:8px 18px;border:1px solid var(--line2,#bbb);border-radius:24px;background:var(--surface2,#f1ebe1);color:inherit;cursor:pointer;font:inherit';
      button.addEventListener('click', () => {
        accepted = value === 'granted';
        window['ga-disable-G-VN0T8DTQWX'] = !accepted;
        try { localStorage.setItem(consentKey, value); } catch {}
        if (marketingEnabled) {
          marketingChoice = accepted && marketing.checked ? 'granted' : 'denied';
          try { localStorage.setItem(marketingKey, marketingChoice); } catch {}
          window.dispatchEvent(new CustomEvent('better:marketing-consent', {detail:marketingChoice}));
        }
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
    if (!marketingEnabled) box.append(title,text);
    box.append(actions); document.body.append(box);
  };
  document.addEventListener('click', e => { if (e.target.closest('[data-analytics-settings]')) showChoice(); });
  new MutationObserver(() => { if (document.getElementById('analytics-choice')) showChoice(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if ((choice !== 'granted' && choice !== 'denied') || (marketingEnabled && marketingChoice !== 'granted' && marketingChoice !== 'denied')) showChoice();
  view();
  window.addEventListener('hashchange', view);
})();
