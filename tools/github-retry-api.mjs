// Retry safe reads only. A failed POST may already have reached GitHub, so
// repeating a rerun request could start a second refresh.
const transient=new Set([429,500,502,503,504]);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function githubRetryApi(root,path,token,method='GET'){
 const tries=method==='GET'?4:1;
 for(let attempt=0;attempt<tries;attempt++){
  let response;
  try{response=await fetch(root+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});}
  catch(error){if(attempt+1===tries)throw error;await delay(1000*2**attempt);continue;}
  if(response.ok)return response.status===204?null:response.json();
  const retryAfter=response.headers.get('Retry-After');
  let wait=retryAfter==null?1000*2**attempt:/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:Date.parse(retryAfter)-Date.now();
  if(!Number.isFinite(wait))wait=1000*2**attempt;
  if(attempt+1===tries||!transient.has(response.status)||wait>60000)throw Error('GitHub retry API returned HTTP '+response.status);
  console.warn('GitHub read returned HTTP '+response.status+'; retry '+(attempt+1)+'/'+(tries-1));
  await delay(Math.max(0,wait));
 }
}
