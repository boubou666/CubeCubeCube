import { PocketCanvas } from './pocket-canvas.js';
import { COLORS } from './pocket-core.js';
import { distance, segmentsMeet } from './physics-geometry.js';
import { WaterSimulation, WATER_TOTAL } from './gouttes-physics.js';

const W=640,H=600;
export class PhysicsCanvas extends PocketCanvas{
  constructor(container,mode,callbacks){
    super(container,mode,callbacks);this.canvas.setAttribute('aria-label',mode==='noeuds'?'Cordes : faites glisser une attache vers un plot libre':'Jardin d’eau : dessinez une rampe, puis cliquez Laisser couler');
    this.canvas.addEventListener('pointerdown',event=>{
      if(!callbacks.enabled())return;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(event.pointerId);const p=this.point(event);
      if(mode==='noeuds'){
        const pin=this.state.pins.findIndex(peg=>distance(p,this.pegPosition(peg))<27);
        if(pin>=0){callbacks.select(pin);if(!this.level.pins[pin].fixed)this.grab={pin,point:p,start:p,moved:false};}
        else{const peg=this.nearestPeg(p);if(peg>=0)callbacks.peg(peg);}
      }else if(p[0]>=35&&p[0]<=605&&p[1]>=75&&p[1]<=550)this.stroke=[p];
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(!callbacks.enabled())return;const p=this.point(event);
      if(this.grab){this.grab.point=p;this.grab.moved||=distance(p,this.grab.start)>8;}
      if(this.stroke&&distance(p,this.stroke.at(-1))>4&&this.stroke.length<160)this.stroke.push([Math.max(35,Math.min(605,p[0])),Math.max(75,Math.min(550,p[1]))]);
    });
    this.canvas.addEventListener('pointerup',event=>{
      if(this.grab){const grab=this.grab;this.grab=null;const peg=this.nearestPeg(this.point(event));if(grab.moved&&peg>=0&&callbacks.enabled()){this.justDragged=true;callbacks.play({pin:grab.pin,peg});this.justDragged=false;}}
      if(this.stroke){const path=this.stroke;this.stroke=null;const p=this.point(event);if(p[0]>=35&&p[0]<=605&&p[1]>=75&&p[1]<=550&&distance(path.at(-1),p)>2&&path.length<160)path.push(p);if(path.length>1&&callbacks.enabled())callbacks.play({type:'draw',path});}
    });
    this.canvas.addEventListener('pointercancel',()=>{this.grab=null;this.stroke=null;});
  }
  point(event){const r=this.canvas.getBoundingClientRect();return[(event.clientX-r.x)/r.width*W,(event.clientY-r.y)/r.height*H];}
  pegPosition(peg){const [x,y]=this.level.pegs[peg],cell=480/this.level.size;return[80+(x+.5)*cell,60+(y+.5)*cell];}
  nearestPeg(p){const peg=this.level.pegs.findIndex((_,id)=>distance(p,this.pegPosition(id))<480/this.level.size*.43);return peg;}
  screenPoint(value){const [x,y]=this.mode==='noeuds'?this.pegPosition(value.peg??this.state.pins[value.pin]):value;const r=this.canvas.getBoundingClientRect();return{x:r.x+x/W*r.width,y:r.y+y/H*r.height};}
  update(level,state,hint,selected,previous){
    const changed=state!==this.state||level!==this.level;this.level=level;this.state=state;this.hint=hint;this.selected=selected;
    if(changed){this.grab=null;this.stroke=null;this.assisted=[];this.motion=previous&&!this.reduced&&!this.justDragged?{previous,start:performance.now()}:null;
      if(this.mode==='gouttes'){
        this.water=null;this.running=false;
        if(previous&&state.trial>previous.trial&&state.result&&!this.reduced){this.water=new WaterSimulation(level,state.lines);this.waterLast=performance.now();this.waterCarry=0;this.running=true;}
      }
    }
    this.draw();
  }
  ropePoints(){return this.state.pins.map((peg,pin)=>{const target=this.pegPosition(peg);if(this.grab?.pin===pin)return this.grab.point;const before=this.motion?.previous.pins[pin];if(before===undefined)return target;const t=Math.min(1,(performance.now()-this.motion.start)/220),from=this.pegPosition(before),ease=1-(1-t)**3;return[from[0]+(target[0]-from[0])*ease,from[1]+(target[1]-from[1])*ease];});}
  drawNoeuds(){
    const c=this.ctx,points=this.ropePoints(),conflicts=[];
    this.round(60,40,520,520,30,'#e2e8d7','#ced9c2');this.round(73,53,494,494,23,'#f0f3e7');
    this.level.pegs.forEach((_,id)=>{const [x,y]=this.pegPosition(id),occupied=this.state.pins.includes(id);c.fillStyle=occupied?'#abbca1':'#d0dbc4';c.beginPath();c.arc(x,y,occupied?10:6,0,7);c.fill();if(!occupied)this.text(id+1,x,y+18,9,'#a1b293');if(this.hint?.action?.peg===id){c.strokeStyle='#ae9552';c.lineWidth=3;c.beginPath();c.arc(x,y,25,0,7);c.stroke();}});
    this.level.ropes.forEach((rope,id)=>{
      const a=points[rope.a],b=points[rope.b],palette=COLORS[rope.color],length=distance(a,b),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
      c.lineCap='round';c.strokeStyle='#f1f4e8';c.lineWidth=17;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();c.strokeStyle='#405d3d30';c.lineWidth=13;c.beginPath();c.moveTo(a[0],a[1]+3);c.lineTo(b[0],b[1]+3);c.stroke();c.strokeStyle=palette.hex;c.lineWidth=11;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
      c.save();c.translate(...a);c.rotate(angle);c.strokeStyle='#ffffff75';c.lineWidth=1.2;for(let x=12;x<length-10;x+=8){c.beginPath();c.moveTo(x-3,-3);c.lineTo(x+2,3);c.stroke();}c.restore();
      for(let other=0;other<id;other++){const s=this.level.ropes[other];if(segmentsMeet(a,b,points[s.a],points[s.b]))conflicts.push([id,other]);}
    });
    points.forEach(([x,y],pin)=>{const info=this.level.pins[pin],selected=this.selected===pin||this.hint?.action?.pin===pin;c.fillStyle='#51704330';c.beginPath();c.arc(x,y+4,20,0,7);c.fill();c.fillStyle=COLORS[info.color].hex;c.beginPath();c.arc(x,y,19,0,7);c.fill();c.strokeStyle=selected?'#ae9552':'#fffdf4';c.lineWidth=selected?4:2;c.stroke();this.text(info.fixed?'⊕':pin+1,x,y,info.fixed?22:13,info.color===7?'#fffaf0':'#244c42');});
    if(this.hint?.action){const a=points[this.hint.action.pin],b=this.pegPosition(this.hint.action.peg);c.setLineDash([6,5]);c.strokeStyle='#aa9251';c.lineWidth=2;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();c.setLineDash([]);}
    this.text(`${conflicts.length} CROISEMENT${conflicts.length>1?'S':''} · UNE ATTACHE PUIS UN PLOT VIDE`,320,580,10,'#829575');
  }
  advanceWater(){
    if(!this.running)return;
    const now=performance.now(),elapsed=Math.min(.05,(now-this.waterLast)/1000);this.waterLast=now;
    if(document.querySelector('dialog[open]'))return;
    this.waterCarry+=elapsed*120;while(this.waterCarry>=1&&!this.water.done){this.water.step();this.waterCarry--;}
    this.callbacks.waterProgress?.(this.water.caught);
    if(this.water.done){this.running=false;queueMicrotask(()=>this.callbacks.settled?.());}
  }
  drawLine(path,color='#899d74',width=6,dashed=false){if(!path?.length)return;const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.lineCap=c.lineJoin='round';if(dashed)c.setLineDash([8,7]);c.beginPath();path.forEach((p,n)=>{if(!n)c.moveTo(...p);else c.lineTo(...p);});c.stroke();c.setLineDash([]);}
  drawGouttes(){
    this.advanceWater();const c=this.ctx,cup=this.level.cup,caught=this.water?.caught??this.state.result?.caught??0;
    this.round(32,48,576,510,26,'#f2f5e8','#dce5d0');
    for(const o of this.level.obstacles){this.round(o.x,o.y+5,o.w,o.h,8,'#566e3e24');this.round(o.x,o.y,o.w,o.h,8,'#c9b78f','#b5a27b');for(let x=o.x+12;x<o.x+o.w-4;x+=14)this.text('·',x,o.y+o.h/2,12,'#a08f6e');}
    this.round(cup.x-cup.w/2-17,cup.y+cup.h+7,cup.w+34,12,6,'#d4c099');
    // The cup walls match the same straight segments used by the simulation.
    const bottom=cup.y+cup.h,waterHeight=Math.min(cup.h-8,(cup.h-8)*caught/WATER_TOTAL),waterY=bottom-waterHeight;
    if(caught){this.round(cup.x-cup.w/2+4,waterY,cup.w-8,Math.max(2,waterHeight),5,'#98bdcbbd');c.strokeStyle='#cfe7e3';c.lineWidth=2;c.beginPath();c.moveTo(cup.x-cup.w/2+7,waterY);c.quadraticCurveTo(cup.x,waterY+(this.reduced?0:Math.sin(performance.now()/180)*2),cup.x+cup.w/2-7,waterY);c.stroke();}
    c.strokeStyle='#91a99a';c.lineWidth=5;c.lineJoin='round';c.beginPath();c.moveTo(cup.x-cup.w/2,cup.y);c.lineTo(cup.x-cup.w/2,bottom);c.lineTo(cup.x+cup.w/2,bottom);c.lineTo(cup.x+cup.w/2,cup.y);c.stroke();
    const targetY=bottom-(cup.h-8)*this.level.goal/WATER_TOTAL;c.setLineDash([4,4]);c.strokeStyle='#b19b5b';c.lineWidth=1;c.beginPath();c.moveTo(cup.x-cup.w/2+8,targetY);c.lineTo(cup.x+cup.w/2-8,targetY);c.stroke();c.setLineDash([]);
    for(const dx of [-13,13]){c.fillStyle='#547368';c.beginPath();c.arc(cup.x+dx,cup.y+cup.h*.52,3,0,7);c.fill();}
    c.strokeStyle='#547368';c.lineWidth=2;c.beginPath();if(caught>=this.level.goal)c.arc(cup.x,cup.y+cup.h*.63,11,0,Math.PI);else{c.moveTo(cup.x-9,cup.y+cup.h*.73);c.quadraticCurveTo(cup.x,cup.y+cup.h*.64,cup.x+9,cup.y+cup.h*.73);}c.stroke();
    const [sx,sy]=this.level.source;this.round(sx-48,sy-39,52,16,6,'#ceb889');this.round(sx-14,sy-34,28,25,5,'#ceb889');this.round(sx-9,sy-11,18,8,4,'#6c7f64');this.text('✳',sx-28,sy-31,19,'#91a679');
    for(const path of this.state.lines){this.drawLine(path,'#4c654529',10);this.drawLine(path,'#90a478',6);this.drawLine(path,'#dfe9d0',1.5);}
    if(this.stroke)this.drawLine(this.stroke,'#b49e5d',5);if(this.assisted?.length)this.drawLine(this.assisted,'#b49e5d',5,true);
    if(this.hint?.action?.type==='draw')this.drawLine(this.hint.action.path,'#b49e5d',4,true);
    if(this.water)for(const p of this.water.particles){c.fillStyle='#87b4c7';c.beginPath();c.arc(p.x,p.y,3.3,0,7);c.fill();c.fillStyle='#e6f5ef';c.beginPath();c.arc(p.x-.8,p.y-.8,1,0,7);c.fill();}
    this.text(this.running?`${caught} / ${this.level.goal} GOUTTES · L’EAU ARRIVE…`:this.state.result?`${caught} / ${this.level.goal} GOUTTES · ${caught>=this.level.goal?'UN VERRE HEUREUX':'AJUSTEZ VOS RAMPES ET RÉESSAYEZ'}`:'DESSINEZ UNE RAMPE, PUIS LAISSEZ COULER',320,578,10,'#829575');
  }
  draw(){if(!this.level||!this.canvas.width)return;const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);if(this.mode==='noeuds')this.drawNoeuds();else this.drawGouttes();}
}
