import { PocketCanvas } from './pocket-canvas.js';
import { COLORS } from './pocket-core.js';
import { SandFlow, SAND_UNIT, sandWidth } from './dunes-puzzle.js';
import { moveHole, holeRadius } from './fringale-puzzle.js';
import { distance } from './physics-geometry.js';
const W=640,H=600;
export class HarvestCanvas extends PocketCanvas{
  constructor(container,mode,callbacks){
    super(container,mode,callbacks);this.canvas.setAttribute('aria-label',({ecluses:'Bassins : cliquez une goupille pour libérer les billes',dunes:'Bac à sable : choisissez un bloc puis sa colonne de chute',fringale:'Jardin : guidez le trou ou cliquez un petit objet'})[mode]);
    this.canvas.addEventListener('pointerdown',event=>{
      if(!callbacks.enabled())return;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(event.pointerId);const p=this.point(event);
      if(mode==='ecluses'){const gate=this.level.pins.map((_,id)=>({id,d:distance(p,this.gatePoint(id))})).sort((a,b)=>a.d-b.d)[0];if(gate?.d<29)callbacks.play(gate.id);}
      if(mode==='dunes'){
        if(p[1]>516){const q=[190,320,450].findIndex(x=>Math.abs(x-p[0])<55);if(q>=0)callbacks.select(q);}
        else if(this.selected!==null&&p[0]>=140&&p[0]<=500&&p[1]>=66&&p[1]<=511){this.cursor=this.sandColumn(p);callbacks.sand(this.cursor);}
      }
      if(mode==='fringale'){
        const item=this.level.items.find(item=>!this.state.collected.includes(item.id)&&distance(p,[item.x,item.y])<Math.max(13,item.r));
        this.grab={start:p,path:[],item:item?.id,moved:false};
      }
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(!callbacks.enabled())return;const p=this.point(event);
      if(mode==='dunes'&&this.selected!==null&&p[0]>=140&&p[0]<=500)this.cursor=this.sandColumn(p);
      if(this.grab&&mode==='fringale'){
        this.grab.moved||=distance(this.grab.start,p)>7;
        if(this.grab.moved&&this.grab.path.length<159&&(!this.grab.path.length||distance(p,this.grab.path.at(-1))>4)){
          this.grab.path.push([Math.max(50,Math.min(590,p[0])),Math.max(60,Math.min(540,p[1]))]);this.preview=moveHole(this.level,this.state,{type:'path',path:this.grab.path})||this.state;
        }
      }
    });
    this.canvas.addEventListener('pointerup',event=>{
      if(!this.grab)return;const grab=this.grab;this.grab=null;this.preview=null;if(!callbacks.enabled())return;
      if(grab.moved&&grab.path.length){const p=this.point(event);if(p[0]>=50&&p[0]<=590&&p[1]>=60&&p[1]<=540&&distance(grab.path.at(-1),p)>.3&&grab.path.length<160)grab.path.push(p);this.justDragged=true;callbacks.play({type:'path',path:grab.path});this.justDragged=false;}
      else if(grab.item!==undefined)callbacks.play({type:'visit',id:grab.item});
      else{const p=this.point(event);if(p[0]>=50&&p[0]<=590&&p[1]>=60&&p[1]<=540)callbacks.play({type:'path',path:[p]});}
    });
    this.canvas.addEventListener('pointercancel',()=>{this.grab=null;this.preview=null;});
  }
  point(event){const r=this.canvas.getBoundingClientRect();return[(event.clientX-r.x)/r.width*W,(event.clientY-r.y)/r.height*H];}
  sandGrid(){return{x:140,y:66,dx:360/this.level.width,dy:445/this.level.height};}
  sandColumn(p){const piece=this.level.queues[this.selected]?.[this.state.queues[this.selected]],g=this.sandGrid();return piece?Math.max(0,Math.min(this.level.width-sandWidth(piece),Math.floor((p[0]-g.x)/g.dx)-sandWidth(piece)/2)):0;}
  gateLine(id){const pin=this.level.pins[id],from=this.level.rooms[pin.from],target=Number.isInteger(pin.to)?this.level.rooms[pin.to]:null;return [[from.x,from.y+from.h/2],target?[target.x,target.y-target.h/2]:[320,533]];}
  gatePoint(id){const [a,b]=this.gateLine(id);return[a[0]+(b[0]-a[0])*.44,a[1]+(b[1]-a[1])*.44];}
  screenPoint(value){let p;
    if(this.mode==='ecluses')p=this.gatePoint(value);
    else if(this.mode==='dunes'){if(value.q!==undefined&&value.x===undefined)p=[[190,320,450][value.q],552];else{const g=this.sandGrid(),piece=this.level.queues[value.q][this.state.queues[value.q]];p=[g.x+(value.x+sandWidth(piece)/2+.1)*g.dx,120];}}
    else p=Array.isArray(value)?value:[this.level.items[value].x,this.level.items[value].y];
    const r=this.canvas.getBoundingClientRect();return{x:r.x+p[0]/W*r.width,y:r.y+p[1]/H*r.height};
  }
  update(level,state,hint,selected,previous,action){
    const changed=state!==this.state||level!==this.level;this.level=level;this.state=state;this.hint=hint;this.selected=selected;
    if(changed){this.grab=null;this.preview=null;this.flow=null;this.running=false;this.effects=[];this.eats=new Map();this.eatenVisual=new Set();this.motion=null;
      if(previous&&!this.reduced){
        this.motion={previous,start:performance.now()};
        if(this.mode==='dunes'&&action){this.flow=new SandFlow(level,previous,action);if(!this.flow.invalid){this.running=true;this.last=performance.now();this.carry=0;}}
        if(this.mode==='fringale'){
          const trace=action&&!this.justDragged?moveHole(level,previous,action,true):null;
          this.motion=trace?{previous,trail:trace.trail,start:performance.now()}:null;
          if(!trace)for(const id of state.collected)if(!previous.collected.includes(id)){this.eats.set(id,performance.now());this.eatenVisual.add(id);}
        }
      }
    }
    this.draw();
  }
  advanceSand(){
    if(!this.running)return;const now=performance.now(),elapsed=Math.min(.05,(now-this.last)/1000);this.last=now;if(document.querySelector('dialog[open]'))return;this.carry+=elapsed*120;
    while(this.carry>=1&&!this.flow.done){this.flow.step();this.carry--;}
    if(this.flow.done){this.running=false;queueMicrotask(()=>this.callbacks.settled?.());}
  }
  ballPoint(id,state){
    const room=state.rooms.findIndex(ids=>ids.includes(id));
    if(room>=0){const box=this.level.rooms[room],ids=state.rooms[room],n=ids.indexOf(id),cols=Math.max(2,Math.floor((box.w-18)/17));return[box.x-box.w/2+15+n%cols*17,box.y+box.h/2-18-Math.floor(n/cols)*17];}
    const index=state.collected.indexOf(id);if(index>=0)return[263+index%10*12.5,566-Math.floor(index/10)*7];
    return[550+id%3*12,550];
  }
  drawEcluses(){
    const c=this.ctx,now=performance.now();
    this.round(40,47,560,478,25,'#eff3e5','#d9e2cf');
    for(let id=0;id<this.level.pins.length;id++){
      const [a,b]=this.gateLine(id);c.lineCap='round';c.strokeStyle='#c5d2b7';c.lineWidth=13;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();c.strokeStyle='#f9fbf0';c.lineWidth=7;c.stroke();
    }
    for(const room of this.level.rooms){this.round(room.x-room.w/2,room.y-room.h/2+5,room.w,room.h,14,'#546e4120');this.round(room.x-room.w/2,room.y-room.h/2,room.w,room.h,13,'#fbfcf4','#c6d2b9');c.strokeStyle='#eff3e4';c.lineWidth=3;c.beginPath();c.moveTo(room.x-room.w/2+7,room.y-room.h/2+8);c.lineTo(room.x+room.w/2-7,room.y-room.h/2+8);c.stroke();}
    this.round(246,541,148,36,14,'#d9c59f','#bfa87b');for(let x=254;x<390;x+=12){c.strokeStyle='#b5a27955';c.beginPath();c.moveTo(x,544);c.lineTo(x-4,572);c.stroke();}
    for(const ball of this.level.balls){
      if(this.state.bombsGone.includes(ball.id))continue;const target=this.ballPoint(ball.id,this.state),before=this.motion?.previous?this.ballPoint(ball.id,this.motion.previous):target,t=this.motion?Math.min(1,(now-this.motion.start)/430):1;
      const p=[before[0]+(target[0]-before[0])*t,before[1]+(target[1]-before[1])*t],lost=this.state.lost.includes(ball.id);c.save();if(lost)c.globalAlpha=1-t*.65;
      if(ball.bomb){c.fillStyle='#536358';c.beginPath();c.arc(p[0],p[1],10,0,7);c.fill();c.strokeStyle='#cfa16a';c.lineWidth=2;c.beginPath();c.moveTo(p[0]+4,p[1]-7);c.quadraticCurveTo(p[0]+14,p[1]-18,p[0]+19,p[1]-9);c.stroke();this.text('✳',p[0]+20,p[1]-10,12,'#dcaa6c');}
      else{const color=this.state.colors[ball.id];c.fillStyle=color===null?'#b8c2af':COLORS[color].hex;c.beginPath();c.arc(p[0],p[1],7,0,7);c.fill();c.fillStyle='#ffffff80';c.beginPath();c.arc(p[0]-2,p[1]-2,2,0,7);c.fill();}c.restore();
    }
    for(let id=0;id<this.level.pins.length;id++){
      const p=this.gatePoint(id),open=this.state.opened.includes(id),hinted=this.hint?.action===id;this.round(p[0]-23,p[1]-4,46,8,4,open?'#d8ddcb':'#cbb681',hinted?'#ae9552':null);
      if(!open){c.fillStyle=hinted?'#a58f52':'#e1cf9f';c.beginPath();c.arc(p[0]+26,p[1],9,0,7);c.fill();c.strokeStyle=hinted?'#ae9552':'#b39c6c';c.lineWidth=2;c.stroke();this.text(id+1,p[0],p[1]-15,10,'#8b8b69');}
    }
    this.text(this.state.lost.length?'DES BILLES PERDUES · ANNULEZ LA DERNIÈRE OUVERTURE':'UN PEU DE COULEUR AVANT LE DERNIER PASSAGE',320,590,9,'#829575');
  }
  drawSandPiece(piece,x,y,scale=1){for(const [sx,sy] of piece.shape){this.round(x+sx*17*scale,y+sy*17*scale,16*scale,16*scale,3,COLORS[piece.color].hex,'#ffffff90');this.round(x+sx*17*scale+3,y+sy*17*scale+3,8*scale,2,1,'#ffffff70');}}
  drawDunes(){
    this.advanceSand();const c=this.ctx,g=this.sandGrid(),field=this.flow?.state.field??this.state.field;
    this.round(127,53,386,470,21,'#d5c29c','#c6b48b');this.round(137,63,366,452,13,'#f8f7e9');
    for(let id=0;id<field.length;id++){
      const color=field[id];if(!color)continue;const x=g.x+id%this.level.width*g.dx,y=g.y+Math.floor(id/this.level.width)*g.dy;
      if(color<0){this.round(x+.3,y+.3,g.dx-.6,g.dy-.6,2,'#9dab91');continue;}
      c.fillStyle=COLORS[color-1].hex;c.fillRect(x+.1,y+.1,g.dx-.2,g.dy-.2);c.fillStyle=id%3?'#ffffff45':'#34564a20';c.fillRect(x+g.dx*.3,y+g.dy*.2,2,2);c.fillRect(x+g.dx*.7,y+g.dy*.7,1,1);
    }
    if(this.flow?.flash){c.save();c.globalAlpha=this.flow.flash.remaining/8;for(const {id,color} of this.flow.flash.cells){const x=g.x+id%this.level.width*g.dx,y=g.y+Math.floor(id/this.level.width)*g.dy;c.fillStyle='#fff5ca';c.fillRect(x,y,g.dx,g.dy);}c.restore();}
    const piece=this.selected===null?null:this.level.queues[this.selected]?.[this.state.queues[this.selected]];
    if(piece&&!this.running){const max=this.level.width-sandWidth(piece),x=Math.max(0,Math.min(max,this.hint?.action?.x??this.cursor??Math.floor(max/2)));c.save();c.globalAlpha=.30;for(const [sx,sy] of piece.shape)this.round(g.x+(x+sx*SAND_UNIT)*g.dx,g.y+sy*SAND_UNIT*g.dy,SAND_UNIT*g.dx-1,SAND_UNIT*g.dy-1,4,COLORS[piece.color].hex);c.restore();}
    for(let q=0;q<3;q++){const x=[190,320,450][q],p=this.level.queues[q][this.state.queues[q]];this.round(x-54,531,108,55,13,'#e3ead8',this.selected===q||this.hint?.action?.q===q?'#ae9552':'#cedbc3');if(p)this.drawSandPiece(p,x-26,541,.82);else this.text('✓',x,556,24,'#8da77d');this.text(q+1,x+42,573,9,'#7d9470');}
  }
  food(item,scale=1,alpha=1){
    const c=this.ctx,r=item.r,cx=item.x,cy=item.y;c.save();c.translate(cx,cy);c.scale(scale,scale);c.globalAlpha=alpha;c.fillStyle='#42643620';c.beginPath();c.ellipse(1,3,r*.95,r*.35,0,0,7);c.fill();const color=COLORS[item.color].hex;
    if(item.kind==='cake'){this.round(-r,-r*1.35,r*2,r*1.6,4,'#d2ae78');this.round(-r,-r*1.4,r*2,r*.45,3,color);for(let x=-r+3;x<r;x+=6)this.round(x,-r*1.33,2,3,1,'#fff7d5');}
    else if(item.kind==='pot'){this.round(-r*.66,-r*.2,r*1.32,r*.9,5,'#c8a578');c.strokeStyle='#6e9369';c.lineWidth=3;c.beginPath();c.moveTo(0,-r*.2);c.lineTo(0,-r*1.4);c.stroke();for(let n=0;n<6;n++){const angle=n*Math.PI/3;c.fillStyle=color;c.beginPath();c.arc(Math.cos(angle)*r*.3,-r*1.4+Math.sin(angle)*r*.3,r*.22,0,7);c.fill();}c.fillStyle='#eddc9f';c.beginPath();c.arc(0,-r*1.4,r*.15,0,7);c.fill();}
    else{c.fillStyle=color;c.beginPath();c.arc(0,-r*.55,Math.max(7,r*.9),0,7);c.fill();c.fillStyle='#ffffff70';c.beginPath();c.ellipse(-r*.3,-r*.8,r*.23,r*.35,.3,0,7);c.fill();c.fillStyle='#829e69';c.beginPath();c.ellipse(r*.25,-r*1.35,Math.max(4,r*.3),Math.max(2,r*.13),-.6,0,7);c.fill();if(item.kind==='melon'){c.strokeStyle='#50755b50';c.lineWidth=1.2;for(const dx of [-.4,0,.4]){c.beginPath();c.ellipse(dx*r,-r*.55,r*.18,r*.85,0,0,7);c.stroke();}}}
    c.restore();
  }
  visibleHole(){
    if(this.preview)return this.preview;
    if(this.motion?.trail){const t=Math.min(1,(performance.now()-this.motion.start)/400),n=Math.min(this.motion.trail.length-1,Math.floor(t*this.motion.trail.length));return this.motion.trail[n]??this.state;}
    return this.state;
  }
  drawFringale(){
    const c=this.ctx,pose=this.visibleHole(),radius=holeRadius(pose.mass),[hx,hy]=pose.hole,now=performance.now();
    this.round(40,50,560,500,28,'#dce7cf','#cddbbf');this.round(50,60,540,480,22,'#eef3e3');
    for(let y=80;y<530;y+=25)for(let x=70;x<580;x+=25){c.fillStyle='#adc29b25';c.fillRect(x+(y%3),y,1.5,1.5);}
    for(const wall of this.level.walls){this.round(wall.x-2,wall.y+4,wall.w+4,wall.h,9,'#496f3f25');this.round(wall.x,wall.y,wall.w,wall.h,8,'#a1b48d','#91a67d');for(let y=wall.y+10;y<wall.y+wall.h-5;y+=18)this.text('✳',wall.x+wall.w/2,y,12,'#c9d9b7');}
    c.fillStyle='#42643620';c.beginPath();c.ellipse(hx+2,hy+5,radius+5,radius,0,0,7);c.fill();const gradient=c.createRadialGradient(hx-radius*.25,hy-radius*.3,1,hx,hy,radius);gradient.addColorStop(0,'#526f61');gradient.addColorStop(1,'#253f36');c.fillStyle=gradient;c.beginPath();c.arc(hx,hy,radius,0,7);c.fill();c.strokeStyle='#a9bd95';c.lineWidth=4;c.stroke();
    for(const item of this.level.items){
      if(!pose.collected.includes(item.id)){this.food(item);if(this.hint?.action?.id===item.id){c.strokeStyle='#ae9552';c.lineWidth=2;c.setLineDash([4,3]);c.beginPath();c.arc(item.x,item.y,Math.max(item.r+8,18),0,7);c.stroke();c.setLineDash([]);}this.text(item.id+1,item.x,item.y+item.r+10,8,'#90a282');}
      else if(!this.motion?.previous?.collected.includes(item.id)&&!this.eatenVisual.has(item.id)&&this.motion){this.eats.set(item.id,now);this.eatenVisual.add(item.id);}
    }
    for(const [id,start] of this.eats){const t=Math.min(1,(now-start)/240);if(t<1){const item=this.level.items[id];this.food({...item,x:item.x+(hx-item.x)*t,y:item.y+(hy-item.y)*t},1-t,1-t);}else this.eats.delete(id);}
    this.text('LES PETITES BOUCHÉES FONT LES GRANDES FRINGALES',320,579,9,'#829575');
  }
  draw(){if(!this.level||!this.canvas.width)return;const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);if(this.mode==='ecluses')this.drawEcluses();else if(this.mode==='dunes')this.drawDunes();else this.drawFringale();}
}
