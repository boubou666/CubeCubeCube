import {checkIndex,clone,random,shuffle,searchPlan} from './pocket-core.js';
export function jellyCells(piece,turns=0){let cells=clone(piece.cells);for(let n=0;n<turns;n++)cells=cells.map(([x,y])=>[-y,x]);const minX=Math.min(...cells.map(p=>p[0])),minY=Math.min(...cells.map(p=>p[1]));return cells.map(([x,y])=>[x-minX,y-minY]);}
export function jellyDrop(level,state,piece,turns,x){
  const cells=jellyCells(piece,turns),height=Math.max(...cells.map(p=>p[1]))+1;if(cells.some(p=>x+p[0]<0||x+p[0]>=level.cols))return null;
  const fits=y=>cells.every(([dx,dy])=>y+dy<0||y+dy<level.rows&&state.field[(y+dy)*level.cols+x+dx]===null);let y=-height;if(!fits(y))return null;while(fits(y+1))y++;return cells.some(p=>p[1]+y<0)?null:{cells,y};
}
function move(level,state,a){if(!a||!Number.isInteger(a.id)||!level.pieces[a.id]||state.used.includes(a.id)||!Number.isInteger(a.turns)||a.turns<0||a.turns>3||!Number.isInteger(a.x))return null;const drop=jellyDrop(level,state,level.pieces[a.id],a.turns,a.x);if(!drop)return null;const next=clone(state);for(const [x,y] of drop.cells)next.field[(y+drop.y)*level.cols+x+a.x]=a.id;next.used.push(a.id);next.placed.push({...a,y:drop.y});return next;}
function actions(level,state){const result=[];for(const p of level.pieces)if(!state.used.includes(p.id))for(let turns=0;turns<4;turns++)for(let x=0;x<level.cols;x++)if(jellyDrop(level,state,p,turns,x))result.push({id:p.id,turns,x});return result;}
const won=(level,state)=>state.used.length===level.pieces.length&&state.field.every(v=>v!==null);
const cache=new Map();
export function createGeleesLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),cols=[4,5,5,6][tier],rows=[4,4,6,6][tier],rng=random(48713+index*7919),field=Array(cols*rows).fill(null),pieces=[],solution=[];
  const add=(cells,x)=>{const id=pieces.length,rotation=Math.floor(rng()*4),piece={id,cells:jellyCells({cells},rotation),color:(id+index)%6};pieces.push(piece);solution.push({id,turns:(4-rotation)%4,x});};
  for(let band=0;band<rows/2;band++){
    let x=0;if(tier>=2&&band===0){field[(rows-1)*cols]=-1;field[(rows-2)*cols]=-1;x=1;}
    while(x<cols){const remaining=cols-x,w=remaining>=3&&rng()<.7?3:remaining>=2?2:1;
      if(w===3){add([[0,0],[0,1],[1,1]],x);add([[0,0],[1,0],[1,1]],x+1);}
      else if(w===2&&rng()<.5){add([[0,0],[0,1],[1,1]],x);add([[0,0]],x+1);}
      else if(w===2)add([[0,0],[1,0],[0,1],[1,1]],x);
      else add([[0,0],[0,1]],x);x+=w;
    }
  }
  const level={index,tier,cols,rows,field,pieces,order:shuffle(pieces.map(p=>p.id),rng),solution,total:field.filter(v=>v===null).length,title:['Quelques petites gelées','Le pot du matin','Un petit rebond','La forme des douceurs','Tournez la gelée','Le coin qui manquait','Une place dans le pot','Sous la ligne blanche','Les formes se retrouvent','Un petit empilement','Encore un quart de tour','Le pot bien rempli'][index%12]};
  let state={field:[...field],used:[],placed:[]};for(const a of solution){state=move(level,state,a);if(!state)throw new Error(`Jelly drop blocked ${index}`);}if(!won(level,state))throw new Error(`Unfilled jelly tray ${index}`);cache.set(index,level);return clone(level);
}
export const geleesRules={create:createGeleesLevel,initial:l=>({field:[...l.field],used:[],placed:[]}),move,won,actions,plan:(l,s)=>searchPlan(geleesRules,l,s,2500)};
