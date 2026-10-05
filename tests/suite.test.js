import test from 'node:test';
import assert from 'node:assert/strict';
import { PocketGame, encodePocket, decodePocket, searchPlan } from '../src/pocket-core.js';
import { passagesRules } from '../src/passages-puzzle.js';
import { voyageRules, accessiblePassengers } from '../src/voyage-puzzle.js';
import { carrouselRules } from '../src/carrousel-puzzle.js';
import { broderieRules, accessibleSpools } from '../src/broderie-puzzle.js';
import { peelColor } from '../src/picture-art.js';

const all={passages:passagesRules,voyage:voyageRules,carrousel:carrouselRules,broderie:broderieRules};
function conservation(name,level,state){
  if(name==='carrousel')for(const color of new Set(level.cells)){
    const pixels=level.cells.filter((c,id)=>c===color&&!state.removed.includes(id)).length;
    const ammunition=state.waiting.reduce((n,p)=>n+(p?.color===color?p.ammo:0),0)+level.queues.reduce((n,q,i)=>n+q.slice(state.queues[i]).filter(p=>p.color===color).reduce((n,p)=>n+p.ammo,0),0);
    assert.equal(pixels,ammunition);assert.ok(state.waiting.filter(Boolean).length<=5);
  }
  if(name==='broderie'){assert.ok(state.buffer.length<=7);assert.ok(new Set(state.removed).size===state.removed.length);assert.ok(state.buffer.every(c=>state.buffer.filter(n=>n===c).length<3));}
  if(name==='voyage'){assert.ok(state.buffer.length<=5);assert.ok(state.boarded<(level.buses[state.bus]?.count??1));assert.ok(state.buffer.every(id=>state.removed.includes(id)));}
}
for(const [name,rules]of Object.entries(all)){
  test(`${name}: 48 distinct deterministic levels have legal complete solutions, undo and growing difficulty`,()=>{
    const layouts=new Set();let first,last;
    for(let index=0;index<48;index++){
      const level=rules.create(index);assert.deepEqual(level,rules.create(index));
      const {index:_,title:__,solution:___,score:____,...layout}=level;layouts.add(JSON.stringify(layout));
      const game=new PocketGame(rules,index),original=structuredClone(game.state);
      const size=name==='passages'?level.blocks.length:name==='voyage'?level.passengers.length:name==='carrousel'?level.cells.length:level.spools.length;if(!index)first=size;if(index===47)last=size;
      for(const action of level.solution){const before=structuredClone(game.state);assert.ok(game.play(action),`${name} puzzle ${index+1}, ${JSON.stringify(action)}`);assert.deepEqual(game.history.at(-1),before);conservation(name,level,game.state);}
      assert.ok(game.won);while(game.history.length)game.undo();assert.deepEqual(game.state,original);
    }
    assert.equal(layouts.size,48);assert.ok(last>first);assert.throws(()=>rules.create(-1));assert.throws(()=>rules.create(48));
  });
  test(`${name}: exact save replay and history survive reload; malformed moves fail safely`,()=>{
    const game=new PocketGame(rules,47);for(const action of game.level.solution.slice(0,6))assert.ok(game.play(action));
    const saved=encodePocket(game,new Set([0,12,35]),true),restored=decodePocket(rules,saved);assert.ok(restored);assert.deepEqual(restored.game.state,game.state);assert.deepEqual(restored.game.history,game.history);assert.equal(restored.sound,true);
    game.undo();restored.game.undo();assert.deepEqual(game.state,restored.game.state);
    for(const bad of [null,{}, {...saved,generation:99},{...saved,index:48},{...saved,moves:[null]},{...saved,moves:[{id:9000,type:'waiting',slot:9000,dx:9,dy:9}]}])assert.equal(decodePocket(rules,bad),null);
    game.restart();assert.deepEqual(game.state,rules.initial(game.level));assert.equal(game.history.length,0);
  });
  test(`${name}: hints verify whole remaining routes through all chapter boundaries`,()=>{
    for(const index of [0,11,12,23,24,35,36,47]){
      const game=new PocketGame(rules,index);for(const action of game.level.solution.slice(0,Math.floor(game.level.solution.length/2)))assert.ok(game.play(action));
      const plan=rules.plan?rules.plan(game.level,game.state):searchPlan(rules,game.level,game.state);assert.ok(plan?.length,`${name} ${index+1}`);for(const action of plan)assert.ok(game.play(action));assert.ok(game.won);
    }
  });
}
test('passages: rectangles cannot cross neighbors or walls, or exit through an unaligned door',()=>{
  const level={size:4,walls:[[2,2]],blocks:[{id:0,color:0,x:0,y:1,w:2,h:1,door:{side:'left',at:2,span:1}},{id:1,color:1,x:2,y:0,w:1,h:2,door:{side:'top',at:2,span:1}}]};
  const state=passagesRules.initial(level),before=structuredClone(state);
  for(const action of [{id:0,dx:1,dy:0},{id:0,dx:-1,dy:0},{id:0,dx:1,dy:1},{id:1,dx:0,dy:1}])assert.equal(passagesRules.move(level,state,action),null);
  assert.deepEqual(state,before);const aligned=passagesRules.move(level,state,{id:0,dx:0,dy:1});assert.ok(aligned);const exited=passagesRules.move(level,aligned,{id:0,dx:-1,dy:0});assert.equal(exited.blocks.length,1);
});
test('voyage: only the outside-connected front is selectable and buses conserve every passenger color',()=>{
  const game=new PocketGame(voyageRules,0);assert.equal(accessiblePassengers(game.level,game.state).length,game.level.width);assert.equal(game.play(0),false);
  for(const color of new Set(game.level.passengers.map(p=>p.color)))assert.equal(game.level.buses.filter(b=>b.color===color).reduce((n,b)=>n+b.count,0),game.level.passengers.filter(p=>p.color===color).length);
  const level={width:3,height:3,walls:[[0,1],[1,1],[2,1]],passengers:[{id:0,x:1,y:0,color:0},{id:1,x:1,y:2,color:1}]};assert.deepEqual(accessiblePassengers(level,{removed:[]}),[1]);assert.deepEqual(accessiblePassengers(level,{removed:[1]}),[]);
});
test('carrousel: buried colors can wait, full waiting slots reject launches, and fruitless relaunches are transactional',()=>{
  let game,q;
  for(let index=0;index<48&&!game;index++){const candidate=new PocketGame(carrouselRules,index);for(let n=0;n<4;n++){const pig=candidate.level.queues[n][0];if(pig&&!peelColor(candidate.level,[],pig.color,pig.ammo).length){game=candidate;q=n;break;}}}
  assert.ok(game);assert.ok(game.play({type:'queue',q}));assert.equal(game.state.removed.length,0);const before=structuredClone(game.state);assert.equal(game.play({type:'waiting',slot:0}),false);assert.deepEqual(game.state,before);
  const full={...game.state,waiting:Array.from({length:5},()=>({color:0,ammo:1}))};assert.equal(carrouselRules.move(game.level,full,{type:'queue',q}),null);
});
test('broderie: covered bobbins reject selection; triplets stitch disjoint patches covering the whole picture',()=>{
  const game=new PocketGame(broderieRules,0),ready=accessibleSpools(game.level,game.state),covered=game.level.spools.find(s=>!ready.includes(s.id));assert.ok(covered);assert.equal(game.play(covered.id),false);
  for(const action of game.level.solution.slice(0,2))assert.ok(game.play(action));assert.equal(game.state.buffer.length,2);assert.equal(game.state.stitched.length,0);assert.ok(game.play(game.level.solution[2]));assert.equal(game.state.buffer.length,0);assert.equal(game.state.stitched.length,1);
  const pixels=game.level.patches.flatMap(p=>p.pixels);assert.equal(pixels.length,game.level.cells.length);assert.equal(new Set(pixels).size,game.level.cells.length);
  for(const p of game.level.patches)assert.ok(p.pixels.every(id=>game.level.cells[id]===p.color));
});
