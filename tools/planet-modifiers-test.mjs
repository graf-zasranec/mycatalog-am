import assert from'node:assert/strict';import{readPlanetModifiers,planetRamOptions,readPlanetStorage}from'./planet-modifiers.mjs';
const group=(name,values)=>({specification:{translations:[{locale:'hy',name:'Այլ'},{locale:'en',name}]},values:values.map(([name,price,is_active])=>({value:{value:name},price,is_active}))});
const mod=readPlanetModifiers([group('RAM',[['4GB',null,1],['6GB','60000',1],['8GB','99000','0']]),group('Color',[['Blue',null,1]])]);
assert.deepEqual(planetRamOptions(mod).filter(x=>x.active).map(x=>x.ram),[4,6]);assert.equal(mod.color[0].name,'Blue');assert.equal(planetRamOptions(mod)[1].price,60000);assert.equal(planetRamOptions({})[0].ram,null);assert.deepEqual(planetRamOptions({ram:[{name:'4+4GB',active:true,price:0}]}),[],'virtual RAM is not physical RAM');console.log('PLANET_MODIFIERS_PASS: English identity, RAM tiers, prices, inactive options, virtual RAM rejection');

const options = readPlanetStorage(`
  <button data-id="262" class="storage-btn active" data-price="515000.00">256GB</button>
  <button class="storage-btn" data-id="265" data-price="515000.00" disabled>1TB</button>
  <button class="storage-btn" data-id="266" aria-disabled="true" data-price="575000.00">512GB</button>
  <button class="storage-btn-wrapper" data-id="267" disabled>128GB</button>
`, label => label === '1TB' ? 1024 : Number(label.replace('GB', '')));
assert.deepEqual(options.map(({storage, disabled}) => [storage, disabled]), [[256,false],[1024,true],[512,false]]);
