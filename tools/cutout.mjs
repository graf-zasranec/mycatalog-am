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
// Press PNGs from the manufacturers' own CDNs are already cut out, so their background is
// transparent rather than white; without the alpha test the flood fill finds nothing to remove
// and the whole frame is kept, black.
// 234 was loose enough to swallow a WHITE PRODUCT: AirPods and white earbuds are ~235-248, a
// studio backdrop is 250-255. The fill crossed the product edge and hollowed them out. Keeping the
// test tight leaves at worst a faint rim, which the halo softener below fades.
const isBg=(p,i)=>{const r=p[i],g=p[i+1],b=p[i+2];
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  return mn>=249 && (mx-mn)<=6;};
// A press PNG arrives already cut out. Flood filling it anyway is what hollowed out every WHITE
// product - the fill walks the transparent border, reaches a white body pixel that also passes the
// near-white test, and eats the product from the edge inwards. AirPods and the white Galaxy Buds
// came out as outlines. So: if the border is already transparent, the alpha channel IS the answer.
const preCut=(px,W,H)=>{
  let n=0,clear=0;
  for(let x=0;x<W;x+=3){ for(const y of [0,H-1]){ n++; if(px[(y*W+x)*4+3]<16) clear++; } }
  for(let y=0;y<H;y+=3){ for(const x of [0,W-1]){ n++; if(px[(y*W+x)*4+3]<16) clear++; } }
  return clear/n > 0.97;
};

function cutout(img){
  const W=img.naturalWidth,H=img.naturalHeight;
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(img,0,0);
  const d=g.getImageData(0,0,W,H),px=d.data;

  // flood fill inwards from every border pixel
  const bg=new Uint8Array(W*H);
  const pre=preCut(px,W,H);
  const stack=[];
  if(!pre){
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
  } else {
    for(let p=0;p<W*H;p++) if(px[p*4+3]<16) bg[p]=1;   // the source's own alpha is the mask
  }

  // PASS 2 - the shadow plinth. Apple's press renders stand the device on a soft grey wedge,
  // 196-245, nowhere near the near-white test, so it survived the strict fill as a white slab
  // under every iPhone and MacBook. It is a GRADIENT though: it fades into the backdrop with no
  // edge at all, while a genuinely white product (AirPods) is cut off from the backdrop by its
  // own silhouette. So this pass walks out from what is already transparent and only steps
  // across SMALL luminance changes - it flows down the plinth and stops dead at a product edge.
  // Neutral only, so a pale product colour (rose gold, mint) cannot be walked into either.
  // Whether PASS 2 can be trusted is a property of the PHOTO, not of the constants: it separates
  // plinth from product by the edge between them, and a WHITE product on a white backdrop has no
  // such edge - the walk eats it instead. So measure what survived the strict fill first. If most
  // of the product is already light, the walk is refused and that photo keeps its faint plinth,
  // which is the cheaper mistake by a wide margin.
  let lightN=0, opaqueN=0;
  for(let p=0;p<W*H;p++) if(!bg[p]){ opaqueN++; if((px[p*4]+px[p*4+1]+px[p*4+2])/3>=200) lightN++; }
  const soft = opaqueN>0 && lightN/opaqueN < 0.50;   // erring toward REFUSE: a kept plinth beats an eaten product

  if(!pre && soft){
    const SOFT_MIN=150, SOFT_SAT=12, SOFT_MAX=0.25;
    const lum=p=>(px[p*4]+px[p*4+1]+px[p*4+2])/3;
    const sat=p=>Math.max(px[p*4],px[p*4+1],px[p*4+2])-Math.min(px[p*4],px[p*4+1],px[p*4+2]);
    // Walk into a scratch mask first. A plinth is a small fraction of the product's area; a
    // strap the walk has escaped into is most of it. The Galaxy Watch 8 is white-on-white with
    // a SOFT edge - 255 backdrop down to a 224 strap in steps of about 7 - so the walk crossed
    // it a pixel at a time and ate the whole strap, leaving a chewed black watch face. Nothing
    // is applied until the size of what it wants to remove says it stayed on the plinth.
    const walk=step=>{
      const take=new Uint8Array(W*H), q=[];
      for(let p=0;p<W*H;p++) if(bg[p]) q.push(p);
      for(let h=0;h<q.length;h++){
        const p=q[h], x=p%W, y=(p-x)/W, L=lum(p);
        for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=x+dx, ny=y+dy;
          if(nx<0||ny<0||nx>=W||ny>=H) continue;
          const n=ny*W+nx;
          if(bg[n]||take[n]) continue;
          const nl=lum(n);
          if(nl<SOFT_MIN||sat(n)>SOFT_SAT||Math.abs(nl-L)>step) continue;
          take[n]=1; q.push(n);
        }
      }
      let want=0; for(let p=0;p<W*H;p++) if(take[p]) want++;
      return {take,want};
    };
    // A rendered shadow is far smoother than any product edge, so when the loose walk escapes
    // into the product the same walk at a smaller step still follows the plinth and no longer
    // crosses the edge. Take the first result that stays inside the cap.
    for(const step of [9,5,3]){
      const {take,want}=walk(step);
      if(want>opaqueN*SOFT_MAX) continue;
      for(let p=0;p<W*H;p++) if(take[p]){ bg[p]=1; px[p*4+3]=0; }
      break;
    }
  }

  // The contact shadow under a LIGHT product is the one the walk above refuses to touch, because
  // on that photo it cannot tell shadow from product. It has a place, though: it pools at the
  // BOTTOM. So a second, much meaner walk runs only in the lowest fifth of the frame and may
  // remove at most a sixteenth of the product. A white strap that loops down there is a large
  // fraction and trips the cap; a shadow is not.
  if(!pre && !soft){
    const lum=p=>(px[p*4]+px[p*4+1]+px[p*4+2])/3;
    const sat=p=>Math.max(px[p*4],px[p*4+1],px[p*4+2])-Math.min(px[p*4],px[p*4+1],px[p*4+2]);
    let y0=H;
    for(let p=0;p<W*H;p++) if(!bg[p]){ const y=(p-(p%W))/W; if(y<y0) y0=y; }
    const from=Math.round(y0+(H-y0)*0.80);
    const take=new Uint8Array(W*H), q=[];
    for(let y=from;y<H;y++) for(let x=0;x<W;x++){ const p=y*W+x; if(bg[p]) q.push(p); }
    for(let h=0;h<q.length;h++){
      const p=q[h], x=p%W, y=(p-x)/W, L=lum(p);
      for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx, ny=y+dy;
        if(nx<0||ny<from||nx>=W||ny>=H) continue;
        const n=ny*W+nx;
        if(bg[n]||take[n]) continue;
        const nl=lum(n);
        if(nl<205||sat(n)>10||Math.abs(nl-L)>6) continue;
        take[n]=1; q.push(n);
      }
    }
    let want=0; for(let p=0;p<W*H;p++) if(take[p]) want++;
    if(want<=opaqueN*0.0625) for(let p=0;p<W*H;p++) if(take[p]){ bg[p]=1; px[p*4+3]=0; }
  }

  // Background trapped INSIDE the product - the hole in a headphone's headband, the gap between
  // a watch and its strap - is unreachable from the border, so the fill left it and it read as a
  // white blob on the dark cards. Same near-white test as the border fill, so a product body
  // (235-248) is never touched, and only regions big enough to be real holes are cleared, which
  // leaves specular glints on glass alone.
  // Gated on the same measurement as PASS 2, for the same reason: on a product that is itself backdrop-white -
  // the white Galaxy S26 Ultra - an enclosed flat region is as likely to BE the product's back as
  // to be a hole through it, and clearing it tore the phone open. Dark products with light holes,
  // which is every pair of headphones, are exactly the case where it can tell.
  if(!pre && soft){
    // The backdrop is a studio flat, almost always exactly 255. A hole must MATCH it, not merely
    // be near-white: a glossy white phone back has blown highlights at 249-255 too, and clearing
    // those punched ragged holes straight through the Realme and the OnePlus. So the test is the
    // sampled backdrop colour within a couple of levels, and the region has to be flat.
    // Median of all four borders, not the mean of the top row: a product that reaches the top
    // edge drags a mean off the backdrop value, and then flat() starts matching the product.
    const edge=[];
    for(let x=0;x<W;x+=5){ for(const y of [0,H-1]){ const i=(y*W+x)*4; edge.push((px[i]+px[i+1]+px[i+2])/3); } }
    for(let y=0;y<H;y+=5){ for(const x of [0,W-1]){ const i=(y*W+x)*4; edge.push((px[i]+px[i+1]+px[i+2])/3); } }
    edge.sort((a,b)=>a-b);
    const ref=Math.round(edge[edge.length>>1]);
    const flat=i=>{const r=px[i],g=px[i+1],b=px[i+2];
      return Math.abs(r-ref)<=2 && Math.abs(g-ref)<=2 && Math.abs(b-ref)<=2;};
    const MINHOLE=Math.max(64,Math.round(W*H*0.015));   // a headband gap is several % of the frame; a blown highlight on a white back is not
    const seen=new Uint8Array(W*H), q=new Int32Array(W*H);
    for(let p0=0;p0<W*H;p0++){
      if(bg[p0]||seen[p0]||!flat(p0*4)) continue;
      let head=0,tail=0; q[tail++]=p0; seen[p0]=1;
      const cell=[];
      while(head<tail){
        const p=q[head++], x=p%W, y=(p-x)/W; cell.push(p);
        for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=x+dx, ny=y+dy;
          if(nx<0||ny<0||nx>=W||ny>=H) continue;
          const m=ny*W+nx;
          if(seen[m]||bg[m]||!flat(m*4)) continue;
          seen[m]=1; q[tail++]=m;
        }
      }
      if(cell.length>=MINHOLE) for(const p of cell){ bg[p]=1; px[p*4+3]=0; }
    }
  }

  // soften the white halo: opaque light pixels touching transparency fade out
  if(!pre) for(let y=0;y<H;y++)for(let x=0;x<W;x++){
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

  // Press renders are often four panels - side | front | back | side. Split the alpha mask
  // into runs of occupied columns and keep only the wide ones, so the thin side profiles are
  // dropped and the shot shows front and back. A one- or two-panel photo is left alone.
  const colFull=new Uint8Array(W);
  const MINCOL=Math.max(3,Math.round(H*0.03));   // a column counts only with real coverage
  for(let x=0;x<W;x++){let n=0;for(let y=0;y<H;y++){if(px[(y*W+x)*4+3]>24)n++;}colFull[x]=n>=MINCOL?1:0;}
  const segs=[];let run=-1;
  for(let x=0;x<W;x++){ if(colFull[x]){ if(run<0)run=x; } else if(run>=0){ segs.push([run,x-1]); run=-1; } }
  if(run>=0)segs.push([run,W-1]);
  let keepX0=0,keepX1=W-1;
  // >=2, not >=3: the Galaxy Ultras ship with the S Pen lying beside the phone, which is one
  // extra narrow segment. Keeping it made the bounding box wider than the phone, so the phone
  // sat off-centre in its frame. Two panels of a real front/back shot are a similar width and
  // both survive the 45% test.
  if(segs.length>=2){
    const widest=Math.max.apply(null,segs.map(g=>g[1]-g[0]+1));
    const keep=segs.filter(g=>(g[1]-g[0]+1)>=widest*0.45);
    if(keep.length){keepX0=keep[0][0];keepX1=keep[keep.length-1][1];}
  }

  // Speckles. Whatever the fill could not reach - a rim of the plinth, a fragment of a dropped
  // panel, a fleck of studio dust - stays opaque, and on the site's dark cards those flecks read
  // as white grit scattered round the product. Label the opaque pixels and keep only the parts
  // big enough to BE the product: anything under 2% of the largest piece is debris. A genuine
  // front|back pair, or a pair of earbuds, are comparable in size and both survive.
  {
    const lab=new Int32Array(W*H).fill(-1), size=[], q=new Int32Array(W*H);
    let nlab=0;
    for(let p0=0;p0<W*H;p0++){
      if(px[p0*4+3]<=24||lab[p0]>=0) continue;
      let head=0,tail=0; q[tail++]=p0; lab[p0]=nlab; let n=0;
      while(head<tail){
        const p=q[head++], x=p%W, y=(p-x)/W; n++;
        for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=x+dx, ny=y+dy;
          if(nx<0||ny<0||nx>=W||ny>=H) continue;
          const m=ny*W+nx;
          if(lab[m]>=0||px[m*4+3]<=24) continue;
          lab[m]=nlab; q[tail++]=m;
        }
      }
      size[nlab++]=n;
    }
    if(nlab>1){
      let big=0; for(const v of size) if(v>big) big=v;   // apply() over 10k+ components throws
      const min=big*0.02;
      for(let p=0;p<W*H;p++) if(lab[p]>=0&&size[lab[p]]<min) px[p*4+3]=0;
    }
  }

  // Trim to the product's bounding box so every phone fills its frame consistently.
  // alpha>8 counted the faint dust the halo softener leaves scattered over the frame, so the box
  // came out the size of the whole image and the scale-to-fill did nothing - that is why the pink
  // iPhone 15 sat tiny in the middle while its siblings filled the frame. Only solid pixels, and
  // only rows/columns with a real run of them, define the product.
  const SOLID=64, MINRUN=Math.max(3,Math.round(Math.min(W,H)*0.01));
  let x0=W,y0=H,x1=0,y1=0;
  for(let y=0;y<H;y++){let n=0;for(let x=keepX0;x<=keepX1;x++) if(px[(y*W+x)*4+3]>SOLID) n++;
    if(n>=MINRUN){ if(y<y0)y0=y; if(y>y1)y1=y; }}
  for(let x=keepX0;x<=keepX1;x++){let n=0;for(let y=0;y<H;y++) if(px[(y*W+x)*4+3]>SOLID) n++;
    if(n>=MINRUN){ if(x<x0)x0=x; if(x>x1)x1=x; }}
  if(x1<x0||y1<y0){x0=0;y0=0;x1=W-1;y1=H-1;}
  const pad=Math.round(Math.max(x1-x0,y1-y0)*0.02);
  x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(W-1,x1+pad);y1=Math.min(H-1,y1+pad);
  g.putImageData(d,0,0);
  const cw=x1-x0+1, ch=y1-y0+1;
  // Every cutout is trimmed to its own bounding box, so a wide phone and a narrow one ended up
  // filling the frame differently - switching colour on the product page looked like the phone
  // changed size. Draw onto a fixed SQUARE canvas with the product at a fixed share of it, so
  // every image of every product has the same aspect and the same visual scale.
  const SIDE=1200, FILL=0.94, MAXUP=1.12;
  // The product must always fill the frame - capping the enlargement instead just left small
  // sources sitting tiny in a 1200px canvas, which reads as "bad photo" on a big screen.
  // So fill the frame every time and shrink the CANVAS to whatever the source can honestly
  // carry: same layout size on the page, fewer invented pixels in the file.
  const side=Math.min(SIDE,Math.round(Math.max(cw,ch)*MAXUP/FILL));
  const k=Math.min((side*FILL)/cw,(side*FILL)/ch);
  const dw=Math.max(1,Math.round(cw*k)), dh=Math.max(1,Math.round(ch*k));
  const o=document.createElement('canvas');
  o.width=side;o.height=side;
  const og=o.getContext('2d');og.imageSmoothingQuality='high';
  og.drawImage(c,x0,y0,cw,ch,Math.round((side-dw)/2),Math.round((side-dh)/2),dw,dh);
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
