import {checkIndex,clone,random,shuffle,searchPlan} from './pocket-core.js';
export function connectionRoute(level,field,a,b){
  if(!Number.isInteger(a)||!Number.isInteger(b)||a===b||a<0||b<0||a>=field.length||b>=field.length)return null;
  const cols=level.cols,rows=level.rows,start=[a%cols,Math.floor(a/cols)],target=[b%cols,Math.floor(b/cols)],steps=[[1,0],[0,1],[-1,0],[0,-1]],queue=[{x:start[0],y:start[1],dir:-1,turns:0,parent:-1}],seen=new Map();
  for(let cursor=0;cursor<queue.length;cursor++){
    const node=queue[cursor];if(node.x===target[0]&&node.y===target[1]){const path=[];for(let id=cursor;id>=0;id=queue[id].parent)path.unshift([queue[id].x,queue[id].y]);return path.filter((p,n)=>n===0||n===path.length-1||(p[0]-path[n-1][0])!==(path[n+1][0]-p[0])||(p[1]-path[n-1][1])!==(path[n+1][1]-p[1]));}
    for(let dir=0;dir<4;dir++){if(node.dir>=0&&dir===(node.dir+2)%4)continue;const [dx,dy]=steps[dir],x=node.x+dx,y=node.y+dy,turns=node.turns+(node.dir>=0&&dir!==node.dir?1:0);if(x< -1||y< -1||x>cols||y>rows||turns>2)continue;const inside=x>=0&&x<cols&&y>=0&&y<rows;if(inside&&y*cols+x!==b&&field[y*cols+x]!==null)continue;const key=`${x},${y},${dir}`;if((seen.get(key)??3)<=turns)continue;seen.set(key,turns);queue.push({x,y,dir,turns,parent:cursor});}
  }return null;
}
export function duoRoute(level,state,a,b){return state.field[a]!==null&&state.field[a]>=0&&state.field[a]===state.field[b]?connectionRoute(level,state.field,a,b):null;}
function move(level,state,action){if(!duoRoute(level,state,action?.a,action?.b))return null;const next=clone(state);next.field[action.a]=null;next.field[action.b]=null;next.pairs++;return next;}
function actions(level,state){const result=[];for(let a=0;a<state.field.length;a++)if(state.field[a]!==null&&state.field[a]>=0)for(let b=a+1;b<state.field.length;b++)if(duoRoute(level,state,a,b))result.push({a,b});return result;}
const cache=new Map();
export function createDuosLevel(index){
  checkIndex(index);if(cache.has(index))return clone(cache.get(index));const tier=Math.floor(index/12),cols=[4,6,6,8][tier],rows=[4,4,6,6][tier],field=Array(cols*rows).fill(null),rng=random(43181+index*7927),solution=[];
  if(tier>=2){field[Math.floor(rows/2)*cols+Math.floor(cols/2)]=-1;field[(Math.floor(rows/2)-1)*cols+Math.floor(cols/2)-1]=-1;}
  const level={index,tier,cols,rows,field,solution,title:['Deux petites feuilles','Les chemins du matin','Les paires du jardin','Un petit virage','Derrière les voisins','Un passage libre','Les coins du tableau','Le détour du bord','Quelques petits duos','Deux virages plus loin','Les derniers motifs','Toutes les paires'][index%12]};
  for(let guard=0;guard<field.length/2;guard++){
    const empty=shuffle(field.flatMap((v,id)=>v===null?[id]:[]),rng);let pair=null;for(let a=0;a<empty.length&&!pair;a++)for(let b=a+1;b<empty.length;b++)if(connectionRoute(level,field,empty[a],empty[b])){pair=[empty[a],empty[b]];break;}if(!pair)break;const color=Math.floor(rng()*(3+tier)),[a,b]=pair;field[a]=color;field[b]=color;solution.unshift({a,b});
  }level.total=solution.length*2;cache.set(index,level);return clone(level);
}
export const duosRules={create:createDuosLevel,initial:level=>({field:[...level.field],pairs:0}),move,won:(level,state)=>state.field.every(v=>v===null||v<0),actions,plan:(level,state)=>searchPlan(duosRules,level,state,2000)};
