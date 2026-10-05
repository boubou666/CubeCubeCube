import {checkIndex,clone,random,shuffle,searchPlan} from './pocket-core.js';
const DIRS=[[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]];
const adjacent=(size,a,b)=>Math.abs(a%size-b%size)+Math.abs(Math.floor(a/size)-Math.floor(b/size))===1;
const port=(size,a,b)=>b===a-size?1:b===a+1?2:b===a+size?4:8;
export function waterRoute(level,state){
  const path=[level.source],seen=new Set(path);let cell=level.source,incoming=0;
  for(let guard=0;guard<state.field.length;guard++){
    const tile=level.tiles[state.field[cell]];if(!tile||tile.type==='stone')break;
    const dir=DIRS.find(([, ,bit])=>(tile.mask&bit)&&bit!==incoming);if(!dir)break;const [dx,dy,bit,opposite]=dir,x=cell%level.size+dx,y=Math.floor(cell/level.size)+dy;
    if(x<0||y<0||x>=level.size||y>=level.size)break;const next=y*level.size+x,target=level.tiles[state.field[next]];
    if(!target||(target.mask&opposite)===0||seen.has(next))break;path.push(next);seen.add(next);if(next===level.goal)return {path,reached:true,stars:level.stars.filter(id=>seen.has(id)).length};cell=next;incoming=opposite;
  }return {path,reached:false,stars:level.stars.filter(id=>seen.has(id)).length};
}
function move(level,state,action){const a=action?.from,b=action?.to;if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=state.field.length||b>=state.field.length||!adjacent(level.size,a,b)||state.field[a]===null||state.field[b]!==null||level.tiles[state.field[a]].fixed)return null;const next=clone(state);next.field[b]=next.field[a];next.field[a]=null;return next;}
function actions(level,state){const result=[];state.field.forEach((id,from)=>{if(id===null||level.tiles[id].fixed)return;state.field.forEach((v,to)=>{if(v===null&&adjacent(level.size,from,to))result.push({from,to});});});return result;}
const won=(level,state)=>{const route=waterRoute(level,state);return route.reached&&route.stars===level.stars.length;};
const cache=new Map();
export function createRuisseauxLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),size=[4,4,5,6][tier],rng=random(38171+index*7919);
  for(let attempt=0;attempt<100;attempt++){
    let path=Array.from({length:size*size},(_,n)=>Math.floor(n/size)*size+(Math.floor(n/size)%2?size-1-n%size:n%size));
    for(let n=0;n<80+tier*50;n++){const start=rng()<.5,endpoint=start?path[0]:path.at(-1),choices=path.map((cell,i)=>({cell,i})).filter(({cell,i})=>adjacent(size,endpoint,cell)&&(start?i>1:i<path.length-2));if(choices.length){const {i}=choices[Math.floor(rng()*choices.length)];path=start?[...path.slice(0,i).reverse(),...path.slice(i)]:[...path.slice(0,i+1),...path.slice(i+1).reverse()];}}
    path=path.slice(0,size*2+tier*2);const source=path[0],goal=path.at(-1),stars=Array.from({length:1+tier},(_,n)=>path[Math.floor((n+1)*(path.length-1)/(tier+2))]),outside=shuffle(Array.from({length:size*size},(_,n)=>n).filter(n=>!path.includes(n)),rng),holes=outside.slice(0,tier>=2?2:1),stones=tier>=2?outside.slice(2,3+tier-2):[];
    const tiles=Array.from({length:size*size},(_,id)=>({id,mask:[3,5,6,9,10,12][Math.floor(rng()*6)],fixed:false,type:'pipe'}));
    path.forEach((cell,n)=>{tiles[cell].mask=(n?port(size,cell,path[n-1]):0)|(n<path.length-1?port(size,cell,path[n+1]):0);tiles[cell].fixed=n===0||n===path.length-1;});stones.forEach(id=>{tiles[id]={id,mask:0,fixed:true,type:'stone'};});
    const field=tiles.map(t=>holes.includes(t.id)?null:t.id),level={index,tier,size,tiles,field,source,goal,stars,color:index%6,solution:[],title:['Le petit ruisseau','Sous les dalles','Le jardin de l’eau','Un chemin qui glisse','Le détour des gouttes','D’une rive à l’autre','Quelques fleurs à arroser','Les deux places libres','L’eau retrouve sa route','Le tour du jardin','Un passage entre les pierres','Le dernier ruisseau'][index%12]};
    let state={field:[...field]},previous=null;const reverse=[];
    for(let n=0;n<10+tier*9;n++){const choices=actions(level,state).filter(a=>!previous||a.from!==previous.to||a.to!==previous.from);if(!choices.length)break;const a=choices[Math.floor(rng()*choices.length)];state=move(level,state,a);reverse.unshift({from:a.to,to:a.from});previous=a;}
    if(won(level,state)||reverse.length<5)continue;level.field=[...state.field];for(const action of reverse){state=move(level,state,action);level.solution.push(action);if(won(level,state))break;}if(!won(level,state))continue;cache.set(index,level);return clone(level);
  }throw new Error(`Could not build sliding stream ${index}`);
}
const plans=new Map();
export const ruisseauxRules={create:createRuisseauxLevel,initial:l=>({field:[...l.field]}),move,won,actions,plan(level,state){
  const key=s=>`${level.index}:${JSON.stringify(s.field)}`,cached=plans.get(key(state));if(cached)return clone(cached);const route=searchPlan(ruisseauxRules,level,state,2000);if(!route)return null;
  // Scrambling can revisit a position. Remove those detours before caching hints.
  for(let retry=0;retry<route.length;retry++){const seen=new Map();let next=clone(state),loop=false;for(let n=0;n<=route.length;n++){const k=key(next);if(seen.has(k)){const start=seen.get(k);route.splice(start,n-start);loop=true;break;}seen.set(k,n);if(n<route.length)next=move(level,next,route[n]);}if(!loop)break;}
  let next=clone(state);for(let n=0;n<route.length;n++){plans.set(key(next),route.slice(n));next=move(level,next,route[n]);}if(plans.size>4000)plans.clear();return clone(route);
}};
