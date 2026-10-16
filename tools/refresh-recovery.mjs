export function preparedCheckpoint(value, scope, now=Date.now()) {
  const age=now-Date.parse(value?.preparedAt);
  return value?.scope===scope && Number.isFinite(age) && age>=0 && age<=12*3600000;
}
export function resumablePartial(value,today,allowPrevious=false,now=Date.now()) {
  if(value?.date===today)return true;
  const age=now-Date.parse(value?.savedAt);
  return allowPrevious && Number.isFinite(age) && age>=0 && age<=12*3600000;
}
export function retryDecision(run,others,repo) {
  if(run?.head_repository?.full_name!==repo||run?.head_branch!=='main')return 'untrusted source';
  if(run.name!=='Better — refresh prices')return 'different workflow';
  if(run.status!=='completed'||!['failure','cancelled','timed_out'].includes(run.conclusion))return 'not failed or cancelled';
  if(run.run_attempt!==1)return 'retry already used';
  if(others.some(r=>r.id!==run.id&&r.head_branch==='main'&&
    (Date.parse(r.created_at)>Date.parse(run.created_at)||['queued','in_progress','waiting','pending','requested'].includes(r.status))))return 'another refresh supersedes this run';
  return null;
}
