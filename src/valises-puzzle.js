import {checkIndex,clone,random,shuffle} from './pocket-core.js';
export function luggageCells(piece,turns=0){let cells=clone(piece.cells);for(let n=0;n<turns;n++)cells=cells.map(([x,y])=>[-y,x]);const minX=Math.min(...cells.map(p=>p[0])),minY=Math.min(...cells.map(p=>p[1]));return cells.map(([x,y])=>[x-minX,y-minY]);}
export function luggageFootprint(level,piece,a){return luggageCells(piece,a.turns).map(([x,y])=>[x+a.x,y+a.y]);}
function move(l,s,a){
  if(!a||!Number.isInteger(a.id)||!l.pieces[a.id])return null;const old=s.placed[a.id],next=clone(s);
  if(a.type==='remove'){if(!old)return null;next.field=next.field.map(v=>v===a.id?null:v);next.placed[a.id]=null;return next;}
  if(a.type!=='place'||!Number.isInteger(a.turns)||a.turns<0||a.turns>3||!Number.isInteger(a.x)||!Number.isInteger(a.y))return null;
  if(old&&old.x===a.x&&old.y===a.y&&old.turns===a.turns)return null;
  const cells=luggageFootprint(l,l.pieces[a.id],a);if(cells.some(([x,y])=>x<0||y<0||x>=l.cols||y>=l.rows||!l.mask[y*l.cols+x]||(s.field[y*l.cols+x]!==null&&s.field[y*l.cols+x]!==a.id)))return null;
  next.field=next.field.map(v=>v===a.id?null:v);for(const [x,y] of cells)next.field[y*l.cols+x]=a.id;next.placed[a.id]={x:a.x,y:a.y,turns:a.turns};return next;
}
const won=(l,s)=>s.placed.every(Boolean)&&s.field.every(v=>v!==null);
const cache=new Map();
export function createValisesLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),cols=[4,5,6,7][tier],rows=[4,5,5,6][tier],rng=random(63017+index*7919),mask=Array(cols*rows).fill(true);
  if(tier>=1){mask[index%2?cols-1:0]=false;mask[index%3?rows*cols-1:(rows-1)*cols]=false;}if(tier===3){mask[cols]=false;mask[rows*cols-2]=false;}
  const open=new Set(mask.flatMap((v,id)=>v?[id]:[])),pieces=[],targets=[];
  while(open.size){const first=shuffle([...open],rng)[0],cells=[first];open.delete(first);const target=3+Math.floor(rng()*(tier+2));
    while(cells.length<target){const options=[...new Set(cells.flatMap(id=>[-cols,cols,-1,1].map(d=>id+d).filter(n=>open.has(n)&&(Math.abs(n-id)!==1||Math.floor(n/cols)===Math.floor(id/cols)))))];if(!options.length)break;const id=options[Math.floor(rng()*options.length)];cells.push(id);open.delete(id);}
    const left=Math.min(...cells.map(id=>id%cols)),top=Math.min(...cells.map(id=>Math.floor(id/cols))),id=pieces.length,turns=Math.floor(rng()*4),shape=cells.map(n=>[n%cols-left,Math.floor(n/cols)-top]);pieces.push({id,cells:luggageCells({cells:shape},turns),color:(index+id)%6,icon:(id+index)%8});targets.push({type:'place',id,turns:(4-turns)%4,x:left,y:top});
  }
  const l={index,tier,cols,rows,mask,pieces,order:shuffle(pieces.map(p=>p.id),rng),solution:shuffle(targets,rng),title:['La petite valise','Une place pour le chapeau','Le départ du matin','Les affaires du jardin','Le coin des souvenirs','Un petit rangement','Avant le voyage','Le sac se referme','Chacun sa place','Tout rentre encore','Les bagages du soir','Prêts pour partir'][index%12]};let s=initial(l);for(const a of l.solution){s=move(l,s,a);if(!s)throw new Error(`Blocked luggage ${index}`);}if(!won(l,s))throw new Error('Unfilled luggage');cache.set(index,l);return clone(l);
}
function initial(l){return {field:l.mask.map(v=>v?null:-1),placed:l.pieces.map(()=>null)};}
function plan(l,s){const out=[],canonical=new Map(l.solution.map(a=>[a.id,a]));let next=clone(s);for(const p of l.pieces){const placed=next.placed[p.id];if(!placed)continue;const ids=a=>luggageFootprint(l,p,a).map(([x,y])=>y*l.cols+x).sort((a,b)=>a-b).join(',');if(ids(placed)!==ids(canonical.get(p.id))){const a={type:'remove',id:p.id};next=move(l,next,a);out.push(a);}}
  for(const a of l.solution)if(!next.placed[a.id]){next=move(l,next,a);if(!next)return null;out.push(a);}return won(l,next)?out:null;
}
export const valisesRules={create:createValisesLevel,initial,move,won,plan,actions:(l,s)=>l.pieces.flatMap(p=>s.placed[p.id]?[{type:'remove',id:p.id}]:[])};
