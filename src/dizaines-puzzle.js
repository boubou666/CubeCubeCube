import {checkIndex,clone,random,shuffle,searchPlan} from './pocket-core.js';
export function numberLine(level,field,a,b){
  if(!Number.isInteger(a)||!Number.isInteger(b)||a===b||a<0||b<0||a>=field.length||b>=field.length)return false;
  const lo=Math.min(a,b),hi=Math.max(a,b);if(field.slice(lo+1,hi).every(v=>v===null))return true;
  const ax=a%level.cols,ay=Math.floor(a/level.cols),bx=b%level.cols,by=Math.floor(b/level.cols),dx=bx-ax,dy=by-ay;
  if(dx&&dy&&Math.abs(dx)!==Math.abs(dy))return false;const n=Math.max(Math.abs(dx),Math.abs(dy));for(let i=1;i<n;i++)if(field[(ay+Math.sign(dy)*i)*level.cols+ax+Math.sign(dx)*i]!==null)return false;return true;
}
export function matchingNumbers(level,state,a,b){const x=state.field[a],y=state.field[b];return x!==null&&y!==null&&x!==undefined&&y!==undefined&&(x===y||x+y===10)&&numberLine(level,state.field,a,b);}
function move(level,state,action){if(!matchingNumbers(level,state,action?.a,action?.b))return null;const next=clone(state);next.field[action.a]=null;next.field[action.b]=null;next.pairs++;return next;}
function actions(level,state){const result=[];for(let a=0;a<state.field.length;a++)if(state.field[a]!==null)for(let b=a+1;b<state.field.length;b++)if(matchingNumbers(level,state,a,b))result.push({a,b});return result;}
export function createDizainesLevel(index){
  checkIndex(index);const tier=Math.floor(index/12),cols=5+Math.floor((tier+1)/2),rows=4+tier,rng=random(441773+index*7919),field=Array(cols*rows).fill(null),solution=[],count=Math.floor(cols*rows/2),level={index,tier,cols,rows,field,solution,title:['Deux petits nombres','La somme du matin','Le bois des chiffres','D’un bord à l’autre','Les petits calculs','Un chemin de dix','Les paires cachées','En diagonale','Le dernier chiffre','Les longues lignes','Un peu de logique','Toutes les dizaines'][index%12]};
  for(let n=0;n<count;n++){
    const empty=shuffle(field.flatMap((v,id)=>v===null?[id]:[]),rng),candidates=[];for(let a=0;a<empty.length;a++)for(let b=a+1;b<empty.length;b++)if(numberLine(level,field,empty[a],empty[b]))candidates.push([empty[a],empty[b]]);if(!candidates.length)break;
    const [a,b]=candidates[Math.floor(rng()*candidates.length)],v=1+Math.floor(rng()*9);field[a]=v;field[b]=rng()<.45?v:10-v;solution.unshift({a,b});
  }
  level.total=solution.length*2;return level;
}
export const dizainesRules={create:createDizainesLevel,initial:level=>({field:[...level.field],pairs:0}),move,won:(level,state)=>state.field.every(v=>v===null),actions,plan:(level,state)=>searchPlan(dizainesRules,level,state,5000)};
