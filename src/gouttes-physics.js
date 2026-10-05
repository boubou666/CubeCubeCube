import { closestOnSegment } from './physics-geometry.js';
export const WATER_TOTAL=60,WATER_TICKS=720,WATER_RADIUS=2.8,DT=1/120;
const polySegments=path=>path.slice(1).map((p,i)=>[path[i],p]);
export function waterSegments(level,lines){
  const cup=level.cup;
  return [...level.obstacles.flatMap(o=>polySegments([[o.x,o.y],[o.x+o.w,o.y],[o.x+o.w,o.y+o.h],[o.x,o.y+o.h],[o.x,o.y]])),...lines.flatMap(polySegments),
    [[cup.x-cup.w/2,cup.y],[cup.x-cup.w/2,cup.y+cup.h]],[[cup.x+cup.w/2,cup.y],[cup.x+cup.w/2,cup.y+cup.h]],[[cup.x-cup.w/2,cup.y+cup.h],[cup.x+cup.w/2,cup.y+cup.h]]];
}
export class WaterSimulation{
  constructor(level,lines){this.level=level;this.segments=waterSegments(level,lines);this.tick=0;this.emitted=0;this.caught=0;this.lost=0;this.particles=[];}
  get done(){return this.tick>=WATER_TICKS||this.emitted===WATER_TOTAL&&!this.particles.length;}
  step(){
    if(this.done)return;
    if(this.tick%2===0&&this.emitted<WATER_TOTAL){const id=this.emitted++,phase=(id*37+this.level.index*13)%101/100;this.particles.push({id,x:this.level.source[0]+(phase-.5)*7,y:this.level.source[1],vx:(phase-.5)*12,vy:26,age:0});}
    const survivors=[],cup=this.level.cup;
    for(const p of this.particles){
      p.age++;p.vy=Math.min(480,p.vy+860*DT);p.vx=Math.max(-480,Math.min(480,p.vx));p.x+=p.vx*DT;p.y+=p.vy*DT;
      for(let iteration=0;iteration<2;iteration++)for(const [a,b] of this.segments){
        const [x,y]=closestOnSegment(p.x,p.y,a,b),dx=p.x-x,dy=p.y-y,d2=dx*dx+dy*dy,r=WATER_RADIUS+2;
        if(d2>=r*r)continue;
        const d=Math.sqrt(d2),nx=d>1e-6?dx/d:0,ny=d>1e-6?dy/d:-1;
        p.x=x+nx*(r+.02);p.y=y+ny*(r+.02);const normal=p.vx*nx+p.vy*ny;
        if(normal<0){p.vx-=normal*nx*1.04;p.vy-=normal*ny*1.04;}p.vx*=.996;p.vy*=.996;
      }
      if(p.x>cup.x-cup.w/2+WATER_RADIUS&&p.x<cup.x+cup.w/2-WATER_RADIUS&&p.y>=cup.y+WATER_RADIUS&&p.y<=cup.y+cup.h-WATER_RADIUS){this.caught++;continue;}
      if(p.y>580||p.x<20||p.x>620||p.age>650){this.lost++;continue;}
      survivors.push(p);
    }
    this.particles=survivors;this.tick++;
    if(this.tick===WATER_TICKS){this.lost+=this.particles.length;this.particles=[];}
  }
  result(){return {caught:this.caught,lost:this.lost,total:WATER_TOTAL,ticks:this.tick};}
}
export function simulateWater(level,lines){const simulation=new WaterSimulation(level,lines);while(!simulation.done)simulation.step();return simulation.result();}
