import {checkIndex,clone,random} from './pocket-core.js';
import {SOIL,excavate,simulateSoil} from './terriers-physics.js';
function initial(level){return {soil:[...level.soil],strokes:[],removed:0,result:null,trial:0};}
function move(level,state,action){
  if(action?.type==='dig'){
    const path=action.path;if(!Array.isArray(path)||path.length<2||path.length>160||!path.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=56&&p[0]<=584&&p[1]>=80&&p[1]<=528)||state.strokes.length>=24)return null;
    const dug=excavate(state.soil,path);if(!dug.removed||state.removed+dug.removed>level.budget)return null;
    return {...clone(state),soil:dug.soil,removed:state.removed+dug.removed,strokes:[...clone(state.strokes),clone(path)],result:null};
  }
  if(action?.type==='run')return {...clone(state),result:simulateSoil(level,state.soil),trial:state.trial+1};
  if(action?.type==='clear')return state.removed||state.result?{...initial(level),trial:state.trial}:null;
  return null;
}
const won=(level,state)=>state.result?.caught===level.balls.length;
const cache=new Map();
export function createTerriersLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),count=[1,2,2,3][tier],rng=random(23891+index*7919);
  for(let attempt=0;attempt<60;attempt++){
    const soil=Array(SOIL.cols*SOIL.rows).fill(1),balls=[],cups=[],paths=[],rocks=[];
    for(let n=0;n<count;n++){
      const center=56+(n+.5)*528/count,sign=rng()<.5?-1:1,offset=28+Math.round(rng()*23),sx=center-sign*offset,cx=center+sign*offset,color=(n+index)%6;
      balls.push({x:sx,y:120,color});cups.push({x:cx,y:478,w:54,color});
      const bend=tier<2?[[sx,120],[cx,450]]:[[sx,120],[center+sign*(18+Math.round(rng()*9)),245],[center-sign*(8+Math.round(rng()*9)),345],[cx,450]];
      paths.push(bend);if(tier>=1)rocks.push({x:center-sign*44,y:310+Math.round(rng()*28),w:30,h:34});
    }
    for(let y=0;y<SOIL.rows;y++)for(let x=0;x<SOIL.cols;x++){
      const px=SOIL.x+(x+.5)*4,py=SOIL.y+(y+.5)*4,id=y*SOIL.cols+x;
      if(balls.some(b=>Math.hypot(px-b.x,py-b.y)<27)||cups.some(c=>Math.abs(px-c.x)<31&&py>450))soil[id]=0;
      if(rocks.some(o=>px>=o.x&&px<=o.x+o.w&&py>=o.y&&py<=o.y+o.h))soil[id]=2;
    }
    const level={index,tier,soil,balls,cups,rocks,title:['Un chemin sous terre','Le petit terrier','Sous les racines','La pente du jardin','Un passage creusé','Les deux voisins','La terre se libère','Le détour des pierres','Un peu de gravité','Des billes à guider','La dernière descente','Chacun son terrier'][index%12],budget:100000,solution:paths.map(path=>({type:'dig',path}))};
    let state=initial(level);for(const action of level.solution)state=move(level,state,action);const result=simulateSoil(level,state.soil);
    if(result.caught!==count)continue;level.budget=Math.ceil(state.removed*(tier===3?1.25:1.4));level.solution.push({type:'run'});cache.set(index,level);return clone(level);
  }throw new Error(`Could not construct soil route ${index}`);
}
export const terriersRules={create:createTerriersLevel,initial,move,won,actions:()=>[],plan(level,start){
  if(won(level,start))return [];let state=clone(start),route=[];const drawings=level.solution.filter(a=>a.type==='dig');
  if(!state.strokes.every((p,n)=>JSON.stringify(p)===JSON.stringify(drawings[n]?.path))){const clear={type:'clear'};state=move(level,state,clear);route.push(clear);}
  for(const action of drawings.slice(state.strokes.length)){state=move(level,state,action);if(!state)return null;route.push(action);}
  const run={type:'run'};state=move(level,state,run);return state&&won(level,state)?[...route,run]:null;
}};
