import {clone} from './pocket-core.js';
export const CARGO_DT=1/120,CARGO_TICKS=384;
export function cargoDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));const x=a[0]+t*dx,y=a[1]+t*dy;return {x,y,d:Math.hypot(p[0]-x,p[1]-y)};}
function contact(p,a,b){const q=cargoDistance([p.x,p.y],a,b);if(q.d>=p.r)return null;const nx=q.d>1e-7?(p.x-q.x)/q.d:0,ny=q.d>1e-7?(p.y-q.y)/q.d:-1,v=p.vx*nx+p.vy*ny;return {nx,ny,depth:p.r-q.d,impulse:Math.max(0,-v)*p.mass*1.05};}
function resolve(p,c){p.x+=c.nx*c.depth;p.y+=c.ny*c.depth;const v=p.vx*c.nx+p.vy*c.ny;if(v<0){p.vx-=1.05*v*c.nx;p.vy-=1.05*v*c.ny;}const tangent=p.vx*-c.ny+p.vy*c.nx;p.vx+=.025*tangent*c.ny;p.vy-=.025*tangent*c.nx;}
export class CargoFlow{
  constructor(level,state){this.level=level;this.routes=clone(state.routes);this.tick=0;this.done=false;this.broken=level.belts.map(()=>false);this.peaks=level.belts.map(()=>0);this.parcels=level.parcels.map(p=>({...p,vx:0,vy:0,lost:false}));}
  step(){if(this.done)return;const t=this.tick*CARGO_DT,ax=Math.sin(t*4.4+this.level.phase)*this.level.sway,ay=t<.9?120:t<1.8?380:170,l=this.level;
    for(const p of this.parcels){if(p.lost)continue;p.vx=(p.vx+ax*CARGO_DT)*.997;p.vy=(p.vy+ay*CARGO_DT)*.997;p.x+=p.vx*CARGO_DT;p.y+=p.vy*CARGO_DT;}
    for(let pass=0;pass<3;pass++){
      for(const p of this.parcels){if(p.lost)continue;for(const wall of l.walls){const c=contact(p,wall.a,wall.b);if(c)resolve(p,c);}for(const post of l.posts.filter(p=>p.peg)){const dx=p.x-post.x,dy=p.y-post.y,d=Math.hypot(dx,dy),r=p.r+8;if(d<r){const c={nx:d?dx/d:0,ny:d?dy/d:-1,depth:r-d};resolve(p,c);}}
        for(let id=0;id<this.routes.length;id++){if(this.broken[id])continue;const path=this.routes[id];for(let n=1;n<path.length;n++){const a=l.posts[path[n-1]],b=l.posts[path[n]],c=contact(p,[a.x,a.y],[b.x,b.y]);if(!c)continue;this.peaks[id]=Math.max(this.peaks[id],c.impulse);if(c.impulse>l.belts[id].strength){this.broken[id]=true;break;}resolve(p,c);}}
      }
      for(let a=0;a<this.parcels.length;a++)for(let b=a+1;b<this.parcels.length;b++){const p=this.parcels[a],q=this.parcels[b];if(p.lost||q.lost)continue;const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy),r=p.r+q.r;if(d>=r)continue;const nx=d?dx/d:1,ny=d?dy/d:0,share=q.mass/(p.mass+q.mass),depth=r-d;p.x-=nx*depth*share;p.y-=ny*depth*share;q.x+=nx*depth*(1-share);q.y+=ny*depth*(1-share);const v=(q.vx-p.vx)*nx+(q.vy-p.vy)*ny;if(v<0){const impulse=-1.05*v/(1/p.mass+1/q.mass);p.vx-=impulse*nx/p.mass;p.vy-=impulse*ny/p.mass;q.vx+=impulse*nx/q.mass;q.vy+=impulse*ny/q.mass;}}
    }
    for(const p of this.parcels)if(p.y-p.r>l.bottom+24||p.x+p.r<l.left||p.x-p.r>l.right)p.lost=true;
    this.tick++;this.done=this.tick>=CARGO_TICKS||this.parcels.every(p=>p.lost);
  }
  result(){return {caught:this.parcels.filter(p=>!p.lost&&p.y+p.r<=this.level.bottom).length,lost:this.parcels.filter(p=>p.lost||p.y+p.r>this.level.bottom).length,total:this.parcels.length,tick:this.tick,broken:[...this.broken],peaks:[...this.peaks],parcels:clone(this.parcels)};}
}
export function simulateCargo(level,state){const flow=new CargoFlow(level,state);while(!flow.done)flow.step();return flow.result();}
