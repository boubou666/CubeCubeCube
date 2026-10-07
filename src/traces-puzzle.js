import {checkIndex,clone,random,shuffle} from './pocket-core.js';
export function traceEdge(l,from,to){return l.edges.findIndex(e=>e.a===from&&e.b===to||e.a===to&&e.b===from);}
export function traceStep(l,s,from,to){const id=traceEdge(l,from,to);if(id<0||s.used[id]>=l.edges[id].count)return null;const e=l.edges[id];if(e.dir!==null&&e.dir!==from)return null;return id;}
function move(l,s,a){if(!a||!Array.isArray(a.path)||a.path.length<2||a.path.some(n=>!Number.isInteger(n)||!l.nodes[n]))return null;if(s.path.length&&a.path[0]!==s.path.at(-1))return null;const next=clone(s);if(!next.path.length)next.path.push(a.path[0]);for(let n=1;n<a.path.length;n++){const id=traceStep(l,next,next.path.at(-1),a.path[n]);if(id===null)return null;next.used[id]++;next.path.push(a.path[n]);}return next;}
const won=(l,s)=>s.used.every((n,id)=>n===l.edges[id].count);
const cache=new Map();
export function traceLayoutKey(l){const point=id=>[Math.round(l.nodes[id].x),Math.round(l.nodes[id].y)].join(',');return l.edges.map(e=>JSON.stringify({ends:[point(e.a),point(e.b)].sort(),count:e.count,dir:e.dir===null?null:point(e.dir)})).sort().join('|');}
export function createTracesLevel(index){checkIndex(index);if(!cache.size){const seen=new Set();for(let n=0;n<48;n++){for(let salt=0;salt<256;salt++){const level=buildTracesLevel(n,salt),key=traceLayoutKey(level);if(seen.has(key))continue;seen.add(key);cache.set(n,level);break;}if(!cache.has(n))throw new Error(`No distinct trace layout ${n}`);}}return clone(cache.get(index));}
function buildTracesLevel(index,salt){
  const tier=Math.floor(index/12),cols=[4,5,5,6][tier],rows=[4,4,5,5][tier],rng=random(83071+index*7919+salt*104729),nodes=Array.from({length:cols*rows},(_,id)=>({id,x:id%cols,y:Math.floor(id/cols)})),edges=[],edgeMap=new Map();
  const key=(a,b)=>[a,b].sort((a,b)=>a-b).join(':'),id=(x,y)=>y*cols+x;
  const rectangle=(x,y,w,h)=>{const path=[id(x,y)];for(let n=1;n<=w;n++)path.push(id(x+n,y));for(let n=1;n<=h;n++)path.push(id(x+w,y+n));for(let n=w-1;n>=0;n--)path.push(id(x+n,y+h));for(let n=h-1;n>=0;n--)path.push(id(x,y+n));return path;};
  const w=1+Math.floor(rng()*(cols-2)),h=1+Math.floor(rng()*(rows-2)),x=Math.floor(rng()*(cols-w)),y=Math.floor(rng()*(rows-h));let route=rectangle(x,y,w,h);const quotas=new Map();const tally=p=>{for(let n=1;n<p.length;n++){const k=key(p[n-1],p[n]);quotas.set(k,(quotas.get(k)||0)+1);}};tally(route);
  for(let loop=0;loop<1+tier;loop++){
    const candidates=[];for(let y=0;y<rows-1;y++)for(let x=0;x<cols-1;x++){const p=rectangle(x,y,1,1);if(p.slice(0,-1).some(n=>route.includes(n))&&p.slice(1).every((n,i)=>(quotas.get(key(p[i],n))||0)<(tier>=2?2:1)))candidates.push(p);}
    if(!candidates.length)break;let p=shuffle(candidates,rng)[0];const at=p.slice(0,-1).findIndex(n=>route.includes(n)),cycle=p.slice(0,-1);p=[...cycle.slice(at),...cycle.slice(0,at),cycle[at]];const insert=route.indexOf(p[0]);route=[...route.slice(0,insert),...p,...route.slice(insert+1)];tally(p);
  }
  // Add an open tail in later chapters: its two odd-degree ends become meaningful starts.
  if(tier>=1){const head=route[0],neighbors=[head-cols,head+cols,head-1,head+1].filter(n=>nodes[n]&&Math.abs(nodes[n].x-nodes[head].x)+Math.abs(nodes[n].y-nodes[head].y)===1&&!route.includes(n));if(neighbors.length){const end=shuffle(neighbors,rng)[0];route.push(end);tally([head,end]);}}
  for(let n=1;n<route.length;n++){const a=route[n-1],b=route[n],k=key(a,b);if(!edgeMap.has(k)){edgeMap.set(k,edges.length);edges.push({a,b,count:quotas.get(k),dir:null});}}
  if(tier>=1)for(const e of edges)if(e.count===1&&rng()<[0,.25,.35,.5][tier])e.dir=e.a;
  const flipX=rng()<.5,flipY=rng()<.5;for(const node of nodes){node.x=(flipX?cols-1-node.x:node.x)+(.04*(rng()-.5));node.y=(flipY?rows-1-node.y:node.y)+(.04*(rng()-.5));}
  const l={index,tier,cols,rows,nodes,edges,route,solution:route.slice(1).map((to,n)=>({path:[route[n],to]})),title:['Un premier trait','Le petit chemin','Sans lever le crayon','Un détour dessiné','Le trait du jardin','Revenez au point','Les chemins se retrouvent','Suivez la petite flèche','Un deuxième passage','Le dernier détour','Le dessin prend forme','Un trait pour finir'][index%12]};let s=initial(l);for(const a of l.solution){s=move(l,s,a);if(!s)throw new Error(`Broken trace ${index}`);}if(!won(l,s))throw new Error('Incomplete trace');return l;
}
function initial(l){return {path:[],used:l.edges.map(()=>0)};}
function plan(l,s){
  let canonical=initial(l);for(let n=0;n<=l.solution.length;n++){if(JSON.stringify(canonical)===JSON.stringify(s))return l.solution.slice(n);if(n<l.solution.length)canonical=move(l,canonical,l.solution[n]);}
  const used=[...s.used],left=l.edges.reduce((n,e,id)=>n+e.count-used[id],0),deadline=Date.now()+150;let visits=0;
  const walk=(from,remaining)=>{if(!remaining)return [];if(++visits>24000||Date.now()>deadline)return null;for(let id=0;id<l.edges.length;id++){const e=l.edges[id],to=e.a===from?e.b:e.b===from?e.a:null;if(to===null||used[id]>=e.count||e.dir!==null&&e.dir!==from)continue;used[id]++;const tail=walk(to,remaining-1);used[id]--;if(tail)return [{path:[from,to]},...tail];}return null;};
  for(const start of s.path.length?[s.path.at(-1)]:l.nodes.map(n=>n.id)){const out=walk(start,left);if(out)return out;}return null;
}
export const tracesRules={create:createTracesLevel,initial,move,won,plan,actions:(l,s)=>l.edges.flatMap(e=>[e.a,e.b].flatMap(from=>{const to=from===e.a?e.b:e.a;return (!s.path.length||from===s.path.at(-1))&&traceStep(l,s,from,to)!==null?[{path:[from,to]}]:[];}))};
