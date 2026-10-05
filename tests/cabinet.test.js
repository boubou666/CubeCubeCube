import test from 'node:test';
import assert from 'node:assert/strict';
import {PocketGame,clone,encodePocket,decodePocket} from '../src/pocket-core.js';
import {etageresRules} from '../src/etageres-puzzle.js';
import {duosRules,duoRoute} from '../src/duos-puzzle.js';
import {terriersRules} from '../src/terriers-puzzle.js';
import {SOIL,SoilFlow,excavate,simulateSoil} from '../src/terriers-physics.js';
const modes={etageres:etageresRules,duos:duosRules,terriers:terriersRules};
function conservation(name,g){const {level:l,state:s}=g;
  if(name==='etageres')for(let color=0;color<8;color++)assert.equal(s.fronts.flat().filter(v=>v===color).length+l.shelves.flatMap((rows,id)=>rows.slice(s.cursors[id]).flat()).filter(v=>v===color).length+s.collected[color],l.quotas[color]);
  if(name==='duos')assert.equal(s.field.filter(v=>v!==null&&v>=0).length+s.pairs*2,l.total);
  if(name==='terriers'){assert.equal(s.soil.filter(v=>v===1).length+s.removed,l.soil.filter(v=>v===1).length);assert.ok(s.removed<=l.budget);l.soil.forEach((v,id)=>{if(v===2)assert.equal(s.soil[id],2);});if(s.result)assert.equal(s.result.caught+s.result.lost+s.result.remaining,l.balls.length);}
}
for(const [name,rules] of Object.entries(modes)){
  test(`${name}: 48 distinct deterministic solutions conserve resources and restore every move exactly`,()=>{
    const unique=new Set();for(let index=0;index<48;index++){const g=new PocketGame(rules,index),initial=clone(g.state);unique.add(JSON.stringify({...g.level,index:0,title:''}));assert.deepEqual(rules.create(index),g.level);assert.equal(g.won,false);conservation(name,g);for(const a of g.level.solution){const old=clone(g.state);assert.ok(g.play(a),`${index} ${JSON.stringify(a)}`);conservation(name,g);assert.ok(g.undo());assert.deepEqual(g.state,old);assert.ok(g.play(a));}assert.ok(g.won);while(g.undo()){}assert.deepEqual(g.state,initial);}assert.equal(unique.size,48);
  });
  test(`${name}: saves replay actions and undo history, reject malformed data and preserve badges`,()=>{
    const g=new PocketGame(rules,47);for(const a of g.level.solution.slice(0,3))assert.ok(g.play(a));const save=encodePocket(g,new Set([0,47]),true),decoded=decodePocket(rules,save);assert.deepEqual(decoded.game.state,g.state);assert.deepEqual(decoded.game.history,g.history);assert.deepEqual([...decoded.completed],[0,47]);assert.equal(decoded.sound,true);g.undo();decoded.game.undo();assert.deepEqual(decoded.game.state,g.state);assert.equal(decodePocket(rules,{...save,moves:[{nope:1}]}),null);assert.equal(decodePocket(rules,{...save,index:48}),null);
  });
  test(`${name}: verified hints finish all chapter boundaries`,()=>{
    for(const index of [0,11,12,23,24,35,36,47]){const g=new PocketGame(rules,index);let guard=0;while(!g.won&&guard++<100){const h=g.hint();assert.ok(h?.action!==undefined,`${index}`);assert.ok(g.play(h.action));}assert.ok(g.won);}
  });
}
test('etageres: complete triples clear, hidden rows require a completely empty front, occupied targets reject',()=>{
  const l={shelves:[[[0,1,0],[2,2,2]],[[0,1,1]],[]]},s=etageresRules.initial(l);assert.equal(s.cursors[0],1);let next=etageresRules.move(l,s,{from:0,slot:1,to:2,cell:0});assert.equal(next.cursors[0],1);next=etageresRules.move(l,next,{from:1,slot:0,to:0,cell:1});assert.equal(next.collected[0],3);assert.equal(next.collected[2],3);assert.equal(next.cursors[0],2);assert.deepEqual(next.fronts[0],[null,null,null]);assert.equal(etageresRules.move(l,s,{from:0,slot:0,to:1,cell:0}),null);for(const a of [{from:-1,slot:0,to:2,cell:0},{from:0,slot:3,to:2,cell:0},{from:0,slot:0,to:0,cell:0}])assert.equal(etageresRules.move(l,s,a),null);
});
test('duos: outside border permits two elbows, occupied routes and three-elbow paths reject',()=>{
  const l={cols:4,rows:4},field=Array(16).fill(1);field[0]=field[12]=0;assert.deepEqual(duoRoute(l,{field},0,12),[[0,0],[-1,0],[-1,3],[0,3]]);const blocked=Array(16).fill(1);blocked[4]=blocked[11]=0;assert.equal(duoRoute(l,{field:blocked},4,11),null);assert.equal(duoRoute(l,{field},0,1),null);assert.equal(duosRules.move(l,{field,pairs:0},{a:0,b:0}),null);assert.equal(duosRules.move(l,{field,pairs:0},{a:0,b:99}),null);field[1]=null;field[2]=0;assert.deepEqual(duoRoute(l,{field},0,2),[[0,0],[2,0]]);
});
test('terriers: actual soil controls gravity, stones persist and identical excavation costs nothing twice',()=>{
  const l=terriersRules.create(47),initial=terriersRules.initial(l);assert.equal(simulateSoil(l,initial.soil).caught,0);const dug=excavate(initial.soil,l.solution[0].path);assert.ok(dug.removed);assert.equal(excavate(dug.soil,l.solution[0].path).removed,0);let state=initial;for(const a of l.solution.filter(a=>a.type==='dig'))state=terriersRules.move(l,state,a);const flow=new SoilFlow(l,state.soil);while(!flow.done){flow.step();assert.equal(flow.balls.filter(b=>b.status==='active').length+flow.caught+flow.lost,l.balls.length);}assert.equal(flow.caught,3);assert.deepEqual(flow.result(),simulateSoil(l,state.soil));const wrong={...l,cups:l.cups.map(c=>({...c,color:(c.color+1)%6}))};assert.equal(simulateSoil(wrong,state.soil).caught,0);assert.equal(simulateSoil(wrong,state.soil).lost,3);
});
test('terriers: budgets, failed trials, transactional strokes and clearing a custom tunnel',()=>{
  const g=new PocketGame(terriersRules,12),old=clone(g.state);for(const path of [[[0,0],[320,320]],[[320,100]],[[320,NaN],[320,400]]])assert.equal(g.play({type:'dig',path}),false);assert.deepEqual(g.state,old);assert.equal(terriersRules.move({...g.level,budget:1},g.state,g.level.solution[0]),null);assert.ok(g.play({type:'run'}));assert.equal(g.won,false);assert.ok(g.undo());assert.deepEqual(g.state,old);assert.ok(g.play({type:'dig',path:[[320,120],[320,260]]}));const plan=terriersRules.plan(g.level,g.state);assert.equal(plan[0].type,'clear');for(const a of plan)assert.ok(g.play(a));assert.ok(g.won);
});
test('terriers: every untouched level needs excavation; balls exchange impulses in a shared tunnel',()=>{
  for(let index=0;index<48;index++){const l=terriersRules.create(index);assert.equal(simulateSoil(l,l.soil).caught,0);}
  const l={balls:[{x:200,y:120,color:0},{x:213,y:120,color:1}],cups:[]},flow=new SoilFlow(l,Array(SOIL.cols*SOIL.rows).fill(0));flow.step();assert.ok(Math.hypot(flow.balls[0].x-flow.balls[1].x,flow.balls[0].y-flow.balls[1].y)>=SOIL.radius*2-.001);assert.equal(flow.caught+flow.lost,0);
});
test('alternate shelf and duo choices return a verified completion or exact undo',()=>{
  for(const rules of [etageresRules,duosRules])for(const index of [0,12,24,47]){const g=new PocketGame(rules,index),old=clone(g.state),a=rules.actions(g.level,g.state).find(a=>JSON.stringify(a)!==JSON.stringify(g.level.solution[0]));assert.ok(a);assert.ok(g.play(a));const hint=g.hint();assert.ok(hint);if(hint.undo){g.undo();assert.deepEqual(g.state,old);}else{const plan=rules.plan(g.level,g.state);assert.ok(plan);for(const a of plan)assert.ok(g.play(a));assert.ok(g.won);}}
});
