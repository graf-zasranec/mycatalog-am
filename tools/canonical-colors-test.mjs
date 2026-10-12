import assert from 'node:assert/strict';
import {canonicalColors} from './canonical-colors.mjs';
const aliases={honor:{Black:'Midnight Black',Silver:'Titanium Silver'},redmi:{'Midnight Black':'Black',Titanium:'Gray','Titan Gray':'Titanium'}};
assert.deepEqual(canonicalColors('honor',['Green','Black','Midnight Black','Titanium Silver','Silver'],aliases),['Green','Midnight Black','Titanium Silver']);
assert.deepEqual(canonicalColors('redmi',['Purple','Gray','Black','Midnight Black','Titanium'],aliases),['Purple','Gray','Black']);
assert.deepEqual(canonicalColors('redmi',['Titan Gray'],aliases),['Gray']);
assert.deepEqual(canonicalColors('unmapped',['Space Gray','Gray'],aliases),['Space Gray','Gray']);
assert.deepEqual(canonicalColors('cycle',['Black','Gray'],{cycle:{Black:'Gray',Gray:'Black'}}),['Black','Gray']);
console.log('CANONICAL_COLORS_PASS: five alias, chain, distinction and cycle cases');
