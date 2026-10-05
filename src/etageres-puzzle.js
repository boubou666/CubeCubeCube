import {checkIndex,clone,random,shuffle,searchPlan} from './pocket-core.js';
export const GOODS=['Poire','Confiture','Lait','Citron','Bouquet','Savon','Biscuit','Thé'];
function settle(level,state){let changed=true;while(changed){changed=false;for(let id=0;id<state.fronts.length;id++){const row=state.fronts[id];if(row[0]!==null&&row.every(v=>v===row[0])){state.collected[row[0]]+=3;state.fronts[id]=[null,null,null];changed=true;}if(state.fronts[id].every(v=>v===null)&&state.cursors[id]<level.shelves[id].length){state.fronts[id]=[...level.shelves[id][state.cursors[id]++]];changed=true;}}}return state;}
function initial(level){return settle(level,{fronts:level.shelves.map(()=>[null,null,null]),cursors:level.shelves.map(()=>0),collected:Array(8).fill(0)});}
function move(level,state,action){
  if(!action||!['from','slot','to','cell'].every(k=>Number.isInteger(action[k])))return null;const {from,slot,to,cell}=action;if(from<0||to<0||from>=state.fronts.length||to>=state.fronts.length||slot<0||slot>=3||cell<0||cell>=3||from===to&&slot===cell||state.fronts[from][slot]===null||state.fronts[to][cell]!==null)return null;
  const next=clone(state);next.fronts[to][cell]=next.fronts[from][slot];next.fronts[from][slot]=null;return settle(level,next);
}
const won=(level,state)=>state.fronts.every(row=>row.every(v=>v===null))&&state.cursors.every((n,id)=>n===level.shelves[id].length);
export function shelfPlan(level,start){
  let state=clone(start);const route=[];for(let guard=0;guard<level.total*2;guard++){
    if(won(level,state))return route;
    const counts=Array(8).fill(0);for(const row of state.fronts)for(const color of row)if(color!==null)counts[color]++;
    let target=state.fronts.findIndex(row=>{const goods=row.filter(v=>v!==null);return goods.length>0&&goods.length<3&&goods.every(v=>v===goods[0])&&counts[goods[0]]>=3;});
    let color=target<0?counts.findIndex(n=>n>=3):state.fronts[target].find(v=>v!==null);
    if(target<0)target=state.fronts.findIndex((r,id)=>r.every(v=>v===null)&&state.cursors[id]===level.shelves[id].length);if(target<0||color<0)return null;
    const empty=state.fronts[target].flatMap((v,n)=>v===null?[n]:[]);
    for(const n of empty){const from=state.fronts.findIndex((row,id)=>id!==target&&row.includes(color));if(from<0)return null;const action={from,slot:state.fronts[from].indexOf(color),to:target,cell:n},next=move(level,state,action);if(!next)return null;route.push(action);state=next;}
  }return null;
}
function actions(level,state){const result=[];state.fronts.forEach((row,from)=>row.forEach((color,slot)=>{if(color===null)return;state.fronts.forEach((dest,to)=>dest.forEach((v,cell)=>{if(v===null)result.push({from,slot,to,cell});}));}));return result.sort((a,b)=>state.fronts[b.to].filter(c=>c===state.fronts[b.from][b.slot]).length-state.fronts[a.to].filter(c=>c===state.fronts[a.from][a.slot]).length);}
const cache=new Map();
export function createEtageresLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),filled=3+tier,depth=[1,2,2,3][tier],rng=random(87571+index*6301),colors=shuffle([0,1,2,3,4,5,7],rng).slice(0,filled);
  for(let attempt=0;attempt<150;attempt++){
    const shelves=Array.from({length:filled+2},()=>[]),quotas=Array(8).fill(0);for(let layer=0;layer<depth;layer++){let values;do{values=shuffle(colors.flatMap(c=>[c,c,c]),rng);}while(Array.from({length:filled},(_,id)=>values.slice(id*3,id*3+3)).some(row=>row.every(c=>c===row[0])));for(let id=0;id<filled;id++)shelves[id].push(values.slice(id*3,id*3+3));for(const color of values)quotas[color]++;}
    const level={index,tier,shelves,quotas,total:filled*depth*3,solution:[],title:['Le petit garde-manger','Trois bonnes choses','Un peu de rangement','Les pots du matin','La réserve cachée','Les bonnes étagères','Un panier bien rangé','Le fond du placard','Les petits bouquets','Le grand garde-manger','Encore une tablette','Tout est à sa place'][index%12]},plan=shelfPlan(level,initial(level));if(!plan)continue;level.solution=plan;cache.set(index,level);return clone(level);
  }throw new Error('Could not construct a shelf route');
}
const plans=new Map();
export const etageresRules={create:createEtageresLevel,initial,move,won,actions,plan(level,state){
  const key=s=>`${level.index}:${JSON.stringify(s)}`,cached=plans.get(key(state));if(cached)return clone(cached);
  const route=searchPlan(etageresRules,level,state,0)??shelfPlan(level,state)??searchPlan(etageresRules,level,state,700);if(!route)return null;
  let next=clone(state);for(let i=0;i<route.length;i++){plans.set(key(next),route.slice(i));next=move(level,next,route[i]);}if(plans.size>4000)plans.clear();return clone(route);
}};
