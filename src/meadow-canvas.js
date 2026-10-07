import {PocketCanvas} from './pocket-canvas.js';
import {COLORS} from './pocket-core.js';
import {rollCells} from './bascules-puzzle.js';
import {paintSlide} from './sillons-puzzle.js';
import {jointPorts,jointConnections,jointCanShift} from './raccords-puzzle.js';
import {rollingVertices} from './roll-geometry.js';

const W=640,H=600;
const KINDS={fixed:['#46675b','▣'],pivot:['#83abc0','↻'],move:['#8cab87','↔'],free:['#cf967c','✦'],line:['#a493b4','━'], 'line-turn':['#c4ad70','↻']};
export class MeadowCanvas extends PocketCanvas{
  constructor(container,mode,callbacks){
    super(container,mode,callbacks);
    this.canvas.setAttribute('aria-label',mode==='bascules'?'Bascules : faites rouler le galet dans quatre directions':mode==='sillons'?'Sillons : glissez pour colorer toutes les allées':'Raccords : déplacez et tournez les pièces pour réunir leurs liens');
    this.canvas.addEventListener('pointerdown',event=>{
      if(!callbacks.enabled())return;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(event.pointerId);
      this.press={point:this.point(event),selected:this.selected};
      if(mode==='raccords'){
        const cell=this.at(this.press.point),id=this.state.positions.indexOf(cell);this.press.id=id;
        if(id>=0){callbacks.jointPick(id);this.grab={id,point:this.press.point};}
      }
    });
    this.canvas.addEventListener('pointermove',event=>{if(this.grab)this.grab.point=this.point(event);});
    this.canvas.addEventListener('pointerup',event=>{
      const press=this.press,p=this.point(event);this.press=null;this.grab=null;if(!press||!callbacks.enabled())return;
      const dx=p[0]-press.point[0],dy=p[1]-press.point[1],distance=Math.hypot(dx,dy);
      if(mode==='raccords'){
        const cell=this.at(p);if(cell===null)return;
        if(distance>10&&press.id>=0)callbacks.play({type:'shift',id:press.id,to:cell});
        else if(press.id<0)callbacks.jointCell(cell);
        else if(press.selected===press.id)callbacks.jointTurn();
        return;
      }
      if(distance<14)return;
      let dir;
      if(mode==='sillons')dir=Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0;
      else{const directions=[[1,-.5],[1,.5],[-1,.5],[-1,-.5]];let best=-Infinity;directions.forEach(([x,y],id)=>{const dot=(x*dx+y*dy)/Math.hypot(x,y);if(dot>best){best=dot;dir=id;}});}
      callbacks.play({dir});
    });
    this.canvas.addEventListener('pointercancel',()=>{this.press=null;this.grab=null;});
  }
  point(event){const r=this.canvas.getBoundingClientRect();return[(event.clientX-r.x)/r.width*W,(event.clientY-r.y)/r.height*H];}
  worldScreen(point){const r=this.canvas.getBoundingClientRect();return{x:r.x+point[0]/W*r.width,y:r.y+point[1]/H*r.height};}
  grid(){const cell=Math.min(78,464/this.level.cols,412/this.level.rows);return {cell,x:(W-cell*this.level.cols)/2,y:88+(412-cell*this.level.rows)/2};}
  position(cell){const g=this.grid();return[g.x+(cell%this.level.cols+.5)*g.cell,g.y+(Math.floor(cell/this.level.cols)+.5)*g.cell];}
  at(p){const g=this.grid(),x=Math.floor((p[0]-g.x)/g.cell),y=Math.floor((p[1]-g.y)/g.cell);return x>=0&&y>=0&&x<this.level.cols&&y<this.level.rows?y*this.level.cols+x:null;}
  iso([x,y,z=0]){const scale=Math.min(40,490/(this.level.cols+this.level.rows));return[320+(x-y-(this.level.cols-this.level.rows)/2)*scale,190+(x+y)*scale*.5-z*scale];}
  screenPoint(value){if(this.mode==='bascules'){const x=typeof value==='number'?value%this.level.cols:value[0],y=typeof value==='number'?Math.floor(value/this.level.cols):value[1];return this.worldScreen(this.iso([x+.5,y+.5,0]));}return this.worldScreen(this.position(typeof value==='object'?this.state.positions[value.id]:value));}
  directionScreenPoints(dir){
    let point,delta;
    if(this.mode==='bascules'){
      const cells=rollCells(this.state),x=cells.reduce((n,p)=>n+p[0]+.5,0)/cells.length,y=cells.reduce((n,p)=>n+p[1]+.5,0)/cells.length;
      point=this.iso([x,y,this.state.pose==='upright'?1.1:.6]);delta=[[60,-30],[60,30],[-60,30],[-60,-30]][dir];
    }else{point=this.position(this.state.at);delta=[[0,-65],[65,0],[0,65],[-65,0]][dir];}
    return[this.worldScreen(point),this.worldScreen([point[0]+delta[0],point[1]+delta[1]])];
  }
  get running(){return Boolean(this.motion&&performance.now()-this.motion.start<this.motion.duration);}
  update(level,state,hint,selected,previous,action){
    const changed=level!==this.level||state!==this.state;
    this.level=level;this.state=state;this.hint=hint;this.selected=selected;
    if(changed){this.motion=previous&&action&&!this.reduced?{previous,action,start:performance.now(),duration:320}:null;this.press=null;this.grab=null;}
    this.draw();
  }
  polygon(points,fill,stroke='#d3dbc3'){
    const c=this.ctx;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}
  }
  rounded(x,y,w,h,r,fill,stroke){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.4;c.stroke();}}
  text(text,x,y,color='#75896f',size=11){const c=this.ctx;c.fillStyle=color;c.font=`${size}px 'Segoe UI',sans-serif`;c.textAlign='center';c.fillText(text,x,y);}
  arrow(x,y,dir,color='#526e5d',size=13){const c=this.ctx,angle=(dir-1)*Math.PI/2;c.save();c.translate(x,y);c.rotate(angle);c.strokeStyle=color;c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(-size*.65,0);c.lineTo(size*.65,0);c.moveTo(size*.15,-size*.5);c.lineTo(size*.65,0);c.lineTo(size*.15,size*.5);c.stroke();c.restore();}
  rolling(t){
    const c=this.ctx,l=this.level,scale=Math.min(40,490/(l.cols+l.rows));
    for(let sum=0;sum<l.cols+l.rows;sum++)for(let y=0;y<l.rows;y++){
      const x=sum-y;if(x<0||x>=l.cols)continue;const tile=l.field[y*l.cols+x];if(!tile)continue;
      const points=[[x,y,0],[x+1,y,0],[x+1,y+1,0],[x,y+1,0]].map(p=>this.iso(p)),center=this.iso([x+.5,y+.5,0]);
      const closed=tile.kind==='bridge'&&!(this.state.gates&(1<<tile.gate));
      if(tile.kind==='hole'){this.polygon(points,'#ccd4bb');const inner=[[x+.17,y+.17,0],[x+.83,y+.17,0],[x+.83,y+.83,0],[x+.17,y+.83,0]].map(p=>this.iso(p));this.polygon(inner,'#345748','#7b9a7d');continue;}
      if(closed){this.polygon(points,'#dfe7d1','#aab797');c.setLineDash([3,3]);c.strokeStyle=COLORS[tile.gate?5:3].hex;c.beginPath();c.moveTo(points[0][0],points[0][1]);c.lineTo(points[2][0],points[2][1]);c.stroke();c.setLineDash([]);continue;}
      this.polygon(points,tile.kind==='fragile'?'#f0dfb2':tile.kind==='bridge'?COLORS[tile.gate?5:3].hex:(x+y)%2?'#e2e8d1':'#edf0df');
      if(tile.kind==='fragile'){c.strokeStyle='#bba574';c.lineWidth=1;c.beginPath();c.moveTo(center[0]-5,center[1]-4);c.lineTo(center[0]+2,center[1]);c.lineTo(center[0]-2,center[1]+4);c.stroke();}
      if(tile.kind==='bridge'){c.strokeStyle='#fffaf0aa';c.beginPath();c.moveTo(points[0][0]+scale*.25,points[0][1]+scale*.125);c.lineTo(points[3][0]+scale*.25,points[3][1]+scale*.125);c.moveTo(points[0][0]+scale*.7,points[0][1]+scale*.35);c.lineTo(points[3][0]+scale*.7,points[3][1]+scale*.35);c.stroke();}
      if(tile.kind==='plate'){c.fillStyle=COLORS[tile.gate?5:3].hex;c.beginPath();c.ellipse(...center,scale*.23,scale*.13,0,0,Math.PI*2);c.fill();this.text(tile.hard?'▣':'●',center[0],center[1]+3,'#fffaf0',10);}
    }
    if(!this.callbacks.won?.()||this.motion){
      const motion=this.motion,rollFraction=Math.min(1,t/.83),vertices=motion?rollingVertices(motion.previous,motion.action.dir,rollFraction):rollingVertices(this.state);
      if(motion&&this.callbacks.won?.()&&t>.83){vertices.forEach(p=>p[2]-=(t-.83)/.17*2.3);c.globalAlpha=Math.max(0,1-(t-.83)/.17);}
      const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],fills=['#658b78','#b6cfad','#7fa68c','#6f997e','#92b596','#557d6a'];
      faces.map((ids,id)=>({ids,id,depth:ids.reduce((n,k)=>n+vertices[k].reduce((a,b)=>a+b,0),0)/4})).sort((a,b)=>a.depth-b.depth).forEach(({ids,id})=>{
        const [a,b,d]=ids.slice(0,3).map(k=>vertices[k]),u=b.map((v,i)=>v-a[i]),v=d.map((n,i)=>n-a[i]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        if(normal.reduce((n,v)=>n+v,0)<=1e-5)return;this.polygon(ids.map(k=>this.iso(vertices[k])),fills[id],'#527b68');
        if(id===1){const center=ids.reduce((p,k)=>p.map((v,i)=>v+vertices[k][i]/4),[0,0,0]),point=this.iso(center);this.text('✦',point[0],point[1]+4,'#fffaf0',18);}
      });c.globalAlpha=1;
    }
    this.text('UN GALET · QUATRE DIRECTIONS · LE BON APPUI',320,526,'#869775',10);
  }
  painting(t){
    const c=this.ctx,l=this.level,g=this.grid(),m=this.motion,path=m?paintSlide(l,m.previous.at,m.action.dir):null,progress=path?(path.length-1)*t:0;
    for(let id=0;id<l.field.length;id++){
      const [x,y]=this.position(id),left=x-g.cell/2+2,top=y-g.cell/2+2;
      if(!l.field[id]){this.rounded(left+3,top+3,g.cell-10,g.cell-10,12,'#dfe5cf');c.strokeStyle='#b0bea0';c.lineWidth=2;c.beginPath();c.moveTo(x-6,y+5);c.quadraticCurveTo(x-6,y-9,x+7,y-8);c.moveTo(x,y+4);c.quadraticCurveTo(x+8,y+2,x+10,y-3);c.stroke();continue;}
      const painted=m?m.previous.painted[id]||path?.slice(0,Math.floor(progress)+1).includes(id):this.state.painted[id];
      this.rounded(left,top,g.cell-4,g.cell-4,9,painted?'#83ad95':'#f7f4e4',painted?'#739c83':'#d5dcc3');
      if(painted){c.fillStyle='#e8f0de77';c.beginPath();c.ellipse(x-8,y-6,4,7,-.7,0,Math.PI*2);c.ellipse(x-3,y-8,4,7,.6,0,Math.PI*2);c.fill();}
      else{c.fillStyle='#c5d0b4';c.beginPath();c.arc(x,y,2,0,Math.PI*2);c.fill();}
      if(l.stops.includes(id)){c.strokeStyle=painted?'#fffaf0aa':'#b7c7ab';c.lineWidth=1.5;c.beginPath();c.arc(x,y,g.cell*.22,0,Math.PI*2);c.stroke();}
      if(l.arrows[id]!==undefined)this.arrow(x,y,l.arrows[id],painted?'#fffaf0':'#718c78',g.cell*.2);
    }
    let p=this.position(this.state.at);if(path){const from=this.position(path[Math.floor(progress)]),to=this.position(path[Math.min(path.length-1,Math.floor(progress)+1)]),part=progress%1;p=from.map((v,i)=>v+(to[i]-v)*part);}
    const side=g.cell*.58;c.fillStyle='#365d4940';c.beginPath();c.ellipse(p[0],p[1]+side*.48,side*.46,side*.16,0,0,Math.PI*2);c.fill();
    this.rounded(p[0]-side/2,p[1]-side*.35,side,side*.72,8,'#537f68','#416a56');this.rounded(p[0]-side/2,p[1]-side*.55,side,side*.64,8,'#b6d0ab','#7ca288');
    this.text('✿',p[0],p[1]-side*.12,'#fffaf0',side*.58);
    this.text('UNE GLISSADE · TOUTE UNE ALLÉE SE COLORE',320,548,'#869775',10);
  }
  tile(id,at,turn,alpha=1){
    const c=this.ctx,g=this.grid(),piece=this.level.pieces[id],colors=KINDS[piece.kind],[x,y]=typeof at==='number'?this.position(at):at;
    c.save();c.globalAlpha=alpha;this.rounded(x-g.cell*.39,y-g.cell*.36+5,g.cell*.78,g.cell*.74,12,'#405d4522');
    this.rounded(x-g.cell*.39,y-g.cell*.39,g.cell*.78,g.cell*.78,12,'#faf8ec',this.selected===id?'#b79e5e':colors[0]);
    c.save();c.translate(x,y);c.rotate(turn*Math.PI/2);
    piece.ports.forEach((color,dir)=>{if(color===null)return;const angle=(dir-1)*Math.PI/2,dx=Math.cos(angle),dy=Math.sin(angle);c.strokeStyle=COLORS[color].hex;c.lineWidth=g.cell*.105;c.lineCap='round';c.beginPath();c.moveTo(dx*g.cell*.1,dy*g.cell*.1);c.lineTo(dx*g.cell*.35,dy*g.cell*.35);c.stroke();c.fillStyle='#fffaf0';c.beginPath();c.arc(dx*g.cell*.3,dy*g.cell*.3,g.cell*.035,0,Math.PI*2);c.fill();});c.restore();
    c.fillStyle=colors[0];c.beginPath();c.arc(x,y,g.cell*.14,0,Math.PI*2);c.fill();this.text(colors[1],x,y+g.cell*.06,'#fffaf0',g.cell*.19);this.text(String(id+1),x-g.cell*.24,y-g.cell*.23,colors[0],9);c.restore();
  }
  joints(t){
    const c=this.ctx,l=this.level,g=this.grid(),m=this.motion,connections=jointConnections(l,this.state);
    for(let id=0;id<l.cols*l.rows;id++){const [x,y]=this.position(id),valid=this.selected!==null&&jointCanShift(l,this.state,this.selected,id);this.rounded(x-g.cell/2+2,y-g.cell/2+2,g.cell-4,g.cell-4,11,valid?'#e5edda':'#edf0df','#d4ddc4');if(valid){c.fillStyle='#bac9a5';c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();}}
    for(const p of l.pieces){let at=this.state.positions[p.id],turn=this.state.turns[p.id];
      if(m&&m.action.id===p.id){if(m.action.type==='shift'){const old=this.position(m.previous.positions[p.id]),next=this.position(at);at=old.map((v,i)=>v+(next[i]-v)*(t*t*(3-2*t)));}else turn=m.previous.turns[p.id]+t;}
      if(this.grab?.id===p.id)this.tile(p.id,at,turn,.32);else this.tile(p.id,at,turn);
      if(!connections.loose[p.id]){const point=typeof at==='number'?this.position(at):at;c.strokeStyle='#91b18c';c.lineWidth=2;c.beginPath();c.arc(point[0]+g.cell*.25,point[1]+g.cell*.24,3,0,Math.PI*2);c.stroke();}
    }
    if(this.grab)this.tile(this.grab.id,this.grab.point,this.state.turns[this.grab.id],.9);
    this.text(`${connections.matched} LIENS FERMÉS · ${connections.groups.length} PETIT${connections.groups.length>1?'S':''} ÎLOT${connections.groups.length>1?'S':''}`,320,548,'#869775',10);
  }
  draw(){
    if(!this.level||!this.canvas.width)return;
    let t=this.motion?Math.min(1,(performance.now()-this.motion.start)/this.motion.duration):1;
    if(this.motion&&t>=1){this.motion=null;this.callbacks.settled?.();}
    const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);
    this.rounded(35,54,570,512,27,'#f0f2e2','#d7dfc6');
    if(this.mode==='bascules')this.rolling(t);else if(this.mode==='sillons')this.painting(t);else this.joints(t);
  }
}
