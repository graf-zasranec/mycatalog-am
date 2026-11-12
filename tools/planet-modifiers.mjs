// The same modifier groups used by the retailer's storage/RAM/color controls.
export function readPlanetModifiers(data){
 const out={};for(const m of Array.isArray(data)?data:[]){const ts=m.specification?.translations||[];const name=(ts.find(t=>t.locale==='en')||ts[0])?.name||'';const key=/^colou?r$/i.test(name)?'color':/^sim$/i.test(name)?'sim':/^ram$/i.test(name)?'ram':null;if(!key)continue;
 out[key]=(m.values||[]).map(v=>({name:String(v.value?.value||'').trim(),price:Math.round(Number(v.price||0)),active:v.is_active!==0&&v.is_active!=='0'})).filter(x=>x.name&&Number.isFinite(x.price));}return out;
}
export function planetRamOptions(mod){
 if(!mod.ram?.length)return [{ram:null,price:0,active:true}];
 return mod.ram.map(o=>({...o,ram:Number(/^(\d+)\s*GB$/i.exec(o.name)?.[1])||null})).filter(o=>o.ram&&o.ram<=192);
}

// Read the attribute on the storage button itself. Modifiers may still list
// active RAM or colours for a capacity whose purchase button is disabled.
export function readPlanetStorage(html, capacityOf) {
  const tiers = [];
  for (const [, attrs, label] of html.matchAll(/<button\b([^>]*)>\s*([^<]+?)\s*<\/button>/gi)) {
    const attributes = new Map([...attrs.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
      .map(([, name, double, single, bare]) => [name.toLowerCase(), double ?? single ?? bare ?? '']));
    if (!attributes.get('class')?.split(/\s+/).includes('storage-btn')) continue;
    const varId = attributes.get('data-id');
    const storage = capacityOf(label);
    if (!/^\d+$/.test(varId || '') || !storage) continue;
    const price = Math.round(Number(attributes.get('data-price') || 0));
    const disabled = attributes.has('disabled');
    if (disabled || price >= 5000) tiers.push({ varId, storage, price, disabled });
  }
  return tiers;
}
