// Products whose source is newer than its cutout and big enough to matte, worst first.
import fs from 'node:fs';
function dim(b){if(b[0]===0x89)return Math.max(b.readUInt32BE(16),b.readUInt32BE(20));
 if(b[0]===0xFF){let i=2;while(i<b.length-8){if(b[i]!==0xFF){i++;continue}const m=b[i+1];
  if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC)return Math.max(b.readUInt16BE(i+7),b.readUInt16BE(i+5));i+=2+b.readUInt16BE(i+2)}}
 const s=b.toString('latin1'),i=s.indexOf('VP8');if(i<0)return 0;
 if(s.slice(i,i+4)==='VP8X')return Math.max(1+b.readUIntLE(i+12,3),1+b.readUIntLE(i+15,3));
 if(s.slice(i,i+4)==='VP8L'){const x=b.readUInt32LE(i+9);return Math.max((x&0x3fff)+1,((x>>14)&0x3fff)+1)}
 return Math.max(b.readUInt16LE(i+14)&0x3fff,b.readUInt16LE(i+16)&0x3fff)}
const best=new Map();
for(const f of fs.readdirSync('images/_src')){
  if(f==='manifest.json'||/\.wrong-colour$/.test(f)) continue;
  const stem=f.replace(/\.[a-z]+$/i,''), id=stem.split('__')[0], cut='images/cut/'+stem+'.webp';
  if(!fs.existsSync(cut)) continue;
  let px; try{ px=dim(fs.readFileSync('images/_src/'+f)); }catch{ continue; }
  if(px<600) continue;
  if(fs.statSync('images/_src/'+f).mtimeMs <= fs.statSync(cut).mtimeMs) continue;
  let was=0; try{ was=dim(fs.readFileSync(cut)); }catch{}
  if(!best.has(id)||best.get(id)<px-was) best.set(id,px-was);
}
const ids=[...best.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
if(process.argv[2]==='--count') console.log(ids.length);
else console.log(ids.slice(0, +(process.argv[2]||10)).join(' '));
