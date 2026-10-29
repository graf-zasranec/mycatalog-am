import fs from 'node:fs';import assert from 'node:assert/strict';
const source=fs.readFileSync('scrape.mjs','utf8');const body=source.slice(source.indexOf('const enrich ='),source.indexOf('/* ---------- shops ---------- */'));
const enrich=new Function('phoneById','soleValue','ramOf','screenOf','urlWords','colorOf','colorFromImage','colorWords',body+';return enrich;')({product:{colors:['Inox'],variants:[]}},a=>a?.length===1?a[0]:null,()=>null,()=>null,s=>s||'',text=>text.includes('confirmed-inox')?'Inox':null,()=>null,()=>null);
const unknown={id:'product',title:'HITACHI R-B410PUC6 PWH',url:'https://shop/item',color:null,price:349000,seen:'2026-10-28'};
assert.equal(enrich(unknown,{allowSoleColor:false}).color,null,'carried unknown/quarantined finish must not become the only catalogue color');
assert.equal(enrich({...unknown,title:'confirmed-inox'},{allowSoleColor:false}).color,'Inox','actual title evidence can still enrich a carried unknown');
assert.equal(enrich({...unknown,color:'White'},{allowSoleColor:false}).color,'White','explicit merchant finish survives');
assert.equal(enrich(unknown).color,'Inox','existing fresh-adapter fallback behavior remains unchanged');
console.log('CARRIED_COLOR_PASS');
