// Turns the photos in images/_src/ into transparent, trimmed WebP cutouts in images/cut/.
//
//   node tools/cutout.mjs          then open http://127.0.0.1:8791/ and let it run
//
// Why a browser: decoding JPEG/WebP in pure Node needs a dependency. The browser already has
// a decoder, so this serves a page that does the work on a canvas and POSTs finished PNGs back.
// Nothing leaves the machine.
//
// The cutout is a flood fill from the image border, not a global "white -> transparent"
// threshold: that keeps white and silver phone bodies intact, since those whites are enclosed
// by the product outline and never reachable from the edge.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'images', '_src');
const OUT = path.join(ROOT, 'images', 'cut');
fs.mkdirSync(OUT, { recursive: true });

const PORT = 8791;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };

const PAGE = `<!doctype html><meta charset="utf-8"><title>cutout</title>
<style>body{font:14px system-ui;margin:24px;background:#111;color:#eee}
#g{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:16px}
figure{margin:0;background:repeating-conic-gradient(#333 0 25%,#3c3c3c 0 50%) 0 0/16px 16px;border-radius:8px;padding:6px}
img{width:100%;display:block}figcaption{font-size:10px;opacity:.6;margin-top:4px;word-break:break-all}
#s{font-size:16px;font-weight:700}</style>
<div id="s">starting…</div><div id="g"></div>
<script>
const S=document.getElementById('s'), G=document.getElementById('g');

// near-white and unsaturated == background candidate
const isBg=(p,i)=>{const r=p[i],g=p[i+1],b=p[i+2];
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  return mn>=234 && (mx-mn)<=14;};

function cutout(img){
  const W=img.naturalWidth,H=img.naturalHeight;
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(img,0,0);
  const d=g.getImageData(0,0,W,H),px=d.data;

  // flood fill inwards from every border pixel
  const bg=new Uint8Array(W*H);
  const stack=[];
  for(let x=0;x<W;x++){stack.push(x,0,x,H-1);}
  for(let y=0;y<H;y++){stack.push(0,y,W-1,y);}
  while(stack.length){
    const y=stack.pop(),x=stack.pop();
    if(x<0||y<0||x>=W||y>=H)continue;
    const p=y*W+x;
    if(bg[p])continue;
    if(!isBg(px,p*4))continue;
    bg[p]=1;
    stack.push(x+1,y,x-1,y,x,y+1,x,y-1);
  }
  for(let p=0;p<W*H;p++) if(bg[p]) px[p*4+3]=0;

  // soften the white halo: opaque light pixels touching transparency fade out
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const p=y*W+x; if(bg[p])continue;
    let edge=false;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=W||ny>=H||bg[ny*W+nx]){edge=true;break;}
    }
    if(!edge)continue;
    const i=p*4,lum=(px[i]+px[i+1]+px[i+2])/3;
    if(lum>222) px[i+3]=Math.max(0,Math.round(255*(1-(lum-222)/33)));
  }

  // trim to the product's bounding box so every phone fills its frame consistently
  let x0=W,y0=H,x1=0,y1=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(px[(y*W+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  }
  if(x1<x0||y1<y0){x0=0;y0=0;x1=W-1;y1=H-1;}
  const pad=Math.round(Math.max(x1-x0,y1-y0)*0.02);
  x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(W-1,x1+pad);y1=Math.min(H-1,y1+pad);
  g.putImageData(d,0,0);
  const cw=x1-x0+1, ch=y1-y0+1;
  const MAX=560, k=Math.min(1,MAX/Math.max(cw,ch));      // cap the long edge; keeps the artifact small
  const o=document.createElement('canvas');
  o.width=Math.max(1,Math.round(cw*k));o.height=Math.max(1,Math.round(ch*k));
  const og=o.getContext('2d');og.imageSmoothingQuality='high';
  og.drawImage(c,x0,y0,cw,ch,0,0,o.width,o.height);
  return o;
}

const load=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});

(async()=>{
  const files=await (await fetch('/list')).json();
  let done=0,failed=0;
  for(const f of files){
    try{
      const img=await load('/src/'+encodeURIComponent(f));
      const c=cutout(img);
      const blob=await new Promise(r=>c.toBlob(r,'image/webp',0.9));
      const name=f.replace(/\\.[a-z]+$/i,'.webp');
      const r=await fetch('/save/'+encodeURIComponent(name),{method:'POST',body:blob});
      if(!r.ok)throw new Error('save failed');
      done++;
      const fig=document.createElement('figure');
      fig.innerHTML='<img src="'+c.toDataURL()+'"><figcaption>'+name+'</figcaption>';
      G.appendChild(fig);
    }catch(e){failed++;console.warn(f,e);}
    S.textContent='processed '+done+' / '+files.length+(failed?'  ('+failed+' failed)':'');
  }
  S.textContent='DONE '+done+' / '+files.length+(failed?'  ('+failed+' failed)':'');
  document.title='done';
})();
</script>`;

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
  if (url === '/list') {
    const files = fs.readdirSync(SRC).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(files));
  }
  if (url.startsWith('/src/')) {
    const f = path.join(SRC, path.basename(url.slice(5)));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    return res.end(fs.readFileSync(f));
  }
  if (url.startsWith('/save/') && req.method === 'POST') {
    const name = path.basename(url.slice(6));
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync(path.join(OUT, name), Buffer.concat(chunks));
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log(`cutout server on http://127.0.0.1:${PORT}/  (writes images/cut/)`));
