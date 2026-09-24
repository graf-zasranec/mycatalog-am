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
// local build reads images/<id>.jpg; the published build injects IMGDATA with inline data URIs
// A product added before its photo has been sourced has no file, and a 404 renders as the
// browser's broken-image icon - which reads as a bug rather than as a missing photo. A
// neutral tile says what is actually true, and works on either theme. It carries width and
// height: an SVG with only a viewBox reports naturalWidth 0, which is exactly what a genuinely
// broken image reports, so every check that looks for one would flag it.
const NOPHOTO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0Ij48cmVjdCB4PSIxNCIgeT0iMTgiIHdpZHRoPSIzNiIgaGVpZ2h0PSIyOCIgcng9IjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzhBOTNBNiIgc3Ryb2tlLXdpZHRoPSIyIiBvcGFjaXR5PSIuNSIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMzIiIHI9IjYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzhBOTNBNiIgc3Ryb2tlLXdpZHRoPSIyIiBvcGFjaXR5PSIuNSIvPjwvc3ZnPg==';
const IMG = id => (typeof IMGDATA !== 'undefined' && IMGDATA[id]) || NOPHOTO;
// Every place that draws the photo small - cards, the savings strip, compare, the tray, the
// suggestion rows. The two that fill the screen with it (the cover carousel and the product
// page itself) keep IMG. Falls back to the full size when no thumbnail was made, which is what
// happens for a shot already at or under 600 px.
const THUMB = id => (typeof THUMBDATA !== 'undefined' && THUMBDATA[id]) || IMG(id);
// IMG() falls back to a path whether the file exists or not, so it cannot answer "has a photo".
const hasIMG = id => typeof IMGDATA !== 'undefined' && !!IMGDATA[id];

const U = {
  hy: { mah: 'մԱժ', w: 'Վտ', g: 'գ', mm: 'մմ', hz: 'Հց', nit: 'նիտ', gb: 'GB' },
  ru: { mah: 'мА·ч', w: 'Вт', g: 'г', mm: 'мм', hz: 'Гц', nit: 'нит', gb: 'ГБ' },
  en: { mah: 'mAh', w: 'W', g: 'g', mm: 'mm', hz: 'Hz', nit: 'nits', gb: 'GB' }
};
const X = {
  hy: {
    tier: { flagship: 'Ֆլագման', 'upper-mid': 'Բարձր միջին', mid: 'Միջին', budget: 'Բյուջետային' },
    any: 'Բոլորը', min: 'նվազ.', newBadge: 'Նոր', view: 'Դիտել', allFilters: 'Բոլոր զտիչները',
    dS: 'օ', hS: 'ժ', mS: 'ր',
    unsureMark: 'չհաստատված', unsureTip: 'Այս թիվը հաստատված չէ արտադրողի տվյալներում',
    scrLo: '{x}″-ից փոքր', scrHi: '{x}″-ից մեծ',
    cameraF: 'Հիմնական տեսախցիկ', mp: 'ՄՊ', lifeF: 'Աշխատանքի տևողություն', hrs: 'ժ',
    cpuF: 'Պրոցեսոր', gpuF: 'Գրաֆիկա', integrated: 'Ներակառուցված',
    ancF: 'Աղմուկի ճնշում', waterF: 'Ջրակայունություն',
    findL: 'Որոնել', showN: 'Ցույց տալ {n}', filtersT: 'Զտիչներ', closeL: 'Փակել',
    atShop: '{shop}', lessDearest: 'ամենաթանկ խանութից {n} ֏ էժան', sameBest: 'նույն գինը',
    histNone: '{c}-ի գնի պատմությունը կսկսվի հաջորդ գիշերային թարմացումից', histLow: 'Ամենացածրը {d}-ից ի վեր', histAbove: '{p}%-ով բարձր ամենացածրից', histLowLine: 'Ամենացածրը {d}-ից՝ {n} ֏ ({d2})', histWhat: 'օրվա ամենաէժան գինը՝ {c}', histKeys: 'Սլաքներով կարդացեք ամեն օրը', histLowest: 'Ամենացածր',
    spotT: 'Օրվա գործարքը',
    dealUsual: 'սովորական գնից {n} ֏ էժան', dealDrop: '↓ {n} ֏ {d}-ից', prevL: 'Նախորդը', nextL: 'Հաջորդը',
    formF: 'Տեսակ', forms: { tws: 'Անլար (TWS)', 'in-ear': 'Լարով ականջակալներ', full: 'Գլխին՝ ականջների վրա', neckband: 'Պարանոցի շուրջ', open: 'Բաց / սեղմակով' },
    connF: 'Միացում', conns: { wireless: 'Անլար', wired: 'Լարով' },
    plugF: 'Միակցիչ', plugs: { 'usb-c': 'USB-C', lightning: 'Lightning', '3.5': '3.5 մմ' },
    gamingF: 'Խաղային', resF: 'Թույլատրություն',
    spkF: 'Տեսակ', spks: { portable: 'Դյուրակիր', party: 'Party', smart: 'Խելացի (Wi-Fi)', home: 'Տնային' },
    waters: { splash: 'Ցանկոտումից պաշտպանված', dip: 'Ջրի մեջ ընկղման դիմացկուն' },
    heroTag: 'Նոր թողարկում', heroA: 'Համեմատի՛ր և գտի՛ր', heroB: 'լավագույն գինը',
    heroSub: 'Ամեն խանութ իր գինն է տալիս։ Մենք դրանք հավաքում ենք մեկ տեղում՝ որպեսզի գտնես հենց քեզ պետքը և չվճարես ավելին, քան պետք է։',
    heroCta: 'Որտեղ է ամենաշահավետը', heroCta2: 'Դիտել կատալոգը',
    tbNote: 'Գները դրամով · ցուցադրական տվյալներ', best: 'լավագույնը',
    footNote: 'Ցուցադրական նախագիծ։ Գները ուղղորդիչ են և չեն թարմացվում խանութներից։',
    emptyT: 'Ոչինչ չի գտնվել', seeAll: 'Տեսնել բոլորը', filtersShow: 'Բոլոր զտիչները', filtersHide: 'Թաքցնել զտիչները', handSeen: 'չստուգված', handTip: 'Այս գինը գրանցվել է ձեռքով և այսօր չի ստուգվել խանութի կայքում', stockUnknown: 'առկայությունը հայտնի չէ', seenTip: 'Այս գինը վերջին անգամ ստուգվել է այս օրը', catAll: 'Բոլորը', applyF: 'Կիրառել', clearF: 'Մաքրել', catsMore: 'Այլ բաժիններ', catsFewer: 'Ավելի քիչ', panelF: 'Էկրանի տեսակ', yearF: 'Թողարկման տարի', osF: 'Օպերացիոն համակարգ', cats: { phone: 'Հեռախոսներ', tablet: 'Պլանշետներ', watch: 'Խելացի ժամացույցներ', earbuds: 'Ականջակալներ', headphones: 'Ականջակալներ', speaker: 'Բարձրախոսներ', console: 'Խաղային կոնսոլներ', laptop: 'Նոութբուքեր', desktop: 'Համակարգիչներ', appliance: 'Կենցաղային տեխնիկա', ereader: 'Էլ. ընթերցիչներ', monitor: 'Մոնիտորներ', component: 'Մասնագործեր', tv: 'Հեռուստացույցներ', drone: 'Դրոններ և նկարահանում' }, emptyS: 'Փորձի՛ր փոխել զտիչները։',
    shops: 'խանութ', offersTitle: 'Գներ Հայաստանի խանութներում', bestPrice: 'Լավագույն գին', checkPrices: 'Ստուգել գները', cwTitle: 'Համեմատել՝', cwNewer: 'Նոր մոդել', cwOlder: 'Նախորդ մոդել', cwStronger: 'Ավելի հզոր', cwAlt: 'Այլընտրանք', nfT: 'Ապրանքը չի գտնվել', nfS: 'Հղումը հին է կամ սխալ։ Փորձի՛ր որոնումը կամ նայի՛ր այս ապրանքները։', nfCats: 'Բաժիններ', cmpPrice: 'Գինը', cwCheaper: 'Ավելի էժան', cwStepup: 'Ավելի բարձր դաս', cwBigger: 'Ավելի մեծ էկրան', cwSmaller: 'Ավելի փոքր էկրան',  pgPrev: 'Նախորդ էջ', pgNext: 'Հաջորդ էջ', 
    goShop: 'Դեպի խանութ', noOffers: 'Առցանց առաջարկներ չեն գտնվել', estimated: 'Գնահատված գին', notSold: 'Հասանելի չէ',
    checkColorHint: 'Խանութը այս գույնի համար առանձին էջ չունի. հղումը տանում է նույն մոդելին', updated: 'Թարմացվել է', priceSrc: 'Գները վերցված են խանութների կայքերից', disclaim: 'Մենք միայն ցույց ենք տալիս խանութների էջերը. վաճառող չենք և պատասխանատվություն չենք կրում', from: '-ից',
    sorts: { brand: 'Ապրանքանիշ (Ա–Ֆ)', battery: 'Մարտկոց', screen: 'Էկրանի չափ', savings: 'Խնայողություն', shops: 'Խանութների քանակ', ram: 'Օպերատիվ հիշողություն', storage: 'Հիշողություն' },
    variantUnknown: 'տարբերակը նշված չէ', pickCapacity: 'Ընտրի՛ր ծավալը՝ խնայողությունը տեսնելու համար', inStock: 'Առկա է', outOfStock: 'Առկա չէ', allOffers: 'Բոլոր առաջարկները', showAll: 'Ցույց տալ բոլորը', showLess: 'Թաքցնել', shopLbl: 'Խանութ', histT: 'Գնի պատմություն', trackSince: 'Հետևում ենք', noHist: 'Դեռ մեկ չափում կա. գրաֆիկը կհայտնվի մի քանի օրից', savingsT: 'Ամենամեծ խնայողությունը', savingsS: 'Նույն ապրանքը՝ տարբեր խանութներում', priceMatters: 'Գինը կարևոր է', models: 'մոդել', offersLbl: 'առաջարկ', country: 'Հայաստան', saveUpTo: 'Խնայում ես մինչև', diffs: 'տարբերություն', same: 'նույնը', pickVariant: 'Ընտրի՛ր տարբերակը', preorder: 'Նախապատվեր', soonT: 'Շուտով'
  },
  ru: {
    tier: { flagship: 'Флагман', 'upper-mid': 'Верхний средний', mid: 'Средний', budget: 'Бюджетный' },
    any: 'Все', min: 'от', newBadge: 'Новинка', view: 'Смотреть', allFilters: 'Все фильтры',
    dS: 'д', hS: 'ч', mS: 'м',
    unsureMark: 'не подтверждено', unsureTip: 'Эта цифра не подтверждена данными производителя',
    scrLo: 'до {x}″', scrHi: 'от {x}″',
    cameraF: 'Основная камера', mp: 'МП', lifeF: 'Время работы', hrs: 'ч',
    cpuF: 'Процессор', gpuF: 'Графика', integrated: 'Встроенная',
    ancF: 'Шумоподавление', waterF: 'Влагозащита',
    findL: 'Найти', showN: 'Показать {n}', filtersT: 'Фильтры', closeL: 'Закрыть',
    atShop: 'в {shop}', lessDearest: 'на {n} ֏ дешевле самого дорогого магазина', sameBest: 'та же цена',
    histNone: 'История цены для {c} начнётся со следующего ночного обновления', histLow: 'Самая низкая с {d}', histAbove: 'На {p}% выше минимума', histLowLine: 'Минимум с {d}: {n} ֏ ({d2})', histWhat: 'самая низкая цена дня, {c}', histKeys: 'Стрелки читают каждый день', histLowest: 'Минимум',
    spotT: 'Выгода дня',
    dealUsual: 'на {n} ֏ ниже обычной цены', dealDrop: '↓ {n} ֏ с {d}', prevL: 'Назад', nextL: 'Вперёд',
    formF: 'Тип', forms: { tws: 'Беспроводные (TWS)', 'in-ear': 'Проводные вкладыши', full: 'Накладные и полноразмерные', neckband: 'С шейным ободом', open: 'Открытые / клипсы' },
    connF: 'Подключение', conns: { wireless: 'Беспроводные', wired: 'Проводные' },
    plugF: 'Разъём', plugs: { 'usb-c': 'USB-C', lightning: 'Lightning', '3.5': '3.5 мм' },
    gamingF: 'Игровые', resF: 'Разрешение',
    spkF: 'Тип', spks: { portable: 'Портативные', party: 'Для вечеринок', smart: 'Умные (Wi-Fi)', home: 'Домашние' },
    waters: { splash: 'Защита от брызг', dip: 'Выдерживает погружение' },
    // ru addresses the reader as вы everywhere else - the subhead below, the footer, the whole
    // interface - and only this headline used ты. Raised to вы rather than lowering the rest:
    // it is the smaller change and the register Russian retail copy is written in.
    heroTag: 'Новинка', heroA: 'Сравните и найдите', heroB: 'лучшую цену',
    heroSub: 'Каждый магазин называет свою цену. Мы собираем их в одном месте — чтобы вы нашли именно то, что нужно, и не переплатили.',
    heroCta: 'Где выгоднее всего', heroCta2: 'Открыть каталог',
    tbNote: 'Цены в драмах · демо-данные', best: 'лучшее',
    footNote: 'Демо-проект. Цены ориентировочные и не обновляются из магазинов.',
    emptyT: 'Ничего не найдено', seeAll: 'Показать все результаты', filtersShow: 'Все фильтры', filtersHide: 'Скрыть фильтры', handSeen: 'не проверено', handTip: 'Цена записана вручную и сегодня на сайте магазина не проверялась', stockUnknown: 'наличие неизвестно', seenTip: 'Эта цена в последний раз проверялась в этот день', catAll: 'Все', applyF: 'Применить', clearF: 'Сбросить', catsMore: 'Другие разделы', catsFewer: 'Свернуть', panelF: 'Тип экрана', yearF: 'Год выпуска', osF: 'Операционная система', cats: { phone: 'Смартфоны', tablet: 'Планшеты', watch: 'Смарт-часы', earbuds: 'Наушники', headphones: 'Наушники', speaker: 'Колонки', console: 'Игровые консоли', laptop: 'Ноутбуки', desktop: 'Компьютеры', appliance: 'Бытовая техника', ereader: 'Электронные книги', monitor: 'Мониторы', component: 'Комплектующие', tv: 'Телевизоры', drone: 'Дроны и съёмка' }, emptyS: 'Попробуйте изменить фильтры.',
    shops: 'магазина', offersTitle: 'Цены в магазинах Армении', bestPrice: 'Лучшая цена', checkPrices: 'Проверить цены', cwTitle: 'Сравнить с', cwNewer: 'Новая модель', cwOlder: 'Предыдущая модель', cwStronger: 'Мощнее', cwAlt: 'Альтернатива', nfT: 'Товар не найден', nfS: 'Ссылка устарела или неверна. Попробуйте поиск или посмотрите эти товары.', nfCats: 'Разделы', cmpPrice: 'Цена', cwCheaper: 'Дешевле', cwStepup: 'Классом выше', cwBigger: 'Экран больше', cwSmaller: 'Экран меньше',  pgPrev: 'Предыдущая страница', pgNext: 'Следующая страница', 
    goShop: 'В магазин', noOffers: 'Онлайн-предложений не найдено', estimated: 'Оценочная цена', notSold: 'Недоступно',
    checkColorHint: 'У магазина нет отдельной страницы для этого цвета: ссылка ведёт на ту же модель', updated: 'Обновлено', priceSrc: 'Цены взяты с сайтов магазинов', disclaim: 'Мы лишь показываем страницы магазинов: не продавец и ответственности не несём', from: 'от ',
    sorts: { brand: 'Бренд (А–Я)', battery: 'Батарея', screen: 'Диагональ', savings: 'Экономия', shops: 'Число магазинов', ram: 'Оперативная память', storage: 'Память' },
    variantUnknown: 'версия не указана', pickCapacity: 'Выберите объём, чтобы увидеть выгоду', inStock: 'В наличии', outOfStock: 'Нет в наличии', allOffers: 'Все предложения', showAll: 'Показать все', showLess: 'Свернуть', shopLbl: 'Магазин', histT: 'История цены', trackSince: 'Отслеживаем с', noHist: 'Пока одно измерение — график появится через несколько дней', savingsT: 'Наибольшая выгода', savingsS: 'Один товар — разные магазины', priceMatters: 'Цена имеет значение', models: 'моделей', offersLbl: 'предложений', country: 'Армения', saveUpTo: 'Экономия до', diffs: 'отличий', same: 'одинаково', pickVariant: 'Выберите версию', preorder: 'Предзаказ', soonT: 'Скоро'
  },
  en: {
    tier: { flagship: 'Flagship', 'upper-mid': 'Upper mid', mid: 'Mid-range', budget: 'Budget' },
    any: 'All', min: 'from', newBadge: 'New', view: 'View', allFilters: 'All filters',
    dS: 'd', hS: 'h', mS: 'm',
    unsureMark: 'unconfirmed', unsureTip: "Not confirmed against the maker's own spec sheet",
    scrLo: 'under {x}″', scrHi: '{x}″ and up',
    cameraF: 'Main camera', mp: 'MP', lifeF: 'Battery life', hrs: 'h',
    cpuF: 'Processor', gpuF: 'Graphics', integrated: 'Integrated',
    ancF: 'Noise cancelling', waterF: 'Water resistance',
    findL: 'Find', showN: 'Show {n}', filtersT: 'Filters', closeL: 'Close',
    atShop: 'at {shop}', lessDearest: '{n} ֏ less than the dearest shop', sameBest: 'same price',
    histNone: 'Price history for {c} starts with the next nightly update', histLow: 'Lowest since {d}', histAbove: '{p}% above the lowest', histLowLine: 'Lowest since {d}: {n} ֏ on {d2}', histWhat: 'cheapest shop each day, {c}', histKeys: 'Arrow keys read each day', histLowest: 'Lowest',
    spotT: 'Deal of the day',
    dealUsual: '{n} ֏ below the usual price', dealDrop: '↓ {n} ֏ since {d}', prevL: 'Previous', nextL: 'Next',
    formF: 'Type', forms: { tws: 'True wireless (TWS)', 'in-ear': 'Wired earphones', full: 'On-ear & over-ear', neckband: 'Neckband', open: 'Open-ear / clip' },
    connF: 'Connection', conns: { wireless: 'Wireless', wired: 'Wired' },
    plugF: 'Connector', plugs: { 'usb-c': 'USB-C', lightning: 'Lightning', '3.5': '3.5 mm' },
    gamingF: 'Gaming', resF: 'Resolution',
    spkF: 'Type', spks: { portable: 'Portable', party: 'Party', smart: 'Smart (Wi-Fi)', home: 'Home' },
    waters: { splash: 'Splash resistant', dip: 'Survives a dunk' },
    heroTag: 'Just launched', heroA: 'Compare and find', heroB: 'the best price',
    heroSub: 'Every shop quotes its own price. We put them side by side, so you find the one you actually need and never pay more than you have to.',
    heroCta: 'Where you save most', heroCta2: 'Browse the catalogue',
    tbNote: 'Prices in dram · demo data', best: 'best',
    footNote: 'Demo project. Prices are indicative and are not a live shop feed.',
    emptyT: 'No results', seeAll: 'See all results', filtersShow: 'All filters', filtersHide: 'Hide filters', handSeen: 'not checked', handTip: 'Recorded by hand and not verified on the shop’s site today', stockUnknown: 'stock not known', seenTip: 'The day this price was last read from the shop', catAll: 'All', applyF: 'Apply', clearF: 'Clear', catsMore: 'More sections', catsFewer: 'Fewer', panelF: 'Screen type', yearF: 'Year', osF: 'Operating system', cats: { phone: 'Phones', tablet: 'Tablets', watch: 'Smartwatches', earbuds: 'Earbuds', headphones: 'Headphones', speaker: 'Speakers', console: 'Consoles', laptop: 'Laptops', desktop: 'Desktops', appliance: 'Home appliances', ereader: 'E-readers', monitor: 'Monitors', component: 'Components', tv: 'TVs', drone: 'Drones & filming' }, emptyS: 'Try changing the filters.',
    shops: 'shops', offersTitle: 'Prices in Armenian shops', bestPrice: 'Best price', checkPrices: 'Check prices', cwTitle: 'Compare with', cwNewer: 'Newer model', cwOlder: 'Previous model', cwStronger: 'More powerful', cwAlt: 'Alternative', nfT: 'Product not found', nfS: 'The link is old or wrong. Try the search, or look at these instead.', nfCats: 'Sections', cmpPrice: 'Price', cwCheaper: 'Cheaper', cwStepup: 'Step up', cwBigger: 'Bigger screen', cwSmaller: 'Smaller screen',  pgPrev: 'Previous page', pgNext: 'Next page', 
    goShop: 'Go to shop', noOffers: 'No online offers found', estimated: 'Estimated price', notSold: 'Not available',
    checkColorHint: 'The shop publishes no page for this colour: the link goes to the same model', updated: 'Updated', priceSrc: 'Prices taken from the shops’ own sites', disclaim: 'We only show the shops’ own pages: not a seller, and no responsibility taken', from: 'from ',
    sorts: { brand: 'Brand (A–Z)', battery: 'Battery', screen: 'Screen size', savings: 'Biggest saving', shops: 'Most shops', ram: 'RAM', storage: 'Storage' },
    variantUnknown: 'variant not stated', pickCapacity: 'Pick a capacity to see the saving', inStock: 'In stock', outOfStock: 'Out of stock', allOffers: 'All offers', showAll: 'Show all', showLess: 'Show less', shopLbl: 'Shop', histT: 'Price history', trackSince: 'Tracking since', noHist: 'Only one reading so far — the chart appears after a few days', savingsT: 'Where you save most', savingsS: 'Same product, different shops', priceMatters: 'Price matters', models: 'models', offersLbl: 'offers', country: 'Armenia', saveUpTo: 'Save up to', diffs: 'differences', same: 'identical', pickVariant: 'Pick a variant', preorder: 'Pre-order', soonT: 'Coming soon'
  }
};

/* ================= state ================= */
// Saved settings - language, theme, filters, the compare list. The key carried the project's
// working name until the site became Better; a returning visitor's settings are still under the
// old one, so it is READ when the new key is empty and never written again. Renaming it without
// that would have reset everyone's language and emptied their compare list on the next visit.
const LS = 'better.v2';
const D = { lang: 'hy', theme: 'auto', cat: '', q: '', scrmin: 0, touch: 0, brands: [], shops: [], pmin: 0, pmax: 0, bounds: null, ram: 0, stor: 0, scrs: [], batt: 0, hz: 0, cam: 0, life: 0, cpus: [], gpus: [], waters: [], hforms: [], hconns: [], hplugs: [], spks: [], reses: [], g5: false, nfc: false, anc: false, gaming: false, sort: 'popular', page: 1, cmp: [] };
let st = { ...D };
try { Object.assign(st, JSON.parse(localStorage.getItem(LS) || localStorage.getItem('mycatalog.v2') || '{}')); } catch (e) { }
// Saved state is user-editable and outlives releases: a language we dropped, a sort that no longer
// exists, or an array that came back as a string would all render as a broken page.
for (const k of ['brands', 'cmp', 'cpus', 'gpus', 'shops', 'hforms', 'hconns', 'hplugs', 'spks', 'reses']) if (!Array.isArray(st[k])) st[k] = [];
if (!Array.isArray(st.bounds) || st.bounds.length !== 2) st.bounds = null;
if (!['hy', 'ru', 'en'].includes(st.lang)) st.lang = D.lang;
if (!['auto', 'light', 'dark'].includes(st.theme)) st.theme = D.theme;
if (typeof st.q !== 'string') st.q = '';
if (typeof st.fopen !== 'boolean') st.fopen = false;
// The numeric filters are the same kind of hazard: st.ram = "abc" passes every guard above,
// matches() then compares a number against a string and the catalogue renders empty with no
// visible cause. A junk st.scr is worse - it is truthy, so the screen block runs and hides
// every product that has no display at all.
for (const k of ['ram', 'stor', 'batt', 'hz', 'cam', 'life', 'scrmin', 'pmin', 'pmax']) {
  const v = Number(st[k]);
  st[k] = Number.isFinite(v) && v >= 0 ? v : D[k];
}
if (![0, 1, 2].includes(st.touch)) st.touch = D.touch;
st.page = Number.isFinite(+st.page) && +st.page >= 1 ? Math.floor(+st.page) : 1;
// The screen bands are cut from whatever is in the category, so their keys are positions
// ('lo' is not 6.3" on a page of laptops), and a band saved under the old fixed phone scale
// would silently select the wrong third.
st.scrs = Array.isArray(st.scrs) ? st.scrs.filter(v => ['lo', 'mid', 'hi'].includes(v)) : [];
st.waters = Array.isArray(st.waters) ? st.waters.filter(v => ['splash', 'dip'].includes(v)) : [];
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
const BY_ID = new Map(DATA.map(p => [p.id, p]));
const byId = id => BY_ID.get(id);

/* ================= format ================= */
const t = k => (STR[st.lang] && STR[st.lang][k]) || STR.hy[k] || k;
const u = k => U[st.lang][k];
const x = k => X[st.lang][k];
// "11 магазина" is wrong and "1 shops" is wrong. Armenian keeps the singular after any
// numeral, so it needs no table and falls through to the plain label.
const PL = {
  ru: { shops: ['магазин', 'магазина', 'магазинов'],
        models: ['модель', 'модели', 'моделей'],
        offersLbl: ['предложение', 'предложения', 'предложений'] },
  en: { shops: ['shop', 'shops'], models: ['model', 'models'], offersLbl: ['offer', 'offers'] }
};
const plw = (n, k) => {
  const f = (PL[st.lang] || {})[k];
  if (!f) return x(k);
  if (f.length === 2) return f[n === 1 ? 0 : 1];
  const a = n % 10, b = n % 100;
  return f[a === 1 && b !== 11 ? 0 : a > 1 && a < 5 && (b < 12 || b > 14) ? 1 : 2];
};
const nx = (n, k) => n + ' ' + plw(n, k);
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
const inch = v => v + '″';
const storageLabel = p => p.variantUnit === 'mm' ? 'f.case_size' : p.variantUnit === 'vram' ? 'f.vram' : 'f.storage';
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
const realFor = (p, storage) => { const o = offersFor(p).find(o => o.storage === storage); return o ? o.price : null; };
// A configuration the maker sells is not automatically a configuration Armenia sells. The
// catalogue lists what the manufacturer offers; the offers say what is actually on a shelf here.
// Anything with no offer behind it is shown struck through and grey rather than hidden, so the
// reader can see the choice exists and that nobody stocks it. Colours are compared through tr()'s
// own canonical form, since one shop writes "Jet Black" where another writes "Jetblack".
const soldKey = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const sold = (p, field, value) => {
  const list = offersFor(p);
  if (!list.length) return true;                      // nothing known - do not cross out the world
  if (field === 'color') {
    const want = soldKey(value);
    // A shop writes the last word of a finish: "Gray" for Space Gray, "Blue" for Sky Blue.
    return list.some(o => { const k = o.color && soldKey(o.color);
      return k && (k === want || (k.length >= 4 && want.endsWith(k))); });
  }
  // A watch's variants are case sizes in mm, but an offer's `storage` is gigabytes, and comparing
  // them crossed out both of the Apple Watch's sizes because no shop "stocks 42 GB". Nothing to
  // compare, so nothing is claimed.
  // Every answer below has to match visibleOffers exactly. They are two readings of one question -
  // "does picking this leave anything on the page" - and when they disagreed the button contradicted
  // the page behind it: 256 GB was crossed out on a MacBook Air M4 and clicking it showed pixel at
  // 469 000, because that offer states no capacity and visibleOffers lets such an offer stand in for
  // the smallest tier while this did not.
  if (field === 'storage') {
    if (p.variantUnit === 'mm') return true;          // a watch's variants are mm, an offer's are GB
    if (list.some(o => o.storage === value)) return true;
    const caps = (p.variants || []).map(v => v.storage).filter(v => v != null);
    return caps.length > 0 && value === Math.min(...caps) && list.some(o => o.storage == null);
  }
  // Strict where the product really is sold in more than one screen, soft otherwise - the same
  // split visibleOffers makes, for the same reason.
  if (field === 'size') {
    const screens = new Set((p.variants || []).map(v => v.size).filter(v => v != null));
    return screens.size > 1 ? list.some(o => o.size === value)
                            : list.some(o => o.size == null || o.size === value);
  }
  if (field === 'band') return list.some(o => !o.band || o.band === value);
  // RAM is rarely printed by a shop, so an offer that never states it shows under every choice.
  return list.some(o => o.ram == null || o.ram === value);
};
// Read through a function, not captured once: on the served build HISTORY starts empty and is
// filled by loadLazy() the first time a product page is opened, and a value copied out at
// startup would stay empty for the life of the tab.
const HIST = () => (typeof HISTORY !== 'undefined' && HISTORY.points) || {};
const dmy = d => d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '';
// Plot only days we actually recorded. One point is not a trend, so it says so instead.
// The price history, for the configuration the reader has picked. It used to draw one band from
// the cheapest offer of any size to the dearest, so the iPhone 17 band ran from a 256 GB to a
// 512 GB price and jumped whenever a shop listed a bigger model, and picking 512 GB changed the
// price above the chart but not the chart. Each day now keeps its cheapest price per size (t);
// the days recorded before that only knew the cheapest of anything, which for the smallest size
// is the same number, so that size keeps its full history and the others start from the change.
let HCUR = null;
function histSeries(p, stor) {
  const sizes = [...new Set((p.variants || []).map(v => v.storage).filter(v => v != null))];
  const key = stor != null ? String(stor) : 'base';
  const smallest = stor == null || sizes.length < 2 || stor === Math.min(...sizes);
  return (HIST()[p.id] || []).map(pt => ({ d: pt.d, t: Date.parse(pt.d + 'T12:00:00Z'), s: pt.shops,
    v: pt.t && pt.t[key] != null ? pt.t[key] : (!pt.t && smallest ? pt.lo : null) })).filter(pt => pt.v != null);
}
function historyHTML(p) {
  if (!(HIST()[p.id] || []).length) { HCUR = null; return ''; }
  const stor = SEL.id === p.id ? SEL.storage : null;
  const cfg = stor != null ? gb(stor, p.variantUnit) : fullName(p);
  const S = histSeries(p, stor);
  HCUR = S.length > 1 ? { S, cfg } : null;
  const head = `<h2 class="sh">${esc(x('histT'))}</h2>`;
  if (!S.length) return head + `<p class="note">${esc(x('histNone').replace('{c}', cfg))}</p>`;
  if (S.length < 2) return head + `<p class="note">${esc(x('noHist'))} · ${esc(x('trackSince'))} ${esc(dmy(S[0].d))}</p>`;
  const now = S[S.length - 1], low = S.reduce((a, b) => b.v < a.v ? b : a);
  const pct = (now.v - low.v) / low.v * 100;
  const pill = now.v <= low.v
    ? `<span class="hp good">${esc(x('histLow').replace('{d}', dmy(S[0].d).slice(0, 5)))}</span>`
    : `<span class="hp warn">${esc(x('histAbove').replace('{p}', pct < 10 ? pct.toFixed(1) : Math.round(pct)))}</span>`;
  return head + `<div class="hist">
      <div class="hist-top"><b class="num">${amd(now.v)}</b>${pill}</div>
      <p class="hist-sub">${esc(x('histLowLine').replace('{d}', dmy(S[0].d).slice(0, 5)).replace('{n}', money(low.v)).replace('{d2}', dmy(low.d).slice(0, 5)))}
        · ${esc(x('histWhat').replace('{c}', cfg))}</p>
      <div class="hist-c"><svg id="hsvg" role="img" tabindex="0"
        aria-label="${esc(x('histT'))}, ${esc(cfg)}: ${esc(money(S[0].v))} → ${esc(money(now.v))} ֏. ${esc(x('histKeys'))}"></svg>
        <div class="hist-tip" id="htip" hidden></div></div>
    </div>`;
}
// Drawn after the page is in place, at the width it actually has, so a dot is a circle and the
// text is the size it says - the old chart stretched one fixed drawing to fit and squashed both.
let HX = null, hIdx = -1;
function paintHist() {
  const svg = $('#hsvg'); HX = null;
  if (!svg || !HCUR) return;
  const S = HCUR.S, W = Math.max(280, svg.clientWidth), H = 210, m = { l: 62, r: 14, t: 22, b: 26 };
  const vals = S.map(v => v.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.18, lo * 0.02);
  lo -= pad; hi += pad;
  const raw = (hi - lo) / 3, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => k >= raw);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const t0 = S[0].t, t1 = S[S.length - 1].t;
  const X = t => m.l + (t - t0) / ((t1 - t0) || 1) * (W - m.l - m.r);
  const Y = v => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  let g = '';
  for (let v = lo; v <= hi + 1; v += step)
    g += `<line class="hg" x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`
      + `<text class="ht" x="${m.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${money(v)}</text>`;
  const nT = W < 480 ? 3 : 5;
  for (let i = 0; i < nT; i++) {
    const t = t0 + (t1 - t0) * i / (nT - 1), d = new Date(t).toISOString().slice(0, 10);
    g += `<text class="ht" x="${X(t).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === nT - 1 ? 'end' : 'middle'}">${dmy(d).slice(0, 5)}</text>`;
  }
  // A day with no reading is drawn dashed: a solid line across it would claim a price nobody read.
  const segs = [[S[0]]];
  for (let i = 1; i < S.length; i++) {
    if (S[i].t - S[i - 1].t > 864e5 * 1.5) { g += `<path class="hgap" d="M${X(S[i - 1].t).toFixed(1)} ${Y(S[i - 1].v).toFixed(1)} L${X(S[i].t).toFixed(1)} ${Y(S[i].v).toFixed(1)}"/>`; segs.push([]); }
    segs[segs.length - 1].push(S[i]);
  }
  const line = pts => pts.map((v, i) => (i ? 'L' : 'M') + X(v.t).toFixed(1) + ' ' + Y(v.v).toFixed(1)).join(' ');
  g = `<path class="harea" d="${line(S)} L${X(t1).toFixed(1)} ${Y(lo)} L${X(t0).toFixed(1)} ${Y(lo)} Z"/>` + g;
  for (const sg of segs) if (sg.length > 1) g += `<path class="hl" d="${line(sg)}"/>`;
  const low = S.reduce((a, b) => b.v < a.v ? b : a), now = S[S.length - 1];
  if (low !== now) g += `<circle class="hlow" cx="${X(low.t).toFixed(1)}" cy="${Y(low.v).toFixed(1)}" r="5"/>`
    + `<text class="hlab good" x="${X(low.t).toFixed(1)}" y="${(Y(low.v) + 19).toFixed(1)}" text-anchor="middle">${esc(x('histLowest'))} ${money(low.v)}</text>`;
  g += `<circle class="hnow" cx="${X(now.t).toFixed(1)}" cy="${Y(now.v).toFixed(1)}" r="5.5"/>`
    + `<line class="hx" id="hx" y1="${m.t - 8}" y2="${H - m.b}" visibility="hidden"/>`
    + `<circle class="hd" id="hd" r="4.5" visibility="hidden"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = g;
  HX = { S, X, Y, W };
  if (hIdx >= S.length) hIdx = -1;
}
function histShow(i) {
  if (!HX) return;
  const { S, X, Y, W } = HX; hIdx = Math.max(0, Math.min(S.length - 1, i));
  const p = S[hIdx], px = X(p.t), py = Y(p.v), cr = $('#hx'), dt = $('#hd'), tip = $('#htip');
  cr.setAttribute('x1', px); cr.setAttribute('x2', px); cr.setAttribute('visibility', 'visible');
  dt.setAttribute('cx', px); dt.setAttribute('cy', py); dt.setAttribute('visibility', 'visible');
  const prev = hIdx ? S[hIdx - 1].v : p.v, dv = p.v - prev;
  tip.innerHTML = `<span>${esc(dmy(p.d))}</span><b class="num">${amd(p.v)}</b>`
    + (dv ? `<span class="${dv < 0 ? 'dn' : 'up'}">${dv < 0 ? '↓' : '↑'} ${money(Math.abs(dv))}</span>` : '')
    + (p.s ? `<span>${esc(nx(p.s, 'shops'))}</span>` : '');
  tip.hidden = false;
  tip.style.left = Math.max(64, Math.min(W - 64, px)) + 'px';
  tip.style.top = py + 'px';
  tip.classList.toggle('below', py < 90);   // near the top it would cover the text above the chart
}
function histHide() {
  const cr = $('#hx'), dt = $('#hd'), tip = $('#htip');
  if (cr) cr.setAttribute('visibility', 'hidden');
  if (dt) dt.setAttribute('visibility', 'hidden');
  if (tip) tip.hidden = true;
}
const histAt = e => {
  if (!HX) return -1;
  const r = e.target.closest('svg').getBoundingClientRect(), k = (e.clientX - r.left) * HX.W / r.width;
  let bi = 0, bd = Infinity;
  HX.S.forEach((p, i) => { const d = Math.abs(HX.X(p.t) - k); if (d < bd) { bd = d; bi = i; } });
  return bi;
};
document.addEventListener('pointermove', e => { if (e.target.closest && e.target.closest('#hsvg')) histShow(histAt(e)); });
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('#hsvg')) histShow(histAt(e)); });
document.addEventListener('pointerout', e => { if (e.target.closest && e.target.closest('#hsvg') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#hsvg'))) histHide(); });
document.addEventListener('focusin', e => { if (e.target.id === 'hsvg' && HX) histShow(hIdx < 0 ? HX.S.length - 1 : hIdx); });
document.addEventListener('focusout', e => { if (e.target.id === 'hsvg') histHide(); });
document.addEventListener('keydown', e => {
  if (e.target.id !== 'hsvg' || !HX) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); histShow((hIdx < 0 ? HX.S.length - 1 : hIdx) + (e.key === 'ArrowLeft' ? -1 : 1)); }
  if (e.key === 'Home') { e.preventDefault(); histShow(0); }
  if (e.key === 'End') { e.preventDefault(); histShow(HX.S.length - 1); }
});
let hRz;
window.addEventListener('resize', () => { clearTimeout(hRz); hRz = setTimeout(paintHist, 120); });
const updatedOn = () => P.generated ? P.generated.slice(8, 10) + '.' + P.generated.slice(5, 7) + '.' + P.generated.slice(0, 4) : '';

// The price history the served build leaves out, fetched the first time somebody asks for a
// product page and never on the front page. Once is enough per tab; a failure is silent on
// purpose - the page reads correctly without it, the price chart simply does not appear.
let lazyDone = false;
function loadLazy() {
  if (lazyDone || typeof LAZYDATA === 'undefined' || !LAZYDATA) return;
  lazyDone = true;
  fetch('data/history.json').then(r => r.ok ? r.json() : null).catch(() => null).then(h => {
    if (h) { HISTORY = h; if (location.hash.startsWith('#/p/')) render(true); }
  });
}

/* ================= filtering ================= */
// The words someone types are rarely in the shop's order: "samsung fold" is how a person asks
// for the Galaxy Z Fold 8, and a contiguous-substring test answers "no results" to it. Every
// word has to appear somewhere, order free.
// Every keystroke and every filter count asks this of all 1304 products; the text never changes.
const HAY = new WeakMap();
const hay = p => { let h = HAY.get(p);
  if (h === undefined) HAY.set(p, h = (p.brand + ' ' + fullName(p) + ' ' + (p.chipset?.name || '')).toLowerCase());
  return h; };
function hayMatch(p, q) {
  // Nothing in Armenia sells it today, so it has no business in a price-comparison list: no card
  // in the grid, no row in the search box, no entry in a category count. Its PAGE stays, and so
  // does its line in sitemap.xml - the product is real, the url has been indexed, and somebody
  // arriving from a search engine should land on what they looked for rather than a 404. It comes
  // back on its own the day any shop stocks it again, because this asks the offers, not a list.
  if (!hasReal(p)) return false;
  const words = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const h = hay(p);
  return words.every(w => h.includes(w));
}
/* --- what a product can be asked ---------------------------------------------------- */
// Every one of these reads a fact the catalogue already carries. Nothing is invented: a phone
// with no camera block has no megapixel count and drops out of a camera filter rather than
// being given a plausible one.
const mpOf = p => { const m = /(\d+(?:\.\d+)?)\s*MP/i.exec(p.camera?.main || ''); return m ? +m[1] : null; };
// "8.5 hours (30 with the case)" -> 8.5. The buds' own figure, not the case total, because that
// is the number every maker prints first and the only one all of them print.
const hoursOf = p => { const m = /(\d+(?:\.\d+)?)\s*h/i.exec(p.battery?.life || ''); return m ? +m[1] : null; };
// IP68 is dust 6 / water 8, IPX4 is water only, and ATM or metre figures are dive ratings.
// Three answers a buyer actually has: nothing, survives splashes, survives being dunked.
const waterOf = p => {
  const v = p.body?.ip || '';
  if (/ATM|\d+\s*m\s*water|dive/i.test(v)) return 'dip';
  const m = /IP(?:\d|X)(\d)/i.exec(v);
  const d = m ? +m[1] : null;
  return d == null ? null : d >= 7 ? 'dip' : d >= 4 ? 'splash' : null;
};
// M5 Pro and M5 Max are different purchases; an i5 and an i7 of one generation are the same
// aisle. So Apple keeps its suffix and Intel/AMD are cut at the tier.
const cpuOf = p => {
  const n = p.chipset?.name || '';
  const a = /^Apple (M\d+(?: (?:Pro|Max|Ultra))?|A\d+(?: Pro)?)/.exec(n);
  if (a) return 'Apple ' + a[1];
  const m = /^(Intel Core (?:Ultra )?\w+)/.exec(n) || /^(AMD Ryzen \d+)/.exec(n) || /^(Snapdragon(?: \w+)?)/.exec(n);
  return m ? m[1] : (n || null);
};
const gpuOf = p => {
  const g = p.graphics;
  if (!g || !g.name) return null;
  if (g.type !== 'discrete') return 'integrated';
  const m = /(GeForce RTX \d+|GeForce GTX \d+|Radeon RX \d+)/i.exec(g.name);
  return m ? m[1] : g.name;
};
// Screen bands used to be the three phone bands - under 6.3", 6.3-6.7", over 6.7" - drawn on a
// page of laptops, where every one of them lands in the last band and the filter answers
// nothing. Cut them from the sizes the category actually has instead.
const _bandC = {};
function bandCuts(cat) {
  if (cat in _bandC) return _bandC[cat];
  const v = [...new Set(DATA.filter(p => !cat || (p.category || 'phone') === cat)
    .map(p => p.display?.size).filter(n => typeof n === 'number' && n > 0))].sort((a, b) => a - b);
  return _bandC[cat] = v.length < 3 ? null : [v[Math.floor(v.length / 3)], v[Math.floor(v.length * 2 / 3)]];
}
const bandOf = (p, cat) => {
  const c = bandCuts(cat), d = p.display?.size;
  return (!c || d == null) ? null : d < c[0] ? 'lo' : d < c[1] ? 'mid' : 'hi';
};
const bandLabel = v => {
  const c = bandCuts(st.cat);
  if (!c) return '';
  return v === 'lo' ? x('scrLo').replace('{x}', c[0])
    : v === 'hi' ? x('scrHi').replace('{x}', c[1]) : c[0] + '\u2013' + c[1] + '\u2033';
};

// One table for every filter. 'min' is a "this much or more" radio, 'set' is a tick list where
// any chosen value qualifies, 'flag' is a yes/no button. The bar, the option counts, the chips,
// the reset and the pruning all read this, so a new filter is one entry and not six edits.
const FILT = {
  brand: { kind: 'set', arr: 'brands', label: () => t('filter.brand'), of: p => p.brand, fmt: v => v },
  shop:  { kind: 'set', arr: 'shops', label: () => x('shopLbl'), of: null, fmt: v => shopName(v) },
  // 'of' answers "does this product qualify" (its biggest variant), 'all' supplies the options
  // (every variant), so 256 GB can be offered even where no product stops there.
  ram:   { kind: 'min', label: () => t('filter.ram'), of: p => topOf(p, 'ram') || null,
           all: p => (p.variants || []).map(v => v.ram), fmt: v => v + ' ' + u('gb') },
  stor:  { kind: 'min', label: () => viewUnit() === 'mm' ? t('f.case_size') : t('filter.storage'),
           of: p => topOf(p, 'storage') || null, all: p => (p.variants || []).map(v => v.storage),
           fmt: v => gb(v, viewUnit()) },
  batt:  { kind: 'min', label: () => t('filter.battery'), of: p => p.battery?.capacity, fmt: v => money(v) + ' ' + u('mah') },
  hz:    { kind: 'min', label: () => t('filter.refresh_rate'), of: p => p.display?.refresh, fmt: v => v + ' ' + u('hz') },
  cam:   { kind: 'min', label: () => x('cameraF'), of: mpOf, fmt: v => v + ' ' + x('mp') },
  life:  { kind: 'min', label: () => x('lifeF'), of: hoursOf, fmt: v => v + ' ' + x('hrs') },
  scr:   { kind: 'set', arr: 'scrs', label: () => t('filter.screen_size'), of: (p, s) => bandOf(p, s.cat),
           fmt: bandLabel, vals: () => bandCuts(st.cat) ? ['lo', 'mid', 'hi'] : [] },
  cpu:   { kind: 'set', arr: 'cpus', label: () => x('cpuF'), of: cpuOf, fmt: v => v },
  gpu:   { kind: 'set', arr: 'gpus', label: () => x('gpuF'), of: gpuOf, fmt: v => v === 'integrated' ? x('integrated') : v },
  water: { kind: 'set', arr: 'waters', label: () => x('waterF'), of: waterOf, fmt: v => x('waters')[v], vals: () => ['splash', 'dip'] },
  g5:    { kind: 'flag', label: () => '5G', of: p => /5G/i.test(p.connectivity?.network || '') },
  nfc:   { kind: 'flag', label: () => 'NFC', of: p => !!p.connectivity?.nfc },
  anc:   { kind: 'flag', label: () => x('ancF'), of: p => !!p.audio?.anc },
  // The columns e-catalog asks headphones about. Filled in by tools/audio.mjs from the product's
  // name and the shops' titles; a product it could not place has no value and drops out only
  // while that filter is on.
  hform: { kind: 'set', arr: 'hforms', label: () => x('formF'), of: p => p.audio?.form, fmt: v => x('forms')[v] || v,
           vals: () => ['tws', 'in-ear', 'full', 'neckband', 'open'] },
  hconn: { kind: 'set', arr: 'hconns', label: () => x('connF'), of: p => p.audio?.conn, fmt: v => x('conns')[v] || v,
           vals: () => ['wireless', 'wired'] },
  hplug: { kind: 'set', arr: 'hplugs', label: () => x('plugF'), of: p => p.audio?.plug, fmt: v => x('plugs')[v] || v,
           vals: () => ['usb-c', 'lightning', '3.5'] },
  gaming: { kind: 'flag', label: () => x('gamingF'), of: p => !!p.audio?.gaming },
  spk:   { kind: 'set', arr: 'spks', label: () => x('spkF'), of: p => spkOf(p), fmt: v => x('spks')[v] || v,
           vals: () => ['portable', 'party', 'smart', 'home'] },
  res:   { kind: 'set', arr: 'reses', label: () => x('resF'), of: p => resOf(p), fmt: v => v,
           vals: () => ['HD', 'Full HD', 'QHD', '4K', '8K'] },
  // Ninety-six televisions and thirty-eight monitors all differ on the one thing a buyer of
  // either actually chooses between, and nothing here could ask about it until now.
  panel: { kind: 'set', arr: 'panels', label: () => x('panelF'), of: p => panelOf(p), fmt: v => v },
  // A shop sells last year's laptop next to this year's at the same price, and the model number
  // is the only thing that says which - except here, where the catalogue already knows.
  year:  { kind: 'min', label: () => x('yearF'), of: p => yearOf(p), fmt: v => String(v) },
  os:    { kind: 'set', arr: 'oses', label: () => x('osF'), of: p => osOf(p), fmt: v => v },
};
// The panel is written in a dozen ways across the makers - "Liquid Retina IPS LCD", "QNED
// Mini-LED", "Neo QLED" - and the buyer is choosing between about five things. The most specific
// word in the string is the one that decides, so OLED beats LED in "NanoCell LED".
const PANELS = ['Mini-LED', 'QNED', 'Neo QLED', 'QLED', 'AMOLED', 'OLED', 'NanoCell', 'IPS', 'VA', 'TN', 'LCD', 'LED', 'E Ink'];
function panelOf(p) {
  const t = String(p.display?.type || '');
  if (!t) return null;
  return PANELS.find(k => new RegExp('\\b' + k.replace(/[-\s]/g, '[-\\s]?') + '\\b', 'i').test(t)) || null;
}
// Named the way a shop names it, from the long side of the panel: "2560 x 1600" is QHD.
function resOf(p) {
  const m = String(p.display?.resolution || '').match(/(\d{3,5})\s*[x×]\s*(\d{3,5})/);
  if (!m) return null;
  const w = Math.max(+m[1], +m[2]);
  return w >= 7680 ? '8K' : w >= 3840 ? '4K' : w >= 2560 ? 'QHD' : w >= 1920 ? 'Full HD' : 'HD';
}
// e-catalog splits speakers by what they are for. The model line says it: a PartyBox is for a
// party whatever its size, a HomePod or a Yandex Station is a Wi-Fi speaker you talk to, an
// Acton or a Stanmore plugs into the wall, and the rest go in a bag. Not placed -> no value.
const SPK = [
  ['party', /\bpartybox\b|\bboombox\b/i],
  ['smart', /\bhomepod\b|\bstation\b|\bsonos\b|\bauthentics\b|\bsoundtouch\b|\bgoogle\b|\bbeosound (balance|level|edge)\b/i],
  ['home',  /\bacton\b|\bstanmore\b|\bwoburn\b|\baura studio\b|\bstudio \d\b/i],
  ['portable', /\bflip\b|\bcharge\b|\bclip\b|\bgo \d\b|\bxtreme\b|\bsoundlink\b|\bemberton\b|\bwillen\b|\bkilburn\b|\bstockwell\b|\bmiddleton\b|\buxbridge\b|\bluna\b|\bonyx\b|\bbeosound (a1|a5|explore)\b/i],
];
const spkOf = p => p.category !== 'speaker' ? null : (SPK.find(([, re]) => re.test(p.name)) || [])[0] || null;
// The year it was released, which is a fact the catalogue records, not one read off a title.
const yearOf = p => { const m = String(p.released || '').match(/^(\d{4})/); return m ? +m[1] : null; };
// "macOS 26", "Android 15, One UI 7" - the family is what anybody filters on, not the point release.
// Google TV and Wear OS are Android underneath but are what a buyer knows them as, so they come
// before Android in the list - the first match wins.
const OSES = ['iOS', 'iPadOS', 'macOS', 'watchOS', 'Google TV', 'Wear OS', 'Android', 'Windows', 'HarmonyOS',
  'Chrome OS', 'Tizen', 'webOS', 'VIDAA', 'Garmin', 'DOS'];
const osOf = p => { const v = String(p.os || '').replace(/\bwin ?1[01]\b/i, 'Windows');
  return OSES.find(o => new RegExp('\\b' + o + '\\b', 'i').test(v)) || null; };
// Which questions each category can be asked. The bar used to decide this purely on whether the
// numbers varied, so AirPods were filtered by RAM and screen size and a watch by refresh rate:
// varying is not the same as meaning something. A filter listed here still has to prove the
// items in view differ on it before it is drawn.
const ASK = {
  phone:      ['ram', 'stor', 'batt', 'hz', 'scr', 'cam', 'g5', 'nfc', 'panel', 'os', 'year'],
  tablet:     ['ram', 'stor', 'batt', 'hz', 'scr', 'g5', 'touch', 'panel', 'os', 'year'],
  laptop:     ['ram', 'stor', 'cpu', 'gpu', 'scr', 'res', 'touch', 'panel', 'os', 'year'],
  desktop:    ['ram', 'stor', 'cpu', 'gpu', 'scr', 'touch', 'panel', 'os', 'year'],
  console:    ['stor', 'year'],
  ereader:    ['stor', 'scr', 'water', 'panel', 'year'],
  watch:      ['stor', 'scr', 'life', 'water', 'os', 'year'],
  headphones: ['hform', 'hconn', 'hplug', 'anc', 'gaming', 'life', 'water', 'year'],
  speaker:    ['spk', 'life', 'water', 'year'],
  appliance:  ['year'],
  monitor:    ['scr', 'res', 'hz', 'touch', 'panel', 'year'],
  component:  ['year'],
  // A television is asked the same two questions a monitor is: how big, and how fast.
  tv:         ['scr', 'res', 'hz', 'panel', 'os', 'year'],
  drone:      ['year'],
};
// Brand, price and shop are questions about the purchase, not about the hardware, so they are
// asked everywhere. A spec question needs a category: with none chosen the page is showing
// phones beside fridges, and "16 GB or more" there is a question about some of them only.
// With a category chosen, that category's own list decides. With none, the bar used to offer
// nothing but brand, price and shop - which is why "All" looked like it had lost its filters.
// A question some category in view would be asked is a fair question to ask of the whole view;
// whether it is DRAWN still depends on the items in view actually differing on it, which is the
// check that kept RAM off the AirPods in the first place.
const ANY_ASK = new Set(Object.values(ASK).flat());
const askable = (k, cat = st.cat) => k === 'brand' || k === 'shop'
  || (cat ? (ASK[cat] || []).includes(k) : ANY_ASK.has(k));

function matches(p, s) {
  if (s.cat && (p.category || 'phone') !== s.cat) return false;   // same default inView()/catTabs() use
  if (!hayMatch(p, s.q)) return false;
  const pr = bestOf(p);
  if (pr < s.pmin || pr > s.pmax) return false;
  for (const k in FILT) {
    const f = FILT[k];
    // an ACTIVE spec filter excludes anything without that spec: earbuds have no screen, so
    // they must not slip through a "120 Hz or more" filter merely by lacking the field
    if (f.kind === 'flag') { if (s[k] && !f.of(p, s)) return false; continue; }
    if (f.kind === 'min') { if (s[k] && !(f.of(p, s) >= s[k])) return false; continue; }
    const sel = s[f.arr] || [];
    if (!sel.length) continue;
    if (k === 'shop') { if (!offersFor(p).some(o => sel.includes(o.shop))) return false; continue; }
    const v = f.of(p, s);                        // any chosen value qualifies
    if (v == null || !sel.includes(v)) return false;
  }
  if (s.scrmin && !(p.display?.size >= s.scrmin)) return false;
  // 1 = must have a touchscreen, 2 = must not; 0 = do not care
  if (s.touch && p.display?.touch !== (s.touch === 1)) return false;
  return true;
}
// A saving is only real when it is the SAME product in the SAME configuration: cheapest shop
// against dearest. Measured across tiers it is just the price of more storage - the Z Fold 8
// showed a 470 000 ֏ "saving" that was a 256 GB offer against a 1 TB one.
// "Save up to X" is a promise that the same thing costs less somewhere else, so the two prices
// have to be the same thing. Two ways they were not:
//
// The eSIM build and the tray build are different hardware at different prices - the tray always
// costs more - so a tier that mixed them reported the SIM difference as a saving. The iPhone 17
// Pro Max 1TB read "save 234 000" by comparing a 715 000 eSIM against a 949 000 tray.
//
// And an offer whose capacity the shop never stated could be any configuration. Where a product
// sells in one size only that is harmless, but the MacBook Pro 14 M4 Pro sells at 512 GB and
// 1 TB and all three of its offers state no capacity - so the front page promised 274 000 off
// by putting one shop's base model beside the same shop's higher one.
// Every configuration a product is sold in (same capacity, RAM and SIM build), with one price per
// shop - its cheapest. Two colours at one shop are not a saving between shops, and the front page
// names the shops, so each end has to be one.
const tiersOf = p => {
  const sizes = new Set((p.variants || []).map(v => v.storage).filter(v => v != null));
  const byTier = new Map();
  for (const o of offersFor(p)) {
    if (o.storage == null && sizes.size > 1) continue;   // which configuration is unknowable
    // screen size too: a 13-inch and a 15-inch MacBook with the same memory are not one product
    const k = (o.storage ?? 'base') + '|' + (o.ram ?? '') + '|' + (o.esim === true ? 'e' : o.esim === false ? 'n' : '?') + '|' + (o.size ?? '');
    (byTier.get(k) || byTier.set(k, []).get(k)).push(o);
  }
  const out = [];
  for (const [tier, offs] of byTier) {
    const perShop = new Map();
    offs.forEach((o, i) => { const k = o.shop ?? i; if (!perShop.has(k) || o.price < perShop.get(k).price) perShop.set(k, o); });
    if (perShop.size < 2) continue;
    const list = [...perShop.values()].sort((a, b) => a.price - b.price);
    const loO = list[0], hiO = list[list.length - 1], lo = loO.price, hi = hiO.price;
    // the usual price: what the middle shop asks - a real price somebody charges, and one that a
    // single mislabelled listing at either end cannot move
    const mid = list[list.length >> 1].price;
    const [stor, ram, sim, size] = tier.split('|');
    out.push({ p, lo, hi, mid, gap: hi - lo, below: mid - lo, storage: stor === 'base' ? null : +stor, ram: ram ? +ram : null,
               size: size && new Set((p.variants || []).map(v => v.size).filter(v => v != null)).size > 1 ? +size : null,
               esim: sim === 'e' ? true : sim === 'n' ? false : null, loShop: loO.shop, hiShop: hiO.shop, shops: list.length });
  }
  return out;
};
// the widest spread between two shops for one configuration
const bestTier = p => tiersOf(p).reduce((a, r) => r.hi > r.lo && (!a || r.gap > a.gap) ? r : a, null);
// The front page's saving is measured against the usual price, not the dearest shop: one shop
// listing a bigger model as the 512 GB made a "saving" of 294 000 on a phone nobody overcharges
// for. Three shops at least, or there is no middle to speak of.
const typTier = p => tiersOf(p).filter(r => r.shops >= 3 && r.below > 0)
  .reduce((a, r) => !a || r.below / r.mid > a.below / a.mid ? r : a, null);
const spreadOf = p => bestTier(p)?.gap || 0;
const SORTS = {
  popular: (a, b) => b.popularity - a.popularity,
  price_asc: (a, b) => bestOf(a) - bestOf(b),
  price_desc: (a, b) => bestOf(b) - bestOf(a),
  newest: (a, b) => (b.released || '').localeCompare(a.released || ''),
  brand: (a, b) => a.brand.localeCompare(b.brand) || fullName(a).localeCompare(fullName(b)),
  battery: (a, b) => (b.battery?.capacity || 0) - (a.battery?.capacity || 0),
  screen: (a, b) => (b.display?.size || 0) - (a.display?.size || 0),
  savings: (a, b) => spreadOf(b) - spreadOf(a),
  performance: (a, b) => (b.chipset?.antutu || 0) - (a.chipset?.antutu || 0),
  shops: (a, b) => shopCount(offersFor(b)) - shopCount(offersFor(a)),
  ram: (a, b) => topOf(b, 'ram') - topOf(a, 'ram'),
  storage: (a, b) => topOf(b, 'storage') - topOf(a, 'storage')
};
const topOf = (p, k) => Math.max(0, ...(p.variants || []).map(v => v[k] || 0));
// A sort is only worth offering when the items on screen actually carry the number: "Battery"
// on a page of desktops sorts nothing, it just puts a dead option in the menu.
const SORT_NEEDS = { battery: p => p.battery?.capacity, screen: p => p.display?.size,
  ram: p => topOf(p, 'ram'), storage: p => topOf(p, 'storage'), savings: p => spreadOf(p),
  performance: p => p.chipset?.antutu };
const SORT_ALL = ['popular', 'price_asc', 'price_desc', 'savings', 'shops', 'newest', 'brand', 'performance', 'ram', 'storage', 'battery', 'screen'];
if (!SORT_ALL.includes(st.sort)) st.sort = D.sort;   // a sort key we removed must not survive in saved state
const sortKeys = () => { const v = inView(); return SORT_ALL.filter(k => !SORT_NEEDS[k] || v.some(SORT_NEEDS[k])); };
const sortLabel = k => (X[st.lang].sorts && X[st.lang].sorts[k]) || t('sort.' + k);
const results = () => DATA.filter(p => matches(p, st)).sort(SORTS[st.sort] || SORTS.popular);
// One merged state per count, not one per product: the spread used to run 1304 times for every
// option in every filter panel, on every repaint.
const cnt = extra => { const s = { ...st, ...extra }; let n = 0; for (const p of DATA) if (matches(p, s)) n++; return n; };

/* ================= spec table ================= */
// A getter that formats a missing field yields "null GB" / "NaN mAh" / "undefined x undefined".
// Both the product page and the comparison read every getter through this, so neither can print
// one - the comparison used to show "undefined × undefined × undefined mm" for 296 products.
const specVal = (get, p) => {
  let v; try { v = get(p); } catch (e) { return null; }
  return v == null || v === '' || /undefined|null|NaN/.test(String(v)) ? null : v;
};
const GROUPS = [
  ['sec.display', [
    ['f.screen_size', p => p.display.size + '″', p => p.display.size],
    ['f.screen_type', p => p.display.type],
    // 43 entries write the long side first and 10 write it last, which side by side in a
    // comparison reads as two unrelated numbers. Normalised here rather than in the data, so a
    // future scrape cannot reintroduce it: always short x long, the way every spec sheet lists it.
    ['f.resolution', p => { const r = p.display?.resolution; if (!r) return null;
      const m = /^(\d+)\s*[x×]\s*(\d+)$/.exec(String(r).trim());
      return m ? Math.min(+m[1], +m[2]) + '×' + Math.max(+m[1], +m[2]) : r; }],
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
    ['f.antutu', p => p.chipset?.antutu && money(p.chipset.antutu), p => p.chipset?.antutu, 1],
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
    ['f.sim', p => p.connectivity.sim],
    ['f.ports', p => p.connectivity.ports]
  ]],
  ['sec.software', [
    ['f.os', p => p.os],
    ['f.updates', p => p.updates],
    ['f.released', p => relDate(p.released)]
  ]]
];

// Every product carries `unsure`: the list of fields whose value was not confirmed from the
// maker's own sheet. The data has recorded that from the start and the page has been printing
// those figures as fact. This says which field each spec row reads, so the ones that are not
// certain are marked as not certain. A row with no entry here has nothing to be unsure about.
const FIELD_OF = {
  'f.screen_size': 'display.size', 'f.screen_type': 'display.type', 'f.resolution': 'display.resolution',
  'f.refresh_rate': 'display.refresh', 'f.ppi': 'display.ppi', 'f.brightness': 'display.brightness',
  'f.protection': 'display.protection', 'f.touch': 'display.touch',
  'f.chipset': 'chipset.name', 'f.process': 'chipset.process', 'f.cpu': 'chipset.cpu',
  'f.gpu': 'graphics.name', 'f.antutu': 'chipset.antutu', 'f.card_slot': 'cardSlot',
  'f.main_cam': 'camera.main', 'f.ultrawide': 'camera.ultrawide', 'f.telephoto': 'camera.telephoto',
  'f.front_cam': 'camera.front', 'f.video': 'camera.video',
  'f.capacity': 'battery.capacity', 'f.charging': 'battery.wired', 'f.wireless': 'battery.wireless',
  'f.weight': 'body.weight', 'f.materials': 'body.materials', 'f.ip_rating': 'body.ip',
  'f.network': 'connectivity.network', 'f.wifi': 'connectivity.wifi', 'f.bluetooth': 'connectivity.bluetooth',
  'f.nfc': 'connectivity.nfc', 'f.sim': 'connectivity.sim', 'f.ports': 'connectivity.ports',
  'f.os': 'os', 'f.updates': 'updates', 'f.released': 'released',
};
// A whole block can be flagged ('connectivity', 'battery'), which covers every row inside it.
const unsureRow = (p, key) => {
  const f = FIELD_OF[key];
  if (!f) return false;
  const u = p.unsure || [];
  return u.includes(f) || u.includes(f.split('.')[0]);
};


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
  $('#skipLink').textContent = t('common.skip');
  $('#srchLbl').textContent = t('nav.search_placeholder');
  $('#q').setAttribute('aria-label', t('nav.search_placeholder'));
  $('#q').placeholder = t('nav.search_placeholder');
  const go = $('#qgo'); if (go) go.setAttribute('aria-label', t('nav.search_placeholder'));
  if ($('#q').value !== st.q) $('#q').value = st.q;
  const h = location.hash.replace(/^#/, '') || '/';
  // The logo is home and always has been, so a second link to it in the nav said nothing. What
  // the nav is for is the two places you cannot otherwise reach: the chooser, which is where
  // "Catalog" now goes, and the comparison.
  $('#nav').innerHTML =
    `<a href="#/construct" ${h === '/construct' ? 'aria-current="page"' : ''}>${esc(t('nav.catalog'))}</a>` +
    `<a href="#/compare" ${h === '/compare' ? 'aria-current="page"' : ''}>${esc(t('nav.compare'))}`
    + `<span class="c" id="cmpN">${st.cmp.length || ''}</span></a>`;
  paintCmpCount();
  $('#foot').innerHTML = `<b>Better</b><span>${esc(x('priceSrc'))}${updatedOn() ? ` · ${esc(x('updated'))} ${esc(updatedOn())}` : ``}</span>`
    + `<span class="ft-note">${esc(x('disclaim'))}</span>`
    + `<span class="ft-links"><a href="#/contact">${esc(t('nav.contact'))}</a><a href="#/privacy">${esc(t('nav.privacy'))}</a></span>`;
}
// The compare bar is gone: picking a product goes straight to the comparison, so a second copy
// of the same list pinned over the page was doing nothing but covering the last row. The header
// button that duplicated it is gone too - one way in, the nav link, which now carries the count.
// What is kept is the dimming of cards that cannot join, and the one message that has to be
// said out loud when a pick is refused.
// The badge is the thing being watched when a product is added, and it was changing silently -
// the toast said what happened somewhere else on the page. It pops only when the count GOES UP,
// so removing one, or a plain re-render, stays quiet.
let lastCmpN = 0;
function paintCmpCount() {
  const el = $('#cmpN');
  if (!el) return;
  // The badge lives in the nav now, which render() rewrites, so the previous count cannot be
  // read back off the element - a re-render would always look like no change. Keep it here.
  const was = lastCmpN;
  lastCmpN = st.cmp.length;
  el.textContent = st.cmp.length || '';
  if (st.cmp.length <= was) return;
  el.classList.remove('pop');
  void el.offsetWidth;          // restart the animation rather than let it be ignored
  el.classList.add('pop');
  // drop the class once it has played, so the element does not carry a spent state around
  el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true });
}
function paintTray() {
  paintCmpCount();
  const lock = st.cmp.length ? catOf(byId(st.cmp[0])) : '';
  $$('[data-cat][data-cmp]').forEach(b =>
    b.classList.toggle('off', !!lock && b.dataset.cat !== lock));
}
// the compare limit used to fire a browser alert(); say it in the tray instead
// BOTH timers have to be cancelled when a second message arrives: the inner one belongs to the
// previous message and, left running, hides the new message about a second after it appears.
let trayMsgT, trayHideT;
function trayMsg(text) {
  const el = $('#traymsg'); if (!el) return;
  clearTimeout(trayMsgT); clearTimeout(trayHideT);
  el.textContent = text; el.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  trayMsgT = setTimeout(() => {
    el.classList.remove('on');
    trayHideT = setTimeout(() => { el.hidden = true; }, 250);   // hide after the fade, not during
  }, 3000);
}
const catOf = p => (p.category || 'phone');
function toggleCmp(id) {
  const i = st.cmp.indexOf(id);
  if (i >= 0) st.cmp.splice(i, 1);
  else if (st.cmp.length >= MAXCMP) { trayMsg(t('compare.max_reached')); return false; }
  // A laptop beside a pair of earbuds compares nothing - every row of the table is blank on one
  // side. The first pick sets the type and the rest of the grid dims to match.
  else if (st.cmp.length && catOf(byId(st.cmp[0])) !== catOf(byId(id))) {
    trayMsg(t('compare.same_category')); return false;
  }
  else {
    st.cmp.push(id);
    // the plus reads as "compare this", so it goes there - the compare page carries its own
    // add slot, which is where the second and third picks come from
    if (location.hash !== '#/compare') setTimeout(() => { location.hash = '#/compare'; }, 120);
  }
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
// Ticking a box used to filter the page under you, so choosing three brands meant three reloads
// of the grid and two of them were views nobody asked for. The ticks are now just ticks until
// Apply, which is what a multi-select has always meant everywhere else.
const APPLY = key => `<div class="fapply"><button type="button" class="fclear" data-clear="${key}">${
  esc(x('clearF'))}</button><button type="button" class="fgo" data-apply="${key}">${esc(x('applyF'))}</button></div>`;
const drop = (key, label, body, right) =>
  `<details class="fdrop${right ? ' r' : ''}" data-drop="${key}"><summary>${esc(label)}${ICON_CHEV}</summary><div class="panel">${body}${
    right ? '' : APPLY(key)}</div></details>`;
const radios = (key, vals, fmt) =>
  `<label class="opt"><input type="radio" name="r-${key}" data-f="${key}" value="0"><span>${esc(x('any'))}</span></label>` +
  vals.map(v => `<label class="opt"><input type="radio" name="r-${key}" data-f="${key}" value="${v}"><span>${esc(fmt(v))}</span><span class="n num" data-cnt="${key}:${v}"></span></label>`).join('');
// A list longer than a panel is tall gets a search box: forty brands is a scroll to find one.
const FIND_AT = 8;
const boxes = (key, vals, fmt) => (vals.length >= FIND_AT
  ? `<input type="search" class="fsearch" data-fs="1" placeholder="${esc(x('findL'))}" aria-label="${esc(x('findL'))}" autocomplete="off">` : '') + vals.map(v =>
  `<label class="opt"><input type="checkbox" data-f="${key}" value="${esc(String(v))}"><span>${esc(fmt(v))}</span><span class="n num" data-cnt="${key}:${esc(String(v))}"></span></label>`).join('');

// A filter earns its place only if the items in view actually differ on it. Deriving that
// from the data means a new category never needs a hand-written filter list.
function inView() { return DATA.filter(p => !st.cat || (p.category || 'phone') === st.cat); }
function varies(get) { return new Set(inView().map(get).filter(v => v != null && v !== '')).size > 1; }
// The values a tick-list offers: only the ones something in view actually has, so "Submersible"
// is not offered on a page where nothing is waterproof.
function setVals(k, f, pool) {
  if (k === 'shop') return [...new Set(pool.flatMap(p => offersFor(p).map(o => o.shop)))]
    .sort((a, b) => shopName(a).localeCompare(shopName(b)));
  const have = new Set(pool.map(p => f.of(p, st)).filter(v => v != null && v !== ''));
  return (f.vals ? f.vals() : [...have].sort()).filter(v => have.has(v));
}
// One filter's control - or nothing at all, when the category is never asked this question or
// every item in view answers it the same way.
function fdrop(k, pool) {
  const f = FILT[k];
  if (!askable(k)) return '';
  if (f.kind === 'flag') return varies(p => f.of(p, st))
    ? `<button class="toggle" data-f="${k}" aria-pressed="false">${esc(f.label())}</button>` : '';
  if (f.kind === 'min') {
    const vals = steps(p => f.all ? f.all(p) : [f.of(p, st)]);
    return vals.length > 1 && varies(p => f.of(p, st)) ? drop(k, f.label(), radios(k, vals, f.fmt)) : '';
  }
  const vals = setVals(k, f, pool);
  return vals.length > 1 ? drop(k, f.label(), boxes(k, vals, f.fmt)) : '';
}
function filterBar() {
  const pool = inView();
  // On a phone the same bar is a sheet from the bottom: a head to close it, and at the foot one
  // button that applies every panel at once and says how many results that will be.
  let h = `<div class="fbar${st.fopen ? '' : ' folded'}" id="fbar"><div class="fsheet-hd"><b>${esc(x('filtersT'))}</b>`
    + `<button type="button" data-fsclose="1" aria-label="${esc(x('closeL'))}">×</button></div>`;
  h += fdrop('brand', pool);
  h += drop('price', t('filter.price'), `<div class="rngbox"><div class="rng"><span class="track"></span><span class="fill"></span>
      <input type="range" data-f="pmin" min="${PMIN}" max="${PMAX}" step="5000" aria-label="${esc(t('common.from'))}">
      <input type="range" data-f="pmax" min="${PMIN}" max="${PMAX}" step="5000" aria-label="${esc(t('common.to'))}"></div>
      <div class="rngv"><span class="num" data-rng="min"></span><span class="num" data-rng="max"></span></div></div>`);
  // In the order the section asks them, so a headphone's Type comes before its battery life and a
  // folded bar still shows the question that matters most. Shop and anything else askable follow.
  const order = [...new Set([...(ASK[st.cat] || []), ...Object.keys(FILT)])].filter(k => k !== 'brand');
  for (const k of order) if (FILT[k]) h += fdrop(k, pool);
  h += `<span class="spacer"></span>`;
  h += drop('sort', `${t('sort.label')}: ${sortLabel(st.sort)}`, sortKeys().map(s =>
    `<label class="opt"><input type="radio" name="r-sort" data-f="sort" value="${s}"><span>${esc(sortLabel(s))}</span></label>`).join(''), true);
  // The button sits OUTSIDE the bar it folds, so folding cannot hide it.
  const n = activeFilterCount();
  return h + `<div class="fsheet-ft"><button type="button" class="fsclr" data-rm="all">${esc(t('common.reset'))}</button><button type="button" class="fsgo" id="fsgo" data-fsgo="1">${esc(x('showN').replace('{n}', results().length))}</button></div>`
    + `</div><button class="fmore" data-fmore="1" aria-expanded="${st.fopen ? 'true' : 'false'}">
    ${esc(st.fopen ? x('filtersHide') : x('filtersShow'))}${n ? ` <b>${n}</b>` : ''}
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>`;
}
// how many filters are actually narrowing the list right now - shown on the button so a folded
// bar can never hide the fact that something is filtering
function activeFilterCount() {
  let n = (st.pmin > PMIN || st.pmax < PMAX) ? 1 : 0;
  for (const k in FILT) n += FILT[k].kind === 'set' ? (st[FILT[k].arr] || []).length : (st[k] ? 1 : 0);
  return n;
}
// Read what the panel is showing into the state, close it, and redraw once.
function openSheet() {
  document.documentElement.classList.add('fs-open');
  $$('#fbar .fdrop:not(.r)').forEach(d => { d.open = true; });
  paintDraftCount(null);
  $('#fbar')?.focus?.();
}
// Closing without "Show" throws the drafts away: the boxes go back to what is applied.
function closeSheet() {
  if (!document.documentElement.classList.contains('fs-open')) return;
  document.documentElement.classList.remove('fs-open');
  $$('#fbar .fdrop').forEach(d => { d.open = false; d.classList.remove('dirty'); });
  syncFilters();
}
// What a panel is showing, as the state it would produce - read without committing anything,
// so the Apply button can say how many results it leads to before it is pressed.
function panelDraft(panel, key) {
  if (key === 'price') {
    const lo = +panel.querySelector('input[data-f="pmin"]')?.value;
    const hi = +panel.querySelector('input[data-f="pmax"]')?.value;
    return { pmin: Math.min(lo, hi), pmax: Math.max(lo, hi) };
  }
  const f = FILT[key];
  if (f && f.kind === 'set') return { [f.arr]: [...panel.querySelectorAll('input[type="checkbox"]:checked')].map(i => i.value) };
  if (f) { const r = panel.querySelector('input[type="radio"]:checked'); return { [key]: r ? +r.value : 0 }; }
  return {};
}
const draftAll = () => Object.assign({}, ...$$('.fdrop.dirty:not(.r)').map(pn => panelDraft(pn, pn.dataset.drop)));
// e-catalog puts the count next to the box you just ticked; here it is on the button you press.
function paintDraftCount(panel) {
  const one = panel ? panelDraft(panel, panel.dataset.drop) : {};
  const all = { ...draftAll(), ...one };
  const label = n => x('showN').replace('{n}', n);
  if (panel) { const b = panel.querySelector('.fgo'); if (b) b.textContent = label(cnt(one)); }
  const g = $('#fsgo'); if (g) g.textContent = label(cnt(all));
}
function commitPanel(panel, key) {
  if (!panel) return;
  Object.assign(st, panelDraft(panel, key));
  panel.classList.remove('dirty');
  panel.open = false;
  st.page = 1;
  refresh();
}
// The number under a price slider, painted from the handles rather than from the state, so it
// still follows the drag while the drag is only a draft.
function paintRange(panel) {
  const lo = +panel.querySelector('input[data-f="pmin"]')?.value;
  const hi = +panel.querySelector('input[data-f="pmax"]')?.value;
  const a = Math.min(lo, hi), b = Math.max(lo, hi), sp = PMAX - PMIN;
  const mn = panel.querySelector('[data-rng="min"]'), mx = panel.querySelector('[data-rng="max"]');
  if (mn) mn.textContent = money(a) + ' ֏';
  if (mx) mx.textContent = money(b) + ' ֏';
  const fill = panel.querySelector('.rng .fill');
  if (fill) { fill.style.left = ((a - PMIN) / sp * 100) + '%'; fill.style.right = ((PMAX - b) / sp * 100) + '%'; }
}

function syncFilters() {
  $$('[data-f]').forEach(el => {
    const k = el.dataset.f;
    if (el.tagName === 'BUTTON') { el.setAttribute('aria-pressed', !!st[k]); return; }
    if (FILT[k] && FILT[k].kind === 'set') el.checked = (st[FILT[k].arr] || []).includes(el.value);
    else if (k === 'pmin' || k === 'pmax') el.value = st[k];
    else if (el.type === 'radio') el.checked = String(st[k] ?? '') === el.value;
  });
  $$('[data-cnt]').forEach(el => {
    // split on the FIRST colon only: a shop id or a brand is the rest of the string
    const d = el.dataset.cnt, i = d.indexOf(':'), k = d.slice(0, i), v = d.slice(i + 1);
    const f = FILT[k];
    el.textContent = f && f.kind === 'set' ? cnt({ [f.arr]: [v] }) : cnt({ [k]: +v });
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
    const on = k === 'price' ? (st.pmin > PMIN || st.pmax < PMAX) : k === 'sort' ? st.sort !== 'popular'
      : FILT[k] && FILT[k].kind === 'set' ? (st[FILT[k].arr] || []).length : !!st[k];
    d.classList.toggle('on', !!on);
  });
}
// A filter set in one category follows you into the next one, where the filter bar no longer
// shows a control for it - the touchscreen question from Construct survives onto a page of
// desktops and empties it for a reason nothing on screen explains. So on every category change,
// drop the filters the new category cannot satisfy at all.
function pruneFilters() {
  const pool = inView();
  const base = { ...D, cat: st.cat, pmin: PMIN, pmax: PMAX };
  for (const k in FILT) {
    const f = FILT[k];
    // a question this category is never asked has no control to turn it off with again
    if (!askable(k)) { if (f.kind === 'set') st[f.arr] = []; else st[k] = D[k]; continue; }
    if (f.kind === 'set') st[f.arr] = (st[f.arr] || []).filter(v => pool.some(p => matches(p, { ...base, [f.arr]: [v] })));
    else if (st[k] && !pool.some(p => matches(p, { ...base, [k]: st[k] }))) st[k] = D[k];
  }
  for (const k of ['scrmin', 'touch'])
    if (st[k] && !pool.some(p => matches(p, { ...base, [k]: st[k] }))) st[k] = D[k];
}

const activeChips = () => {
  const o = [];
  for (const v of st.brands) o.push(['brand:' + v, v]);
  if (st.pmin > PMIN || st.pmax < PMAX) o.push(['price', `${money(st.pmin)}–${money(st.pmax)} ֏`]);
  for (const k in FILT) {
    const f = FILT[k];
    if (k === 'brand') continue;                                   // already first, above the price
    if (f.kind === 'set') { for (const v of st[f.arr] || []) o.push([k + ':' + v, f.fmt(v)]); continue; }
    if (st[k]) o.push([k, f.kind === 'flag' ? f.label() : `${x('min')} ${f.fmt(st[k])}`]);
  }
  if (st.touch) o.push(['touch', `${t('f.touch')}: ${st.touch === 1 ? t('common.yes') : t('common.no')}`]);
  if (st.scrmin) o.push(['scrmin', `${x('min')} ${st.scrmin}″`]);
  return o;
};

/* ================= catalog ================= */
// One price per shop, cheapest first. offersFor() is already sorted, so the first time a shop
// appears is its own best price.
const shopRows = (p, n) => {
  const seen = new Map();
  for (const o of offersFor(p)) if (!seen.has(o.shop)) seen.set(o.shop, o.price);
  return [...seen].slice(0, n);
};
function card(p) {
  // A card used to say "3 shops" and stop there, which is the one thing a price-comparison
  // card must not do: it names a spread without showing it. Now the big number carries the shop
  // it belongs to and the next two shops sit under it with their own prices.
  const rows = shopRows(p, 3);
  const rest = rows.slice(1);
  const more = shopCount(offersFor(p)) - rows.length;
  // show the configuration the displayed price actually belongs to, not simply the first variant
  const cheapest = offersFor(p)[0];
  const v = (cheapest && p.variants.find(z => z.storage === cheapest.storage))
    || p.variants[0] || {};
  return `<article class="pcard" data-id="${esc(p.id)}">
    <div class="pshot">
      ${!rows.length ? `<span class="badge na">${esc(x('notSold'))}</span>`
        : isNew(p) ? `<span class="badge">${esc(x('newBadge'))}</span>` : ''}
      <button class="fav" data-cmp="${esc(p.id)}" data-cat="${esc(catOf(p))}" aria-pressed="${st.cmp.includes(p.id)}"
        aria-label="${esc(t('detail.add_compare'))}: ${esc(fullName(p))}">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
      <img class="pimg" src="${THUMB(p.id)}" alt="${esc(fullName(p))}" loading="lazy" decoding="async">
      ${cdotsHTML(p)}
    </div>
    <div class="pbody">
      <span class="eyebrow">${esc(p.brand)}</span>
      <h3><a href="#/p/${esc(p.id)}">${esc(fullName(p))}</a></h3>
      <ul class="sc">${cardFacts(p, v).map(fx => `<li>${fx}</li>`).join('')}</ul>
      <div class="pfoot"><span class="pprice num">${amd(bestOf(p))}
        <s>${rows.length ? esc(shopName(rows[0][0])) : esc(x('estimated'))}</s></span>
        <span class="go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span></div>
      ${rest.length ? `<ul class="poffers">${rest.map(([sh, pr]) =>
        `<li><span>${esc(shopName(sh))}</span><b class="num">${money(pr)} ֏</b></li>`).join('')}${
        more > 0 ? `<li class="mo">+${more}</li>` : ''}</ul>` : ''}
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
// The front page used to open on one big product photo that changed every two seconds and said
// nothing about price. It opens on the reason to be here instead: the same product in the same
// configuration, the cheapest shop against what shops usually ask, today. Nothing moves unless the
// reader moves it.
//
// A saving is only offered where it is real: one price per shop, the same capacity, RAM and SIM
// type throughout (typTier), three shops at least, and 5% or more under the usual price.
// Popular products first, and no more than three from one section or one brand, so the row is not
// ten iPhones.
const DEALS_MAX = 10;
// The prices do not change while the page is open, so the row is worked out once.
let DEALS_CACHE = null;
function deals() {
  if (DEALS_CACHE) return DEALS_CACHE;
  const out = DEALS_CACHE = [], perCat = {}, perBrand = {};
  const pool = DATA.map(typTier).filter(r => r && r.below / r.mid >= 0.05)
    .sort((a, b) => b.p.popularity - a.p.popularity || b.below / b.mid - a.below / a.mid);
  for (const d of [...drops(), ...pool]) {
    if (out.some(o => o.p === d.p)) continue;
    const c = catOf(d.p), b = d.p.brand;
    if ((perCat[c] || 0) >= 3 || (perBrand[b] || 0) >= 3) continue;
    perCat[c] = (perCat[c] || 0) + 1; perBrand[b] = (perBrand[b] || 0) + 1; out.push(d);
    if (out.length === DEALS_MAX) break;
  }
  return out;
}
// Real price falls, worked out by build.mjs from the full history (the served page does not
// carry the history until a product page asks for it). See DROPS there for what counts.
function drops() {
  const src = typeof DROPS !== 'undefined' ? DROPS : [];
  return src.map(d => ({ ...d, p: byId(d.id), drop: true }))
    .filter(d => d.p && offersFor(d.p).length && offersFor(d.p)[0].price === d.lo).slice(0, 3);
}
const simLbl = e => e === true ? 'eSIM' : e === false ? 'Nano-SIM' : '';
function spark(vals) {
  const lo = Math.min(...vals), hi = Math.max(...vals), n = vals.length - 1;
  const X = i => 2 + i * 116 / n, Y = v => 3 + (1 - (v - lo) / ((hi - lo) || 1)) * 22;
  return `<svg class="dl-sp" viewBox="0 0 120 28" aria-hidden="true"><path d="${vals.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ')}"/>`
    + `<circle cx="${X(n).toFixed(1)}" cy="${Y(vals[n]).toFixed(1)}" r="2.6"/></svg>`;
}
function dealCard(d, isSpot) {
  const p = d.p;
  const cfg = [p.brand, d.size ? inch(d.size) : '', d.storage ? gb(d.storage, p.variantUnit) : '', d.ram ? d.ram + ' ' + u('gb') : '', simLbl(d.esim)]
    .filter(Boolean).join(' · ');
  const tail = d.drop
    ? `<span class="dl-save dn num">${esc(x('dealDrop').replace('{n}', money(d.fall)).replace('{d}', dmy(d.since).slice(0, 5)))}</span>${spark(d.run)}`
    : `<span class="dl-save num">${esc(x('dealUsual').replace('{n}', money(d.below)))}</span>`;
  return `<a class="dl${isSpot ? ' is-spot' : ''}" href="#/p/${esc(p.id)}">
    <span class="dl-im"><img src="${THUMB(p.id)}" alt="" loading="lazy" decoding="async"></span>
    <small>${esc(cfg)}</small>
    <span class="dl-n">${esc(p.name)}</span>
    <span class="dl-p num">${amd(d.lo)}</span>
    <span class="dl-at">${esc(shopName(d.loShop))} · ${esc(nx(d.shops || shopCount(offersFor(p)), 'shops'))}</span>
    ${tail}</a>`;
}
// The right half of the hero was empty once the carousel went. It holds the one saving worth
// leading with: among the most popular deals, the biggest share under the usual price. It changes
// when the prices do, once a night, never while you read. On a phone it is not drawn: the deals
// row is right below.
function spotDeal(dl) {
  const pool = dl.filter(d => !d.drop).slice(0, 6);
  return pool.reduce((a, d) => !a || d.below / d.mid > a.below / a.mid ? d : a, null);
}
function spotHTML(d) {
  if (!d) return '';
  const p = d.p, pct = Math.round(d.below / d.mid * 100);
  const cfg = [d.size ? inch(d.size) : '', d.storage ? gb(d.storage, p.variantUnit) : '', d.ram ? d.ram + ' ' + u('gb') : '', simLbl(d.esim)].filter(Boolean).join(' · ');
  const eb = `<span class="spot-e">${esc(x('spotT'))} · ${esc(updatedOn().slice(0, 5))}</span>`;
  const n = nx(d.shops, 'shops');
  return `<a class="spot spot-c" href="#/p/${esc(p.id)}" aria-labelledby="spotT">
      ${eb}
      <img src="${IMG(p.id)}" alt="" decoding="async">
      <span class="spot-pct num">−${pct}%<small>${esc(x('dealUsual').replace('{n}', money(d.below)))}</small></span>
      <span class="spot-bot"><b class="spot-n" id="spotT">${esc(fullName(p))}</b>${cfg ? `<small>${esc(cfg)}</small>` : ''}
        <b class="spot-p num">${amd(d.lo)}</b>
        <span class="spot-at">${esc(shopName(d.loShop))} · ${esc(n)}</span></span>
    </a>`;
}
function mastHero() {
  const dl = deals();
  const sp = spotDeal(dl);
  const offersTotal = Object.values(P.offers || {}).reduce((n, a) => n + a.length, 0);
  return `<div class="cv-eyebrow">${esc(x('priceMatters'))}</div>
    <div class="cv${sp ? ' has-spot' : ''}">
      ${spotHTML(sp)}
      <div class="cv-l">
      <h1 class="cv-h">${esc(x('heroA'))} <em>${esc(x('heroB'))}</em></h1>
      <p class="cv-sub">${esc(x('heroSub'))}</p>
      <div class="cv-acts">
        <a class="btn" href="#results">${esc(x('heroCta2'))}</a>
        ${dl.length ? `<a class="btn ghost" href="#savings">${esc(x('heroCta'))}</a>` : ''}
      </div>
      </div>
    </div>
    <div class="cv-bar">
      <div><b class="num">${DATA.length}</b><span>${esc(plw(DATA.length, 'models'))}</span></div>
      <div><b class="num">${Object.keys(P.shops || {}).length}</b><span>${esc(plw(Object.keys(P.shops || {}).length, 'shops'))}</span></div>
      <div><b class="num">${offersTotal}</b><span>${esc(plw(offersTotal, 'offersLbl'))}</span></div>
      ${updatedOn() ? `<div><b class="num">${esc(updatedOn())}</b><span>${esc(x('updated'))}</span></div>` : ''}
    </div>
    ${dl.length ? `<section class="dls" id="savings" tabindex="-1" aria-labelledby="dlsT">
      <div class="dls-hd">
        <div><h2 id="dlsT">${esc(x('savingsT'))}</h2><p>${esc(x('savingsS'))}</p></div>
        <div class="dls-arr"><button type="button" data-dl="-1" aria-label="${esc(x('prevL'))}" disabled>${ICON_ARR_L}</button><button type="button" data-dl="1" aria-label="${esc(x('nextL'))}">${ICON_ARR_R}</button></div>
      </div>
      <div class="dls-row" id="dlrow">${dl.map(d => dealCard(d, d === sp)).join('')}</div>
    </section>` : ''}
    ${soonHTML()}`;
}
const ICON_FILT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
const ICON_ARR_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_ARR_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
// The arrows are a convenience for a mouse; the row itself scrolls by swipe, wheel and keyboard.
// Each arrow is disabled at its end so it never offers a move that does nothing.
function dealEdges() {
  const r = $('#dlrow'); if (!r) return;
  const a = $$('[data-dl]');
  if (a[0]) a[0].disabled = r.scrollLeft < 4;
  if (a[1]) a[1].disabled = r.scrollLeft + r.clientWidth > r.scrollWidth - 4;
}
document.addEventListener('scroll', e => { if (e.target && e.target.id === 'dlrow') dealEdges(); }, true);
window.addEventListener('resize', dealEdges);

// Announced but not on sale. These are NOT in DATA: no spec sheet, no offer you can buy today,
// so they get a strip of their own rather than a product page full of blanks. The price is the
// shop's own pre-order price and the card links straight to it, so the claim is theirs to make.
// "from" is a PREFIX in Russian and English ("from 799 000") and a SUFFIX in Armenian
// ("799 000 D-ic"), which is why the string itself starts with a hyphen there.
const fromPrice = v => {
  const f = x('from');
  return f.startsWith('-') ? `${money(v)} ֏${f}` : `${f}${money(v)} ֏`;
};
// Ten o'clock Yerevan time on the day of sale - shops open, not midnight. A date that has
// already passed returns nothing, so the strip quietly loses its clock instead of counting up.
function cdText(iso) {
  const ms = Date.parse(iso + 'T10:00:00+04:00') - Date.now();
  if (!(ms > 0)) return '';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
  return `${d}${x('dS')} ${h}${x('hS')} ${m}${x('mS')}`;
}
function soonHTML() {
  const C = (typeof COMING !== 'undefined' && COMING) || { items: [] };
  const items = C.items || [];
  if (!items.length) return '';
  const when = (C.when || {})[st.lang] || (C.when || {}).en || '';
  const cd = C.date ? cdText(C.date) : '';
  return `<section class="soon-sec">
    <div class="soon-hd"><span class="soon-tag">${esc(x('soonT'))}</span><h2>${esc(when)}</h2>${
      cd ? `<span class="soon-cd num" id="soon-cd" data-cd="${esc(C.date)}">${esc(cd)}</span>` : ''}</div>
    <div class="soon-grid">${items.map(c => `<a class="soon" href="${esc(safeHref(c.url))}" target="_blank" rel="noopener noreferrer">
      <span class="t"><img src="${esc(THUMB(c.id))}" alt="${esc(c.brand + ' ' + c.name)}" loading="lazy"></span>
      <span>
        <span class="nm">${esc(c.brand)} ${esc(c.name)}</span>
        <span class="pr num">${esc(fromPrice(c.from))}</span>
        <span class="po">${esc(x('preorder'))} · ${esc(shopName(c.shop))}</span>
      </span>
    </a>`).join('')}</div>
  </section>`;
}

// Minutes are the smallest unit shown, so half a minute is close enough and nothing here
// animates. Route changes replace the element; this finds whatever is on screen now.
setInterval(() => {
  const e = document.getElementById('soon-cd');
  if (!e) return;
  const v = cdText(e.dataset.cd);
  if (v) e.textContent = v; else e.remove();
}, 30000);

// A counter, if one is configured, sees the first load and nothing after it: every page on this
// site is a hash change. Both calls are optional chains, so with no counter this is three
// property reads that find nothing.
const countView = () => {
  try {
    window.umami?.track?.();
    window.goatcounter?.count?.({ path: location.pathname + location.hash, event: false });
  } catch (e) { }
};

// Categories are navigation, not a filter: one always-visible row, current item marked.
// Counts come from the data, so a category appears the moment its first item lands.
function catTabs() {
  const cats = [...new Set(DATA.map(p => p.category || 'phone'))];
  // Counted within the active query, not over the whole catalogue: on a search for "samsung
  // fold" the tabs used to promise "Phones 70" above three results, and the number a tab shows
  // has to be the number clicking it produces.
  const pool = DATA.filter(p => hayMatch(p, st.q));
  const n = c => pool.filter(p => (p.category || 'phone') === c).length;
  const tab = (c, label, count) => `<a class="ctab${(st.cat || '') === c ? ' on' : ''}" href="#${c ? '/c/' + c : '/'}"${(st.cat || '') === c ? ' aria-current=\"page\"' : ''}>${esc(label)}<b class="num">${count}</b></a>`;
  // A tab whose count is 0 leads to an empty page, so it is not offered. The category you are
  // standing in stays even at 0, otherwise it vanishes from under you the moment you over-filter.
  // Fifteen categories wrapped to three rows and pushed the catalogue itself below the fold. The
  // six biggest are shown, plus whichever one you are standing in, so the tab you are on is never
  // the one that got hidden.
  const live = cats.filter(c => n(c) > 0 || st.cat === c);
  const few = new Set([...live].sort((a, b) => n(b) - n(a)).slice(0, CAT_SHOWN));
  if (st.cat) few.add(st.cat);
  const shown = live.filter(c => few.has(c));
  const rest = live.length - shown.length;
  return `<nav class="ctabs" aria-label="${esc(t('catalog.title'))}">` +
    tab('', x('catAll'), pool.length) +
    shown.map(c => tab(c, catName(c), n(c))).join('') +
    // Every section, laid out and explained, is what the chooser page already is - so the button
    // that says "more sections" goes there instead of unfolding a second row of the same chips.
    `<a class="fmore cmore" href="#/construct">${esc(x('catsMore'))}${
      rest > 0 ? ` <b>${rest}</b>` : ''}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></a>`
    + `</nav>`;
}
const catName = c => (X[st.lang].cats && X[st.lang].cats[c]) || c;
// Six fills one row at every width this site is read at, and leaves the grid on screen.
const CAT_SHOWN = 6;
function catalogView() {
  // The hero carries the h1 on the front page. Every other catalogue screen - a category, a
  // search - had no h1 at all, and the one heading it did have said "Catalog" while the browser
  // tab said "Phones". Name the thing you are standing in, at the level it deserves.
  const raw = location.hash.replace(/^#/, '') || '/';
  const hd = raw === '/' ? 'h2' : 'h1';
  const title = raw === '/search' && st.q.trim() ? st.q.trim()
    : st.cat ? catName(st.cat)
    : t('catalog.title');
  return `<div class="shell">
    ${catTabs()}
    <div class="mbar"><button type="button" class="mbar-f" data-fsheet="1">${ICON_FILT}${esc(x('filtersT'))}${activeFilterCount() ? ` <b>${activeFilterCount()}</b>` : ''}</button>
      <span class="mbar-n" id="mbarn"></span></div>
    <div class="fscrim" data-fsclose="1"></div>
    ${filterBar()}
    <div class="chips" id="chips"></div>
    <div class="resbar" id="results"><${hd}>${esc(title)}</${hd}><span class="cnt" id="rescnt"></span></div>
    <div class="grid" id="gridbox"></div>
    <div id="pager"></div>
  </div>`;
}
// 192 products is 192 cards of DOM, 192 price lookups and 192 <img> the browser has to keep
// track of, every time a filter moves. Lazy loading already spares the bytes; this spares the
// work. 36 a page, which fills four rows on a desktop and still beats the fold on a phone.
const PAGE = 36;
const pageCount = n => Math.max(1, Math.ceil(n / PAGE));

function pager(total) {
  const last = pageCount(total);
  if (last < 2) return '';
  // first, last and the neighbours of the current page; an ellipsis stands in for the rest, so
  // the row stays one line at 192 products and at 1920.
  const want = new Set([1, last, st.page, st.page - 1, st.page + 1]);
  if (st.page <= 3) { want.add(2); want.add(3); }
  if (st.page >= last - 2) { want.add(last - 1); want.add(last - 2); }
  // Three versions of the row, and CSS shows the one that fits (see .pager in _shell.html). Built
  // separately rather than by hiding some numbers of one row, because each needs its own
  // ellipses: hiding the 2 out of "1 2 3" leaves "1 3", which reads as consecutive pages.
  //   pf  full    <- 1 ... 4 5 6 ... 11 ->   wide screens
  //   ps  slim    <- 1 ... 5 ... 11 ->       phones: a middle page of the full row is ~376 px of
  //                                          44 px touch targets, wider than a 375 px phone
  //   now         <- 5 / 11 ->               the 280 px cover screen of a folding phone
  const row = (set, cls) => {
    const nums = [...set].filter(n => n >= 1 && n <= last).sort((a, b) => a - b);
    let html = '', prev = 0;
    for (const n of nums) {
      if (prev && n - prev > 1) html += `<span class="gap ${cls}" aria-hidden="true">…</span>`;
      html += `<button class="pg ${cls}${n === st.page ? ' on' : ''}" data-page="${n}"${n === st.page ? ' aria-current="page"' : ''}>${n}</button>`;
      prev = n;
    }
    return html;
  };
  const out = row(want, 'pf') + row(new Set([1, st.page, last]), 'ps')
    + `<span class="pgnow">${st.page} / ${last}</span>`;
  // "step", not "nav": .nav is the site navigation, and on a phone it is told to take a whole row
  // of its own (flex 1 1 100%, order 4). The arrows shared the class, so each one was blown up
  // into a full-width empty pill and shoved below the page numbers.
  return `<nav class="pager" aria-label="${esc(t('catalog.title'))}">
    <button class="pg step" data-page="${st.page - 1}"${st.page === 1 ? ' disabled' : ''} aria-label="${esc(x('pgPrev'))}"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M13 8H3M7 4 3 8l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    ${out}
    <button class="pg step" data-page="${st.page + 1}"${st.page === last ? ' disabled' : ''} aria-label="${esc(x('pgNext'))}"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></nav>`;
}

// Every path that changes what is being listed must send you back to page 1 - otherwise a
// filter applied on page 4 shows an empty grid for a reason nothing on screen explains. One
// signature here instead of a reset in each of the nine handlers that can change it.
let qT;
let lastSig = null;
function refresh() {
  const all = results(), box = $('#gridbox');
  if (!box) return;
  const sig = JSON.stringify([st.cat, st.q, st.pmin, st.pmax, st.scrmin, st.touch, st.sort,
    ...Object.keys(FILT).map(k => FILT[k].arr ? st[FILT[k].arr] : st[k])]);
  if (sig !== lastSig) { if (lastSig !== null) st.page = 1; lastSig = sig; }
  const last = pageCount(all.length);
  if (st.page > last) st.page = last;          // a filter that shrinks the set must not strand you
  const r = all.slice((st.page - 1) * PAGE, st.page * PAGE);
  // "Try changing the filters" was printed at a reader with no filters on - somebody who had
  // typed a word, or landed on a section that is empty. Say it only when there are filters, and
  // offer the button only when it has something to undo.
  const ch = activeChips();
  const lost = !all.length && !!st.q.trim() && !ch.length;   // a word nothing matches, no filter to undo
  const html = all.length ? r.map(card).join('')
    : `<div class="empty"><b>${esc(x('emptyT'))}</b>${ch.length ? esc(x('emptyS')) : ''}${
        ch.length || st.q ? `<button class="btn ghost" data-rm="all" style="margin-top:14px">${esc(t('common.reset'))}</button>` : ''}${
        lost ? `<div class="nfcats"><span>${esc(x('nfCats'))}</span>${bigCats().map(c => `<a class="chip" href="#/c/${esc(c)}">${esc(catName(c))}</a>`).join('')}</div>` : ''}</div>`;
  placeGrid(box, html, new Set(r.map(p => p.id)));
  // filters over an empty result have nothing to narrow
  const fb = $('.fbar'), fm = $('[data-fmore]'); if (fb) fb.hidden = lost; if (fm) fm.hidden = lost;
  const pg = $('#pager'); if (pg) pg.innerHTML = pager(all.length);
  tickCount($('#rescnt'), all.length);
  const mf = $('.mbar-f'), nf = activeFilterCount();
  if (mf) mf.innerHTML = ICON_FILT + esc(x('filtersT')) + (nf ? ` <b>${nf}</b>` : '');
  if ($('#mbarn')) $('#mbarn').textContent = t('common.results_count').replace('{n}', all.length);
  if (document.documentElement.classList.contains('fs-open')) paintDraftCount(null);
  $('#chips').innerHTML = ch.map(([k, l]) =>
    `<button class="chip" data-rm="${esc(k)}">${esc(l)}<span aria-hidden="true">×</span></button>`).join('') +
    (ch.length ? `<button class="chip clear" data-rm="all">${esc(t('common.reset'))}</button>` : '');
  // The tab counts are taken within the active query, so they go stale the moment the query
  // changes - clearing the search box left "All 3" sitting above 36 cards. Repaint them here,
  // where every filter change already lands.
  const tabs = $('.ctabs');
  if (tabs) tabs.outerHTML = catTabs();
  syncFilters(); save();
  moneyFx();     // the grid is rebuilt here on every filter change, not only on a route change
}

// A filter that keeps some of the cards on screen used to throw them all away and slide the whole
// grid in again, so the cards you were looking at vanished and came back somewhere else. Now only
// what changed moves: cards that leave fade out, the ones that stay glide to their new places
// (FLIP: measure, swap, play the difference back), and new ones fade in. A new page or a result
// set with nothing in common is a different list, and keeps the short staggered entrance.
let gridT = null;
function placeGrid(box, html, ids) {
  clearTimeout(gridT);
  const old = [...box.querySelectorAll(':scope > .pcard')];
  const stay = old.filter(c => ids.has(c.dataset.id));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || !stay.length) { box.innerHTML = html; gridIn(box); return; }
  const first = new Map(stay.map(c => [c.dataset.id, c.getBoundingClientRect()]));
  const leaving = old.filter(c => !ids.has(c.dataset.id));
  const swap = () => {
    box.classList.remove('gridin');
    box.innerHTML = html;
    const cards = [...box.querySelectorAll(':scope > .pcard')];
    for (const c of cards) {
      const a = first.get(c.dataset.id), b = c.getBoundingClientRect();
      c.style.transition = 'none';
      if (a) c.style.transform = `translate(${a.left - b.left}px,${a.top - b.top}px)`;
      else { c.style.opacity = '0'; c.style.transform = 'scale(.96)'; }
    }
    void box.offsetWidth;
    for (const c of cards) {
      c.style.transition = 'transform .32s cubic-bezier(.2,.8,.2,1), opacity .25s ease';
      c.style.transform = ''; c.style.opacity = '';
    }
    // hand the card back to its stylesheet (hover lift) once the move is done
    setTimeout(() => cards.forEach(c => { c.style.transition = ''; }), 360);
  };
  if (!leaving.length) { swap(); return; }
  leaving.forEach(c => c.classList.add('leave'));
  gridT = setTimeout(swap, 150);
}
// The result count runs to its new value instead of jumping, so the number reads as the effect
// of what was just clicked.
function tickCount(el, to) {
  if (!el) return;
  const fmt = n => t('common.results_count').replace('{n}', n);
  const from = el._n, calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el._n = to;
  if (from == null || from === to || calm) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => {
    if (el._n !== to) return;                  // a newer count took over
    const k = Math.min(1, (now - t0) / 320);
    el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// The grid is replaced wholesale on every filter change, so without this the result set
// teleports. One class on the container and the cards arrive in a short stagger; capped at 14
// so a 90-product reset does not turn into a two-second wave.
//
// Reduced motion gets the fade WITHOUT the rise. The vestibular problem is movement, not
// opacity, so removing the animation entirely would take away the cue that the grid changed
// while giving nothing back.
function gridIn(box) {
  const cards = box.children;
  if (!cards.length || box.firstElementChild.classList.contains('empty')) return;
  box.classList.remove('gridin'); void box.offsetWidth;
  for (let i = 0; i < cards.length; i++) {
    cards[i].style.setProperty('--d', (Math.min(i, 14) * 22) + 'ms');
  }
  box.classList.add('gridin');
}

/* ================= product page — bold panel + price-spread rail ================= */

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
   Shops name colours freely ("Awesome Lime", "Titanium Jetblack", "Icy Blue"), so a lookup
   table goes stale the moment a new phone lands. HUE resolves the colour WORDS in the name and
   SWATCH overrides the brand-signature finishes that must be exact. */
const SWATCH = {
  'Cosmic Orange': '#C8622A', 'Deep Blue': '#24405F', 'Silver': '#D9DADE', 'Space Black': '#26262A',
  'Burgundy': '#5C2233', 'Glacier': '#C7D6E2', 'Natural Titanium': '#C6BFB4', 'Jade': '#4E8F72',
  'Titanium Silverblue': '#8CA3B8', 'Lavender': '#C3B2DA', 'Mint': '#B9DCC7', 'Icy Blue': '#BBD3E6',
};
const HUE = { black:'#1D1D1F', white:'#F1F1F3', silver:'#D9DADE', grey:'#9AA0A6', gray:'#9AA0A6',
  graphite:'#3A3D42', blue:'#2F5C9E', navy:'#22345C', green:'#3E7D5A', mint:'#B9DCC7',
  red:'#B3242C', pink:'#E4A0B7', purple:'#6E4E9E', lilac:'#B9A7D6', lavender:'#C3B2DA',
  violet:'#5B3E8E', orange:'#D2743A', gold:'#D3B182', yellow:'#E6C64A', cream:'#EDE3D1',
  beige:'#DCCFBA', brown:'#6B4B37', bronze:'#9A6B4A', copper:'#B87333',
  titanium:'#C6BFB4', charcoal:'#36393E', sand:'#D8C9AE', teal:'#2F7D80', cyan:'#4AB3C8',
  plum:'#6B3050', burgundy:'#5C2233', ivory:'#F0EADD', jade:'#4E8F72', glacier:'#C7D6E2',
  lime:'#9CCB3B', coral:'#E0735E', rose:'#D98A9A', sky:'#8FC2E8', aqua:'#5FBFC4',
  olive:'#6E7248', khaki:'#BCAE87', indigo:'#3B3F8F', turquoise:'#3FB8AF', peach:'#F0B38A',
  apricot:'#E8A96A', amber:'#D9A441', emerald:'#2F8F62', sage:'#A8B79A', steel:'#7E858C',
  midnight:'#1B2333', starlight:'#EDE7DA', graphene:'#2E3136', obsidian:'#1A1A1C',
  ultramarine:'#2B3FA8', blush:'#E7B9BC', citrus:'#E8B93C', pistachio:'#BFD6A0', fog:'#C2C6CB',
  canyon:'#B5714E', lemon:'#E9DC6A', porcelain:'#EDEBE6', chestnut:'#7A4A34', moonstone:'#AFBCC8',
  dawn:'#D9CBD6', slate:'#4C555F', frost:'#DCE6EE', onyx:'#141416' };
const MATERIAL = new Set(['titanium','aluminium','aluminum','ceramic','steel','glass','leather','shadow','matte']);
const _hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const _mix = (h, amt) => {
  const t = amt > 0 ? 255 : 0, k = Math.abs(amt);
  return '#' + _hex(h).map(v => Math.round(v + (t - v) * k).toString(16).padStart(2, '0')).join('');
};
function swatch(name) {
  if (SWATCH[name]) return SWATCH[name];
  const words = String(name || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean);
  let base = null, material = null;
  for (let i = words.length - 1; i >= 0 && !base; i--) {       // colour names put the head noun last
    const w = words[i];
    if (MATERIAL.has(w)) { material = material || HUE[w] || null; continue; }
    if (HUE[w]) { base = HUE[w]; break; }
    let bestLen = 0;                                          // shops write compounds as one word
    for (const k in HUE) if (w.endsWith(k) && k.length > bestLen) { base = HUE[k]; bestLen = k.length; }
  }
  base = base || material;
  if (!base) return '#9AA0A6';
  if (words.some(w => ['light', 'icy', 'ice', 'pale'].includes(w))) base = _mix(base, .34);
  if (words.some(w => ['deep', 'dark', 'midnight', 'jet', 'obsidian', 'storm'].includes(w))) base = _mix(base, -.3);
  return base;
}

const CIMG = (typeof COLORIMG !== 'undefined' && COLORIMG) || {};
const slugOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const colorPhoto = (p, c) => (c && CIMG[p.id] && CIMG[p.id][slugOf(c)]) || null;
// A label every row carries tells the buyer nothing. The SIM build is worth stating only
// where there is one to choose - where this product is actually sold here in both builds,
// which in practice is Apple, Pixel and the occasional Samsung. Everything else is a tray
// phone from every shop that stocks it, and a "Nano-SIM" on all of its rows is noise.
const simChoice = p => { const a = offersFor(p);
  return a.some(o => o.esim === true) && a.some(o => o.esim === false); };
// 'main' is a copy of one of the colours under a different filename, so it would show twice
// A card crossfades a product's colour photos, which only reads as one product turning around
// if every frame is the same shape. A photo shot in the other orientation keeps its place on
// the product page and loses only its turn here. See tools/pageonly.py.
const SKIPCYC = (typeof PAGEONLY !== 'undefined' && PAGEONLY) || {};
// The cycle runs inside a card, so it takes the 600 px copies. The product page keeps CIMG.
const CTHUMB = (typeof COLORTHUMB !== 'undefined' && COLORTHUMB) || {};
const cycList = id => {
  const seen = new Set();
  return Object.entries(CIMG[id] || {})
    .filter(([k]) => k !== 'main' && !(SKIPCYC[id] || []).includes(k))
    .map(([k, v]) => [k, (CTHUMB[id] && CTHUMB[id][k]) || v])
    .filter(([, u]) => seen.has(u) ? false : (seen.add(u), true));
};
// A card's colour photos used to swap on their own - eight swaps in ten seconds across a grid -
// and crossfade two transparent cutouts, so for a moment both phones showed at once. Now the
// photo changes only when asked, from a row of colour dots, and the old one fades out before
// the new one fades in.
const CDOTS_MAX = 5;
function cdotsHTML(p) {
  const list = cycList(p.id);
  if (list.length < 2) return '';
  const names = new Map((p.colors || []).map(c => [slugOf(c), c]));
  const nm = k => names.get(k) || k.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `<div class="cdots" role="group" aria-label="${esc(t('sec.colors'))}">${list.slice(0, CDOTS_MAX).map(([k, u]) =>
    `<button type="button" class="cdot" data-cdot="${esc(u)}" data-cname="${esc(nm(k))}" style="--c:${swatch(nm(k))}" aria-label="${esc(nm(k))}" aria-pressed="false"></button>`).join('')}${
    list.length > CDOTS_MAX ? `<span class="cmore">+${list.length - CDOTS_MAX}</span>` : ''}</div>`;
}
function cardShow(btn) {
  const shot = btn.closest('.pshot'), img = shot && shot.querySelector('.pimg');
  if (!img || img.dataset.cur === btn.dataset.cdot) return;
  img.dataset.cur = btn.dataset.cdot;
  shot.querySelectorAll('.cdot').forEach(b => b.setAttribute('aria-pressed', b === btn));
  const card = btn.closest('.pcard'), name = card && card.querySelector('h3 a');
  const want = btn.dataset.cdot, pre = new Image();
  pre.src = want;
  img.classList.add('out');
  const swap = () => { if (img.dataset.cur !== want) return;
    img.src = want; img.alt = (name ? name.textContent + ' — ' : '') + btn.dataset.cname; img.classList.remove('out'); };
  const ready = pre.decode ? pre.decode().catch(() => {}) : Promise.resolve();
  Promise.all([ready, new Promise(r => setTimeout(r, 110))]).then(swap);
}
document.addEventListener('pointerover', e => { const b = e.target.closest && e.target.closest('.cdot'); if (b) cardShow(b); });
document.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('cdot')) cardShow(e.target); });

let SEL = { id: null, color: null, storage: null, ram: null, esim: null, size: null, band: null };
function initSel(p) {
  if (SEL.id === p.id) return;
  const offs = offersFor(p);
  // start on whatever the cheapest real offer actually is
  const both = offs.some(o => o.esim === true) && offs.some(o => o.esim === false);
  SEL = {
    id: p.id,
    esim: both ? false : null,
    color: (p.colors || []).find(c => sold(p, 'color', c)) || (p.colors || [])[0] || null,
    storage: (offs.find(o => o.storage != null) || {}).storage ?? (p.variants[0] || {}).storage ?? null,
    ram: null,
    // A MacBook Air M5 is one product in two screens. Start on the screen somebody is actually
    // selling, falling back to the first the catalogue lists.
    size: (offs.find(o => o.size != null) || {}).size ?? (p.variants.find(v => v.size != null) || {}).size ?? null,
    // An Ultra with a Milanese Loop is the same watch and 50,000 dearer, so the band is a choice
    // on one page rather than three products that differ by a strap.
    band: (p.variants.find(v => v.band) || {}).band ?? null
  };
  // RAM and storage are sold as a pair, so start on a combination that exists - and within the
  // chosen screen, because the 15 is not sold in every configuration the 13 is.
  const pool = SEL.size != null ? p.variants.filter(v => v.size === SEL.size) : p.variants;
  const v0 = pool.find(v => v.storage === SEL.storage) || pool[0] || p.variants[0];
  if (v0) { SEL.storage = v0.storage ?? SEL.storage; SEL.ram = v0.ram; } else SEL.ram = null;
  // Everything above picks a combination the CATALOGUE lists, which is not the same as one anybody
  // here sells. A MacBook Air M4 13-inch/16GB/512GB is a real Apple machine that no Armenian shop
  // stocks, and the page opened on it: a list price, and not one offer under it. If the opening
  // choice shows nothing, move it onto the cheapest offer that does exist - which is what the
  // comment at the top of this function always claimed it did.
  if (offs.length && !visibleOffers(p).length) {
    const o = offs[0];                                    // offersFor is sorted cheapest first
    if (o.size != null) SEL.size = o.size;
    const caps = (p.variants || []).map(v => v.storage).filter(v => v != null);
    // A shop that states no capacity is quoting the base model, the same reading visibleOffers uses
    SEL.storage = o.storage ?? (caps.length ? Math.min(...caps) : SEL.storage);
    const vm = (p.variants || []).find(v => v.storage === SEL.storage
      && (SEL.size == null || v.size == null || v.size === SEL.size));
    SEL.ram = o.ram ?? (vm ? vm.ram : null);
  }
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
  // Strict, unlike RAM: a 14-inch and a 16-inch are different machines at different prices, so the
  // button shows that screen's offers and nothing else - otherwise both buttons quote one number.
  // Only where the product really is sold in more than one screen, though: on a single-screen
  // laptop there is nothing to choose, and dropping an offer that merely never stated its size
  // would throw away a real price for no gain.
  const screens = new Set((p.variants || []).map(v => v.size).filter(v => v != null));
  if (SEL.size != null) {
    o = screens.size > 1 ? o.filter(v => v.size === SEL.size)
                         : o.filter(v => v.size == null || v.size === SEL.size);
  }
  if (SEL.band) o = o.filter(v => !v.band || v.band === SEL.band);
  // strict: an offer whose SIM build the shop never stated is not evidence for either button.
  // Treating "not stated" as "tray" put Pixel's 559 000 under Nano-SIM, below the 625 000 eSIM.
  if (SEL.esim != null) o = o.filter(v => v.esim === SEL.esim);
  // One shop listing the same phone in four colours at one price is one offer to a reader, not
  // four. The row shows shop, capacity, SIM build and price - never the colour, because there is
  // deliberately no colour picker here - so four identical-looking rows were four ways of saying
  // the same sentence. Collapse on what the row actually displays. This also fixes the shop count
  // and the price rail, which were counting colours as competing offers.
  // The url was in this key, and the url is the one thing the row does NOT display: Notebook
  // Centre gives each colour its own page, so three colours at one price were three different
  // keys and all three survived a filter written to remove exactly them. Key on what a reader
  // can see. The first survivor wins, which is the shop's own first colour.
  const seen = new Set();
  return o.filter(v => {
    const k = [v.shop, v.price, v.storage ?? '', v.ram ?? '', v.esim === true ? 'e' : v.esim === false ? 'n' : '?'].join('|');
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
// One row per shop: its cheapest offer for the configuration picked. The same shop listing a
// build twice (a colour with its own page, a SIM build the row does not show) used to take two of
// the five places at the top of the list, and two "Best price" labels.
const perShop = offs => { const seen = new Set(); return offs.filter(o => seen.has(o.shop) ? false : (seen.add(o.shop), true)); };
// The spread between shops, drawn to scale. Shops whose prices sit closer than a dot can be told
// apart merge into one marker with a count; hover or focus it to read which shops and what price.
// The two ends are named, because "354 000 - 439 000" alone does not say where to go.
function railHTML(rows) {
  if (rows.length < 2) return '';
  const lo = rows[0].price, hi = rows[rows.length - 1].price;
  if (hi === lo) return '';
  const pos = v => (v - lo) / (hi - lo) * 100;
  const groups = [];
  for (const o of rows) {
    const g = groups[groups.length - 1];
    if (g && pos(o.price) - pos(g[g.length - 1].price) < 7) g.push(o); else groups.push([o]);
  }
  const dots = groups.map((g, i) => {
    const at = i === 0 ? 0 : i === groups.length - 1 ? 100 : pos((g[0].price + g[g.length - 1].price) / 2);
    // 25/75, not 18/82: a centred label on a dot at 80% ran 2px past a 280px screen
    const side = at < 25 ? ' l' : at > 75 ? ' r' : '';
    const list = g.map(o => `${shopName(o.shop)} · ${money(o.price)} ֏`);
    return `<button type="button" class="rd${g.length > 1 ? ' cl' : ''}${i === 0 ? ' best' : ''}${i === groups.length - 1 ? ' top' : ''}${side}"
      style="left:${at.toFixed(1)}%" aria-label="${esc(list.join(', '))}">${g.length > 1 ? `<span class="rc">×${g.length}</span>` : ''}<span class="rt">${list.map(esc).join('<br>')}</span></button>`;
  }).join('');
  return `<div class="rail2"><span class="ln"></span>${dots}</div>
    <div class="ends2"><span><b class="num">${money(lo)} ֏</b>${esc(shopName(rows[0].shop))}</span>
      <span><b class="num">${money(hi)} ֏</b>${esc(shopName(rows[rows.length - 1].shop))}</span></div>`;
}

// COMPARE_WITH comes from tools/pairs.mjs at build time: id -> [[otherId, role], ...]
const CW_ROLE = { newer: 'cwNewer', older: 'cwOlder', stronger: 'cwStronger', alternative: 'cwAlt', cheaper: 'cwCheaper', stepup: 'cwStepup', bigger: 'cwBigger', smaller: 'cwSmaller' };
function compareWithHTML(p) {
  const pairs = (COMPARE_WITH[p.id] || []).filter(([id]) => byId(id));
  if (!pairs.length) return '';
  const card = ([id, role]) => {
    const q = byId(id), lo = hasReal(q) ? bestOf(q) : null, d = lo != null && hasReal(p) ? lo - bestOf(p) : null;
    return `<a class="cw" href="#/compare" data-cw="${esc(p.id)}|${esc(id)}">
      <img src="${esc(THUMB(id))}" alt="${esc(fullName(q))}" width="64" height="64" decoding="async">
      <span class="cwt"><em>${esc(x(CW_ROLE[role]))}</em><b>${esc(fullName(q))}</b>${lo != null ? `<span class="num">${money(lo)} ֏</span>` : ''}${d ? `<span class="cwd num ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${money(Math.abs(d))} ֏</span>` : ''}</span></a>`;
  };
  return `<section class="cwith"><h3>${esc(x('cwTitle'))}</h3><div class="cwrow">${pairs.map(card).join('')}</div></section>`;
}
// No marketing sentence under the title: the owner wants the page to be the product, its
// configurations and its prices.
function detailView(p) {
  initSel(p);
  loadLazy();
  const L = st.lang;
  const offs = visibleOffers(p);
  const lo = offs.length ? offs[0].price : null;
  // ...and within the chosen screen: an M5 Max's two variants differ ONLY by size, so ignoring it
  // here always found the 14-inch and quoted its list price on the 16-inch page.
  const variant = p.variants.find(v => v.storage === SEL.storage && v.ram === SEL.ram
      && (SEL.size == null || v.size == null || v.size === SEL.size))
    || p.variants.find(v => v.storage === SEL.storage && v.ram === SEL.ram) || p.variants[0] || {};
  const shownPrice = lo ?? variant.priceAmd ?? p.priceAmd;
  const rows = perShop(offs);
  // what "best price" is the best price OF, said next to it: the size, and the SIM build when chosen
  const multi = new Set((p.variants || []).map(v => v.storage).filter(v => v != null)).size > 1;
  const cfgLbl = [multi && SEL.storage != null ? gb(SEL.storage, p.variantUnit) : '', simLbl(SEL.esim)].filter(Boolean).join(' · ');
  // The chart's verdict, repeated where the decision is made. Only once the history has loaded
  // and only for the size picked - the chart's own series, so the two never disagree.
  const hs = histSeries(p, SEL.storage);
  let verdict = '';
  if (hs.length > 1 && lo != null && hs[hs.length - 1].v === lo) {
    const low = Math.min(...hs.map(v => v.v)), pct = (lo - low) / low * 100;
    verdict = lo <= low ? `<span class="hp good">${esc(x('histLow').replace('{d}', dmy(hs[0].d).slice(0, 5)))}</span>`
      : `<span class="hp warn">${esc(x('histAbove').replace('{p}', pct < 10 ? pct.toFixed(1) : Math.round(pct)))}</span>`;
  }
  // Every finish the maker lists. The picture follows the choice where a colour has its own
  // photo; where it does not, the main shot stays and the swatch still answers the real
  // question - whether anyone in Armenia sells it. Crossed through when nobody does.
  const cols = p.colors || [];
  const shot = colorPhoto(p, SEL.color) || IMG(p.id);
  // earbuds have one SKU and no capacity to pick, so both lists come back empty and the
  // option blocks below simply do not render
  // SIM is a fact, not a choice - no shop prices a phone by its SIM tray - so these are spans,
  // not buttons. It still belongs beside the capacity: an Armenian carrier hands you a physical
  // SIM over the counter, and a phone with no tray for it is a wasted trip. Struck through here
  // means "this phone does not have it", the same thing it means one row down.
  // Negated clauses are cut first, or "no eSIM in most markets" reads as eSIM support.
  // SIM appears ONLY when a shop sells both builds and charges differently for them - the
  // iPhone 17 and 18 Pro families, where the tray costs 80,000 more. A phone that comes one way
  // has nothing to choose, and a row of chips you cannot act on is noise; the spec table below
  // already says which SIMs it takes.
  const simAll = offersFor(p);
  const simPick = /nano/.test(((p.connectivity || {}).sim || '').toLowerCase())
    && /esim/.test(((p.connectivity || {}).sim || '').toLowerCase())
    && simAll.some(o => o.esim === true) && simAll.some(o => o.esim === false);
  const simOpts = simPick ? [['Nano-SIM', false], ['eSIM', true]] : [];
  const sizes = [...new Set(p.variants.map(v => v.size))].filter(v => v != null).sort((a, b) => a - b);
  const bands = [...new Set(p.variants.map(v => v.band))].filter(Boolean);
  const vPool = SEL.size != null && sizes.length ? p.variants.filter(v => v.size === SEL.size) : p.variants;
  const rams = [...new Set(vPool.map(v => v.ram))].filter(v => v != null);
  const stors = [...new Set(vPool.map(v => v.storage))].filter(v => v != null);
  const inC = st.cmp.includes(p.id);

  const specs = GROUPS.map(([g, rows]) => {
    const body = rows.map(([k, get]) => {
      const v = specVal(get, p), bad = v == null;
      const key = k === 'f.storage' ? storageLabel(p) : k;
      const q = unsureRow(p, k) ? ` <abbr class="unsure" title="${esc(x('unsureTip'))}">${esc(x('unsureMark'))}</abbr>` : '';
      return bad ? '' : `<div class="kv"><dt>${esc(t(key))}</dt><dd>${esc(tr(v, st.lang))}${q}</dd></div>`;
    }).join('');
    return body ? `<section class="panel-c"><h3><i></i>${esc(t(g))}</h3><dl>${body}</dl></section>` : '';
  }).join('');

  return `<div class="shell">
    <div class="navrow">${backLink('#/', t('nav.catalog'))}
      <nav class="crumb"><span>${esc(p.brand)}</span><span>›</span><span>${esc(p.name)}</span></nav></div>

    <div class="pstage">
      <div class="pmeta">
        <span>${esc(p.brand)} / ${esc(X[L].tier[p.tier] || p.tier)}${isNew(p) ? ' / ' + esc(x('newBadge')) : ''}</span>
        <span>${offs.length ? esc(nx(shopCount(offs), 'shops')) + ' · ' + esc(updatedOn()) : esc(x('estimated'))}</span>
      </div>
      <h1 class="pname">${esc(fullName(p))}</h1>
      <div class="pgrid">
        <div class="pshotwrap"><img src="${esc(shot)}" alt="${esc(fullName(p))}" id="hpShot" fetchpriority="high"></div>
        <div class="pside">
          <!-- No colour picker. Shops spell one finish eight different ways - Titanium Silverblue,
               Titanium Silver Blue, Silver Blue Titanium - so the row filled with near-duplicate
               chips that all led to the same phone. Capacity is the choice that moves the price. -->

          ${bands.length > 1 ? `<div class="og"><label>${esc(t('f.band'))}</label>
            <div class="bs">${bands.map(bv => `<button data-band="${esc(bv)}" class="${bv === SEL.band ? 'on' : ''}${sold(p, 'band', bv) ? '' : ' na'}"${sold(p, 'band', bv) ? '' : ` title="${esc(x('notSold'))}"`} aria-pressed="${bv === SEL.band}">${esc(bv)}</button>`).join('')}</div></div>` : ''}
          ${sizes.length > 1 ? `<div class="og"><label>${esc(t('f.screen'))}</label>
            <div class="bs">${sizes.map(sv => `<button data-size="${sv}" class="${sv === SEL.size ? 'on' : ''}${sold(p, 'size', sv) ? '' : ' na'}"${sold(p, 'size', sv) ? '' : ` title="${esc(x('notSold'))}"`} aria-pressed="${sv === SEL.size}">${esc(inch(sv))}</button>`).join('')}</div></div>` : ''}
          ${rams.length > 1 ? `<div class="og"><label>${esc(t('f.ram'))}</label>
            <div class="bs">${rams.map(r => `<button data-ram="${r}" class="${r === SEL.ram ? 'on' : ''}${sold(p, 'ram', r) ? '' : ' na'}"${sold(p, 'ram', r) ? '' : ` title="${esc(x('notSold'))}"`} aria-pressed="${r === SEL.ram}">${r} ${esc(u('gb'))}</button>`).join('')}</div></div>` : ''}
          ${cols.length > 1 ? `<div class="og"><label>${esc(t('sec.colors'))}<b id="colName">${esc(SEL.color || cols[0])}</b></label>
            <div class="cs">${cols.map(c => `<button data-color="${esc(c)}" style="--c:${swatch(c)}" title="${esc(c)}${sold(p, 'color', c) ? '' : ' — ' + esc(x('notSold'))}"
              class="${c === SEL.color ? 'on' : ''}${sold(p, 'color', c) ? '' : ' na'}" aria-pressed="${c === SEL.color}" aria-label="${esc(c)}"></button>`).join('')}</div></div>` : ''}
          ${stors.length > 1 ? `<div class="og"><label>${esc(t(storageLabel(p)))}</label>
            <div class="bs">${stors.map(sv => `<button data-storage="${sv}" class="${sv === SEL.storage ? 'on' : ''}${sold(p, 'storage', sv) ? '' : ' na'}"${sold(p, 'storage', sv) ? '' : ` title="${esc(x('notSold'))}"`} aria-pressed="${sv === SEL.storage}">${esc(gb(sv, p.variantUnit))}</button>`).join('')}</div></div>` : ''}
          ${simOpts.length ? `<div class="og"><label>${esc(t('f.sim'))}</label>
            <div class="bs">${simOpts.map(([n, want]) =>
              `<button data-esim="${want ? 1 : 0}" class="${SEL.esim === want ? 'on' : ''}" aria-pressed="${SEL.esim === want}">${n}</button>`).join('')}</div></div>` : ''}
          <div class="pprice2">
            <span class="lb">${offs.length ? esc(x('bestPrice')) : esc(x('estimated'))}${offs.length && cfgLbl ? ' · ' + esc(cfgLbl) : ''}</span>
            <div class="pp-row"><b class="num">${money(shownPrice)} ֏</b>${rows.length ? `<span class="pp-at">${esc(x('atShop').replace('{shop}', shopName(rows[0].shop)))}</span>` : ''}</div>
            ${rows.length > 1 || verdict ? `<div class="pp-pills">${rows.length > 1 && rows[rows.length - 1].price > lo
              ? `<span class="hp good">${esc(x('lessDearest').replace('{n}', money(rows[rows.length - 1].price - lo)))}</span>` : ''}${verdict}</div>` : ''}
            ${rows.length ? `<div class="shopn">${esc(nx(rows.length, 'shops'))}</div>` : ''}
            ${railHTML(rows)}
          </div>
          <div class="pcta">
            ${offs.length ? `<a class="btn" href="#/offers/${esc(p.id)}">${esc(x('checkPrices'))}</a>` : ''}
            <button class="btn${offs.length ? ' ghost' : ''}" data-cmp-btn="${esc(p.id)}">${esc(inC ? t('detail.in_compare') : t('detail.add_compare'))}</button>
          </div>
        </div>
        ${compareWithHTML(p)}
        ${offs.length ? `<div class="pbar"><b class="num">${money(lo)} ֏</b><span>${esc(shopName(offs[0].shop))}</span>
          <a href="#/offers/${esc(p.id)}">${esc(x('checkPrices'))} →</a></div>` : ''}
      </div>
    </div>

    ${!rows.length ? '' : `<h2 class="sh" id="buy">${esc(x('offersTitle'))} <em>${rows.length}</em></h2>`}
    ${rows.length ? `<ol class="olist" id="offList">
      ${rows.map((o, i) => offerRow(o, lo, i, p.variantUnit, i >= OFFER_PEEK ? 'more' : '', p)).join('')}
    </ol>
    ${rows.length > OFFER_PEEK ? `<button class="expand" data-expand="offList" aria-expanded="false" aria-controls="offList">
      ${esc(x('showAll'))} <b class="num">${rows.length}</b></button>` : ''}
    ${offersFor(p).length > rows.length ? `<p class="allofflink"><a href="#/offers/${esc(p.id)}">${esc(x('allOffers'))} → <b class="num">${offersFor(p).length}</b></a></p>` : ''}`
      : ''}
    ${offs.length ? `<p class="note">${esc(x('priceSrc'))} · ${esc(x('updated'))} ${esc(updatedOn())}</p>` : ''}

    
    ${historyHTML(p)}

    <h2 class="sh">${esc(t('detail.full_specs'))}</h2>
    <div class="secgrid">${specs}</div>

  </div>`;
}


// Privacy and contact are the same shape: a heading and a few paragraphs from strings.json.
function docView(key, paras) {
  return `<div class="shell"><div class="navrow">${backLink('#/', t('nav.catalog'))}</div>
    <article class="doc"><h1>${esc(t(key + '.title'))}</h1>
    ${paras.map(p => `<p>${esc(t(key + '.' + p))}</p>`).join('')}
    ${key === 'contact' && !/_HERE$/.test(t('contact.email')) ? (() => {
      // The page invites people to write; it needs somewhere for them to write TO. An address
      // starting with http is a link, anything else is an email - so swapping one for the other
      // is a change to data/strings.json and nothing else.
      const c = t('contact.email'), web = /^https?:\/\//i.test(c);
      return `<p><a href="${esc(web ? safeHref(c) : 'mailto:' + c)}"${web ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(c.replace(/^https?:\/\//, ''))}</a></p>`;
    })() : ''}
    </article></div>`;
}

/* ================= construct: the same filters, asked as questions =================
   Every question is derived from the items in the chosen category, so a new category needs
   no code here. A question with only one possible answer is not asked - it is reported as a
   fact instead, because a question you cannot answer two ways is not a choice. */
const CQ = [
  ['ram',  'filter.ram',          p => (p.variants || []).map(v => v.ram),     v => v + ' ' + u('gb')],
  ['stor', 'filter.storage',      p => (p.variants || []).map(v => v.storage), v => gb(v, viewUnit())],
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
      // the same rule the filter bar follows: a category is only asked what it can answer
      if (!askable(key)) continue;
      const vals = [...new Set(pool.flatMap(get).filter(v => v != null && v > 0))].sort((a, b) => a - b);
      if (vals.length < 2) continue;
      questions += `<section class="cq"><h3>${esc(t(key === 'stor' && viewUnit() === 'mm' ? 'f.case_size' : lbl))}</h3><div class="cqrow">`
        + chip(key, 0, x('any'), !st[key])
        + vals.map(v => chip(key, v, x('min') + ' ' + fmt(v), String(st[key]) === String(v))).join('')
        + `</div></section>`;
    }
    const sizes = askable('scr') ? [...new Set(pool.map(p => p.display && p.display.size).filter(v => v != null))].sort((a, b) => a - b) : [];
    if (sizes.length > 1) {
      questions += `<section class="cq"><h3>${esc(t('filter.screen_size'))}</h3><div class="cqrow">`
        + chip('scrmin', 0, x('any'), !st.scrmin)
        + sizes.map(v => chip('scrmin', v, x('min') + ' ' + v + String.fromCharCode(8243), String(st.scrmin) === String(v))).join('')
        + `</div></section>`;
    }
    const touches = askable('touch') ? [...new Set(pool.map(p => p.display && p.display.touch).filter(v => v != null))] : [];
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
    // "Same across this category" is a claim about EVERY product in it, so every one has to state
    // the value. Counting only the products that said something announced "Touchscreen: Yes" over
    // 78 monitors on the strength of the 3 that are touchscreens - the 75 silent ones were dropped
    // from the count, and the only value left standing was the rare one.
    const one = (get, lbl, fmt) => {
      const all = pool.map(get), known = all.filter(x => x != null && x !== '');
      const v = [...new Set(known)];
      if (v.length === 1 && known.length === all.length) fixed.push(t(lbl) + ': ' + fmt(v[0]));
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

// When this price was last read off the shop's own page. The file carries one timestamp, which
// said every price was checked today - including the ones typed in by hand, which no crawl ever
// revisits, and which is how 23 of them rotted into 404s without anyone noticing. A row that was
// not read today says so, and one nobody can date says that instead of borrowing today's.
const seenTag = o => {
  // "not checked" is the wrong thing to say about a price a person read off the shelf at a shop
  // that will not print one. Ucom shows a build's price only after you have chosen the memory,
  // the RAM and the colour, so there is nothing on that page for a checker to read - and what CAN
  // be checked, that the link opens the product, tools/confirm-hand.mjs checks. A row that passes
  // gets no tag at all: the price is a person's, the link is verified, there is nothing to warn
  // about, and a badge saying "by hand" only invites the reader to distrust a good figure.
  if (!o.seen && o.pickOnSite) return '';
  if (!o.seen) return ` <i class="stale" title="${esc(x('handTip'))}">${esc(x('handSeen'))}</i>`;
  if (o.seen === (P.generated || '').slice(0, 10)) return '';
  const d = o.seen.slice(8, 10) + '.' + o.seen.slice(5, 7);
  return ` <i class="stale" title="${esc(x('seenTip'))}">${esc(d)}</i>`;
};

/* ================= all offers for one model ================= */
// The product page shows offers for the CHOSEN colour/capacity. This page shows every offer
// the shops list for the model, and lets you slice it by shop, capacity and colour.
let OSEL = { id: null, storage: '', ram: '', size: '', esim: '', color: '' };
// Arriving here from a product page you have already answered these questions - the capacity,
// the memory, the SIM build, the colour. Asking them again, with every chip back on "any", is
// the site forgetting what it was just told. So the first visit for a product inherits whatever
// the product page had selected; changing a chip here is still yours to change.
// ...but only for an axis this page actually shows a chip for. The product page filters softly
// on memory - an offer that never states its RAM is not evidence against the 12GB you picked -
// while this page filters strictly, and it only draws a group when there are two values to
// choose between. Inheriting SEL.ram = 12 onto a page with no memory chips left every offer
// filtered out by a control the reader could not see, let alone clear: the iPhone 17 Pro Max
// opened with nothing on it at all.
function initOSel(id, avail) {
  if (OSEL.id === id) return;
  const from = SEL.id === id ? SEL : null;
  const has = (k, v) => v !== '' && (avail[k] || []).some(a => String(a) === String(v));
  const take = (k, v) => has(k, v) ? String(v) : '';
  OSEL = { id,
    storage: take('storage', from && from.storage != null ? from.storage : ''),
    ram: take('ram', from && from.ram != null ? from.ram : ''),
    size: take('size', from && from.size != null ? from.size : ''),
    esim: take('esim', from && from.esim != null ? (from.esim ? 'e' : 'n') : ''),
    color: take('color', (from && from.color) || '') };
}

// AirPods Pro 3 ship in one configuration and one colour: there is no variant to state, so
// saying "variant not stated" reads as missing data rather than as the truth. Only ask the
// question of a product that actually has choices.
const hasChoices = p => {
  const v = (p && p.variants) || [];
  return new Set(v.map(z => z.storage)).size > 1 || new Set(v.map(z => z.ram)).size > 1
    || ((p && p.colors) || []).length > 1;
};
// One value across the whole product is not a choice, and writing it on every row just repeats
// the title: a MacBook Pro M5 Max is sold in one build, so all seven rows read "2 TB . 36 GB"
// and the column says nothing at all. An axis earns its place on the row only where the product
// really offers more than one of it. Counted over the variants AND the offers, because a shop
// sometimes lists a build the variant table never described - and one shop stating the RAM while
// the others stay silent is not a difference between them either.
const offerAxisVaries = (p, key) => {
  if (!p) return false;
  const vals = [...((p.variants || []).map(v => v[key])), ...(offersFor(p) || []).map(o => o[key])];
  return new Set(vals.filter(v => v != null)).size > 1;
};
function offerRow(o, lo, i, unit, cls, of, withColor) {
  // A row with no link was still an <a>, and safeHref turns a missing url into "#" - so it looked
  // clickable and clicking it threw you back to the front page. A price somebody read off a shelf
  // is worth showing; pretending it leads somewhere is not. No url, no link, and no arrow.
  const live = /^https?:\/\//i.test(String(o.url || ''));
  const best = o.price === lo ? ' best' : '';
  return `<li${cls ? ` class="${cls}"` : ''}>${live
      ? `<a class="orow${best}" href="${esc(safeHref(o.url))}" target="_blank" rel="noopener noreferrer">`
      : `<div class="orow nolink${best}">`}
    <span class="rk num">${String(i + 1).padStart(2, '0')}</span>
    <span class="sh">${esc(shopName(o.shop))}</span>
    <!-- Every axis the buyer is choosing between, in one order on every row: screen, capacity,
         memory, SIM build. A row that states only some of them is not tidier, it is ambiguous -
         two rows at different prices with nothing on them to say why. Anything the shop did not
         state is simply absent rather than guessed at. -->
    <span class="vr">${[
        o.size != null && offerAxisVaries(of, 'size') ? esc(inch(o.size)) : '',
        offerAxisVaries(of, 'storage') ? (o.storage ? esc(gb(o.storage, unit)) : (hasChoices(of) ? esc(x('variantUnknown')) : '')) : '',
        o.ram && offerAxisVaries(of, 'ram') ? esc(o.ram + ' ' + u('gb')) : '',
        // The product page shows one row per build and collapses the colours behind it; this
        // page shows every one of them, and without the colour written down two rows from the
        // same shop at the same price are indistinguishable - they read as the listing being
        // duplicated rather than as the two different phones they are.
        withColor && o.color && offerAxisVaries(of, 'color') ? `<i class="ocol"><b style="--c:${swatch(o.color)}"></b>${esc(o.color)}</i>` : '',
      ].filter(Boolean).join(' · ')}${!(of && simChoice(of)) ? ''
        : o.esim === true ? ' <i class="esim">eSIM</i>'
        : o.esim === false ? ' <i class="esim nano">Nano-SIM</i>' : ''}${o.checkColor || (!o.color && ((of && of.colors) || []).length > 1)
        ? ` <i class="chk" title="${esc(x('checkColorHint'))}">${esc(t('offer.check_color'))}</i>` : ''}${seenTag(o)}</span>
    <span class="pr num">${money(o.price)} ֏</span>
    <!-- No stock line. "In stock" was the shop's word for it on the day we read the page and
         "stock not known" said nothing at all, so the column was two thirds noise. What a reader
         is here for is the cheapest price and how much every other shop adds to it. -->
    <span class="od num">${o.price === lo ? esc(i === 0 ? x('bestPrice') : x('sameBest')) : '+' + money(o.price - lo) + ' ֏'}</span>
    ${live ? '<span class="ar" aria-hidden="true">→</span>' : '<span class="ar"></span>'}${live ? '</a>' : '</div>'}</li>`;
}

function offersView(p) {
  const all = offersFor(p);
  const stors = [...new Set(all.map(o => o.storage).filter(v => v != null))].sort((a, b) => a - b);
  const rams = [...new Set(all.map(o => o.ram).filter(v => v != null))].sort((a, b) => a - b);
  const sizes = [...new Set(all.map(o => o.size).filter(v => v != null))].sort((a, b) => a - b);
  // Three states, not two: a shop that never said which SIM build it sells is not evidence for
  // either, so '?' is its own choice rather than being folded into Nano-SIM.
  const sims = [...new Set(all.map(o => o.esim === true ? 'e' : o.esim === false ? 'n' : '?'))]
    .sort((a, b) => 'ne?'.indexOf(a) - 'ne?'.indexOf(b));
  // This page is where every colour a shop lists is visible, unlike the product page which shows
  // one row per build - so here the colour is worth choosing by. The list comes from the
  // CATALOGUE, not from the offers: the iPhone 17 Pro Max is sold in Cosmic Orange, Deep Blue and
  // Silver, and reading the offers instead also offered "Black" and "Blue" - one row each, both
  // pixel's own words for a phone Apple does not make in either. A filter is a promise that the
  // thing exists.
  const cols = (p.colors || []).filter(c => all.some(o => o.color === c));
  // a group is only drawn when there are two values to pick between, so that is also the test
  // for whether a choice carried over from the product page can be shown - and un-shown.
  const two = a => a.length > 1 ? a : [];
  const simVals = simChoice(p) ? sims : [];
  initOSel(p.id, { storage: two(stors), ram: two(rams), size: two(sizes), esim: two(simVals), color: two(cols) });
  // filtering is by what you are buying - capacity, memory, screen, SIM build - not by which shop
  const list = all.filter(o =>
    (!OSEL.storage || String(o.storage) === OSEL.storage) &&
    (!OSEL.ram || String(o.ram) === OSEL.ram) &&
    (!OSEL.size || String(o.size) === OSEL.size) &&
    (!OSEL.esim || (o.esim === true ? 'e' : o.esim === false ? 'n' : '?') === OSEL.esim) &&
    (!OSEL.color || String(o.color || '') === OSEL.color));
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
      <span class="t"><img src="${esc(colorPhoto(p, OSEL.color) || THUMB(p.id))}" alt="" loading="lazy"></span>
      <div>
        <h1>${esc(fullName(p))}</h1>
        <p class="ofsub">${esc(x('allOffers'))} · <b class="num">${all.length}</b> ${esc(plw(all.length, 'offersLbl'))} · <b class="num">${shopCount(all)}</b> ${esc(plw(shopCount(all), 'shops'))}</p>
      </div>
    </div>
    <div class="offilters">
      ${chips('storage', stors, t('f.storage'), gb)}
      ${chips('ram', rams, t('f.ram'), v => v + ' ' + u('gb'))}
      ${chips('size', sizes, t('f.screen'), inch)}
      ${chips('esim', simVals, t('f.sim'), v => v === 'e' ? 'eSIM' : v === 'n' ? 'Nano-SIM' : x('variantUnknown'))}
      ${cols.length < 2 ? '' : `<div class="ofg"><span class="ofl">${esc(t('f.color'))}</span>
        <button class="ofc${OSEL.color === '' ? ' on' : ''}" data-of="color" data-ofv="">${esc(x('any'))}</button>
        <span class="cs ofcs">${cols.map(c => `<button data-of="color" data-ofv="${esc(c)}" style="--c:${swatch(c)}"
          title="${esc(c)}" aria-label="${esc(c)}" aria-pressed="${OSEL.color === c}"
          class="${OSEL.color === c ? 'on' : ''}"></button>`).join('')}</span></div>`}
      <!-- the chip label is the shop's English word; the page is not -->
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
    ${list.length ? `<ol class="olist">${list.map((o, i) => offerRow(o, lo, i, p.variantUnit, '', p, true)).join('')}</ol>`
      : `<p class="empty" style="padding:30px 0"><b>${esc(x('noOffers'))}</b></p>`}
    <p class="note">${esc(x('priceSrc'))} · ${esc(x('updated'))} ${esc(updatedOn())}</p>
  </div>`;
}

/* ================= compare ================= */
// A mistyped or outdated product link used to fall through to the catalogue without a word.
function notFoundView() {
  const top = DATA.filter(hasReal).sort((a, b) => b.popularity - a.popularity).slice(0, 4);
  return `<div class="shell"><div class="empty nf">
    <h1 class="emptyh">${esc(x('nfT'))}</h1><p>${esc(x('nfS'))}</p>
    <a class="btn" href="#/">${esc(t('nav.catalog'))}</a></div>
    <div class="grid">${top.map(card).join('')}</div></div>`;
}
// the biggest sections, for a search that found nothing
const bigCats = () => {
  const n = {};
  for (const p of DATA) n[catOf(p)] = (n[catOf(p)] || 0) + 1;
  return Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 6);
};
function compareView() {
  const ps = st.cmp.map(byId).filter(Boolean);
  // It borrowed the catalogue's "try changing the filters" - a screen with no filters on it.
  // The button below already says what to do, so the wrong sentence just goes.
  if (!ps.length) return `<div class="shell"><div class="empty" style="margin-top:40px">
    <h1 class="emptyh">${esc(t('compare.empty'))}</h1>
    <a class="btn" href="#/">${esc(t('compare.add_phone'))}</a></div></div>`;
  const n = ps.length, canAdd = n < MAXCMP, slot = n === 1 ? 1 : 0;
  const cols = `200px repeat(${n + slot},minmax(0,1fr))`;

  let rows = '', nDiff = 0, nSame = 0;
  // Price first: it is what people compare before anything else, and the table never had it.
  // The cheapest shop and how many shops carry it, with the cheapest of the products marked.
  {
    const best = ps.map(p => offersFor(p).length ? bestOf(p) : null);
    const ok = best.filter(v => v != null), lo = ok.length > 1 ? Math.min(...ok) : null;
    rows += `<div class="grp">${esc(t('filter.price'))}</div><div class="k row-diff">${esc(x('bestPrice'))}</div>`
      + ps.map((p, i) => {
        const o = offersFor(p)[0];
        return `<div class="c cprice${best[i] != null && best[i] === lo && new Set(ok).size > 1 ? ' best' : ''}">${o
          ? `<b class="num">${amd(o.price)}</b><span>${esc(shopName(o.shop))} · ${esc(nx(shopCount(offersFor(p)), 'shops'))}</span>
            <a class="cpgo" href="#/offers/${esc(p.id)}">${esc(x('checkPrices'))}</a>`
          : '—'}</div>`;
      }).join('') + (slot ? '<div class="c"></div>' : '');
  }
  for (const [g, defs] of GROUPS) {
    rows += `<div class="grp">${esc(t(g))}</div>`;
    for (const [k, get, num, dir] of defs) {
      // tr(): the product page shows these in the reader's language, and the same row here was English
      const vals = ps.map(p => { const v = specVal(get, p); return v == null ? '—' : tr(String(v), st.lang); });
      if (vals.every(v => v === '—')) continue;
      const same = vals.every(v => v === vals[0]);
      same ? nSame++ : nDiff++;
      const cls = same ? 'row-same' : '';
      let bi = -1;
      if (num && dir && n > 1) {
        const nv = ps.map(p => { try { return num(p); } catch (e) { return null; } });
        const ok = nv.filter(v => typeof v === 'number' && isFinite(v));
        if (ok.length > 1 && new Set(ok).size > 1) bi = nv.indexOf(dir > 0 ? Math.max(...ok) : Math.min(...ok));
      }
      // Only weakness is marked - fewer mAh, fewer pixels, less memory. Everything else keeps the
      // default colour, including a difference with no better side (iOS against Android) and a
      // value that is simply missing.
      // The owner asked for exactly that: a green "best" beside every red one was noise.
      const mark = i => !same && bi >= 0 && vals[i] !== '—' && vals[i] !== vals[bi] ? ' worse' : '';
      rows += `<div class="k ${same ? 'row-same' : 'row-diff'}">${esc(t(k))}</div>` +
        vals.map((v, i) => `<div class="c ${cls}${mark(i)}">${esc(v)}</div>`).join('') +
        (slot ? `<div class="c ${cls}"></div>` : '');
    }
  }
  return `<div class="shell">
    <div class="navrow">${backLink('#/', t('nav.catalog'))}</div>
    <div class="cbar">
      <div class="cbar-l"><h1 class="sh" style="margin:0">${esc(t('compare.title'))}</h1>
        <span class="dcount"><i></i>${nDiff} ${esc(x('diffs'))}</span>
        <span class="scount">${nSame} ${esc(x('same'))}</span></div>
      <div class="cbar-r">
        <label class="sw"><input type="checkbox" id="diffonly"><span class="tr"></span>${esc(t('compare.diff_only'))}</label>
        ${canAdd ? `<button class="btn ghost sm addbtn" data-act="openadd">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>${esc(addLabel(ps[0]))}</button>` : ''}
        <button class="btn ghost sm" data-act="clearcmp">${esc(t('compare.clear'))}</button></div>
    </div>
    <div class="cwrap" id="cwrap" style="--cols:${cols};--n:${n}">
      <div class="cphotos"><div class="pad"></div>
        ${ps.map(p => `<div class="c"><a href="#/p/${esc(p.id)}" tabindex="-1" aria-hidden="true"><img src="${esc(THUMB(p.id))}" alt="" decoding="async"></a>
          <button class="x" data-cmp="${esc(p.id)}" aria-label="${esc(t('compare.clear'))}: ${esc(fullName(p))}">×</button></div>`).join('')}
        ${slot ? `<div class="c"><button class="addslot" data-act="openadd" aria-label="${esc(addLabel(ps[0]))}">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button></div>` : ''}
      </div>
      <div class="chead"><div class="pad"></div>
        ${ps.map(p => `<div class="ccol"><a class="cname" href="#/p/${esc(p.id)}">${esc(fullName(p))}</a></div>`).join('')}
        ${slot ? `<div class="ccol"><b class="addlbl">${esc(addLabel(ps[0]))}</b></div>` : ''}
      </div>
      <div class="ctable">${rows}</div>
    </div>
    <div class="cmodal" id="cmodal" hidden>
      <div class="cmbox" role="dialog" aria-modal="true" aria-label="${esc(t('detail.add_compare'))}">
        <button class="cmx" data-act="closeadd" aria-label="${esc(t('compare.clear'))}">×</button>
        <h2>${esc(t('detail.add_compare'))}</h2>
        <input id="cmq" type="search" autocomplete="off" placeholder="${esc(t('nav.search_placeholder'))}"
          aria-label="${esc(t('nav.search_placeholder'))}">
        <div id="cmres" class="cmres"></div>
        <div class="cmnow"><span class="cmlbl">${esc(t('compare.in_list'))}</span>
          ${ps.map(p => `<div class="cmrow">
            <img src="${esc(THUMB(p.id))}" alt="" loading="lazy">
            <span><b>${esc(fullName(p))}</b><i>${amd(bestOf(p))}</i></span>
            <button class="x" data-cmp="${esc(p.id)}" aria-label="${esc(t('compare.clear'))}: ${esc(fullName(p))}">×</button>
          </div>`).join('')}
        </div>
      </div>
    </div></div>`;
}

// The button says what it will add, because "Add phone" on a headphone comparison is wrong.
const addLabel = p => t('compare.add_x').replace('{x}', (X[st.lang].cats || {})[catOf(p)] || '');

// The picker only offers what can actually join this table: same product type, not already in
// it. A query is optional - with the field empty it shows the most popular candidates.
function cmpCandidates(q) {
  const cur = st.cmp.map(byId).filter(Boolean);
  const cat = cur.length ? catOf(cur[0]) : null;
  // same haystack the catalogue search uses, so typing here behaves like typing up there
  const n = (q || '').trim().toLowerCase();
  return DATA
    .filter(p => hasReal(p) && !st.cmp.includes(p.id) && (!cat || catOf(p) === cat))
    .filter(p => !n || (p.brand + ' ' + fullName(p)).toLowerCase().includes(n))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 8);
}
function paintCmpRes() {
  const box = $('#cmres'); if (!box) return;
  const list = cmpCandidates($('#cmq') ? $('#cmq').value : '');
  box.innerHTML = list.length ? list.map(p => `<button class="cmrow" data-add="${esc(p.id)}">
      <img src="${esc(THUMB(p.id))}" alt="" loading="lazy">
      <span><b>${esc(fullName(p))}</b><i>${amd(bestOf(p))}</i></span>
    </button>`).join('') : `<p class="cmnone">${esc(x('emptyT'))}</p>`;
}

/* ================= router ================= */
// The query belongs to the results page. Coming home - the wordmark, a category, or the back
// button - left the word sitting in the box AND still filtering the grid underneath it, so the
// front page silently showed a search you thought you had left. A product page keeps it, so
// going back from a product to the results still has the results. Typing is unaffected: it
// repaints the grid through refresh() and never reaches render().
const keepsQuery = route => !(route === '' || route === '/' || route.startsWith('/c/'));
let painted = false;
function render(keepScroll) {
  document.documentElement.classList.remove('fs-open');   // a route change never leaves the sheet up
  const raw = location.hash.replace(/^#/, '');
  // #buy / #results / #main are in-page anchors, not routes. They used to fall through to
  // the catalogue, throwing you off the product page you were reading.
  if (raw && raw[0] !== '/') {
    const el = document.getElementById(raw);
    // Focus first: a skip link that only scrolls leaves the keyboard where it was, which is the
    // one thing the link exists to fix.
    if (el && $('#main').innerHTML) { el.focus({ preventScroll: true }); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  }
  // Tapping a suggestion opened the product underneath and left the list of suggestions sitting
  // on top of it. The outside-click rule cannot close it: a suggestion is a link INSIDE .srch, and
  // that rule exists precisely to leave the search box alone while it is being used. Arriving
  // somewhere is what ends a search, so the list closes on any route change - which covers the
  // back button too. Typing never reaches here; it repaints through refresh().
  closeSuggest();
  if (!keepsQuery(raw) && st.q) { st.q = ''; save(); }
  paintChrome(); paintTray();
  // not on a re-render (keepScroll): one visit per route, not one per filter change
  if (!keepScroll) countView();
  const h = raw || '/';
  // #/c/phones (the tab links say #/c/phone) used to leave you on "0 results - try changing the
  // filters", with no tab marked current and no filter to change. A section nobody stocks is not
  // a section; show the whole catalogue instead of a dead end.
  const mc0 = h.startsWith('/c/') ? h.slice(3) : null;
  const mc = mc0 && DATA.some(p => catOf(p) === mc0) ? mc0 : (mc0 ? '' : null);
  // a category lives in the URL so it can be shared and the back button works
  const wasCat = st.cat;
  st.cat = mc !== null ? mc : (h === '/' ? '' : st.cat);
  if (st.cat !== wasCat) { pruneFilters(); if (!sortKeys().includes(st.sort)) st.sort = 'popular'; }
  // A product folded into another by tools/merge.mjs: an old link lands on the survivor.
  const was = h.match(/^\/(p|offers)\/(.+)$/);
  const into = was && !byId(was[2]) && typeof MERGED !== 'undefined' && MERGED[was[2]];
  if (into && byId(into)) { location.replace('#/' + was[1] + '/' + into); return; }
  const m = h.match(/^\/p\/(.+)$/);
  let mo, restoreY = null;
  const main = $('#main');
  if (m && byId(m[1])) { const y = window.scrollY; main.innerHTML = detailView(byId(m[1])); document.title = fullName(byId(m[1])) + ' — Better'; window.scrollTo(0, keepScroll ? y : 0); }
  else if ((mo = h.match(/^\/offers\/(.+)$/)) && byId(mo[1])) {
    const y = window.scrollY;
    main.innerHTML = offersView(byId(mo[1]));
    document.title = x('allOffers') + ' — ' + fullName(byId(mo[1]));
    window.scrollTo(0, keepScroll ? y : 0);   // filter chips must not throw you to the top
  }
  else if (m || h.startsWith('/offers/')) { main.innerHTML = notFoundView(); document.title = x('nfT') + ' — Better'; window.scrollTo(0, 0); }
  else if (h === '/privacy') { main.innerHTML = docView('privacy', ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']); document.title = t('privacy.title') + ' — Better'; window.scrollTo(0, 0); }
  else if (h === '/contact') { main.innerHTML = docView('contact', ['p1', 'p2']); document.title = t('contact.title') + ' — Better'; window.scrollTo(0, 0); }
  else if (h === '/construct') { main.innerHTML = constructView(); document.title = t('construct.title') + ' — Better'; window.scrollTo(0, keepScroll ? window.scrollY : 0); }
  else if (h === '/compare') { main.innerHTML = compareView(); document.title = t('compare.title') + ' — Better'; window.scrollTo(0, 0); }
  else if (h === '/search') {
    main.innerHTML = catalogView(); refresh();
    document.title = (st.q.trim() ? st.q.trim() + ' — ' : '') + t('nav.search_placeholder') + ' — Better';
    window.scrollTo(0, keepScroll ? window.scrollY : 0);
  }
  else {
    main.innerHTML = catalogView(); refresh();
    document.title = (st.cat ? ((X[st.lang].cats || {})[st.cat] || st.cat) + ' — ' : '') + 'Better';
    // Applied at the END of render, not here: the masthead hero is rebuilt below, and inserting
    // it after a scrollTo pushed the grid down by the hero's height - which is why coming back
    // to the front page landed ~1480px past where you left, while a category page was exact.
    restoreY = keepScroll ? window.scrollY : (remembers(h) ? (scrollMem.get(h) || 0) : 0);
  }
  // Only on a route CHANGE. On the first paint the browser has not moved anyone yet, and taking
  // focus into the grid put the first Tab on a card - past the skip link, the menu and the search.
  if (!keepScroll && painted) {
    const head = $('#main h1') || $('#main h2');
    if (head) { head.tabIndex = -1; head.focus({ preventScroll: true }); }
  }
  painted = true;
  const mh = $('#masthero');
  // the hero belongs to the front page only, not to a single category
  const home = !m && !mc && !['/construct', '/compare', '/privacy', '/contact', '/search'].includes(h) && !h.startsWith('/offers/');
  mh.hidden = !home;
  mh.innerHTML = home ? mastHero() : '';
  if (home) requestAnimationFrame(dealEdges);
  if (restoreY !== null) window.scrollTo(0, restoreY);
  paintHist();
  moneyFx();
}

/* ================= money animations ================= */
// Five of them, all pointed at the number people came here for. Each is gated on reduced motion
// by hand: the global CSS rule strips transforms and transitions, but these change text content
// or run on a timer, and no media query can undo that.
// Set when a capacity, RAM or colour button is clicked on a product page.
let fxFlashAll = false;

// Product page only. The animation answers "this number just changed because you changed the
// configuration", which is a question only this page asks - on a catalogue grid the same effect
// is 146 numbers twitching for no reason, and on first load it reads as the page still loading.
const PRICE_SEL = '.pprice2 .pp-row > b.num, .olist .orow .pr';

// Fires only after a capacity, RAM or colour button was pressed on a product page. Arriving at a
// page is not a change, so nothing animates on load; a grid of 146 cards twitching at once was
// noise, and a count-up on first paint just read as "still loading".
function moneyFx() {
  if (!fxFlashAll) return;
  fxFlashAll = false;
  for (const el of $$(PRICE_SEL)) {
    el.classList.remove('fx-flash'); void el.offsetWidth; el.classList.add('fx-flash');
    el.addEventListener('animationend', () => el.classList.remove('fx-flash'), { once: true });
  }
}

/* ================= events ================= */
document.addEventListener('click', e => {
  // The wordmark is the way home. Its href is already #/, but a hash that does not change fires
  // no hashchange, so from the front page - scrolled down, a search typed, a filter on - clicking
  // it did nothing at all. Home means the top of a clean catalogue, every time.
  if (e.target.closest('.logo')) {
    e.preventDefault();
    st.q = ''; st.brands = []; st.cat = '';
    for (const k of ['ram', 'stor', 'batt', 'hz', 'scrmin', 'touch']) st[k] = D[k];
    st.scrs = []; st.sort = D.sort;
    save();
    if (location.hash && location.hash !== '#/') location.hash = '#/'; else render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const anchor = e.target.closest('a[href^="#"]:not([href^="#/"])');
  if (anchor) {
    e.preventDefault();
    const target = document.getElementById(anchor.getAttribute('href').slice(1));
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // A skip link that only scrolls leaves the keyboard where it was, which is the one thing the
    // link exists to fix. #main carries tabindex="-1"; on #results and #savings this is a no-op.
    target?.focus({ preventScroll: true });
    return;
  }
  // The whole card opens the product. The chevron in its corner had always been decoration
  // (aria-hidden), so it looked like a button and did nothing when clicked.
  const cd = e.target.closest('.cdot');
  if (cd) { cardShow(cd); return; }
  const card = e.target.closest('.pcard');
  if (card && !e.target.closest('a,button')) {
    const link = card.querySelector('h3 a[href^="#/p/"]');
    if (link) { location.hash = link.getAttribute('href'); return; }
  }
  const act = e.target.closest('[data-act]');
  if (act && act.dataset.act === 'openadd') {
    const m = $('#cmodal');
    if (m) {
      addOpener = document.activeElement;
      m.hidden = false; paintCmpRes();
      // TWO frames between leaving display:none and adding the class - one is not enough for
      // the browser to have computed the starting style, and the fade is skipped.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        m.classList.add('on'); $('#cmq')?.focus();
      }));
    }
    return;
  }
  if (act && act.dataset.act === 'closeadd') { closeAdd(); return; }
  if (e.target.id === 'cmodal') { closeAdd(); return; }               // click the backdrop to close
  const add = e.target.closest('[data-add]');
  if (add) { if (toggleCmp(add.dataset.add)) { closeAdd(); render(true); } return; }
  const arr = e.target.closest('[data-dl]');
  if (arr) {
    const r = $('#dlrow'), c = r && r.querySelector('.dl');
    if (c) r.scrollBy({ left: +arr.dataset.dl * (c.getBoundingClientRect().width + 12) * 2,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
  const tg = e.target.closest('button[data-f]');
  if (tg) { const k = tg.dataset.f; st[k] = !st[k]; refresh(); return; }
  const ap = e.target.closest('[data-apply]');
  if (ap) { commitPanel(ap.closest('.fdrop'), ap.dataset.apply); return; }
  const cl = e.target.closest('[data-clear]');
  if (cl) {
    const pn = cl.closest('.fdrop');
    pn.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
    pn.querySelectorAll('input[type="radio"][value="0"]').forEach(i => i.checked = true);
    pn.querySelectorAll('input[data-f="pmin"]').forEach(i => i.value = PMIN);
    pn.querySelectorAll('input[data-f="pmax"]').forEach(i => i.value = PMAX);
    commitPanel(pn, cl.dataset.clear);
    return;
  }
  // construct page: category card, a question chip, a brand chip
  const cc = e.target.closest('[data-ccat]');
  // Straight to the products, filters open. This used to step into a questionnaire - screen size,
  // then brand, then a "Show 78" button - so choosing a section showed nothing until three more
  // decisions were made. The owner wants the whole section at once, with the filters already out
  // for whoever does want to narrow it.
  if (cc) { st.cat = cc.dataset.ccat; Object.assign(st, { q: '', scrmin: 0, touch: 0, brands: [], ram: 0, stor: 0, batt: 0, hz: 0, scrs: [], g5: false, nfc: false, page: 1 });
    st.fopen = true; save(); location.hash = '#/c/' + st.cat; return; }
  const cq = e.target.closest('[data-cq]');
  if (cq) { const k = cq.dataset.cq, v = cq.dataset.cqv;
    if (k === 'scr') st.scrs = st.scrs.includes(v) ? st.scrs.filter(z => z !== v) : [...st.scrs, v];
    else st[k] = +v;
    save(); $('#main').innerHTML = constructView(); return; }
  const cbrand = e.target.closest('[data-cqb]');
  if (cbrand) { const b = cbrand.dataset.cqb;
    st.brands = st.brands.includes(b) ? st.brands.filter(z => z !== b) : st.brands.concat(b);
    save(); $('#main').innerHTML = constructView(); return; }
  const rm = e.target.closest('[data-rm]');
  if (rm) {
    const k = rm.dataset.rm;
    if (k === 'all') {
      Object.assign(st, { q: '', pmin: PMIN, pmax: PMAX });
      for (const kk in FILT) { const f = FILT[kk]; if (f.kind === 'set') st[f.arr] = []; else st[kk] = D[kk]; }
      if ($('#q')) $('#q').value = '';
      $$('.fdrop.dirty').forEach(d => d.classList.remove('dirty'));
    }
    else if (k === 'price') { st.pmin = PMIN; st.pmax = PMAX; }
    else if (k.includes(':')) {
      const i = k.indexOf(':'), f = FILT[k.slice(0, i)];
      if (f) st[f.arr] = (st[f.arr] || []).filter(v => v !== k.slice(i + 1));
    }
    else st[k] = D[k] ?? 0;
    if (location.hash === '#/construct') { save(); $('#main').innerHTML = constructView(); return; }
    // Let the chip collapse before the grid moves underneath it, so the reflow reads as caused
    // by the dismissal rather than as the page jumping. Reduced motion skips the wait entirely.
    const slow = k !== 'all' && rm.classList.contains('chip')
      && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (slow) { rm.classList.add('gone'); setTimeout(refresh, 240); } else refresh();
    return;
  }
  const clr = e.target.closest('[data-act="clearcmp"]');
  if (clr) { st.cmp = []; save(); paintTray(); render(); return; }
  const fav = e.target.closest('[data-cmp]');
  if (fav) {
    e.preventDefault();
    const id = fav.dataset.cmp, wasIn = st.cmp.includes(id);
    if (toggleCmp(id) && wasIn && location.hash === '#/compare') render();
    return;
  }
  const cw = e.target.closest('[data-cw]');
  if (cw) { st.cmp = cw.dataset.cw.split('|'); save(); return; }
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
  const pgb = e.target.closest('[data-page]');
  if (pgb && !pgb.disabled) {
    st.page = Math.max(1, +pgb.dataset.page || 1);
    save(); refresh();
    const top = $('#results');
    if (top) window.scrollTo({ top: top.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
    return;
  }
  if (e.target.closest('[data-fsheet]')) { openSheet(); return; }
  if (e.target.closest('[data-fsclose]')) { closeSheet(); return; }
  if (e.target.closest('[data-fsgo]')) {
    for (const pn of $$('.fdrop.dirty:not(.r)')) { Object.assign(st, panelDraft(pn, pn.dataset.drop)); pn.classList.remove('dirty'); }
    st.page = 1; closeSheet(); refresh(); return;
  }
  const fm = e.target.closest('[data-fmore]');
  if (fm) { st.fopen = !st.fopen; save(); render(true); return; }
  if (e.target.closest('#qgo') || e.target.closest('[data-sgall]')) { submitSearch(); return; }
  if (!e.target.closest('.srch')) closeSuggest();
  const ofc = e.target.closest('[data-of]');
  if (ofc) { OSEL[ofc.dataset.of] = ofc.dataset.ofv; render(true); return; }
  const opt = e.target.closest('[data-color],[data-storage],[data-ram],[data-esim],[data-size],[data-band]');
  if (opt) {
    fxFlashAll = true;   // every price on the page is about to answer a different question
    const ph = byId(SEL.id);
    if (opt.dataset.color !== undefined) SEL.color = opt.dataset.color;
    // second click on the chosen one clears it, so "either" is reachable without a third button
    if (opt.dataset.esim !== undefined) {
      const want = opt.dataset.esim === '1';
      SEL.esim = SEL.esim === want ? null : want;
    }
    // RAM and storage ship as a pair (Galaxy A26 is 6/128 or 8/256, never 8/128 here),
    // so picking one snaps the other to a combination that actually exists.
    if (opt.dataset.band !== undefined) SEL.band = opt.dataset.band;
    if (opt.dataset.size !== undefined) {
      SEL.size = +opt.dataset.size;
      const pool = ph ? ph.variants.filter(v => v.size === SEL.size) : [];
      if (pool.length && !pool.some(v => v.storage === SEL.storage && v.ram === SEL.ram)) {
        const v = pool.slice().sort((a, b) => (a.storage || 0) - (b.storage || 0))[0];
        if (v) { SEL.storage = v.storage; SEL.ram = v.ram; }
      }
    }
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
  if (!document.documentElement.classList.contains('fs-open'))
    $$('[data-drop][open]').forEach(o => { if (o !== d) o.open = false; });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'q') { e.preventDefault(); submitSearch(); return; }
  if (e.key !== 'Escape') return;
  closeSuggest();
  closeSheet();
  $$('[data-drop][open]').forEach(o => o.open = false);
  closeAdd();
});
document.addEventListener('change', e => {
  const el = e.target, f = el.dataset.f;
  if (el.id === 'diffonly') { $('#cwrap').classList.toggle('hide-same', el.checked); return; }
  if (!f) return;
  // Inside a filter panel nothing is decided until Apply. The panel marks itself changed so the
  // button can say so, and the range readout still tracks the handle, because a slider whose
  // number does not move while you drag it is broken whatever it does afterwards.
  const panel = el.closest && el.closest('.fdrop:not(.r)');
  if (panel && f !== 'sort') {
    panel.classList.add('dirty');
    if (f === 'pmin' || f === 'pmax') paintRange(panel);
    paintDraftCount(panel);
    return;
  }
  if (f === 'sort') { st.sort = el.value; el.closest('[data-drop]').open = false; }
  else if (FILT[f] && FILT[f].kind === 'set') {
    const a = FILT[f].arr;
    st[a] = el.checked ? [...new Set([...(st[a] || []), el.value])] : (st[a] || []).filter(v => v !== el.value);
  }
  else if (f === 'pmin') st.pmin = Math.min(+el.value, st.pmax);
  else if (f === 'pmax') st.pmax = Math.max(+el.value, st.pmin);
  else st[f] = +el.value;
  refresh();
});
// Suggestions under the box: the fastest route to ONE product, without leaving the page you
// are on. The full grid, with every filter, lives behind Enter or the search button.
const SUGG_MAX = 8;
function suggestFor(q) {
  if (!String(q || '').trim()) return [];
  const hit = DATA.filter(p => hayMatch(p, q));
  // A product whose name STARTS with what was typed is what the person meant; the rest follow.
  // Within each of those two groups, the best-known model wins: searching "playstation" should
  // put the Pro and the Slim above a dozen controllers and headsets, and it used to do the
  // opposite - cheapest first meant every accessory outranked the console it plugs into.
  const w = q.trim().toLowerCase();
  hit.sort((a, b) => (hay(b).startsWith(w) - hay(a).startsWith(w))
    || (b.popularity - a.popularity) || bestOf(a) - bestOf(b));
  return hit.slice(0, SUGG_MAX);
}
function paintSuggest() {
  const box = $('#sugg');
  if (!box) return;
  const list = suggestFor(st.q);
  const total = DATA.filter(p => hayMatch(p, st.q)).length;
  if (!list.length) {
    // where the results grid is on screen it already says so; say it once
    const said = !!$('#gridbox');
    box.innerHTML = st.q.trim() && !said ? `<p class="sg-none">${esc(x('emptyT'))}</p>` : '';
    box.hidden = !st.q.trim() || said;
    setExpanded(!box.hidden);
    return;
  }
  box.innerHTML = list.map(p => `<a class="sg-i" href="#/p/${esc(p.id)}">
      <img src="${esc(THUMB(p.id))}" alt="" loading="lazy" decoding="async">
      <span class="sg-n">${esc(fullName(p))}</span>
      <span class="sg-p num">${amd(bestOf(p))}</span></a>`).join('')
    + (total > list.length ? `<button class="sg-all" data-sgall="1">${esc(x('seeAll'))} (${total})</button>` : '');
  box.hidden = false;
  setExpanded(true);
}
function closeSuggest() { const b = $('#sugg'); if (b) { b.hidden = true; b.innerHTML = ''; } setExpanded(false); }
// the combobox has to SAY whether its list is open; it was announced closed the whole time
function setExpanded(v) { const q = $('#q'); if (q) q.setAttribute('aria-expanded', v ? 'true' : 'false'); }
// Enter, or the search button, is what opens the results page.
function submitSearch() {
  // Enter inside the 140 ms debounce left the timer armed, and it reopened the suggestions on top
  // of the results page it had just opened.
  clearTimeout(qT);
  closeSuggest();
  const el = $('#q');
  if (el) el.blur();
  save();
  if (location.hash !== '#/search') location.hash = '#/search'; else render();
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'q') {
    st.q = el.value;
    // A keystroke used to rebuild all 111 cards. Coalesce to one repaint per pause - short
    // enough that it still feels immediate, long enough that typing never redraws mid-word.
    clearTimeout(qT);
    qT = setTimeout(() => {
      // refresh() only repaints the catalogue grid, so from a product/offers/compare page a
      // query had nowhere to land. Go to the catalogue and let render() draw the results.
      // typing refines whatever list you are already looking at; it never navigates on its
      // own. Enter or the search button is what opens the results page.
      paintSuggest();
      if ($('#gridbox')) refresh();
    }, 140);
    return;
  }
  if (el.id === 'cmq') { paintCmpRes(); return; }
  if (el.dataset.fs) {
    const q = el.value.trim().toLowerCase();
    el.closest('.panel').querySelectorAll('.opt').forEach(o => { o.hidden = !!q && !o.textContent.toLowerCase().includes(q); });
    return;
  }
  if (el.dataset.f === 'pmin' || el.dataset.f === 'pmax') {
    const a = +$('[data-f="pmin"]').value, b = +$('[data-f="pmax"]').value;
    $('[data-rng="min"]').textContent = money(Math.min(a, b)) + ' ֏';
    $('[data-rng="max"]').textContent = money(Math.max(a, b)) + ' ֏';
  }
});

// Going back to the catalogue should land where you left it, not at the top. Product pages
// still open at the top - you clicked them to read them from the start.
// The browser restores its OWN remembered scroll on a history back, asynchronously and after
// our scrollTo has already run, so the two fought and the catalogue landed at neither position.
// Turning that off makes scrollMem the single source of truth.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const scrollMem = new Map();
const remembers = h => h === '/' || h.startsWith('/c/');
// Fade out, then hide: hiding first would cut the transition off before it ran. Under reduced
// motion the duration is the same but the transition is dropped, so it simply closes.
let addOpener = null;
function closeAdd() {
  const m = $('#cmodal'); if (!m || m.hidden) return;
  m.classList.remove('on');
  setTimeout(() => { m.hidden = true; }, 200);
  addOpener?.focus(); addOpener = null;   // put the keyboard back where it was
}
window.addEventListener('hashchange', e => {
  const from = new URL(e.oldURL).hash.replace(/^#/, '') || '/';
  if (remembers(from)) scrollMem.set(from, window.scrollY);
  const to = location.hash.replace(/^#/, '') || '/';
  // Leaving the comparison used to end it, so the Back button threw a comparison away. The picks
  // are not invisible state: the nav's Compare link carries their count. Only Clear all empties it.
  render(false);
});
render();
