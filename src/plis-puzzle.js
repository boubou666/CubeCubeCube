import {checkIndex,clone,random,shuffle,searchPlan} from './pocket-core.js';
export const paperTop=(level,stack)=>stack?.length?level.faces[stack.at(-1)[0]][stack.at(-1)[1]]:null;
export function paperBounds(level,state){const ids=state.field.flatMap((v,id)=>v.length?[id]:[]);return {left:Math.min(...ids.map(n=>n%level.size)),right:Math.max(...ids.map(n=>n%level.size)),top:Math.min(...ids.map(n=>Math.floor(n/level.size))),bottom:Math.max(...ids.map(n=>Math.floor(n/level.size)))};}
function move(level,state,a){
  if(!a||!['x','y'].includes(a.axis)||!Number.isInteger(a.line)||a.line<1||a.line>=level.size||![-1,1].includes(a.side))return null;
  const moving=[];let contacts=0;
  for(let id=0;id<state.field.length;id++){if(!state.field[id].length)continue;const x=id%level.size,y=Math.floor(id/level.size),v=a.axis==='x'?x:y;if(a.side<0?v>=a.line:v<a.line)continue;const reflected=2*a.line-1-v;if(reflected<0||reflected>=level.size)return null;const to=a.axis==='x'?y*level.size+reflected:reflected*level.size+x;moving.push({id,to});if(state.field[to].length)contacts++;}
  if(!moving.length||!contacts)return null;const next=clone(state);for(const {id} of moving)next.field[id]=[];for(const {id,to} of moving)next.field[to].push(...[...state.field[id]].reverse().map(([id,face])=>[id,1-face]));return next;
}
function actions(level,state){const out=[];for(const axis of ['x','y'])for(let line=1;line<level.size;line++)for(const side of [-1,1]){const a={axis,line,side};if(move(level,state,a))out.push(a);}return out;}
const won=(l,s)=>s.field.every((stack,id)=>paperTop(l,stack)===l.target[id]);
const pictures=[['6666','6036','0000','6006'],['6666','6016','6116','6116'],['6666','6226','6226','6336'],['6366','3336','3336','6366'],['6464','4444','6446','6446'],['6606','6000','6000','6606'],['6666','6156','1551','6156'],['6226','2222','6226','6226']];
const cache=new Map();
export function createPlisLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),size=16,rng=random(91013+index*7919),paper=Array(size*size).fill(null),faces=[];
  const add=(x,y)=>{const id=y*size+x;if(paper[id]!==null)return;paper[id]=faces.length;faces.push([Math.floor(rng()*6),Math.floor(rng()*6)]);};
  for(let y=6;y<10;y++)for(let x=6;x<10;x++)add(x,y);
  const arms=shuffle(['west','east','north','south'],rng).slice(0,[2,3,4,4][tier]),tasks=[];
  for(const arm of arms){const horizontal=['west','east'].includes(arm),negative=['west','north'].includes(arm),width=tier===3&&horizontal?6:2+Math.floor(rng()*2),span=2+Math.floor(rng()*3),offset=6+Math.floor(rng()*(5-span));
    for(let a=0;a<width;a++)for(let b=offset;b<offset+span;b++){const v=negative?5-a:10+a;add(horizontal?v:b,horizontal?b:v);}
    const base={axis:horizontal?'x':'y',line:negative?6:10,side:negative?-1:1};if(width===6)tasks.push({name:`${arm}-tip`,a:{axis:'x',line:negative?3:13,side:negative?-1:1}});tasks.push({name:arm,a:base,after:width===6?`${arm}-tip`:null});
  }
  const solution=[],done=new Set();while(tasks.length){const ready=tasks.filter(t=>!t.after||done.has(t.after)),t=ready[Math.floor(rng()*ready.length)];tasks.splice(tasks.indexOf(t),1);done.add(t.name);solution.push(t.a);}
  const l={index,tier,size,paper,faces,target:Array(size*size).fill(null),solution,picture:index%pictures.length,title:['La première feuille','Un pli du matin','Le petit portrait','Deux coins de papier','Sous la feuille','Un dessin qui attend','Les couches du jardin','Le bon côté','Une image dans les plis','Le papier se retourne','Six petits gestes','La dernière feuille'][index%12]};let s=initial(l);
  for(const a of solution){s=move(l,s,a);if(!s)throw new Error(`Paper construction failed ${index}`);}const art=pictures[index%pictures.length];for(let y=6;y<10;y++)for(let x=6;x<10;x++){const stack=s.field[y*size+x],top=stack.at(-1);if(!top)throw new Error('Missing picture panel');faces[top[0]][top[1]]=Number(art[y-6][x-6]);l.target[y*size+x]=Number(art[y-6][x-6]);}
  if(!won(l,s))throw new Error('Wrong fold picture');cache.set(index,l);return clone(l);
}
function initial(l){return {field:l.paper.map(id=>id===null?[]:[[id,0]])};}
export const plisRules={create:createPlisLevel,initial,move,won,actions,plan:(l,s)=>searchPlan(plisRules,l,s,3500)};
