import {checkIndex,clone,random,shuffle} from './pocket-core.js';
import {ROLL_DIRS} from './bascules-puzzle.js';

export function jointPorts(piece,turn){return piece.ports.map((_,side)=>piece.ports[(side-turn+4)%4]);}
export function jointCanShift(level,state,id,to){
  const piece=level.pieces[id];if(!piece||['fixed','pivot'].includes(piece.kind)||!Number.isInteger(to)||to<0||to>=level.cols*level.rows||state.positions.includes(to))return false;
  return !['line','line-turn'].includes(piece.kind)||Math.floor(state.positions[id]/level.cols)===Math.floor(to/level.cols);
}
function move(level,state,action){
  if(!action||!Number.isInteger(action.id)||!level.pieces[action.id])return null;
  const piece=level.pieces[action.id],next=clone(state);
  if(action.type==='turn'){if(['fixed','move','line'].includes(piece.kind))return null;next.turns[action.id]=(next.turns[action.id]+1)%4;return next;}
  if(action.type==='shift'&&jointCanShift(level,state,action.id,action.to)){next.positions[action.id]=action.to;return next;}
  return null;
}
export function jointConnections(level,state){
  const slots=new Map(state.positions.map((at,id)=>[at,id])),neighbors=level.pieces.map(()=>[]),loose=level.pieces.map(()=>0);let matched=0;
  for(const piece of level.pieces){const at=state.positions[piece.id],x=at%level.cols,y=Math.floor(at/level.cols),ports=jointPorts(piece,state.turns[piece.id]);
    ports.forEach((color,dir)=>{if(color===null)return;const [dx,dy]=ROLL_DIRS[dir],nx=x+dx,ny=y+dy,other=nx>=0&&ny>=0&&nx<level.cols&&ny<level.rows?slots.get(ny*level.cols+nx):undefined;
      if(other!==undefined&&jointPorts(level.pieces[other],state.turns[other])[(dir+2)%4]===color){neighbors[piece.id].push(other);matched++;}else loose[piece.id]++;
    });
  }
  const seen=new Set(),groups=[];for(const p of level.pieces)if(!seen.has(p.id)){const group=[p.id];seen.add(p.id);for(let n=0;n<group.length;n++)for(const id of neighbors[group[n]])if(!seen.has(id)){seen.add(id);group.push(id);}groups.push(group);}
  return {loose,groups,matched:matched/2,neighbors};
}
const won=(level,state)=>{const c=jointConnections(level,state);return c.groups.length===1&&c.loose.every(n=>n===0);};
const initial=level=>clone(level.start);
export function jointPlan(level,start){
  let state=clone(start);const out=[],targets=level.targets;
  const apply=action=>{const next=move(level,state,action);if(!next)return false;state=next;out.push(action);return true;};
  const vacancies=id=>Array.from({length:level.cols*level.rows},(_,to)=>to).filter(to=>jointCanShift(level,state,id,to)).sort((a,b)=>Number(targets.includes(a))-Number(targets.includes(b)));
  for(let guard=0;guard<level.pieces.length*3;guard++){
    const wrong=level.pieces.filter(p=>state.positions[p.id]!==targets[p.id]);if(!wrong.length)break;
    const chosen=wrong.find(p=>['line','line-turn'].includes(p.kind))??wrong[0],id=chosen.id,target=targets[id],blocker=state.positions.indexOf(target);
    if(blocker>=0){let empty=vacancies(blocker)[0];
      if(empty===undefined){const row=Math.floor(state.positions[blocker]/level.cols);let released=false;
        for(const p of level.pieces)if(Math.floor(state.positions[p.id]/level.cols)===row&&!['fixed','pivot','line','line-turn'].includes(p.kind)){
          const to=vacancies(p.id).find(n=>Math.floor(n/level.cols)!==row);if(to!==undefined){const old=state.positions[p.id];if(apply({type:'shift',id:p.id,to})){empty=old;released=true;break;}}
        }if(!released)return null;
      }
      if(!apply({type:'shift',id:blocker,to:empty}))return null;
    }
    if(!apply({type:'shift',id,to:target}))return null;
  }
  if(state.positions.some((at,id)=>at!==targets[id]))return null;
  for(const piece of level.pieces)for(let n=0;state.turns[piece.id]!==0&&n<4;n++)if(!apply({type:'turn',id:piece.id}))return null;
  return won(level,state)?out:null;
}
const cache=new Map();
export function createRaccordsLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));
  const tier=Math.floor(index/12),cols=[4,4,5,5][tier],rows=[3,4,4,5][tier],count=[6,9,12,16][tier],rng=random(73571+index*6037),targets=[Math.floor(rng()*cols*rows)],links=[];
  while(targets.length<count){const choices=[];for(const at of targets)ROLL_DIRS.forEach(([dx,dy],dir)=>{const x=at%cols+dx,y=Math.floor(at/cols)+dy,to=y*cols+x;if(x>=0&&y>=0&&x<cols-1&&y<rows&&!targets.includes(to))choices.push({at,to,dir});});
    if(!choices.length)throw new Error('Disconnected connection growth');const edge=shuffle(choices,rng)[0];links.push(edge);targets.push(edge.to);
  }
  const pieces=targets.map((at,id)=>({id,ports:Array(4).fill(null),kind:id===0?'fixed':tier>=1&&id===1?'pivot':tier>=1&&id===2?'move':tier>=2&&id===3?'line':tier>=3&&id===4?'line-turn':'free'}));
  for(const {at,to,dir}of links){const color=Math.floor(rng()*(1+tier));pieces[targets.indexOf(at)].ports[dir]=color;pieces[targets.indexOf(to)].ports[(dir+2)%4]=color;}
  if(tier>=2)for(const at of targets)ROLL_DIRS.forEach(([dx,dy],dir)=>{const x=at%cols+dx,y=Math.floor(at/cols)+dy,to=y*cols+x,id=targets.indexOf(at),other=targets.indexOf(to);if(x>=0&&y>=0&&x<cols&&y<rows&&other>id&&pieces[id].ports[dir]===null&&rng()<.18){const color=Math.floor(rng()*(1+tier));pieces[id].ports[dir]=color;pieces[other].ports[(dir+2)%4]=color;}});
  const level={index,tier,cols,rows,pieces,targets,title:['Le premier raccord','Un lien entre voisins','La petite constellation','Les pièces se retrouvent','Une patte de couleur','Le centre du dessin','Les bonnes attaches','D’une pièce à l’autre','Une ligne à suivre','Les petits îlots','Tous les liens','Une constellation entière'][index%12]};
  let state={positions:[...targets],turns:pieces.map(()=>0)};
  for(let step=0;step<20+tier*8;step++){
    const id=Math.floor(rng()*count),turn=rng()<.5,to=Math.floor(rng()*cols*rows),next=move(level,state,turn?{type:'turn',id}:{type:'shift',id,to});if(next)state=next;
  }
  if(won(level,state)){const id=pieces.find(p=>p.kind==='free').id;state=move(level,state,{type:'turn',id});}
  level.start=state;level.solution=jointPlan(level,state);if(!level.solution?.length)throw new Error(`Cannot restore joint puzzle ${index}`);
  cache.set(index,level);return clone(level);
}
export const raccordsRules={create:createRaccordsLevel,initial,move,won,plan:jointPlan,actions:(l,s)=>l.pieces.flatMap(p=>[{type:'turn',id:p.id},...Array.from({length:l.cols*l.rows},(_,to)=>({type:'shift',id:p.id,to}))]).filter(a=>move(l,s,a))};
