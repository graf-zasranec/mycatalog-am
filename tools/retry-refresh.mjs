import fs from'node:fs';import{githubRetryApi}from'./github-retry-api.mjs';import{retryDecision}from'./refresh-recovery.mjs';
const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
if(!/^[-\w.]+\/[-\w.]+$/.test(repo||'')||!token||event.repository?.full_name!==repo)throw Error('Invalid retry repository context');
const runId=event.workflow_run?.id;if(!Number.isSafeInteger(runId))throw Error('Missing workflow run');
const root='https://api.github.com/repos/'+repo;
const api=(path,method='GET')=>githubRetryApi(root,path,token,method);
const run=await api('/actions/runs/'+runId),latest=await api('/actions/workflows/deploy.yml/runs?branch=main&per_page=100'),runs=latest.workflow_runs||[];
const reason=retryDecision(run,runs,repo)||retryDecision(run,runs,repo,(await api('/actions/runs/'+runId+'/jobs')).jobs||[]);
if(reason)console.log('Refresh retry skipped: '+reason);else{await api('/actions/runs/'+runId+'/rerun','POST');console.log('Requested one retry of refresh '+runId);}
