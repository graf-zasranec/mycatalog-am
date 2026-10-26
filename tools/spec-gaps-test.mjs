import assert from 'node:assert/strict';
import {requiredSpecFields} from './spec-gaps.mjs';
for(const [type,field] of [['fridge','appliance.volume'],['freezer','appliance.volume'],['washing_machine','appliance.load'],['dryer','appliance.load'],['dishwasher','appliance.settings'],['air_conditioner','appliance.btu']]){
 const fields=requiredSpecFields({category:'largeappliance',appliance:{type}});
 assert.ok(fields.includes(field),type);
 if(type==='dishwasher')assert.ok(!fields.includes('appliance.load'));
}
assert.deepEqual(requiredSpecFields({category:'grooming'}),['appliance.type']);
assert.ok(requiredSpecFields({category:'phone'}).includes('camera.main'));
assert.ok(requiredSpecFields({category:'largeappliance',appliance:{type:'fridge',volumeByVariant:{A:341,B:344}}}).includes('appliance.volumeByVariant'));
assert.ok(requiredSpecFields({category:'largeappliance',appliance:{type:'fridge',volumeByVariant:{A:'unknown'}}}).includes('appliance.volume'));
console.log('SPEC_GAPS_TEST_PASS: large appliance core fields and dishwasher/load separation');
