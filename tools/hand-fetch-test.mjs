import assert from'node:assert/strict';import{createHandReader}from'./hand-fetch.mjs';
let calls=0;const seen=[];const read=createHandReader({fetch:async u=>{calls++;return {status:u.includes('blocked')?403:200,ok:!u.includes('blocked'),text:async()=>'<h1>exact product</h1>'}},onPage:(u,r)=>seen.push([u,r.status])});
await read('https://live.test/a');await read('https://live.test/a');assert.equal(calls,1,'shared configuration URLs fetched once');
for(let i=0;i<4;i++)await read('https://blocked.test/'+i);assert.equal(calls,4,'three blocked requests then stop that host');
assert.equal((await read('https://blocked.test/5')).status,'host-blocked');assert.equal((await read('https://other.test/a')).status,200,'another host continues');assert.equal(seen.length,7);
console.log('HAND_FETCH_PASS: per-URL caching, bounded host blocks and independent healthy hosts');
