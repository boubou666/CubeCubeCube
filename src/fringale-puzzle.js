import { checkIndex, clone, random, shuffle } from './pocket-core.js';
import { distance } from './physics-geometry.js';
const TITLES=['Une petite faim','Le jardin des baies','Les fruits du matin','Un peu plus grand','Le coin des douceurs','Le passage étroit','Les petites récoltes','Le grand goûter','Avant de grandir','Un jardin gourmand','Les derniers fruits','La grande fringale'];
export const holeRadius=mass=>13+Math.sqrt(mass)*3;
export const itemNames={berry:'Baie',apple:'Pomme',cake:'Petit gâteau',melon:'Melon',pot:'Pot fleuri'};
const rectDistance=(p,r)=>distance(p,[Math.max(r.x,Math.min(r.x+r.w,p[0])),Math.max(r.y,Math.min(r.y+r.h,p[1]))]);
function penetrations(level,p,radius){return [Math.max(0,50+radius-p[0]),Math.max(0,p[0]+radius-590),Math.max(0,60+radius-p[1]),Math.max(0,p[1]+radius-540),...level.walls.map(r=>Math.max(0,radius-rectDistance(p,r)))];}
export function holeStepAllowed(level,from,to,radius){const before=penetrations(level,from,radius),after=penetrations(level,to,radius);return after.every((p,i)=>p<=1e-6||p<=before[i]+1e-6);}
function clearSegment(level,from,to,radius){const steps=Math.max(1,Math.ceil(distance(from,to)/5));let previous=from;for(let n=1;n<=steps;n++){const p=[from[0]+(to[0]-from[0])*n/steps,from[1]+(to[1]-from[1])*n/steps];if(!holeStepAllowed(level,previous,p,radius))return false;previous=p;}return true;}
export function routeToItem(level,state,id){
  const item=level.items[id];if(!item||state.collected.includes(id)||item.r+3>holeRadius(state.mass))return null;
  const radius=holeRadius(state.mass),start=state.hole,target=[item.x,item.y],nodes=[start,target];
  for(const wall of level.walls)for(const x of [wall.x-radius-2,wall.x+wall.w+radius+2])for(const y of [wall.y-radius-2,wall.y+wall.h+radius+2])if(x>=50+radius&&x<=590-radius&&y>=60+radius&&y<=540-radius)nodes.push([x,y]);
  const distances=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set();distances[0]=0;
  for(let n=0;n<nodes.length;n++){
    let best=-1;for(let id=0;id<nodes.length;id++)if(!visited.has(id)&&(best<0||distances[id]<distances[best]))best=id;
    if(best<0||!Number.isFinite(distances[best]))break;if(best===1){const route=[];for(let id=1;id>=0;id=previous[id])route.unshift(nodes[id]);return route.slice(1);}visited.add(best);
    for(let id=1;id<nodes.length;id++)if(!visited.has(id)&&clearSegment(level,nodes[best],nodes[id],radius)){const d=distances[best]+distance(nodes[best],nodes[id]);if(d<distances[id]){distances[id]=d;previous[id]=best;}}
  }
  return null;
}
export function moveHole(level,state,action,track=false){
  if(!action)return null;let path;
  if(action.type==='visit'&&Number.isInteger(action.id))path=routeToItem(level,state,action.id);
  else if(action.type==='path'&&Array.isArray(action.path)&&action.path.length>0&&action.path.length<=160&&action.path.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=50&&p[0]<=590&&p[1]>=60&&p[1]<=540))path=action.path;
  if(!path)return null;const next=clone(state),trail=[];let moved=false,blocked=false;
  const collect=()=>{let changed=true;while(changed){changed=false;for(const item of level.items)if(!next.collected.includes(item.id)&&item.r+3<=holeRadius(next.mass)&&distance(next.hole,[item.x,item.y])<=holeRadius(next.mass)-item.r){next.collected.push(item.id);next.mass+=item.mass;changed=true;}}};
  for(const target of path){const from=[...next.hole],steps=Math.max(1,Math.ceil(distance(from,target)/5));for(let n=1;n<=steps;n++){
    const p=[from[0]+(target[0]-from[0])*n/steps,from[1]+(target[1]-from[1])*n/steps];if(!holeStepAllowed(level,next.hole,p,holeRadius(next.mass))){blocked=true;break;}
    moved||=distance(next.hole,p)>.01;next.hole=p;collect();if(track)trail.push({hole:[...p],mass:next.mass,collected:[...next.collected]});
  }if(blocked)break;}
  if(!moved&&next.collected.length===state.collected.length)return null;
  return track?{state:next,trail}:next;
}
const won=(level,state)=>state.collected.length===level.items.length;
export function fringalePlan(level,start){
  if(won(level,start))return [];
  let state=clone(start);const route=[],seen=new Set();
  for(let guard=0;guard<level.items.length*4;guard++){
    const key=JSON.stringify(state);if(seen.has(key))return null;seen.add(key);
    let chosen=null;
    for(const item of level.items){if(state.collected.includes(item.id)||item.r+3>holeRadius(state.mass))continue;const action={type:'visit',id:item.id},next=moveHole(level,state,action);if(next&&(next.collected.length>state.collected.length||distance(next.hole,state.hole)>1)){chosen={action,next};break;}}
    if(!chosen)return null;route.push(chosen.action);state=chosen.next;if(won(level,state))return route;
  }
  return null;
}
export function createFringaleLevel(index){
  checkIndex(index);const tier=Math.floor(index/12),rng=random(73951+index*9721),mirror=rng()<.5,flip=p=>[mirror?640-p[0]:p[0],p[1]],walls=[],items=[];
  const add=(x,y,r,mass,kind,color)=>{const p=flip([x,y]);items.push({id:items.length,x:p[0],y:p[1],r,mass,kind,color});};
  if(tier>0){const gap=62-tier*3;walls.push({x:mirror?640-218:200,y:60,w:18,h:205-gap/2-60},{x:mirror?640-218:200,y:205+gap/2,w:18,h:540-205-gap/2});}
  const pocket=shuffle([[100,110],[155,120],[105,180],[150,220],[105,280],[155,320]],rng).slice(0,tier?4+tier%3:0);
  for(const [x,y] of pocket)add(x,y,6,1,'berry',Math.floor(rng()*6));
  const positions=shuffle(Array.from({length:20},(_,id)=>[tier?280+id%4*78:100+id%4*135,110+Math.floor(id/4)*86]),rng);
  const small=5+tier,medium=3+tier,large=2+tier;
  let cursor=0;for(let n=0;n<small;n++){const [x,y]=positions[cursor++];add(x,y,6,1,'berry',Math.floor(rng()*6));}
  for(let n=0;n<medium;n++){const [x,y]=positions[cursor++];add(x,y,12,3,n%2?'cake':'apple',Math.floor(rng()*6));}
  for(let n=0;n<large;n++){const [x,y]=positions[cursor++];add(x,y,19,7,'melon',Math.floor(rng()*6));}
  if(tier>=2){const [x,y]=positions[cursor++];add(x,y,27,12,'pot',Math.floor(rng()*6));}
  const level={index,tier,title:TITLES[index%12],walls,items,start:flip(tier?[125,420]:[320,490]),solution:[]};
  const solution=fringalePlan(level,{hole:[...level.start],mass:0,collected:[]});if(!solution)throw new Error('Could not build a growing-hole route');level.solution=solution;return level;
}
export const fringaleRules={create:createFringaleLevel,initial:level=>({hole:[...level.start],mass:0,collected:[]}),move:(level,state,action)=>moveHole(level,state,action),won,actions:()=>[],plan:fringalePlan};
