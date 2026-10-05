import test from 'node:test';
import assert from 'node:assert/strict';
import {PocketGame,clone,encodePocket,decodePocket} from '../src/pocket-core.js';
import {recolteRules,validChain,chainNeighbors} from '../src/recolte-puzzle.js';
import {dizainesRules,numberLine,matchingNumbers} from '../src/dizaines-puzzle.js';
import {mosaiqueRules,activePieces} from '../src/mosaique-puzzle.js';
const modes={recolte:recolteRules,dizaines:dizainesRules,mosaique:mosaiqueRules};
function conservation(name,game){const {level:l,state:s}=game;if(name==='recolte')for(let color=0;color<8;color++)assert.equal(s.field.filter(v=>v===color).length+s.collected[color],l.quotas[color]);if(name==='dizaines')assert.equal(s.field.filter(v=>v!==null).length+s.pairs*2,l.total);if(name==='mosaique')assert.equal(s.field.filter(v=>v!==null).length+s.cleared,l.field.filter(v=>v!==null).length+s.added);}
for(const [name,rules] of Object.entries(modes)){
  test(`${name}: all 48 distinct deterministic levels have complete routes, exact undo and conserved resources`,()=>{
    const unique=new Set();for(let i=0;i<48;i++){const g=new PocketGame(rules,i),before=clone(g.state);assert.deepEqual(g.level,rules.create(i));unique.add(JSON.stringify({...g.level,index:0,title:''}));assert.equal(g.won,false);conservation(name,g);for(const action of g.level.solution){assert.equal(g.won,false);const old=clone(g.state);assert.equal(g.play(action),true);conservation(name,g);assert.equal(g.undo(),true);assert.deepEqual(g.state,old);assert.equal(g.play(action),true);}assert.equal(g.won,true);while(g.undo()){}assert.deepEqual(g.state,before);}assert.equal(unique.size,48);
    assert.ok(rules.create(47).total>rules.create(0).total);
  });
  test(`${name}: saves restore exact actions, undo history and earned badges; bad moves reject`,()=>{
    const g=new PocketGame(rules,25);for(const a of g.level.solution.slice(0,3))assert.ok(g.play(a));const value=encodePocket(g,new Set([1,47]),true),read=decodePocket(rules,value);assert.deepEqual(read.game.state,g.state);assert.deepEqual(read.game.history,g.history);assert.deepEqual([...read.completed],[1,47]);assert.equal(read.sound,true);read.game.undo();g.undo();assert.deepEqual(read.game.state,g.state);assert.equal(decodePocket(rules,{...value,moves:[{invalid:true}]}),null);assert.equal(decodePocket(rules,{...value,index:48}),null);
  });
  test(`${name}: hints finish every chapter boundary and remaining states`,()=>{
    for(const index of [0,11,12,23,24,35,36,47]){const g=new PocketGame(rules,index);let guard=0;while(!g.won&&guard++<100){const hint=g.hint();assert.ok(hint?.action!==undefined,`${name} ${index}`);assert.ok(g.play(hint.action));}assert.ok(g.won);}
  });
}
test('recolte: diagonal chains, minimum length, duplicate rejection, color quotas and vertical gravity',()=>{
  const l={size:3,field:[0,1,2,1,0,2,1,2,0],quotas:[3,3,3,0,0,0,0,0]},s=recolteRules.initial(l),copy=clone(s);assert.ok(chainNeighbors(l,0,4));assert.equal(chainNeighbors(l,2,3),false);assert.ok(validChain(l,s,[0,4,8]));const next=recolteRules.move(l,s,{path:[0,4,8]});assert.equal(next.collected[0],3);assert.deepEqual(next.field,[null,null,null,1,1,2,1,2,2]);for(const path of [[0,4],[0,4,0],[0,4,7],[0,8,4],[0,4,99]])assert.equal(recolteRules.move(l,s,{path}),null);assert.deepEqual(s,copy);
});
test('dizaines: equal/ten pairs respect occupied lines, diagonal gaps and row wrapping',()=>{
  const l={cols:5,field:[1,null,1,null,7,3,4,null,6,null]},s=dizainesRules.initial(l);assert.ok(matchingNumbers(l,s,0,2));assert.ok(matchingNumbers(l,s,4,5));assert.ok(matchingNumbers(l,s,6,8));assert.equal(matchingNumbers(l,s,0,8),false);assert.equal(matchingNumbers(l,s,0,4),false);assert.equal(numberLine(l,[1,4,1,null,7,3,4,null,6,null],0,2),false);const diagonal={cols:3,field:[3,null,8,null,null,null,null,null,7]};assert.ok(matchingNumbers(diagonal,dizainesRules.initial(diagonal),0,8));assert.equal(matchingNumbers({...diagonal,field:[3,null,8,null,1,null,null,null,7]},dizainesRules.initial({...diagonal,field:[3,null,8,null,1,null,null,null,7]}),0,8),false);assert.equal(dizainesRules.move(l,s,{a:0,b:0}),null);assert.equal(dizainesRules.move(l,s,{a:-1,b:5}),null);
});
test('mosaique: rows/columns clear simultaneously without double-counting their intersection',()=>{
  const l={size:3,field:[null,1,1,1,null,null,1,null,null],pieces:[{id:0,cells:[[0,0]],color:2}]},s=mosaiqueRules.initial(l),next=mosaiqueRules.move(l,s,{id:0,x:0,y:0});assert.equal(next.cleared,5);assert.equal(next.lines,2);assert.deepEqual(next.last.rows,[0]);assert.deepEqual(next.last.cols,[0]);assert.deepEqual(next.field,Array(9).fill(null));assert.equal(mosaiqueRules.won(l,next),true);assert.equal(mosaiqueRules.move(l,s,{id:0,x:1,y:0}),null);assert.equal(mosaiqueRules.move(l,s,{id:0,x:-1,y:0}),null);assert.equal(mosaiqueRules.move(l,s,{id:0,x:.5,y:0}),null);
});
test('mosaique: finite trios unlock only after all three pieces; custom placement and undo remain exact',()=>{
  const g=new PocketGame(mosaiqueRules,47);assert.deepEqual(activePieces(g.level,g.state).map(p=>p.id),[0,1,2]);assert.equal(g.play({...g.level.solution[3]}),false);g.play(g.level.solution[1]);assert.deepEqual(activePieces(g.level,g.state).map(p=>p.id),[0,2]);g.play(g.level.solution[0]);g.play(g.level.solution[2]);assert.deepEqual(activePieces(g.level,g.state).map(p=>p.id),[3,4,5]);assert.ok(g.undo());assert.deepEqual(activePieces(g.level,g.state).map(p=>p.id),[2]);assert.ok(g.level.pieces.some(p=>p.cells.length===5));
});
test('alternate choices yield a complete verified hint route or an exact undo, never a blind suggestion',()=>{
  for(const [name,rules] of Object.entries(modes))for(const index of [0,12,24,47]){const g=new PocketGame(rules,index),initial=clone(g.state),action=rules.actions(g.level,g.state).find(a=>JSON.stringify(a)!==JSON.stringify(g.level.solution[0]));assert.ok(action,`${name} allows choices`);assert.ok(g.play(action));const hint=g.hint();assert.ok(hint);if(hint.undo){assert.ok(g.undo());assert.deepEqual(g.state,initial);}else{const plan=rules.plan(g.level,g.state);assert.ok(plan?.length);for(const a of plan)assert.ok(g.play(a));assert.ok(g.won);}}
});
