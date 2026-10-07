import {checkIndex,random,shuffle} from './pocket-core.js';

const cache=new Map();
export function cairnTop(s,peg){return s.disks.findIndex(at=>at===peg);}
export function cairnCanMove(l,s,from,to){
  const disk=cairnTop(s,from),top=cairnTop(s,to);
  return from!==to&&disk>=0&&Number.isInteger(to)&&to>=0&&to<l.pegs&&l.links.some(([a,b])=>a===from&&b===to||b===from&&a===to)&&(top<0||disk<top);
}
function move(l,s,a){
  if(!a||!Number.isInteger(a.from)||!cairnCanMove(l,s,a.from,a.to))return null;
  const disks=[...s.disks];disks[cairnTop(s,a.from)]=a.to;return {disks};
}
function initial(l){return {disks:[...l.disks]};}
function won(l,s){return s.disks.every(at=>at===l.goal);}
const actions=(l,s)=>Array.from({length:l.pegs},(_,from)=>Array.from({length:l.pegs},(_,to)=>({from,to}))).flat().filter(a=>cairnCanMove(l,s,a.from,a.to));
const key=s=>s.disks.join('');
function tree(l){
  const start={disks:Array.from({length:l.count},()=>l.goal)},routes=new Map([[key(start),{s:start,action:null,next:null,distance:0}]]),queue=[start];
  for(let n=0;n<queue.length;n++){
    const current=queue[n],parent=routes.get(key(current));
    for(const a of actions(l,current)){
      const next=move(l,current,a),k=key(next);if(routes.has(k))continue;
      routes.set(k,{s:next,action:{from:a.to,to:a.from},next:key(current),distance:parent.distance+1});queue.push(next);
    }
  }return routes;
}
function plan(l,s){
  let node=l.routes.get(key(s));if(!node)return null;const route=[];
  while(node.action){route.push(node.action);node=l.routes.get(node.next);}return route;
}
export function createCairnsLevel(index){
  checkIndex(index);if(cache.has(index))return cache.get(index);
  const tier=Math.floor(index/12),pegs=tier===0?3:4,count=[3,4,5,5][tier],goal=index%pegs,links=[];
  for(let a=0;a<pegs;a++)for(let b=a+1;b<pegs;b++)if(tier<2||tier===2&&!(a===0&&b===2||a===1&&b===3)||tier===3&&b===a+1)links.push([a,b]);
  const l={index,tier,pegs,count,goal,links},routes=tree(l),max=Math.max(...[...routes.values()].map(n=>n.distance)),lower=Math.max(3,Math.floor(max*[.45,.55,.62,.35][tier])),upper=Math.min(max,[7,14,28,48][tier]);
  const options=[...routes.values()].filter(n=>n.distance>=Math.min(lower,upper)&&n.distance<=upper),rng=random(99317+index*7919);
  l.disks=[...shuffle(options,rng)[index%options.length].s.disks];l.routes=routes;l.solution=plan(l,initial(l));
  l.title=['Les premières pierres','Un anneau après l’autre','La petite tour','Une place provisoire','Un sommet à rejoindre','Le bon voisin','Un peu d’équilibre','Un pont de moins','Les chemins du cairn','Le détour des anneaux','Une tour bien rangée','Le dernier sommet'][index%12];
  cache.set(index,l);return l;
}
export const cairnsRules={create:createCairnsLevel,initial,move,won,plan,actions};
