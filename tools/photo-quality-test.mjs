import assert from'node:assert/strict';import{createHash}from'node:crypto';import{photoQuality}from'./photo-quality.mjs';
const bytes=Buffer.from('native photo'),file='images/cut/exact__main.webp',sha256=createHash('sha256').update(bytes).digest('hex');
const native={sha256,width:330,height:1000,visibleBounds:[5,5,325,995],alphaThreshold:128};const read=()=>bytes;
assert.equal(photoQuality(file,{[file]:native},read).state,'adequate','a narrow tall original is not low resolution');
assert.equal(photoQuality(file,{[file]:{...native,width:1200,height:1200,visibleBounds:[400,400,800,800]}},read).state,'too small','transparent padding cannot qualify a small body');
assert.equal(photoQuality(file,{},read).state,'unmeasured');
assert.equal(photoQuality(file,{[file]:{...native,sha256:'stale'}},read).state,'unmeasured','stale facts cannot qualify a replaced photo');
for(const patch of[{visibleBounds:[0,0,900,900]},{visibleBounds:[30,30,20,20]},{alphaThreshold:0},{width:0},{height:null}])assert.equal(photoQuality(file,{[file]:{...native,...patch}},read).state,'unmeasured','invalid native measurements are not trusted');
console.log('PHOTO_QUALITY_PASS: visible native body, padding, tall images, stale measurements and invalid bounds');
