import fs from'node:fs';import{retryDecision}from'./refresh-recovery.mjs';
const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
if(!/^[-\w.]+\/[-\w.]+$/.test(repo||'')||!token||event.repository?.full_name!==repo)throw Error('Invalid retry repository context');
const runId=event.workflow_run?.id;if(!Number.isSafeInteger(runId))throw Error('Missing workflow run');
const root='https://api.github.com/repos/'+repo;
async function api(path,method='GET') {const r=await fetch(root+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('GitHub retry API returned HTTP '+r.status);return r.status===204?null:r.json();}
const run=await api('/actions/runs/'+runId),latest=await api('/actions/workflows/deploy.yml/runs?branch=main&per_page=100'),reason=retryDecision(run,latest.workflow_runs||[],repo);
if(reason)console.log('Refresh retry skipped: '+reason);else{await api('/actions/runs/'+runId+'/rerun','POST');console.log('Requested one retry of refresh '+runId);}
