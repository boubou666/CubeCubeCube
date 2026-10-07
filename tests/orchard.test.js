import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_SAMPLE} from './campaign-sample.js';
import {PocketGame,clone,encodePocket,decodePocket} from '../src/pocket-core.js';
import {cagettesRules} from '../src/cagettes-puzzle.js';
import {cairnsRules,cairnCanMove} from '../src/cairns-puzzle.js';
import {jalonsRules} from '../src/jalons-puzzle.js';

for(const [name,rules]of Object.entries({cagettes:cagettesRules,cairns:cairnsRules,jalons:jalonsRules})){
  test(`${name}: sampled original campaigns finish through legal moves and undo exactly`,()=>{
    const signatures=new Set();
    for(const index of CAMPAIGN_SAMPLE){
      const game=new PocketGame(rules,index),initial=clone(game.state),signature=clone(game.level);delete signature.index;delete signature.title;delete signature.solution;delete signature.routes;signatures.add(JSON.stringify(signature));assert.deepEqual(rules.create(index),game.level);assert.equal(game.won,false);
      for(const action of game.level.solution){const before=clone(game.state);assert.ok(game.play(action),`${name} ${index+1}`);assert.ok(game.undo());assert.deepEqual(game.state,before);assert.ok(game.play(action));}
      assert.ok(game.won);while(game.undo()){}assert.deepEqual(game.state,initial);
    }assert.equal(signatures.size,CAMPAIGN_SAMPLE.length);assert.throws(()=>rules.create(-1));assert.throws(()=>rules.create(48));
  });
  test(`${name}: sampled hints reach the real goal without repeating states`,()=>{
    for(const index of CAMPAIGN_SAMPLE){const game=new PocketGame(rules,index),seen=new Set();let guard=0;while(!game.won&&guard++<160){const key=JSON.stringify(game.state);assert.ok(!seen.has(key));seen.add(key);const hint=game.hint();assert.ok(hint?.action);assert.ok(game.play(hint.action));}assert.ok(game.won);}
  });
  test(`${name}: saves replay exact state and undo; corrupt actions are rejected`,()=>{
    const game=new PocketGame(rules,47);for(const action of game.level.solution.slice(0,3))assert.ok(game.play(action));const save=encodePocket(game,new Set([0,47]),true),restored=decodePocket(rules,save);assert.deepEqual(restored.game.state,game.state);assert.deepEqual(restored.game.history,game.history);assert.deepEqual([...restored.completed],[0,47]);assert.equal(restored.sound,true);game.undo();restored.game.undo();assert.deepEqual(game.state,restored.game.state);
    for(const bad of [null,{dir:9,from:99,to:99,path:[99,0]},{}])assert.equal(decodePocket(rules,{...save,moves:[bad]}),null);
  });
}
test('cagettes: pushes one crate, cannot pull or push two, and walls block both bodies',()=>{
  const l={cols:5,rows:4,floor:Array.from({length:20},()=>true),goals:[8,9]},s={at:6,boxes:[7,9]},before=clone(s);
  assert.deepEqual(cagettesRules.move(l,s,{dir:1}),{at:7,boxes:[8,9]});assert.deepEqual(s,before);
  assert.equal(cagettesRules.move(l,{at:6,boxes:[7,8]},{dir:1}),null);
  assert.deepEqual(cagettesRules.move(l,s,{dir:3}),{at:5,boxes:[7,9]});l.floor[8]=false;assert.equal(cagettesRules.move(l,s,{dir:1}),null);assert.equal(cagettesRules.move(l,{at:4,boxes:[]},{dir:1}),null);
});
test('cagettes: dead ends give a verified undo instead of moving an impossible crate',()=>{
  const l={cols:5,rows:5,floor:Array.from({length:25},(_,id)=>id%5>0&&id%5<4&&id>=5&&id<20),goals:[18],start:8,boxes:[13],solution:[{dir:2}]};
  const s={at:12,boxes:[7]};assert.equal(cagettesRules.plan(l,s),null);assert.equal(cagettesRules.move(l,s,{dir:0}),null);
});
test('cairns: only the top ring moves, larger cannot cover smaller, and actual links are mandatory',()=>{
  const l={pegs:4,count:3,goal:3,links:[[0,1],[1,2],[2,3]]},s={disks:[0,0,1]};assert.deepEqual(cairnsRules.move(l,s,{from:0,to:1}),{disks:[1,0,1]});assert.equal(cairnsRules.move(l,s,{from:0,to:2}),null);assert.equal(cairnsRules.move(l,s,{from:1,to:0}),null);assert.equal(cairnCanMove(l,s,3,2),false);assert.equal(cairnsRules.move(l,s,{from:0,to:0}),null);assert.deepEqual(s,{disks:[0,0,1]});
});
test('cairns: every legal detour retains a shortest verified route on the restricted expert bridges',()=>{
  const l=cairnsRules.create(47);assert.equal(l.links.length,3);let s=cairnsRules.initial(l);for(const a of cairnsRules.actions(l,s).slice(0,3)){let next=cairnsRules.move(l,s,a);for(const action of cairnsRules.plan(l,next))next=cairnsRules.move(l,next,action);assert.ok(cairnsRules.won(l,next));}
});
test('jalons: order, murets, adjacency, no crossing and final full coverage are real constraints',()=>{
  const l={cols:3,rows:2,start:0,end:3,marks:{0:1,2:2,3:3},markCount:3,walls:['0:3']},s={path:[0]};assert.equal(jalonsRules.move(l,s,{path:[0,3]}),null);assert.equal(jalonsRules.move(l,s,{path:[0,4]}),null);assert.equal(jalonsRules.move(l,s,{path:[0,1,4,3]}),null);assert.equal(jalonsRules.move(l,s,{path:[0,1,0]}),null);
  const next=jalonsRules.move(l,s,{path:[0,1,2,5,4,3]});assert.ok(jalonsRules.won(l,next));assert.deepEqual(s,{path:[0]});assert.equal(jalonsRules.move(l,s,{path:[0,1,2,5,4,3,0]}),null);
});
test('jalons: a whole drawn route is one action and undo restores its exact origin',()=>{
  const game=new PocketGame(jalonsRules,47),before=clone(game.state);assert.ok(game.play({path:game.level.route}));assert.equal(game.moves.length,1);assert.ok(game.won);game.undo();assert.deepEqual(game.state,before);
});
