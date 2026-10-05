import test from 'node:test';
import assert from 'node:assert/strict';
import { PocketGame, encodePocket, decodePocket } from '../src/pocket-core.js';
import { noeudsRules, ropeCrossings } from '../src/noeuds-puzzle.js';
import { gouttesRules, inkUsed } from '../src/gouttes-puzzle.js';
import { WaterSimulation, simulateWater, WATER_TOTAL } from '../src/gouttes-physics.js';
import { segmentsMeet } from '../src/physics-geometry.js';
for(const [name,rules] of Object.entries({noeuds:noeudsRules,gouttes:gouttesRules})){
  test(`${name}: all 48 distinct seeded levels have complete audited solutions and growing difficulty`,()=>{
    const layouts=new Set();let first,last;
    for(let index=0;index<48;index++){
      const level=rules.create(index);assert.deepEqual(level,rules.create(index));const {index:_,title:__,solution:___,...layout}=level;layouts.add(JSON.stringify(layout));const game=new PocketGame(rules,index),initial=structuredClone(game.state);
      for(const action of level.solution){const before=structuredClone(game.state);assert.ok(game.play(action),`${name} ${index+1} ${JSON.stringify(action)}`);assert.deepEqual(game.history.at(-1),before);if(name==='noeuds'){assert.equal(new Set(game.state.pins).size,level.pins.length);for(let id=0;id<level.pins.length;id++)if(level.pins[id].fixed)assert.equal(game.state.pins[id],initial.pins[id]);}else{assert.ok(inkUsed(game.state.lines)<=level.ink);if(game.state.result)assert.equal(game.state.result.caught+game.state.result.lost,WATER_TOTAL);}}
      assert.ok(game.won);while(game.history.length)game.undo();assert.deepEqual(game.state,initial);
      const complexity=name==='noeuds'?level.ropes.length:level.solution.length+level.goal;if(!index)first=complexity;if(index===47)last=complexity;
    }assert.equal(layouts.size,48);assert.ok(last>first);assert.throws(()=>rules.create(-1));assert.throws(()=>rules.create(48));
  });
  test(`${name}: replay restores exact state, undo, completion badges and optional sound`,()=>{
    const game=new PocketGame(rules,47);assert.ok(game.play(game.level.solution[0]));const save=encodePocket(game,new Set([0,12,35]),true),restore=decodePocket(rules,save);assert.deepEqual(restore.game.state,game.state);assert.deepEqual(restore.game.history,game.history);assert.equal(restore.sound,true);game.undo();restore.game.undo();assert.deepEqual(game.state,restore.game.state);
    for(const bad of [null,{}, {...save,generation:99},{...save,index:48},{...save,moves:[null]},{...save,moves:[{type:'draw',path:[[NaN,2],[999,4]],pin:999,peg:1}]}])assert.equal(decodePocket(rules,bad),null);
    game.restart();assert.deepEqual(game.state,rules.initial(game.level));
  });
  test(`${name}: hints verify a complete route at each chapter boundary`,()=>{
    for(const index of [0,11,12,23,24,35,36,47]){const game=new PocketGame(rules,index);assert.ok(game.play(game.level.solution[0]));if(game.won)continue;const route=rules.plan(game.level,game.state);assert.ok(route?.length);for(const action of route)assert.ok(game.play(action));assert.ok(game.won);}
  });
}
test('noeuds: proper crossings, endpoint touches and overlapping ropes count; separated cords do not',()=>{
  assert.equal(segmentsMeet([0,0],[4,4],[0,4],[4,0]),true);assert.equal(segmentsMeet([0,0],[4,0],[2,0],[6,0]),true);assert.equal(segmentsMeet([0,0],[4,0],[4,0],[4,4]),true);assert.equal(segmentsMeet([0,0],[4,0],[0,1],[4,1]),false);
  const level={pegs:[[0,0],[4,4],[0,4],[4,0],[5,5]],pins:[{fixed:false},{fixed:false},{fixed:false},{fixed:true}],ropes:[{a:0,b:1},{a:2,b:3}]},state={pins:[0,1,2,3]},before=structuredClone(state);assert.deepEqual(ropeCrossings(level,state),[[0,1]]);
  for(const action of [{pin:0,peg:1},{pin:3,peg:4},{pin:0,peg:99},{pin:.5,peg:4}])assert.equal(noeudsRules.move(level,state,action),null);assert.deepEqual(state,before);
});
test('noeuds: arbitrary legal detours remain solvable with fixed pins and occupied target plots',()=>{
  for(const index of [12,24,36,47]){const game=new PocketGame(noeudsRules,index);for(let i=0;i<8&&!game.won;i++){const pin=game.level.pins.findIndex((p,id)=>!p.fixed&&id>=i%game.level.pins.length),peg=game.level.pegs.findIndex((_,id)=>!game.state.pins.includes(id));if(pin>=0)game.play({pin,peg});}if(game.won)continue;const plan=noeudsRules.plan(game.level,game.state);assert.ok(plan?.length);for(const action of plan)assert.ok(game.play(action));assert.ok(game.won);}
});
test('gouttes: every emitted drop is conserved at every simulation tick; live physics matches audited results',()=>{
  for(const index of [0,12,24,47]){const level=gouttesRules.create(index),lines=level.solution.filter(a=>a.type==='draw').map(a=>a.path),sim=new WaterSimulation(level,lines);
    while(!sim.done){sim.step();assert.equal(sim.caught+sim.lost+sim.particles.length+WATER_TOTAL-sim.emitted,WATER_TOTAL);assert.ok(sim.particles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.vx)<=480&&Math.abs(p.vy)<=481));}
    assert.deepEqual(sim.result(),simulateWater(level,lines));assert.ok(sim.caught>=level.goal);assert.ok(simulateWater(level,[]).caught<level.goal);
  }
});
test('gouttes: obstacle tunneling, malformed strokes, ink overflow and out-of-garden drawings reject transactionally',()=>{
  const level={...gouttesRules.create(12),obstacles:[{x:200,y:200,w:40,h:40}],ink:300},state=gouttesRules.initial(level),before=structuredClone(state);
  for(const path of [[[100,220],[300,220]],[[210,210],[220,230]],[[0,100],[100,120]],[[100,100]],[[100,100],[101,101]],[[100,100],[500,100]],[[100,100],[Infinity,200]]])assert.equal(gouttesRules.move(level,state,{type:'draw',path}),null);
  assert.deepEqual(state,before);assert.ok(gouttesRules.move(level,state,{type:'draw',path:[[100,180],[300,180]]}));
});
test('gouttes: failed trials can be saved, undone, cleared and corrected through verified hints',()=>{
  const game=new PocketGame(gouttesRules,47);assert.ok(game.play({type:'run'}));assert.equal(game.won,false);assert.equal(game.state.result.caught,0);const saved=decodePocket(gouttesRules,encodePocket(game,new Set(),false));assert.deepEqual(saved.game.state,game.state);assert.ok(game.undo());assert.equal(game.state.result,null);
  assert.ok(game.play({type:'draw',path:[[80,500],[140,520]]}));assert.equal(game.hint().action.type,'clear');const plan=gouttesRules.plan(game.level,game.state);for(const action of plan)assert.ok(game.play(action));assert.ok(game.won);assert.ok(game.undo());assert.equal(game.state.result,null);assert.ok(game.state.lines.length>0);
});
