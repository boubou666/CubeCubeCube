import {checkIndex,random,shuffle} from './pocket-core.js';

const DIRS=[[0,-1],[1,0],[0,1],[-1,0]],cache=new Map();
export function crateNeighbor(l,at,dir){
  const d=DIRS[dir];if(!d)return null;
  const x=at%l.cols+d[0],y=Math.floor(at/l.cols)+d[1];
  return x>=0&&y>=0&&x<l.cols&&y<l.rows&&l.floor[y*l.cols+x]?y*l.cols+x:null;
}
function initial(l){return {at:l.start,boxes:[...l.boxes]};}
function won(l,s){return s.boxes.every(id=>l.goals.includes(id));}
function move(l,s,a){
  if(!a||!Number.isInteger(a.dir)||a.dir<0||a.dir>3)return null;
  const at=crateNeighbor(l,s.at,a.dir);if(at===null)return null;
  const box=s.boxes.indexOf(at),boxes=[...s.boxes];
  if(box>=0){const to=crateNeighbor(l,at,a.dir);if(to===null||boxes.includes(to))return null;boxes[box]=to;}
  return {at,boxes};
}
const key=s=>`${s.at}:${[...s.boxes].sort((a,b)=>a-b)}`;
export function createCagettesLevel(index){
  checkIndex(index);if(cache.has(index))return cache.get(index);
  const tier=Math.floor(index/12),cols=[7,7,8,8][tier],rows=[6,7,7,8][tier],count=[2,2,3,3][tier];
  for(let salt=0;salt<200;salt++){
    const rng=random(92771+index*7919+salt*104729),floor=Array.from({length:cols*rows},(_,id)=>{const x=id%cols,y=Math.floor(id/cols);return x>0&&y>0&&x<cols-1&&y<rows-1;}),inside=floor.flatMap((v,id)=>v?[id]:[]);
    // Small interior hedges change the routes without copying a warehouse layout.
    for(const cell of shuffle(inside,rng).slice(0,tier+1))floor[cell]=false;
    const places=shuffle(inside.filter(id=>floor[id]&&DIRS.every((_,dir)=>crateNeighbor({cols,rows,floor},id,dir)!==null)),rng);
    if(places.length<count)continue;
    const goals=places.slice(0,count),start=shuffle(inside.filter(id=>floor[id]&&!goals.includes(id)),rng)[0],l={index,tier,cols,rows,floor,goals};
    let s={at:start,boxes:[...goals]},states=[s],steps=[],seen=new Map([[key(s),0]]);
    for(let n=0;n<160+tier*40;n++){
      const choices=[];
      for(let dir=0;dir<4;dir++){
        const to=crateNeighbor(l,s.at,dir);if(to===null||s.boxes.includes(to))continue;
        choices.push({dir,pull:false,to});const behind=crateNeighbor(l,s.at,(dir+2)%4);
        if(s.boxes.includes(behind))choices.push({dir,pull:true,to,behind});
      }
      if(!choices.length)break;
      const pulled=choices.filter(a=>a.pull),choice=shuffle(pulled.length&&rng()<.78?pulled:choices,rng)[0],boxes=[...s.boxes];
      if(choice.pull)boxes[boxes.indexOf(choice.behind)]=s.at;
      const next={at:choice.to,boxes},k=key(next);
      if(seen.has(k)){
        const at=seen.get(k);for(const old of states.slice(at+1))seen.delete(key(old));states=states.slice(0,at+1);steps=steps.slice(0,at);s=states[at];
      }else{steps.push({dir:(choice.dir+2)%4});states.push(next);seen.set(k,steps.length);s=next;}
    }
    if(won(l,s)||s.boxes.filter(id=>!goals.includes(id)).length<count||steps.length<12+tier*5||steps.length>105)continue;
    l.start=s.at;l.boxes=s.boxes;l.solution=[];let current=initial(l),pushes=0;
    for(const a of [...steps].reverse()){
      const next=move(l,current,a);if(!next)throw new Error('Invalid reverse crate route');
      if(JSON.stringify(next.boxes)!==JSON.stringify(current.boxes))pushes++;
      l.solution.push(a);current=next;if(won(l,current))break;
    }
    if(!won(l,current)||pushes<3+tier*2)continue;
    l.title=['Le petit potager','Les cagettes attendent','Gardez une allée','Un détour derrière','Les paniers voisins','Poussez doucement','Un peu de place','La haie du jardin','Le dernier panier','Tout trouve sa place','Revenez derrière','Le potager rangé'][index%12];cache.set(index,l);return l;
  }
  throw new Error(`Cannot construct crates ${index}`);
}
function walking(l,s){
  const routes=new Map([[s.at,[]]]),queue=[s.at];
  for(let n=0;n<queue.length;n++)for(let dir=0;dir<4;dir++){const to=crateNeighbor(l,queue[n],dir);if(to!==null&&!s.boxes.includes(to)&&!routes.has(to)){routes.set(to,[...routes.get(queue[n]),{dir}]);queue.push(to);}}
  return routes;
}
function plan(l,s){
  let c=initial(l);for(let n=0;n<=l.solution.length;n++){if(key(c)===key(s))return l.solution.slice(n);if(n<l.solution.length)c=move(l,c,l.solution[n]);}
  const queue=[{s,path:[]}],seen=new Set(),deadline=Date.now()+140;
  for(let n=0;n<queue.length&&n<8000&&Date.now()<deadline;n++){
    const item=queue[n];if(won(l,item.s))return item.path;
    const routes=walking(l,item.s),k=`${Math.min(...routes.keys())}:${[...item.s.boxes].sort((a,b)=>a-b)}`;
    if(seen.has(k))continue;seen.add(k);
    for(const box of item.s.boxes)for(let dir=0;dir<4;dir++){
      const behind=crateNeighbor(l,box,(dir+2)%4),to=crateNeighbor(l,box,dir);if(!routes.has(behind)||to===null||item.s.boxes.includes(to))continue;
      const action={dir},next=move(l,{at:behind,boxes:item.s.boxes},action);queue.push({s:next,path:[...item.path,...routes.get(behind),action]});
    }
  }return null;
}
export const cagettesRules={create:createCagettesLevel,initial,move,won,plan,actions:(l,s)=>DIRS.flatMap((_,dir)=>move(l,s,{dir})?[{dir}]:[])};
