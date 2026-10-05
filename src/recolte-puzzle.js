import {checkIndex,clone,random,shuffle,searchPlan} from './pocket-core.js';
export function chainNeighbors(level,a,b){return a!==b&&Math.abs(a%level.size-b%level.size)<=1&&Math.abs(Math.floor(a/level.size)-Math.floor(b/level.size))<=1;}
export function validChain(level,state,path){return Array.isArray(path)&&path.length>=3&&path.length<=level.size**2&&new Set(path).size===path.length&&path.every((id,n)=>Number.isInteger(id)&&id>=0&&id<state.field.length&&state.field[id]!==null&&state.field[id]===state.field[path[0]]&&(!n||chainNeighbors(level,path[n-1],id)));}
function move(level,state,action){
  if(!validChain(level,state,action?.path))return null;const next=clone(state),color=next.field[action.path[0]];for(const id of action.path)next.field[id]=null;next.collected[color]+=action.path.length;
  for(let x=0;x<level.size;x++){const column=[];for(let y=level.size-1;y>=0;y--)if(next.field[y*level.size+x]!==null)column.push(next.field[y*level.size+x]);for(let y=level.size-1;y>=0;y--)next.field[y*level.size+x]=column[level.size-1-y]??null;}return next;
}
function actions(level,state){
  const result=[],seen=new Set();
  const visit=path=>{if(path.length>=3){const key=[...path].sort((a,b)=>a-b).join(',');if(!seen.has(key)){seen.add(key);result.push({path:[...path]});}}if(path.length>=8||result.length>700)return;
    const last=path.at(-1);for(let id=0;id<state.field.length;id++)if(state.field[id]===state.field[last]&&!path.includes(id)&&chainNeighbors(level,last,id))visit([...path,id]);};
  for(let id=0;id<state.field.length;id++)if(state.field[id]!==null)visit([id]);return result.sort((a,b)=>b.path.length-a.path.length);
}
export function createRecolteLevel(index){
  checkIndex(index);const tier=Math.floor(index/12),size=5+Math.floor((tier+1)/2),rng=random(105731+index*5797),field=Array(size**2).fill(null),heights=Array(size).fill(0),routes=[],colors=shuffle([0,1,2,3,4,5,7],rng).slice(0,3+tier),quotas=Array(8).fill(0),groups=5+tier*2;
  for(let group=0;group<groups;group++){
    let best=[];for(let trial=0;trial<100;trial++){const hs=[...heights],path=[],length=3+Math.floor(rng()*(2+tier));let x=shuffle(Array.from({length:size},(_,x)=>x),rng).find(x=>hs[x]<size);if(x===undefined)break;
      for(let n=0;n<length;n++){const id=(size-1-hs[x])*size+x;path.push(id);hs[x]++;const options=shuffle([x-1,x,x+1].filter(v=>v>=0&&v<size&&hs[v]<size),rng).filter(v=>chainNeighbors({size},id,(size-1-hs[v])*size+v));if(!options.length)break;x=options[0];}
      if(path.length>best.length)best=path;if(best.length>=length)break;
    }
    if(best.length<3)break;const color=colors[group%colors.length];for(const id of best){field[id]=color;heights[id%size]++;}quotas[color]+=best.length;routes.unshift({path:best});
  }
  return {index,tier,size,field,quotas,total:field.filter(v=>v!==null).length,solution:routes,title:['Les premières baies','Un panier de couleurs','La petite cueillette','Un coin bien rempli','Les couleurs voisines','Le chemin des fruits','De longues récoltes','Le jardin généreux','Encore quelques baies','Les grands paniers','La dernière branche','Toute la récolte'][index%12]};
}
export const recolteRules={create:createRecolteLevel,initial:level=>({field:[...level.field],collected:Array(8).fill(0)}),move,won:(level,state)=>state.field.every(v=>v===null),actions,plan:(level,state)=>searchPlan(recolteRules,level,state,3500)};
