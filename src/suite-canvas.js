import { PocketCanvas } from './pocket-canvas.js';
import { COLORS } from './pocket-core.js';
import { accessiblePassengers } from './voyage-puzzle.js';
import { accessibleSpools } from './broderie-puzzle.js';

const W=640,H=600;
export class SuiteCanvas extends PocketCanvas {
  constructor(container,mode,callbacks){
    super(container,mode,callbacks);
    this.canvas.setAttribute('aria-label',({passages:'Cour : faites glisser les blocs vers leurs portes',voyage:'Salle d’embarquement : cliquez un voyageur accessible',carrousel:'Convoyeur : cliquez un tireur en attente pour le relancer',broderie:'Métier à broder : cliquez une bobine découverte'})[mode]);
    this.canvas.addEventListener('pointerdown',event=>{
      if(!callbacks.enabled())return;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(event.pointerId);const point=this.point(event);
      if(mode==='passages'){
        const g=this.grid(),cell=[Math.floor((point.x-g.x)/g.cell),Math.floor((point.y-g.y)/g.cell)],block=this.state.blocks.find(b=>cell[0]>=b.x&&cell[0]<b.x+b.w&&cell[1]>=b.y&&cell[1]<b.y+b.h);
        if(block){callbacks.select(block.id);this.grabbing={id:block.id,cell};}
      }else if(mode==='voyage'){
        const g=this.passengerGrid(),x=Math.floor((point.x-g.x)/g.cell),y=Math.floor((point.y-g.y)/g.cell),person=this.level.passengers.find(p=>p.x===x&&p.y===y);if(person)callbacks.play(person.id);
      }else if(mode==='broderie'){
        const ready=accessibleSpools(this.level,this.state),piece=[...this.level.spools].reverse().find(s=>ready.includes(s.id)&&this.insideSpool(point,s));if(piece)callbacks.play(piece.id);
      }else{
        const slot=Math.floor((point.x-99)/88);if(slot>=0&&slot<5&&point.y>502&&point.y<579&&this.state.waiting[slot])callbacks.play({type:'waiting',slot});
      }
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(!this.grabbing||!callbacks.enabled())return;const point=this.point(event),g=this.grid(),cell=[Math.floor((point.x-g.x)/g.cell),Math.floor((point.y-g.y)/g.cell)];
      let dx=cell[0]-this.grabbing.cell[0],dy=cell[1]-this.grabbing.cell[1];
      if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0;
      for(let n=0;n<Math.min(3,Math.max(Math.abs(dx),Math.abs(dy)));n++){if(!callbacks.play({id:this.grabbing.id,dx:Math.sign(dx),dy:Math.sign(dy)}))break;}
      this.grabbing.cell=cell;
    });
    const release=()=>{this.grabbing=null;};this.canvas.addEventListener('pointerup',release);this.canvas.addEventListener('pointercancel',release);
  }
  point(event){const r=this.canvas.getBoundingClientRect();return{x:(event.clientX-r.x)/r.width*W,y:(event.clientY-r.y)/r.height*H};}
  grid(){return {x:80,y:65,cell:480/this.level.size};}
  passengerGrid(){return {x:105,y:64,cell:Math.min(430/this.level.width,355/this.level.height)};}
  artGrid(){return {x:170,y:134,cell:300/this.level.size};}
  spoolPosition(s){return{x:177+s.x*66,y:393+s.y*40-s.layer};}
  insideSpool(p,s){const pos=this.spoolPosition(s);return p.x>=pos.x&&p.x<=pos.x+61&&p.y>=pos.y&&p.y<=pos.y+36;}
  screenPoint(value){
    let x,y;
    if(this.mode==='passages'){const g=this.grid();[x,y]=[g.x+(value[0]+.5)*g.cell,g.y+(value[1]+.5)*g.cell];}
    else if(this.mode==='voyage'){const p=this.level.passengers[value],g=this.passengerGrid();[x,y]=[g.x+(p.x+.5)*g.cell,g.y+(p.y+.5)*g.cell];}
    else if(this.mode==='broderie'){const p=this.spoolPosition(this.level.spools[value]);[x,y]=[p.x+30,p.y+18];}
    else{[x,y]=[143+value.slot*88,542];}
    const r=this.canvas.getBoundingClientRect();return{x:r.x+x/W*r.width,y:r.y+y/H*r.height};
  }
  update(level,state,hint,selected,previous){
    this.level=level;this.state=state;this.hint=hint;this.selected=selected;
    if(!previous){this.effects=[];this.motion=null;}else if(!this.reduced){
      this.motion={previous,start:performance.now()};const start=performance.now();
      if(this.mode==='passages')for(const b of previous.blocks)if(!state.blocks.some(n=>n.id===b.id))this.effects.push({kind:'block',block:b,start});
      if(this.mode==='voyage'){
        for(const id of state.removed)if(!previous.removed.includes(id))this.effects.push({kind:'person',person:level.passengers[id],start});
        if(state.bus>previous.bus)this.effects.push({kind:'bus',bus:level.buses[previous.bus],start});
      }
      if(this.mode==='carrousel'){
        const q=state.queues.findIndex((n,i)=>n>previous.queues[i]),slot=q!==-1?previous.waiting.indexOf(null):previous.waiting.findIndex((p,i)=>p&&(!state.waiting[i]||state.waiting[i].ammo!==p.ammo));
        const pig=q!==-1?level.queues[q][previous.queues[q]]:previous.waiting[slot];
        if(pig)this.effects.push({kind:'pig',pig,slot,hits:state.removed.filter(id=>!previous.removed.includes(id)),start});
      }
      if(this.mode==='broderie')for(const id of state.removed)if(!previous.removed.includes(id))this.effects.push({kind:'spool',spool:level.spools[id],patch:state.stitched.find(id=>!previous.stitched.includes(id)),start});
    }
    this.draw();
  }
  person(x,y,color,scale=1,number=null){
    const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle='#45605218';c.beginPath();c.ellipse(0,18,17,6,0,0,7);c.fill();
    this.round(-15,-1,30,28,13,COLORS[color].hex);c.fillStyle=COLORS[color].hex;c.beginPath();c.arc(0,-12,11,0,7);c.fill();c.fillStyle='#fff9e8';c.beginPath();c.arc(-3,-14,2,0,7);c.arc(3,-14,2,0,7);c.fill();
    this.text(COLORS[color].mark,0,9,13,color===7?'#fffaf0':'#34564a');if(number!==null)this.text(number,0,38,9);c.restore();
  }
  pig(x,y,color,ammo,scale=1,angle=0){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);c.fillStyle=COLORS[color].hex;c.beginPath();c.ellipse(0,1,22,17,0,0,7);c.fill();
    c.beginPath();c.moveTo(-12,-8);c.lineTo(-14,-23);c.lineTo(-3,-12);c.moveTo(9,-11);c.lineTo(18,-23);c.lineTo(18,-4);c.fill();
    c.fillStyle='#f4dbc2';c.beginPath();c.ellipse(15,5,12,9,0,0,7);c.fill();c.fillStyle='#6b775b';c.beginPath();c.arc(12,5,1.8,0,7);c.arc(19,5,1.8,0,7);c.fill();
    c.fillStyle='#fffdf2';c.beginPath();c.arc(3,-9,4,0,7);c.fill();c.fillStyle='#375548';c.beginPath();c.arc(4,-9,1.9,0,7);c.fill();
    c.strokeStyle=COLORS[color].hex;c.lineWidth=3;c.beginPath();c.moveTo(-19,6);c.bezierCurveTo(-38,16,-36,-5,-27,1);c.stroke();this.text(ammo,-4,2,13,color===7?'#fffdf1':'#34564a');c.restore();
  }
  bus(x,y,bus,count=0,scale=1){
    const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);this.round(-87,-29,174,64,17,COLORS[bus.color].hex,'#60775688');this.round(-71,-18,79,24,6,'#e9f1e5');this.round(16,-18,39,24,6,'#e9f1e5');this.round(60,-18,16,43,5,'#fff9e277');
    for(const xx of [-50,51]){c.fillStyle='#40594e';c.beginPath();c.arc(xx,34,12,0,7);c.fill();c.fillStyle='#a6b298';c.beginPath();c.arc(xx,34,5,0,7);c.fill();}
    this.text(`${COLORS[bus.color].mark} ${count} / ${bus.count}`,-30,19,13,bus.color===7?'#fffaf0':'#34564a');c.restore();
  }
  arrow(dx,dy,x,y,size=22){this.text(dx===1?'→':dx===-1?'←':dy===1?'↓':'↑',x,y,size,'#655c32');}
  drawPassages(){
    const c=this.ctx,g=this.grid(),level=this.level;this.round(g.x-18,g.y-18,516,516,25,'#dbe3cf','#ccd7c2');
    for(let y=0;y<level.size;y++)for(let x=0;x<level.size;x++)this.round(g.x+x*g.cell+2,g.y+y*g.cell+2,g.cell-4,g.cell-4,8,(x+y)%2?'#f0f3e5':'#e7eddd');
    for(const b of level.blocks){const d=b.door,horizontal=['top','bottom'].includes(d.side),x=d.side==='left'?g.x-14:d.side==='right'?g.x+480-3:g.x+d.at*g.cell+3,y=d.side==='top'?g.y-14:d.side==='bottom'?g.y+480-3:g.y+d.at*g.cell+3;this.round(x,y,horizontal?d.span*g.cell-6:17,horizontal?17:d.span*g.cell-6,7,COLORS[b.color].hex,'#7e997b');this.text(COLORS[b.color].mark,x+(horizontal?d.span*g.cell/2-3:8),y+(horizontal?8:d.span*g.cell/2-3),Math.min(16,g.cell*.25),b.color===7?'#fffaf0':'#34564a');}
    for(const [x,y]of level.walls){this.round(g.x+x*g.cell+6,g.y+y*g.cell+6,g.cell-12,g.cell-12,12,'#9fb28e','#879e78');this.text('✳',g.x+(x+.5)*g.cell,g.y+(y+.5)*g.cell,26,'#d3dfc4');}
    const drawBlock=(b,alpha=1)=>{
      const before=this.motion?.previous.blocks.find(n=>n.id===b.id),t=this.motion?Math.min(1,(performance.now()-this.motion.start)/120):1,x=before?before.x+(b.x-before.x)*t:b.x,y=before?before.y+(b.y-before.y)*t:b.y;
      c.save();c.globalAlpha=alpha;this.round(g.x+x*g.cell+4,g.y+y*g.cell+8,b.w*g.cell-8,b.h*g.cell-9,12,'#62785733');this.round(g.x+x*g.cell+4,g.y+y*g.cell+3,b.w*g.cell-8,b.h*g.cell-9,12,COLORS[b.color].hex,this.selected===b.id||this.hint?.action?.id===b.id?'#af9552':'#688c6a60');
      c.strokeStyle='#fff9';c.lineWidth=2;c.beginPath();c.moveTo(g.x+x*g.cell+15,g.y+y*g.cell+10);c.lineTo(g.x+(x+b.w)*g.cell-15,g.y+y*g.cell+10);c.stroke();this.text(COLORS[b.color].mark,g.x+(x+b.w/2)*g.cell,g.y+(y+b.h/2)*g.cell,Math.min(23,g.cell*.4),b.color===7?'#fffdf2':'#355647');
      if(this.hint?.action?.id===b.id)this.arrow(this.hint.action.dx,this.hint.action.dy,g.x+(x+b.w/2)*g.cell,g.y+(y+b.h/2)*g.cell+Math.min(21,g.cell*.3),22);c.restore();
    };
    for(const b of this.state.blocks)drawBlock(b);
    for(const fx of this.effects)if(fx.kind==='block'){const t=Math.min(1,(performance.now()-fx.start)/250);drawBlock(fx.block,1-t);}
    this.text('UN BLOC, UNE PORTE DE SA COULEUR',320,572,10,'#829575');
  }
  drawVoyage(){
    const c=this.ctx,g=this.passengerGrid(),level=this.level,ready=accessiblePassengers(level,this.state);const width=level.width*g.cell,height=level.height*g.cell;
    this.round(g.x-18,g.y-14,width+36,height+22,22,'#dde5d2','#d0dbc6');
    for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++)this.round(g.x+x*g.cell+3,g.y+y*g.cell+3,g.cell-6,g.cell-6,9,(x+y)%2?'#f0f3e8':'#e9efdf');
    for(const [x,y]of level.walls){const px=g.x+(x+.5)*g.cell,py=g.y+(y+.5)*g.cell;this.round(px-g.cell*.3,py-g.cell*.3,g.cell*.6,g.cell*.6,10,'#d2be99');this.text('✳',px,py,24,'#839d73');}
    for(const p of level.passengers){if(this.state.removed.includes(p.id))continue;const x=g.x+(p.x+.5)*g.cell,y=g.y+(p.y+.43)*g.cell;
      this.person(x,y,p.color,Math.min(1.3,g.cell/55),p.id+1);
      if(ready.includes(p.id)){c.strokeStyle=this.hint?.action===p.id?'#b69b54':'#8d9f7d';c.lineWidth=this.hint?.action===p.id?3:1.3;c.beginPath();c.ellipse(x,y+g.cell*.15,g.cell*.39,g.cell*.43,0,0,7);c.stroke();}
    }
    this.round(83,464,474,26,12,'#d8c6a3');this.text('LE QUAI · LES BUS VOUS ATTENDENT',320,477,10,'#7f795e');
    c.setLineDash([9,8]);c.strokeStyle='#b0bfa3';c.lineWidth=2;c.beginPath();c.moveTo(72,564);c.lineTo(568,564);c.stroke();c.setLineDash([]);
    const bus=level.buses[this.state.bus];if(bus)this.bus(438,528,bus,this.state.boarded,.8);else this.text('Tous à bord ✓',441,537,20);
    this.round(100,521,194,17,8,'#c3ad82');for(let i=0;i<5;i++){const id=this.state.buffer[i];if(id!==undefined)this.person(116+i*38,525,level.passengers[id].color,.52);else this.text('·',116+i*38,527,17,'#8c9c7b');}
    for(const fx of this.effects){const t=Math.min(1,(performance.now()-fx.start)/420);if(fx.kind==='person'){const p=fx.person,x=g.x+(p.x+.5)*g.cell,y=g.y+(p.y+.5)*g.cell;c.save();c.globalAlpha=1-t*.6;this.person(x+(440-x)*t,y+(522-y)*t,p.color,.7);c.restore();}if(fx.kind==='bus'){c.save();c.globalAlpha=1-t;this.bus(438+t*250,528,fx.bus,fx.bus.count,.8);c.restore();}}
  }
  conveyorPoint(t){
    const side=t*4,n=side%1;
    if(side<1)return{x:104+n*432,y:90,angle:0};if(side<2)return{x:536,y:90+n*370,angle:Math.PI/2};if(side<3)return{x:536-n*432,y:460,angle:Math.PI};return{x:104,y:460-n*370,angle:-Math.PI/2};
  }
  drawCarrousel(){
    const c=this.ctx,level=this.level,g=this.artGrid(),gone=new Set(this.state.removed),running=this.effects.find(f=>f.kind==='pig'&&performance.now()-f.start<650);
    c.strokeStyle='#c2cfb5';c.lineWidth=36;c.beginPath();c.roundRect(91,76,458,398,35);c.stroke();c.strokeStyle='#e1e7d7';c.lineWidth=23;c.stroke();
    for(let i=0;i<34;i++){const p=this.conveyorPoint((i/34+(this.reduced?0:performance.now()/9000))%1);c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.strokeStyle='#b9c7ac';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-9);c.lineTo(0,9);c.stroke();c.restore();}
    this.round(g.x-9,g.y-9,318,318,14,'#d6c9a5');
    for(let id=0;id<level.cells.length;id++){const x=g.x+id%level.size*g.cell,y=g.y+Math.floor(id/level.size)*g.cell;
      if(gone.has(id)){this.round(x+.8,y+.8,g.cell-1.6,g.cell-1.6,2,'#edf0e3');continue;}
      const color=level.cells[id];this.round(x+1,y+3,g.cell-2,g.cell-2,2,'#36564620');this.round(x+1,y+1,g.cell-2,g.cell-3,2,COLORS[color].hex);c.strokeStyle='#ffffff65';c.lineWidth=1;c.beginPath();c.moveTo(x+3,y+3);c.lineTo(x+g.cell-4,y+3);c.stroke();
    }
    this.text(`UN TOUR · JUSQU’À ${level.lapLimit} TIRS`,320,490,10,'#829575');
    for(let slot=0;slot<5;slot++){this.round(109+slot*88,513,69,63,14,'#e6ecdd','#d0dac8');const pig=running?.slot===slot?null:this.state.waiting[slot];if(pig)this.pig(143+slot*88,546,pig.color,pig.ammo,.86);else this.text('·',143+slot*88,545,26,'#9bb28e');}
    if(running){const t=Math.min(.999,(performance.now()-running.start)/650),p=this.conveyorPoint(t);this.pig(p.x,p.y,running.pig.color,Math.max(0,running.pig.ammo-Math.floor(t*running.hits.length)),.88,p.angle);
      for(let i=0;i<running.hits.length;i++){const local=t*running.hits.length-i;if(local<0||local>1.3)continue;const id=running.hits[i],tx=g.x+(id%level.size+.5)*g.cell,ty=g.y+(Math.floor(id/level.size)+.5)*g.cell,u=Math.min(1,local);c.fillStyle=COLORS[running.pig.color].hex;c.beginPath();c.arc(p.x+(tx-p.x)*u,p.y+(ty-p.y)*u,4*(1-u)+2,0,7);c.fill();if(u>.8){c.globalAlpha=1-u;c.strokeStyle='#fffdf1';c.lineWidth=2;c.strokeRect(tx-g.cell/2,ty-g.cell/2,g.cell,g.cell);c.globalAlpha=1;}}
    }
  }
  drawBroderie(){
    const c=this.ctx,level=this.level,size=level.size,cell=256/size,x0=192,y0=70,stitched=new Set();
    const recent=this.effects.find(f=>f.kind==='spool'&&f.patch!==undefined&&performance.now()-f.start<430),t=recent?Math.min(1,(performance.now()-recent.start)/430):1;
    for(const id of this.state.stitched){const patch=level.patches[id];for(const pixel of patch.pixels.slice(0,recent?.patch===id?Math.ceil(patch.pixels.length*t):patch.pixels.length))stitched.add(pixel);}
    this.round(171,49,298,298,20,'#d1b98f','#baa479');this.round(181,59,278,278,13,'#fbf7e8','#e4d5b5');
    for(let id=0;id<level.cells.length;id++){const x=x0+id%size*cell,y=y0+Math.floor(id/size)*cell,color=level.cells[id];
      if(stitched.has(id)){c.strokeStyle=COLORS[color].hex;c.lineWidth=Math.max(2,cell*.22);c.lineCap='round';c.beginPath();c.moveTo(x+cell*.22,y+cell*.22);c.lineTo(x+cell*.78,y+cell*.78);c.moveTo(x+cell*.78,y+cell*.22);c.lineTo(x+cell*.22,y+cell*.78);c.stroke();c.strokeStyle='#ffffff80';c.lineWidth=.8;c.beginPath();c.moveTo(x+cell*.24,y+cell*.2);c.lineTo(x+cell*.7,y+cell*.66);c.stroke();}
      else{c.globalAlpha=.16;this.round(x+2,y+2,cell-4,cell-4,2,COLORS[color].hex);c.globalAlpha=1;c.fillStyle='#b9bfa44d';c.beginPath();c.arc(x+cell/2,y+cell/2,1,0,7);c.fill();}
    }
    this.text('TROIS FILS IDENTIQUES, UNE PARTIE BRODÉE',320,364,10,'#829575');
    this.round(149,377,342,204,22,'#e2e8d7','#d0dac5');
    const ready=accessibleSpools(level,this.state);
    for(const spool of level.spools){if(this.state.removed.includes(spool.id))continue;const pos=this.spoolPosition(spool),color=spool.color,free=ready.includes(spool.id);this.round(pos.x+2,pos.y+5,61,35,9,'#6b7b5726');this.round(pos.x,pos.y,61,35,9,'#fcfcf3',this.hint?.action===spool.id?'#b39b5b':free?'#a4b78e':'#d0d7c4');
      this.round(pos.x+19,pos.y+4,23,27,6,COLORS[color].hex);this.round(pos.x+15,pos.y+1,31,6,3,'#cbb68e');this.round(pos.x+15,pos.y+29,31,5,3,'#cbb68e');this.text(COLORS[color].mark,pos.x+30,pos.y+17,11,color===7?'#fffdf2':'#34564a');this.text(spool.id+1,pos.x+8,pos.y+18,8,free?'#677e5e':'#a3af96');
      if(free){c.fillStyle='#8aa47a';c.beginPath();c.arc(pos.x+54,pos.y+7,2,0,7);c.fill();}
    }
    for(const fx of this.effects)if(fx.kind==='spool'){const u=Math.min(1,(performance.now()-fx.start)/430),pos=this.spoolPosition(fx.spool);c.save();c.globalAlpha=1-u;this.bobbin(pos.x+30+(320-pos.x-30)*u,pos.y+18+(200-pos.y-18)*u,fx.spool.color,.45);c.restore();if(fx.patch!==undefined){const patch=level.patches[fx.patch],id=patch.pixels[Math.min(patch.pixels.length-1,Math.floor(u*patch.pixels.length))];this.text('✧',x0+(id%size+.5)*cell,y0+(Math.floor(id/size)+.5)*cell,22,'#a79155');}}
  }
  draw(){
    if(!this.level||!this.canvas.width)return;const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);this.effects=this.effects.filter(f=>performance.now()-f.start<700);
    if(this.mode==='passages')this.drawPassages();else if(this.mode==='voyage')this.drawVoyage();else if(this.mode==='carrousel')this.drawCarrousel();else this.drawBroderie();
  }
}
