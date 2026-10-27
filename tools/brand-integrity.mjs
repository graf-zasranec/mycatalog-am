// A case-only duplicate splits one manufacturer's products into separate filters.
export function assertCaseStableBrands(products) {
  const spellings=new Map();
  for(const p of products){
    if(typeof p.brand!=='string'||!p.brand.trim())throw new Error('Missing brand: '+p.id);
    const key=p.brand.trim().toLowerCase(),previous=spellings.get(key);
    if(previous&&previous!==p.brand)throw new Error(`Case-variant brand splits filters: ${previous} / ${p.brand} (${p.id})`);
    spellings.set(key,p.brand);
  }
}
