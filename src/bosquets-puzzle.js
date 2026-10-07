import {checkIndex,random,shuffle} from './pocket-core.js';

const cache=new Map();
const near=(a,b,size)=>Math.abs(a%size-b%size)<=1&&Math.abs(Math.floor(a/size)-Math.floor(b/size))<=1;
export function bosquetStatus(l,s){
  const flowers=s.field.flatMap((value,id)=>value===1?[id]:[]),conflicts=new Set();
  for(let a=0;a<flowers.length;a++)for(let b=a+1;b<flowers.length;b++){
    const x=flowers[a],y=flowers[b];
    if(x%l.size===y%l.size||Math.floor(x/l.size)===Math.floor(y/l.size)||l.regions[x]===l.regions[y]||near(x,y,l.size)){conflicts.add(x);conflicts.add(y);}
  }
  return {flowers,conflicts:[...conflicts],valid:flowers.filter(id=>!conflicts.has(id))};
}
export function solveBosquets(l,field=Array(l.size**2).fill(0),limit=2){
  const answers=[],placed=[],n=l.size;
  const walk=(row,columns,regions)=>{
    if(answers.length>=limit)return;
    if(row===n){answers.push([...placed]);return;}
    const forced=field.slice(row*n,(row+1)*n).flatMap((v,x)=>v===1?[x]:[]);if(forced.length>1)return;
    for(const x of forced.length?forced:Array.from({length:n},(_,id)=>id)){
      const id=row*n+x,region=l.regions[id];
      if(field[id]===2||columns&(1<<x)||regions&(1<<region)||row&&Math.abs(placed.at(-1)%n-x)<=1)continue;
      placed.push(id);walk(row+1,columns|(1<<x),regions|(1<<region));placed.pop();
    }
  };walk(0,0,0);return answers;
}
function initial(l){return {field:Array(l.size**2).fill(0)};}
function move(l,s,a){
  if(!a||!Array.isArray(a.cells)||!a.cells.length||a.cells.length>l.size**2||![0,1,2].includes(a.value)||new Set(a.cells).size!==a.cells.length||a.cells.some(id=>!Number.isInteger(id)||id<0||id>=l.size**2))return null;
  const field=[...s.field];let changed=false;for(const id of a.cells){changed ||= field[id]!==a.value;field[id]=a.value;}return changed?{field}:null;
}
function won(l,s){const status=bosquetStatus(l,s);return status.flowers.length===l.size&&status.conflicts.length===0;}
export function createBosquetsLevel(index){
  checkIndex(index);if(cache.has(index))return cache.get(index);
  const tier=Math.floor(index/12),size=5+tier;
  for(let salt=0;salt<4000;salt++){
    const rng=random(111791+index*7919+salt*104729),columns=[],used=new Set();
    const place=row=>{if(row===size)return true;for(const x of shuffle(Array.from({length:size},(_,id)=>id),rng)){if(used.has(x)||row&&Math.abs(columns.at(-1)-x)<=1)continue;columns.push(x);used.add(x);if(place(row+1))return true;columns.pop();used.delete(x);}return false;};place(0);
    const flowers=columns.map((x,y)=>y*size+x),regions=Array(size**2).fill(-1);flowers.forEach((id,region)=>regions[id]=region);
    const weight=flowers.map(()=>.1+rng()**2*2);
    for(let remaining=size**2-size;remaining;remaining--){
      const frontier=[];for(let id=0;id<regions.length;id++)if(regions[id]<0){const x=id%size,y=Math.floor(id/size);for(const other of [y>0?id-size:-1,x<size-1?id+1:-1,y<size-1?id+size:-1,x>0?id-1:-1])if(other>=0&&regions[other]>=0)frontier.push({id,region:regions[other]});}
      let roll=rng()*frontier.reduce((n,p)=>n+weight[p.region],0),pick=frontier.at(-1);for(const p of frontier){roll-=weight[p.region];if(roll<=0){pick=p;break;}}regions[pick.id]=pick.region;
    }
    const l={index,tier,size,regions};if(solveBosquets(l).length!==1)continue;
    l.flowers=flowers;l.solution=flowers.map(id=>({cells:[id],value:1}));l.title=['La première fleur','Un coin pour chacun','Les voisins du jardin','Une ligne, une fleur','Les petits bosquets','Le jardin se partage','Gardez un peu d’air','Une place à trouver','Les couleurs du jardin','Une fleur par allée','Des voisins bien placés','Chaque bosquet fleurit'][index%12];cache.set(index,l);return l;
  }throw new Error(`Cannot construct bosquets ${index}`);
}
function plan(l,s){
  const goal=new Set(l.flowers),clear=s.field.flatMap((v,id)=>v===1&&!goal.has(id)||v===2&&goal.has(id)?[id]:[]),out=[];
  if(clear.length)out.push({cells:clear,value:0});for(const id of l.flowers)if(s.field[id]!==1)out.push({cells:[id],value:1});return out;
}
export const bosquetsRules={create:createBosquetsLevel,initial,move,won,plan,actions:(l,s)=>s.field.flatMap((v,id)=>[0,1,2].filter(value=>value!==v).map(value=>({cells:[id],value})))};
