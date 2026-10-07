import {checkIndex,random,shuffle} from './pocket-core.js';

const cache=new Map(),lineCache=new Map();
export function engravingClues(values){const clues=[];let count=0;for(const value of [...values,0]){if(value)count++;else if(count){clues.push(count);count=0;}}return clues.length?clues:[0];}
export function engravingPatterns(size,clues){
  const key=`${size}:${clues}`;if(lineCache.has(key))return lineCache.get(key);
  const patterns=[];for(let mask=0;mask<1<<size;mask++){const row=Array.from({length:size},(_,x)=>mask>>x&1);if(engravingClues(row).join(',')===clues.join(','))patterns.push(row);}lineCache.set(key,patterns);return patterns;
}
export function engravingDeduction(l,field){
  const n=l.size,state=[...field];let changed=true;
  while(changed){changed=false;
    for(let axis=0;axis<2;axis++)for(let line=0;line<n;line++){
      const cells=Array.from({length:n},(_,k)=>axis?k*n+line:line*n+k),clues=(axis?l.columns:l.rows)[line],patterns=engravingPatterns(n,clues).filter(p=>cells.every((id,k)=>state[id]===0||state[id]===(p[k]?1:2)));
      if(!patterns.length)return {field:state,contradiction:true};
      for(let k=0;k<n;k++)if(state[cells[k]]===0&&patterns.every(p=>p[k]===patterns[0][k])){state[cells[k]]=patterns[0][k]?1:2;changed=true;}
    }
  }return {field:state,contradiction:false};
}
function initial(l){return {field:Array(l.size**2).fill(0)};}
function move(l,s,a){
  if(!a||!Array.isArray(a.cells)||!a.cells.length||a.cells.length>l.size**2||new Set(a.cells).size!==a.cells.length||a.cells.some(id=>!Number.isInteger(id)||id<0||id>=l.size**2)||!Array.isArray(a.values)||a.values.length!==a.cells.length||a.values.some(v=>![0,1,2].includes(v)))return null;
  const field=[...s.field];let changed=false;for(let n=0;n<a.cells.length;n++){changed ||= field[a.cells[n]]!==a.values[n];field[a.cells[n]]=a.values[n];}return changed?{field}:null;
}
export function engravingLines(l,s){
  return [l.rows,l.columns].map((clues,axis)=>clues.map((wanted,line)=>{
    const values=Array.from({length:l.size},(_,k)=>s.field[axis?k*l.size+line:line*l.size+k]);
    const possible=engravingPatterns(l.size,wanted).some(p=>values.every((v,k)=>v===0||v===(p[k]?1:2)));
    return !possible?'conflict':values.every(Boolean)&&engravingClues(values.map(v=>v===1)).join(',')===wanted.join(',')?'complete':'open';
  }));
}
function won(l,s){if(s.field.some(v=>v===0))return false;return engravingLines(l,s).every(lines=>lines.every(v=>v==='complete'));}
export function createGravuresLevel(index){
  checkIndex(index);if(cache.has(index))return cache.get(index);
  const tier=Math.floor(index/12),size=5+tier;
  for(let salt=0;salt<2000;salt++){
    const rng=random(120071+index*7919+salt*104729),image=Array(size**2).fill(0),kind=(index+salt)%4,cx=(size-1)/2;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const dx=Math.abs(x-cx),dy=Math.abs(y-(size-1)*.42);
      let fill=kind===0?(dy<1.3&&dx<size*.39||y>=Math.floor(size*.56)&&x===Math.floor(cx)):
        kind===1?(y>=size-2&&dx<size*.34||y>=size-4&&y<size-2&&dx<size*.44||y<size-3&&dx<.6):
        kind===2?(dx+Math.abs(y-cx)<size*.46||x===Math.floor(cx)&&y>=cx):
        (y===size-1&&dx<size*.36||y>=size*.35&&y<size-1&&dx<1.4||y<size*.35&&dx<2.4&&dx+dy<size*.58);
      // Hand-drawn silhouette families receive small seeded contours and reflections.
      if(rng()<[.08,.12,.16,.18][tier])fill=!fill;image[y*size+x]=fill?1:0;
    }
    const flip=rng()<.5,rotate=Math.floor(rng()*4),transformed=Array(size**2).fill(0);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){let a=flip?size-1-x:x,b=y;for(let turn=0;turn<rotate;turn++)[a,b]=[size-1-b,a];transformed[b*size+a]=image[y*size+x];}
    const rows=Array.from({length:size},(_,y)=>engravingClues(transformed.slice(y*size,(y+1)*size))),columns=Array.from({length:size},(_,x)=>engravingClues(Array.from({length:size},(_,y)=>transformed[y*size+x]))),l={index,tier,size,rows,columns,image:transformed};
    const audit=engravingDeduction(l,initial(l).field);if(audit.contradiction||audit.field.some(v=>v===0))continue;
    l.solution=Array.from({length:size},(_,y)=>({cells:Array.from({length:size},(_,x)=>y*size+x),values:transformed.slice(y*size,(y+1)*size).map(v=>v?1:2)}));l.title=['Les premiers traits','Une petite silhouette','L’image se révèle','Les lignes du jardin','La gravure attend','Comptez les petits traits','Une feuille se dessine','Les réserves du papier','Un motif à retrouver','Le portrait des cases','Une image après l’autre','La dernière gravure'][index%12];cache.set(index,l);return l;
  }throw new Error(`Cannot construct engraving ${index}`);
}
function plan(l,s){
  const corrected=[...s.field],out=[],wrong=corrected.flatMap((v,id)=>v&&v!==(l.image[id]?1:2)?[id]:[]);
  if(wrong.length){out.push({cells:wrong,values:wrong.map(()=>0)});wrong.forEach(id=>corrected[id]=0);}
  // Each hint completes the deductions of one row. No timers or paid cell reveals.
  const deduced=engravingDeduction(l,corrected);if(deduced.contradiction)return null;
  for(let y=0;y<l.size;y++){
    const cells=Array.from({length:l.size},(_,x)=>y*l.size+x).filter(id=>corrected[id]!==deduced.field[id]);
    if(cells.length)out.push({cells,values:cells.map(id=>deduced.field[id])});
  }return out;
}
export const gravuresRules={create:createGravuresLevel,initial,move,won,plan,actions:(l,s)=>s.field.flatMap((v,id)=>[0,1,2].filter(value=>value!==v).map(value=>({cells:[id],values:[value]})))};
