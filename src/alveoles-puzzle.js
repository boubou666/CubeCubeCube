import { checkIndex, clone, random, shuffle, searchPlan } from './pocket-core.js';

const DIRS = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
const TITLES = ['La première ruche','Un peu de miel','Les voisines','La couleur du dessus','Les petites piles','Une place au soleil','Le jardin hexagonal','Sous les couleurs','De proche en proche','Les grandes fusions','Un dernier emplacement','La ruche tranquille'];
export const topRun = stack => {let n=0;for(let i=stack.length-1;i>=0&&stack[i]===stack.at(-1);i--)n++;return n;};
export function hexNeighbors(level, id) {
  const [q,r]=level.cells[id];return DIRS.map(([dq,dr])=>level.cells.findIndex(([x,y])=>x===q+dq&&y===r+dr)).filter(n=>n>=0);
}
function settle(level, stacks, target) {
  let cleared=0;
  while (stacks[target].length) {
    const color=stacks[target].at(-1), seen=new Set([target]), queue=[target];
    for(let n=0;n<queue.length;n++)for(const id of hexNeighbors(level,queue[n]))if(!seen.has(id)&&stacks[id].at(-1)===color){seen.add(id);queue.push(id);}
    for(const id of queue.slice(1)){const count=topRun(stacks[id]);stacks[target].push(...stacks[id].splice(-count));}
    const count=topRun(stacks[target]);if(count<6)break;
    const amount=Math.floor(count/6)*6;stacks[target].splice(-amount);cleared+=amount;
  }
  return cleared;
}
function move(level,state,action) {
  if(!action||!Number.isInteger(action.q)||!Number.isInteger(action.cell)||!level.queues[action.q]||!level.cells[action.cell]||state.stacks[action.cell].length)return null;
  const stack=level.queues[action.q][state.queues[action.q]];if(!stack)return null;
  const next=clone(state);next.stacks[action.cell]=[...stack];next.queues[action.q]++;next.cleared+=settle(level,next.stacks,action.cell);return next;
}
const initial=level=>({stacks:clone(level.stacks),queues:[0,0,0],cleared:0});
const won=(level,state)=>state.stacks.every(s=>!s.length)&&level.queues.every((q,i)=>state.queues[i]===q.length);
export function createAlveolesLevel(index) {
  checkIndex(index);const tier=Math.floor(index/12),radius=tier>1?3:2,rng=random(13967+index*8731),groups=3+tier;
  const cells=[];for(let r=-radius;r<=radius;r++)for(let q=-radius;q<=radius;q++)if(Math.abs(q+r)<=radius)cells.push([q,r]);
  for(let attempt=0;attempt<200;attempt++) {
    const level={index,tier,title:TITLES[index%12],radius,cells,stacks:cells.map(()=>[]),queues:[[],[],[]],solution:[]};
    const reserved=new Set(),colors=shuffle([0,1,2,3,4,5,6,7],rng);
    let failed=false;
    for(let group=0;group<groups;group++) {
      const turns=tier>1||tier===1&&group%2===0?2:1,depth=1+Math.min(tier,2),unit=6/(turns+1);
      const choices=shuffle(cells.map((_,id)=>id).filter(id=>!reserved.has(id)),rng);let zone;
      for(const seed of choices){const a=shuffle(hexNeighbors(level,seed).filter(id=>!reserved.has(id)),rng)[0];if(a===undefined)continue;const b=turns===2?hexNeighbors(level,a).find(id=>id!==seed&&!reserved.has(id)):undefined;if(turns===2&&b===undefined)continue;zone=[seed,a,...(turns===2?[b]:[])];break;}
      if(!zone){failed=true;break;}zone.forEach(id=>reserved.add(id));
      const layers=Array.from({length:depth},(_,n)=>colors[(group+depth-1-n)%colors.length]);
      const stack=layers.flatMap(color=>Array(unit).fill(color));level.stacks[zone[0]]=[...stack];
      for(const cell of zone.slice(1)){const q=Math.floor(rng()*3);level.queues[q].push([...stack]);level.solution.push({q,cell});}
    }
    if(failed)continue;
    let state=initial(level);for(const action of level.solution){state=move(level,state,action);if(!state)break;}
    if(state&&won(level,state))return level;
  }
  throw new Error('Could not build hexagonal groups');
}
export const alveolesRules={
  create:createAlveolesLevel,initial,move,won,
  actions(level,state){
    const actions=[];
    for(let q=0;q<3;q++){const stack=level.queues[q][state.queues[q]];if(!stack)continue;for(let cell=0;cell<level.cells.length;cell++)if(!state.stacks[cell].length){const action={q,cell},next=move(level,state,action);actions.push({action,score:(next.cleared-state.cleared)*10+hexNeighbors(level,cell).filter(id=>state.stacks[id].at(-1)===stack.at(-1)).length});}}
    return actions.sort((a,b)=>b.score-a.score).map(a=>a.action);
  },
  plan:(level,state)=>searchPlan(alveolesRules,level,state,15000),
};
