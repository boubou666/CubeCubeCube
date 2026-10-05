import { checkIndex, clone, random } from './pocket-core.js';
import { pictureArt, peelColor, pictureFrontier } from './picture-art.js';
export function createCarrouselLevel(index) {
  checkIndex(index);const rng=random(83911+index*6521),tier=Math.floor(index/12),art=pictureArt(index,10+tier*2);
  const level={index,tier,...art,queues:Array.from({length:4},()=>[]),solution:[],lapLimit:5+tier*2,slotCount:5};
  const removed=[];
  while(removed.length<level.cells.length) {
    const colors=[...new Set(pictureFrontier(level,removed).map(id=>level.cells[id]))],color=colors[Math.floor(rng()*colors.length)];
    const hits=peelColor(level,removed,color,level.lapLimit+Math.floor(rng()*(level.lapLimit+1))),q=Math.floor(rng()*4);
    const pig={color,ammo:hits.length};level.queues[q].push(pig);level.solution.push({type:'queue',q});
    for(let left=pig.ammo-level.lapLimit;left>0;left-=level.lapLimit)level.solution.push({type:'waiting',slot:0});
    removed.push(...hits);
  }
  return level;
}
export const carrouselRules={
  create:createCarrouselLevel,
  initial:level=>({removed:[],queues:level.queues.map(()=>0),waiting:Array(level.slotCount).fill(null)}),
  won:(level,state)=>state.removed.length===level.cells.length && state.waiting.every(p=>!p) && state.queues.every((n,q)=>n===level.queues[q].length),
  actions(level,state) {
    const choices=state.waiting.map((pig,slot)=>pig?{type:'waiting',slot}:null).filter(Boolean);
    if(state.waiting.includes(null))for(let q=0;q<level.queues.length;q++)if(level.queues[q][state.queues[q]])choices.push({type:'queue',q});
    const color=a=>a.type==='queue'?level.queues[a.q][state.queues[a.q]].color:state.waiting[a.slot].color;
    const visible=pictureFrontier(level,state.removed).map(id=>level.cells[id]);return choices.sort((a,b)=>Number(visible.includes(color(b)))-Number(visible.includes(color(a))));
  },
  move(level,state,action) {
    if(!action || !['queue','waiting'].includes(action.type))return null;
    const next=clone(state);let pig,slot;
    if(action.type==='queue') {if(!Number.isInteger(action.q) || action.q<0 || action.q>=4)return null;pig=level.queues[action.q][state.queues[action.q]];slot=state.waiting.indexOf(null);if(!pig || slot===-1)return null;next.queues[action.q]++;pig={...pig};}
    else {slot=action.slot;if(!Number.isInteger(slot) || slot<0 || slot>=level.slotCount || !state.waiting[slot])return null;pig={...state.waiting[slot]};next.waiting[slot]=null;}
    const hits=peelColor(level,state.removed,pig.color,Math.min(pig.ammo,level.lapLimit));
    // A fruitless relaunch cannot make space or reveal anything; reject it.
    if(!hits.length && action.type==='waiting')return null;
    next.removed.push(...hits);pig.ammo-=hits.length;if(pig.ammo)next.waiting[slot]=pig;return next;
  },
};
