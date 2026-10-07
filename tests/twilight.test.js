import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_SAMPLE} from './campaign-sample.js';
import {PocketGame,clone,encodePocket,decodePocket} from '../src/pocket-core.js';
import {bosquetsRules,bosquetStatus,solveBosquets} from '../src/bosquets-puzzle.js';
import {gravuresRules,engravingClues,engravingPatterns,engravingDeduction} from '../src/gravures-puzzle.js';
import {veilleesRules,vigilTargets,solveVeillees} from '../src/veillees-puzzle.js';

for(const [name,rules]of Object.entries({bosquets:bosquetsRules,gravures:gravuresRules,veillees:veilleesRules})){
  test(`${name}: sampled deterministic campaigns finish legally and undo every action exactly`,()=>{
    const signatures=new Set();for(const index of CAMPAIGN_SAMPLE){
      const game=new PocketGame(rules,index),initial=clone(game.state),signature=clone(game.level);delete signature.index;delete signature.title;delete signature.solution;signatures.add(JSON.stringify(signature));assert.deepEqual(rules.create(index),game.level);assert.equal(game.won,false);
      for(const action of game.level.solution){const before=clone(game.state);assert.ok(game.play(action));assert.ok(game.undo());assert.deepEqual(game.state,before);assert.ok(game.play(action));}
      assert.ok(game.won);while(game.undo()){}assert.deepEqual(game.state,initial);
    }assert.equal(signatures.size,CAMPAIGN_SAMPLE.length);assert.throws(()=>rules.create(-1));assert.throws(()=>rules.create(48));
  });
  test(`${name}: sampled hints finish current boards without loops`,()=>{
    for(const index of CAMPAIGN_SAMPLE){const game=new PocketGame(rules,index),seen=new Set();let guard=0;while(!game.won&&guard++<100){const key=JSON.stringify(game.state);assert.ok(!seen.has(key));seen.add(key);const hint=game.hint();assert.ok(hint?.action);assert.ok(game.play(hint.action));}assert.ok(game.won);}
  });
  test(`${name}: replay saves preserve exact state, undo and completions and reject invalid actions`,()=>{
    const game=new PocketGame(rules,47);for(const a of game.level.solution.slice(0,3))assert.ok(game.play(a));const save=encodePocket(game,new Set([0,47]),true),restored=decodePocket(rules,save);assert.deepEqual(restored.game.state,game.state);assert.deepEqual(restored.game.history,game.history);assert.deepEqual([...restored.completed],[0,47]);assert.equal(restored.sound,true);game.undo();restored.game.undo();assert.deepEqual(game.state,restored.game.state);for(const bad of [null,{}, {cell:999,cells:[999],values:[9],value:9}])assert.equal(decodePocket(rules,{...save,moves:[bad]}),null);
  });
}
test('bosquets: rows, columns, regions and adjacent corners conflict, while a distant diagonal is allowed',()=>{
  const l={size:4,regions:Array.from({length:16},(_,id)=>Math.floor(id/4))},field=ids=>({field:Array.from({length:16},(_,id)=>ids.includes(id)?1:0)});
  assert.ok(bosquetsRules.won(l,field([1,7,8,14])));assert.deepEqual(bosquetStatus(l,field([0,10])).conflicts,[]);
  for(const pair of [[1,6],[0,2],[0,8],[0,3]])assert.equal(bosquetStatus(l,field(pair)).conflicts.length,2);
  const regionLevel={size:4,regions:Array(16).fill(0)};assert.equal(bosquetStatus(regionLevel,field([0,14])).conflicts.length,2);
});
test('bosquets: sampled regions are connected and each board has exactly one flower placement',()=>{
  for(const index of CAMPAIGN_SAMPLE){const l=bosquetsRules.create(index);assert.deepEqual(solveBosquets(l),[l.flowers]);for(let region=0;region<l.size;region++){
    const cells=l.regions.flatMap((r,id)=>r===region?[id]:[]),seen=new Set([cells[0]]),queue=[cells[0]];
    for(let n=0;n<queue.length;n++)for(const next of [queue[n]-l.size,queue[n]+1,queue[n]+l.size,queue[n]-1])if(cells.includes(next)&&!seen.has(next)&&Math.abs(next%l.size-queue[n]%l.size)+Math.abs(Math.floor(next/l.size)-Math.floor(queue[n]/l.size))===1){seen.add(next);queue.push(next);}assert.equal(seen.size,cells.length);
  }}
});
test('gravures: consecutive group counts and mandatory gaps are exact; contradictions cannot win',()=>{
  assert.deepEqual(engravingClues([1,1,0,1,0,1,1]),[2,1,2]);assert.deepEqual(engravingClues([0,0,0]),[0]);assert.deepEqual(engravingPatterns(3,[1,1]),[[1,0,1]]);
  const l={size:3,rows:[[1,1],[0],[3]],columns:[[1,1],[1],[1,1]]},s={field:[1,2,1,2,2,2,1,1,1]};assert.ok(gravuresRules.won(l,s));assert.ok(!gravuresRules.won(l,{field:[...s.field.slice(0,8),0]}));assert.equal(engravingDeduction(l,[1,1,1,0,0,0,0,0,0]).contradiction,true);
  for(const index of CAMPAIGN_SAMPLE){const l=gravuresRules.create(index),audit=engravingDeduction(l,Array(l.size**2).fill(0));assert.equal(audit.contradiction,false);assert.deepEqual(audit.field,l.image.map(v=>v?1:2));}
});
test('drawn marks are one undoable action; hints remove errors and required crosses without getting stuck',()=>{
  for(const rules of [bosquetsRules,gravuresRules]){const g=new PocketGame(rules,47),initial=clone(g.state),wrong=rules===bosquetsRules?g.level.regions.findIndex((_,id)=>!g.level.flowers.includes(id)):g.level.image.findIndex(v=>!v);assert.ok(g.play(rules===bosquetsRules?{cells:[wrong,wrong+1],value:1}:{cells:[wrong],values:[1]}));const hint=g.hint();assert.equal(hint.action.cells.includes(wrong),true);let guard=0;while(!g.won&&guard++<30)assert.ok(g.play(g.hint().action));assert.ok(g.won);while(g.undo()){}assert.deepEqual(g.state,initial);}
});
test('veillees: cross, diagonal and joined borders flip the actual neighbors and tapping twice is identity',()=>{
  const cross={size:3,pattern:'cross',wrap:false},diagonal={...cross,pattern:'diagonal'},wrapped={...cross,wrap:true};assert.deepEqual(new Set(vigilTargets(cross,0)),new Set([0,1,3]));assert.deepEqual(new Set(vigilTargets(diagonal,0)),new Set([0,4]));assert.deepEqual(new Set(vigilTargets(wrapped,0)),new Set([0,1,2,3,6]));
  const start={lit:[true,false,true,false,true,false,true,false,true]};assert.deepEqual(veilleesRules.move(cross,veilleesRules.move(cross,start,{cell:4}),{cell:4}),start);assert.deepEqual(start.lit,[true,false,true,false,true,false,true,false,true]);
});
test('veillees: algebraic hints finish legal detours and report genuinely unreachable light configurations',()=>{
  for(const index of CAMPAIGN_SAMPLE){const l=veilleesRules.create(index);let s=veilleesRules.initial(l);s=veilleesRules.move(l,s,{cell:0});for(const a of solveVeillees(l,s))s=veilleesRules.move(l,s,a);assert.ok(veilleesRules.won(l,s));}
  assert.equal(solveVeillees({size:2,pattern:'diagonal',wrap:false},{lit:[true,false,false,false]}),null);
});
