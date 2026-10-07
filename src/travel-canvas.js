import {PocketCanvas} from './pocket-canvas.js';
import {COLORS,clone} from './pocket-core.js';
import {luggageCells,valisesRules} from './valises-puzzle.js';
import {validBelt} from './sangles-puzzle.js';
import {CargoFlow,CARGO_DT,CARGO_TICKS} from './cargo-simulation.js';
const W=640,H=600;
export class TravelCanvas extends PocketCanvas{
  constructor(container,mode,callbacks){super(container,mode,callbacks);this.turns=0;this.cursor=[0,0];this.canvas.setAttribute('aria-label',mode==='valises'?'Valises : tournez les affaires et faites-les glisser dans la valise':mode==='sangles'?'Sangles : reliez les attaches puis essayez le petit trajet':'Tracés : dessinez les chemins en un seul trait');
    this.canvas.addEventListener('pointerdown',e=>{if(!callbacks.enabled())return;this.cancelled=false;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);const p=this.point(e);this.down=p;
      if(mode==='valises'){const tray=this.level.pieces.find(n=>Math.hypot(p[0]-this.trayPoint(n.id)[0],p[1]-this.trayPoint(n.id)[1])<29);if(tray){callbacks.bagPick(tray.id);this.grab={id:tray.id,offset:[0,0],point:p};return;}const cell=this.bagCell(p),id=cell&&this.state.field[cell[1]*this.level.cols+cell[0]];if(Number.isInteger(id)&&id>=0){const old=this.state.placed[id];callbacks.bagPick(id);this.grab={id,offset:[cell[0]-old.x,cell[1]-old.y],point:p};}else this.pressed=cell;}
      if(mode==='sangles'){const id=this.nearest(p,this.level.posts.map(q=>[q.x,q.y]));if(id!==null)this.rope=[id];}
      if(mode==='traces'){const id=this.nearest(p,this.level.nodes.map(n=>this.nodePoint(n.id)));if(id!==null&&(!this.state.path.length||id===this.state.path.at(-1)))this.stroke=[id];else this.pressed=id;}
    });
    this.canvas.addEventListener('pointermove',e=>{if(!callbacks.enabled())return;const p=this.point(e);if(this.mode==='valises'){const cell=this.bagCell(p);if(cell)this.cursor=cell;if(this.grab)this.grab.point=p;}
      if(this.rope){const id=this.nearest(p,this.level.posts.map(q=>[q.x,q.y]));if(id!==null&&!this.rope.includes(id)&&this.rope.length<4)this.rope.push(id);}
      if(this.stroke){const id=this.nearest(p,this.level.nodes.map(n=>this.nodePoint(n.id)));if(id!==null&&id!==this.stroke.at(-1)&&this.canTrace([...this.stroke,id]))this.stroke.push(id);}
    });
    this.canvas.addEventListener('pointerup',e=>{const p=this.point(e),grab=this.grab,rope=this.rope,stroke=this.stroke,pressed=this.pressed;this.grab=null;this.rope=null;this.stroke=null;this.pressed=null;if(this.cancelled||!callbacks.enabled())return;
      if(mode==='valises'){if(grab){const cell=this.bagCell(p);if(cell&&Math.hypot(p[0]-this.down[0],p[1]-this.down[1])>6)callbacks.bagPlace(cell[0]-grab.offset[0],cell[1]-grab.offset[1]);}else{const cell=this.bagCell(p);if(cell&&pressed&&cell.join()===pressed.join())callbacks.bagPlace(...cell);}}
      if(mode==='sangles'&&rope){if(rope.length>=2)callbacks.play({type:'belt',id:this.selected?.id??0,path:rope});else callbacks.strapPost(rope[0]);}
      if(mode==='traces'){if(stroke?.length>=2)callbacks.play({path:stroke});else{const id=this.nearest(p,this.level.nodes.map(n=>this.nodePoint(n.id)));if(id!==null)callbacks.traceNode(id);}}
    });
    this.canvas.addEventListener('pointercancel',()=>{this.cancelled=true;this.grab=null;this.rope=null;this.stroke=null;this.pressed=null;});document.addEventListener('visibilitychange',this.visibility=()=>{this.last=performance.now();});
  }
  point(e){const r=this.canvas.getBoundingClientRect();return[(e.clientX-r.x)/r.width*W,(e.clientY-r.y)/r.height*H];}
  worldScreen(p){const r=this.canvas.getBoundingClientRect();return{x:r.x+p[0]/W*r.width,y:r.y+p[1]/H*r.height};}
  grid(){const cell=Math.min(67,436/this.level.cols,340/this.level.rows);return {cell,x:(W-cell*this.level.cols)/2,y:70+(340-cell*this.level.rows)/2};}
  bagCell(p){const g=this.grid(),x=Math.floor((p[0]-g.x)/g.cell),y=Math.floor((p[1]-g.y)/g.cell);return x>=0&&y>=0&&x<this.level.cols&&y<this.level.rows?[x,y]:null;}
  trayPoint(id){const cols=Math.max(5,Math.ceil(this.level.pieces.length/2)),slot=this.level.order.indexOf(id),step=520/cols;return[60+(slot%cols+.5)*step,480+Math.floor(slot/cols)*70];}
  nodePoint(id){const n=this.level.nodes[id],step=Math.min(88,440/(this.level.cols-1),335/(this.level.rows-1));return[320+(n.x-(this.level.cols-1)/2)*step,105+n.y*step];}
  screenPoint(value){if(this.mode==='valises'){const g=this.grid();return this.worldScreen([g.x+(value[0]+.5)*g.cell,g.y+(value[1]+.5)*g.cell]);}if(this.mode==='sangles'){const p=this.level.posts[value];return this.worldScreen([p.x,p.y]);}return this.worldScreen(this.nodePoint(value));}
  bagScreenPoints(a){return[this.worldScreen(this.trayPoint(a.id)),this.screenPoint([a.x,a.y])];}
  nearest(p,points){let best=null,d=28;points.forEach((q,id)=>{const distance=Math.hypot(p[0]-q[0],p[1]-q[1]);if(distance<d){d=distance;best=id;}});return best;}
  canTrace(path){return Boolean(this.callbacks.traceMove?.(path));}
  update(level,state,hint,selected,previous,action){const changed=level!==this.level||state!==this.state,levelChanged=level!==this.level,oldSelected=this.selected;this.level=level;this.state=state;this.hint=hint;this.selected=selected;
    if(levelChanged){this.turns=0;this.cursor=[0,0];}if(this.mode==='valises'&&selected!==null&&(selected!==oldSelected||hint?.action?.id===selected))this.turns=hint?.action?.type==='place'&&hint.action.id===selected?hint.action.turns:state.placed[selected]?.turns??0;
    if(changed){this.grab=null;this.rope=null;this.stroke=null;this.pressed=null;this.motion=null;this.flow=null;this.running=false;this.last=performance.now();this.carry=0;
      if(previous&&action&&!this.reduced&&this.mode!=='sangles')this.motion={previous,action,start:performance.now()};
      if(this.mode==='sangles'&&action?.type==='run'&&!this.reduced){this.flow=new CargoFlow(level,state);this.running=true;}
    }this.draw();
  }
  line(points,color,width=2,dash=[]){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.lineCap=c.lineJoin='round';c.setLineDash(dash);c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();c.setLineDash([]);}
  icon(kind,x,y,r,color){const c=this.ctx;c.save();c.translate(x,y);c.scale(r/22,r/22);c.strokeStyle='#4d695976';c.lineWidth=1.8;
    if(kind%8===0){this.round(-16,-11,32,28,7,color,'#4d695976');this.round(-8,-21,16,16,6,null,'#4d695976');this.line([[-11,-1],[11,-1]],'#fff4d977',2);this.round(-2,2,4,8,2,'#fff2d5');}
    else if(kind%8===1){this.round(-13,-16,26,31,5,color,'#4d695976');this.round(-19,10,38,7,4,color);this.line([[-12,4],[12,4]],'#fff5df',3);}
    else if(kind%8===2){this.round(-19,-10,38,25,6,color,'#4d695976');this.round(-12,-17,12,9,3,color);c.beginPath();c.arc(4,2,9,0,Math.PI*2);c.fillStyle='#fff3d8';c.fill();c.stroke();c.beginPath();c.arc(4,2,4,0,Math.PI*2);c.fillStyle='#799c95';c.fill();}
    else if(kind%8===3){this.round(-17,-18,34,36,4,color,'#4d695976');this.line([[-11,-16],[-11,16]],'#fff3d4',2);this.line([[-5,-8],[11,-8]],'#fff3d4',2);this.line([[-5,-2],[7,-2]],'#fff3d4',2);}
    else if(kind%8===4){c.beginPath();c.ellipse(0,6,20,10,0,0,Math.PI*2);c.fillStyle=color;c.fill();c.stroke();this.round(-11,-18,22,25,7,color,'#4d695976');this.line([[-10,1],[10,1]],'#fff5db',3);}
    else if(kind%8===5){this.round(-19,-8,38,22,10,color,'#4d695976');this.line([[-10,-7],[-7,-12],[-2,-7],[3,-12],[7,-7]],'#fff4dc',2);this.line([[-13,9],[15,9]],'#fff4dc',3);}
    else if(kind%8===6){this.round(-11,-18,22,37,7,color,'#4d695976');this.round(-6,-24,12,9,2,'#c5b48c');this.line([[-7,-2],[7,-2]],'#fff3d4',3);this.line([[-7,4],[7,4]],'#fff3d4',3);}
    else{c.beginPath();c.arc(0,0,19,0,Math.PI*2);c.fillStyle=color;c.fill();c.stroke();this.line([[-15,-8],[15,8]],'#fff3d4',2);this.line([[-8,15],[8,-15]],'#fff3d4',2);}
    c.restore();
  }
  luggagePiece(p,a,alpha=1){const g=this.grid(),cells=luggageCells(p,a.turns),set=new Set(cells.map(q=>q.join())),c=this.ctx;c.save();c.globalAlpha=alpha;c.fillStyle=COLORS[p.color].hex;c.beginPath();for(const [x,y] of cells)c.rect(g.x+(x+a.x)*g.cell,g.y+(y+a.y)*g.cell,g.cell,g.cell);c.fill();c.clip();c.strokeStyle='#fff6df55';c.lineWidth=2;for(let y=g.y;y<g.y+this.level.rows*g.cell;y+=12){c.beginPath();c.moveTo(g.x,y);c.lineTo(g.x+this.level.cols*g.cell,y);c.stroke();}c.restore();
    c.save();c.globalAlpha=alpha;for(const [x,y] of cells){const px=g.x+(x+a.x)*g.cell,py=g.y+(y+a.y)*g.cell;for(const [dx,dy,edge] of [[0,-1,[[px,py],[px+g.cell,py]]],[0,1,[[px,py+g.cell],[px+g.cell,py+g.cell]]],[-1,0,[[px,py],[px,py+g.cell]]],[1,0,[[px+g.cell,py],[px+g.cell,py+g.cell]]]])if(!set.has([x+dx,y+dy].join()))this.line(edge,'#526b5580',2);}
    const avg=cells.reduce((sum,p)=>[sum[0]+p[0]/cells.length,sum[1]+p[1]/cells.length],[0,0]),middle=[...cells].sort((a,b)=>Math.hypot(a[0]-avg[0],a[1]-avg[1])-Math.hypot(b[0]-avg[0],b[1]-avg[1]))[0];this.icon(p.icon,g.x+(a.x+middle[0]+.5)*g.cell,g.y+(a.y+middle[1]+.5)*g.cell,Math.min(22,g.cell*.38),COLORS[p.color].hex);c.restore();
  }
  miniature(p,x,y){const cells=luggageCells(p),w=Math.max(...cells.map(q=>q[0]))+1,h=Math.max(...cells.map(q=>q[1]))+1,step=Math.min(35/w,35/h);for(const [a,b] of cells)this.round(x+(a-w/2)*step,y+(b-h/2)*step,step,step,1,COLORS[p.color].hex,'#fff4dd99');this.icon(p.icon,x,y,9,'#f7ead0');}
  drawBags(){const g=this.grid(),w=g.cell*this.level.cols,h=g.cell*this.level.rows,c=this.ctx;this.round(278,g.y-50,84,37,11,null,'#b8ac8e');this.round(g.x-24,g.y-18,w+48,h+36,24,'#dbc9a4','#bbaa85');this.round(g.x-14,g.y-9,w+28,h+18,15,'#faf1d8','#bcba96');
    for(let y=0;y<this.level.rows;y++)for(let x=0;x<this.level.cols;x++){const id=y*this.level.cols+x;this.round(g.x+x*g.cell,g.y+y*g.cell,g.cell,g.cell,2,this.level.mask[id]?'#f3efd9':'#c3c6ac','#d6d4b755');if(!this.level.mask[id])this.text('✦',g.x+(x+.5)*g.cell,g.y+(y+.5)*g.cell,15,'#9aa586');}
    const motion=this.motion?.action?.id!==undefined?this.motion:null,mt=motion?Math.min(1,(performance.now()-motion.start)/220):1;for(const p of this.level.pieces)if(this.state.placed[p.id]&&!(mt<1&&motion.action.id===p.id))this.luggagePiece(p,this.state.placed[p.id]);
    if(mt<1){const id=motion.action.id,p=this.level.pieces[id],placed=this.state.placed[id],old=motion.previous.placed[id],pose=placed??old;if(pose){const center=a=>{const cells=luggageCells(p,a.turns);return cells.reduce((v,q)=>[v[0]+(g.x+(a.x+q[0]+.5)*g.cell)/cells.length,v[1]+(g.y+(a.y+q[1]+.5)*g.cell)/cells.length],[0,0]);},to=placed?center(placed):this.trayPoint(id),from=old?center(old):this.trayPoint(id),anchor=center(pose),ease=1-(1-mt)**3,scale=placed?.18+.82*ease:1-.82*ease;c.save();c.translate(from[0]+(to[0]-from[0])*ease,from[1]+(to[1]-from[1])*ease);c.scale(scale,scale);c.translate(-anchor[0],-anchor[1]);this.luggagePiece(p,pose);c.restore();}}
    const hinted=this.hint?.action;if(hinted?.type==='place')this.luggagePiece(this.level.pieces[hinted.id],hinted,.38);
    if(this.selected!==null&&Number.isInteger(this.selected)){let cursor=this.cursor;if(this.grab){const at=this.bagCell(this.grab.point);if(at)cursor=[at[0]-this.grab.offset[0],at[1]-this.grab.offset[1]];}const a={type:'place',id:this.selected,turns:this.turns,x:cursor[0],y:cursor[1]};this.luggagePiece(this.level.pieces[this.selected],a,.34);const valid=valisesRules.move(this.level,this.state,a);const p=[g.x+(cursor[0]+.5)*g.cell,g.y+(cursor[1]+.5)*g.cell];this.text(valid?'＋':'×',...p,21,valid?'#617f5d':'#bb7c65');}
    this.text('CHOISISSEZ UNE AFFAIRE · TOURNEZ · RANGEZ',320,449,9,'#8b947a');for(const p of this.level.pieces){const [x,y]=this.trayPoint(p.id),placed=this.state.placed[p.id],active=this.selected===p.id;this.round(x-24,y-26,48,51,10,active?'#e9e3c9':'#eff0df',active?'#a99d62':'#d7dec8');c.save();c.globalAlpha=placed ? .45 : 1;this.miniature(p,x,y-2);c.restore();this.text(placed?'✓':`${p.id+1}`,x,y+23,9,'#748568');}
  }
  advance(){if(!this.running)return;const now=performance.now(),elapsed=Math.min(.05,(now-this.last)/1000);this.last=now;if(document.querySelector('dialog[open]'))return;this.carry+=elapsed/CARGO_DT;while(this.carry>=1&&!this.flow.done){this.flow.step();this.carry--;}this.callbacks.cargoProgress?.(this.flow.tick/CARGO_TICKS,this.flow.done);if(this.flow.done){this.running=false;queueMicrotask(()=>this.callbacks.settled?.());}}
  drawStraps(){this.advance();const c=this.ctx,l=this.level,t=this.flow?.tick??0;this.round(63,25,514,551,29,'#e4ead7','#d1d9c2');for(let y=30;y<580;y+=48)this.line([[63,y+(t%48)],[78,y+(t%48)]],'#c6cfb7',3);this.round(83,40,474,46,14,'#8aa98f');this.round(165,44,310,25,10,'#c8ddd2');this.round(79,88,482,443,12,'#e1d4ac','#baa982');
    for(let y=104;y<l.bottom;y+=24)this.line([[90,y],[550,y]],'#cbbd9866',1);for(const wall of l.walls)this.line([wall.a,wall.b],'#9fac8b',9);
    const parcels=this.flow?.parcels??this.state.result?.parcels??l.parcels;for(const p of parcels){if(p.lost)continue;this.round(p.x-p.r+3,p.y-p.r+5,p.r*2,p.r*2,p.r,'#77896b22');this.icon(p.kind===0?0:p.kind===1?6:7,p.x,p.y,p.r,COLORS[p.color].hex);}
    const broken=this.flow?.broken??this.state.result?.broken??[];for(let id=0;id<this.state.routes.length;id++){const path=this.state.routes[id],points=path.map(n=>[l.posts[n].x,l.posts[n].y]);if(points.length<2)continue;this.line(points,broken[id]?'#c7aa8266':COLORS[l.belts[id].color].hex,9,broken[id]?[11,10]:[]);this.line(points,'#fff1d69a',1.5,[4,4]);if(broken[id])this.text('×',...(points[0].map((v,n)=>(v+points.at(-1)[n])/2)),24,'#b36e59');}
    const path=this.rope??this.selected?.path??this.hint?.action?.path,slot=this.selected?.id??this.hint?.action?.id??0;if(path?.length>=2)this.line(path.map(n=>[l.posts[n].x,l.posts[n].y]),validBelt(l,slot,path)?'#ab9659':'#c28367',5,[6,4]);
    for(const p of l.posts){this.round(p.x-10,p.y-10,20,20,10,p.peg?'#c9b381':'#faf3db','#899875');this.text(`${p.id+1}`,p.x,p.y,10,'#617454');}
    this.text(this.running?'UN VIRAGE, UN FREINAGE… LES COLIS VOYAGENT.':'RELIEZ LES ATTACHES · PUIS ESSAYEZ LE PETIT TOUR',320,563,9,'#7d896f');
  }
  drawTraces(){const c=this.ctx,l=this.level;this.round(51,62,538,444,27,'#f2f0df','#d7dbc8');const motion=this.motion?.action?.path?this.motion:null,mt=motion?Math.min(1,(performance.now()-motion.start)/120):1,used=[...(mt<1?motion.previous.used:this.state.used)],draft=this.stroke??(Array.isArray(this.selected)?this.selected:null);if(mt<1){const path=motion.action.path,n=Math.floor(mt*(path.length-1));for(let i=1;i<=n;i++){const id=l.edges.findIndex(e=>e.a===path[i-1]&&e.b===path[i]||e.a===path[i]&&e.b===path[i-1]);if(id>=0)used[id]++;}}if(draft?.length>=2)for(let n=1;n<draft.length;n++){const id=l.edges.findIndex(e=>e.a===draft[n-1]&&e.b===draft[n]||e.a===draft[n]&&e.b===draft[n-1]);if(id>=0)used[id]++;}
    for(let id=0;id<l.edges.length;id++){const e=l.edges[id],a=this.nodePoint(e.a),b=this.nodePoint(e.b),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;for(let n=0;n<e.count;n++){const offset=e.count===2?(n-.5)*8:0,points=[[a[0]+nx*offset,a[1]+ny*offset],[b[0]+nx*offset,b[1]+ny*offset]];this.line(points,n<used[id]?'#7d9c85':'#ccd3bd',n<used[id]?5:3);}
      if(e.dir!==null){const direction=e.dir===e.a?1:-1,m=[(a[0]+b[0])/2,(a[1]+b[1])/2],vx=dx/length*direction,vy=dy/length*direction;this.line([[m[0]-vx*7+nx*5,m[1]-vy*7+ny*5],m,[m[0]-vx*7-nx*5,m[1]-vy*7-ny*5]],'#9b9d70',2);}
      const hint=this.hint?.action?.path;if(hint&&((hint[0]===e.a&&hint[1]===e.b)||(hint[0]===e.b&&hint[1]===e.a)))this.line([a,b],'#b7a360',5,[7,5]);
    }
    if(mt<1){const path=motion.action.path,n=mt*(path.length-1),id=Math.floor(n),from=this.nodePoint(path[id]),to=this.nodePoint(path[id+1]),t=n-id;this.line([from,[from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t]],'#7d9c85',5);}
    const active=new Set(l.edges.flatMap(e=>[e.a,e.b])),head=draft?.at(-1)??this.state.path.at(-1);for(const id of active){const [x,y]=this.nodePoint(id);this.round(x-12,y-12,24,24,12,id===head?'#dfc77e':'#faf9ed',id===head?'#a69a65':'#acba9e');this.text(`${id+1}`,x,y,9,'#607653');}
    if(head!==undefined){const [x,y]=this.nodePoint(head);this.line([[x+15,y-19],[x+23,y-27]],'#ad9569',6);this.line([[x+12,y-16],[x+15,y-19]],'#65775c',3);}
    this.text('UN TRAIT CONTINU · CHAQUE CHEMIN À SON TOUR',320,538,10,'#829174');this.text('Les doubles chemins attendent deux passages.',320,565,9,'#9aa28a');
  }
  draw(){if(!this.level||!this.canvas.width)return;if(this.motion&&performance.now()-this.motion.start>=220)this.motion=null;const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);if(this.mode==='valises')this.drawBags();else if(this.mode==='sangles')this.drawStraps();else this.drawTraces();}
  dispose(){super.dispose();document.removeEventListener('visibilitychange',this.visibility);}
}
