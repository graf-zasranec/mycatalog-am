// Cache exact pages within one pass; stop hammering a host that blocks requests.
export function createHandReader({fetch:read=globalThis.fetch,pause=()=>Promise.resolve(),onPage=()=>{}}={}) {
  const pages=new Map(),blocked=new Map();
  return async(url,options={})=>{
    if(pages.has(url))return pages.get(url);
    const host=new URL(url).hostname;
    if((blocked.get(host)||0)>=3){const result={status:'host-blocked',html:''};await onPage(url,result);return result;}
    const work=(async()=>{
      let result;
      try{const r=await read(url,options);result={status:r.status,html:r.ok?await r.text():''};
        blocked.set(host,[403,429].includes(r.status)?(blocked.get(host)||0)+1:0);
      }catch(e){result={status:e.name,html:''};}
      await onPage(url,result);await pause(url);return result;
    })();
    pages.set(url,work);return work;
  };
}
