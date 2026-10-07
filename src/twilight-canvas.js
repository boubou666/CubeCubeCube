import {PocketCanvas} from './pocket-canvas.js';
import {COLORS} from './pocket-core.js';
import {bosquetStatus} from './bosquets-puzzle.js';
import {engravingLines} from './gravures-puzzle.js';
import {vigilTargets} from './veillees-puzzle.js';

const W=640,H=600;
export class TwilightCanvas extends PocketCanvas{
  constructor(container,mode,callbacks){
    super(container,mode,callbacks);this.cursor=0;
    this.canvas.setAttribute('aria-label',mode==='bosquets'?'Bosquets : placez une fleur par ligne, colonne et zone':mode==='gravures'?'Gravures : les indices révèlent un dessin':'Veillées : éteignez les lanternes voisines');
    this.canvas.addEventListener('pointerdown',event=>{
      if(!callbacks.enabled())return;const point=this.point(event),cell=this.at(point);if(cell===null)return;
      this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(event.pointerId);this.cursor=cell;this.press={cell,point};
      if(mode!=='veillees'){const brush=callbacks.fieldValue();this.draft={cells:[cell],value:this.state.field[cell]===brush?0:brush};}this.draw();
    });
    this.canvas.addEventListener('pointermove',event=>{
      const point=this.point(event),cell=this.at(point);this.hover=cell;
      if(this.draft){
        const from=this.lastPoint||this.press.point,distance=Math.hypot(point[0]-from[0],point[1]-from[1]),steps=Math.max(1,Math.ceil(distance/(this.grid().cell*.3)));
        for(let n=1;n<=steps;n++){const id=this.at(from.map((v,k)=>v+(point[k]-v)*n/steps));if(id!==null&&!this.draft.cells.includes(id))this.draft.cells.push(id);}this.lastPoint=point;
      }this.draw();
    });
    this.canvas.addEventListener('pointerup',event=>{
      const press=this.press,draft=this.draft,to=this.at(this.point(event));this.cancelGesture();if(!press||!callbacks.enabled())return;
      if(mode==='veillees'){if(to===press.cell)callbacks.play({cell:to});return;}
      if(draft?.cells.length===1)callbacks.twilightCell(press.cell);
      else if(draft?.cells.length)callbacks.play(mode==='bosquets'?{cells:draft.cells,value:draft.value}:{cells:draft.cells,values:draft.cells.map(()=>draft.value)});
    });
    this.canvas.addEventListener('pointercancel',()=>this.cancelGesture());
    this.canvas.addEventListener('pointerleave',()=>{this.hover=null;});
  }
  cancelGesture(){this.press=null;this.draft=null;this.lastPoint=null;this.draw();}
  point(e){const r=this.canvas.getBoundingClientRect();return[(e.clientX-r.x)/r.width*W,(e.clientY-r.y)/r.height*H];}
  grid(){const n=this.level.size,cell=Math.min(this.mode==='gravures'?57:86,(this.mode==='gravures'?424:478)/n,412/n);return{cell,x:this.mode==='gravures'?154:(W-cell*n)/2,y:this.mode==='gravures'?130:92+(412-cell*n)/2};}
  position(id){const g=this.grid(),n=this.level.size;return[g.x+(id%n+.5)*g.cell,g.y+(Math.floor(id/n)+.5)*g.cell];}
  at(p){if(!this.level)return null;const g=this.grid(),x=Math.floor((p[0]-g.x)/g.cell),y=Math.floor((p[1]-g.y)/g.cell);return x>=0&&y>=0&&x<this.level.size&&y<this.level.size?y*this.level.size+x:null;}
  screenPoint(id){const p=this.position(id),r=this.canvas.getBoundingClientRect();return{x:r.x+p[0]/W*r.width,y:r.y+p[1]/H*r.height};}
  get running(){return Boolean(this.motion&&performance.now()-this.motion.start<this.motion.duration);}
  update(level,state,hint,selected,previous,action){
    const changed=level!==this.level||state!==this.state;if(level!==this.level)this.cursor=0;
    this.level=level;this.state=state;this.hint=hint;this.selected=selected;
    if(changed){this.press=null;this.draft=null;this.lastPoint=null;this.hover=null;this.motion=previous&&action&&!this.reduced?{previous,action,start:performance.now(),duration:240}:null;}this.draw();
  }
  rounded(x,y,w,h,r,fill,stroke){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.4;c.stroke();}}
  text(text,x,y,color='#7d9073',size=11){const c=this.ctx;c.fillStyle=color;c.font=`${size}px 'Segoe UI',sans-serif`;c.textAlign='center';c.fillText(text,x,y);}
  flower(x,y,size,color='#fffaf0'){
    const c=this.ctx;c.fillStyle=color;for(let n=0;n<5;n++){const a=n*Math.PI*2/5-Math.PI/2;c.beginPath();c.ellipse(x+Math.cos(a)*size*.45,y+Math.sin(a)*size*.45,size*.27,size*.4,a-Math.PI/2,0,Math.PI*2);c.fill();}c.fillStyle='#dfbd72';c.beginPath();c.arc(x,y,size*.24,0,Math.PI*2);c.fill();
  }
  cross(x,y,size,color='#a4b398'){const c=this.ctx;c.strokeStyle=color;c.lineWidth=1.8;c.lineCap='round';c.beginPath();c.moveTo(x-size,y-size);c.lineTo(x+size,y+size);c.moveTo(x-size,y+size);c.lineTo(x+size,y-size);c.stroke();}
  fieldValue(id){return this.draft?.cells.includes(id)?this.draft.value:this.state.field[id];}
  fields(t){
    const c=this.ctx,l=this.level,n=l.size,g=this.grid(),bosquets=this.mode==='bosquets',status=bosquets?bosquetStatus(l,this.state):null,lines=bosquets?null:engravingLines(l,this.state);
    for(let id=0;id<n*n;id++){
      const [x,y]=this.position(id),value=this.fieldValue(id),conflict=bosquets&&status.conflicts.includes(id),fresh=this.motion?.action.cells.includes(id),scale=fresh ? .7+.3*Math.sin(t*Math.PI/2) : 1;
      this.rounded(x-g.cell/2+1,y-g.cell/2+1,g.cell-2,g.cell-2,5,bosquets?COLORS[l.regions[id]].hex+'42':'#f9f5e6',conflict?'#c88874':bosquets?'#d3dcc1':'#d6dec7');
      if(value===1){c.save();c.translate(x,y);c.scale(scale,scale);if(bosquets){c.fillStyle=COLORS[l.regions[id]].hex;c.beginPath();c.arc(0,0,g.cell*.32,0,Math.PI*2);c.fill();this.flower(0,0,g.cell*.32);}else{this.rounded(-g.cell*.37,-g.cell*.37,g.cell*.74,g.cell*.74,4,'#7a9e83');c.fillStyle='#c5d6b3';c.beginPath();c.ellipse(-g.cell*.1,-g.cell*.12,g.cell*.065,g.cell*.14,-.6,0,Math.PI*2);c.fill();}c.restore();}
      if(value===2)this.cross(x,y,g.cell*.1);
      if(this.hint?.action?.cells.includes(id)){c.strokeStyle='#b6a061';c.lineWidth=3;c.strokeRect(x-g.cell*.39,y-g.cell*.39,g.cell*.78,g.cell*.78);}
    }
    if(bosquets){
      c.strokeStyle='#66846988';c.lineWidth=2.5;c.lineCap='round';for(let id=0;id<n*n;id++){const [x,y]=this.position(id);if(id%n<n-1&&l.regions[id]!==l.regions[id+1]){c.beginPath();c.moveTo(x+g.cell/2,y-g.cell/2);c.lineTo(x+g.cell/2,y+g.cell/2);c.stroke();}if(id<n*(n-1)&&l.regions[id]!==l.regions[id+n]){c.beginPath();c.moveTo(x-g.cell/2,y+g.cell/2);c.lineTo(x+g.cell/2,y+g.cell/2);c.stroke();}}
      this.text(`${status.valid.length} FLEURS À LEUR PLACE${status.conflicts.length?' · DES VOISINES SE GÊNENT':''}`,320,548,'#819573',10);
    }else{
      for(let y=0;y<n;y++){const [,at]=this.position(y*n);this.text(l.rows[y].join('  '),g.x-48,at+4,lines[0][y]==='conflict'?'#bb806f':lines[0][y]==='complete'?'#9bab8e':'#577861',Math.min(15,g.cell*.29));}
      for(let x=0;x<n;x++){const [at]=this.position(x);l.columns[x].forEach((v,k)=>this.text(v,at,g.y-14-(l.columns[x].length-1-k)*17,lines[1][x]==='conflict'?'#bb806f':lines[1][x]==='complete'?'#9bab8e':'#577861',Math.min(15,g.cell*.29)));}
      this.text(this.callbacks.won?.()?'UNE PETITE IMAGE AU BOUT DES LIGNES':'LES NOMBRES COMPTENT DES GROUPES · UNE CROIX LAISSE DU BLANC',320,570,'#819573',9);
    }
    const [x,y]=this.position(this.cursor);c.strokeStyle='#5a795d88';c.lineWidth=1.5;c.setLineDash([3,4]);c.strokeRect(x-g.cell*.43,y-g.cell*.43,g.cell*.86,g.cell*.86);c.setLineDash([]);
  }
  lantern(x,y,cell,lit,amount){
    const c=this.ctx,w=cell*.45,h=cell*.57;
    if(amount){c.save();c.globalAlpha=amount*.5;const glow=c.createRadialGradient(x,y,0,x,y,cell*.58);glow.addColorStop(0,'#e2c26e');glow.addColorStop(1,'#e2c26e00');c.fillStyle=glow;c.beginPath();c.arc(x,y,cell*.58,0,Math.PI*2);c.fill();c.restore();}
    this.rounded(x-w/2,y-h/2,w,h,5,lit?'#f2db99':'#566f60',lit?'#baa574':'#87a387');
    c.strokeStyle=lit?'#b19b64':'#87a387';c.lineWidth=2;c.beginPath();c.arc(x,y-h*.6,w*.22,Math.PI,0);c.stroke();c.beginPath();c.moveTo(x-w*.63,y-h*.53);c.lineTo(x+w*.63,y-h*.53);c.moveTo(x-w*.55,y+h*.57);c.lineTo(x+w*.55,y+h*.57);c.stroke();
    c.fillStyle=lit?'#fff7ce':'#91ab8d';c.beginPath();c.ellipse(x,y+h*.08,w*.13,h*.2,0,0,Math.PI*2);c.fill();
  }
  vigils(t){
    const c=this.ctx,l=this.level,g=this.grid(),preview=vigilTargets(l,this.hover??this.cursor),hint=this.hint?.action?.cell;
    for(let id=0;id<l.size**2;id++){
      const [x,y]=this.position(id);this.rounded(x-g.cell/2+2,y-g.cell/2+2,g.cell-4,g.cell-4,10,'#496253','#78927466');
      const lit=this.state.lit[id],old=this.motion?.previous.lit[id]??lit,amount=this.motion?Number(old)+(Number(lit)-Number(old))*t:Number(lit);this.lantern(x,y,g.cell,lit,amount);
      if(preview.includes(id)){c.strokeStyle='#b6cc9c77';c.lineWidth=1.5;c.setLineDash([4,4]);c.strokeRect(x-g.cell*.42,y-g.cell*.42,g.cell*.84,g.cell*.84);c.setLineDash([]);}
      if(hint===id){c.strokeStyle='#e4c67c';c.lineWidth=3;c.strokeRect(x-g.cell*.4,y-g.cell*.4,g.cell*.8,g.cell*.8);}
    }
    this.text(`${l.pattern==='diagonal'?'LA LANTERNE ET SES QUATRE DIAGONALES':'LA LANTERNE ET SES QUATRE VOISINES'}${l.wrap?' · LES BORDS SE REJOIGNENT':''}`,320,546,'#b9cba5',9);
    if(l.wrap){const left=g.x-10,right=g.x+l.size*g.cell+10,top=g.y-10,bottom=g.y+l.size*g.cell+10;c.strokeStyle='#b9ca9b';c.lineWidth=1.5;c.setLineDash([4,7]);c.strokeRect(left,top,right-left,bottom-top);c.setLineDash([]);}
  }
  draw(){
    if(!this.level||!this.canvas.width)return;const t=this.motion?Math.min(1,(performance.now()-this.motion.start)/this.motion.duration):1;
    if(this.motion&&t>=1){this.motion=null;this.callbacks.settled?.();}
    const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);this.rounded(35,54,570,512,27,this.mode==='veillees'?'#3f594a':'#f0f2e2','#d7dfc6');
    if(this.mode==='veillees')this.vigils(t);else this.fields(t);
  }
}
