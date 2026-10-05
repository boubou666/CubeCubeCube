import test from 'node:test';
import assert from 'node:assert/strict';
import {PocketGame,clone,encodePocket,decodePocket} from '../src/pocket-core.js';
import {ruisseauxRules,waterRoute} from '../src/ruisseaux-puzzle.js';
import {balancierRules} from '../src/balancier-puzzle.js';
import {CandyFlow,simulateCandy} from '../src/balancier-physics.js';
import {geleesRules,jellyCells,jellyDrop} from '../src/gelees-puzzle.js';
import {JellySpring} from '../src/jelly-springs.js';
const modes={ruisseaux:ruisseauxRules,balancier:balancierRules,gelees:geleesRules};
for(const [name,rules] of Object.entries(modes)){
  test(`${name}: all 48 deterministic distinct boards complete and undo every move exactly`,()=>{
    const unique=new Set();for(let index=0;index<48;index++){const g=new PocketGame(rules,index),initial=clone(g.state);assert.equal(g.won,false);assert.deepEqual(rules.create(index),g.level);unique.add(JSON.stringify({...g.level,index:0,title:''}));for(const a of g.level.solution){const before=clone(g.state);assert.ok(g.play(a),`${index} ${JSON.stringify(a)}`);if(name==='ruisseaux')assert.deepEqual(g.state.field.filter(v=>v!==null).sort((a,b)=>a-b),initial.field.filter(v=>v!==null).sort((a,b)=>a-b));if(name==='gelees')assert.equal(g.state.field.filter(v=>v!==null&&v>=0).length,g.state.used.reduce((n,id)=>n+g.level.pieces[id].cells.length,0));assert.ok(g.undo());assert.deepEqual(g.state,before);assert.ok(g.play(a));}assert.ok(g.won);while(g.undo()){}assert.deepEqual(g.state,initial);}assert.equal(unique.size,48);
  });
  test(`${name}: saves reconstruct cuts/placements, undo history and badges and reject bad actions`,()=>{
    const g=new PocketGame(rules,47);for(const a of g.level.solution.slice(0,2))assert.ok(g.play(a));const save=encodePocket(g,new Set([0,47]),true),restored=decodePocket(rules,save);assert.deepEqual(restored.game.state,g.state);assert.deepEqual(restored.game.history,g.history);assert.deepEqual([...restored.completed],[0,47]);assert.equal(restored.sound,true);g.undo();restored.game.undo();assert.deepEqual(restored.game.state,g.state);assert.equal(decodePocket(rules,{...save,moves:[{bad:true}]}),null);assert.equal(decodePocket(rules,{...save,index:48}),null);
  });
  test(`${name}: hints finish every chapter boundary without repeated-state loops`,()=>{
    for(let index=0;index<48;index++){const g=new PocketGame(rules,index),seen=new Set();let guard=0;while(!g.won&&guard++<100){const key=JSON.stringify(g.state);assert.ok(!seen.has(key));seen.add(key);const hint=g.hint();assert.ok(hint?.action!==undefined);assert.ok(g.play(hint.action));}assert.ok(g.won);}
  });
}
test('ruisseaux: reciprocal ports, flower coverage, fixed tiles and row boundaries matter',()=>{
  const l={size:3,source:0,goal:2,stars:[1],tiles:[{mask:2,fixed:true},{mask:10},{mask:8,fixed:true},{mask:5}]},s={field:[0,1,2,null,null,null,null,null,null]};assert.deepEqual(waterRoute(l,s),{path:[0,1,2],reached:true,stars:1});assert.ok(ruisseauxRules.won(l,s));assert.equal(ruisseauxRules.won({...l,stars:[4]},s),false);assert.equal(waterRoute(l,{field:[0,3,2,null,null,null,null,null,null]}).reached,false);assert.equal(ruisseauxRules.move(l,s,{from:0,to:3}),null);assert.equal(ruisseauxRules.move(l,s,{from:2,to:3}),null);assert.equal(ruisseauxRules.move(l,s,{from:1,to:2}),null);assert.ok(ruisseauxRules.move(l,s,{from:1,to:4}));
});
test('balancier: rope tension constrains distance; cutting preserves real momentum and timing changes the landing',()=>{
  const l=balancierRules.create(0),held=new CandyFlow(l);for(let n=0;n<100;n++){held.step();const r=l.ropes[0];assert.ok(Math.hypot(held.ball.x-r.x,held.ball.y-r.y)<=r.length+.001);}const good=simulateCandy(l,l.solution),early=simulateCandy(l,[{rope:0,tick:0}]);assert.ok(good.caught);assert.equal(good.collected.length,l.stars.length);assert.ok(!early.caught||early.collected.length<l.stars.length);const flow=simulateCandy(l,l.solution,l.solution[0].tick+1),x=flow.ball.x;for(let n=0;n<30;n++)flow.step();assert.ok(Math.abs(flow.ball.x-x)>2);assert.ok(!flow.cut.has(5));
});
test('balancier: every petal is required, duplicate/nonmonotonic/out-of-range cuts reject and detours offer exact undo',()=>{
  const l=balancierRules.create(47),s=balancierRules.initial(l),first=balancierRules.move(l,s,l.solution[0]);for(const a of [{rope:3,tick:0},{rope:0,tick:-1},{rope:0,tick:36001},{rope:0,tick:NaN},{rope:0,tick:.1}])assert.equal(balancierRules.move(l,s,a),null);assert.equal(balancierRules.move(l,first,l.solution[0]),null);assert.equal(balancierRules.move(l,first,{rope:0,tick:0}),null);assert.equal(balancierRules.won(l,{result:{caught:true,collected:[]}}),false);const g=new PocketGame(balancierRules);assert.ok(g.play({rope:0,tick:0}));assert.deepEqual(g.hint(),{undo:true});
});
test('gelees: rotations retain area, gravity lands on first support and overflow and reused pieces reject',()=>{
  const l={cols:3,rows:4,pieces:[{id:0,cells:[[0,0],[0,1],[1,1]],color:0},{id:1,cells:[[0,0]],color:1}]},s={field:Array(12).fill(null),used:[],placed:[]};for(let n=0;n<4;n++){const cells=jellyCells(l.pieces[0],n);assert.equal(cells.length,3);assert.equal(new Set(cells.map(p=>p.join(','))).size,3);}assert.deepEqual(jellyCells(l.pieces[0],4),l.pieces[0].cells);assert.equal(jellyDrop(l,s,l.pieces[0],0,0).y,2);const placed=geleesRules.move(l,s,{id:0,turns:0,x:0});assert.equal(jellyDrop(l,placed,l.pieces[1],0,0).y,1);assert.equal(geleesRules.move(l,placed,{id:0,turns:0,x:0}),null);assert.equal(geleesRules.move(l,s,{id:0,turns:0,x:2}),null);const full={...s,field:Array(12).fill(1)};assert.equal(jellyDrop(l,full,l.pieces[1],0,0),null);
});
test('gelees: wrong overhang order blocks a complementary piece and no filled line disappears',()=>{
  const l={cols:3,rows:2,pieces:[{id:0,cells:[[0,0],[0,1],[1,1]],color:0},{id:1,cells:[[0,0],[1,0],[1,1]],color:1}]},s={field:Array(6).fill(null),used:[],placed:[]};const good=geleesRules.move(l,s,{id:0,turns:0,x:0}),won=geleesRules.move(l,good,{id:1,turns:0,x:1});assert.ok(geleesRules.won(l,won));assert.ok(won.field.every(v=>v!==null));const bad=geleesRules.move(l,s,{id:1,turns:0,x:1});assert.equal(geleesRules.move(l,bad,{id:0,turns:0,x:0}),null);
});
test('jelly springs weld shared corners and settle with finite positions near the mould',()=>{
  const spring=new JellySpring([[0,0],[1,0],[0,1]],100,250,60,100);assert.equal(spring.nodes.length,8);assert.equal(spring.quads.length,3);while(!spring.done){spring.step();assert.ok(spring.nodes.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}assert.ok(spring.nodes.every(p=>Math.hypot(p.x-p.tx,p.y-p.ty)<2));
});
test('balancier: rocks deflect the actual trajectory and resolve a berry starting inside a stone',()=>{
  const base={ball:{x:200,y:100,vx:0},ropes:[],stars:[],cup:null,obstacles:[]},free=simulateCandy(base,[],100),blocked=simulateCandy({...base,obstacles:[{x:175,y:160,w:50,h:30}]},[],100);assert.ok(blocked.ball.y<free.ball.y-50);const inside=new CandyFlow({...base,obstacles:[{x:190,y:90,w:30,h:30}]});inside.step();assert.ok(inside.ball.x<=179||inside.ball.x>=231||inside.ball.y<=79||inside.ball.y>=131);
});
