import { checkIndex, clone, random } from './pocket-core.js';

export const ROLL_DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
export function rollCells(state) {
  return [[state.x,state.y], ...(state.pose==='east'?[[state.x+1,state.y]]:state.pose==='south'?[[state.x,state.y+1]]:[])];
}
export function rollPose(state, dir) {
  const {x,y,pose,gates}=state;
  if(pose==='upright') return [
    {x,y:y-2,pose:'south',gates},{x:x+1,y,pose:'east',gates},
    {x,y:y+1,pose:'south',gates},{x:x-2,y,pose:'east',gates},
  ][dir];
  if(pose==='east') return [
    {x,y:y-1,pose,gates},{x:x+2,y,pose:'upright',gates},
    {x,y:y+1,pose,gates},{x:x-1,y,pose:'upright',gates},
  ][dir];
  return [{x,y:y-1,pose:'upright',gates},{x:x+1,y,pose,gates},
    {x,y:y+2,pose:'upright',gates},{x:x-1,y,pose,gates}][dir];
}
function move(level,state,action) {
  if(!action||!Number.isInteger(action.dir)||action.dir<0||action.dir>3)return null;
  const next=rollPose(state,action.dir),cells=rollCells(next);
  for(const [x,y] of cells){
    if(x<0||y<0||x>=level.cols||y>=level.rows)return null;
    const tile=level.field[y*level.cols+x];
    if(!tile||tile.kind==='bridge'&&!(state.gates&(1<<tile.gate))||tile.kind==='fragile'&&next.pose==='upright')return null;
  }
  const before=new Set(rollCells(state).map(([x,y])=>y*level.cols+x));
  for(const [x,y] of cells){const id=y*level.cols+x,tile=level.field[id];
    if(tile.kind==='plate'&&!before.has(id)&&(!tile.hard||next.pose==='upright'))next.gates^=1<<tile.gate;
  }
  // A toggled bridge must still support the complete footprint.
  if(cells.some(([x,y])=>{const t=level.field[y*level.cols+x];return t.kind==='bridge'&&!(next.gates&(1<<t.gate));}))return null;
  return next;
}
const won=(level,state)=>state.pose==='upright'&&state.y*level.cols+state.x===level.goal;
const initial=level=>clone(level.start);
export function rollPlan(level,start) {
  const key=s=>`${s.x},${s.y},${s.pose},${s.gates}`,queue=[start],seen=new Map([[key(start),null]]),parents=new Map();
  for(let n=0;n<queue.length&&n<12000;n++){
    const state=queue[n];if(won(level,state)){
      const out=[];let k=key(state);while(parents.has(k)){const p=parents.get(k);out.push(p.action);k=p.key;}return out.reverse();
    }
    for(let dir=0;dir<4;dir++){const next=move(level,state,{dir});if(!next||seen.has(key(next)))continue;
      seen.set(key(next),true);parents.set(key(next),{key:key(state),action:{dir}});queue.push(next);
    }
  }
  return null;
}
const cache=new Map();
export function createBasculesLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));
  const tier=Math.floor(index/12),cols=[5,6,7,8][tier],rows=[5,5,6,7][tier];
  for(let attempt=0;attempt<1500;attempt++){
    const rng=random(19373+index*7907+attempt*104729),field=Array.from({length:cols*rows},()=>rng()<.13?null:{kind:'stone'});
    const start={x:tier>=2?0:Math.floor(rng()*cols),y:Math.floor(rng()*rows),pose:'upright',gates:0};
    const goal=tier>=2?Math.floor(rng()*rows)*cols+cols-1:Math.floor(rng()*field.length);
    if(goal===start.y*cols+start.x)continue;
    if(tier>=1)field.forEach((tile,id)=>{if(tile&&rng()<.1)field[id]={kind:'fragile'};});
    if(tier>=2){const cuts=tier===2?[3]:[2,5];cuts.forEach((x,gate)=>{
      for(let y=0;y<rows;y++)field[y*cols+x]=null;
      const y=1+Math.floor(rng()*(rows-2));for(const row of [y,y+1])field[row*cols+x]={kind:'bridge',gate};
      const left=gate?cuts[gate-1]+1:0,width=x-left;
      const plate=Math.floor(rng()*rows)*cols+left+Math.floor(rng()*width);
      field[plate]={kind:'plate',gate,hard:tier===3&&gate===1};
    });}
    field[start.y*cols+start.x]={kind:'stone'};field[goal]={kind:'hole'};
    const level={index,tier,cols,rows,field,start,goal,title:['Le premier galet','Un pas de côté','Au bord du jardin','Le petit détour','D’une rive à l’autre','La dalle légère','Le pont attend','Une pause au soleil','Le bon appui','Un joli virage','Deux petits passages','Le dernier basculement'][index%12]};
    const solution=rollPlan(level,start);if(!solution||solution.length<[4,6,7,11][tier])continue;
    let state=start;const crossed=new Set();for(const action of solution){state=move(level,state,action);for(const [x,y] of rollCells(state)){const t=field[y*cols+x];if(t.kind==='bridge')crossed.add(t.gate);}}
    if(tier>=2&&crossed.size!==(tier===2?1:2))continue;
    level.solution=solution;cache.set(index,level);return clone(level);
  }
  throw new Error(`Cannot construct rolling puzzle ${index}`);
}
export const basculesRules={create:createBasculesLevel,initial,move,won,plan:rollPlan,actions:()=>ROLL_DIRS.map((_,dir)=>({dir}))};
