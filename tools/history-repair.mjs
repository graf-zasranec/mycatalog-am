// Rebuild only recorded JBL 530BT days from same-day archived merchant quotes.
// This is a reviewed repair, not an inference from today's prices.
export function repairProductHistory(history,id,snapshots) {
  if(id!=='jbl-tune-530bt')throw Error('Unsupported product identity');
  const result=structuredClone(history),points=result.points[id];
  if(!Array.isArray(points))throw Error('No recorded history');
  const seen=new Set();
  for(const source of snapshots){
    const {date,revision,generated,offers}=source;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||String(generated).slice(0,10)!==date)throw Error('Source date mismatch');
    if(!/^[a-f0-9]{40}$/.test(revision||''))throw Error('Missing source revision');
    if(seen.has(date))throw Error('Duplicate source date');seen.add(date);
    const i=points.findIndex(p=>p.d===date);
    if(i<0)throw Error('Day was not recorded');
    if(points[i].t&&Object.keys(points[i].t).some(k=>k!=='base'))throw Error('Unsupported historical tiers');
    const valid=(offers||[]).filter(o=>!/^https:\/\/www\.zigzag\.am\/(?:en|am|ru)\/jbl-t530wht\.html\/?$/i.test(o.url||''));
    if(!valid.length)throw Error('No valid model quotes');
    for(const o of valid){
      if(!/530[\s_-]*bt/i.test((o.title||'')+' '+(o.url||'')))throw Error('Unconfirmed model identity');
      if(!Number.isFinite(o.price)||o.price<=0||!o.shop||!/^https:\/\//.test(o.url||''))throw Error('Invalid source quote');
    }
    const lo=Math.min(...valid.map(o=>o.price)),hi=Math.max(...valid.map(o=>o.price));
    points[i]={d:date,lo,hi,shops:new Set(valid.map(o=>o.shop)).size,t:{base:lo}};
  }
  return result;
}
