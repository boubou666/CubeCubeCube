import {clone} from './pocket-core.js';
export const RAIL_DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
export function railMask(level,state,cell){const tile=level.field[cell];if(!tile)return 0;if(tile.type==='switch'){const s=level.switches[tile.id];return (1<<s.stem)|(1<<s.options[state.switches[tile.id]]);}return tile.mask;}
export class RailFlow{
  constructor(level,state){this.level=level;this.state=state;this.tick=0;this.done=false;this.trains=level.trains.map(t=>({...t,cell:t.source,dir:t.dir,status:'queued',history:[],seen:[],clear:0}));}
  step(){if(this.done)return;const old=this.trains.map(t=>t.cell),proposals=[];
    for(let id=0;id<this.trains.length;id++){const t=this.trains[id];if(t.status==='queued'){if(this.tick>=this.state.delays[id]){t.status='active';t.history.push(t.cell);}continue;}
      if(t.status==='arriving'){t.clear++;t.history.push(t.cell);if(t.clear>=t.length)t.status='arrived';continue;}if(t.status!=='active')continue;
      const [dx,dy]=RAIL_DIRS[t.dir],x=t.cell%this.level.size+dx,y=Math.floor(t.cell/this.level.size)+dy;if(x<0||y<0||x>=this.level.size||y>=this.level.size){t.status='derailed';continue;}const cell=y*this.level.size+x,tile=this.level.field[cell],incoming=(t.dir+2)%4,mask=railMask(this.level,this.state,cell);
      if(!(mask&(1<<incoming))){t.status='derailed';continue;}let dir=t.dir;if(tile.type==='station'){if(tile.color!==t.color){t.status='derailed';continue;}proposals.push({id,cell,dir,station:true});}
      else{const ports=[0,1,2,3].filter(d=>d!==incoming&&(mask&(1<<d)));dir=tile.type==='cross'?t.dir:ports[0];if(dir===undefined||!(mask&(1<<dir))||t.seen.includes(`${cell}:${dir}`)){t.status='derailed';continue;}proposals.push({id,cell,dir});}
    }
    for(const p of proposals){const t=this.trains[p.id];t.cell=p.cell;t.dir=p.dir;t.history.push(p.cell);t.seen.push(`${p.cell}:${p.dir}`);if(p.station)t.status='arriving';}
    const occupied=new Map();for(let id=0;id<this.trains.length;id++){const t=this.trains[id];if(!['active','arriving'].includes(t.status))continue;for(const cell of new Set(t.history.slice(-t.length))){if(occupied.has(cell)){t.status='crashed';this.trains[occupied.get(cell)].status='crashed';}else occupied.set(cell,id);}}
    for(let a=0;a<proposals.length;a++)for(let b=a+1;b<proposals.length;b++){const p=proposals[a],q=proposals[b];if(p.cell===old[q.id]&&q.cell===old[p.id]){this.trains[p.id].status='crashed';this.trains[q.id].status='crashed';}}
    this.tick++;if(this.tick>=160)for(const t of this.trains)if(['active','queued','arriving'].includes(t.status))t.status='derailed';this.done=this.trains.every(t=>['arrived','crashed','derailed'].includes(t.status));
  }
  result(){return {caught:this.trains.filter(t=>t.status==='arrived').length,lost:this.trains.filter(t=>['crashed','derailed'].includes(t.status)).length,total:this.trains.length,tick:this.tick,trains:clone(this.trains)};}
}
export function simulateRails(level,state){const flow=new RailFlow(level,state);while(!flow.done)flow.step();return flow.result();}
