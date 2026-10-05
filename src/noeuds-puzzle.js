import { checkIndex, clone, random, shuffle } from './pocket-core.js';
import { segmentsMeet } from './physics-geometry.js';
const TITLES=['Les premiers fils','Un joli méli-mélo','La bonne attache','Le petit détour','Entre deux couleurs','Une place de libre','Les fils du jardin','Les points fixes','De fil en aiguille','Une boucle à défaire','Tout se détend','Le dernier nœud'];
export function ropeCrossings(level,state){
  const conflicts=[];
  for(let a=0;a<level.ropes.length;a++)for(let b=a+1;b<level.ropes.length;b++){
    const r=level.ropes[a],s=level.ropes[b];if(segmentsMeet(level.pegs[state.pins[r.a]],level.pegs[state.pins[r.b]],level.pegs[state.pins[s.a]],level.pegs[state.pins[s.b]]))conflicts.push([a,b]);
  }
  return conflicts;
}
function move(level,state,action){
  if(!action||!Number.isInteger(action.pin)||!Number.isInteger(action.peg)||!level.pins[action.pin]||!level.pegs[action.peg]||level.pins[action.pin].fixed||state.pins.includes(action.peg))return null;
  const next=clone(state);next.pins[action.pin]=action.peg;return next;
}
const won=(level,state)=>ropeCrossings(level,state).length===0;
export function untanglePlan(level,start){
  if(won(level,start))return [];
  let state=clone(start);const plan=[];
  for(let guard=0;guard<level.pins.length*3;guard++){
    const pin=level.pins.findIndex((p,id)=>!p.fixed&&state.pins[id]!==level.targets[id]);if(pin<0)return won(level,state)?plan:null;
    const target=level.targets[pin],occupant=state.pins.indexOf(target);
    if(occupant>=0){if(level.pins[occupant].fixed)return null;const free=level.pegs.findIndex((_,id)=>!state.pins.includes(id)&&!level.targets.includes(id));if(free<0)return null;const action={pin:occupant,peg:free};state=move(level,state,action);if(!state)return null;plan.push(action);if(won(level,state))return plan;}
    const action={pin,peg:target};state=move(level,state,action);if(!state)return null;plan.push(action);if(won(level,state))return plan;
  }
  return null;
}
export function createNoeudsLevel(index){
  checkIndex(index);const tier=Math.floor(index/12),count=3+tier,size=4+tier,rng=random(37619+index*10949),colors=shuffle([0,1,2,3,4,5,6,7],rng);
  const rotate=Math.floor(rng()*4),transform=([x,y])=>rotate===0?[x,y]:rotate===1?[size-1-y,x]:rotate===2?[size-1-x,size-1-y]:[y,size-1-x];
  const pegs=Array.from({length:size**2},(_,id)=>transform([id%size,Math.floor(id/size)])),pins=[],ropes=[],targets=[];
  const rows=shuffle(Array.from({length:size},(_,i)=>i),rng).slice(0,count);
  for(let rope=0;rope<count;rope++){
    const ends=shuffle([0,size-1],rng),row=rows[rope],a=pins.length;
    pins.push({color:colors[rope],fixed:tier>0&&rope<tier},{color:colors[rope],fixed:false});ropes.push({a,b:a+1,color:colors[rope]});targets.push(row*size+ends[0],row*size+ends[1]);
  }
  const level={index,tier,title:TITLES[index%12],size,pegs,pins,ropes,targets};let best;
  for(let attempt=0;attempt<60;attempt++){
    const fixed=new Set(targets.filter((_,id)=>pins[id].fixed)),free=shuffle(pegs.map((_,id)=>id).filter(id=>!fixed.has(id)),rng);let cursor=0;
    const placements=targets.map((peg,id)=>pins[id].fixed?peg:free[cursor++]),state={pins:placements},crossings=ropeCrossings(level,state).length;
    if(crossings>=2+tier&&(!best||crossings>best.crossings)){const solution=untanglePlan(level,state);if(solution?.length>=2)best={placements,crossings,solution};}
  }
  if(!best)throw new Error('Could not build crossed ropes');return {...level,placements:best.placements,solution:best.solution};
}
export const noeudsRules={create:createNoeudsLevel,initial:level=>({pins:[...level.placements]}),move,won,actions:()=>[],plan:untanglePlan};
