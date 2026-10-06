// Real catalogue photos and the existing brand fonts; no generated product imagery.
import fs from 'node:fs';
import { chromium } from 'playwright';
const uri=(file,type)=>`data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
const fonts=fs.readFileSync('fonts/fonts.css','utf8').replace(/url\(([^)]+)\)/g,(_,name)=>`url(${uri('fonts/'+name,'font/woff2')})`);
const photo=uri('images/cut/apple-iphone-17-pro__cosmic-orange.webp','image/webp');
const laptop=uri('images/cut/apple-macbook-air-13-m4__sky-blue.webp','image/webp');
const languages={
 hy:['Համեմատիր գները։','Ընտրիր ավելի լավը։','Տեխնիկայի գներ Հայաստանի խանութներից'],
 ru:['Сравни цены.','Выбери лучшее.','Цены на электронику в магазинах Армении'],
 en:['Compare prices.','Choose better.','Electronics prices from Armenian shops']
};
const browser=await chromium.launch();
for(const [lang,copy] of Object.entries(languages)) {
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.setContent(`<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>${fonts}
 *{box-sizing:border-box}body{margin:0;background:#13161f;color:#f7f3ec;font-family:'Noto Sans Armenian',Arial,sans-serif}
 .cover{position:relative;width:1200px;height:630px;overflow:hidden;padding:54px 64px}
 .logo{font-family:Fraunces,Georgia,serif;font-weight:800;font-size:106px;letter-spacing:-5px;line-height:1}.logo span{color:#d75c50}
 h1{font-size:${lang==='hy'?43:49}px;line-height:1.3;letter-spacing:-1.1px;margin:52px 0 20px;font-weight:800;max-width:650px}
 h1 span{display:block;color:#e99487}p{font-size:22px;line-height:1.6;max-width:560px;color:#c1c6d1;margin:0}
 .domain{position:absolute;left:64px;bottom:48px;font-size:23px;font-weight:700;letter-spacing:.2px}
 .rule{position:absolute;left:64px;bottom:93px;width:554px;height:1px;background:#353a49}
 .scene{position:absolute;right:40px;top:50px;width:460px;height:530px}
 .phone{position:absolute;right:24px;top:8px;width:225px;height:325px;background:#f0ece5;border-radius:26px;display:grid;place-items:center;box-shadow:0 20px 38px #0005}
 .phone img{width:215px;height:285px;object-fit:contain}
 .laptop{position:absolute;left:0;bottom:8px;width:430px;height:250px;background:#e6edf0;border:1px solid #ffffff44;border-radius:26px;overflow:hidden;box-shadow:0 20px 38px #0005}
 .laptop img{position:absolute;width:400px;height:400px;left:15px;top:-78px;object-fit:contain}
 .accent{position:absolute;left:21px;top:58px;width:140px;height:5px;background:#d75c50}
 </style><body><div class="cover"><div class="logo">better<span>.</span></div><h1>${copy[0]}<span>${copy[1]}</span></h1><p>${copy[2]}</p><div class="rule"></div><div class="domain">better.am</div><div class="scene"><div class="accent"></div><div class="phone"><img src="${photo}" alt=""></div><div class="laptop"><img src="${laptop}" alt=""></div></div></div></body></html>`);
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('img').evaluateAll(images=>Promise.all(images.map(im=>im.decode())));
 await page.screenshot({path:`images/social/better-am-${lang}.jpg`,type:'jpeg',quality:90});
 await page.close();
}
await browser.close();
console.log('Three localized Better.am covers written (1200×630).');
