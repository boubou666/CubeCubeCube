import { checkIndex, clone, random, shuffle } from './pocket-core.js';
const TITLES=['Le premier départ','La salle d’attente','Un billet pour deux','Les petits groupes','Un voyage ensemble','Le quai du soleil','La correspondance','Les places du fond','La grande traversée','Tout le monde à bord','Les couleurs du soir','Le dernier départ'];
export function accessiblePassengers(level,state) {
  const occupied=new Set(level.passengers.filter(p=>!state.removed.includes(p.id)).map(p=>`${p.x},${p.y}`)), walls=new Set(level.walls.map(p=>p.join(','))), reached=new Set(), queue=[];
  for(let x=0;x<level.width;x++) queue.push([x,level.height]);
  const visible=new Set();
  for(let n=0;n<queue.length;n++) {
    const [x,y]=queue[n];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const xx=x+dx, yy=y+dy, key=`${xx},${yy}`;
      if(xx<0 || xx>=level.width || yy<0 || yy>level.height || reached.has(key) || walls.has(key)) continue;
      reached.add(key); if(occupied.has(key)) visible.add(key); else queue.push([xx,yy]);
    }
  }
  return level.passengers.filter(p=>!state.removed.includes(p.id) && visible.has(`${p.x},${p.y}`)).map(p=>p.id);
}
export function createVoyageLevel(index) {
  checkIndex(index); const rng=random(42871+index*8111), tier=Math.floor(index/12), width=4+Math.min(tier,2), height=4+tier+(index%3===2?1:0);
  const walls=shuffle(Array.from({length:(width-2)*(height-2)},(_,i)=>[i%(width-2)+1,Math.floor(i/(width-2))+1]),rng).slice(0,tier);
  const wallSet=new Set(walls.map(p=>p.join(','))), passengers=[];
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(!wallSet.has(`${x},${y}`)) passengers.push({id:passengers.length,x,y,color:0});
  const level={index,tier,title:TITLES[index%12],width,height,walls,passengers,buses:[],solution:[],bufferSize:5};
  const state={removed:[]}, colors=shuffle([0,1,2,3,4,5],rng).slice(0,3+tier);
  let previous=-1;
  while(state.removed.length<passengers.length) {
    const color=shuffle(colors.filter(c=>c!==previous),rng)[0], count=Math.min(2+Math.floor(rng()*(2+tier)),passengers.length-state.removed.length);
    level.buses.push({color,count}); previous=color;
    for(let n=0;n<count;n++) { const ids=accessiblePassengers(level,state); if(!ids.length) throw new Error('Unreachable passenger'); const id=ids[Math.floor(rng()*ids.length)]; passengers[id].color=color; state.removed.push(id); level.solution.push(id); }
  }
  return level;
}
function settle(level,state) {
  while(state.bus<level.buses.length) {
    const bus=level.buses[state.bus];
    for(let n=state.buffer.length-1;n>=0 && state.boarded<bus.count;n--) if(level.passengers[state.buffer[n]].color===bus.color) {state.buffer.splice(n,1);state.boarded++;}
    if(state.boarded<bus.count) break; state.bus++;state.boarded=0;
  }
}
export const voyageRules={
  create:createVoyageLevel,
  initial:()=>({removed:[],buffer:[],bus:0,boarded:0}),
  won:(level,state)=>state.removed.length===level.passengers.length && state.buffer.length===0 && state.bus===level.buses.length,
  actions(level,state) { return accessiblePassengers(level,state).sort((a,b)=>Number(level.passengers[b].color===level.buses[state.bus]?.color)-Number(level.passengers[a].color===level.buses[state.bus]?.color)); },
  move(level,state,id) {
    if(!Number.isInteger(id) || !accessiblePassengers(level,state).includes(id)) return null;
    const next=clone(state);next.removed.push(id);next.buffer.push(id);settle(level,next);return next.buffer.length>level.bufferSize?null:next;
  },
};
