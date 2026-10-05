// A welded lattice animates each jelly settling into its grid mould.
// Puzzle occupancy stays discrete; these springs never authorize a placement.
export class JellySpring{
  constructor(cells,x,y,cell,top){
    this.nodes=[];this.quads=[];this.springs=[];this.age=0;const ids=new Map(),edges=new Set(),height=(Math.max(...cells.map(p=>p[1]))+1)*cell,shift=y-top+height+30;
    const node=(xx,yy)=>{const key=`${xx},${yy}`;if(ids.has(key))return ids.get(key);const id=this.nodes.length;ids.set(key,id);this.nodes.push({x:x+xx*cell,y:y+yy*cell-shift,tx:x+xx*cell,ty:y+yy*cell,vx:(id%3-1)*8,vy:65+id%5*7});return id;};
    for(const [xx,yy] of cells){const quad=[[xx,yy],[xx+1,yy],[xx+1,yy+1],[xx,yy+1]].map(([a,b])=>node(a,b));this.quads.push(quad);for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){const key=[quad[a],quad[b]].sort((a,b)=>a-b).join(',');if(edges.has(key))continue;edges.add(key);const p=this.nodes[quad[a]],q=this.nodes[quad[b]];this.springs.push({a:quad[a],b:quad[b],length:Math.hypot(p.tx-q.tx,p.ty-q.ty)});}}
  }
  step(){const dt=1/120,forces=this.nodes.map(p=>[(p.tx-p.x)*65-p.vx*11,(p.ty-p.y)*65-p.vy*11]);
    for(const s of this.springs){const a=this.nodes[s.a],b=this.nodes[s.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=(d-s.length)*145,nx=dx/d*f,ny=dy/d*f;forces[s.a][0]+=nx;forces[s.a][1]+=ny;forces[s.b][0]-=nx;forces[s.b][1]-=ny;}
    this.nodes.forEach((p,n)=>{p.vx+=forces[n][0]*dt;p.vy+=forces[n][1]*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;});this.age++;}
  get done(){return this.age>=180||this.age>70&&this.nodes.every(p=>Math.hypot(p.x-p.tx,p.y-p.ty)<.7&&Math.hypot(p.vx,p.vy)<5);}
}
