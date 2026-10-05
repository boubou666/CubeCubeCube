import test from 'node:test';
import assert from 'node:assert/strict';
import { PocketGame, encodePocket, decodePocket } from '../src/pocket-core.js';
import { eclusesRules } from '../src/ecluses-puzzle.js';
import { dunesRules, SandFlow } from '../src/dunes-puzzle.js';
import { fringaleRules, moveHole, holeRadius } from '../src/fringale-puzzle.js';
const all={ecluses:eclusesRules,dunes:dunesRules,fringale:fringaleRules};
function conserved(name,level,state){
  if(name==='ecluses'){const ids=[...state.rooms.flat(),...state.collected,...state.lost,...state.bombsGone];assert.equal(ids.length,level.balls.length);assert.equal(new Set(ids).size,ids.length);assert.ok(state.collected.every(id=>state.colors[id]!==null&&!level.balls[id].bomb));}
  if(name==='dunes'){assert.equal(state.field.filter(c=>c>0).length+state.cleared,level.field.filter(c=>c>0).length+state.added);for(let id=0;id<state.field.length;id++)if(level.field[id]===-1)assert.equal(state.field[id],-1);}
  if(name==='fringale'){assert.equal(new Set(state.collected).size,state.collected.length);assert.equal(state.mass,state.collected.reduce((n,id)=>n+level.items[id].mass,0));assert.ok(state.hole.every(Number.isFinite));}
}
for(const [name,rules] of Object.entries(all)){
  test(`${name}: 48 distinct deterministic levels have legal complete solutions, conservation and exact undo`,()=>{
    const layouts=new Set();let first,last;
    for(let index=0;index<48;index++){
      const level=rules.create(index);assert.deepEqual(level,rules.create(index));const {index:_,title:__,solution:___,...layout}=level;layouts.add(JSON.stringify(layout));const game=new PocketGame(rules,index),initial=structuredClone(game.state);
      for(const action of level.solution){const before=structuredClone(game.state);assert.ok(game.play(action),`${name} ${index+1} ${JSON.stringify(action)}`);assert.deepEqual(game.history.at(-1),before);conserved(name,level,game.state);}assert.ok(game.won);assert.equal(game.play(level.solution[0]),false);while(game.history.length)game.undo();assert.deepEqual(game.state,initial);
      const complexity=name==='ecluses'?level.total:name==='dunes'?level.goal:level.items.length;if(!index)first=complexity;if(index===47)last=complexity;
    }assert.equal(layouts.size,48);assert.ok(last>first);assert.throws(()=>rules.create(-1));assert.throws(()=>rules.create(48));
  });
  test(`${name}: saved replay keeps the exact board, history, sound and completions`,()=>{
    const game=new PocketGame(rules,47);for(const action of game.level.solution.slice(0,3))assert.ok(game.play(action));const save=encodePocket(game,new Set([0,12,35]),true),restore=decodePocket(rules,save);assert.deepEqual(restore.game.state,game.state);assert.deepEqual(restore.game.history,game.history);assert.equal(restore.sound,true);game.undo();restore.game.undo();assert.deepEqual(restore.game.state,game.state);
    for(const bad of [null,{}, {...save,index:48},{...save,generation:99},{...save,moves:[null]},{...save,moves:[{q:99,x:0,type:'visit',id:999}]}])assert.equal(decodePocket(rules,bad),null);game.restart();assert.deepEqual(game.state,rules.initial(game.level));
  });
  test(`${name}: hints prove whole remaining routes across the chapter boundaries`,()=>{
    for(const index of [0,11,12,23,24,35,36,47]){const game=new PocketGame(rules,index);assert.ok(game.play(game.level.solution[0]));const route=rules.plan(game.level,game.state);assert.ok(route?.length);for(const action of route)assert.ok(game.play(action));assert.ok(game.won);}
  });
}
test('ecluses: gray balls must mix before entering the basket; wrong openings and bombs are undoable',()=>{
  const game=new PocketGame(eclusesRules,0),initial=structuredClone(game.state);assert.ok(game.play(2));assert.ok(game.play(0));assert.ok(game.state.lost.length);assert.equal(game.won,false);assert.deepEqual(game.hint(),{undo:true});assert.equal(game.play(1),false);game.undo();game.undo();assert.deepEqual(game.state,initial);
  assert.ok(game.play(0));assert.ok(game.state.rooms.flat().some(id=>game.state.colors[id]===null));assert.ok(game.play(1));assert.ok(game.state.rooms.flat().every(id=>game.state.colors[id]!==null));
  const bombGame=new PocketGame(eclusesRules,36);assert.ok(bombGame.play(bombGame.level.pins.length-1));assert.ok(bombGame.play(0));assert.ok(bombGame.play(2));assert.ok(bombGame.state.lost.length);conserved('ecluses',bombGame.level,bombGame.state);
});
test('dunes: live grain stepping matches audited drops and conserves grains at every tick',()=>{
  for(const index of [0,12,24,47]){const level=dunesRules.create(index);let state=dunesRules.initial(level);for(const action of level.solution){const simulation=new SandFlow(level,state,action);assert.equal(simulation.invalid,undefined);while(!simulation.done){simulation.step();conserved('dunes',level,simulation.state);}assert.deepEqual(simulation.state,dunesRules.move(level,state,action));state=simulation.state;}assert.ok(dunesRules.won(level,state));}
});
test('dunes: occupied spawn cells, bad columns and empty queues reject transactionally',()=>{
  const level=dunesRules.create(0),state=dunesRules.initial(level),action=level.solution[0],before=structuredClone(state);
  for(const bad of [null,{q:99,x:0},{q:action.q,x:-1},{q:action.q,x:level.width},{q:action.q,x:.5}])assert.equal(dunesRules.move(level,state,bad),null);
  const blocked=structuredClone(state);blocked.field.fill(1,0,level.width*8);assert.equal(dunesRules.move(level,blocked,action),null);assert.deepEqual(state,before);
});
test('fringale: growth unlocks larger objects and movement cannot teleport through hedges',()=>{
  const level={walls:[{x:250,y:60,w:20,h:320}],items:[{id:0,x:180,y:120,r:6,mass:1},{id:1,x:350,y:150,r:20,mass:7}],start:[100,120]},state={hole:[100,120],mass:0,collected:[]},before=structuredClone(state);
  assert.equal(moveHole(level,state,{type:'visit',id:1}),null);const grabbed=moveHole(level,state,{type:'visit',id:0});assert.ok(grabbed.collected.includes(0));assert.equal(grabbed.mass,1);assert.ok(holeRadius(grabbed.mass)>holeRadius(state.mass));
  const stopped=moveHole(level,state,{type:'path',path:[[400,120]]});assert.ok(stopped);assert.ok(stopped.hole[0]<=250-holeRadius(stopped.mass));assert.deepEqual(state,before);
  for(const action of [{type:'path',path:[[Infinity,120]]},{type:'path',path:[[0,0]]},{type:'visit',id:99},{type:'path',path:[]}])assert.equal(moveHole(level,state,action),null);
});
test('fringale: growing outside before clearing a small courtyard creates a real reversible detour',()=>{
  const game=new PocketGame(fringaleRules,36);for(const item of game.level.items.slice(4))if(item.r+3<=holeRadius(game.state.mass))game.play({type:'visit',id:item.id});
  assert.ok(game.state.collected.length>10);assert.ok(game.level.items.slice(0,4).some(p=>!game.state.collected.includes(p.id)));assert.equal(fringaleRules.plan(game.level,game.state),null);assert.deepEqual(game.hint(),{undo:true});const before=structuredClone(game.history.at(-1));assert.ok(game.undo());assert.deepEqual(game.state,before);
});
