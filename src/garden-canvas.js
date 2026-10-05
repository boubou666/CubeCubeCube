import { PocketCanvas } from './pocket-canvas.js';
import { COLORS } from './pocket-core.js';
import { topRun } from './alveoles-puzzle.js';
import { pourAmount, settledBottle } from './potions-puzzle.js';
import { liaisonsRules, neighbors, connectedPath } from './liaisons-puzzle.js';

const W=640,H=600;
export class GardenCanvas extends PocketCanvas {
  constructor(container,mode,callbacks) {
    super(container,mode,callbacks);
    this.canvas.setAttribute('aria-label',({alveoles:'Ruche : choisissez une pile puis une alvéole vide',potions:'Fioles : choisissez une source puis une destination',liaisons:'Jardin : tracez entre les points de même couleur, sans croiser les chemins'})[mode]);
    this.canvas.addEventListener('pointerdown',event=>{
      if(!callbacks.enabled())return;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(event.pointerId);const point=this.point(event);
      if(mode==='potions'){const id=this.state.bottles.findIndex((_,id)=>{const p=this.bottlePosition(id);return Math.abs(point.x-p.x)<47&&point.y>p.y-94&&point.y<p.y+76;});if(id>=0)callbacks.bottle(id);}
      if(mode==='alveoles'){
        if(point.y>=486&&point.y<=585){const q=[190,320,450].findIndex(x=>Math.abs(point.x-x)<53);if(q>=0)callbacks.select(q);}
        else {const cell=this.level.cells.findIndex((_,id)=>{const p=this.hexPosition(id);return Math.hypot(point.x-p.x,point.y-p.y)<this.hexSize()*.85;});if(cell>=0)callbacks.hex(cell);}
      }
      if(mode==='liaisons'){
        const cell=this.flowCell(point);if(cell===null)return;
        const color=this.level.pairs.findIndex(p=>p.includes(cell));
        if(color>=0){callbacks.select(color);this.draft={color,path:[cell]};}
        else {const color=this.state.paths.findIndex(p=>p.includes(cell));if(color>=0){callbacks.select(color);const path=this.state.paths[color];this.draft={color,path:path.slice(0,path.indexOf(cell)+1)};}}
      }
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(!this.draft||!callbacks.enabled())return;
      const cell=this.flowCell(this.point(event)),{color,path}=this.draft;
      if(cell===null||cell===path.at(-1))return;
      const previous=path.indexOf(cell);if(previous>=0){this.draft.path=path.slice(0,previous+1);return;}
      const size=this.level.size,last=path.at(-1),sameRow=Math.floor(last/size)===Math.floor(cell/size),sameColumn=last%size===cell%size;
      if(!sameRow&&!sameColumn)return;
      const delta=sameRow?Math.sign(cell-last):Math.sign(cell-last)*size;
      for(let nextCell=last+delta;;nextCell+=delta){const current=this.draft.path;if(connectedPath(this.level,current,color))break;const next=[...current,nextCell];if(!liaisonsRules.move(this.level,this.state,{color,path:next}))break;this.draft.path=next;if(nextCell===cell)break;}
    });
    this.canvas.addEventListener('pointerup',()=>{if(!this.draft)return;const action=this.draft;this.draft=null;if(callbacks.enabled())callbacks.play(action);});
    this.canvas.addEventListener('pointercancel',()=>{this.draft=null;});
  }
  point(event){const r=this.canvas.getBoundingClientRect();return{x:(event.clientX-r.x)/r.width*W,y:(event.clientY-r.y)/r.height*H};}
  hexSize(){return this.level.radius===2?52:39;}
  hexPosition(id){const [q,r]=this.level.cells[id],s=this.hexSize();return{x:320+Math.sqrt(3)*s*(q+r/2),y:261+1.5*s*r};}
  bottlePosition(id){const count=this.state.bottles.length,columns=Math.ceil(count/2),row=Math.floor(id/columns),n=Math.min(columns,count-row*columns);return{x:320+(id%columns-(n-1)/2)*118,y:row?409:197};}
  flowGrid(){return{x:76,y:63,cell:488/this.level.size};}
  flowCell(point){const g=this.flowGrid(),x=Math.floor((point.x-g.x)/g.cell),y=Math.floor((point.y-g.y)/g.cell);return x>=0&&y>=0&&x<this.level.size&&y<this.level.size?y*this.level.size+x:null;}
  flowPosition(id){const g=this.flowGrid();return{x:g.x+(id%this.level.size+.5)*g.cell,y:g.y+(Math.floor(id/this.level.size)+.5)*g.cell};}
  screenPoint(value){let point;if(this.mode==='alveoles')point=value.q!==undefined?{x:[190,320,450][value.q],y:534}:this.hexPosition(value.cell??value);else if(this.mode==='potions')point=this.bottlePosition(value);else point=this.flowPosition(value);const r=this.canvas.getBoundingClientRect();return{x:r.x+point.x/W*r.width,y:r.y+point.y/H*r.height};}
  update(level,state,hint,selected,previous){
    this.level=level;this.state=state;this.hint=hint;this.selected=selected;
    if(!previous){this.motion=null;this.effects=[];this.draft=null;}
    else if(!this.reduced){
      this.motion={previous,start:performance.now()};
      if(this.mode==='potions'){
        const from=state.bottles.findIndex((b,i)=>b.length<previous.bottles[i].length),to=state.bottles.findIndex((b,i)=>b.length>previous.bottles[i].length);
        if(from>=0&&to>=0)this.motion.pour={from,to,color:previous.bottles[from].at(-1)};
      }
      if(this.mode==='alveoles'){
        const target=state.stacks.findIndex((b,i)=>b.length>previous.stacks[i].length),q=state.queues.findIndex((n,i)=>n>previous.queues[i]);
        for(let id=0;id<level.cells.length;id++)if(previous.stacks[id].length>state.stacks[id].length)this.effects.push({id,target,color:previous.stacks[id].at(-1),start:performance.now()});
        if(q>=0)this.effects.push({id:target,target,color:level.queues[q][previous.queues[q]].at(-1),q,start:performance.now(),cleared:state.cleared-previous.cleared});
      }
    }
    this.draw();
  }
  hex(x,y,size,fill,stroke='#ffffff70',squash=1){const c=this.ctx;c.beginPath();for(let n=0;n<6;n++){const angle=Math.PI/3*n-Math.PI/2,px=x+Math.cos(angle)*size,py=y+Math.sin(angle)*size*squash;if(!n)c.moveTo(px,py);else c.lineTo(px,py);}c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
  drawStack(x,y,stack,size){for(let n=0;n<stack.length;n++){this.hex(x,y+7-n*3,size,COLORS[stack[n]].hex,'#ffffff70',.70);}if(stack.length){const color=stack.at(-1);this.text(COLORS[color].mark,x,y+6-(stack.length-1)*3,size*.37,color===7?'#fffaf0':'#244c42');this.text(`${topRun(stack)}`,x,y+19-(stack.length-1)*3,Math.max(9,size*.20),color===7?'#fffaf0':'#34564a');}}
  drawAlveoles(){
    const c=this.ctx,s=this.hexSize(),time=performance.now();
    for(let id=0;id<this.level.cells.length;id++){
      const p=this.hexPosition(id),stack=this.state.stacks[id],hinted=this.hint?.action?.cell===id;
      this.hex(p.x,p.y+7,s-3,'#617b5320',null,.9);this.hex(p.x,p.y,s-4,hinted?'#eadba3':stack.length?'#dfe7d4':'#eef2e4',hinted?'#af9552':'#d3ddc8',.9);
      if(!stack.length)this.text(id+1,p.x,p.y,10,'#9eae94');else this.drawStack(p.x,p.y,stack,s-10);
    }
    for(const fx of this.effects){const t=Math.min(1,(time-fx.start)/380);if(t>=1)continue;c.save();c.globalAlpha=1-t;
      if(fx.q!==undefined){this.text(fx.cleared?`−${fx.cleared} ✧`:'✧',320,220-t*50,29,'#9d8951');}
      else {const from=this.hexPosition(fx.id),to=fx.target>=0?this.hexPosition(fx.target):{x:320,y:220};this.hex(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t-20*Math.sin(t*Math.PI),s*.35,COLORS[fx.color].hex,null,.7);}c.restore();
    }
    for(let q=0;q<3;q++){const x=[190,320,450][q],stack=this.level.queues[q][this.state.queues[q]];this.round(x-53,486,106,97,17,'#e3ead8',this.selected===q||this.hint?.action?.q===q?'#aa9553':'#cbd8bf');if(stack)this.drawStack(x,528,stack,34);else this.text('✓',x,528,27,'#8ca27e');this.text(`FILE ${q+1}`,x,570,9);}
  }
  drawBottle(x,y,bottle,id,tilt=0){const c=this.ctx;c.save();c.translate(x,y-85);c.rotate(tilt);
    this.round(-41,190,82,8,5,'#5d76521c');
    c.beginPath();c.moveTo(-18,0);c.lineTo(-18,24);c.quadraticCurveTo(-41,38,-41,52);c.lineTo(-41,145);c.quadraticCurveTo(-41,158,-29,158);c.lineTo(29,158);c.quadraticCurveTo(41,158,41,145);c.lineTo(41,52);c.quadraticCurveTo(41,38,18,24);c.lineTo(18,0);c.closePath();c.fillStyle='#fcfcf5a8';c.fill();c.strokeStyle='#a2b295';c.lineWidth=2.5;c.stroke();
    bottle.forEach((color,n)=>{this.round(-36,129-n*24,72,23,3,COLORS[color].hex);this.text(COLORS[color].mark,0,141-n*24,14,color===7?'#fffaf0':'#34564a');});
    for(let n=1;n<4;n++){c.strokeStyle='#829b733b';c.lineWidth=1;c.beginPath();c.moveTo(30,154-n*24);c.lineTo(37,154-n*24);c.stroke();}
    c.strokeStyle='#ffffffb0';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(-29,55);c.lineTo(-29,140);c.stroke();this.round(-22,-5,44,8,4,'#c8b28b');
    this.text(id+1,0,166,12,'#829575');if(settledBottle(bottle))this.text('✓',0,37,22,'#8da779');c.restore();
  }
  drawPotions(){
    const c=this.ctx,time=performance.now(),t=this.motion?Math.min(1,(time-this.motion.start)/360):1,pour=this.motion?.pour;
    this.round(58,287,524,9,4,'#d8c7a2');this.round(58,501,524,9,4,'#d8c7a2');
    this.state.bottles.forEach((b,id)=>{const p=this.bottlePosition(id),hinted=this.hint?.action?.from===id||this.hint?.action?.to===id;if(this.selected===id||hinted)this.round(p.x-50,p.y-98,100,190,17,'#e9ddb548','#af9552');else if(this.selected!==null&&pourAmount(this.state,this.selected,id))this.round(p.x-48,p.y-96,96,184,16,'#dce6cf55','#a1b38e');this.drawBottle(p.x,p.y,t<.55?this.motion.previous.bottles[id]:b,id,t<1&&pour?.from===id?Math.sin(t*Math.PI)*.28*(this.bottlePosition(pour.to).x<p.x?-1:1):0);});
    if(t<1&&pour){const a=this.bottlePosition(pour.from),b=this.bottlePosition(pour.to);c.strokeStyle=COLORS[pour.color].hex;c.lineWidth=8;c.lineCap='round';c.globalAlpha=Math.sin(t*Math.PI);c.beginPath();c.moveTo(a.x,a.y-78);c.bezierCurveTo(a.x,a.y-150,b.x,b.y-140,b.x,b.y-80);c.stroke();c.globalAlpha=1;}
    this.text(this.selected===null?'UNE FIOLE À VERSER, PUIS UNE DESTINATION':`FIOLE ${this.selected+1} CHOISIE · CLIQUEZ SA DESTINATION`,320,563,10,'#829575');
  }
  drawLiaisons(){
    const c=this.ctx,g=this.flowGrid(),paths=this.state.paths.map((p,color)=>this.draft?.color===color?this.draft.path:p);
    this.round(g.x-13,g.y-13,514,514,23,'#dce5d0','#cbd8c1');
    for(let cell=0;cell<this.level.size**2;cell++){const p=this.flowPosition(cell);this.round(p.x-g.cell/2+2,p.y-g.cell/2+2,g.cell-4,g.cell-4,8,(cell%this.level.size+Math.floor(cell/this.level.size))%2?'#f2f5e8':'#eaf0df');}
    paths.forEach((path,color)=>{if(!path.length)return;const palette=COLORS[this.level.colors[color]];c.strokeStyle=palette.hex;c.lineWidth=g.cell*.40;c.lineCap=c.lineJoin='round';c.beginPath();path.forEach((cell,n)=>{const p=this.flowPosition(cell);if(!n)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);});c.stroke();if(path.length===1){const p=this.flowPosition(path[0]);c.fillStyle=palette.hex;c.beginPath();c.arc(p.x,p.y,g.cell*.2,0,7);c.fill();}c.strokeStyle='#fff8';c.lineWidth=2;c.beginPath();path.forEach((cell,n)=>{const p=this.flowPosition(cell);if(!n)c.moveTo(p.x,p.y-2);else c.lineTo(p.x,p.y-2);});c.stroke();});
    this.level.pairs.forEach((pair,color)=>{const palette=COLORS[this.level.colors[color]];for(const cell of pair){const p=this.flowPosition(cell);c.fillStyle='#56765120';c.beginPath();c.arc(p.x,p.y+3,g.cell*.32,0,7);c.fill();c.fillStyle=palette.hex;c.beginPath();c.arc(p.x,p.y,g.cell*.30,0,7);c.fill();c.strokeStyle='#fffc';c.lineWidth=2;c.stroke();this.text(palette.mark,p.x,p.y,g.cell*.27,this.level.colors[color]===7?'#fffaf0':'#34564a');if(this.selected===color||this.hint?.action?.color===color){c.strokeStyle=this.hint?.action?.color===color?'#af9552':'#789478';c.lineWidth=2;c.setLineDash([4,3]);c.beginPath();c.arc(p.x,p.y,g.cell*.39,0,7);c.stroke();c.setLineDash([]);}}});
    const hint=this.hint?.action;if(hint?.path.length){c.strokeStyle='#b49a55';c.lineWidth=3;c.setLineDash([5,5]);c.beginPath();hint.path.forEach((cell,n)=>{const p=this.flowPosition(cell);if(!n)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);});c.stroke();c.setLineDash([]);}
    this.text(`${paths.filter((p,color)=>connectedPath(this.level,p,color)).length} / ${this.level.pairs.length} LIENS · TOUTES LES CASES COMPTENT`,320,580,10,'#829575');
  }
  draw(){if(!this.level||!this.canvas.width)return;const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);this.effects=this.effects.filter(f=>performance.now()-f.start<450);if(this.mode==='alveoles')this.drawAlveoles();else if(this.mode==='potions')this.drawPotions();else this.drawLiaisons();}
}
