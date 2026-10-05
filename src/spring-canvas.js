import {PocketCanvas} from './pocket-canvas.js';
import {COLORS} from './pocket-core.js';
import {waterRoute} from './ruisseaux-puzzle.js';
import {CandyFlow} from './balancier-physics.js';
import {jellyCells,jellyDrop} from './gelees-puzzle.js';
import {JellySpring} from './jelly-springs.js';
import {closestOnSegment,segmentsMeet} from './physics-geometry.js';
const W=640,H=600;
export class SpringCanvas extends PocketCanvas{
  constructor(container,mode,callbacks){
    super(container,mode,callbacks);this.paused=true;this.turns=0;this.cursor=0;
    this.canvas.setAttribute('aria-label',mode==='ruisseaux'?'Ruisseaux : faites glisser les dalles vers une place vide':mode==='balancier'?'Balancier : coupez une corde, Espace lance ou met en pause':'Gelées : choisissez une forme, T tourne et Espace pose');
    this.canvas.addEventListener('pointerdown',e=>{
      if(!callbacks.enabled())return;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);const p=this.point(e);
      if(mode==='ruisseaux'){const id=this.streamAt(p);if(id===null)return;callbacks.stream(id);if(this.state.field[id]!==null&&!this.level.tiles[this.state.field[id]].fixed)this.grab={id,start:p,point:p};}
      if(mode==='balancier')this.stroke={start:p,last:p};
      if(mode==='gelees'){const id=this.jellyAt(p);if(id!==null){callbacks.jelly(id);this.grab={id,start:p,point:p};}else{const x=this.columnAt(p);if(x!==null)callbacks.jellyColumn(x);}}
    });
    this.canvas.addEventListener('pointermove',e=>{
      if(!callbacks.enabled())return;const p=this.point(e);if(this.grab){this.grab.point=p;this.grab.moved||=Math.hypot(p[0]-this.grab.start[0],p[1]-this.grab.start[1])>7;if(mode==='gelees'){const x=this.columnAt(p);if(x!==null)this.cursor=x;}}
      if(this.stroke){for(let id=0;id<this.level.ropes.length;id++){if(this.flow.cut.has(id))continue;const r=this.level.ropes[id],b=this.flow.ball;if(segmentsMeet(this.stroke.last,p,[r.x,r.y],[b.x,b.y])){this.stroke=null;callbacks.rope(id);return;}}this.stroke.last=p;}
    });
    this.canvas.addEventListener('pointerup',e=>{
      const p=this.point(e),grab=this.grab;this.grab=null;
      if(grab?.moved&&callbacks.enabled()){if(mode==='ruisseaux'){const to=this.streamAt(p);if(to!==null)callbacks.play({from:grab.id,to});}if(mode==='gelees'){const x=this.columnAt(p);if(x!==null)callbacks.jellyColumn(x);}}
      if(this.stroke){this.stroke=null;const id=this.ropeAt(p);if(id!==null&&callbacks.enabled())callbacks.rope(id);}
    });
    this.canvas.addEventListener('pointercancel',()=>{this.grab=null;this.stroke=null;});
    document.addEventListener('visibilitychange',this.visibility=()=>{this.last=performance.now();});
  }
  point(e){const r=this.canvas.getBoundingClientRect();return[(e.clientX-r.x)/r.width*W,(e.clientY-r.y)/r.height*H];}
  logicalScreen(p){const r=this.canvas.getBoundingClientRect();return{x:r.x+p[0]/W*r.width,y:r.y+p[1]/H*r.height};}
  streamGrid(){return{x:80,y:65,cell:480/this.level.size};}
  streamPosition(id){const g=this.streamGrid();return[g.x+(id%this.level.size+.5)*g.cell,g.y+(Math.floor(id/this.level.size)+.5)*g.cell];}
  streamAt(p){const g=this.streamGrid(),x=Math.floor((p[0]-g.x)/g.cell),y=Math.floor((p[1]-g.y)/g.cell);return x>=0&&y>=0&&x<this.level.size&&y<this.level.size?y*this.level.size+x:null;}
  jellyGrid(){const cell=Math.min(72,400/this.level.rows,420/this.level.cols);return{cell,x:(640-this.level.cols*cell)/2,y:100};}
  columnAt(p){const g=this.jellyGrid(),x=Math.floor((p[0]-g.x)/g.cell);return x>=0&&x<this.level.cols&&p[1]>=g.y-45&&p[1]<g.y+g.cell*this.level.rows?x:null;}
  tray(){return this.level.order.filter(id=>!this.state.used.includes(id)).slice(0,6);}
  jellyAt(p){if(p[1]<508||p[1]>575)return null;const slot=Math.floor((p[0]-50)/90);return slot>=0&&slot<6?this.tray()[slot]??null:null;}
  screenPoint(value){if(this.mode==='ruisseaux')return this.logicalScreen(this.streamPosition(value));if(this.mode==='gelees'){const g=this.jellyGrid();return this.logicalScreen([g.x+(value+.5)*g.cell,g.y+g.cell*.5]);}return this.logicalScreen(value);}
  jellyScreenPoint(id){return this.logicalScreen([95+this.tray().indexOf(id)*90,542]);}
  ropeScreenPoint(id){const r=this.level.ropes[id],b=this.flow.ball;return this.logicalScreen([(r.x+b.x)/2,(r.y+b.y)/2]);}
  ropeAt(p){let best=null,d=13;for(let id=0;id<this.level.ropes.length;id++){if(this.flow.cut.has(id))continue;const r=this.level.ropes[id],b=this.flow.ball,q=closestOnSegment(...p,[r.x,r.y],[b.x,b.y]),dist=Math.hypot(p[0]-q[0],p[1]-q[1]);if(dist<d){d=dist;best=id;}}return best;}
  update(level,state,hint,selected,previous,action){
    const changed=level!==this.level||state!==this.state;this.level=level;this.state=state;this.hint=hint;this.selected=selected;
    if(changed){this.grab=null;this.stroke=null;this.running=false;this.motion=null;this.last=performance.now();this.carry=0;
      if(this.mode==='ruisseaux'&&previous&&action&&!this.reduced)this.motion={previous,action,start:performance.now()};
      if(this.mode==='balancier'){
        this.flow=new CandyFlow(level,state.cuts);const until=(state.cuts.at(-1)?.tick??-1)+1;while(this.flow.tick<until&&!this.flow.done)this.flow.step();
        this.paused=!action;this.running=Boolean(state.result?.caught&&state.result.collected.length===level.stars.length&&!this.flow.done);if(this.running)this.paused=false;
        if(this.reduced&&this.running){while(!this.flow.done&&this.flow.tick<36000)this.flow.step();this.running=false;}
      }
      if(this.mode==='gelees'){
        this.turns=0;this.cursor=0;
        if(previous&&action&&!this.reduced){const p=state.placed.at(-1),g=this.jellyGrid();this.motion=new JellySpring(jellyCells(level.pieces[p.id],p.turns),g.x+p.x*g.cell,g.y+p.y*g.cell,g.cell,g.y);this.motion.id=p.id;this.running=true;}
      }
    }
    if(this.mode==='balancier'&&hint?.action)this.paused=true;
    if(this.mode==='gelees'&&hint?.action){this.turns=hint.action.turns;this.cursor=hint.action.x;}
    this.draw();
  }
  togglePause(){if(!this.flow||this.flow.done||this.running)return;this.paused=!this.paused;this.last=performance.now();this.carry=0;this.draw();}
  advance(){const now=performance.now(),elapsed=Math.min(.05,(now-this.last)/1000)||0;this.last=now;if(document.querySelector('dialog[open]'))return;
    if(this.mode==='balancier'&&!this.paused&&!this.flow.done){this.carry+=elapsed*120;while(this.carry>=1&&!this.flow.done&&this.flow.tick<36000){this.flow.step();this.carry--;}
      if(this.flow.done||this.flow.tick>=36000){this.paused=true;this.running=false;queueMicrotask(()=>this.callbacks.settled?.());}
    }
    if(this.mode==='gelees'&&this.running){this.carry+=elapsed*120;while(this.carry>=1&&!this.motion.done){this.motion.step();this.carry--;}if(this.motion.done){this.motion=null;this.running=false;queueMicrotask(()=>this.callbacks.settled?.());}}
  }
  line(path,color,width=3,dashed=false){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.lineCap=c.lineJoin='round';c.setLineDash(dashed?[5,6]:[]);c.beginPath();path.forEach((p,n)=>n?c.lineTo(...p):c.moveTo(...p));c.stroke();c.setLineDash([]);}
  flower(x,y,size=9,color='#df8c77'){const c=this.ctx;c.fillStyle=color;for(let n=0;n<5;n++){c.beginPath();c.ellipse(x+Math.cos(n*1.257)*size*.65,y+Math.sin(n*1.257)*size*.65,size*.53,size*.7,n*1.257,0,7);c.fill();}c.fillStyle='#f5e7bb';c.beginPath();c.arc(x,y,size*.38,0,7);c.fill();}
  pipe(id,x,y,water=false){const g=this.streamGrid(),tile=this.level.tiles[id],c=this.ctx,s=g.cell;this.round(x-s*.46,y-s*.46,s*.92,s*.92,10,tile.fixed?'#d1c6aa':'#e8dcc1','#cdbd9c');
    if(tile.type==='stone'){this.round(x-s*.34,y-s*.32,s*.68,s*.62,13,'#9da38e','#8b947f');this.text('▧',x,y,s*.3,'#d9dfcc');return;}
    const ports=[[1,0,-1],[2,1,0],[4,0,1],[8,-1,0]].filter(([mask])=>tile.mask&mask);
    for(const [,dx,dy] of ports)this.line([[x,y],[x+dx*s*.46,y+dy*s*.46]],'#a99879',s*.28);
    for(const [,dx,dy] of ports)this.line([[x,y],[x+dx*s*.46,y+dy*s*.46]],water?'#80afc5':'#f6f0df',s*.18);
    if(tile.fixed)this.text(tile.mask?'◉':'·',x,y,s*.17,'#64867c');
  }
  drawStreams(){const g=this.streamGrid(),route=waterRoute(this.level,this.state);this.round(62,47,516,516,26,'#d8dfc8','#c7d1b9');
    const t=this.motion?Math.min(1,(performance.now()-this.motion.start)/240):1;
    this.state.field.forEach((id,cell)=>{const [x,y]=this.streamPosition(cell);this.round(x-g.cell*.47,y-g.cell*.47,g.cell*.94,g.cell*.94,10,'#bcc8ac');if(id!==null){if(t<1&&cell===this.motion.action.to){const from=this.streamPosition(this.motion.action.from);this.pipe(id,from[0]+(x-from[0])*t,from[1]+(y-from[1])*t,route.path.includes(cell));}else this.pipe(id,x,y,route.path.includes(cell));}
      if(this.level.stars.includes(cell))this.flower(x+g.cell*.29,y-g.cell*.28,g.cell*.09,route.path.includes(cell)?'#dfba65':'#d8a5bd');
      if(this.selected===cell||this.hint?.action?.from===cell||this.hint?.action?.to===cell)this.round(x-g.cell*.43,y-g.cell*.43,g.cell*.86,g.cell*.86,9,null,'#aa9053');
    });
    for(const [id,label] of [[this.level.source,'SOURCE'],[this.level.goal,'BASSIN']]){const [x,y]=this.streamPosition(id);this.text(label,x,y+g.cell*.28,Math.max(8,g.cell*.09),'#657c6b');}
    if(route.path.length>1){const pts=route.path.map(id=>this.streamPosition(id));this.ctx.save();this.ctx.globalAlpha=.48;this.line(pts,'#bfe2df',4);this.ctx.restore();}
    this.text('UNE DALLE VOISINE · UNE PLACE VIDE',320,580,10,'#879077');
  }
  drawSwing(){this.advance();const c=this.ctx,b=this.flow.ball;this.round(40,48,560,501,26,'#e9efde','#d5dfcb');
    this.line([[62,531],[579,531]],'#c9d5b8',3);for(let n=0;n<18;n++)this.line([[70+n*30,531],[74+n*30,523]],'#9bad89',2);
    for(const o of this.level.obstacles){this.round(o.x,o.y,o.w,o.h,9,'#a8ad97','#919b86');this.line([[o.x+8,o.y+11],[o.x+18,o.y+7],[o.x+26,o.y+20]],'#d6dac8',2);}
    const cup=this.level.cup;this.round(cup.x-cup.w/2,cup.y,cup.w,37,8,'#c8ab79','#a98f68');for(let n=1;n<5;n++)this.line([[cup.x-cup.w/2+n*cup.w/5,cup.y+4],[cup.x-cup.w/2+n*cup.w/5,cup.y+31]],'#dfc59b',2);this.line([[cup.x-cup.w/2,cup.y],[cup.x+cup.w/2,cup.y]],'#b59162',5);
    this.level.stars.forEach(([x,y],id)=>{if(!this.flow.collected.includes(id))this.flower(x,y,11,'#dfba65');});
    this.level.ropes.forEach((r,id)=>{this.round(r.x-11,r.y-6,22,12,5,'#c6ad80');this.text(`${id+1}`,r.x,r.y-18,11,'#8a896c');if(!this.flow.cut.has(id)){this.line([[r.x,r.y],[b.x,b.y]],this.hint?.action?.rope===id?'#b99548':'#929775',this.hint?.action?.rope===id?4:2.5);}});
    if(!this.flow.lost){c.fillStyle='#ba7794';c.beginPath();c.arc(b.x,b.y,12,0,7);c.fill();c.fillStyle='#f5d8e2';c.beginPath();c.arc(b.x-3,b.y-4,3,0,7);c.fill();this.line([[b.x,b.y-11],[b.x+4,b.y-17]],'#718e68',2);}
    this.text(this.flow.done?(this.flow.caught?`${this.flow.collected.length} / ${this.level.stars.length} PÉTALES RÉCOLTÉS`:'UN AUTRE ÉLAN ? ANNULEZ OU RECOMMENCEZ'):this.paused?'EN PAUSE · ESPACE POUR LANCER':'COUPEZ UN FIL · ESPACE POUR OBSERVER',320,580,10,'#879077');
    const clock=document.querySelector('#swing-clock'),pause=document.querySelector('[data-swing-pause]');if(clock)clock.textContent=`${(this.flow.tick/120).toFixed(2)} s`;if(pause){pause.disabled=this.flow.done||this.running;pause.innerHTML=`${this.paused?'Lancer le balancier':'Mettre en pause'} <kbd>Espace</kbd>`;}
    this.callbacks.candyProgress?.(this.flow.collected.length,this.flow.caught);
  }
  jellyCell(x,y,cell,color,alpha=1){const c=this.ctx;c.save();c.globalAlpha=alpha;this.round(x+2,y+2,cell-4,cell-4,Math.min(13,cell*.22),COLORS[color].hex,'#ffffff70');this.round(x+8,y+7,cell*.45,4,2,'#ffffff60');this.text(COLORS[color].mark,x+cell/2,y+cell/2,cell*.23,'#496353');c.restore();}
  drawJellies(){this.advance();const g=this.jellyGrid(),c=this.ctx,w=this.level.cols*g.cell,h=this.level.rows*g.cell;this.round(g.x-17,g.y-16,w+34,h+33,23,'#d7e1ce','#bbcfb9');this.round(g.x,g.y,w,h,7,'#f0f3e6');
    this.state.field.forEach((id,n)=>{const x=g.x+n%this.level.cols*g.cell,y=g.y+Math.floor(n/this.level.cols)*g.cell;this.round(x+1,y+1,g.cell-2,g.cell-2,7,'#e8eddd','#dce5d1');if(id===-1){this.round(x+3,y+3,g.cell-6,g.cell-6,9,'#a2ad97');this.text('▧',x+g.cell/2,y+g.cell/2,23,'#e4e9d8');}else if(id!==null&&id!==this.motion?.id)this.jellyCell(x,y,g.cell,this.level.pieces[id].color);});
    if(this.selected!==null&&!this.running){const piece=this.level.pieces[this.selected],drop=jellyDrop(this.level,this.state,piece,this.turns,this.cursor);if(drop)for(const [x,y] of drop.cells)this.jellyCell(g.x+(x+this.cursor)*g.cell,g.y+(y+drop.y)*g.cell,g.cell,piece.color,.35);else this.text('CHANGEZ DE COLONNE OU TOURNEZ',320,74,10,'#b4886c');}
    this.line([[g.x-9,g.y-2],[g.x+w+9,g.y-2]],'#ffffff',5);this.text('LA LIGNE DU PETIT POT',320,g.y-30,10,'#859374');
    if(this.motion){c.fillStyle=COLORS[this.level.pieces[this.motion.id].color].hex;c.strokeStyle='#fffaf099';c.lineWidth=2;for(const quad of this.motion.quads){c.beginPath();quad.forEach((id,n)=>{const p=this.motion.nodes[id];n?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.closePath();c.fill();c.stroke();}}
    this.tray().forEach((id,n)=>{const piece=this.level.pieces[id],cells=jellyCells(piece,id===this.selected?this.turns:0),width=Math.max(...cells.map(p=>p[0]))+1,height=Math.max(...cells.map(p=>p[1]))+1,s=Math.min(19,56/width,43/height),x=95+n*90-width*s/2,y=542-height*s/2;this.round(54+n*90,508,82,65,12,id===this.selected?'#e6dfc5':'#edf0e0',id===this.hint?.action?.id?'#ac9454':'#d5ddc8');for(const [xx,yy] of cells)this.round(x+xx*s+1,y+yy*s+1,s-2,s-2,4,COLORS[piece.color].hex);this.text(`${id+1}`,95+n*90,563,9,'#748269');});
    this.text('TOURNER · LAISSER TOMBER · GARDER UN PASSAGE',320,588,9,'#879077');
  }
  draw(){if(!this.level||!this.canvas.width)return;const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);if(this.mode==='ruisseaux')this.drawStreams();else if(this.mode==='balancier')this.drawSwing();else this.drawJellies();}
  dispose(){super.dispose();document.removeEventListener('visibilitychange',this.visibility);}
}
