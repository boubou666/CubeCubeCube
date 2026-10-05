export const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const between=(a,b,p)=>Math.min(a[0],b[0])-1e-7<=p[0]&&p[0]<=Math.max(a[0],b[0])+1e-7&&Math.min(a[1],b[1])-1e-7<=p[1]&&p[1]<=Math.max(a[1],b[1])+1e-7;
export function segmentsMeet(a,b,c,d){
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  return x*y<0&&z*w<0||Math.abs(x)<1e-7&&between(a,b,c)||Math.abs(y)<1e-7&&between(a,b,d)||Math.abs(z)<1e-7&&between(c,d,a)||Math.abs(w)<1e-7&&between(c,d,b);
}
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function closestOnSegment(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length)):0;return[a[0]+t*dx,a[1]+t*dy];}
