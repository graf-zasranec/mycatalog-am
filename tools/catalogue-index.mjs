// Keep all fields used by search, facets, configurations and listing cards.
// The full model is restored by the existing product-detail chunk before use.
export function catalogueIndex(product) {
  const index={...product};
  for(const key of ['aliases','accent','tier','unsure','specNA','updates','specSource','settled','notes','releaseDate','priceAmdMax'])delete index[key];
  const detailOnly={
    display:['ppi','brightness'],chipset:['process','gpu'],
    camera:['front','video','ultrawide','telephoto','modules','sensor','ois','digitalZoom'],
    body:['height','width','thickness','materials'],
    connectivity:['wifi','bluetooth'],battery:['chargeTime']
  };
  for(const [key,omit]of Object.entries(detailOnly)){
    const value=index[key];
    if(value&&typeof value==='object'&&!Array.isArray(value))
      index[key]=Object.fromEntries(Object.entries(value).filter(([field])=>!omit.includes(field)));
  }
  return index;
}
