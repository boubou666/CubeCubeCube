import {checkIndex,clone,random,shuffle,searchPlan} from './pocket-core.js';
const SHAPES=[[[0,0],[1,0],[2,0]],[[0,0],[1,0],[2,0],[3,0]],[[0,0],[1,0],[0,1]],[[0,0],[1,0],[2,0],[0,1]],[[0,0],[1,0],[1,1],[2,1]],[[0,0],[1,0],[2,0],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[0,1]],[[0,0],[1,0],[2,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[2,1],[3,1]]];
export const pieceWidth=piece=>Math.max(...piece.cells.map(p=>p[0]))+1;
export const pieceHeight=piece=>Math.max(...piece.cells.map(p=>p[1]))+1;
export function activePieces(level,state){const start=Math.floor(state.used.length/3)*3;return level.pieces.slice(start,start+3).filter(p=>!state.used.includes(p.id));}
export function mosaicCells(level,piece,x,y){if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+pieceWidth(piece)>level.size||y+pieceHeight(piece)>level.size)return null;return piece.cells.map(([dx,dy])=>(y+dy)*level.size+x+dx);}
function move(level,state,action){
  const piece=activePieces(level,state).find(p=>p.id===action?.id);if(!piece)return null;const cells=mosaicCells(level,piece,action.x,action.y);if(!cells||cells.some(id=>state.field[id]!==null))return null;
  const next=clone(state);for(const id of cells)next.field[id]=piece.color;next.used.push(piece.id);next.used.sort((a,b)=>a-b);next.added+=cells.length;
  const cleared=new Set(),rows=[],cols=[];for(let n=0;n<level.size;n++){const row=Array.from({length:level.size},(_,x)=>n*level.size+x),col=Array.from({length:level.size},(_,y)=>y*level.size+n);if(row.every(id=>next.field[id]!==null)){rows.push(n);row.forEach(id=>cleared.add(id));}if(col.every(id=>next.field[id]!==null)){cols.push(n);col.forEach(id=>cleared.add(id));}}
  for(const id of cleared)next.field[id]=null;next.cleared+=cleared.size;next.lines+=rows.length+cols.length;next.last={cells:[...cleared],rows,cols};return next;
}
function actions(level,state){const result=[];for(const p of activePieces(level,state))for(let y=0;y<=level.size-pieceHeight(p);y++)for(let x=0;x<=level.size-pieceWidth(p);x++){const cells=mosaicCells(level,p,x,y);if(cells.every(id=>state.field[id]===null))result.push({id:p.id,x,y});}return result.sort((a,b)=>move(level,state,b).last.cells.length-move(level,state,a).last.cells.length);}
const cache=new Map();
export function createMosaiqueLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),size=tier>=2?8:6,rng=random(95477+index*3571),field=Array.from({length:size**2},(_,id)=>(Math.floor(id/size)+Math.floor(id%size/2)+index)%6),pieces=[],solution=[];
  for(let band=0;band<size/2;band++){
    let placement=null;
    for(let trial=0;trial<10000;trial++){
      const occupied=new Set(),batch=[];
      for(let n=0;n<3;n++){
        const pool=n===2?(tier===3?SHAPES.slice(8):SHAPES.filter(s=>s.some(p=>p[1]===1))):SHAPES.slice(0,tier===3?10:tier?7:4),cells=clone(pool[Math.floor(rng()*pool.length)]),piece={id:pieces.length+n,cells,color:(index+band+n)%6},width=pieceWidth(piece),height=pieceHeight(piece),x=Math.floor(rng()*(size-width+1)),y=band*2+(height===1?Math.floor(rng()*2):0),ids=mosaicCells({size},piece,x,y);
        if(ids.some(id=>occupied.has(id)))break;ids.forEach(id=>occupied.add(id));batch.push({piece,x,y});
      }
      if(batch.length===3&&(band<size/2-1||new Set([...occupied].map(id=>id%size)).size===size)){placement=batch;break;}
    }
    if(!placement)throw new Error('Could not construct a mosaic batch');for(const {piece,x,y} of placement){pieces.push(piece);for(const id of mosaicCells({size},piece,x,y))field[id]=null;solution.push({id:piece.id,x,y});}
  }
  const level={index,tier,size,field,pieces,total:field.filter(v=>v!==null).length+pieces.reduce((n,p)=>n+p.cells.length,0),solution,title:['Quelques petits carrés','Les pièces du matin','Le petit pavage','Un motif de couleurs','Tout trouve sa place','Les coins du tableau','Un peu de géométrie','Les lignes du jardin','Les pièces cachées','Un tableau bien rempli','La dernière rangée','Une belle mosaïque'][index%12]};
  let state=mosaiqueRules.initial(level);for(const action of solution){state=move(level,state,action);if(!state)throw new Error('Invalid mosaic placement');}if(!mosaiqueRules.won(level,state))throw new Error('Unfinished mosaic');cache.set(index,level);return clone(level);
}
export const mosaiqueRules={create:createMosaiqueLevel,initial:level=>({field:[...level.field],used:[],added:0,cleared:0,lines:0,last:{cells:[],rows:[],cols:[]}}),move,won:(level,state)=>state.used.length===level.pieces.length&&state.field.every(v=>v===null),actions,plan:(level,state)=>searchPlan(mosaiqueRules,level,state,1500)};
