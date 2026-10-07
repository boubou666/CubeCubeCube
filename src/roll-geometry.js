export function rollingVertices(state, dir=null, fraction=0){
  const w=state.pose==='east'?2:1,h=state.pose==='south'?2:1,z=state.pose==='upright'?2:1;
  const vertices=[[0,0,0],[w,0,0],[w,h,0],[0,h,0],[0,0,z],[w,0,z],[w,h,z],[0,h,z]].map(([x,y,z])=>[x+state.x,y+state.y,z]);
  if(dir===null)return vertices;
  const angle=fraction*Math.PI/2*(dir===1||dir===0?1:-1),cos=Math.cos(angle),sin=Math.sin(angle);
  const axis=dir===1||dir===3?'x':'y',pivot=axis==='x'?state.x+(dir===1?w:0):state.y+(dir===2?h:0);
  return vertices.map(([x,y,z])=>axis==='x'?[pivot+(x-pivot)*cos+z*sin,y,-(x-pivot)*sin+z*cos]:[x,pivot+(y-pivot)*cos-z*sin,(y-pivot)*sin+z*cos]);
}
