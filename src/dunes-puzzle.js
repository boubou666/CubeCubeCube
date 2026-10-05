import { checkIndex, clone, random, shuffle, searchPlan } from './pocket-core.js';
const TITLES=['Un petit tas de sable','Les grains du matin','De bord en bord','Un peu de place','Le pont des couleurs','Une douce cascade','Les petites dunes','Entre les pierres','Le mélange délicat','Les couleurs enfouies','La grande traversée','La dernière dune'];
export const SAND_UNIT=4;
export const SAND_SHAPES=[[[0,0],[1,0],[0,1],[1,1]],[[0,0],[0,1],[1,1]],[[0,0],[1,0],[2,0]],[[0,0],[1,0],[1,1],[2,1]],[[0,0],[1,0],[2,0],[1,1]]];
export const sandWidth=piece=>(Math.max(...piece.shape.map(p=>p[0]))+1)*SAND_UNIT;
export const sandGrains=piece=>piece.shape.length*SAND_UNIT**2;
export function spanningSand(level,field){
  const seen=new Uint8Array(field.length),components=[];
  for(let start=0;start<field.length;start++){
    if(field[start]<=0||seen[start])continue;const color=field[start],ids=[start];seen[start]=1;let left=false,right=false;
    for(let n=0;n<ids.length;n++){const id=ids[n],x=id%level.width,y=Math.floor(id/level.width);left||=x===0;right||=x===level.width-1;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,next=yy*level.width+xx;if(xx<0||xx>=level.width||yy<0||yy>=level.height||seen[next]||field[next]!==color)continue;seen[next]=1;ids.push(next);}
    }
    if(left&&right)components.push({color,ids});
  }
  return components;
}
export class SandFlow{
  constructor(level,state,action){
    this.level=level;this.state=clone(state);this.tick=0;this.done=false;this.flash=null;
    const piece=level.queues[action.q]?.[state.queues[action.q]];
    if(!piece||!Number.isInteger(action.x)||action.x<0||action.x+sandWidth(piece)>level.width){this.invalid=true;this.done=true;return;}
    const ids=[];for(const [sx,sy] of piece.shape)for(let y=0;y<SAND_UNIT;y++)for(let x=0;x<SAND_UNIT;x++)ids.push((sy*SAND_UNIT+y)*level.width+action.x+sx*SAND_UNIT+x);
    if(ids.some(id=>this.state.field[id]!==0)){this.invalid=true;this.done=true;return;}
    for(const id of ids)this.state.field[id]=piece.color+1;this.state.queues[action.q]++;this.state.added+=ids.length;
  }
  step(){
    if(this.done)return;
    if(this.flash){if(--this.flash.remaining<=0)this.flash=null;this.tick++;return;}
    const {width:w,height:h}=this.level,f=this.state.field;let changed=false;
    for(let y=h-2;y>=0;y--)for(let n=0;n<w;n++){
      const x=this.tick%2?n:w-1-n,id=y*w+x;if(f[id]<=0)continue;
      const below=id+w;if(!f[below]){f[below]=f[id];f[id]=0;changed=true;continue;}
      const directions=(x+y+this.tick+this.level.index)%2?[-1,1]:[1,-1];
      for(const dx of directions){const xx=x+dx;if(xx>=0&&xx<w&&!f[below+dx]){f[below+dx]=f[id];f[id]=0;changed=true;break;}}
    }
    this.tick++;
    if(!changed){const spans=spanningSand(this.level,f);if(spans.length){const ids=spans.flatMap(c=>c.ids);this.flash={cells:ids.map(id=>({id,color:f[id]-1})),remaining:8};for(const id of ids)f[id]=0;this.state.cleared+=ids.length;this.state.bursts+=spans.length;}else this.done=true;}
    if(this.tick>500)throw new Error('Sand did not settle');
  }
}
function move(level,state,action){
  if(!action||!Number.isInteger(action.q)||!level.queues[action.q])return null;
  const flow=new SandFlow(level,state,action);if(flow.invalid)return null;while(!flow.done)flow.step();return flow.state;
}
const initial=level=>({field:[...level.field],queues:[0,0,0],added:0,cleared:0,bursts:0});
const won=(level,state)=>state.bursts>=level.goal;
const cache=new Map();
export function createDunesLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));
  const tier=Math.floor(index/12),rng=random(98317+index*6173),width=24+(tier>=2?4:0)+(tier===3?4:0),height=40+tier*3,goal=2+tier,colors=shuffle([0,1,2,3,4,5,6,7],rng).slice(0,goal),field=Array(width*height).fill(0);
  const heap=5+Math.floor(rng()*3);for(let x=0;x<heap;x++)for(let y=height-(heap-x);y<height;y++){field[y*width+x]=colors[0]+1;field[y*width+width-1-x]=colors[0]+1;}
  if(tier>=2)for(let y=height-5-tier;y<height;y++)for(let x=Math.floor(width/2)-1;x<=Math.floor(width/2);x++)field[y*width+x]=-1;
  const level={index,tier,title:TITLES[index%12],width,height,goal,field,queues:[[],[],[]],solution:[]};let state=initial(level);
  for(let batch=0;batch<goal;batch++){
    let drop=0;
    while(state.bursts<=batch&&drop<24){
      const shape=clone(SAND_SHAPES[Math.floor(rng()*SAND_SHAPES.length)]),piece={color:colors[batch],shape},span=sandWidth(piece),choices=[0,width-span,Math.floor((width-span)/2)],x=choices[drop%3],q=Math.floor(rng()*3);
      level.queues[q].push(piece);const action={q,x},next=move(level,state,action);if(!next)throw new Error('Could not place sand reserve');state=next;level.solution.push(action);drop++;
    }
    if(state.bursts<=batch)throw new Error('Could not build a sand bridge');
  }
  cache.set(index,clone(level));return level;
}
export const dunesRules={create:createDunesLevel,initial,move,won,
  actions:(level,state)=>level.queues.flatMap((q,id)=>{const p=q[state.queues[id]];return p?Array.from({length:Math.floor((level.width-sandWidth(p))/4)+1},(_,n)=>({q:id,x:n*4})):[];}).filter(a=>move(level,state,a)),
  plan:(level,state)=>searchPlan(dunesRules,level,state,700),
};
