import {PocketCanvas} from './pocket-canvas.js';
import {COLORS} from './pocket-core.js';
import {chainNeighbors} from './recolte-puzzle.js';
import {activePieces,pieceWidth,pieceHeight,mosaicCells} from './mosaique-puzzle.js';
const W=640,H=600;
export class BountyCanvas extends PocketCanvas{
  constructor(container,mode,callbacks){
    super(container,mode,callbacks);this.canvas.setAttribute('aria-label',({recolte:'Jardin : tracez une chaîne de trois billes ou plus',dizaines:'Tuiles de bois : choisissez deux nombres identiques ou dont la somme vaut dix',mosaique:'Tableau : faites glisser une pièce dans les cases libres'})[mode]);
    this.canvas.addEventListener('pointerdown',event=>{
      if(!callbacks.enabled()||!event.isPrimary)return;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(event.pointerId);const p=this.point(event),id=this.boardCell(p);
      if(mode==='recolte'&&id!==null&&this.state.field[id]!==null)this.draft=[id];
      if(mode==='dizaines'&&id!==null)callbacks.number(id);
      if(mode==='mosaique'){
        if(p.y>512){const pieces=activePieces(this.level,this.state),n=[190,320,450].findIndex(x=>Math.abs(p.x-x)<55),piece=pieces[n];if(!piece)return;callbacks.select(piece.id);const t=this.trayPoint(piece,n),dx=Math.floor((p.x-t.x)/22),dy=Math.floor((p.y-t.y)/22),offset=piece.cells.find(([x,y])=>x===dx&&y===dy)??piece.cells[0];this.grab={id:piece.id,offset};}
        else if(id!==null&&this.selected!==null)callbacks.mosaic(id);
      }
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(!callbacks.enabled())return;const p=this.point(event),id=this.boardCell(p);
      if(this.draft&&id!==null){const path=this.draft,last=path.at(-1);if(last===id)return;const previous=path.indexOf(id);if(previous>=0){this.draft=path.slice(0,previous+1);return;}
        const size=this.level.size,dx=id%size-last%size,dy=Math.floor(id/size)-Math.floor(last/size),n=Math.max(Math.abs(dx),Math.abs(dy));if(dx&&dy&&Math.abs(dx)!==Math.abs(dy))return;
        for(let step=1;step<=n;step++){const cell=(Math.floor(last/size)+Math.sign(dy)*step)*size+last%size+Math.sign(dx)*step;if(this.state.field[cell]!==this.state.field[path[0]]||this.draft.includes(cell)||!chainNeighbors(this.level,this.draft.at(-1),cell))break;this.draft.push(cell);}
      }
      if(mode==='mosaique'&&id!==null){const offset=this.grab?.offset??[0,0];this.cursor={x:id%this.level.size-offset[0],y:Math.floor(id/this.level.size)-offset[1]};}
    });
    this.canvas.addEventListener('pointerup',event=>{
      if(!callbacks.enabled()){this.draft=null;this.grab=null;return;}
      if(this.draft){const path=this.draft;this.draft=null;callbacks.play({path});}
      if(this.grab){const grab=this.grab,p=this.point(event),id=this.boardCell(p);this.grab=null;if(id!==null)callbacks.play({id:grab.id,x:id%this.level.size-grab.offset[0],y:Math.floor(id/this.level.size)-grab.offset[1]});}
    });
    this.canvas.addEventListener('pointercancel',()=>{this.draft=null;this.grab=null;});
  }
  point(event){const r=this.canvas.getBoundingClientRect();return{x:(event.clientX-r.x)/r.width*W,y:(event.clientY-r.y)/r.height*H};}
  boardGrid(){const cols=this.level.cols??this.level.size,rows=this.level.rows??this.level.size,cell=Math.min((this.mode==='mosaique'?440:480)/cols,(this.mode==='mosaique'?440:470)/rows);return{x:(W-cols*cell)/2,y:this.mode==='mosaique'?59:65,cell,cols,rows};}
  boardCell(p){const g=this.boardGrid(),x=Math.floor((p.x-g.x)/g.cell),y=Math.floor((p.y-g.y)/g.cell);return x>=0&&y>=0&&x<g.cols&&y<g.rows?y*g.cols+x:null;}
  boardPoint(id){const g=this.boardGrid();return{x:g.x+(id%g.cols+.5)*g.cell,y:g.y+(Math.floor(id/g.cols)+.5)*g.cell};}
  trayPoint(piece,n){return{x:[190,320,450][n]-pieceWidth(piece)*22/2,y:544-pieceHeight(piece)*22/2};}
  screenPoint(value){let p;if(value?.piece!==undefined){const pieces=activePieces(this.level,this.state),n=pieces.findIndex(p=>p.id===value.piece),piece=pieces[n],t=this.trayPoint(piece,n);p={x:t.x+(piece.cells[0][0]+.5)*22,y:t.y+(piece.cells[0][1]+.5)*22};}else p=this.boardPoint(value);const r=this.canvas.getBoundingClientRect();return{x:r.x+p.x/W*r.width,y:r.y+p.y/H*r.height};}
  update(level,state,hint,selected,previous,action){
    const changed=level!==this.level||state!==this.state;this.level=level;this.state=state;this.hint=hint;this.selected=selected;if(changed){this.draft=null;this.grab=null;this.cursor=null;this.motion=previous&&!this.reduced?{previous,action,start:performance.now()}:null;}this.draw();
  }
  berry(id,color,p,scale=1){const c=this.ctx,g=this.boardGrid(),r=g.cell*.30*scale;c.save();c.fillStyle='#5c794b18';c.beginPath();c.ellipse(p.x+2,p.y+r*.5,r,r*.45,0,0,7);c.fill();c.fillStyle=COLORS[color].hex;c.beginPath();c.arc(p.x,p.y,r,0,7);c.fill();c.fillStyle='#ffffff70';c.beginPath();c.ellipse(p.x-r*.35,p.y-r*.4,r*.17,r*.26,.4,0,7);c.fill();c.fillStyle='#91a975';c.beginPath();c.ellipse(p.x+r*.2,p.y-r*.9,r*.35,r*.12,-.5,0,7);c.fill();if(scale>.8)this.text(COLORS[color].mark,p.x,p.y+1,Math.max(10,g.cell*.13),color===7?'#fff8':'#34564a80');c.restore();}
  drawRecolte(){
    const c=this.ctx,g=this.boardGrid(),t=this.motion?Math.min(1,(performance.now()-this.motion.start)/370):1,path=this.draft??(Array.isArray(this.selected)?this.selected:this.hint?.action?.path??[]),previous=this.motion?.previous;
    this.round(g.x-14,g.y-14,g.cols*g.cell+28,g.rows*g.cell+28,25,'#e7eddb','#d3dfc7');
    for(let id=0;id<this.state.field.length;id++){const p=this.boardPoint(id);this.round(p.x-g.cell*.43,p.y-g.cell*.43,g.cell*.86,g.cell*.86,13,'#f1f4e9');}
    if(path.length){c.strokeStyle=this.draft?'#839b73':'#ae9552';c.lineWidth=g.cell*.14;c.lineCap='round';c.lineJoin='round';c.beginPath();path.forEach((id,n)=>{const p=this.boardPoint(id);if(n)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);});c.stroke();}
    const mappings=new Map();if(previous&&t<1)for(let x=0;x<g.cols;x++){const old=[];for(let y=g.rows-1;y>=0;y--){const id=y*g.cols+x;if(previous.field[id]!==null&&!this.motion.action.path.includes(id))old.push(id);}for(let n=0;n<old.length;n++)mappings.set((g.rows-1-n)*g.cols+x,old[n]);}
    this.state.field.forEach((color,id)=>{if(color===null)return;const to=this.boardPoint(id),from=this.boardPoint(mappings.get(id)??id);this.berry(id,color,{x:to.x,y:from.y+(to.y-from.y)*t});});
    if(previous&&t<1)for(const id of this.motion.action.path){const p=this.boardPoint(id);c.save();c.globalAlpha=1-t;this.berry(id,previous.field[id],{x:p.x+(320-p.x)*t,y:p.y+(570-p.y)*t},1-t*.65);c.restore();}
    path.forEach((id,n)=>{const p=this.boardPoint(id);c.strokeStyle=this.draft?'#789375':'#ae9552';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,g.cell*.36,0,7);c.stroke();if(this.hint&&!this.draft)this.text(n+1,p.x,p.y+g.cell*.32,10,'#8e794b');});this.text(path.length?`${path.length} BILLES DANS LA CHAÎNE`:'UNE CHAÎNE DE TROIS, OU UN GRAND PANIER',320,572,11,'#849575');
  }
  numberTile(id,value,scale=1,alpha=1){const c=this.ctx,g=this.boardGrid(),p=this.boardPoint(id);c.save();c.globalAlpha=alpha;c.translate(p.x,p.y);c.scale(scale,scale);this.round(-g.cell*.43,-g.cell*.40+3,g.cell*.86,g.cell*.80,9,'#aa95682a');this.round(-g.cell*.43,-g.cell*.40,g.cell*.86,g.cell*.80,9,'#e5d1a9','#cdb78d');c.strokeStyle='#c5ad7e40';for(const y of [-.25,.20]){c.beginPath();c.moveTo(-g.cell*.35,g.cell*y);c.bezierCurveTo(-g.cell*.1,g.cell*(y+.05),g.cell*.1,g.cell*(y-.05),g.cell*.35,g.cell*y);c.stroke();}c.fillStyle='#53684f';c.font=`${g.cell*.40}px Georgia,serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(value,0,0);c.restore();}
  drawDizaines(){
    const c=this.ctx,g=this.boardGrid(),t=this.motion?Math.min(1,(performance.now()-this.motion.start)/320):1;this.round(g.x-14,g.y-14,g.cols*g.cell+28,g.rows*g.cell+28,22,'#ece7d6','#d7ceb4');
    for(let id=0;id<this.state.field.length;id++){const p=this.boardPoint(id);this.round(p.x-g.cell*.43,p.y-g.cell*.40,g.cell*.86,g.cell*.80,9,'#f5f2e8');if(this.state.field[id]!==null)this.numberTile(id,this.state.field[id]);}
    const ids=this.hint?.action?[this.hint.action.a,this.hint.action.b]:this.selected!==null?[this.selected]:[];
    if(ids.length===2){const a=this.boardPoint(ids[0]),b=this.boardPoint(ids[1]);c.strokeStyle='#ae9552';c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([]);}
    for(const id of ids){const p=this.boardPoint(id);this.round(p.x-g.cell*.45,p.y-g.cell*.42,g.cell*.90,g.cell*.84,10,null,'#aa9455');}
    if(this.motion&&t<1)for(const id of [this.motion.action.a,this.motion.action.b])this.numberTile(id,this.motion.previous.field[id],1-t*.75,1-t);this.text('UNE PAIRE LIBRE · DEUX IDENTIQUES OU UNE SOMME DE DIX',320,570,10,'#849575');
  }
  mosaicTile(id,color,alpha=1,scale=1){const c=this.ctx,g=this.boardGrid(),p=this.boardPoint(id);c.save();c.globalAlpha=alpha;const s=g.cell*.89*scale;this.round(p.x-s/2,p.y-s/2+3,s,s,6,'#42643620');this.round(p.x-s/2,p.y-s/2,s,s,6,COLORS[color].hex,'#fff8');this.round(p.x-s/2+5,p.y-s/2+5,s*.6,3,1,'#fff5');c.restore();}
  drawMosaique(){
    const c=this.ctx,g=this.boardGrid(),t=this.motion?Math.min(1,(performance.now()-this.motion.start)/400):1;this.round(g.x-12,g.y-12,g.cols*g.cell+24,g.rows*g.cell+24,20,'#d8c6a3','#cbbb95');
    for(let id=0;id<this.state.field.length;id++){const p=this.boardPoint(id);this.round(p.x-g.cell*.46,p.y-g.cell*.46,g.cell*.92,g.cell*.92,6,'#f4f2e3');if(this.state.field[id]!==null)this.mosaicTile(id,this.state.field[id]);}
    if(this.motion&&t<1){const a=this.motion.action,piece=this.level.pieces[a.id],placed=mosaicCells(this.level,piece,a.x,a.y);for(const id of this.state.last.cells){const color=placed.includes(id)?piece.color:this.motion.previous.field[id];this.mosaicTile(id,color,1-t,1-t*.45);}if(!this.state.last.cells.length)for(const id of placed)this.mosaicTile(id,piece.color,1,.85+t*.15);}
    const pieces=activePieces(this.level,this.state),piece=pieces.find(p=>p.id===this.selected),cursor=this.hint?.action??this.cursor;
    if(piece&&cursor){const cells=mosaicCells(this.level,piece,cursor.x,cursor.y),valid=cells&&!cells.some(id=>this.state.field[id]!==null);if(cells){for(const id of cells){this.mosaicTile(id,piece.color,valid?.55:.18);const p=this.boardPoint(id);this.round(p.x-g.cell*.45,p.y-g.cell*.45,g.cell*.9,g.cell*.9,6,null,valid?'#ae9552':'#c78970');}}}
    pieces.forEach((piece,n)=>{const x=[190,320,450][n],p=this.trayPoint(piece,n);this.round(x-55,515,110,68,14,'#e4ebd8',this.selected===piece.id?'#ae9552':'#d1dcc6');for(const [dx,dy] of piece.cells)this.round(p.x+dx*22,p.y+dy*22,20,20,4,COLORS[piece.color].hex,'#fff8');this.text(n+1,x+44,573,9,'#829575');});
    if(!pieces.length)this.text('TOUTES LES PIÈCES SONT POSÉES',320,546,11,'#849575');
  }
  draw(){if(!this.level||!this.canvas.width)return;const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);if(this.mode==='recolte')this.drawRecolte();else if(this.mode==='dizaines')this.drawDizaines();else this.drawMosaique();}
}
