import assert from 'node:assert/strict';
import {requiredSpecFields} from './spec-gaps.mjs';
for(const [type,field] of [['fridge','appliance.volume'],['freezer','appliance.volume'],['washing_machine','appliance.load'],['dryer','appliance.load'],['dishwasher','appliance.settings'],['air_conditioner','appliance.btu']]){
 const fields=requiredSpecFields({category:'largeappliance',appliance:{type}});
 assert.ok(fields.includes(field),type);
 if(type==='dishwasher')assert.ok(!fields.includes('appliance.load'));
}
assert.deepEqual(requiredSpecFields({category:'grooming'}),['appliance.type']);
assert.ok(requiredSpecFields({category:'phone'}).includes('camera.main'));
assert.deepEqual(requiredSpecFields({category:'powerbank'}), ['battery.capacity']);
assert.ok(requiredSpecFields({category:'largeappliance',appliance:{type:'fridge',volumeByVariant:{A:341,B:344}}}).includes('appliance.volumeByVariant'));
assert.ok(requiredSpecFields({category:'largeappliance',appliance:{type:'fridge',volumeByVariant:{A:'unknown'}}}).includes('appliance.volume'));
console.log('SPEC_GAPS_TEST_PASS: large appliance core fields and dishwasher/load separation');
// Extended audit must cover newer categories without changing legacy build requirements.
for(const [p,want]of[
 [{category:'camera',appliance:{type:'mirrorless'}},'camera.main'],
 [{category:'camera',appliance:{type:'instant'}},'appliance.type'],
 [{category:'graphicstablet',appliance:{type:'pen_display'}},'display.resolution'],
 [{category:'climate',appliance:{type:'water_heater'}},'appliance.volume'],
 [{category:'climate',appliance:{type:'air_conditioner'}},'appliance.btu'],
 [{category:'purifier'},'appliance.power'],
 [{category:'vacuum'},'appliance.type'],
 [{category:'ereader'},'display.size'],
 [{category:'smartglasses'},'glasses.lensWidth'],
 [{category:'projector'},'display.resolution'],
 [{category:'network'},'connectivity.wifi'],
 [{category:'streamer'},'chipset.name'],
 [{category:'component'},'graphics.name']
])assert.ok(requiredSpecFields(p,{extended:true}).includes(want),`${p.category}: extended audit checks ${want}`);
assert.ok(!requiredSpecFields({category:'camera',appliance:{type:'instant'}},{extended:true}).includes('camera.video'),'instant film cameras do not need video');
assert.ok(!requiredSpecFields({category:'graphicstablet',appliance:{type:'pen_tablet'}},{extended:true}).includes('display.resolution'),'a pen tablet without a screen has no display resolution');
console.log('EXTENDED_SPEC_COVERAGE_PASS');
