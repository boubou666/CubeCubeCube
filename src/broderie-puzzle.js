import { checkIndex, clone, random, shuffle } from './pocket-core.js';
import { pictureArt } from './picture-art.js';
const overlaps=(a,b)=>Math.abs(a.x-b.x)<.96 && Math.abs(a.y-b.y)<.96;
export function accessibleSpools(level,state) {return level.spools.filter(s=>!state.removed.includes(s.id) && !level.spools.some(cover=>cover.layer>s.layer && !state.removed.includes(cover.id) && overlaps(s,cover))).map(s=>s.id);}
export function createBroderieLevel(index) {
  checkIndex(index);const rng=random(72971+index*9059),tier=Math.floor(index/12),art=pictureArt(index),count=24+tier*9+(index%3)*3;
  const level={index,tier,...art,spools:[],patches:[],solution:[],bufferSize:7};
  for(let layer=0;level.spools.length<count;layer++) {
    const side=layer%2?3:4,offset=layer%2?.5:0;
    for(const id of shuffle(Array.from({length:side*side},(_,i)=>i),rng)) {
      level.spools.push({id:level.spools.length,x:id%side+offset,y:Math.floor(id/side)+offset,layer,color:0});if(level.spools.length===count)break;
    }
  }
  const colors=shuffle([...new Set(level.cells)],rng),groups=[...colors],totals=new Map(colors.map(c=>[c,level.cells.filter(n=>n===c).length]));
  while(groups.length<count/3) {
    const eligible=colors.filter(c=>groups.filter(g=>g===c).length<totals.get(c));groups.push(eligible[Math.floor(rng()*eligible.length)]);
  }
  const ordered=shuffle(groups,rng),state={removed:[]};
  for(let n=0;n<count;n++) {const ready=accessibleSpools(level,state),id=ready[Math.floor(rng()*ready.length)];level.spools[id].color=ordered[Math.floor(n/3)];state.removed.push(id);level.solution.push(id);}
  for(const color of colors) {
    const pixels=level.cells.map((c,id)=>c===color?id:null).filter(id=>id!==null),parts=groups.filter(c=>c===color).length;
    for(let n=0;n<parts;n++) level.patches.push({id:level.patches.length,color,pixels:pixels.slice(Math.floor(n*pixels.length/parts),Math.floor((n+1)*pixels.length/parts))});
  }
  return level;
}
export const broderieRules={
  create:createBroderieLevel,
  initial:()=>({removed:[],buffer:[],stitched:[]}),
  won:(level,state)=>state.removed.length===level.spools.length && !state.buffer.length && state.stitched.length===level.patches.length,
  actions:(level,state)=>accessibleSpools(level,state).sort((a,b)=>state.buffer.filter(c=>c===level.spools[b].color).length-state.buffer.filter(c=>c===level.spools[a].color).length),
  move(level,state,id) {
    if(!Number.isInteger(id) || !accessibleSpools(level,state).includes(id))return null;
    const next=clone(state),color=level.spools[id].color;next.removed.push(id);next.buffer.push(color);
    if(next.buffer.filter(c=>c===color).length===3) {
      next.buffer=next.buffer.filter(c=>c!==color);const patch=level.patches.find(p=>p.color===color && !next.stitched.includes(p.id));if(!patch)return null;next.stitched.push(patch.id);
    }
    return next.buffer.length>level.bufferSize?null:next;
  },
};
