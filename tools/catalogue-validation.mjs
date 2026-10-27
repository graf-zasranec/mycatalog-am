import {requiredSpecFields} from './spec-gaps.mjs';
export function catalogueProblems(products, offers={}) {
  const known=new Set(products.map(p=>p.id)), problems=[];
  for(const p of products){
    for(const field of requiredSpecFields(p)){
      const value=field.split('.').reduce((a,k)=>a?.[k],p);
      if((value==null||value==='')&&!p.specNA?.[field])problems.push(`${p.id}: missing ${field}`);
    }
    const capacity=p.battery?.capacity;
    if(capacity!=null&&(!Number.isFinite(capacity)||capacity<=0))problems.push(`${p.id}: invalid battery capacity`);
  }
  for(const [id,rows]of Object.entries(offers)){
    if(!known.has(id))problems.push(`${id}: unknown offer bucket`);
    for(const row of rows)if(row.id!=null&&row.id!==id)problems.push(`${id}: conflicting offer id ${row.id}`);
  }
  return problems;
}
export function assertCatalogueData(products, offers){
  const problems=catalogueProblems(products,offers);
  if(problems.length)throw new Error('Catalogue data failed validation:\n'+problems.join('\n'));
}
