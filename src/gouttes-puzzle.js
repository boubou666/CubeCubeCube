import { checkIndex, clone, random } from './pocket-core.js';
import { distance, segmentsMeet, closestOnSegment } from './physics-geometry.js';
import { simulateWater, WATER_TOTAL } from './gouttes-physics.js';
const TITLES=['Un verre au soleil','La petite rampe','Quelques gouttes','La pente douce','Le chemin de l’eau','Un trait de plus','Le détour du jardin','Les deux cascades','Sous le robinet','Le pont des gouttes','Une dernière courbe','Le verre heureux'];
export const inkUsed=lines=>lines.reduce((sum,path)=>sum+path.slice(1).reduce((n,p,i)=>n+distance(p,path[i]),0),0);
export function simplifyStroke(path){
  if(path.length<=2)return clone(path);
  let farthest=0,index=-1;for(let n=1;n<path.length-1;n++){const nearest=closestOnSegment(...path[n],path[0],path.at(-1)),d=distance(path[n],nearest);if(d>farthest){farthest=d;index=n;}}
  if(farthest<=2)return [clone(path[0]),clone(path.at(-1))];
  return [...simplifyStroke(path.slice(0,index+1)).slice(0,-1),...simplifyStroke(path.slice(index))];
}
function allowedLine(level,path){
  if(!Array.isArray(path)||path.length<2||path.length>160||!path.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=35&&p[0]<=605&&p[1]>=75&&p[1]<=550))return false;
  if(inkUsed([path])<8)return false;
  for(const o of level.obstacles){const x=o.x+.2,y=o.y+.2,w=o.w-.4,h=o.h-.4,edges=[[[x,y],[x+w,y]],[[x+w,y],[x+w,y+h]],[[x+w,y+h],[x,y+h]],[[x,y+h],[x,y]]];
    if(path.some(p=>p[0]>x&&p[0]<x+w&&p[1]>y&&p[1]<y+h)||path.slice(1).some((p,i)=>edges.some(([a,b])=>segmentsMeet(path[i],p,a,b))))return false;
  }
  return true;
}
function move(level,state,action){
  if(!action)return null;
  if(action.type==='draw'){
    if(state.lines.length>=12||!allowedLine(level,action.path)||inkUsed([...state.lines,action.path])>level.ink)return null;
    const simplified=simplifyStroke(action.path),path=allowedLine(level,simplified)?simplified:clone(action.path);
    return {...clone(state),lines:[...clone(state.lines),path],result:null};
  }
  if(action.type==='clear')return state.lines.length||state.result?{lines:[],result:null,trial:state.trial}:null;
  if(action.type==='run')return {...clone(state),result:simulateWater(level,state.lines),trial:state.trial+1};
  return null;
}
const won=(level,state)=>(state.result?.caught??0)>=level.goal;
const cache=new Map();
export function createGouttesLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));
  const tier=Math.floor(index/12),rng=random(62851+index*7919),mirror=rng()<.5,flip=p=>[mirror?640-p[0]:p[0],p[1]];
  for(let attempt=0;attempt<80;attempt++){
    const source=flip([90+Math.round(rng()*50),72]),cup={x:mirror?640-(365+Math.round(rng()*105)):365+Math.round(rng()*105),y:410+Math.round(rng()*18),w:78+Math.round(rng()*16),h:85},lines=[];
    const obstacles=[];
    if(tier<2){
      const startY=140+Math.round(rng()*35),end=mirror?cup.x+12:cup.x-12;
      lines.push([flip([mirror?640-source[0]-24:source[0]-24,startY]),[end,cup.y-7]]);
      if(tier===1)obstacles.push({x:mirror?640-(170+55):170,y:300+Math.round(rng()*20),w:55,h:22});
    }else{
      // Two overlapping ramps reverse the stream's direction, each lower than
      // the previous one. The actual particle simulation audits the transfer.
      const sx=mirror?640-source[0]:source[0],turn=430+Math.round(rng()*35),middle=225+Math.round(rng()*20),cx=185+Math.round(rng()*45);
      cup.x=mirror?640-cx:cx;
      lines.push([flip([sx-24,132+Math.round(rng()*20)]),flip([turn,middle])]);
      lines.push([flip([turn+75,middle-10]),flip([turn+75,middle+39]),flip([cx+12,cup.y-7])]);
      obstacles.push({x:mirror?640-(sx+30):sx-30,y:300,w:60,h:23});
      if(tier===3)obstacles.push({x:mirror?640-210:170,y:285,w:40,h:23});
    }
    const level={index,tier,title:TITLES[index%12],source,cup,obstacles,ink:tier<2?680:980,goal:48+tier*2,solution:[...lines.map(path=>({type:'draw',path})),{type:'run'}]};
    if(!lines.every(path=>allowedLine(level,path)))continue;
    const result=simulateWater(level,lines),baseline=simulateWater(level,[]);if(result.caught>=level.goal&&baseline.caught<level.goal){cache.set(index,clone(level));return level;}
  }
  throw new Error('Could not build a working water route');
}
export const gouttesRules={
  create:createGouttesLevel,initial:()=>({lines:[],result:null,trial:0}),move,won,actions:()=>[],
  plan(level,start){
    if(won(level,start))return [];
    const drawings=level.solution.filter(a=>a.type==='draw');let state=clone(start),route=[];
    const prefix=state.lines.every((path,id)=>JSON.stringify(path)===JSON.stringify(drawings[id]?.path));
    if(!prefix){const action={type:'clear'};state=move(level,state,action);route.push(action);}
    for(const action of drawings.slice(state.lines.length)){state=move(level,state,action);if(!state)return null;route.push(action);}
    const run={type:'run'};state=move(level,state,run);return state&&won(level,state)?[...route,run]:null;
  },
};
export {WATER_TOTAL};
