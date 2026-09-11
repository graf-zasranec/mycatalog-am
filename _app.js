/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAXCMP = 4;
const OFFER_PEEK = 5;   // offers shown before the list asks to be expanded
// An explicit way back. An anchor to the logical parent, not history.back(), so it still
// works when someone opens a product or offers link directly.
const backLink = (href, label) =>
  `<a class="backbtn" href="${esc(href)}"><span aria-hidden="true">←</span> ${esc(label)}</a>`;
const RATE = 385;
// local build reads images/<id>.jpg; the published build injects IMGDATA with inline data URIs
const IMG = id => (typeof IMGDATA !== 'undefined' && IMGDATA[id]) || 'images/cut/' + id + '__main.webp';

const U = {
  hy: { mah: 'մԱժ', w: 'Վտ', g: 'գ', mm: 'մմ', hz: 'Հց', nit: 'նիտ', gb: 'GB' },
  ru: { mah: 'мА·ч', w: 'Вт', g: 'г', mm: 'мм', hz: 'Гц', nit: 'нит', gb: 'ГБ' },
  en: { mah: 'mAh', w: 'W', g: 'g', mm: 'mm', hz: 'Hz', nit: 'nits', gb: 'GB' }
};
const X = {
  hy: {
    tier: { flagship: 'Ֆլագման', 'upper-mid': 'Բարձր միջին', mid: 'Միջին', budget: 'Բյուջետային' },
    ch: ['Պաշտոնական ներկայացուցիչ', 'Առցանց խանութ', 'Ներմուծված'],
    any: 'Բոլորը', min: 'նվազ.', newBadge: 'Նոր', view: 'Դիտել', allFilters: 'Բոլոր զտիչները',
    bands: ['6.3″-ից փոքր', '6.3–6.7″', '6.7″-ից մեծ'],
    heroTag: 'Նոր թողարկում', heroA: 'Համեմատի՛ր և ընտրի՛ր', heroB: 'քո հեռախոսը',
    heroSub: 'Ամեն խանութ իր գինն է տալիս։ Մենք դրանք հավաքում ենք մեկ տեղում՝ որպեսզի գտնես հենց քեզ պետքը և չվճարես ավելին, քան պետք է։',
    heroCta: 'Որտեղ է ամենաշահավետը', heroCta2: 'Դիտել կատալոգը',
    tbNote: 'Գները դրամով · ցուցադրական տվյալներ', best: 'լավագույնը',
    footNote: 'Ցուցադրական նախագիծ։ Գները ուղղորդիչ են և չեն թարմացվում խանութներից։',
    emptyT: 'Ոչինչ չի գտնվել', catAll: 'Բոլորը', cats: { phone: 'Հեռախոսներ', tablet: 'Պլանշետներ', watch: 'Խելացի ժամացույցներ', earbuds: 'Ականջակալներ', headphones: 'Լսափողեր', laptop: 'Նոութբուքեր', desktop: 'Համակարգիչներ' }, emptyS: 'Փորձի՛ր փոխել զտիչները։',
    shops: 'խանութ', offersTitle: 'Գներ Հայաստանի խանութներում', bestPrice: 'Լավագույն գին',
    goShop: 'Դեպի խանութ', noOffers: 'Առցանց առաջարկներ չեն գտնվել', estimated: 'Գնահատված գին',
    updated: 'Թարմացվել է', priceSrc: 'Գները վերցված են խանութների կայքերից', from: '-ից',
    sorts: { brand: 'Ապրանքանիշ (Ա–Ֆ)', battery: 'Մարտկոց', screen: 'Էկրանի չափ', savings: 'Խնայողություն', shops: 'Խանութների քանակ', ram: 'Օպերատիվ հիշողություն', storage: 'Հիշողություն' },
    warranty: 'Երաշխիք', variantUnknown: 'տարբերակը նշված չէ', noWarranty: 'չի հրապարակում', pickCapacity: 'Ընտրի՛ր ծավալը՝ խնայողությունը տեսնելու համար', inStock: 'Առկա է', outOfStock: 'Առկա չէ', allOffers: 'Բոլոր առաջարկները', showAll: 'Ցույց տալ բոլորը', showLess: 'Թաքցնել', shopLbl: 'Խանութ', histT: 'Գնի պատմություն', trackSince: 'Հետևում ենք', noHist: 'Դեռ մեկ չափում կա. գրաֆիկը կհայտնվի մի քանի օրից', savingsT: 'Ամենամեծ խնայողությունը', savingsS: 'Նույն հեռախոսը՝ տարբեր խանութներում', priceMatters: 'Գինը կարևոր է', models: 'մոդել', offersLbl: 'առաջարկ', country: 'Հայաստան', saveUpTo: 'Խնայում ես մինչև', diffs: 'տարբերություն', same: 'նույնը', pickVariant: 'Ընտրի՛ր տարբերակը'
  },
  ru: {
    tier: { flagship: 'Флагман', 'upper-mid': 'Верхний средний', mid: 'Средний', budget: 'Бюджетный' },
    ch: ['Официальный дилер', 'Онлайн-магазин', 'Привезённые'],
    any: 'Все', min: 'от', newBadge: 'Новинка', view: 'Смотреть', allFilters: 'Все фильтры',
    bands: ['до 6.3″', '6.3–6.7″', 'больше 6.7″'],
    heroTag: 'Новинка', heroA: 'Сравни и выбери', heroB: 'свой смартфон',
    heroSub: 'Каждый магазин называет свою цену. Мы собираем их в одном месте — чтобы вы нашли именно то, что нужно, и не переплатили.',
    heroCta: 'Где выгоднее всего', heroCta2: 'Открыть каталог',
    tbNote: 'Цены в драмах · демо-данные', best: 'лучшее',
    footNote: 'Демо-проект. Цены ориентировочные и не обновляются из магазинов.',
    emptyT: 'Ничего не найдено', catAll: 'Все', cats: { phone: 'Смартфоны', tablet: 'Планшеты', watch: 'Смарт-часы', earbuds: 'Наушники TWS', headphones: 'Полноразмерные наушники', laptop: 'Ноутбуки', desktop: 'Компьютеры' }, emptyS: 'Попробуйте изменить фильтры.',
    shops: 'магазина', offersTitle: 'Цены в магазинах Армении', bestPrice: 'Лучшая цена',
    goShop: 'В магазин', noOffers: 'Онлайн-предложений не найдено', estimated: 'Оценочная цена',
    updated: 'Обновлено', priceSrc: 'Цены взяты с сайтов магазинов', from: 'от ',
    sorts: { brand: 'Бренд (А–Я)', battery: 'Батарея', screen: 'Диагональ', savings: 'Экономия', shops: 'Число магазинов', ram: 'Оперативная память', storage: 'Память' },
    warranty: 'Гарантия', variantUnknown: 'версия не указана', noWarranty: 'не публикует', pickCapacity: 'Выберите объём, чтобы увидеть выгоду', inStock: 'В наличии', outOfStock: 'Нет в наличии', allOffers: 'Все предложения', showAll: 'Показать все', showLess: 'Свернуть', shopLbl: 'Магазин', histT: 'История цены', trackSince: 'Отслеживаем с', noHist: 'Пока одно измерение — график появится через несколько дней', savingsT: 'Наибольшая выгода', savingsS: 'Один телефон — разные магазины', priceMatters: 'Цена имеет значение', models: 'моделей', offersLbl: 'предложений', country: 'Армения', saveUpTo: 'Экономия до', diffs: 'отличий', same: 'одинаково', pickVariant: 'Выберите версию'
  },
  en: {
    tier: { flagship: 'Flagship', 'upper-mid': 'Upper mid', mid: 'Mid-range', budget: 'Budget' },
    ch: ['Official reseller', 'Online shop', 'Grey import'],
    any: 'All', min: 'from', newBadge: 'New', view: 'View', allFilters: 'All filters',
    bands: ['under 6.3″', '6.3–6.7″', 'over 6.7″'],
    heroTag: 'Just launched', heroA: 'Compare and pick', heroB: 'your next phone',
    heroSub: 'Every shop quotes its own price. We put them side by side, so you find the one you actually need and never pay more than you have to.',
    heroCta: 'Where you save most', heroCta2: 'Browse the catalogue',
    tbNote: 'Prices in dram · demo data', best: 'best',
    footNote: 'Demo project. Prices are indicative and are not a live shop feed.',
    emptyT: 'No results', catAll: 'All', cats: { phone: 'Phones', tablet: 'Tablets', watch: 'Smartwatches', earbuds: 'Earbuds', headphones: 'Headphones', laptop: 'Laptops', desktop: 'Desktops' }, emptyS: 'Try changing the filters.',
    shops: 'shops', offersTitle: 'Prices in Armenian shops', bestPrice: 'Best price',
    goShop: 'Go to shop', noOffers: 'No online offers found', estimated: 'Estimated price',
    updated: 'Updated', priceSrc: 'Prices taken from the shops’ own sites', from: 'from ',
    sorts: { brand: 'Brand (A–Z)', battery: 'Battery', screen: 'Screen size', savings: 'Biggest saving', shops: 'Most shops', ram: 'RAM', storage: 'Storage' },
    warranty: 'Warranty', variantUnknown: 'variant not stated', noWarranty: 'not published', pickCapacity: 'Pick a capacity to see the saving', inStock: 'In stock', outOfStock: 'Out of stock', allOffers: 'All offers', showAll: 'Show all', showLess: 'Show less', shopLbl: 'Shop', histT: 'Price history', trackSince: 'Tracking since', noHist: 'Only one reading so far — the chart appears after a few days', savingsT: 'Where you save most', savingsS: 'Same phone, different shops', priceMatters: 'Price matters', models: 'models', offersLbl: 'offers', country: 'Armenia', saveUpTo: 'Save up to', diffs: 'differences', same: 'identical', pickVariant: 'Pick a variant'
  }
};

/* ================= state ================= */
const LS = 'mycatalog.v2';
const D = { lang: 'hy', theme: 'auto', cat: '', q: '', scrmin: 0, touch: 0, brands: [], pmin: 0, pmax: 0, bounds: null, ram: 0, stor: 0, scr: '', batt: 0, hz: 0, g5: false, nfc: false, sort: 'popular', cmp: [] };
let st = { ...D };
try { Object.assign(st, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { }
// Saved state is user-editable and outlives releases: a language we dropped, a sort that no longer
// exists, or an array that came back as a string would all render as a broken page.
for (const k of ['brands', 'cmp']) if (!Array.isArray(st[k])) st[k] = [];
if (!Array.isArray(st.bounds) || st.bounds.length !== 2) st.bounds = null;
if (!['hy', 'ru', 'en'].includes(st.lang)) st.lang = D.lang;
if (!['auto', 'light', 'dark'].includes(st.theme)) st.theme = D.theme;
if (typeof st.q !== 'string') st.q = '';
const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { } };

// The price filter compares against each phone's CHEAPEST offer, so the slider bounds have to be
// built from those same numbers. Using the priciest variant here left the top of the range inert.
const _allPrices = DATA.map(p => {
  const real = (typeof PRICES !== 'undefined' && PRICES.offers && PRICES.offers[p.id]) || [];
  return real.length ? Math.min(...real.map(o => o.price)) : p.priceAmd;
// One missing or malformed price would make PMIN/PMAX NaN, and every comparison against NaN is
// false, so the catalogue would silently render empty with no clue why.
}).filter(Number.isFinite);
const PMIN = Math.floor(Math.min(..._allPrices) / 5000) * 5000;
const PMAX = Math.ceil(Math.max(..._allPrices) / 5000) * 5000;
// The saved price range was chosen against an older price list. Prices move every night now,
// so a stale range silently hides phones that drifted outside it. Remember the bounds the
// filter was set against and reset it whenever the catalogue's own range has changed.
if (!st.pmin || !st.pmax || st.bounds?.[0] !== PMIN || st.bounds?.[1] !== PMAX) {
  st.pmin = PMIN; st.pmax = PMAX;
}
st.bounds = [PMIN, PMAX];
st.cmp = st.cmp.filter(id => DATA.some(p => p.id === id)).slice(0, MAXCMP);

const BRANDS = [...new Set(DATA.map(p => p.brand))].sort();
if (st.cat && !DATA.some(p => (p.category || 'phone') === st.cat)) st.cat = '';
st.cmp = st.cmp.filter(id => DATA.some(p => p.id === id));   // drop compare entries for products that are gone
const byId = id => DATA.find(p => p.id === id);

/* ================= format ================= */
const t = k => (STR[st.lang] && STR[st.lang][k]) || STR.hy[k] || k;
const u = k => U[st.lang][k];
const x = k => X[st.lang][k];
// Apple and Samsung model names already say the brand - "iPhone 17 Pro", not "Apple iPhone 17 Pro".
// The brand is still searchable; see the query test below, which adds p.brand back in.
const BARE_BRAND = new Set(['apple', 'samsung']);
const fullName = p => (BARE_BRAND.has(p.brand.toLowerCase()) || p.name.toLowerCase().startsWith(p.brand.toLowerCase()))
  ? p.name : p.brand + ' ' + p.name;
const money = n => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
const amd = n => `${money(n)}<span class="d"> ֏</span>`;
const relDate = s => s ? s.slice(5) + '.' + s.slice(0, 4) : '—';
// Six months from release, computed, not a date literal that quietly ages into "everything is new".
const isNew = p => {
  const m = /^(\d{4})-(\d{2})/.exec(p.released || '');
  if (!m) return false;
  const now = new Date();
  const age = (now.getFullYear() - +m[1]) * 12 + (now.getMonth() + 1 - +m[2]);
  return age >= 0 && age <= 6;
};
// A variant is "how much storage" for a phone or tablet and "which case size" for a watch.
// Both ride in variant.storage; the item's variantUnit decides how it is printed.
const gb = (v, unit) => unit === 'mm' ? v + ' ' + u('mm')
  : v >= 1024 ? (v / 1024) + ' TB' : v + ' ' + u('gb');

/* real shop offers scraped by scrape.mjs; empty when prices.json has not been generated */
const P = (typeof PRICES !== 'undefined' && PRICES) || { shops: {}, offers: {} };
const offersFor = p => (P.offers && P.offers[p.id]) || [];      // pre-sorted cheapest first
const hasReal = p => offersFor(p).length > 0;
const bestOf = p => hasReal(p) ? offersFor(p)[0].price : p.priceAmd;
const safeHref = u => /^https?:\/\//i.test(String(u)) ? String(u) : '#';
const shopName = k => (P.shops && P.shops[k] && P.shops[k].name) || k;
// one phone can have many offers per shop (storage x colour), so never count rows as shops
const shopCount = list => new Set(list.map(o => o.shop)).size;
const shopSite = k => (P.shops && P.shops[k] && P.shops[k].site) || '#';
const shopWarranty = k => (P.shops && P.shops[k] && P.shops[k].warranty) || null;
const realFor = (p, storage) => { const o = offersFor(p).find(o => o.storage === storage); return o ? o.price : null; };
const HIST = (typeof HISTORY !== 'undefined' && HISTORY.points) || {};
const dmy = d => d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '';
// Plot only days we actually recorded. One point is not a trend, so it says so instead.
function historyHTML(p) {
  const pts = HIST[p.id] || [];
  if (!pts.length) return '';
  if (pts.length < 2) return `<h2 class="sh">${esc(x('histT'))}</h2>
    <p class="note">${esc(x('noHist'))} · ${esc(x('trackSince'))} ${esc(dmy(pts[0].d))}</p>`;
  const W = 640, H = 120, pad = 8;
  const lo = Math.min(...pts.map(v => v.lo)), hi = Math.max(...pts.map(v => v.hi));
  const span = hi - lo || 1;
  const xs = i => pad + i * (W - pad * 2) / (pts.length - 1);
  const ys = v => pad + (1 - (v - lo) / span) * (H - pad * 2);
  // plot the whole daily range: cheapest line, dearest line, band between them
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(v.lo).toFixed(1)}`).join(' ');
  const dHi = pts.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(v.hi).toFixed(1)}`).join(' ');
  const band = dHi + ' ' + pts.slice().reverse().map((v, i) =>
    `L${xs(pts.length - 1 - i).toFixed(1)} ${ys(v.lo).toFixed(1)}`).join(' ') + ' Z';
  const last = pts[pts.length - 1], first = pts[0];
  const delta = last.lo - first.lo;
  return `<h2 class="sh">${esc(x('histT'))}</h2>
    <div class="hist">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
        aria-label="${esc(x('histT'))}: ${money(first.lo)} - ${money(last.lo)} AMD">
        <path class="ha" d="${band}"/><path class="hh" d="${dHi}"/><path class="hl" d="${d}"/>
        <circle class="hd" cx="${xs(pts.length - 1).toFixed(1)}" cy="${ys(last.lo).toFixed(1)}" r="4"/>
      </svg>
      <div class="hist-ax">
        <span>${esc(dmy(first.d))} · ${money(first.lo)}–${money(first.hi)} ֏</span>
        <span class="${delta < 0 ? 'dn' : delta > 0 ? 'up' : ''}">${delta === 0 ? '—' : (delta < 0 ? '↓ ' : '↑ ') + money(Math.abs(delta)) + ' ֏'}</span>
        <span>${esc(dmy(last.d))} · ${money(last.lo)}–${money(last.hi)} ֏</span>
      </div>
    </div>`;
}
const updatedOn = () => P.generated ? P.generated.slice(8, 10) + '.' + P.generated.slice(5, 7) + '.' + P.generated.slice(0, 4) : '';

/* ================= filtering ================= */
function matches(p, s) {
  if (s.cat && (p.category || 'phone') !== s.cat) return false;   // same default inView()/catTabs() use
  const q = s.q.trim().toLowerCase();
  if (q && !(p.brand + ' ' + fullName(p) + ' ' + (p.chipset?.name || '')).toLowerCase().includes(q)) return false;
  if (s.brands.length && !s.brands.includes(p.brand)) return false;
  const pr = bestOf(p);
  if (pr < s.pmin || pr > s.pmax) return false;
  if (s.ram && !(p.variants || []).some(v => v.ram >= s.ram)) return false;
  if (s.stor && !(p.variants || []).some(v => v.storage >= s.stor)) return false;
  // an ACTIVE spec filter excludes anything without that spec: earbuds have no screen, so
  // they must not slip through a "120 Hz or more" filter merely by lacking the field
  if (s.batt && !(p.battery?.capacity >= s.batt)) return false;
  if (s.hz && !(p.display?.refresh >= s.hz)) return false;
  if (s.g5 && !/5G/i.test(p.connectivity?.network || '')) return false;
  if (s.nfc && !p.connectivity?.nfc) return false;
  const d = p.display?.size;
  if (s.scrmin && !(d >= s.scrmin)) return false;
  // 1 = must have a touchscreen, 2 = must not; 0 = do not care
  if (s.touch && p.display?.touch !== (s.touch === 1)) return false;
  if (s.scr) {
    if (d == null) return false;
    if (s.scr === 'lt63' && d >= 6.3) return false;
    if (s.scr === 'mid' && (d < 6.3 || d > 6.7)) return false;
    if (s.scr === 'gt67' && d <= 6.7) return false;
  }
  return true;
}
const spreadOf = p => { const o = offersFor(p); return o.length > 1 ? o[o.length - 1].price - o[0].price : 0; };
const SORTS = {
  popular: (a, b) => b.popularity - a.popularity,
  price_asc: (a, b) => bestOf(a) - bestOf(b),
  price_desc: (a, b) => bestOf(b) - bestOf(a),
  newest: (a, b) => (b.released || '').localeCompare(a.released || ''),
  brand: (a, b) => a.brand.localeCompare(b.brand) || fullName(a).localeCompare(fullName(b)),
  battery: (a, b) => (b.battery?.capacity || 0) - (a.battery?.capacity || 0),
  screen: (a, b) => (b.display?.size || 0) - (a.display?.size || 0),
  savings: (a, b) => spreadOf(b) - spreadOf(a),
  shops: (a, b) => shopCount(offersFor(b)) - shopCount(offersFor(a)),
  ram: (a, b) => topOf(b, 'ram') - topOf(a, 'ram'),
  storage: (a, b) => topOf(b, 'storage') - topOf(a, 'storage')
};
const topOf = (p, k) => Math.max(0, ...(p.variants || []).map(v => v[k] || 0));
// A sort is only worth offering when the items on screen actually carry the number: "Battery"
// on a page of desktops sorts nothing, it just puts a dead option in the menu.
const SORT_NEEDS = { battery: p => p.battery?.capacity, screen: p => p.display?.size,
  ram: p => topOf(p, 'ram'), storage: p => topOf(p, 'storage'), savings: p => spreadOf(p) };
const SORT_ALL = ['popular', 'price_asc', 'price_desc', 'savings', 'shops', 'newest', 'brand', 'ram', 'storage', 'battery', 'screen'];
if (!SORT_ALL.includes(st.sort)) st.sort = D.sort;   // a sort key we removed must not survive in saved state
const sortKeys = () => { const v = inView(); return SORT_ALL.filter(k => !SORT_NEEDS[k] || v.some(SORT_NEEDS[k])); };
const sortLabel = k => (X[st.lang].sorts && X[st.lang].sorts[k]) || t('sort.' + k);
const results = () => DATA.filter(p => matches(p, st)).sort(SORTS[st.sort] || SORTS.popular);
const cnt = extra => DATA.filter(p => matches(p, { ...st, ...extra })).length;

/* ================= spec table ================= */
const GROUPS = [
  ['sec.display', [
    ['f.screen_size', p => p.display.size + '″', p => p.display.size],
    ['f.screen_type', p => p.display.type],
    ['f.resolution', p => p.display.resolution],
    ['f.refresh_rate', p => p.display.refresh + ' ' + u('hz'), p => p.display.refresh, 1],
    ['f.ppi', p => p.display.ppi && p.display.ppi + ' ppi', p => p.display.ppi, 1],
    ['f.brightness', p => p.display.brightness && money(p.display.brightness) + ' ' + u('nit'), p => p.display.brightness, 1],
    ['f.protection', p => p.display?.protection],
    ['f.touch', p => p.display?.touch == null ? null : p.display.touch ? t('common.yes') : t('common.no')]
  ]],
  ['sec.performance', [
    ['f.chipset', p => p.chipset.name],
    ['f.process', p => p.chipset.process],
    ['f.cpu', p => p.chipset.cpu],
    ['f.gpu', p => p.graphics?.name || p.chipset?.gpu],
  ]],
  ['sec.memory', [
    // an item with nothing to choose (earbuds) or no RAM figure (a watch) shows no row at all
    ['f.ram', p => { const v = [...new Set((p.variants || []).map(x => x.ram))].filter(x => x != null && x > 0);
      return v.length ? v.join(' / ') + ' ' + u('gb') : null; }, p => topOf(p, 'ram'), 1],
    ['f.storage', p => { const v = [...new Set((p.variants || []).map(x => x.storage))].filter(x => x != null);
      return v.length ? v.map(x => gb(x, p.variantUnit)).join(' / ') : null; }, p => topOf(p, 'storage'), 1],
    ['f.card_slot', p => p.cardSlot == null ? null : p.cardSlot ? t('common.yes') : t('common.no')]
  ]],
  ['sec.camera', [
    ['f.main_cam', p => p.camera.main],
    ['f.ultrawide', p => p.camera.ultrawide],
    ['f.telephoto', p => p.camera.telephoto],
    ['f.front_cam', p => p.camera.front],
    ['f.video', p => p.camera.video]
  ]],
  ['sec.battery', [
    ['f.capacity', p => money(p.battery.capacity) + ' ' + u('mah'), p => p.battery.capacity, 1],
    ['f.charging', p => p.battery.wired && p.battery.wired + ' ' + u('w'), p => p.battery.wired, 1],
    ['f.wireless', p => p.battery?.capacity == null ? null : p.battery.wireless ? p.battery.wireless + ' ' + u('w') : t('common.no'), p => p.battery?.wireless, 1]
  ]],
  ['sec.body', [
    ['f.dimensions', p => `${p.body.height} × ${p.body.width} × ${p.body.thickness} ${u('mm')}`, p => p.body.thickness, -1],
    ['f.weight', p => p.body.weight + ' ' + u('g'), p => p.body.weight, -1],
    ['f.materials', p => p.body.materials],
    ['f.ip_rating', p => p.body.ip]
  ]],
  ['sec.connectivity', [
    ['f.network', p => p.connectivity.network],
    ['f.wifi', p => p.connectivity.wifi],
    ['f.bluetooth', p => p.connectivity.bluetooth],
    ['f.nfc', p => p.connectivity?.nfc == null ? null : p.connectivity.nfc ? t('common.yes') : t('common.no')],
    ['f.sim', p => p.connectivity.sim]
  ]],
  ['sec.software', [
    ['f.os', p => p.os],
    ['f.updates', p => p.updates],
    ['f.released', p => relDate(p.released)]
  ]]
];

/* ================= chrome ================= */
const ICON_CHEV = '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
function paintChrome() {
  document.documentElement.lang = st.lang;
  if (st.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = st.theme;
  $('#langs').innerHTML = ['hy', 'ru', 'en'].map(l =>
    `<button data-lang="${l}" aria-pressed="${st.lang === l}">${{ hy: 'ՀԱՅ', ru: 'РУС', en: 'ENG' }[l]}</button>`).join('');
  const tb = $('#themeBtn');
  tb.setAttribute('aria-label', t('common.theme') + ': ' + st.theme);
  tb.setAttribute('title', t('common.theme'));
  $('#srchLbl').textContent = t('nav.search_placeholder');
  $('#q').setAttribute('aria-label', t('nav.search_placeholder'));
  $('#q').placeholder = t('nav.search_placeholder');
  if ($('#q').value !== st.q) $('#q').value = st.q;
  const h = location.hash.replace(/^#/, '') || '/';
  $('#nav').innerHTML =
    `<a href="#/" ${h === '/' || h.startsWith('/c/') ? 'aria-current="page"' : ''}>${esc(t('nav.catalog'))}</a>` +
    `<a href="#/compare" ${h === '/compare' ? 'aria-current="page"' : ''}>${esc(t('nav.compare'))}</a>`;
  $('#hdrCmpLbl').textContent = t('nav.compare');
  $('#hdrConstructLbl').textContent = t('construct.title');
  $('#hdrCmpN').textContent = st.cmp.length;
  $('#foot').innerHTML = `<b>MyCatalog</b><span>${esc(x('priceSrc'))}${updatedOn() ? ` · ${esc(x('updated'))} ${esc(updatedOn())}` : ``}</span>`;
}
function paintTray() {
  const tray = $('#tray');
  if (!st.cmp.length) { tray.hidden = true; document.body.style.paddingBottom = ''; return; }
  tray.hidden = false;
  tray.innerHTML = `<div class="shell">` +
    st.cmp.map(id => `<span class="tslot"><img src="${IMG(id)}" alt="" loading="lazy"></span>`).join('') +
    `<span class="lbl">${esc(t('common.results_count').replace('{n}', st.cmp.length))}</span>` +
    `<button class="clr" data-act="clearcmp" aria-label="${esc(t('compare.clear'))}">` +
    `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12"/></svg>` +
    `<span class="lbl">${esc(t('compare.clear'))}</span></button>` +
    `<a class="btn" href="#/compare">${esc(t('nav.compare'))}</a>` +
    `<p class="traymsg" id="traymsg" role="status" aria-live="polite"></p></div>`;
  // reserve exactly the tray height - the old fixed 78px stopped clearing it once the
  // message line was added, and the tray covered the last rows of the page
  document.body.style.paddingBottom = tray.offsetHeight + 'px';
  $('#hdrCmpN').textContent = st.cmp.length;
}
// the compare limit used to fire a browser alert(); say it in the tray instead
let trayMsgT;
function trayMsg(text) {
  const el = $('#traymsg'); if (!el) return;
  el.textContent = text; el.classList.add('on');
  const tray = $('#tray');
  requestAnimationFrame(() => { document.body.style.paddingBottom = tray.offsetHeight + 'px'; });
  clearTimeout(trayMsgT); trayMsgT = setTimeout(() => el.classList.remove('on'), 3200);
  setTimeout(() => { const el2 = $('#tray'); if (el2) document.body.style.paddingBottom = el2.offsetHeight + 'px'; }, 3450);
}
function toggleCmp(id) {
  const i = st.cmp.indexOf(id);
  if (i >= 0) st.cmp.splice(i, 1);
  else if (st.cmp.length >= MAXCMP) { trayMsg(t('compare.max_reached')); return false; }
  else st.cmp.push(id);
  save(); paintTray();
  const on = st.cmp.includes(id), nm = fullName(byId(id));
  $$(`[data-cmp="${id}"]`).forEach(b => {
    b.setAttribute('aria-pressed', on);
    // aria-pressed alone leaves a screen reader saying "Add to compare, pressed"
    b.setAttribute('aria-label', `${on ? t('detail.in_compare') : t('detail.add_compare')}: ${nm}`);
  });
  return true;
}

/* ================= filter bar ================= */
// Filter steps are read off the items on screen. The old fixed lists ([4,6,8,12,16] RAM,
// [64,128,256,512] storage) could not offer the 24 GB and 2 TB the laptops brought in, and
// offered 64 GB to a category whose smallest phone is 128.
const steps = get => {
  const v = [...new Set(inView().flatMap(get))].filter(n => typeof n === 'number' && n > 0).sort((a, b) => a - b);
  if (v.length <= 6) return v;
  // ponytail: evenly sampled, which is plenty for a "this much or more" filter
  return [...new Set(Array.from({ length: 6 }, (_, i) => v[Math.round(i * (v.length - 1) / 5)]))];
};
// every product in view is a watch -> the variant number is a case size, not a capacity
const viewUnit = () => {
  // only the items that actually supply a number get a say: a band with no variants at all
  // was dragging the whole watch category back to gigabytes.
  const p = inView().filter(q => (q.variants || []).some(v => v.storage != null));
  return p.length && p.every(q => q.variantUnit === 'mm') ? 'mm' : undefined;
};
const CHIPSETS = () => { const unit = viewUnit(); return [
  ['ram', 'filter.ram', steps(p => (p.variants || []).map(v => v.ram)), v => v + ' ' + u('gb')],
  ['stor', 'filter.storage', steps(p => (p.variants || []).map(v => v.storage)), v => gb(v, unit)],
  ['batt', 'filter.battery', steps(p => [p.battery?.capacity]), v => money(v) + ' ' + u('mah')],
  ['hz', 'filter.refresh_rate', steps(p => [p.display?.refresh]), v => v + ' ' + u('hz')]
]; };
const drop = (key, label, body, right) =>
  `<details class="fdrop${right ? ' r' : ''}" data-drop="${key}"><summary>${esc(label)}${ICON_CHEV}</summary><div class="panel">${body}</div></details>`;
const radios = (key, vals, fmt) =>
  `<label class="opt"><input type="radio" name="r-${key}" data-f="${key}" value="0"><span>${esc(x('any'))}</span></label>` +
  vals.map(v => `<label class="opt"><input type="radio" name="r-${key}" data-f="${key}" value="${v}"><span>${esc(fmt(v))}</span><span class="n num" data-cnt="${key}:${v}"></span></label>`).join('');

// A filter earns its place only if the items in view actually differ on it. Deriving that
// from the data means a new category never needs a hand-written filter list.
function inView() { return DATA.filter(p => !st.cat || (p.category || 'phone') === st.cat); }
function varies(get) { return new Set(inView().map(get).filter(v => v != null && v !== '')).size > 1; }
function filterBar() {
  const pool = inView();
  let h = `<div class="fbar">`;
  const brandsHere = [...new Set(pool.map(p => p.brand))].sort();
  if (brandsHere.length > 1) h += drop('brand', t('filter.brand'), brandsHere.map(b =>
    `<label class="opt"><input type="checkbox" data-f="brand" value="${esc(b)}"><span>${esc(b)}</span><span class="n num" data-cnt="b:${esc(b)}"></span></label>`).join(''));
  h += drop('price', t('filter.price'), `<div class="rngbox"><div class="rng"><span class="track"></span><span class="fill"></span>
      <input type="range" data-f="pmin" min="${PMIN}" max="${PMAX}" step="5000" aria-label="${esc(t('common.from'))}">
      <input type="range" data-f="pmax" min="${PMIN}" max="${PMAX}" step="5000" aria-label="${esc(t('common.to'))}"></div>
      <div class="rngv"><span class="num" data-rng="min"></span><span class="num" data-rng="max"></span></div></div>`);
  const VARIES = { ram: p => topOf(p, 'ram') || null, stor: p => topOf(p, 'storage') || null,
    batt: p => p.battery?.capacity, hz: p => p.display?.refresh };
  for (const [k, lbl, vals, fmt] of CHIPSETS())
    if (vals.length > 1 && (!VARIES[k] || varies(VARIES[k]))) h += drop(k, t(lbl), radios(k, vals, fmt));
  if (varies(p => p.display?.size)) h += drop('scr', t('filter.screen_size'),
    `<label class="opt"><input type="radio" name="r-scr" data-f="scr" value=""><span>${esc(x('any'))}</span></label>` +
    ['lt63', 'mid', 'gt67'].map((v, i) => `<label class="opt"><input type="radio" name="r-scr" data-f="scr" value="${v}"><span>${esc(x('bands')[i])}</span><span class="n num" data-cnt="scr:${v}"></span></label>`).join(''));
  if (varies(p => /5G/i.test(p.connectivity?.network || ''))) h += `<button class="toggle" data-f="g5" aria-pressed="false">5G</button>`;
  if (varies(p => p.connectivity?.nfc)) h += `<button class="toggle" data-f="nfc" aria-pressed="false">NFC</button>`;
  h += `<span class="spacer"></span>`;
  h += drop('sort', `${t('sort.label')}: ${sortLabel(st.sort)}`, sortKeys().map(s =>
    `<label class="opt"><input type="radio" name="r-sort" data-f="sort" value="${s}"><span>${esc(sortLabel(s))}</span></label>`).join(''), true);
  return h + `</div>`;
}
function syncFilters() {
  $$('[data-f]').forEach(el => {
    const k = el.dataset.f;
    if (el.tagName === 'BUTTON') { el.setAttribute('aria-pressed', !!st[k]); return; }
    if (k === 'brand') el.checked = st.brands.includes(el.value);
    else if (k === 'pmin' || k === 'pmax') el.value = st[k];
    else if (el.type === 'radio') el.checked = String(st[k] ?? '') === el.value;
  });
  $$('[data-cnt]').forEach(el => {
    const [k, v] = el.dataset.cnt.split(':');
    el.textContent = k === 'b' ? cnt({ brands: [v] }) : k === 'scr' ? cnt({ scr: v }) : cnt({ [k]: +v });
  });
  $$('[data-rng="min"]').forEach(e => e.textContent = money(st.pmin) + ' ֏');
  $$('[data-rng="max"]').forEach(e => e.textContent = money(st.pmax) + ' ֏');
  $$('.rng .fill').forEach(f => {
    const sp = PMAX - PMIN;
    f.style.left = ((st.pmin - PMIN) / sp * 100) + '%';
    f.style.right = ((PMAX - st.pmax) / sp * 100) + '%';
  });
  const sd = document.querySelector('[data-drop="sort"] > summary');
  if (sd) sd.childNodes[0].nodeValue = t('sort.label') + ': ' + sortLabel(st.sort);
  $$('[data-drop]').forEach(d => {
    const k = d.dataset.drop;
    const on = k === 'brand' ? st.brands.length : k === 'price' ? (st.pmin > PMIN || st.pmax < PMAX)
      : k === 'sort' ? st.sort !== 'popular' : !!st[k];
    d.classList.toggle('on', !!on);
  });
}
// A filter set in one category follows you into the next one, where the filter bar no longer
// shows a control for it - the touchscreen question from Construct survives onto a page of
// desktops and empties it for a reason nothing on screen explains. So on every category change,
// drop the filters the new category cannot satisfy at all.
function pruneFilters() {
  const pool = inView();
  const base = { ...D, brands: [], cat: st.cat, pmin: PMIN, pmax: PMAX };
  for (const k of ['ram', 'stor', 'batt', 'hz', 'scr', 'scrmin', 'touch', 'g5', 'nfc'])
    if (st[k] && !pool.some(p => matches(p, { ...base, [k]: st[k] }))) st[k] = D[k];
  if (st.brands.length && !pool.some(p => st.brands.includes(p.brand))) st.brands = [];
}

const activeChips = () => {
  const o = [];
  st.brands.forEach(b => o.push(['brand:' + b, b]));
  if (st.pmin > PMIN || st.pmax < PMAX) o.push(['price', `${money(st.pmin)}–${money(st.pmax)} ֏`]);
  if (st.ram) o.push(['ram', `${x('min')} ${st.ram} ${u('gb')}`]);
  if (st.stor) o.push(['stor', `${x('min')} ${gb(st.stor, viewUnit())}`]);
  if (st.touch) o.push(['touch', `${t('f.touch')}: ${st.touch === 1 ? t('common.yes') : t('common.no')}`]);
  if (st.scrmin) o.push(['scrmin', `${x('min')} ${st.scrmin}″`]);
  if (st.batt) o.push(['batt', `${x('min')} ${money(st.batt)} ${u('mah')}`]);
  if (st.hz) o.push(['hz', `${x('min')} ${st.hz} ${u('hz')}`]);
  if (st.scr) o.push(['scr', x('bands')[{ lt63: 0, mid: 1, gt67: 2 }[st.scr]]]);
  if (st.g5) o.push(['g5', '5G']);
  if (st.nfc) o.push(['nfc', 'NFC']);
  return o;
};

/* ================= catalog ================= */
function card(p) {
  const n = shopCount(offersFor(p));
  // show the configuration the displayed price actually belongs to, not simply the first variant
  const cheapest = offersFor(p)[0];
  const v = (cheapest && p.variants.find(z => z.storage === cheapest.storage))
    || p.variants[0] || {};
  return `<article class="pcard">
    <div class="pshot">
      ${isNew(p) ? `<span class="badge">${esc(x('newBadge'))}</span>` : ''}
      <button class="fav" data-cmp="${esc(p.id)}" aria-pressed="${st.cmp.includes(p.id)}"
        aria-label="${esc(t('detail.add_compare'))}: ${esc(fullName(p))}">
        <svg viewBox="0 0 24 24"><path d="M4 7h10M4 17h10M17 4v6M20 7h-6M20 17h-6M7 14v6"/></svg></button>
      <img src="${IMG(p.id)}" alt="${esc(fullName(p))}" loading="lazy" decoding="async">
    </div>
    <div class="pbody">
      <span class="eyebrow">${esc(p.brand)}</span>
      <h3><a href="#/p/${esc(p.id)}">${esc(fullName(p))}</a></h3>
      <ul class="sc">${cardFacts(p, v).map(fx => `<li>${fx}</li>`).join('')}</ul>
      <div class="pfoot"><span class="pprice num">${amd(bestOf(p))}
        <s>${n ? n + ' ' + esc(x('shops')) : esc(x('estimated'))}</s></span>
        <span class="go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span></div>
    </div>
  </article>`;
}
// the hero belongs to the dark masthead so nav and hero share one surface (no seam)
// The cover and the savings strip both live in the masthead surface, so nav -> cover ->
// catalogue read as one field. Savings are computed from the REAL spread between shops.
// A card shows three quick facts, but a phone, a watch and a pair of earbuds do not have
// the same three. Take whatever the item actually carries and stop at three.
function cardFacts(p, v) {
  const f = [];
  if (p.display?.size) f.push(esc(p.display.size + String.fromCharCode(8243)));
  if (v.storage != null) f.push(esc((v.ram ? v.ram + '/' : '') + gb(v.storage, p.variantUnit)));
  if (p.battery?.capacity) f.push(`<span class="num">${money(p.battery.capacity)} ${esc(u('mah'))}</span>`);
  if (p.chipset?.name) f.push(esc(p.chipset.name));
  if (p.audio?.type) f.push(esc(tr(p.audio.type, st.lang)));
  if (p.body?.ip) f.push(esc(p.body.ip));
  return f.slice(0, 3);
}
function biggestSavings(n = 3) {
  // A saving is only real if it is the SAME phone in the SAME capacity. Comparing a 256 GB
  // offer against a 2 TB one produces a huge number nobody can actually pocket, so the spread
  // is measured inside each storage tier and the best genuine one wins.
  return DATA.map(p => {
    const byTier = new Map();
    for (const o of offersFor(p)) {
      const k = (o.storage ?? 'base') + '|' + (o.ram ?? '');
      (byTier.get(k) || byTier.set(k, []).get(k)).push(o.price);
    }
    let best = null;
    for (const [tier, prices] of byTier) {
      if (prices.length < 2) continue;
      const lo = Math.min(...prices), hi = Math.max(...prices);
      if (hi > lo && (!best || hi - lo > best.gap)) best = { p, lo, hi, gap: hi - lo, tier };
    }
    return best;
  }).filter(Boolean).sort((a, b) => b.gap - a.gap).slice(0, n);
}

// The hero used to be one hardcoded iPhone. Five popular phones that actually have a photo,
// crossfading; the rotation is a CSS animation, so there is no timer to cancel on route change.
const heroPicks = () => DATA.filter(p => (p.category || 'phone') === 'phone' && IMG(p.id))
  .sort((a, b) => b.popularity - a.popularity).slice(0, 5);
function mastHero() {
  const picks = heroPicks();
  const f = picks[0] || byId('apple-iphone-17') || DATA[0];
  const sv = biggestSavings(3);
  const offersTotal = Object.values(P.offers || {}).reduce((n, a) => n + a.length, 0);
  return `<div class="cv-eyebrow">${esc(x('priceMatters'))}</div>
    <div class="cv">
      <h1 class="cv-h">${esc(x('heroA'))} <em>${esc(x('heroB'))}</em></h1>
      <div class="cv-m">${(picks.length ? picks : [f]).map((p, i) => `<img src="${IMG(p.id)}" alt="${esc(fullName(p))}" style="animation-delay:${i * 4}s"${i ? ' loading="lazy"' : ' fetchpriority="high"'}>`).join('')}</div>
      <p class="cv-sub">${esc(x('heroSub'))}</p>
      <div class="cv-acts">
        <a class="btn" href="#results">${esc(x('heroCta2'))}</a>
        <a class="btn ghost" href="#savings">${esc(x('heroCta'))}</a>
      </div>
    </div>
    <div class="cv-bar">
      <div><b class="num">${DATA.length}</b><span>${esc(x('models'))}</span></div>
      <div><b class="num">${Object.keys(P.shops || {}).length}</b><span>${esc(x('shops'))}</span></div>
      <div><b class="num">${offersTotal}</b><span>${esc(x('offersLbl'))}</span></div>
      ${updatedOn() ? `<div><b class="num">${esc(updatedOn())}</b><span>${esc(x('updated'))}</span></div>` : ''}
    </div>
    ${sv.length ? `<section class="save-sec" id="savings">
      <div class="save-hd"><h2>${esc(x('savingsT'))}</h2><p>${esc(x('savingsS'))}</p></div>
      <div class="save-grid">${sv.map(r => `<a class="sv" href="#/p/${esc(r.p.id)}">
        <span class="t"><img src="${IMG(r.p.id)}" alt="" loading="lazy"></span>
        <span>
          <span class="nm">${esc(fullName(r.p))}${r.tier !== 'base' ? ` · ${esc(gb(r.tier, r.p.variantUnit))}` : ''}</span>
          <span class="amt num">${money(r.gap)} ֏<small>${esc(x('saveUpTo'))}</small></span>
          <span class="bar"><i style="width:${Math.max(8, Math.round(r.gap / r.hi * 100))}%"></i></span>
          <span class="rng"><span>${money(r.lo)}</span><span>${money(r.hi)}</span></span>
        </span></a>`).join('')}</div>
    </section>` : ''}`;
}

// Categories are navigation, not a filter: one always-visible row, current item marked.
// Counts come from the data, so a category appears the moment its first item lands.
function catTabs() {
  const cats = [...new Set(DATA.map(p => p.category || 'phone'))];
  const n = c => DATA.filter(p => (p.category || 'phone') === c).length;
  const tab = (c, label, count) => `<a class="ctab${(st.cat || '') === c ? ' on' : ''}" href="#${c ? '/c/' + c : '/'}"${(st.cat || '') === c ? ' aria-current=\"page\"' : ''}>${esc(label)}<b class="num">${count}</b></a>`;
  return `<nav class="ctabs" aria-label="${esc(t('catalog.title'))}">` +
    tab('', x('catAll'), DATA.length) +
    cats.map(c => tab(c, (X[st.lang].cats && X[st.lang].cats[c]) || c, n(c))).join('') + `</nav>`;
}
function catalogView() {
  return `<div class="shell">
    ${catTabs()}
    ${filterBar()}
    <div class="chips" id="chips"></div>
    <div class="resbar" id="results"><h2>${esc(t('catalog.title'))}</h2><span class="cnt" id="rescnt"></span></div>
    <div class="grid" id="gridbox"></div>
  </div>`;
}
function refresh() {
  const r = results(), box = $('#gridbox');
  if (!box) return;
  box.innerHTML = r.length ? r.map(card).join('')
    : `<div class="empty"><b>${esc(x('emptyT'))}</b>${esc(x('emptyS'))}<button class="btn ghost" data-rm="all" style="margin-top:14px">${esc(t('common.reset'))}</button></div>`;
  $('#rescnt').textContent = t('common.results_count').replace('{n}', r.length);
  const ch = activeChips();
  $('#chips').innerHTML = ch.map(([k, l]) =>
    `<button class="chip" data-rm="${esc(k)}">${esc(l)}<x aria-hidden="true">×</x></button>`).join('') +
    (ch.length ? `<button class="chip clear" data-rm="all">${esc(t('common.reset'))}</button>` : '');
  syncFilters(); save();
}

/* ================= product page — bold panel + price-spread rail ================= */
const slugOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---- spec text in the reader language -------------------------------------
   Spec VALUES live in phones.json in English. Rather than keep 22 x 2 translated
   copies, the descriptive vocabulary is translated once in data/terms.json and
   substituted here. Product names (Cortex, Adreno, Gorilla Glass, One UI, IP68)
   are deliberately left alone - they are names, not English words.
   TR_BEGIN (build.mjs extracts everything down to TR_END and self-tests it) */
const TERMKEYS = Object.keys(TERMS).filter(k => k !== '_note').sort((a, b) => b.length - a.length);
const TERMLOW = TERMKEYS.map(k => k.toLowerCase());
// no regex here: escaping kept breaking, and a letter test works for any alphabet
const wordChar = ch => (ch >= '0' && ch <= '9') || ch.toLowerCase() !== ch.toUpperCase();
function tr(v, lang) {
  if (!v || lang === 'en') return v;
  const col = lang === 'hy' ? 0 : 1;
  const src = String(v), low = src.toLowerCase();
  let out = '', pos = 0;
  scan: while (pos < src.length) {
    for (let n = 0; n < TERMKEYS.length; n++) {
      if (!low.startsWith(TERMLOW[n], pos)) continue;
      const k = TERMKEYS[n];
      const before = pos ? src[pos - 1] : ' ', after = src[pos + k.length] || ' ';
      if (wordChar(before) || wordChar(after)) continue;      // inside a longer word
      out += TERMS[k][col]; pos += k.length; continue scan;
    }
    out += src[pos++];
  }
  return out.split('  ').join(' ').trim();
}
/* TR_END */

/* ---- colour swatches ----------------------------------------------------
   Shops name colours freely ("Awesome Lime", "Titanium Jetblack", "Icy Blue"),
   so an exact lookup table goes stale the moment a new phone lands. SWATCH holds
   the brand-signature colours that must be right; everything else is resolved from
   the colour words in the name, with light/deep modifiers applied. */
const SWATCH = {
  'Cosmic Orange': '#C8622A', 'Deep Blue': '#24405F', 'Silver': '#D9DADE', 'Space Black': '#26262A',
  'Cloud White': '#EDEDEA', 'Light Gold': '#E4CFA8', 'Sky Blue': '#A9C4D9', 'Mist Blue': '#A9C4D9',
  'Sage': '#9DAE96', 'Lavender': '#C9BCE0', 'Ultramarine': '#4A56C8', 'Teal': '#3F9E93',
  'Starlight': '#E8E3DA', 'Midnight': '#1F2430', 'Moonstone': '#C9CBD1', 'Iris': '#7A7FD0',
  'Jade': '#4E9E7E', 'Porcelain': '#EFEBE4', 'Obsidian': '#22252A', 'Peony': '#E7A9BC',
  'Rose Gold': '#DDB1A0', 'Pink Gold': '#E5BBB0', 'Titanium Pinkgold': '#E0B9AE',
  'Titanium Black': '#2E2E32', 'Titanium Gray': '#8E8E93', 'Titanium Silverblue': '#A9B4C2',
  'Titanium Whitesilver': '#DCDCDE', 'Poco Yellow': '#F5CB00', 'Arctic Dawn': '#DDE6EF',
  'Blush': '#E9B4AC', 'Citrus': '#E7C24A', 'Indigo': '#4B5490'
};
// head-noun colour words, matched from the end of the name
const HUE = {
  black: '#1B1B1F', white: '#F0F0EE', silver: '#D9DADE', gray: '#8E8E93', grey: '#8E8E93',
  graphite: '#4A4A50', titanium: '#B7B8BC', obsidian: '#22252A', eclipse: '#1A1A1E', shadow: '#6E7076',
  blue: '#2E6FA3', navy: '#2A3A57', ocean: '#2A5F8F', sky: '#A9C4D9', cyan: '#4FB6C4', teal: '#3F9E93',
  ultramarine: '#4A56C8', iris: '#7A7FD0', starry: '#3E5C8A', icy: '#CFE0EC',
  green: '#3E8E5A', mint: '#B9E3C6', lime: '#C3D852', olive: '#6F7355', sage: '#9DAE96',
  jade: '#4E9E7E', nebula: '#4E7F63', emerald: '#2E7D5B',
  yellow: '#EFC94C', gold: '#D9B36A', lightning: '#E3C56B', sand: '#DCC9A8',
  orange: '#C8622A', coral: '#E4705E', peach: '#F0BFA0', red: '#C03A32',
  pink: '#EFB4C4', rose: '#D9A0A6', peony: '#E7A9BC',
  purple: '#7B5FA8', violet: '#7B5FA8', lavender: '#C9BCE0', aurora: '#8E6FB8', dreamy: '#9A7FC0',
  midnight: '#1F2430', starlight: '#E8E3DA', moonstone: '#C9CBD1', moonlight: '#E9E9E4',
  storm: '#3A3D42', porcelain: '#EFEBE4', natural: '#C9C1B6', desert: '#C2A288',
  cream: '#EFE6D5', charcoal: '#43464B', pistachio: '#BFD3A0', cobalt: '#3B4FA8',
  lilac: '#C3AEDA', icyblue: '#BBD6E8'
};
// Materials, not colours. "Black Titanium" and "Natural Titanium" both end in the material,
// so a plain last-word-wins scan painted every Apple Watch Ultra swatch the same grey.
// These only answer when no real colour word is present ("Titanium" on its own).
// 'shadow' sits last in Samsung's "Blue Shadow" / "Silver Shadow" but qualifies the colour
// rather than naming it, exactly like the material words do.
const MATERIAL = new Set(['titanium', 'aluminium', 'aluminum', 'ceramic', 'steel', 'glass', 'leather', 'shadow']);
const _hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const _mix = (h, amt) => {           // amt > 0 lightens toward white, < 0 darkens
  const t = amt > 0 ? 255 : 0, k = Math.abs(amt);
  return '#' + _hex(h).map(v => Math.round(v + (t - v) * k).toString(16).padStart(2, '0')).join('');
};
function swatch(name) {
  if (SWATCH[name]) return SWATCH[name];
  const words = String(name || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean);
  let base = null, material = null;
  // scan from the end: colour names put the head noun last ("Coral Green" is green)
  for (let i = words.length - 1; i >= 0 && !base; i--) {
    const w = words[i];
    if (MATERIAL.has(w)) { material = material || HUE[w] || null; continue; }
    if (HUE[w]) { base = HUE[w]; break; }
    // compounds the shops write as one word: jetblack, pinkgold, jadegreen, whitesilver
    let bestLen = 0;
    for (const k in HUE) if (w.endsWith(k) && k.length > bestLen) { base = HUE[k]; bestLen = k.length; }
  }
  if (!base) base = material;
  if (!base) return '#9AA0A6';
  if (words.some(w => ['light', 'icy', 'ice', 'pale'].includes(w))) base = _mix(base, .34);
  if (words.some(w => ['deep', 'dark', 'midnight', 'jet', 'obsidian', 'storm'].includes(w))) base = _mix(base, -.3);
  return base;
}

const CIMG = (typeof COLORIMG !== 'undefined' && COLORIMG) || {};
const colorPhoto = (p, c) => (c && CIMG[p.id] && CIMG[p.id][slugOf(c)]) || null;

let SEL = { id: null, color: null, storage: null, ram: null };
function initSel(p) {
  if (SEL.id === p.id) return;
  const offs = offersFor(p);
  // start on whatever the cheapest real offer actually is
  SEL = {
    id: p.id,
    color: (offs.find(o => o.color) || {}).color || (p.colors || [])[0] || null,
    storage: (offs.find(o => o.storage != null) || {}).storage ?? (p.variants[0] || {}).storage ?? null,
    ram: null
  };
  // RAM and storage are sold as a pair, so start on a combination that exists
  const v0 = p.variants.find(v => v.storage === SEL.storage) || p.variants[0];
  SEL.ram = v0 ? v0.ram : null;
}
// Narrow the offer list to the chosen options.
// RAM and storage decide the price, so those filters are HARD: if nothing matches, the answer is
// "no shop sells this configuration", not some other variant's price. Colour is soft, because it
// rarely changes the price and many listings omit it.
function visibleOffers(p) {
  let o = offersFor(p);
  if (SEL.storage != null && p.variants.length) {
    // Some shops (Mobile Centre) list no capacity. That price is for the base model, so it may
    // only stand in for the smallest tier - otherwise it would undercut a real 1 TB offer.
    const sizes = p.variants.map(v => v.storage).filter(v => v != null);
    const base = sizes.length ? Math.min(...sizes) : null;
    const anySize = p.variantUnit === 'mm';   // a watch listing states no case size; it sells all of them
    o = o.filter(v => v.storage === SEL.storage || (v.storage == null && (anySize || SEL.storage === base)));
  }
  if (SEL.ram != null) o = o.filter(v => v.ram == null || v.ram === SEL.ram);
  if (SEL.color) {
    const m = o.filter(v => !v.color || v.color === SEL.color);
    if (m.length) o = m;
  }
  return o;
}
function railHTML(offs) {
  if (offs.length < 2) return '';
  const lo = offs[0].price, hi = offs[offs.length - 1].price;
  if (hi === lo) return '';
  const dots = offs.map(o => `<span class="dt${o.price === lo ? ' b' : ''}" style="left:${((o.price - lo) / (hi - lo) * 100).toFixed(1)}%" title="${esc(shopName(o.shop))} · ${money(o.price)} ֏"></span>`).join('');
  return `<div class="rail" role="img" aria-label="${esc(x('saveUpTo'))} ${money(hi - lo)} AMD"><span class="ln"></span>${dots}</div>
    <div class="ends"><span class="num">${money(lo)} ֏</span><span class="num">${money(hi)} ֏</span></div>
    <div class="save">${esc(x('saveUpTo'))} <b class="num">${money(hi - lo)} ֏</b></div>`;
}

function detailView(p) {
  initSel(p);
  const V = VERD[p.id] || {}, L = st.lang;
  const summary = (L !== 'en' && V['s_' + L]) || p.summaryEn;
  const offs = visibleOffers(p);
  const lo = offs.length ? offs[0].price : null;
  const variant = p.variants.find(v => v.storage === SEL.storage && v.ram === SEL.ram) || p.variants[0] || {};
  const shownPrice = lo ?? variant.priceAmd ?? p.priceAmd;
  const shot = colorPhoto(p, SEL.color) || IMG(p.id);
  // A colour with no photo of its own falls back to the main shot, so a product where only some
  // colours are photographed showed three different swatches over one identical picture. Where
  // that happens, offer only the colours we can actually show; where NO colour has its own photo
  // there is nothing misleading about one picture, so keep the full list.
  const allCols = p.colors || [];
  const shot4 = allCols.filter(c => colorPhoto(p, c));
  const cols = shot4.length && shot4.length < allCols.length ? shot4 : allCols;
  // earbuds have one SKU and no capacity to pick, so both lists come back empty and the
  // option blocks below simply do not render
  const rams = [...new Set(p.variants.map(v => v.ram))].filter(v => v != null);
  const stors = [...new Set(p.variants.map(v => v.storage))].filter(v => v != null);
  const sim = DATA.filter(q => q.id !== p.id).sort((a, b) =>
    (a.tier === p.tier ? 0 : 1) - (b.tier === p.tier ? 0 : 1) ||
    Math.abs(bestOf(a) - bestOf(p)) - Math.abs(bestOf(b) - bestOf(p))).slice(0, 4);
  const inC = st.cmp.includes(p.id);

  const specs = GROUPS.map(([g, rows]) => {
    const body = rows.map(([k, get]) => {
      let v; try { v = get(p); } catch (e) { v = null; }
      // A getter that formats a missing field yields "null GB" / "NaN mAh" / "undefined x undefined".
      // Catching that here covers every getter, including ones added for future categories.
      const bad = v == null || v === '' || /undefined|null|NaN/.test(String(v));
      const key = (k === 'f.storage' && p.variantUnit === 'mm') ? 'f.case_size' : k;
      return bad ? '' : `<div class="kv"><dt>${esc(t(key))}</dt><dd>${esc(tr(v, st.lang))}</dd></div>`;
    }).join('');
    return body ? `<section class="panel-c"><h3><i></i>${esc(t(g))}</h3><dl>${body}</dl></section>` : '';
  }).join('');

  return `<div class="shell">
    <div class="navrow">${backLink('#/', t('nav.catalog'))}
      <nav class="crumb"><span>${esc(p.brand)}</span><span>›</span><span>${esc(p.name)}</span></nav></div>

    <div class="pstage">
      <div class="pmeta">
        <span>${esc(p.brand)} / ${esc(X[L].tier[p.tier] || p.tier)}${isNew(p) ? ' / ' + esc(x('newBadge')) : ''}</span>
        <span>${offs.length ? shopCount(offs) + ' ' + esc(x('shops')) + ' · ' + esc(updatedOn()) : esc(x('estimated'))}</span>
      </div>
      <h1 class="pname">${esc(fullName(p))}</h1>
      <div class="pgrid">
        <div class="pshotwrap"><img src="${shot}" alt="${esc(fullName(p))}${SEL.color ? ' — ' + esc(SEL.color) : ''}" id="hpShot" fetchpriority="high"></div>
        <div class="pside">
          <p class="lede2">${esc(summary)}</p>
          ${cols.length ? `<div class="og"><label>${esc(t('sec.colors'))} <b id="colName">${esc(tr(SEL.color || '', st.lang))}</b></label>
            <div class="cs">${cols.map(c => `<button data-color="${esc(c)}" class="${c === SEL.color ? 'on' : ''}" style="--c:${esc(swatch(c))}" title="${esc(tr(c, st.lang))}" aria-label="${esc(tr(c, st.lang))}" aria-pressed="${c === SEL.color}"></button>`).join('')}</div></div>` : ''}
          ${rams.length > 1 ? `<div class="og"><label>${esc(t('f.ram'))}</label>
            <div class="bs">${rams.map(r => `<button data-ram="${r}" class="${r === SEL.ram ? 'on' : ''}" aria-pressed="${r === SEL.ram}">${r} ${esc(u('gb'))}</button>`).join('')}</div></div>` : ''}
          ${stors.length ? `<div class="og"><label>${esc(t(p.variantUnit === 'mm' ? 'f.case_size' : 'f.storage'))}</label>
            <div class="bs">${stors.map(sv => `<button data-storage="${sv}" class="${sv === SEL.storage ? 'on' : ''}" aria-pressed="${sv === SEL.storage}">${esc(gb(sv, p.variantUnit))}</button>`).join('')}</div></div>` : ''}
          <div class="pprice2">
            <span class="lb">${offs.length ? esc(x('bestPrice')) : esc(x('estimated'))}</span>
            <b class="num">${money(shownPrice)} ֏</b>
            ${offs.length && offs.length > 1 && offs[offs.length - 1].price > lo
              ? `<div class="save2">${esc(x('saveUpTo'))} ${money(offs[offs.length - 1].price - lo)} ֏</div>` : ''}
            ${offs.length ? `<div class="shopn">${shopCount(offs)} ${esc(x('shops'))}</div>` : ''}
            ${railHTML(offs)}
          </div>
          <div class="pcta">
            <a class="btn" href="#buy">${esc(x('offersTitle'))}</a>
            <button class="btn ghost" data-cmp-btn="${esc(p.id)}">${esc(inC ? t('detail.in_compare') : t('detail.add_compare'))}</button>
          </div>
        </div>
      </div>
    </div>

    <h2 class="sh" id="buy">${esc(x('offersTitle'))}${offs.length ? ` <em>${offs.length}</em>` : ''}</h2>
    ${offs.length ? `<ol class="olist" id="offList">
      ${offs.map((o, i) => offerRow(o, lo, i, p.variantUnit, i >= OFFER_PEEK ? 'more' : '')).join('')}
    </ol>
    ${offs.length > OFFER_PEEK ? `<button class="expand" data-expand="offList" aria-expanded="false" aria-controls="offList">
      ${esc(x('showAll'))} <b class="num">${offs.length}</b></button>` : ''}
    ${offersFor(p).length > offs.length ? `<p class="allofflink"><a href="#/offers/${esc(p.id)}">${esc(x('allOffers'))} → <b class="num">${offersFor(p).length}</b></a></p>` : ''}`
      : `<p class="empty" style="padding:26px 0"><b>${esc(x('noOffers'))}</b></p>`}
    <p class="note">${offs.length ? esc(x('priceSrc')) + ' · ' + esc(x('updated')) + ' ' + esc(updatedOn()) : esc(t('common.demo_prices_note'))}</p>

    
    ${historyHTML(p)}

    <h2 class="sh">${esc(t('detail.full_specs'))}</h2>
    <div class="secgrid">${specs}</div>

    <h2 class="sh">${esc(t('detail.similar'))}</h2>
    <div class="simrow">${sim.map(sp => `<a class="sim" href="#/p/${esc(sp.id)}">
      <span class="t"><img src="${IMG(sp.id)}" alt="" loading="lazy"></span>
      <span><b>${esc(fullName(sp))}</b><span class="num">${money(bestOf(sp))} ֏</span></span></a>`).join('')}</div>
  </div>`;
}

/* ================= construct: the same filters, asked as questions =================
   Every question is derived from the items in the chosen category, so a new category needs
   no code here. A question with only one possible answer is not asked - it is reported as a
   fact instead, because a question you cannot answer two ways is not a choice. */
const CQ = [
  ['ram',  'filter.ram',          p => (p.variants || []).map(v => v.ram),     v => v + ' ' + u('gb')],
  ['stor', 'filter.storage',      p => (p.variants || []).map(v => v.storage), v => gb(v)],
  ['hz',   'filter.refresh_rate', p => [p.display && p.display.refresh],       v => v + ' ' + u('hz')],
  ['batt', 'filter.battery',      p => [p.battery && p.battery.capacity],      v => money(v) + ' ' + u('mah')]
];

function constructView() {
  const catOf = p => p.category || 'phone';
  const cats = [...new Set(DATA.map(catOf))];
  const label = c => (X[st.lang].cats || {})[c] || c;
  const pool = DATA.filter(p => st.cat && catOf(p) === st.cat);

  const catCards = cats.map(c => `<button class="ccard${st.cat === c ? ' on' : ''}" data-ccat="${esc(c)}"
      aria-pressed="${st.cat === c}"><b>${esc(label(c))}</b><span class="num">${DATA.filter(p => catOf(p) === c).length}</span></button>`).join('');

  const chip = (key, val, text, on) =>
    `<button class="cchip${on ? ' on' : ''}" data-cq="${esc(key)}" data-cqv="${esc(String(val))}" aria-pressed="${on}">${esc(text)}</button>`;

  let questions = '';
  const fixed = [];
  if (st.cat) {
    for (const [key, lbl, get, fmt] of CQ) {
      const vals = [...new Set(pool.flatMap(get).filter(v => v != null && v > 0))].sort((a, b) => a - b);
      if (vals.length < 2) continue;
      questions += `<section class="cq"><h3>${esc(t(lbl))}</h3><div class="cqrow">`
        + chip(key, 0, x('any'), !st[key])
        + vals.map(v => chip(key, v, x('min') + ' ' + fmt(v), String(st[key]) === String(v))).join('')
        + `</div></section>`;
    }
    const sizes = [...new Set(pool.map(p => p.display && p.display.size).filter(v => v != null))].sort((a, b) => a - b);
    if (sizes.length > 1) {
      questions += `<section class="cq"><h3>${esc(t('filter.screen_size'))}</h3><div class="cqrow">`
        + chip('scrmin', 0, x('any'), !st.scrmin)
        + sizes.map(v => chip('scrmin', v, x('min') + ' ' + v + String.fromCharCode(8243), String(st.scrmin) === String(v))).join('')
        + `</div></section>`;
    }
    const touches = [...new Set(pool.map(p => p.display && p.display.touch).filter(v => v != null))];
    if (touches.length > 1) {
      questions += `<section class="cq"><h3>${esc(t('f.touch'))}</h3><div class="cqrow">`
        + chip('touch', 0, x('any'), !st.touch)
        + chip('touch', 1, t('common.yes'), st.touch === 1)
        + chip('touch', 2, t('common.no'), st.touch === 2)
        + `</div></section>`;
    }
    const brands = [...new Set(pool.map(p => p.brand))].sort();
    if (brands.length > 1) {
      questions += `<section class="cq"><h3>${esc(t('filter.brand'))}</h3><div class="cqrow">`
        + brands.map(b => `<button class="cchip${st.brands.includes(b) ? ' on' : ''}" data-cqb="${esc(b)}"
            aria-pressed="${st.brands.includes(b)}">${esc(b)}</button>`).join('')
        + `</div></section>`;
    }
    // what does not vary is stated once rather than asked
    const one = (get, lbl, fmt) => {
      const v = [...new Set(pool.map(get).filter(x => x != null && x !== ''))];
      if (v.length === 1) fixed.push(t(lbl) + ': ' + fmt(v[0]));
    };
    one(p => p.display && p.display.touch, 'f.touch', v => v ? t('common.yes') : t('common.no'));
    one(p => p.graphics && p.graphics.type, 'f.graphics', v => tr(v, st.lang));
    one(p => p.connectivity && p.connectivity.network, 'f.network', v => tr(v, st.lang));
    one(p => p.os, 'f.os', v => tr(v, st.lang));
  }

  const hits = st.cat ? results().length : 0;
  return `<div class="shell">
    <div class="navrow">${backLink('#/', t('nav.catalog'))}
      <nav class="crumb"><span>${esc(t('construct.title'))}</span></nav></div>
    <h1 class="cnh">${esc(t('construct.title'))}</h1>
    <p class="clead">${esc(t('construct.lead'))}</p>

    <h2 class="sh" style="margin-top:24px">${esc(t('construct.pick_cat'))}</h2>
    <div class="cgrid">${catCards}</div>

    ${st.cat ? `${questions}
      ${fixed.length ? `<p class="cfixed"><b>${esc(t('construct.fixed'))}:</b> ${fixed.map(esc).join('  ·  ')}</p>` : ''}
      <div class="cgo">
        ${hits
          ? `<a class="btn" href="#/c/${esc(st.cat)}">${esc(t('construct.show'))} <b class="num">${hits}</b></a>`
          : `<span class="cnone">${esc(t('construct.none'))}</span>
             <button class="btn ghost" data-rm="all">${esc(t('common.reset'))}</button>`}
      </div>` : ''}
  </div>`;
}

/* ================= all offers for one model ================= */
// The product page shows offers for the CHOSEN colour/capacity. This page shows every offer
// the shops list for the model, and lets you slice it by shop, capacity and colour.
let OSEL = { id: null, storage: '', ram: '', color: '' };
function initOSel(id) { if (OSEL.id !== id) OSEL = { id, storage: '', ram: '', color: '' }; }

function offerRow(o, lo, i, unit, cls) {
  return `<li${cls ? ` class="${cls}"` : ''}><a class="orow${o.price === lo ? ' best' : ''}" href="${esc(safeHref(o.url))}" target="_blank" rel="noopener noreferrer">
    <span class="rk num">${String(i + 1).padStart(2, '0')}</span>
    <span class="sh">${esc(shopName(o.shop))}</span>
    <span class="vr">${esc([o.storage ? gb(o.storage, unit) : '', o.ram ? o.ram + ' ' + u('gb') + ' RAM' : '', tr(o.color, st.lang) || ''].filter(Boolean).join(' · ') || x('variantUnknown'))}</span>
    <span class="pr num">${money(o.price)} ֏</span>
    <span class="dl">${o.price === lo ? esc(x('bestPrice')) : '+' + money(o.price - lo) + ' ֏'}
      ${o.inStock === false ? `<i class="oos">${esc(x('outOfStock'))}</i>` : `<i class="ins">${esc(x('inStock'))}</i>`}</span>
    <span class="ar" aria-hidden="true">→</span></a></li>`;
}

function offersView(p) {
  initOSel(p.id);
  const all = offersFor(p);
  const stors = [...new Set(all.map(o => o.storage).filter(v => v != null))].sort((a, b) => a - b);
  const rams = [...new Set(all.map(o => o.ram).filter(v => v != null))].sort((a, b) => a - b);
  const cols = [...new Set(all.map(o => o.color).filter(Boolean))];
  // filtering is by what you are buying - capacity, memory, colour - not by which shop
  const list = all.filter(o =>
    (!OSEL.storage || String(o.storage) === OSEL.storage) &&
    (!OSEL.ram || String(o.ram) === OSEL.ram) &&
    (!OSEL.color || o.color === OSEL.color));
  const lo = list.length ? Math.min(...list.map(o => o.price)) : null;
  const hi = list.length ? Math.max(...list.map(o => o.price)) : null;

  const chips = (key, vals, label, fmt = v => v) => vals.length < 2 ? '' :
    `<div class="ofg"><span class="ofl">${esc(label)}</span>
      <button class="ofc${OSEL[key] === '' ? ' on' : ''}" data-of="${key}" data-ofv="">${esc(x('any'))}</button>
      ${vals.map(v => `<button class="ofc${String(OSEL[key]) === String(v) ? ' on' : ''}" data-of="${key}" data-ofv="${esc(String(v))}">${esc(fmt(v))}</button>`).join('')}</div>`;

  return `<div class="shell">
    <div class="navrow">${backLink('#/p/' + p.id, fullName(p))}
      <nav class="crumb"><span>${esc(x('allOffers'))}</span></nav></div>
    <div class="ofhead">
      <span class="t"><img src="${IMG(p.id)}" alt="" loading="lazy"></span>
      <div>
        <h1>${esc(fullName(p))}</h1>
        <p class="ofsub">${esc(x('allOffers'))} · <b class="num">${all.length}</b> ${esc(x('offersLbl'))} · <b class="num">${shopCount(all)}</b> ${esc(x('shops'))}</p>
      </div>
    </div>
    <div class="offilters">
      ${chips('storage', stors, t('f.storage'), gb)}
      ${chips('ram', rams, t('f.ram'), v => v + ' ' + u('gb'))}
      ${chips('color', cols, t('sec.colors'))}
    </div>
    <div class="resbar"><h2>${esc(t('common.results_count').replace('{n}', list.length))}</h2>
      ${(() => {
        // A saving is only real between rows you could actually swap: same capacity.
        // Unfiltered, this list spans 256 GB to 2 TB and the spread would be meaningless.
        const tiers = new Set(list.map(o => o.storage ?? 'base'));
        return list.length > 1 && hi > lo && tiers.size === 1
          ? `<span class="cnt">${esc(x('saveUpTo'))} <b class="num">${money(hi - lo)} ֏</b></span>`
          : (tiers.size > 1 ? `<span class="cnt">${esc(x('pickCapacity'))}</span>` : '');
      })()}</div>
    ${list.length ? `<ol class="olist">${list.map((o, i) => offerRow(o, lo, i, p.variantUnit)).join('')}</ol>`
      : `<p class="empty" style="padding:30px 0"><b>${esc(x('noOffers'))}</b></p>`}
    <p class="note">${esc(x('priceSrc'))} · ${esc(x('updated'))} ${esc(updatedOn())}</p>
  </div>`;
}

/* ================= compare ================= */
function compareView() {
  const ps = st.cmp.map(byId).filter(Boolean);
  if (!ps.length) return `<div class="shell"><div class="empty" style="margin-top:40px">
    <b>${esc(t('compare.empty'))}</b><p style="margin-bottom:18px">${esc(x('emptyS'))}</p>
    <a class="btn" href="#/">${esc(t('compare.add_phone'))}</a></div></div>`;
  const n = ps.length, cols = `200px repeat(${n},minmax(0,1fr))`;

  let rows = '', nDiff = 0, nSame = 0;
  for (const [g, defs] of GROUPS) {
    rows += `<div class="grp">${esc(t(g))}</div>`;
    for (const [k, get, num, dir] of defs) {
      const vals = ps.map(p => { try { const v = get(p); return v == null || v === '' ? '—' : String(v); } catch (e) { return '—'; } });
      if (vals.every(v => v === '—')) continue;
      const same = vals.every(v => v === vals[0]);
      same ? nSame++ : nDiff++;
      const cls = same ? 'row-same' : 'row-diff';
      let bi = -1;
      if (num && dir && n > 1) {
        const nv = ps.map(p => { try { return num(p); } catch (e) { return null; } });
        const ok = nv.filter(v => typeof v === 'number' && isFinite(v));
        if (ok.length > 1 && new Set(ok).size > 1) bi = nv.indexOf(dir > 0 ? Math.max(...ok) : Math.min(...ok));
      }
      rows += `<div class="k ${cls}">${esc(t(k))}</div>` +
        vals.map((v, i) => `<div class="c ${cls}${i === bi ? ' best' : ''}">${esc(v)}</div>`).join('');
    }
  }
  return `<div class="shell">
    <div class="navrow">${backLink('#/', t('nav.catalog'))}</div>
    <div class="cbar"><h1 class="sh" style="margin:0">${esc(t('compare.title'))}</h1>
      <span class="dcount"><i></i>${nDiff} ${esc(x('diffs'))}</span>
      <span class="scount">${nSame} ${esc(x('same'))}</span>
      <span style="flex:1"></span>
      <label class="sw"><input type="checkbox" id="diffonly"><span class="tr"></span>${esc(t('compare.diff_only'))}</label>
      <a class="btn ghost sm" href="#/">${esc(t('compare.add_phone'))}</a>
      <button class="btn ghost sm" data-act="clearcmp">${esc(t('compare.clear'))}</button></div>
    <div class="cwrap" id="cwrap" style="--cols:${cols};--n:${n}">
      <div class="chead"><div class="pad"></div>
        ${ps.map(p => `<div class="ccol">
          <button class="x" data-cmp="${esc(p.id)}" aria-label="${esc(t('compare.clear'))}: ${esc(fullName(p))}">×</button>
          <b>${esc(fullName(p))}</b></div>`).join('')}
      </div>
      <div class="ctable">${rows}</div>
    </div></div>`;
}

/* ================= router ================= */
function render(keepScroll) {
  const raw = location.hash.replace(/^#/, '');
  // #buy / #results / #main are in-page anchors, not routes. They used to fall through to
  // the catalogue, throwing you off the product page you were reading.
  if (raw && raw[0] !== '/') {
    const el = document.getElementById(raw);
    if (el && $('#main').innerHTML) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  }
  paintChrome(); paintTray();
  const h = raw || '/';
  const mc = h.startsWith('/c/') ? h.slice(3) : null;
  // a category lives in the URL so it can be shared and the back button works
  const wasCat = st.cat;
  st.cat = mc || (h === '/' ? '' : st.cat);
  if (st.cat !== wasCat) { pruneFilters(); if (!sortKeys().includes(st.sort)) st.sort = 'popular'; }
  const m = h.match(/^\/p\/(.+)$/);
  let mo;
  const main = $('#main');
  if (m && byId(m[1])) { const y = window.scrollY; main.innerHTML = detailView(byId(m[1])); document.title = fullName(byId(m[1])) + ' — MyCatalog'; window.scrollTo(0, keepScroll ? y : 0); }
  else if ((mo = h.match(/^\/offers\/(.+)$/)) && byId(mo[1])) {
    const y = window.scrollY;
    main.innerHTML = offersView(byId(mo[1]));
    document.title = x('allOffers') + ' — ' + fullName(byId(mo[1]));
    window.scrollTo(0, keepScroll ? y : 0);   // filter chips must not throw you to the top
  }
  else if (h === '/construct') { main.innerHTML = constructView(); document.title = t('construct.title') + ' — MyCatalog'; window.scrollTo(0, keepScroll ? window.scrollY : 0); }
  else if (h === '/compare') { main.innerHTML = compareView(); document.title = t('compare.title') + ' — MyCatalog'; window.scrollTo(0, 0); }
  else {
    main.innerHTML = catalogView(); refresh();
    document.title = (st.cat ? ((X[st.lang].cats || {})[st.cat] || st.cat) + ' — ' : '') + 'MyCatalog';
    window.scrollTo(0, keepScroll ? window.scrollY : 0);
  }
  if (!keepScroll) {
    const head = $('#main h1') || $('#main h2');
    if (head) { head.tabIndex = -1; head.focus({ preventScroll: true }); }
  }
  const mh = $('#masthero');
  // the hero belongs to the front page only, not to a single category
  const home = !m && !mc && h !== '/construct' && h !== '/compare' && !h.startsWith('/offers/');
  mh.hidden = !home;
  mh.innerHTML = home ? mastHero() : '';
}

/* ================= events ================= */
document.addEventListener('click', e => {
  const anchor = e.target.closest('a[href^="#"]:not([href^="#/"])');
  if (anchor) {
    e.preventDefault();
    document.getElementById(anchor.getAttribute('href').slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const L = e.target.closest('[data-lang]');
  if (L) { st.lang = L.dataset.lang; save(); render(true); return; }
  if (e.target.closest('#themeBtn')) {
    // two themes only: white-blue and dark-blue. From 'auto', flip away from what the OS shows.
    const osDark = matchMedia('(prefers-color-scheme:dark)').matches;
    st.theme = st.theme === 'auto' ? (osDark ? 'light' : 'dark') : st.theme === 'dark' ? 'light' : 'dark';
    save(); paintChrome(); return;
  }
  if (e.target.closest('#hdrCmp')) { location.hash = '#/compare'; return; }
  const tg = e.target.closest('button[data-f]');
  if (tg) { const k = tg.dataset.f; st[k] = !st[k]; refresh(); return; }
  // construct page: category card, a question chip, a brand chip
  const cc = e.target.closest('[data-ccat]');
  if (cc) { st.cat = cc.dataset.ccat; Object.assign(st, { q: '', scrmin: 0, touch: 0, brands: [], ram: 0, stor: 0, batt: 0, hz: 0, scr: '', g5: false, nfc: false });
    save(); $('#main').innerHTML = constructView(); return; }
  const cq = e.target.closest('[data-cq]');
  if (cq) { const k = cq.dataset.cq, v = cq.dataset.cqv;
    st[k] = (k === 'scr') ? v : +v;
    save(); $('#main').innerHTML = constructView(); return; }
  const cbrand = e.target.closest('[data-cqb]');
  if (cbrand) { const b = cbrand.dataset.cqb;
    st.brands = st.brands.includes(b) ? st.brands.filter(z => z !== b) : st.brands.concat(b);
    save(); $('#main').innerHTML = constructView(); return; }
  const rm = e.target.closest('[data-rm]');
  if (rm) {
    const k = rm.dataset.rm;
    if (k === 'all') Object.assign(st, { q: '', brands: [], pmin: PMIN, pmax: PMAX, ram: 0, stor: 0, batt: 0, hz: 0, scr: '', g5: false, nfc: false });
    if (k === 'all') $('#q').value = '';
    else if (k.startsWith('brand:')) st.brands = st.brands.filter(b => b !== k.slice(6));
    else if (k === 'price') { st.pmin = PMIN; st.pmax = PMAX; }
    else if (k === 'scr') st.scr = '';
    else st[k] = (k === 'g5' || k === 'nfc') ? false : 0;
    if (location.hash === '#/construct') { save(); $('#main').innerHTML = constructView(); return; }
    refresh(); return;
  }
  const act = e.target.closest('[data-act="clearcmp"]');
  if (act) { st.cmp = []; save(); paintTray(); render(); return; }
  const fav = e.target.closest('[data-cmp]');
  if (fav) {
    e.preventDefault();
    const id = fav.dataset.cmp, wasIn = st.cmp.includes(id);
    if (toggleCmp(id) && wasIn && location.hash === '#/compare') render();
    return;
  }
  const cb = e.target.closest('[data-cmp-btn]');
  if (cb) {
    const id = cb.dataset.cmpBtn;
    if (toggleCmp(id)) {
      const on = st.cmp.includes(id);
      cb.textContent = on ? t('detail.in_compare') : t('detail.add_compare');
      cb.classList.toggle('ghost', on);
    }
    return;
  }
  const ex = e.target.closest('[data-expand]');
  if (ex) {
    const list = document.getElementById(ex.dataset.expand);
    const open = list.classList.toggle('all');
    ex.setAttribute('aria-expanded', open);
    ex.firstChild.textContent = (open ? x('showLess') : x('showAll')) + ' ';
    return;
  }
  const ofc = e.target.closest('[data-of]');
  if (ofc) { OSEL[ofc.dataset.of] = ofc.dataset.ofv; render(true); return; }
  const opt = e.target.closest('[data-color],[data-storage],[data-ram]');
  if (opt) {
    const ph = byId(SEL.id);
    if (opt.dataset.color !== undefined) SEL.color = opt.dataset.color;
    // RAM and storage ship as a pair (Galaxy A26 is 6/128 or 8/256, never 8/128 here),
    // so picking one snaps the other to a combination that actually exists.
    if (opt.dataset.storage !== undefined) {
      SEL.storage = +opt.dataset.storage;
      if (ph && !ph.variants.some(v => v.storage === SEL.storage && v.ram === SEL.ram)) {
        const v = ph.variants.filter(v => v.storage === SEL.storage).sort((a, b) => a.ram - b.ram)[0];
        if (v) SEL.ram = v.ram;
      }
    }
    if (opt.dataset.ram !== undefined) {
      SEL.ram = +opt.dataset.ram;
      if (ph && !ph.variants.some(v => v.ram === SEL.ram && v.storage === SEL.storage)) {
        const v = ph.variants.filter(v => v.ram === SEL.ram).sort((a, b) => a.storage - b.storage)[0];
        if (v) SEL.storage = v.storage;
      }
    }
    render(true);
    return;
  }
  // one dropdown open at a time; click outside closes
  const d = e.target.closest('[data-drop]');
  $$('[data-drop][open]').forEach(o => { if (o !== d) o.open = false; });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('[data-drop][open]').forEach(o => o.open = false); });
document.addEventListener('change', e => {
  const el = e.target, f = el.dataset.f;
  if (el.id === 'diffonly') { $('#cwrap').classList.toggle('hide-same', el.checked); return; }
  if (!f) return;
  if (f === 'brand') st.brands = el.checked ? [...new Set([...st.brands, el.value])] : st.brands.filter(b => b !== el.value);
  else if (f === 'scr') st.scr = el.value;
  else if (f === 'sort') { st.sort = el.value; el.closest('[data-drop]').open = false; }
  else if (f === 'pmin') st.pmin = Math.min(+el.value, st.pmax);
  else if (f === 'pmax') st.pmax = Math.max(+el.value, st.pmin);
  else st[f] = +el.value;
  refresh();
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'q') {
    st.q = el.value;
    // refresh() only repaints the catalogue grid, so from a product/offers/compare page a
    // query had nowhere to land. Go to the catalogue and let render() draw the results.
    if ($('#gridbox')) refresh(); else { save(); location.hash = '#/'; }
    return;
  }
  if (el.dataset.f === 'pmin' || el.dataset.f === 'pmax') {
    const a = +$('[data-f="pmin"]').value, b = +$('[data-f="pmax"]').value;
    $('[data-rng="min"]').textContent = money(Math.min(a, b)) + ' ֏';
    $('[data-rng="max"]').textContent = money(Math.max(a, b)) + ' ֏';
  }
});
window.addEventListener('hashchange', () => render(false));
render();
