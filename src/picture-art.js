import { NEW_COLONY_ART } from './colony-art.js';
const BACKGROUND={moss:0,cream:6,coral:1,gold:3,plum:4,sky:2,ink:7,leaf:0};
const INK={m:0,e:6,c:1,g:3,p:4,s:2,i:7,l:0};
// The collection's own original illustrations become paintings and embroidery.
export function pictureArt(index,size=16) {
  const art=NEW_COLONY_ART[index%NEW_COLONY_ART.length], mirrored=Math.floor(index/18)%2;
  const cells=[];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const sx=Math.min(15,Math.floor((mirrored?size-1-x:x)/size*16)), sy=Math.min(15,Math.floor(y/size*16));
    const char=art.rows[sy]?.[sx] || '.'; cells.push(char==='.'?BACKGROUND[art.background]:INK[char]??BACKGROUND[art.background]);
  }
  return {title:art.title,size,cells};
}
export function pictureFrontier(level,removed) {
  const gone=new Set(removed), seen=new Set(), queue=[], result=new Set(), size=level.size;
  const inspect=id=>{if(id<0 || id>=size*size || seen.has(id))return;seen.add(id);if(gone.has(id))queue.push(id);else result.add(id);};
  for(let n=0;n<size;n++) {inspect(n);inspect((size-1)*size+n);inspect(n*size);inspect(n*size+size-1);}
  for(let n=0;n<queue.length;n++) {const id=queue[n],x=id%size,y=Math.floor(id/size);if(x)inspect(id-1);if(x<size-1)inspect(id+1);if(y)inspect(id-size);if(y<size-1)inspect(id+size);}
  return [...result].sort((a,b)=>a-b);
}
export function peelColor(level,removed,color,quota) {
  const next=[...removed], hits=[];
  while(hits.length<quota) {const id=pictureFrontier(level,next).find(id=>level.cells[id]===color);if(id===undefined)break;next.push(id);hits.push(id);}
  return hits;
}
