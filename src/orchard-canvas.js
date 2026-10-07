import {PocketCanvas} from './pocket-canvas.js';
import {COLORS} from './pocket-core.js';
import {crateNeighbor} from './cagettes-puzzle.js';
import {cairnTop} from './cairns-puzzle.js';
import {jalonsRules} from './jalons-puzzle.js';

const W=640,H=600;
export class OrchardCanvas extends PocketCanvas{
  constructor(container,mode,callbacks){
    super(container,mode,callbacks);
    this.canvas.setAttribute('aria-label',mode==='cagettes'?'Cagettes : poussez les paniers vers les fleurs':mode==='cairns'?'Cairns : déplacez les anneaux entre les tiges':'Jalons : tracez un chemin par tous les nombres dans l’ordre');
    this.canvas.addEventListener('pointerdown',e=>{
      if(!callbacks.enabled())return;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);
      const point=this.point(e);this.press={point,cell:this.at(point),peg:this.pegAt(point)};
      if(mode==='jalons'&&this.press.cell===this.state.path.at(-1))this.draft=[this.press.cell];
    });
    this.canvas.addEventListener('pointermove',e=>{
      if(!this.press)return;const point=this.point(e);this.dragPoint=point;
      if(this.draft){const cell=this.at(point),at=this.draft.indexOf(cell);if(at>=0)this.draft=this.draft.slice(0,at+1);else if(cell!==null){const path=[...this.draft,cell];if(jalonsRules.move(this.level,this.state,{path}))this.draft=path;}}
    });
    this.canvas.addEventListener('pointerup',e=>{
      const press=this.press,draft=this.draft,point=this.point(e);this.cancelGesture();if(!press||!callbacks.enabled())return;
      if(mode==='cairns'){
        const to=this.pegAt(point);if(to===null)return;
        if(to!==press.peg&&press.peg!==null)callbacks.play({from:press.peg,to});else callbacks.cairnPeg(to);return;
      }
      if(mode==='jalons'){if(draft?.length>1)callbacks.play({path:draft});else{const to=this.at(point);if(to!==null)callbacks.jalonCell(to);}return;}
      const dx=point[0]-press.point[0],dy=point[1]-press.point[1];
      if(Math.hypot(dx,dy)>15)callbacks.play({dir:Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0});
      else{const to=this.at(point),dir=[0,1,2,3].find(d=>crateNeighbor(this.level,this.state.at,d)===to);if(dir!==undefined)callbacks.play({dir});}
    });
    this.canvas.addEventListener('pointercancel',()=>this.cancelGesture());
  }
  cancelGesture(){this.press=null;this.dragPoint=null;this.draft=null;}
  point(e){const r=this.canvas.getBoundingClientRect();return[(e.clientX-r.x)/r.width*W,(e.clientY-r.y)/r.height*H];}
  worldScreen(p){const r=this.canvas.getBoundingClientRect();return{x:r.x+p[0]/W*r.width,y:r.y+p[1]/H*r.height};}
  grid(){const cell=Math.min(82,480/this.level.cols,420/this.level.rows);return{cell,x:(W-this.level.cols*cell)/2,y:82+(420-this.level.rows*cell)/2};}
  position(id){const g=this.grid();return[g.x+(id%this.level.cols+.5)*g.cell,g.y+(Math.floor(id/this.level.cols)+.5)*g.cell];}
  at(p){if(this.mode==='cairns')return null;const g=this.grid(),x=Math.floor((p[0]-g.x)/g.cell),y=Math.floor((p[1]-g.y)/g.cell);return x>=0&&y>=0&&x<this.level.cols&&y<this.level.rows?y*this.level.cols+x:null;}
  pegPosition(peg){return[100+peg*440/(this.level.pegs-1),434];}
  pegAt(p){if(this.mode!=='cairns'||p[1]<135||p[1]>480)return null;const nearest=Array.from({length:this.level.pegs},(_,id)=>id).sort((a,b)=>Math.abs(this.pegPosition(a)[0]-p[0])-Math.abs(this.pegPosition(b)[0]-p[0]))[0];return Math.abs(this.pegPosition(nearest)[0]-p[0])<64?nearest:null;}
  screenPoint(id){return this.worldScreen(this.mode==='cairns'?[this.pegPosition(id)[0],330]:this.position(id));}
  directionScreenPoints(dir){const p=this.position(this.state.at),d=[[0,-60],[60,0],[0,60],[-60,0]][dir];return[this.worldScreen(p),this.worldScreen([p[0]+d[0],p[1]+d[1]])];}
  get running(){return Boolean(this.motion&&performance.now()-this.motion.start<this.motion.duration);}
  update(level,state,hint,selected,previous,action){
    const changed=level!==this.level||state!==this.state;this.level=level;this.state=state;this.hint=hint;this.selected=selected;
    if(changed){this.cancelGesture();this.motion=previous&&action&&!this.reduced?{previous,action,start:performance.now(),duration:this.mode==='cairns'?340:220}:null;}this.draw();
  }
  rounded(x,y,w,h,r,fill,stroke){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.4;c.stroke();}}
  text(text,x,y,color='#75896f',size=11){const c=this.ctx;c.fillStyle=color;c.font=`${size}px 'Segoe UI',sans-serif`;c.textAlign='center';c.fillText(text,x,y);}
  flower(x,y,size){const c=this.ctx;c.fillStyle='#c9ab68';for(let i=0;i<5;i++){const a=i*Math.PI*2/5;c.beginPath();c.arc(x+Math.cos(a)*size*.48,y+Math.sin(a)*size*.48,size*.35,0,Math.PI*2);c.fill();}c.fillStyle='#fff3d1';c.beginPath();c.arc(x,y,size*.24,0,Math.PI*2);c.fill();}
  crate(id,point){const g=this.grid(),s=g.cell*.67,[x,y]=point,c=this.ctx,placed=this.level.goals.includes(this.state.boxes[id]);this.rounded(x-s/2,y-s/2+5,s,s,7,'#48634330');this.rounded(x-s/2,y-s/2,s,s,7,placed?'#9eb98c':'#d1ad79',placed?'#74996f':'#a58457');c.strokeStyle=placed?'#6e926d':'#a7875e';c.lineWidth=2;for(const n of [-.2,0,.2]){c.beginPath();c.moveTo(x-s*.39,y+n*s);c.lineTo(x+s*.39,y+n*s);c.stroke();}c.fillStyle=COLORS[id%COLORS.length].hex;c.beginPath();c.ellipse(x-5,y-5,s*.13,s*.18,-.5,0,Math.PI*2);c.ellipse(x+5,y-5,s*.13,s*.18,.5,0,Math.PI*2);c.fill();this.text(placed?'✓':String(id+1),x,y+s*.33,'#fffaf0',12);}
  crates(t){
    const l=this.level,g=this.grid(),c=this.ctx,m=this.motion;
    for(let id=0;id<l.floor.length;id++){const [x,y]=this.position(id);if(l.floor[id]){this.rounded(x-g.cell/2+1,y-g.cell/2+1,g.cell-2,g.cell-2,7,'#faf7e8','#d6ddc5');if(l.goals.includes(id))this.flower(x,y,g.cell*.24);}else{this.rounded(x-g.cell/2+2,y-g.cell/2+2,g.cell-4,g.cell-4,10,'#d8e2c8');c.fillStyle='#a0b491';c.beginPath();c.ellipse(x-4,y-3,g.cell*.12,g.cell*.22,-.6,0,Math.PI*2);c.ellipse(x+5,y+3,g.cell*.12,g.cell*.22,.6,0,Math.PI*2);c.fill();}}
    const lerp=(from,to)=>this.position(from).map((v,i)=>v+(this.position(to)[i]-v)*t);
    this.state.boxes.forEach((at,id)=>this.crate(id,m?lerp(m.previous.boxes[id],at):this.position(at)));
    const p=m?lerp(m.previous.at,this.state.at):this.position(this.state.at),r=g.cell*.24;
    c.fillStyle='#45634b22';c.beginPath();c.ellipse(p[0],p[1]+r,r,r*.25,0,0,Math.PI*2);c.fill();c.fillStyle='#527b69';c.beginPath();c.arc(p[0],p[1],r,0,Math.PI*2);c.fill();c.fillStyle='#a7c8a0';c.beginPath();c.ellipse(p[0],p[1]-r*.6,r*1.17,r*.4,0,0,Math.PI*2);c.fill();this.text('• •',p[0],p[1]+r*.14,'#fffaf0',g.cell*.15);this.text('UNE CAGETTE SE POUSSE · GARDEZ UNE PLACE DERRIÈRE',320,544,'#879776',10);
  }
  ring(disk,x,y,alpha=1){const c=this.ctx,w=34+(disk+1)*15,h=23;c.save();c.globalAlpha=alpha;this.rounded(x-w/2,y-h/2+4,w,h,9,'#365a4530');this.rounded(x-w/2,y-h/2,w,h,9,COLORS[disk].hex,'#6f846754');c.strokeStyle='#fffaf099';c.lineWidth=1;c.beginPath();c.ellipse(x,y-5,w*.34,3,0,0,Math.PI*2);c.stroke();this.text(String(disk+1),x,y+5,'#fffaf0',13);c.restore();}
  towers(t){
    const l=this.level,s=this.state,c=this.ctx,m=this.motion,disk=m?cairnTop(m.previous,m.action.from):-1;
    for(const [a,b]of l.links){const x=this.pegPosition(a)[0],to=this.pegPosition(b)[0];c.strokeStyle='#c6d5b5';c.lineWidth=3;c.beginPath();c.moveTo(x,474);c.quadraticCurveTo((x+to)/2,490+(b-a)*10,to,474);c.stroke();}
    for(let peg=0;peg<l.pegs;peg++){
      const [x,y]=this.pegPosition(peg);this.rounded(x-52,y+2,104,18,8,peg===l.goal?'#c2d5ae':'#d7dfc6',this.selected===peg?'#b39d5c':'#bfcca9');this.rounded(x-5,184,10,252,5,'#c7b791');this.flower(x,175,11);
      const stack=s.disks.flatMap((at,id)=>at===peg?[id]:[]).sort((a,b)=>b-a);
      stack.forEach((id,n)=>{if(id!==disk)this.ring(id,x,418-n*27);});this.text(`${String.fromCharCode(65+peg)}${peg===l.goal?' · BUT':''}`,x,465,'#6e896e',12);
    }
    if(m){const from=this.pegPosition(m.action.from)[0],to=this.pegPosition(m.action.to)[0],oldCount=m.previous.disks.filter(at=>at===m.action.from).length,newCount=s.disks.filter(at=>at===m.action.to).length,y0=418-(oldCount-1)*27,y1=418-(newCount-1)*27;
      let x,y;if(t<.27){x=from;y=y0+(135-y0)*t/.27;}else if(t<.73){x=from+(to-from)*(t-.27)/.46;y=135;}else{x=to;y=135+(y1-135)*(t-.73)/.27;}this.ring(disk,x,y);
    }else if(this.press&&this.press.peg!==null&&this.dragPoint&&this.mode==='cairns'){const top=cairnTop(s,this.press.peg);if(top>=0)this.ring(top,...this.dragPoint,.7);}
    this.text('UN ANNEAU À LA FOIS · LE PLUS PETIT RESTE AU-DESSUS',320,548,'#879776',10);
  }
  trail(t){
    const l=this.level,g=this.grid(),c=this.ctx,m=this.motion,path=m?[...m.previous.path,...m.action.path.slice(1,1+Math.floor((m.action.path.length-1)*t))]:this.state.path;
    const visited=new Set(path);for(let id=0;id<l.cols*l.rows;id++){const [x,y]=this.position(id);this.rounded(x-g.cell/2+2,y-g.cell/2+2,g.cell-4,g.cell-4,9,visited.has(id)?'#dce8d0':'#faf7e8','#d0dac1');}
    const stroke=(route,color,width,dashed=false)=>{if(!route.length)return;c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.setLineDash(dashed?[6,6]:[]);c.beginPath();route.forEach((id,n)=>{const [x,y]=this.position(id);if(n)c.lineTo(x,y);else c.moveTo(x,y);});c.stroke();c.setLineDash([]);};stroke(path,'#83a88a',g.cell*.14);if(this.draft)stroke(this.draft,'#c4a466',g.cell*.13,true);if(this.hint?.action)stroke(this.hint.action.path,'#c4a466',g.cell*.11,true);
    for(const wall of l.walls){const [a,b]=wall.split(':').map(Number),p=this.position(a),q=this.position(b),x=(p[0]+q[0])/2,y=(p[1]+q[1])/2;c.strokeStyle='#6b876e';c.lineWidth=5;c.lineCap='round';c.beginPath();if(Math.abs(a-b)===1){c.moveTo(x,y-g.cell*.37);c.lineTo(x,y+g.cell*.37);}else{c.moveTo(x-g.cell*.37,y);c.lineTo(x+g.cell*.37,y);}c.stroke();}
    for(const [cell,mark]of Object.entries(l.marks)){const [x,y]=this.position(Number(cell));c.fillStyle=visited.has(Number(cell))?'#6f9578':'#faf1d3';c.beginPath();c.arc(x,y,g.cell*.24,0,Math.PI*2);c.fill();c.strokeStyle='#b7bd91';c.lineWidth=1;c.stroke();this.text(String(mark),x,y+g.cell*.07,visited.has(Number(cell))?'#fffaf0':'#8b7953',g.cell*.21);}
    const head=this.draft?.at(-1)??path.at(-1),[x,y]=this.position(head);c.strokeStyle='#526f58';c.lineWidth=3;c.beginPath();c.arc(x,y,g.cell*.31,0,Math.PI*2);c.stroke();this.text('DE NOMBRE EN NOMBRE · UNE SEULE VISITE PAR CASE',320,548,'#879776',10);
  }
  draw(){
    if(!this.level||!this.canvas.width)return;const t=this.motion?Math.min(1,(performance.now()-this.motion.start)/this.motion.duration):1;
    if(this.motion&&t>=1){this.motion=null;this.callbacks.settled?.();}
    const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);this.rounded(35,54,570,512,27,'#f0f2e2','#d7dfc6');
    if(this.mode==='cagettes')this.crates(t);else if(this.mode==='cairns')this.towers(t);else this.trail(t);
  }
}
