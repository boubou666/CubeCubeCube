import { checkIndex, clone, random, shuffle, searchPlan } from './pocket-core.js';
const TITLES=['Les petites vannes','Une touche de couleur','Le bassin du jardin','Les deux ruisseaux','Le bon mélange','Les billes du matin','Le détour tranquille','Toutes les couleurs','La réserve du haut','Un passage délicat','Les bassins voisins','La dernière écluse'];
function mix(level,state,room){
  const ids=state.rooms[room],bombs=ids.filter(id=>level.balls[id].bomb),balls=ids.filter(id=>!level.balls[id].bomb);
  if(bombs.length&&balls.length){state.lost.push(...balls);state.bombsGone.push(...bombs);state.rooms[room]=[];return;}
  const color=balls.map(id=>state.colors[id]).find(c=>c!==null&&c!==undefined);
  if(color!==undefined)for(const id of balls)if(state.colors[id]===null)state.colors[id]=color;
}
function move(level,state,pin){
  if(!Number.isInteger(pin)||!level.pins[pin]||state.opened.includes(pin)||state.lost.length)return null;
  const next=clone(state);next.opened.push(pin);next.opened.sort((a,b)=>a-b);
  for(let guard=0;guard<level.rooms.length+2;guard++){
    let changed=false;
    for(let room=0;room<next.rooms.length;room++){
      mix(level,next,room);const ids=next.rooms[room];if(!ids.length)continue;
      const gate=level.pins.find((p,id)=>p.from===room&&next.opened.includes(id));if(!gate)continue;
      next.rooms[room]=[];changed=true;
      if(Number.isInteger(gate.to)){next.rooms[gate.to].push(...ids);mix(level,next,gate.to);}
      else if(gate.to==='basket'){
        if(ids.some(id=>level.balls[id].bomb)){next.lost.push(...next.collected,...ids.filter(id=>!level.balls[id].bomb));next.collected=[];next.bombsGone.push(...ids.filter(id=>level.balls[id].bomb));}
        else for(const id of ids)(next.colors[id]===null?next.lost:next.collected).push(id);
      }else for(const id of ids)(level.balls[id].bomb?next.bombsGone:next.lost).push(id);
    }
    if(!changed)break;
  }
  return next;
}
export function createEclusesLevel(index){
  checkIndex(index);const tier=Math.floor(index/12),groups=tier===0?1:tier===3?3:2,rng=random(21563+index*8273),rooms=[],balls=[],pins=[],solution=[],colors=shuffle([0,1,2,3,4,5,6,7],rng);
  const addRoom=(x,y,w,h,name)=>{rooms.push({x,y,w,h,name,balls:[]});return rooms.length-1;};
  const addBalls=(room,count,color,bomb=false)=>{for(let n=0;n<count;n++){const id=balls.length;balls.push({id,color,bomb,room});rooms[room].balls.push(id);}};
  const feeders=[];
  for(let group=0;group<groups;group++){
    const center=groups===1?320:80+(group+.5)*480/groups,offset=groups===1?130:groups===2?62:42,w=groups===1?118:groups===2?94:70;
    const gray=addRoom(center-offset,103,w,98,'Billes à colorer'),color=addRoom(center+offset,103,w,98,'La réserve colorée');
    addBalls(gray,3+tier+Math.floor(rng()*3),null);addBalls(color,2+Math.floor(rng()*3),colors[group]);feeders.push({gray,color,center});
  }
  const mixers=feeders.map(({center})=>addRoom(center,275,groups===1?195:groups===2?175:132,106,'Le petit bassin'));
  const pool=tier>=2?addRoom(320,425,255,90,'Le grand bassin'):null;
  for(let group=0;group<groups;group++){
    const {gray,color}=feeders[group],mixer=mixers[group];
    pins.push({from:gray,to:mixer,name:'La réserve grise'});solution.push(pins.length-1);
    pins.push({from:color,to:mixer,name:'La réserve colorée'});solution.push(pins.length-1);
    pins.push({from:mixer,to:pool??'basket',name:'Le bassin'});solution.push(pins.length-1);
  }
  if(pool!==null){pins.push({from:pool,to:'basket',name:'Le dernier passage'});solution.push(pins.length-1);}
  if(tier>=1){const danger=addRoom(tier===3?590:560,pool===null?410:335,54,62,'La petite bombe');addBalls(danger,1,null,true);pins.push({from:danger,to:pool??'basket',name:'La bombe · attention'});}
  const level={index,tier,title:TITLES[index%12],rooms,balls,pins,solution,total:balls.filter(b=>!b.bomb).length};
  return level;
}
export const eclusesRules={
  create:createEclusesLevel,initial:level=>({opened:[],rooms:level.rooms.map(r=>[...r.balls]),colors:level.balls.map(b=>b.color),collected:[],lost:[],bombsGone:[]}),move,
  won:(level,state)=>state.collected.length===level.total&&!state.lost.length,
  actions:(level,state)=>state.lost.length?[]:level.pins.map((_,id)=>id).filter(id=>!state.opened.includes(id)&&!move(level,state,id).lost.length).sort((a,b)=>Number(level.balls[state.rooms[level.pins[b].from][0]]?.color!==null)-Number(level.balls[state.rooms[level.pins[a].from][0]]?.color!==null)),
  plan:(level,state)=>state.lost.length?null:searchPlan(eclusesRules,level,state,16000),
};
