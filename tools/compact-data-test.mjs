import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pack, unpack, groupCatalogue, restoreCatalogue} from './compact-data.mjs';
for (const f of ['phones', 'prices', 'blog', 'thumbnails']) {
  const data = JSON.parse(fs.readFileSync(`data/${f}.json`));
  assert.deepEqual(unpack(pack(data)), data, `Lossless ${f}`);
}
const edge = JSON.parse('{"__proto__":{"safe":true},"null":null,"false":false,"text":"Հայերեն </script>","list":[[],{},-1,-2,"long repeated string","long repeated string"]}');
assert.deepEqual(unpack(pack(edge)), edge);
assert.equal({}.safe, undefined);
const products = [{id:'phone-one',name:'Phone One'},{id:'__proto__',name:'Safe model'}];
const maps = JSON.parse('{"IMGDATA":{"phone-one":"images/phone-one.webp","orphan":"kept.webp","__proto__":null},"PBOX":{"phone-one":[12,990]},"FLAGS":{"phone-one":false,"__proto__":0}}');
assert.deepEqual(restoreCatalogue(unpack(pack(groupCatalogue(products,maps)))),{DATA:products,...maps},'grouped transport preserves missing/null/false/zero and orphan image metadata');
assert.equal({}.safe,undefined);
console.log('COMPACT DATA: lossless catalogue, prices, blog, photos and edge cases');
