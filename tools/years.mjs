// Launch year for the name tag on phones, tablets, watches, headphones and laptops, and screen size for
// TVs and monitors whose size was only in the model code.
//
//   node tools/years.mjs            what it would set
//   node tools/years.mjs --write
//
// `year` is the year the model was announced. Only models whose year is certain are listed; a
// product without one simply shows no tag. Where `released` (YYYY-MM) is known it wins.
import fs from 'node:fs';
const write = process.argv.includes('--write');
const ph = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const Y = {
  2016: [],
  2017: ['Bose SoundSport Free'],
  2018: ['JBL Tune 500 Wired'],
  2019: ['Samsung Galaxy Watch Active 2', 'Sennheiser HD 450BT'],
  2020: ['Beats Flex', 'Bose Sport', 'Samsung Galaxy Buds Live', 'JBL Live 460 NC', 'JBL Live 660 NC', 'Honor Band 6',
    'Samsung Galaxy Watch 3', 'Huawei MatePad T10'],
  2021: ['Xiaomi 12X', 'Xiaomi Redmi Note 10 Pro', 'Xiaomi Redmi Note 10S', 'Apple iPad 9', 'Apple iPad Mini 6',
    'Samsung Galaxy Tab A8', 'Samsung Galaxy Tab A8 LTE', 'Samsung Galaxy Watch4', 'Honor Watch GS 3 Rubber',
    'Xiaomi Redmi Watch 2 Lite', 'Apple AirPods 3rd Generation', 'Beats Fit Pro', 'Beats Studio Buds', 'Bose QuietComfort 45 Acoustic',
    'JBL Tune 230NC TWS', 'JBL Tune 760 NC', 'Microsoft Xbox Wireless Headset', 'Samsung Galaxy Buds 2', 'Sony WF-C500',
    'Xiaomi Redmi Buds 3 Lite'],
  2022: ['Honor X8', 'Honor X9', 'Xiaomi 12 Lite', 'Xiaomi Poco C40', 'Xiaomi Poco F4', 'Xiaomi Poco M5', 'Xiaomi Redmi 10',
    'Xiaomi Redmi 10A', 'Xiaomi Redmi 10C', 'Xiaomi Redmi Note 11', 'Xiaomi Redmi Note 11 Pro+ 5G', 'Xiaomi Redmi Note 11S',
    'Apple iPad 10', 'Apple iPad Pro M2', 'Apple iPad Pro M2 Wi-Fi + Cellular', 'Apple iPad Air 5 Wi-Fi + Cellular', 'Honor Pad 8',
    'Xiaomi Redmi Pad', 'Xiaomi Smart Band 7', 'Xiaomi Smart Band 7 Pro', 'Xiaomi Watch S1 Active', 'Bang & Olufsen Beoplay EX',
    'Bang & Olufsen Beoplay HX', 'Bose QuietComfort II', 'Dyson Zone', 'JBL Live Flex', 'JBL Live Pro 2 TWS', 'JBL Tune Flex',
    'Samsung Galaxy Buds 2 Pro', 'Sony WH-1000XM5'],
  2023: ['Apple iPhone 15 Pro', 'Honor X7b', 'Honor X8b', 'Nothing Phone 2', 'OPPO Reno8T', 'Samsung A15', 'Samsung A25',
    'Samsung Galaxy A34', 'Sony Xperia 10V', 'Xiaomi 13 Lite', 'Xiaomi Poco F5', 'Xiaomi Poco X5 5G', 'Xiaomi Poco X5 Pro 5G',
    'Xiaomi Redmi 12', 'Xiaomi Redmi 12C', 'Xiaomi Redmi 13C', 'Xiaomi Redmi A2+', 'Xiaomi Redmi Note 12',
    'Lenovo Tab M9 TB310XU ACC ZAC50096RU', 'Samsung Galaxy Tab A9 X110', 'Samsung Galaxy Tab A9 X115', 'Samsung Galaxy Tab A9+ X210',
    'Samsung Galaxy Tab A9+ X216', 'Samsung Galaxy Tab S9 FE X510', 'Samsung Galaxy Tab S9 FE X516', 'Samsung Galaxy Tab S9 Ultra',
    'Xiaomi Redmi Pad SE', 'Apple Watch Ultra 2', 'Garmin epix Pro – Sapphire Edition', 'Garmin epix Pro – Standard Edition',
    'Garmin Fenix 7 Pro Sapphire Solar', 'Garmin Fenix 7X Pro – Sapphire Solar Edition', 'Garmin Forerunner 965',
    'Garmin Instinct 2X Solar', 'Garmin Instinct 2X Solar – Tactical Edition', 'Garmin Venu 3', 'Garmin Venu 3s', 'Garmin Vivoactive 5',
    'Samsung Galaxy Watch 6 Classic', 'Xiaomi Redmi Smart Band 2', 'Xiaomi Smart Band 8 Active', 'Xiaomi Smart Band 8',
    'Xiaomi Smart Band 8 Pro', 'Beats Studio Pro', 'JBL Live 770 NC', 'JBL Tune Buds', 'JBL Tune 520 BT', 'JBL Tune 670 NC',
    'JBL Tune 720 BT', 'JBL Tune Beam', 'Sennheiser Accentum Wireless', 'Sony PULSE Explore', 'Sony WF-1000XM5', 'Sony WF-C700N',
    'Xiaomi Redmi Buds 4 Active', 'Xiaomi Redmi Buds 4 Lite'],
  2024: ['Google Pixel 9', 'Google Pixel 9 Pro', 'Google Pixel 9 Pro XL', 'Honor 200', 'Honor 200 Lite 5G', 'Honor Magic7',
    'Honor X5b Plus', 'Honor X7c', 'Samsung Galaxy A35', 'Xiaomi 14T', 'Xiaomi Poco F6', 'Xiaomi Poco F6 Pro', 'Xiaomi Poco M6',
    'Xiaomi Poco M6 Pro', 'Xiaomi Poco M7 Pro 5G', 'Xiaomi Redmi 13', 'Xiaomi Redmi A3', 'Realme Note 60x',
    'Apple iPad Air M2', 'Apple iPad Air M2 Wi-Fi + Cellular', 'Apple iPad Mini 7', 'Apple iPad Pro M4 Wi-Fi + Cellular',
    'Xiaomi Redmi Pad Pro 5G', 'Xiaomi Redmi Pad SE 8.7 4G', 'Garmin Fenix 8, AMOLED', 'Garmin Fenix 8 AMOLED Sapphire',
    'Nothing CMF Watch Pro 2', 'Samsung Galaxy Watch FE', 'Samsung Galaxy Watch Ultra 2024', 'Samsung Galaxy Watch Fit 3',
    'Xiaomi Mi Smart Band 9', 'Xiaomi Redmi Watch 5 Active', 'Beats Solo Buds', 'Beats Solo 4', 'Nothing Ear Open B182',
    'Samsung Galaxy Buds 3', 'Sennheiser Accentum Plus', 'Sennheiser Accentum True Wireless ATW1', 'Sennheiser HD 620S',
    'Sennheiser Momentum Sport MSPORT1', 'Sony PULSE Elite Wireless Headset', 'Sony WF-C510', 'Sony ULT WEAR WH-ULT900N',
    'Xiaomi Redmi Buds 5', 'Xiaomi Redmi Buds 6 Play'],
  2025: ['Apple iPhone 16e', 'Google Pixel 10 Pro XL', 'Google Pixel 10 Pro Fold /GU0NP', 'Honor 400 Lite', 'Honor Magic 8 Pro',
    'Xiaomi POCO F7 Pro', 'Samsung Galaxy A17 5G', 'Xiaomi Poco X7', 'Xiaomi POCO M7', 'Xiaomi Redmi 15', 'Xiaomi Redmi A5',
    'Xiaomi Redmi Note 14S', 'Realme C71', 'Xiaomi POCO C71', 'Honor Pad 10 5G', 'Garmin Fenix 8 Pro, AMOLED', 'Garmin Forerunner 570',
    'Garmin Forerunner 970', 'Garmin Instinct 3, AMOLED', 'Garmin Instinct 3, Solar', 'Garmin Venu 4', 'Garmin Venu X1',
    'Garmin vivoactive 6', 'Nothing CMF Watch 3 Pro', 'Samsung Galaxy Watch Ultra 2025', 'Whoop Life', 'Whoop Peak',
    'Nothing Headphone (1)', 'Samsung Galaxy Buds 3 FE'],
  // successors of models launched in 2025, on sale today: they can only be 2026
  2026: ['Apple iPhone 17e', 'Google Pixel 11 Pro XL', 'OnePlus Nord 6', 'Samsung Galaxy S26 FE', 'Samsung Galaxy Z Flip 8',
    'Samsung Galaxy Z Fold 8', 'Samsung Galaxy Z Fold 8 Ultra', 'Xiaomi 17T', 'Apple Watch Series 12 GPS', 'Apple Watch Ultra 4 GPS + Cellular',
    'Samsung Galaxy Watch 9'],
};
const byName = new Map(ph.map(p => [p.brand + ' ' + p.name, p]));
const out = [], missing = [];
for (const [y, names] of Object.entries(Y)) for (const n of names) {
  const p = byName.get(n);
  if (!p) { missing.push(n); continue; }
  if (p.year !== +y) { p.year = +y; out.push(`year ${y}  ${n}`); }
}
// TV and monitor diagonals written only in the model code
for (const p of ph.filter(p => (p.category === 'tv' || p.category === 'monitor') && !(p.display && p.display.size)
    && !(p.variants || []).some(v => v.size))) {
  const n = p.name;
  let m;
  if (p.brand === 'ASUS') m = n.match(/^[A-Z]{2}(\d{2})/);                   // VG279Q3A -> 27, VA249HG -> 24
  else if (/Odyssey G4 LS25BG400/.test(n)) m = [null, '24.5'];
  else m = n.match(/^(?:Odyssey G\d\s+)?(?:[A-Z]{1,3})?(1\d{2}|\d{2})(?=[A-Z])/) || n.match(/\bL(\d{2})M[A-Z]/);
  if (!m && p.brand === 'Xiaomi' && /Mini LED/.test(n)) m = [null, '65'];       // both are the 65-inch (L65MA / L65MB)
  const s = m ? +m[1] : null;
  if (!s || s < 20 || s > 120) { missing.push('size: ' + p.brand + ' ' + n); continue; }
  (p.display ||= {}).size = s; out.push(`size ${s}  ${p.brand} ${n}`);
}
// ---- laptops: the maker's own naming says the year, where it follows a scheme ----
// Lenovo's generation suffix: 15IRH10 is Gen 10 = 2025 (Gen 6 was 2021). Dell's 2025-on codes carry
// the year: DC15250 = 2025, DX13260 = 2026. Where a stored `released` disagrees, it was wrong and is
// set to the year, so the tag and the spec table say the same thing.
const LAPTOP = {
  2020: ['Apple MacBook Air M1', 'Microsoft Surface Go 2'],
  2021: ['MSI Modern 15 A11MU 1006XGE'],
  2022: ['MSI Cyborg 15 A12VF 043US', 'Dell G15 5520', 'Dell Vostro 3520 i3', 'Dell Vostro 3520 i5', 'HP ProBook 450 G9 7C196PA'],
  2023: ['Lenovo IdeaPad 1 15IRU7', 'Apple MacBook Pro M3', 'Apple MacBook Pro M3 Pro', 'Apple MacBook Pro M3 Max', 'MSI Cyborg 15 A13UC-821XAE',
    'MSI Cyborg 15 A13VE-218US', 'Dell G5 15 5535', 'Dell Inspiron 16 Plus 7630', 'Dell Vostro 3530(I7)', 'HP ProBook 440 G10',
    'HP ProBook 450 G10 85C38EA', 'HP EliteBook 640 G10', 'Lenovo ThinkPad E16 Gen 1 21JN001QGP', 'Lenovo ThinkPad T16 Gen 2 21HH005AGQ',
    'Lenovo V14 G4 IRU', 'Lenovo V15 G4 IRU'],
  2024: ['Apple MacBook Pro M4', 'Apple MacBook Pro M4 Max', 'Honor MagicBook Pro 16 Ultra 5 125H', 'Samsung Galaxy Book 4 NP750XGK-KS2US',
    'Dell XPS 9345(X Elite)', 'Dell XPS 9345(X Plus)', 'Dell XPS 9350 (Ultra 7)', 'Dell XPS 9350(Ultra 9)', 'Dell XPS 9440(RTX 4050)',
    'Dell XPS 9640(RTX 4050)', 'Dell XPS 16 9640', 'Dell Inspiron 7445', 'Lenovo ThinkPad E16 Gen 2 21MA002XRT', 'Lenovo ThinkPad E16 Gen 2 21MA004VRT'],
  2025: ['Honor MagicBook X16 2025', 'Lenovo Think Book 14 G8 IRL', 'Lenovo ThinkBOOK 16 G8 IRL', 'Lenovo ThinkPad T16 G4'],
  2026: ['Honor MagicBook X16 2026'],
};
const setYear = (p, y, why) => {
  const had = +(String(p.released || '').match(/^(\d{4})/) || [])[1];
  if (p.year === y && (!had || had === y)) return;
  p.year = y;
  if (had && had !== y) { out.push(`fix  ${had} -> ${y}  ${p.brand} ${p.name}`); p.released = String(y); }
  else out.push(`year ${y}  ${p.brand} ${p.name} (${why})`);
};
for (const [y, names] of Object.entries(LAPTOP)) for (const n of names) {
  const p = byName.get(n);
  if (!p) { missing.push(n); continue; }
  setYear(p, +y, 'listed');
}
const LISTED = new Set(Object.values(LAPTOP).flat());
for (const p of ph.filter(p => p.category === 'laptop')) {
  let m;
  if (LISTED.has(p.brand + ' ' + p.name)) continue;   // a listed year beats the scheme
  if (p.brand === 'Lenovo' && (m = p.name.match(/\b\d{2}\s?(?:[A-Z]{3}|Q8X)(\d{1,2})R?(?!\d)/)) && +m[1] >= 6 && +m[1] <= 11)
    setYear(p, 2015 + +m[1], 'Lenovo Gen ' + m[1]);
  else if (p.brand === 'Dell' && (m = p.name.match(/\b[A-Z]{2}\d{2}(2[4-7])\d(?!\d)/)))
    setYear(p, 2000 + +m[1], 'Dell code');
}
console.log(out.join('\n')); console.log(`\n${out.length} set; not found / left:`, missing);
if (write) { fs.writeFileSync('data/phones.json', JSON.stringify(ph, null, 1)); console.log('written'); }
