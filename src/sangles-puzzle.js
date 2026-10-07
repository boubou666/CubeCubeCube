import {checkIndex,clone,random,shuffle} from './pocket-core.js';
import {cargoDistance,simulateCargo} from './cargo-simulation.js';
export function beltLength(l,path){return path.slice(1).reduce((n,id,i)=>n+Math.hypot(l.posts[id].x-l.posts[path[i]].x,l.posts[id].y-l.posts[path[i]].y),0);}
export function validBelt(l,id,path){
  if(!l.belts[id]||!Array.isArray(path)||path.length>4||path.length===1||path.some(n=>!Number.isInteger(n)||!l.posts[n])||new Set(path).size!==path.length)return false;if(!path.length)return true;
  if(beltLength(l,path)>l.belts[id].maxLength+.001)return false;
  for(let n=1;n<path.length;n++){const a=l.posts[path[n-1]],b=l.posts[path[n]];if(l.parcels.some(p=>cargoDistance([p.x,p.y],[a.x,a.y],[b.x,b.y]).d<p.r+3))return false;
    for(const wall of l.walls){if(wall.a[0]!==wall.b[0])continue;const x=wall.a[0];if((a.x-x)*(b.x-x)<0)return false;}
  }return true;
}
function move(l,s,a){if(!a)return null;const next=clone(s);if(a.type==='belt'){if(!Number.isInteger(a.id)||!validBelt(l,a.id,a.path)||JSON.stringify(s.routes[a.id])===JSON.stringify(a.path))return null;next.routes[a.id]=[...a.path];next.result=null;}else if(a.type==='run'){next.trial++;next.result=simulateCargo(l,next);}else return null;return next;}
const won=(l,s)=>s.result?.caught===l.parcels.length;
const cache=new Map();
export function createSanglesLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),rng=random(73091+index*7919),bays=[1,2,2,3][tier],left=80,right=560,top=90,bottom=520,width=(right-left)/bays,posts=[],walls=[{a:[left,top],b:[right,top]}],parcels=[],belts=[],routes=[];
  for(let n=0;n<=bays;n++){const x=left+n*width;walls.push({a:[x,top],b:[x,bottom]});for(let row=0;row<3;row++)posts.push({id:posts.length,x,y:[285,390,475][row]+Math.floor(rng()*21)-10,peg:false});}
  for(let bay=0;bay<bays;bay++){
    const count=tier>=2?3:2;for(let n=0;n<count;n++)parcels.push({id:parcels.length,x:left+bay*width+width*(n+1)/(count+1),y:150+Math.floor(rng()*65),r:13+Math.floor(rng()*5),mass:.75+rng()*.55,color:(index+bay+n)%6,kind:(index+n)%3});
    const id=belts.length;belts.push({id,color:(index+bay)%6,maxLength:width*1.18,strength:1000000});routes.push([bay*3,(bay+1)*3]);if(tier>=2)posts.push({id:posts.length,x:left+(bay+.5)*width,y:335+Math.floor(rng()*15),peg:true});
  }
  const l={index,tier,bays,left,right,top,bottom,walls,posts,parcels,belts,targets:routes,phase:rng()*Math.PI*2,sway:65+tier*30,order:shuffle(belts.map(b=>b.id),rng),solution:routes.map((path,id)=>({type:'belt',id,path})),title:['La première sangle','Deux petits colis','Le tour du jardin','Un départ tranquille','La place des bagages','Le freinage du matin','Un petit virage','Les colis restent ensemble','La sangle du milieu','Avant de prendre la route','Encore un petit tour','Tout arrive à destination'][index%12]};
  const audit=simulateCargo(l,{routes});if(audit.caught!==parcels.length)throw new Error(`Cargo audit failed ${index}: ${JSON.stringify(audit)}`);belts.forEach((b,id)=>b.strength=Math.ceil(audit.peaks[id]*1.18+12));l.solution.push({type:'run'});let s=initial(l);for(const a of l.solution){s=move(l,s,a);if(!s)throw new Error(`Invalid belt ${index}`);}if(!won(l,s)||simulateCargo(l,initial(l)).caught===parcels.length)throw new Error(`Cargo construction ${index}`);cache.set(index,l);return clone(l);
}
function initial(l){return {routes:l.belts.map(()=>[]),trial:0,result:null};}
function plan(l,s){if(simulateCargo(l,s).caught===l.parcels.length)return [{type:'run'}];const out=[];let next=clone(s);for(let id=0;id<l.belts.length;id++)if(JSON.stringify(next.routes[id])!==JSON.stringify(l.targets[id])){const a={type:'belt',id,path:l.targets[id]};next=move(l,next,a);if(!next)return null;out.push(a);}out.push({type:'run'});return won(l,move(l,next,{type:'run'}))?out:null;}
export const sanglesRules={create:createSanglesLevel,initial,move,won,plan,actions:(l,s)=>[{type:'run'},...l.belts.flatMap(b=>s.routes[b.id].length?[{type:'belt',id:b.id,path:[]}]:[])]};
