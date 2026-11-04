// Run with ego-browser nodejs < tools/mobile-speed-ego.js.
// The Chromium emulation and throttling apply to this temporary page only.
const task = await taskSpace("Better.am mobile speed baseline");
console.log({spaceId:task.spaceId});
const page = task.page("p1");
const routes = [
  {name:"catalogue",url:"https://better.am/en/",selector:"[data-bx-mobile-category]"},
  {name:"product",url:"https://better.am/en/p/apple-iphone-18-pro/",selector:".pprice2 .pp-row>b"},
];
try {
  await page.cdp("Page.addScriptToEvaluateOnNewDocument",{
    source:"Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'})"
  });
  await page.cdp("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await page.cdp("Emulation.setTouchEmulationEnabled",{enabled:true});
  await page.cdp("Emulation.setCPUThrottlingRate",{rate:4});
  await page.cdp("Network.enable");
  await page.cdp("Network.setCacheDisabled",{cacheDisabled:true});
  await page.cdp("Network.emulateNetworkConditions",{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
  for (const route of routes) {
    await page.goto(route.url,{timeout:30000});
    await page.waitForFunction(selector => {
      const element=document.querySelector(selector);
      return document.documentElement.dataset.appReady==="true" && element?.getClientRects().length>0;
    },route.selector,{timeout:30000});
    const readiness = await page.evaluate(name=>{
      const navigation=performance.getEntriesByType("navigation")[0];
      const paint=performance.getEntriesByName("first-contentful-paint")[0];
      const assets=performance.getEntriesByType("resource").filter(r=>new URL(r.name).origin===location.origin);
      return {name,viewport:innerWidth,status:navigation.responseStatus,readyMs:Math.round(performance.now()),firstContentMs:paint?Math.round(paint.startTime):null,ttfbMs:Math.round(navigation.responseStart),encodedKiB:Math.round(assets.reduce((sum,r)=>sum+r.encodedBodySize,0)/1024),transferKiB:Math.round(assets.reduce((sum,r)=>sum+r.transferSize,0)/1024)};
    },route.name);
    if (route.name==="catalogue") {
      await page.click(route.selector,{label:"Open mobile category filter"});
      await page.waitForSelector('.bx-filter-form .bx-category-choice:has(input[value="headphones"])',{state:"visible",timeout:10000});
      readiness.filterOpenedMs=await page.evaluate(()=>Math.round(performance.now()));
    }
    console.log(JSON.stringify(readiness));
  }
} catch (error) {
  console.error(error);
  throw error;
}
await task.finish({keep:[]});
