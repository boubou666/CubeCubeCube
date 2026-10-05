import {PocketCanvas} from './pocket-canvas.js';
import {COLORS} from './pocket-core.js';
import {duoRoute} from './duos-puzzle.js';
import {SOIL,SoilFlow} from './terriers-physics.js';
const W=640,H=600;
export class CabinetCanvas extends PocketCanvas{
  constructor(container,mode,callbacks){
    super(container,mode,callbacks);this.canvas.setAttribute('aria-label',mode==='etageres'?'Étagères : déplacez les produits vers une place vide':mode==='duos'?'Duos : choisissez deux motifs identiques reliés par un chemin libre':'Terriers : creusez la terre puis libérez les billes');
    this.canvas.addEventListener('pointerdown',e=>{
      if(!callbacks.enabled())return;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);const p=this.point(e);
      if(mode==='etageres'){const id=this.goodsAt(p);if(id===null)return;const shelf=Math.floor(id/3),cell=id%3;if(this.state.fronts[shelf][cell]!==null){callbacks.goods(id);this.grab={shelf,cell,start:p,point:p,moved:false};}else callbacks.goods(id);}
      if(mode==='duos'){const id=this.duoAt(p);if(id!==null)callbacks.duo(id);}
      if(mode==='terriers'&&this.inside(p))this.stroke=[p];
    });
    this.canvas.addEventListener('pointermove',e=>{
      if(!callbacks.enabled())return;const p=this.point(e);if(this.grab){this.grab.point=p;this.grab.moved||=Math.hypot(p[0]-this.grab.start[0],p[1]-this.grab.start[1])>7;}
      if(this.stroke&&this.inside(p)&&this.stroke.length<159&&Math.hypot(p[0]-this.stroke.at(-1)[0],p[1]-this.stroke.at(-1)[1])>4)this.stroke.push(p);
    });
    this.canvas.addEventListener('pointerup',e=>{
      const p=this.point(e);if(this.grab){const grab=this.grab;this.grab=null;const id=this.goodsAt(p);if(grab.moved&&id!==null&&callbacks.enabled())callbacks.play({from:grab.shelf,slot:grab.cell,to:Math.floor(id/3),cell:id%3});}
      if(this.stroke){const path=this.stroke;this.stroke=null;if(this.inside(p)&&path.length<160)path.push(p);if(path.length>1&&callbacks.enabled())callbacks.play({type:'dig',path});}
    });
    this.canvas.addEventListener('pointercancel',()=>{this.grab=null;this.stroke=null;});
  }
  point(e){const r=this.canvas.getBoundingClientRect();return[(e.clientX-r.x)/r.width*W,(e.clientY-r.y)/r.height*H];}
  inside(p){return p[0]>=56&&p[0]<=584&&p[1]>=80&&p[1]<=528;}
  shelfPosition(id){const rows=Math.ceil(this.level.shelves.length/2),h=440/rows;return{x:53+id%2*280,y:70+Math.floor(id/2)*h,w:254,h:h-12};}
  goodsPosition(shelf,cell){const p=this.shelfPosition(shelf);return[p.x+44+cell*83,p.y+p.h*.67];}
  goodsAt(p){for(let shelf=0;shelf<this.level.shelves.length;shelf++)for(let cell=0;cell<3;cell++){const q=this.goodsPosition(shelf,cell);if(Math.abs(p[0]-q[0])<37&&Math.abs(p[1]-q[1])<32)return shelf*3+cell;}return null;}
  duoGrid(){const cell=Math.min(62,460/this.level.cols,436/this.level.rows);return {cell,x:(W-cell*this.level.cols)/2,y:(H-cell*this.level.rows)/2-10};}
  duoPosition(id){const g=this.duoGrid();return[g.x+(id%this.level.cols+.5)*g.cell,g.y+(Math.floor(id/this.level.cols)+.5)*g.cell];}
  duoAt(p){const g=this.duoGrid(),x=Math.floor((p[0]-g.x)/g.cell),y=Math.floor((p[1]-g.y)/g.cell);return x>=0&&y>=0&&x<this.level.cols&&y<this.level.rows?y*this.level.cols+x:null;}
  screenPoint(value){const p=this.mode==='etageres'?this.goodsPosition(value.shelf,value.cell):this.mode==='duos'?this.duoPosition(value):value,r=this.canvas.getBoundingClientRect();return{x:r.x+p[0]/W*r.width,y:r.y+p[1]/H*r.height};}
  update(level,state,hint,selected,previous,action){
    const changed=level!==this.level||state!==this.state;this.level=level;this.state=state;this.hint=hint;this.selected=selected;
    if(changed){this.grab=null;this.stroke=null;this.assisted=[];this.flow=null;this.running=false;this.motion=null;
      if(this.mode==='duos'&&previous&&action&&!this.reduced){const route=duoRoute(level,previous,action.a,action.b);if(route)this.motion={route,a:action.a,b:action.b,color:previous.field[action.a],start:performance.now()};}
      if(this.mode==='terriers'){
        this.paintSoil();if(previous&&state.trial>previous.trial&&action?.type==='run'&&!this.reduced){this.flow=new SoilFlow(level,state.soil);this.running=true;this.last=performance.now();this.carry=0;}
      }
    }this.draw();
  }
  paintSoil(){this.earth=document.createElement('canvas');this.earth.width=528;this.earth.height=448;const c=this.earth.getContext('2d');for(let y=0;y<SOIL.rows;y++)for(let x=0;x<SOIL.cols;x++){const v=this.state.soil[y*SOIL.cols+x];if(!v)continue;c.fillStyle=v===2?'#9da193':(x*17+y*29)%11<2?'#ccb994':'#d9c6a1';c.fillRect(x*4,y*4,4,4);}}
  line(path,color,width=3,dashed=false){if(!path?.length)return;const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.lineCap=c.lineJoin='round';if(dashed)c.setLineDash([7,6]);c.beginPath();path.forEach((p,n)=>n?c.lineTo(...p):c.moveTo(...p));c.stroke();c.setLineDash([]);}
  goods(x,y,color,scale=1){
    const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle=COLORS[color].hex;c.strokeStyle='#48634e';c.lineWidth=2;
    if(color===0||color===3){c.beginPath();c.ellipse(0,5,14,color===0?18:13,color===3?-.35:0,0,7);c.fill();c.beginPath();c.moveTo(0,-12);c.lineTo(3,-22);c.stroke();c.fillStyle='#68886e';c.beginPath();c.ellipse(9,-17,8,3,-.5,0,7);c.fill();}
    else if(color===1||color===7){this.round(-16,-15,32,37,6,COLORS[color].hex);this.round(-17,-21,34,8,3,'#bda77a');this.round(-12,-3,24,19,3,'#faf4de');this.text(COLORS[color].mark,0,7,15,'#647760');}
    else if(color===2){this.round(-12,-15,24,37,5,COLORS[color].hex);this.round(-8,-23,16,9,3,'#f0efdb');this.round(-8,-3,16,17,3,'#eff5e9');this.text('▲',0,7,13,'#78969d');}
    else if(color===4){c.strokeStyle='#81936f';c.beginPath();c.moveTo(0,-5);c.lineTo(0,21);c.moveTo(-11,-6);c.lineTo(0,21);c.moveTo(12,-8);c.lineTo(0,21);c.stroke();for(const [xx,yy] of [[-12,-8],[0,-15],[12,-9]]){c.fillStyle=COLORS[color].hex;for(let n=0;n<5;n++){c.beginPath();c.arc(xx+Math.cos(n*1.26)*5,yy+Math.sin(n*1.26)*5,5,0,7);c.fill();}c.fillStyle='#eedaab';c.beginPath();c.arc(xx,yy,3,0,7);c.fill();}}
    else{this.round(-20,-12,40,30,9,COLORS[color].hex);this.text(COLORS[color].mark,0,3,20,'#fff7de');}c.restore();
  }
  motif(x,y,color,scale=1){const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle=COLORS[color].hex;
    if(color===0){c.beginPath();c.ellipse(0,0,13,20,.65,0,7);c.fill();this.line([[-8,11],[8,-11]],'#537461',1.5);}
    else if(color===1){for(let n=0;n<6;n++){c.beginPath();c.arc(Math.cos(n*1.047)*11,Math.sin(n*1.047)*11,7,0,7);c.fill();}c.fillStyle='#f3dfad';c.beginPath();c.arc(0,0,6,0,7);c.fill();}
    else if(color===2){c.beginPath();c.ellipse(-2,3,16,11,0,0,7);c.fill();c.beginPath();c.arc(10,-8,8,0,7);c.fill();this.line([[-13,5],[-21,-5]],COLORS[color].hex,6);c.fillStyle='#e6bd73';c.beginPath();c.moveTo(17,-9);c.lineTo(24,-6);c.lineTo(17,-3);c.fill();c.fillStyle='#40594f';c.beginPath();c.arc(12,-9,2,0,7);c.fill();}
    else if(color===3){c.beginPath();c.arc(0,0,12,0,7);c.fill();for(let n=0;n<8;n++)this.line([[Math.cos(n*.785)*16,Math.sin(n*.785)*16],[Math.cos(n*.785)*21,Math.sin(n*.785)*21]],COLORS[color].hex,3);}
    else if(color===4){for(const sign of [-1,1]){c.beginPath();c.ellipse(sign*10,-6,10,13,sign*.45,0,7);c.fill();c.beginPath();c.ellipse(sign*8,9,8,9,-sign*.4,0,7);c.fill();}this.line([[0,-15],[0,17]],'#6b6e62',3);}
    else{c.beginPath();c.moveTo(0,19);c.bezierCurveTo(-30,0,-16,-25,0,-10);c.bezierCurveTo(16,-25,30,0,0,19);c.fill();}c.restore();
  }
  drawShelves(){const c=this.ctx;this.round(32,44,576,497,26,'#e9e5d6','#d8d1bb');
    this.state.fronts.forEach((row,shelf)=>{const p=this.shelfPosition(shelf),rear=this.level.shelves[shelf][this.state.cursors[shelf]];this.round(p.x,p.y,p.w,p.h,12,'#f9f4e7','#d5c5a1');this.round(p.x+4,p.y+p.h-10,p.w-8,10,4,'#c9ae7f');this.text(`0${shelf+1}`,p.x+17,p.y+14,9,'#96876a');
      if(rear){c.save();c.globalAlpha=.38;rear.forEach((color,cell)=>this.goods(p.x+44+cell*83,p.y+Math.max(30,p.h*.26),color,.5));c.restore();this.text(`+${this.level.shelves[shelf].length-this.state.cursors[shelf]} RANGÉE${this.level.shelves[shelf].length-this.state.cursors[shelf]>1?'S':''}`,p.x+p.w/2,p.y+13,8,'#9f9278');}
      row.forEach((color,cell)=>{const [x,y]=this.goodsPosition(shelf,cell),selected=this.selected?.shelf===shelf&&this.selected?.cell===cell,ha=this.hint?.action,hinted=ha?.from===shelf&&ha.slot===cell||ha?.to===shelf&&ha.cell===cell;this.round(x-35,y-30,70,58,8,selected?'#e5ead5':'#ede4ce',hinted?'#ac9250':selected?'#829771':null);if(color!==null&&!(this.grab?.shelf===shelf&&this.grab?.cell===cell&&this.grab.moved))this.goods(x,y-3,color,Math.min(1,p.h/95));else if(color===null)this.text('+',x,y,23,'#c5baa0');});
    });if(this.grab?.moved)this.goods(...this.grab.point,this.state.fronts[this.grab.shelf][this.grab.cell],1.1);this.text('TROIS IDENTIQUES · UNE PLACE VIDE POUR LES DÉPLACER',320,574,10,'#879077');
  }
  routePoints(route){const g=this.duoGrid();return route.map(([x,y])=>[g.x+(x+.5)*g.cell,g.y+(y+.5)*g.cell]);}
  drawDuos(){const c=this.ctx,g=this.duoGrid();this.round(g.x-g.cell*.7,g.y-g.cell*.7,g.cell*(this.level.cols+1.4),g.cell*(this.level.rows+1.4),23,'#e6ecdc','#d5dfcc');
    this.state.field.forEach((color,id)=>{const [x,y]=this.duoPosition(id),hinted=this.hint?.action?.a===id||this.hint?.action?.b===id;this.round(x-g.cell*.46,y-g.cell*.46,g.cell*.92,g.cell*.92,9,color===null?'#edf2e5':color<0?'#a8b39c':'#fbfaf0',hinted?'#b49b5d':this.selected===id?'#779272':'#dbe2d1');if(color!==null&&color>=0)this.motif(x,y,color,g.cell/65);if(color===-1)this.text('▧',x,y,28,'#dde4d2');});
    const ha=this.hint?.action,route=ha?duoRoute(this.level,this.state,ha.a,ha.b):null;if(route)this.line(this.routePoints(route),'#b6a265',3,true);
    if(this.motion){const t=(performance.now()-this.motion.start)/350;if(t<1){c.save();c.globalAlpha=1-t;this.line(this.routePoints(this.motion.route),COLORS[this.motion.color].hex,5);for(const id of [this.motion.a,this.motion.b])this.motif(...this.duoPosition(id),this.motion.color,(1+t*.25)*g.cell/65);c.restore();}}
    this.text('DEUX MOTIFS · DEUX VIRAGES AU MAXIMUM',320,574,10,'#879077');
  }
  advance(){if(!this.running)return;const now=performance.now(),elapsed=Math.min(.05,(now-this.last)/1000);this.last=now;if(document.querySelector('dialog[open]'))return;this.carry+=elapsed*60;while(this.carry>=1&&!this.flow.done){this.flow.step();this.carry--;}this.callbacks.soilProgress?.(this.flow.caught);if(this.flow.done){this.running=false;queueMicrotask(()=>this.callbacks.settled?.());}}
  drawTerriers(){this.advance();const c=this.ctx;this.round(40,58,560,489,24,'#eee9dc','#d7d4be');this.round(56,80,528,448,10,'#f7f3e4');if(this.earth)c.drawImage(this.earth,56,80);this.round(56,73,528,8,4,'#98ab82');for(let n=0;n<20;n++)this.text('⌁',65+n*26,67,13,'#7e9a72');
    for(const o of this.level.rocks){this.round(o.x,o.y,o.w,o.h,6,'#9da193','#8f9688');this.line([[o.x+6,o.y+11],[o.x+16,o.y+8],[o.x+21,o.y+19]],'#c5c9b8',2);}
    const balls=this.flow?.balls??this.state.result?.balls??this.level.balls;
    for(const cup of this.level.cups){const caught=balls.some(b=>b.color===cup.color&&b.status==='caught');this.round(cup.x-cup.w/2,cup.y,cup.w,42,6,COLORS[cup.color].hex);this.round(cup.x-cup.w/2+4,cup.y+4,cup.w-8,31,5,'#52674d');this.text(caught?'✓':COLORS[cup.color].mark,cup.x,cup.y+21,19,'#fbf5db');}
    for(const b of balls)if(b.status!=='caught'&&b.status!=='lost'){c.fillStyle='#52674730';c.beginPath();c.arc(b.x+2,b.y+4,SOIL.radius+1,0,7);c.fill();c.fillStyle=COLORS[b.color].hex;c.beginPath();c.arc(b.x,b.y,SOIL.radius,0,7);c.fill();this.text(COLORS[b.color].mark,b.x,b.y,8,'#365c4c');c.fillStyle='#ffffff7a';c.beginPath();c.arc(b.x-3,b.y-3,2,0,7);c.fill();}
    if(this.stroke)this.line(this.stroke,'#f9edc680',SOIL.brush*2);if(this.assisted?.length)this.line(this.assisted,'#ad965b',3,true);if(this.hint?.action?.type==='dig')this.line(this.hint.action.path,'#aa9152',4,true);
    this.text(this.running?'LES BILLES DESCENDENT…':this.state.result?`${this.state.result.caught} / ${this.level.balls.length} BILLES À LA MAISON`:'CREUSEZ UN TUNNEL · PUIS LIBÉREZ LES BILLES',320,574,10,'#879077');
  }
  draw(){if(!this.level||!this.canvas.width)return;const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);if(this.mode==='etageres')this.drawShelves();else if(this.mode==='duos')this.drawDuos();else this.drawTerriers();}
}
