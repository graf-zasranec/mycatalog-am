import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pack, unpack} from './compact-data.mjs';
for (const f of ['phones', 'prices', 'blog', 'thumbnails']) {
  const data = JSON.parse(fs.readFileSync(`data/${f}.json`));
  assert.deepEqual(unpack(pack(data)), data, `Lossless ${f}`);
}
const edge = JSON.parse('{"__proto__":{"safe":true},"null":null,"false":false,"text":"Հայերեն </script>","list":[[],{},-1,-2,"long repeated string","long repeated string"]}');
assert.deepEqual(unpack(pack(edge)), edge);
assert.equal({}.safe, undefined);
console.log('COMPACT DATA: lossless catalogue, prices, blog, photos and edge cases');
