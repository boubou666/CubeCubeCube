import {checkIndex,random,shuffle} from './pocket-core.js';

const cache=new Map(),edge=(a,b)=>[a,b].sort((x,y)=>x-y).join(':');
export function jalonAdjacent(l,a,b){return Number.isInteger(b)&&b>=0&&b<l.cols*l.rows&&Math.abs(a%l.cols-b%l.cols)+Math.abs(Math.floor(a/l.cols)-Math.floor(b/l.cols))===1&&!l.walls.includes(edge(a,b));}
export function jalonNext(l,s){return s.path.reduce((n,id)=>Math.max(n,l.marks[id]||0),1)+1;}
function initial(l){return {path:[l.start]};}
function won(l,s){return s.path.length===l.cols*l.rows&&s.path.at(-1)===l.end&&jalonNext(l,s)===l.markCount+1;}
function move(l,s,a){
  if(!a||!Array.isArray(a.path)||a.path.length<2||a.path.length>l.cols*l.rows||a.path[0]!==s.path.at(-1))return null;
  const path=[...s.path];let next=jalonNext(l,s);
  for(const id of a.path.slice(1)){
    if(!jalonAdjacent(l,path.at(-1),id)||path.includes(id)||l.marks[id]&&l.marks[id]!==next||id===l.end&&path.length!==l.cols*l.rows-1)return null;
    if(l.marks[id])next++;path.push(id);
  }return {path};
}
export function createJalonsLevel(index){
  checkIndex(index);if(cache.has(index))return cache.get(index);
  const tier=Math.floor(index/12),cols=[4,5,5,6][tier],rows=[4,4,5,6][tier],rng=random(101771+index*7919);
  let route=[];for(let y=0;y<rows;y++)for(let n=0;n<cols;n++)route.push(y*cols+(y%2?cols-1-n:n));
  // Backbite transformations retain a Hamiltonian route, but remove the visible zigzag.
  for(let n=0;n<90+index*3;n++){
    if(rng()<.5)route.reverse();const last=route.at(-1),options=route.slice(0,-2).flatMap((id,at)=>Math.abs(id%cols-last%cols)+Math.abs(Math.floor(id/cols)-Math.floor(last/cols))===1?[at]:[]);
    if(options.length){const at=shuffle(options,rng)[0];route=[...route.slice(0,at+1),...route.slice(at+1).reverse()];}
  }
  const marks={},markCount=4+tier,start=route[0],end=route.at(-1);
  for(let n=0;n<markCount;n++)marks[route[Math.round(n*(route.length-1)/(markCount-1))]]=n+1;
  const pathEdges=new Set(route.slice(1).map((id,n)=>edge(route[n],id))),candidate=[];
  for(let id=0;id<cols*rows;id++)for(const to of [id+1,id+cols])if(to<cols*rows&&Math.abs(id%cols-to%cols)+Math.abs(Math.floor(id/cols)-Math.floor(to/cols))===1&&!pathEdges.has(edge(id,to)))candidate.push(edge(id,to));
  const walls=shuffle(candidate,rng).slice(0,[2,4,6,8][tier]),l={index,tier,cols,rows,marks,markCount,start,end,walls,route,solution:route.slice(1).map((id,n)=>({path:[route[n],id]})),title:['Le premier jalon','De nombre en nombre','Toute la petite allée','Le chemin se dessine','Dans le bon ordre','Les détours du jardin','Un mur, un détour','Ne laissez rien derrière','Les petits repères','Le dernier numéro','Une allée complète','Tous les jalons réunis'][index%12]};cache.set(index,l);return l;
}
function plan(l,s){
  if(s.path.every((id,n)=>id===l.route[n]))return l.solution.slice(s.path.length-1);
  const deadline=Date.now()+140,seen=new Set(s.path),path=[...s.path];let visits=0;
  const neighbors=id=>[id-l.cols,id+1,id+l.cols,id-1].filter(to=>jalonAdjacent(l,id,to));
  const walk=()=>{
    if(path.length===l.cols*l.rows)return won(l,{path})?[]:null;
    if(++visits>24000||Date.now()>deadline)return null;
    const from=path.at(-1),candidates=neighbors(from).filter(id=>move(l,{path},{path:[from,id]})).sort((a,b)=>neighbors(a).filter(id=>!seen.has(id)).length-neighbors(b).filter(id=>!seen.has(id)).length);
    for(const id of candidates){path.push(id);seen.add(id);const tail=walk();path.pop();seen.delete(id);if(tail)return [{path:[from,id]},...tail];}return null;
  };return walk();
}
export const jalonsRules={create:createJalonsLevel,initial,move,won,plan,actions:(l,s)=>[s.path.at(-1)-l.cols,s.path.at(-1)+1,s.path.at(-1)+l.cols,s.path.at(-1)-1].flatMap(to=>move(l,s,{path:[s.path.at(-1),to]})?[{path:[s.path.at(-1),to]}]:[])};
