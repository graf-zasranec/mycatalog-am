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

export function assertPriceSnapshot({shops, offers} = {}) {
  const isRecord = value => value != null && typeof value === 'object' && !Array.isArray(value);
  if (!isRecord(shops) || !isRecord(offers)) throw new Error('Invalid price snapshot: expected shop and offer registries');
  for (const [shop, metadata] of Object.entries(shops)) {
    if (!isRecord(metadata) || typeof metadata.name !== 'string' || !metadata.name.trim()) {
      throw new Error('Invalid shop metadata: ' + shop);
    }
  }
  for (const [id, rows] of Object.entries(offers)) {
    if (!Array.isArray(rows)) throw new Error('Invalid offer list: ' + id);
    for (const row of rows) {
      if (!isRecord(row)) throw new Error('Invalid offer row: ' + id);
      if (typeof row.shop !== 'string' || !Object.hasOwn(shops, row.shop)) {
        throw new Error('Unknown offer shop: ' + row.shop);
      }
    }
  }
}
