export const SOIL={x:56,y:80,cols:132,rows:112,cell:4,brush:23,radius:9};
export function excavate(soil,path){
  const next=[...soil];let removed=0;
  for(let n=0;n<path.length-1;n++){
    const a=path[n],b=path[n+1],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
    const left=Math.max(0,Math.floor((Math.min(a[0],b[0])-SOIL.brush-SOIL.x)/4)),right=Math.min(SOIL.cols-1,Math.ceil((Math.max(a[0],b[0])+SOIL.brush-SOIL.x)/4)),top=Math.max(0,Math.floor((Math.min(a[1],b[1])-SOIL.brush-SOIL.y)/4)),bottom=Math.min(SOIL.rows-1,Math.ceil((Math.max(a[1],b[1])+SOIL.brush-SOIL.y)/4));
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const id=y*SOIL.cols+x;if(next[id]!==1)continue;const px=SOIL.x+(x+.5)*4,py=SOIL.y+(y+.5)*4,t=length?Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/length)):0;
      if((px-a[0]-dx*t)**2+(py-a[1]-dy*t)**2<=SOIL.brush**2){next[id]=0;removed++;}
    }
  }return {soil:next,removed};
}
export class SoilFlow{
  constructor(level,soil){this.level=level;this.soil=soil;this.balls=level.balls.map((b,id)=>({...b,id,vx:0,vy:0,status:'active'}));this.ticks=0;this.caught=0;this.lost=0;this.done=false;}
  step(){
    if(this.done)return;const r=SOIL.radius,dt=1/120;
    for(let sub=0;sub<2;sub++){
    for(const b of this.balls){
      if(b.status!=='active')continue;b.vy=Math.min(270,b.vy+690*dt);b.vx*=.998;b.x+=b.vx*dt;b.y+=b.vy*dt;
      // Resolve against actual cell rectangles. No path or solution is consulted.
      for(let pass=0;pass<3;pass++){
        const left=Math.max(0,Math.floor((b.x-r-SOIL.x)/4)),right=Math.min(SOIL.cols-1,Math.floor((b.x+r-SOIL.x)/4)),top=Math.max(0,Math.floor((b.y-r-SOIL.y)/4)),bottom=Math.min(SOIL.rows-1,Math.floor((b.y+r-SOIL.y)/4));let nx=0,ny=0,depth=0;
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(this.soil[y*SOIL.cols+x]){
          const xx=SOIL.x+x*4,yy=SOIL.y+y*4,dx=b.x-Math.max(xx,Math.min(xx+4,b.x)),dy=b.y-Math.max(yy,Math.min(yy+4,b.y)),d=Math.hypot(dx,dy);
          if(d<r&&d>.001){const overlap=r-d;nx+=dx/d*overlap;ny+=dy/d*overlap;depth=Math.max(depth,overlap);}
        }
        const magnitude=Math.hypot(nx,ny);if(!magnitude)break;nx/=magnitude;ny/=magnitude;b.x+=nx*depth;b.y+=ny*depth;const speed=b.vx*nx+b.vy*ny;if(speed<0){b.vx-=speed*nx*1.05;b.vy-=speed*ny*1.05;}
      }
      const cup=this.level.cups.find(c=>b.y>=c.y&&b.y<=c.y+40&&Math.abs(b.x-c.x)<=c.w/2-r);
      if(cup){b.status=cup.color===b.color?'caught':'lost';if(b.status==='caught')this.caught++;else this.lost++;b.x=cup.x;b.y=cup.y+21;}
      else if(b.y>550||b.x<40||b.x>600){b.status='lost';this.lost++;}
    }
    for(let i=0;i<this.balls.length;i++)for(let j=0;j<i;j++){
      const a=this.balls[i],b=this.balls[j];if(a.status!=='active'||b.status!=='active')continue;const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);if(d>=r*2||d<.001)continue;
      const nx=dx/d,ny=dy/d,push=(r*2-d)/2;a.x+=nx*push;a.y+=ny*push;b.x-=nx*push;b.y-=ny*push;const speed=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(speed<0){const impulse=-speed*.55;a.vx+=nx*impulse;a.vy+=ny*impulse;b.vx-=nx*impulse;b.vy-=ny*impulse;}
    }
    }
    this.ticks++;this.done=this.balls.every(b=>b.status!=='active')||this.ticks>=900;
  }
  result(){return {caught:this.caught,lost:this.lost,remaining:this.balls.filter(b=>b.status==='active').length,ticks:this.ticks,balls:this.balls.map(b=>({x:b.x,y:b.y,color:b.color,status:b.status}))};}
}
export function simulateSoil(level,soil){const flow=new SoilFlow(level,soil);while(!flow.done)flow.step();return flow.result();}
