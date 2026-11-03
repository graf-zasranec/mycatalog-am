import fs from 'node:fs';
import {createHash} from 'node:crypto';

// Measurements are tied to the exact native cutout, never its padded canvas or thumbnail.
export function photoQuality(file, metrics, read=fs.readFileSync) {
  const m=metrics?.[file], unknown={state:'unmeasured'};
  if(!m||m.alphaThreshold!==128||!Number.isInteger(m.width)||m.width<1
      ||!Number.isInteger(m.height)||m.height<1||!Array.isArray(m.visibleBounds)
      ||m.visibleBounds.length!==4||!m.visibleBounds.every(Number.isInteger))return unknown;
  const [x0,y0,x1,y1]=m.visibleBounds;
  if(x0<0||y0<0||x1>m.width||y1>m.height||x1<=x0||y1<=y0)return unknown;
  let hash;try{hash=createHash('sha256').update(read(file)).digest('hex');}catch{return unknown;}
  if(hash!==m.sha256)return unknown;
  const visibleLong=Math.max(x1-x0,y1-y0);
  return {state:visibleLong<600?'too small':'adequate',width:m.width,height:m.height,
    visibleWidth:x1-x0,visibleHeight:y1-y0,visibleLong};
}
