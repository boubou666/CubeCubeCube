import { checkIndex, clone, random, shuffle } from './pocket-core.js';
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const TITLES = ['Les portes du matin','Les voisins de palier','Le petit détour','Deux chemins','La cour intérieure','La fenêtre ouverte','Les grandes allées','Le passage étroit','Le jeu des places','Un peu de recul','Les portes croisées','La dernière sortie'];
const overlaps = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
function fits(level, blocks, block) {
  return block.x >= 0 && block.y >= 0 && block.x+block.w <= level.size && block.y+block.h <= level.size && !blocks.some(b => b.id !== block.id && overlaps(b,block)) && !level.walls.some(([x,y]) => overlaps(block,{x,y,w:1,h:1}));
}
function move(level,state,action) {
  if (!action || !Number.isInteger(action.id) || !DIRS.some(([x,y]) => x === action.dx && y === action.dy)) return null;
  const block = state.blocks.find(b => b.id === action.id); if (!block) return null;
  const next = clone(state), target = next.blocks.find(b => b.id === action.id); target.x += action.dx; target.y += action.dy;
  if (target.x < 0 || target.y < 0 || target.x+target.w > level.size || target.y+target.h > level.size) {
    const door = level.blocks.find(b => b.id === block.id).door;
    const exits = door.side === 'left' && block.x === 0 && action.dx === -1 && block.y === door.at || door.side === 'right' && block.x+block.w === level.size && action.dx === 1 && block.y === door.at || door.side === 'top' && block.y === 0 && action.dy === -1 && block.x === door.at || door.side === 'bottom' && block.y+block.h === level.size && action.dy === 1 && block.x === door.at;
    if (!exits) return null;
    next.blocks = next.blocks.filter(b => b.id !== block.id); return next;
  }
  return fits(level,next.blocks,target) ? next : null;
}
function placementRoute(level,blocks,initial) {
  const queue = [{block:initial,route:[]}], seen = new Set([`${initial.x},${initial.y}`]);
  for (let n=0;n<queue.length;n++) for (const [dx,dy] of DIRS) {
    const block = {...queue[n].block,x:queue[n].block.x+dx,y:queue[n].block.y+dy}, key = `${block.x},${block.y}`;
    if (seen.has(key) || !fits(level,blocks,block)) continue;
    seen.add(key); queue.push({block,route:[...queue[n].route,{id:block.id,dx,dy}]});
  }
  return queue;
}
function candidate(index,seed) {
  const rng=random(seed), tier=Math.floor(index/12), size=6+Math.min(2,tier), count=3+tier;
  const walls=shuffle(Array.from({length:(size-2)**2},(_,i)=>[i%(size-2)+1,Math.floor(i/(size-2))+1]),rng).slice(0,tier);
  const level={index,tier,title:TITLES[index%12],size,walls,blocks:[],solution:[]}, paths=[], colors=shuffle([0,1,2,3,4,5],rng);
  for (let id=0;id<count;id++) {
    let chosen=null;
    const shapes=shuffle(tier > 0 ? [[1,2],[2,1],[1,3],[3,1],[2,2]] : [[1,2],[2,1],[1,1]],rng);
    for (const [w,h] of shapes) {
      const choices=[];
      for (let at=0;at<size;at++) for (const side of ['left','right','top','bottom']) {
        const span=['left','right'].includes(side)?h:w;
        if (at+span>size || level.blocks.some(b=>b.door.side===side && at < b.door.at+b.door.span && at+span>b.door.at)) continue;
        const x=side==='left'?0:side==='right'?size-w:at, y=side==='top'?0:side==='bottom'?size-h:at;
        const initial={id,color:colors[id],w,h,x,y,door:{side,at,span}};
        if (fits(level,level.blocks,initial)) choices.push(initial);
      }
      for (const initial of shuffle(choices,rng)) {
        const reachable=placementRoute(level,level.blocks,initial).filter(p=>p.route.length >= 2);
        if (!reachable.length) continue;
        reachable.sort((a,b)=>b.route.length-a.route.length);
        chosen=reachable[Math.floor(rng()*Math.max(1,Math.ceil(reachable.length/3)))]; break;
      }
      if (chosen) break;
    }
    if (!chosen) return null;
    level.blocks.push(chosen.block); paths.push(chosen.route);
  }
  for (let id=count-1;id>=0;id--) {
    for (const a of [...paths[id]].reverse()) level.solution.push({id,dx:-a.dx,dy:-a.dy});
    const side=level.blocks[id].door.side, [dx,dy]=({left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1]})[side]; level.solution.push({id,dx,dy});
  }
  let score=level.solution.length;
  for(let id=0;id<count;id++) {
    let block={...level.blocks[id]};
    for(const a of level.solution.filter(a=>a.id===id)) { block={...block,x:block.x+a.dx,y:block.y+a.dy}; score+=level.blocks.filter(b=>b.id>id && overlaps(b,block)).length*3; }
  }
  return {...level,score};
}
export function createPassagesLevel(index) {
  checkIndex(index); let best=null;
  for(let attempt=0;attempt<12;attempt++) { const level=candidate(index,94721+index*7193+attempt*919); if(level && (!best || level.score>best.score)) best=level; }
  if(!best) throw new Error('Could not build passages'); return best;
}
function routeToDoor(level,state,id) {
  const start=state.blocks.find(b=>b.id===id), queue=[{block:start,route:[]}], seen=new Set([`${start.x},${start.y}`]);
  for(let n=0;n<queue.length;n++) for(const [dx,dy] of DIRS) {
    const action={id,dx,dy}, temp={blocks:state.blocks.map(b=>b.id===id?queue[n].block:b)}, next=move(level,temp,action); if(!next) continue;
    const block=next.blocks.find(b=>b.id===id); if(!block) return [...queue[n].route,action];
    const key=`${block.x},${block.y}`; if(seen.has(key)) continue; seen.add(key); queue.push({block,route:[...queue[n].route,action]});
  }
  return null;
}
export const passagesRules={
  create:createPassagesLevel,
  initial:level=>({blocks:clone(level.blocks)}),
  won:(_,state)=>!state.blocks.length,
  move,
  actions:(level,state)=>state.blocks.flatMap(b=>DIRS.map(([dx,dy])=>({id:b.id,dx,dy})).filter(a=>move(level,state,a))),
  plan(level,start) {
    let state=clone(start), plan=[];
    while(state.blocks.length) {
      let route=null; for(const block of [...state.blocks].reverse()) { route=routeToDoor(level,state,block.id); if(route) break; }
      if(!route) return null;
      for(const action of route) { state=move(level,state,action); plan.push(action); }
    }
    return plan;
  },
};
