import {checkIndex,random,shuffle} from './pocket-core.js';

const cache=new Map();
export function vigilTargets(l,id){
  if(!Number.isInteger(id)||id<0||id>=l.size**2)return [];
  const x=id%l.size,y=Math.floor(id/l.size),delta=l.pattern==='diagonal'?[[0,0],[-1,-1],[1,-1],[1,1],[-1,1]]:[[0,0],[0,-1],[1,0],[0,1],[-1,0]],targets=new Set();
  for(const [dx,dy]of delta){let a=x+dx,b=y+dy;if(l.wrap){a=(a+l.size)%l.size;b=(b+l.size)%l.size;}if(a>=0&&b>=0&&a<l.size&&b<l.size)targets.add(b*l.size+a);}return [...targets];
}
function initial(l){return {lit:[...l.lit]};}
function move(l,s,a){if(!a||!Number.isInteger(a.cell))return null;const targets=vigilTargets(l,a.cell);if(!targets.length)return null;const lit=[...s.lit];targets.forEach(id=>lit[id]=!lit[id]);return {lit};}
function won(l,s){return s.lit.every(v=>!v);}
export function solveVeillees(l,s){
  const n=l.size**2,rows=Array.from({length:n},(_,id)=>{let row=s.lit[id]?1n<<BigInt(n):0n;for(let cell=0;cell<n;cell++)if(vigilTargets(l,cell).includes(id))row|=1n<<BigInt(cell);return row;}),pivots=[];
  let row=0;for(let col=0;col<n&&row<n;col++){
    const bit=1n<<BigInt(col),found=rows.findIndex((v,id)=>id>=row&&Boolean(v&bit));if(found<0)continue;
    [rows[row],rows[found]]=[rows[found],rows[row]];for(let other=0;other<n;other++)if(other!==row&&rows[other]&bit)rows[other]^=rows[row];pivots.push(col);row++;
  }
  const coefficients=(1n<<BigInt(n))-1n;if(rows.some(v=>!(v&coefficients)&&Boolean(v>>BigInt(n)&1n)))return null;
  const cells=[];for(let id=0;id<pivots.length;id++)if(rows[id]>>BigInt(n)&1n)cells.push(pivots[id]);return cells.map(cell=>({cell}));
}
export function createVeilleesLevel(index){
  checkIndex(index);if(cache.has(index))return cache.get(index);
  const tier=Math.floor(index/12),size=[3,4,5,6][tier],pattern=tier===2||tier===3&&index%2?'diagonal':'cross',wrap=tier===3,l={index,tier,size,pattern,wrap},rng=random(129071+index*7919);
  for(let salt=0;salt<200;salt++){
    let s={lit:Array(size**2).fill(false)};const choices=shuffle(Array.from({length:size**2},(_,id)=>id),rng).slice(0,Math.min(size**2,3+tier*3+index%3));
    for(const cell of choices)s=move(l,s,{cell});l.lit=s.lit;l.solution=solveVeillees(l,s);
    if(won(l,s)||l.solution.length<2+tier)continue;
    l.title=['Les premières lanternes','Un coin de lumière','Une petite veillée','Les lumières voisines','Tout s’éteint doucement','Le dernier reflet','Un motif dans la nuit','De proche en proche','Les coins du jardin','La lumière fait le tour','Un peu de nuit encore','Le jardin s’endort'][index%12];cache.set(index,l);return l;
  }throw new Error(`Cannot construct vigil ${index}`);
}
export const veilleesRules={create:createVeilleesLevel,initial,move,won,plan:solveVeillees,actions:l=>Array.from({length:l.size**2},(_,cell)=>({cell}))};
