import { checkIndex, clone, random, shuffle } from './pocket-core.js';
import { ROLL_DIRS } from './bascules-puzzle.js';

export function paintSlide(level,at,dir){
  if(!Number.isInteger(dir)||dir<0||dir>3||level.arrows[at]!==undefined&&level.arrows[at]!==dir)return null;
  const path=[at],[dx,dy]=ROLL_DIRS[dir];let x=at%level.cols,y=Math.floor(at/level.cols);
  for(let n=0;n<level.field.length;n++){
    const nx=x+dx,ny=y+dy,id=ny*level.cols+nx;
    if(nx<0||ny<0||nx>=level.cols||ny>=level.rows||!level.field[id])break;
    x=nx;y=ny;path.push(id);if(level.stops.includes(id)||level.arrows[id]!==undefined)break;
  }
  return path.length>1?path:null;
}
function move(level,state,action){
  if(!action)return null;const path=paintSlide(level,state.at,action.dir);if(!path)return null;
  const next=clone(state);next.at=path.at(-1);for(const id of path)next.painted[id]=true;return next;
}
const initial=level=>({at:level.start,painted:level.field.map((v,id)=>Boolean(v&&id===level.start))});
const won=(level,state)=>level.field.every((v,id)=>!v||state.painted[id]);
export function paintPlan(level,start){
  let state=clone(start);const out=[];
  for(let guard=0;guard<level.field.length&&!won(level,state);guard++){
    const queue=[{at:state.at,path:[]}],seen=new Set([state.at]);let found=null;
    for(let n=0;n<queue.length&&!found;n++)for(let dir=0;dir<4;dir++){
      const slide=paintSlide(level,queue[n].at,dir);if(!slide)continue;
      const path=[...queue[n].path,{dir}];
      if(slide.some(id=>!state.painted[id])){found=path;break;}
      const at=slide.at(-1);if(!seen.has(at)){seen.add(at);queue.push({at,path});}
    }
    if(!found)return null;for(const action of found){state=move(level,state,action);out.push(action);}
  }
  return won(level,state)?out:null;
}
const cache=new Map();
export function createSillonsLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));
  const tier=Math.floor(index/12),cols=4+tier,rows=4+tier;
  for(let attempt=0;attempt<1200;attempt++){
    const rng=random(41317+index*4057+attempt*104729),field=Array.from({length:cols*rows},()=>rng()>.17-tier*.025),floor=field.map((v,id)=>v?id:null).filter(v=>v!==null);
    if(floor.length<cols*rows*.55)continue;
    const start=shuffle(floor,rng)[0],stops=shuffle(floor,rng).slice(0,tier),arrows={};stops.push(start);
    const level={index,tier,cols,rows,field,start,stops,arrows,title:['La première couleur','Le tour du jardin','Entre les pierres','Une allée douce','Des coins à retrouver','La petite halte','Au fil du pinceau','Un virage fleuri','Le grand parterre','De case en case','Le bon sens','Tout se colore'][index%12]};
    if(tier>=2)for(const id of shuffle(floor.filter(id=>id!==start),rng).slice(0,tier-1))arrows[id]=Math.floor(rng()*4);
    const queue=[start],seen=new Set(queue),covered=new Set(queue),edges=new Map();
    for(let n=0;n<queue.length;n++){
      const next=[];for(let dir=0;dir<4;dir++){const p=paintSlide(level,queue[n],dir);if(!p)continue;p.forEach(id=>covered.add(id));next.push(p.at(-1));if(!seen.has(p.at(-1))){seen.add(p.at(-1));queue.push(p.at(-1));}}edges.set(queue[n],next);
    }
    if(covered.size!==floor.length)continue;
    const returns=new Set([start]);let changed=true;while(changed){changed=false;for(const [at,next]of edges)if(!returns.has(at)&&next.some(n=>returns.has(n))){returns.add(at);changed=true;}}
    if(returns.size!==seen.size)continue;
    const solution=paintPlan(level,initial(level));if(!solution||solution.length<4+tier)continue;
    level.solution=solution;cache.set(index,level);return clone(level);
  }
  throw new Error(`Cannot construct painting puzzle ${index}`);
}
export const sillonsRules={create:createSillonsLevel,initial,move,won,plan:paintPlan,actions:()=>ROLL_DIRS.map((_,dir)=>({dir}))};
