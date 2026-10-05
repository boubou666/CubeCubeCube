import {checkIndex,clone,random} from './pocket-core.js';
import {simulateCandy} from './balancier-physics.js';
function initial(){return {cuts:[],result:null};}
function move(level,state,a){
  if(!a||!Number.isInteger(a.rope)||!Number.isInteger(a.tick)||a.rope<0||a.rope>=level.ropes.length||a.tick<0||a.tick>36000||a.tick<(state.cuts.at(-1)?.tick??0)||state.cuts.some(c=>c.rope===a.rope))return null;
  const before=simulateCandy(level,state.cuts,a.tick);if(before.done)return null;const cuts=[...clone(state.cuts),{rope:a.rope,tick:a.tick}];return {cuts,result:simulateCandy(level,cuts).result()};
}
const won=(level,state)=>Boolean(state.result?.caught)&&state.result.collected.length===level.stars.length;
const cache=new Map();
export function createBalancierLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),rng=random(75391+index*7937),count=[1,2,2,3][tier];
  for(let attempt=0;attempt<120;attempt++){
    const sign=rng()<.5?-1:1,ball={x:250+Math.round(rng()*130),y:225+Math.round(rng()*35),vx:sign*(22+rng()*18)},anchors=[[ball.x-sign*(75+rng()*35),85],[ball.x+sign*(100+rng()*25),85],[ball.x-sign*18,60]],ropes=anchors.slice(0,count).map(([x,y])=>({x,y,length:Math.hypot(ball.x-x,ball.y-y)}));
    const cutTick=65+Math.floor(rng()*45),solution=count===1?[{rope:0,tick:cutTick}]:count===2?[{rope:1,tick:20+Math.floor(rng()*10)},{rope:0,tick:cutTick+35}]:[{rope:2,tick:20},{rope:1,tick:42},{rope:0,tick:cutTick+55}];
    const level={index,tier,ball,ropes,stars:[],obstacles:[],cup:null,color:index%6,solution,title:['Le petit balancier','Une corde au jardin','La bonne seconde','La baie qui se balance','Un petit élan','Deux liens de moins','Au-dessus des fleurs','La corde du milieu','Quelques pétales en chemin','Le dernier fil','Un joli vol','La baie retrouve son panier'][index%12]};
    const probe=simulateCandy(level,solution,500),hit=probe.trace.findIndex(p=>p[1]>=478);if(hit<0)continue;const x=probe.trace[hit][0];if(x<95||x>545)continue;level.cup={x,y:484,w:66};
    const fall=probe.trace.slice(solution.at(-1).tick,hit+1);if(fall.length<30)continue;level.stars=Array.from({length:1+tier},(_,n)=>clone(fall[Math.floor((n+.7)*fall.length/(tier+1.5))]));
    if(tier>=2){const p=fall[Math.floor(fall.length*.6)],ox=p[0]+(rng()<.5?-92:60);if(ox>60&&ox<535)level.obstacles.push({x:ox,y:p[1]-16,w:32,h:32});}
    let state=initial();for(const a of solution){state=move(level,state,a);if(!state)break;}if(!state||!won(level,state))continue;cache.set(index,level);return clone(level);
  }throw new Error(`Could not construct pendulum ${index}`);
}
export const balancierRules={create:createBalancierLevel,initial,move,won,actions:()=>[],plan(level,state){
  if(won(level,state))return [];if(!state.cuts.every((a,n)=>JSON.stringify(a)===JSON.stringify(level.solution[n])))return null;
  let next=clone(state);const route=[];for(const a of level.solution.slice(state.cuts.length)){next=move(level,next,a);if(!next)return null;route.push(a);}return won(level,next)?route:null;
}};
