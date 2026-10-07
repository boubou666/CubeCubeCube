import {checkIndex,clone,random,shuffle} from './pocket-core.js';
import {simulateRails} from './rail-simulation.js';
function move(l,s,a){if(!a)return null;const next=clone(s);if(a.type==='switch'){if(!Number.isInteger(a.id)||!l.switches[a.id])return null;next.switches[a.id]=1-next.switches[a.id];next.result=null;}
  else if(a.type==='delay'){if(!Number.isInteger(a.id)||!l.trains[a.id]||!Number.isInteger(a.value)||a.value<0||a.value>12||a.value===s.delays[a.id])return null;next.delays[a.id]=a.value;next.result=null;}
  else if(a.type==='run'){next.trial++;next.result=simulateRails(l,next);}else return null;return next;}
const won=(l,s)=>s.result?.caught===l.trains.length;
const cache=new Map();
export function createAiguillagesLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),size=[5,6,7,8][tier],mid=Math.floor(size/2),col=size-2,rng=random(61703+index*7919),field=Array(size*size).fill(null),switches=[],trains=[],targets=[],detour=tier>=1&&(tier>=2||index%2===0),length=tier>=2?2:1;
  const put=(x,y,t)=>{field[y*size+x]=t;};const rail=(x,y,mask)=>{const id=y*size+x;if(field[id]?.type==='rail'){field[id].mask|=mask;if(field[id].mask===15)field[id].type='cross';}else put(x,y,{type:'rail',mask});};
  const junction=(x,y,stem,options,target)=>{const id=switches.length;switches.push({id,cell:y*size+x,stem,options});targets.push(target);put(x,y,{type:'switch',id});};
  const color=index%6;for(let x=0;x<size;x++)rail(x,mid,10);put(0,mid,{type:'source',mask:2,color});put(size-1,mid,{type:'station',mask:8,color});trains.push({id:0,source:mid*size,color,dir:1,length});
  junction(1,mid,3,[1,0],detour?1:0);
  if(tier>=1){junction(3,mid,1,[3,0],detour?1:0);for(let y=mid-2;y<mid;y++){rail(1,y,5);rail(3,y,5);}for(let x=1;x<=3;x++)rail(x,mid-2,10);put(1,mid-2,{type:'rail',mask:6});put(3,mid-2,{type:'rail',mask:12});if(detour)put(2,mid,{type:'pond',mask:0});}
  else rail(1,mid-1,4);
  if(tier>=1){const c=(color+2)%6;for(let y=0;y<size;y++)rail(col,y,5);put(col,mid,{type:'cross',mask:15});put(col,0,{type:'source',mask:4,color:c});put(col,size-1,{type:'station',mask:1,color:c});trains.push({id:1,source:col,color:c,dir:2,length});junction(col,mid+1,0,[2,3],0);rail(col-1,mid+1,2);}
  if(tier>=2){const row=size-2,c=(color+4)%6;for(let x=0;x<size;x++)rail(x,row,10);put(col,row,{type:'cross',mask:15});put(0,row,{type:'source',mask:2,color:c});put(size-1,row,{type:'station',mask:8,color:c});trains.push({id:2,source:row*size,color:c,dir:1,length});junction(2,row,3,[1,0],0);rail(2,row-1,4);}
  const danger=col+(detour?4:0)-mid,safeDelays=trains.map((_,id)=>id===0?0:id===1?danger+length+1:12),delays=trains.map((_,id)=>id===0?0:id===1?danger:safeDelays[1]+size-2-col),values=targets.map(()=>Math.floor(rng()*2));if(values.every((v,id)=>v===targets[id]))values[0]=1-values[0];
  const l={index,tier,size,field,switches,trains,targets,safeDelays,values,delays,solution:[],title:['Le premier petit train','La voie du jardin','Un départ de plus','Le bon aiguillage','Les trains se rencontrent','Attendez un petit tour','Le détour du lac','Chacun sa gare','Deux wagons au soleil','Le passage commun','Les départs du soir','Tous les trains à la maison'][index%12]};
  if(index%12>=6){const map=id=>Math.floor(id/size)*size+size-1-id%size,dir=d=>d===1?3:d===3?1:d,mapped=Array(size*size).fill(null);field.forEach((t,id)=>{if(!t)return;const tile={...t};if(tile.mask!==undefined)tile.mask=[0,1,2,3].reduce((mask,d)=>mask|((t.mask&(1<<d))?1<<dir(d):0),0);mapped[map(id)]=tile;});l.field=mapped;l.switches=switches.map(s=>({...s,cell:map(s.cell),stem:dir(s.stem),options:s.options.map(dir)}));l.trains=trains.map(t=>({...t,source:map(t.source),dir:dir(t.dir)}));}
  for(const id of shuffle(targets.map((_,id)=>id),rng))if(values[id]!==targets[id])l.solution.push({type:'switch',id});for(let id=0;id<trains.length;id++)if(delays[id]!==safeDelays[id])l.solution.push({type:'delay',id,value:safeDelays[id]});l.solution.push({type:'run'});
  let s=initial(l);for(const a of l.solution)s=move(l,s,a);if(!won(l,s))throw new Error(`Failed rail route ${index}: ${JSON.stringify(s.result)}`);cache.set(index,l);return clone(l);
}
function initial(l){return {switches:[...l.values],delays:[...l.delays],trial:0,result:null};}
export const aiguillagesRules={create:createAiguillagesLevel,initial,move,won,actions:(l,s)=>[...l.switches.map(t=>({type:'switch',id:t.id})),{type:'run'}],plan(l,s){
  if(simulateRails(l,s).caught===l.trains.length)return [{type:'run'}];let next=clone(s);const out=[];for(let id=0;id<l.switches.length;id++)if(next.switches[id]!==l.targets[id]){const a={type:'switch',id};out.push(a);next=move(l,next,a);}for(let id=0;id<l.trains.length;id++)if(next.delays[id]!==l.safeDelays[id]){const a={type:'delay',id,value:l.safeDelays[id]};out.push(a);next=move(l,next,a);}out.push({type:'run'});return won(l,move(l,next,{type:'run'}))?out:null;
}};
