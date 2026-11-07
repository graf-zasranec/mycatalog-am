export function preparedCheckpoint(value, scope, now=Date.now()) {
  const age=now-Date.parse(value?.preparedAt);
  return value?.scope===scope && Number.isFinite(age) && age>=0 && age<=12*3600000;
}
export function resumablePartial(value,today,allowPrevious=false,now=Date.now()) {
  if(value?.date===today)return true;
  const age=now-Date.parse(value?.savedAt);
  return allowPrevious && Number.isFinite(age) && age>=0 && age<=12*3600000;
}
export function retryDecision(run,others,repo,jobs=[]) {
  if(run?.head_repository?.full_name!==repo||run?.head_branch!=='main')return 'untrusted source';
  if(run.name!=='Better — refresh prices')return 'different workflow';
  if(run.status!=='completed'||!['failure','cancelled','timed_out'].includes(run.conclusion))return 'not failed or cancelled';
  if(run.run_attempt!==1)return 'retry already used';
  // A crawl that finished but could not publish met a newer source file. A retry replays the same
  // conflict and holds the queue for hours (5-7 Nov 2026); the next scheduled run starts from main.
  if(jobs.some(j=>j.steps?.some(s=>s.name==='Commit refreshed prices and history'&&s.conclusion==='failure')))return 'publish conflict, next refresh starts from main';
  if(others.some(r=>r.id!==run.id&&r.head_branch==='main'&&
    (Date.parse(r.created_at)>Date.parse(run.created_at)||['queued','in_progress','waiting','pending','requested'].includes(r.status))))return 'another refresh supersedes this run';
  return null;
}
