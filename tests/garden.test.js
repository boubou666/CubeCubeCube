import test from 'node:test';
import assert from 'node:assert/strict';
import { PocketGame, encodePocket, decodePocket } from '../src/pocket-core.js';
import { alveolesRules, hexNeighbors } from '../src/alveoles-puzzle.js';
import { potionsRules, pourAmount } from '../src/potions-puzzle.js';
import { liaisonsRules, neighbors } from '../src/liaisons-puzzle.js';

const all={alveoles:alveolesRules,potions:potionsRules,liaisons:liaisonsRules};
function conservation(name,level,state) {
  if(name==='alveoles') {
    const stock=level.queues.flatMap((q,i)=>q.slice(state.queues[i])).flat().length;
    assert.equal(state.stacks.flat().length+stock+state.cleared,level.stacks.flat().length+level.queues.flat(2).length);
    assert.equal(state.cleared%6,0);
  }
  if(name==='potions') {assert.ok(state.bottles.every(b=>b.length<=4));for(const color of level.colors)assert.equal(state.bottles.flat().filter(c=>c===color).length,4);}
  if(name==='liaisons') {const cells=state.paths.flat();assert.equal(new Set(cells).size,cells.length);for(const path of state.paths)for(let i=1;i<path.length;i++)assert.ok(neighbors(level.size,path[i-1],path[i]));}
}
for(const [name,rules] of Object.entries(all)) {
  test(`${name}: all 48 distinct deterministic boards have complete legal routes and growing difficulty`,()=>{
    const layouts=new Set();let first,last;
    for(let index=0;index<48;index++) {
      const level=rules.create(index);assert.deepEqual(level,rules.create(index));const {index:_,title:__,solution:___,...layout}=level;layouts.add(JSON.stringify(layout));
      const game=new PocketGame(rules,index),initial=structuredClone(game.state);
      for(const action of level.solution){const before=structuredClone(game.state);assert.ok(game.play(action),`${name} ${index+1} ${JSON.stringify(action)}`);assert.deepEqual(game.history.at(-1),before);conservation(name,level,game.state);}
      assert.ok(game.won,`${name} ${index+1}`);assert.equal(game.play(level.solution[0]),false);while(game.history.length)game.undo();assert.deepEqual(game.state,initial);
      const difficulty=name==='alveoles'?level.solution.length:name==='potions'?level.colors.length:level.size;if(!index)first=difficulty;if(index===47)last=difficulty;
    }
    assert.equal(layouts.size,48);assert.ok(last>first);assert.throws(()=>rules.create(-1));assert.throws(()=>rules.create(48));
  });
  test(`${name}: exact replay, undo, completion and sound survive save validation`,()=>{
    const game=new PocketGame(rules,47);for(const action of game.level.solution.slice(0,2))assert.ok(game.play(action));
    const saved=encodePocket(game,new Set([0,12,35]),true),restored=decodePocket(rules,saved);assert.deepEqual(restored.game.state,game.state);assert.deepEqual(restored.game.history,game.history);assert.equal(restored.sound,true);assert.deepEqual([...restored.completed],[0,12,35]);
    game.undo();restored.game.undo();assert.deepEqual(game.state,restored.game.state);game.restart();assert.equal(game.moves.length,0);
    for(const value of [null,{}, {...saved,index:48},{...saved,generation:999},{...saved,moves:[null]},{...saved,moves:[{from:999,to:0,q:999,cell:0,color:999,path:[0]}]}])assert.equal(decodePocket(rules,value),null);
  });
  test(`${name}: hints verify complete remaining solutions across every chapter boundary`,()=>{
    for(const index of [0,11,12,23,24,35,36,47]) {const game=new PocketGame(rules,index);for(const action of game.level.solution.slice(0,1))assert.ok(game.play(action));const plan=rules.plan(game.level,game.state);assert.ok(plan?.length);for(const action of plan)assert.ok(game.play(action));assert.ok(game.won);}
  });
}
test('alveoles: adjacent top colors gather, hidden layers cascade, six-tile thresholds conserve leftovers',()=>{
  const level={cells:[[0,0],[1,0],[2,0],[0,1]],stacks:[[1,1,1,0,0,0],[],[2,2],[]],queues:[[[1,1,1,0,0,0]],[],[]]};
  const state=alveolesRules.initial(level),before=structuredClone(state),next=alveolesRules.move(level,state,{q:0,cell:1});assert.equal(next.cleared,12);assert.deepEqual(next.stacks,[[],[],[2,2],[]]);assert.deepEqual(state,before);
  assert.equal(alveolesRules.move(level,state,{q:0,cell:0}),null);assert.equal(alveolesRules.move(level,state,{q:5,cell:1}),null);assert.equal(alveolesRules.move(level,state,{q:0,cell:1.5}),null);
  const excess={...level,stacks:[[0,0,0,0,0],[],[],[]],queues:[[[0,0,0]],[],[]]};const merged=alveolesRules.move(excess,alveolesRules.initial(excess),{q:0,cell:1});assert.equal(merged.cleared,6);assert.deepEqual(merged.stacks[1],[0,0]);assert.deepEqual(hexNeighbors(level,0),[1,3]);
});
test('potions: maximal top-run pours respect space, colors, bottoms and transactionality',()=>{
  const level={},state={bottles:[[2,0,0,0],[1,0,0],[],[1,1,1,1]]},before=structuredClone(state);
  assert.equal(pourAmount(state,0,1),1);assert.deepEqual(potionsRules.move(level,state,{from:0,to:1}).bottles,[[2,0,0],[1,0,0,0],[],[1,1,1,1]]);
  assert.deepEqual(potionsRules.move(level,state,{from:0,to:2}).bottles,[[2],[1,0,0],[0,0,0],[1,1,1,1]]);
  for(const action of [{from:0,to:3},{from:3,to:0},{from:0,to:0},{from:2,to:0},{from:-1,to:0},{from:0,to:1.5}])assert.equal(potionsRules.move(level,state,action),null);
  assert.deepEqual(state,before);assert.equal(potionsRules.won(level,{bottles:[[0,0],[0,0],[]]}),false);assert.equal(potionsRules.won(level,{bottles:[[0,0,0,0],[]]}),true);
});
test('liaisons: strokes cannot cross, visit foreign endpoints, wrap rows or win with empty cells',()=>{
  const level={size:3,pairs:[[0,2],[6,8]]},state={paths:[[0,1,2],[]]},before=structuredClone(state);
  for(const action of [{color:1,path:[6,3,0,1,2,5,8]},{color:1,path:[6,7,4,1,2,5,8]},{color:1,path:[6,5,8]},{color:1,path:[6,7,6,3,4,5,8]},{color:1,path:[6,7,8,5]}])assert.equal(liaisonsRules.move(level,state,action),null);
  const joined=liaisonsRules.move(level,state,{color:1,path:[6,7,8]});assert.ok(joined);assert.equal(liaisonsRules.won(level,joined),false);
  const filled=liaisonsRules.move(level,joined,{color:0,path:[0,3,4,1,2]});assert.ok(filled);assert.equal(liaisonsRules.won(level,filled),false);assert.deepEqual(state,before);
});
test('liaisons: hints can clear a valid alternate stroke and rebuild a fully filled solution',()=>{
  const game=new PocketGame(liaisonsRules,47),path=game.level.solution[0].path;
  assert.ok(game.play({color:0,path:path.slice(0,3)}));const hint=game.hint();assert.deepEqual(hint.action,{color:0,path:[]});assert.ok(game.play(hint.action));
  for(const action of liaisonsRules.plan(game.level,game.state))assert.ok(game.play(action));assert.ok(game.won);
});
