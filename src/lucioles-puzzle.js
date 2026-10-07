import {checkIndex,clone,random,shuffle} from './pocket-core.js';
export const LIGHT_DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
export function lightTrace(level,state){
  const lit=new Set(),segments=[],seen=new Set(),queue=level.sources.map(s=>({cell:s.cell,dir:s.dir,color:s.color}));
  while(queue.length){const ray=queue.shift(),key=`${ray.cell}:${ray.dir}:${ray.color}`;if(seen.has(key))continue;seen.add(key);const [dx,dy]=LIGHT_DIRS[ray.dir],x=ray.cell%level.size+dx,y=Math.floor(ray.cell/level.size)+dy;if(x<0||y<0||x>=level.size||y>=level.size)continue;const cell=y*level.size+x,tile=level.field[cell];segments.push({from:ray.cell,to:cell,color:ray.color});
    if(tile?.type==='rock'||tile?.type==='source')continue;if(tile?.type==='gem'){if(tile.color===ray.color)lit.add(cell);continue;}
    if(tile?.type==='mirror'){const dir=state.turns[cell]===0?[1,0,3,2][ray.dir]:[3,2,1,0][ray.dir];queue.push({cell,dir,color:ray.color});}
    else if(tile?.type==='prism'){const ports=[0,1,3].map(d=>(d+state.turns[cell])%4),incoming=(ray.dir+2)%4;if(ports.includes(incoming))for(const dir of ports)if(dir!==incoming)queue.push({cell,dir,color:ray.color});}
    else queue.push({cell,dir:ray.dir,color:ray.color});
  }return {lit:[...lit],segments};
}
function move(l,s,a){if(!a||!Number.isInteger(a.id)||!l.field[a.id]||l.field[a.id].fixed||!['mirror','prism'].includes(l.field[a.id].type))return null;const next=clone(s);next.turns[a.id]=(next.turns[a.id]+1)%(l.field[a.id].type==='mirror'?2:4);return next;}
const won=(l,s)=>lightTrace(l,s).lit.length===l.gems.length;
const cache=new Map();
export function createLuciolesLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),size=[5,6,7,8][tier],mid=Math.floor(size/2),rng=random(71791+index*7951),field=Array(size*size).fill(null),canonical=Array(size*size).fill(0),color=index%6,sources=[],gems=[];
  const put=(x,y,t,turn=0)=>{const cell=y*size+x;if(field[cell])throw new Error('Optic overlap');field[cell]=t;canonical[cell]=turn;return cell;};
  const source=(x,y,dir,color)=>{const cell=put(x,y,{type:'source',color,fixed:true});sources.push({cell,dir,color});};const gem=(x,y,color)=>gems.push(put(x,y,{type:'gem',color,fixed:true}));
  source(0,mid,1,color);put(size-2,mid,{type:'mirror'},0);put(size-2,1,{type:'mirror'},1);put(1,1,{type:'mirror'},0);gem(1,size-2,color);
  if(tier>=1){put(2,mid,{type:'prism'},0);gem(2,0,color);}
  if(tier>=2){const c=(color+2)%6;source(size-1,size-1,3,c);put(size-3,size-1,{type:'mirror'},1);if(tier===2)gem(size-3,size-3,c);else{put(size-3,size-3,{type:'mirror'},1);put(3,size-3,{type:'mirror'},1);gem(3,mid-1,c);}}
  if(tier===3){put(size-2,mid-1,{type:'prism'},3);gem(size-3,mid-1,color);}
  const l={index,tier,size,field,sources,gems,turns:[...canonical],solution:[],title:['Une petite lumière','Le miroir du jardin','Le cristal attend','Un rayon de soleil','La lumière se partage','Deux reflets','Les couleurs du soir','Le petit prisme','Un jardin illuminé','Les rayons se croisent','Toutes les lucioles','Les derniers cristaux'][index%12]};
  if(!won(l,{turns:canonical}))throw new Error(`Unlit construction ${index}`);
  const reserved=new Set(lightTrace(l,{turns:canonical}).segments.flatMap(s=>[s.from,s.to]));for(const id of shuffle(field.flatMap((v,id)=>!v&&!reserved.has(id)?[id]:[]),rng).slice(0,1+tier))field[id]={type:'rock',fixed:true};
  // Reflect the complete board, including beam directions and mirror orientations.
  const flipX=rng()<.5,flipY=rng()<.5,map=id=>(flipY?size-1-Math.floor(id/size):Math.floor(id/size))*size+(flipX?size-1-id%size:id%size),dirs=LIGHT_DIRS.map(([x,y])=>LIGHT_DIRS.findIndex(([a,b])=>a===(flipX?-x:x)&&b===(flipY?-y:y)));
  const mapped=Array(size*size).fill(null),turns=Array(size*size).fill(0);field.forEach((tile,id)=>{if(!tile)return;const to=map(id);mapped[to]=tile;if(tile.type==='mirror')turns[to]=canonical[id]^(Number(flipX)!==Number(flipY)?1:0);if(tile.type==='prism'){const ports=[0,1,3].map(d=>dirs[(d+canonical[id])%4]);turns[to]=[0,1,2,3].find(t=>[0,1,3].map(d=>(d+t)%4).every(d=>ports.includes(d)));}});l.field=mapped;l.sources=sources.map(s=>({...s,cell:map(s.cell),dir:dirs[s.dir]}));l.gems=gems.map(map);l.turns=[...turns];
  const mobile=mapped.flatMap((t,id)=>t&&['mirror','prism'].includes(t.type)?[id]:[]);for(const id of mobile)l.turns[id]=Math.floor(rng()*(mapped[id].type==='mirror'?2:4));if(won(l,{turns:l.turns})){const id=mobile[0];l.turns[id]=(l.turns[id]+1)%2;}
  for(const id of shuffle(mobile,rng)){const mod=mapped[id].type==='mirror'?2:4;for(let n=0;n<(turns[id]-l.turns[id]+mod)%mod;n++)l.solution.push({id});}
  let s={turns:[...l.turns]};for(const a of l.solution)s=move(l,s,a);if(!won(l,s))throw new Error(`Failed optic audit ${index}`);cache.set(index,l);return clone(l);
}
function plan(l,s){const ids=l.field.flatMap((t,id)=>t&&!t.fixed&&['mirror','prism'].includes(t.type)?[id]:[]);let best=null,cost=Infinity;const candidate=clone(s);
  const visit=(n,d)=>{if(d>=cost)return;if(n===ids.length){if(won(l,candidate)){cost=d;best=[...candidate.turns];}return;}const id=ids[n],mod=l.field[id].type==='mirror'?2:4;for(let delta=0;delta<mod;delta++){candidate.turns[id]=(s.turns[id]+delta)%mod;visit(n+1,d+delta);}};visit(0,0);if(!best)return null;const out=[];for(const id of ids){const mod=l.field[id].type==='mirror'?2:4;for(let n=0;n<(best[id]-s.turns[id]+mod)%mod;n++)out.push({id});}return out;
}
export const luciolesRules={create:createLuciolesLevel,initial:l=>({turns:[...l.turns]}),move,won,actions:(l,s)=>l.field.flatMap((t,id)=>move(l,s,{id})?[{id}]:[]),plan};
