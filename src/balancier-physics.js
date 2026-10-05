export class CandyFlow{
  constructor(level,cuts=[]){this.level=level;this.cuts=cuts;const b=level.ball;this.ball={x:b.x,y:b.y,px:b.x-(b.vx??0)/120,py:b.y};this.tick=0;this.cut=new Set();this.collected=[];this.caught=false;this.lost=false;this.done=false;this.trace=[];}
  step(){
    if(this.done)return;for(const a of this.cuts)if(a.tick<=this.tick)this.cut.add(a.rope);const b=this.ball,dt=1/120,r=11;
    const vx=Math.max(-400*dt,Math.min(400*dt,(b.x-b.px)*.999)),vy=Math.max(-400*dt,Math.min(400*dt,(b.y-b.py)*.999));b.px=b.x;b.py=b.y;b.x+=vx;b.y+=vy+600*dt*dt;
    for(let pass=0;pass<6;pass++)for(let id=0;id<this.level.ropes.length;id++)if(!this.cut.has(id)){const rope=this.level.ropes[id],dx=b.x-rope.x,dy=b.y-rope.y,d=Math.hypot(dx,dy);if(d>rope.length){b.x=rope.x+dx/d*rope.length;b.y=rope.y+dy/d*rope.length;}}
    for(const o of this.level.obstacles??[]){const x=Math.max(o.x,Math.min(o.x+o.w,b.x)),y=Math.max(o.y,Math.min(o.y+o.h,b.y)),dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy);if(d>0&&d<r){b.x+=dx/d*(r-d);b.y+=dy/d*(r-d);}else if(d===0){const faces=[{d:b.x-o.x,x:o.x-r,y:b.y},{d:o.x+o.w-b.x,x:o.x+o.w+r,y:b.y},{d:b.y-o.y,x:b.x,y:o.y-r},{d:o.y+o.h-b.y,x:b.x,y:o.y+o.h+r}];faces.sort((a,b)=>a.d-b.d);b.x=faces[0].x;b.y=faces[0].y;}}
    for(let n=0;n<(this.level.stars??[]).length;n++)if(!this.collected.includes(n)&&Math.hypot(b.x-this.level.stars[n][0],b.y-this.level.stars[n][1])<r+9)this.collected.push(n);
    const cup=this.level.cup;if(cup&&b.y>=cup.y-r&&b.y<=cup.y+35&&Math.abs(b.x-cup.x)<=cup.w/2-r)this.caught=true;
    if(b.y>570||b.x<25||b.x>615)this.lost=true;this.tick++;this.trace.push([b.x,b.y]);this.done=this.caught||this.lost;
  }
  result(){return {caught:this.caught,lost:this.lost,collected:[...this.collected],tick:this.tick,ball:{x:this.ball.x,y:this.ball.y},cut:[...this.cut]};}
}
export function simulateCandy(level,cuts,until=Math.max(1200,(cuts.at(-1)?.tick??0)+1200)){const flow=new CandyFlow(level,cuts);while(!flow.done&&flow.tick<until)flow.step();return flow;}
