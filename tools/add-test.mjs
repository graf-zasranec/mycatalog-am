import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'better-import-'));
fs.mkdirSync(path.join(root,'tools'));fs.mkdirSync(path.join(root,'data'));
for(const f of ['tools/add.mjs','scrape.mjs'])fs.copyFileSync(f,path.join(root,f));
fs.writeFileSync(path.join(root,'data/phones.json'),JSON.stringify([{id:'fixture-asus',brand:'ASUS',name:'Existing model'},{id:'fixture-samsung',brand:'Samsung',name:'Existing model'},{id:'fixture-lg',brand:'LG',name:'Existing model'}]));
fs.writeFileSync(path.join(root,'data/listings.csv'),'shop,title,capacity,color,url,price,ram,check,seen,inStock\n');
fs.writeFileSync(path.join(root,'rows.json'),JSON.stringify([
{shop:'test',name:'ASUS Vivobook TestModel 8GB/128GB',url:'https://example.com/laptop/a',price:100000},
{shop:'test',name:'ASUS Vivobook TestModel 16GB/256GB',url:'https://example.com/laptop/b',price:150000},
{shop:'test',name:'Samsung Galaxy A99 8GB',url:'https://example.com/phones/c',price:60000},
{shop:'test',name:'Notebook LG Gram Decimal 64GB/2.5TB',url:'https://example.com/laptop/d',price:486900}
]));
const run=spawnSync(process.execPath,['tools/add.mjs','rows.json','--write'],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
const products=JSON.parse(fs.readFileSync(path.join(root,'data/phones.json')));const laptop=products.find(p=>p.category==='laptop');assert.deepEqual(laptop.variants.map(v=>[v.ram,v.storage]),[[8,128],[16,256]]);assert.equal(products.find(p=>p.category==='phone').variants[0].storage,null);
assert.deepEqual(products.find(p=>p.name.includes('Decimal')).variants.map(v=>[v.ram,v.storage]),[[64,2560]],'decimal TB must never become 5 TB');
const csv=fs.readFileSync(path.join(root,'data/listings.csv'),'utf8').trim().split('\n').slice(1).map(l=>l.split(','));assert.equal(csv[0][6],'8');assert.equal(csv[1][6],'16');assert.ok(csv.every(r=>r.length===10));
console.log('Importer regression: valid RAM/storage pairs, storage floor and persisted RAM pass.');
