import test from 'node:test';
import assert from 'node:assert/strict';
import {PocketGame,clone,encodePocket,decodePocket} from '../src/pocket-core.js';
import {plisRules,paperTop} from '../src/plis-puzzle.js';
import {luciolesRules,lightTrace} from '../src/lucioles-puzzle.js';
import {aiguillagesRules} from '../src/aiguillages-puzzle.js';
import {RailFlow,simulateRails} from '../src/rail-simulation.js';
const modes={plis:plisRules,lucioles:luciolesRules,aiguillages:aiguillagesRules};
for(const [name,rules] of Object.entries(modes)){
  test(`${name}: 48 distinct deterministic initial puzzles, full solutions, conservation and exact undo`,()=>{
    const unique=new Set();for(let index=0;index<48;index++){const g=new PocketGame(rules,index),initial=clone(g.state);assert.deepEqual(rules.create(index),g.level);assert.equal(g.won,false);unique.add(JSON.stringify({...g.level,index:0,title:'',solution:[]}));for(const a of g.level.solution){const old=clone(g.state);assert.ok(g.play(a),`${index} ${JSON.stringify(a)}`);if(name==='plis')assert.deepEqual(g.state.field.flat().map(p=>p[0]).sort((a,b)=>a-b),initial.field.flat().map(p=>p[0]).sort((a,b)=>a-b));if(name==='aiguillages'&&g.state.result)assert.equal(g.state.result.caught+g.state.result.lost,g.level.trains.length);assert.ok(g.undo());assert.deepEqual(g.state,old);assert.ok(g.play(a));}assert.ok(g.won,`${name} ${index}`);while(g.undo()){}assert.deepEqual(g.state,initial);}assert.equal(unique.size,48);
  });
  test(`${name}: validated saves reconstruct every action, history and earned badges`,()=>{
    const g=new PocketGame(rules,47);for(const a of g.level.solution.slice(0,2))assert.ok(g.play(a));const saved=encodePocket(g,new Set([0,47]),true),restored=decodePocket(rules,saved);assert.deepEqual(restored.game.state,g.state);assert.deepEqual(restored.game.history,g.history);assert.deepEqual([...restored.completed],[0,47]);assert.equal(restored.sound,true);g.undo();restored.game.undo();assert.deepEqual(g.state,restored.game.state);assert.equal(decodePocket(rules,{...saved,moves:[{bad:true}]}),null);assert.equal(decodePocket(rules,{...saved,index:48}),null);
  });
  test(`${name}: verified hints finish all 48 boards`,()=>{
    for(let index=0;index<48;index++){const g=new PocketGame(rules,index);let guard=0;while(!g.won&&guard++<60){const h=g.hint();assert.ok(h?.action!==undefined,`${index}`);assert.ok(g.play(h.action));}assert.ok(g.won,`${index}`);}
  });
}
test('plis: a fold reflects the whole half, reverses every layer and flips recto/verso',()=>{
  const l={size:4,faces:[[0,1],[2,3],[4,5]],target:[]},s={field:Array.from({length:16},()=>[])};s.field[0]=[[0,0],[1,1]];s.field[1]=[[2,0]];const n=plisRules.move(l,s,{axis:'x',line:1,side:-1});assert.deepEqual(n.field[1],[[2,0],[1,0],[0,1]]);assert.equal(paperTop(l,n.field[1]),1);assert.deepEqual(n.field[0],[]);assert.deepEqual(s.field[0],[[0,0],[1,1]]);assert.equal(plisRules.move(l,s,{axis:'x',line:3,side:-1}),null);assert.equal(plisRules.move(l,s,{axis:'x',line:1,side:0}),null);
});
test('plis: different fold orders really change the visible picture',()=>{
  let found=false;for(let index=12;index<48&&!found;index++){const l=plisRules.create(index),s=plisRules.initial(l),sol=[...l.solution];if(sol.length<3)continue;[sol[0],sol[1]]=[sol[1],sol[0]];let next=s;for(const a of sol){next=plisRules.move(l,next,a);if(!next)break;}if(next&&!plisRules.won(l,next))found=true;}assert.ok(found);
});
test('lucioles: reciprocal prism openings, colored absorbing crystals, rocks and finite light loops',()=>{
  const l={size:5,field:Array(25).fill(null),sources:[{cell:10,dir:1,color:0}],gems:[2,14]},turns=Array(25).fill(0);l.field[12]={type:'prism'};l.field[2]={type:'gem',color:0};l.field[14]={type:'gem',color:0};let trace=lightTrace(l,{turns});assert.deepEqual([...trace.lit].sort((a,b)=>a-b),[2,14]);turns[12]=1;assert.equal(lightTrace(l,{turns}).lit.length,0);turns[12]=0;l.field[14].color=1;assert.equal(lightTrace(l,{turns}).lit.length,1);l.field[7]={type:'rock'};assert.equal(lightTrace(l,{turns}).lit.length,0);
  const loop={size:4,field:Array(16).fill(null),sources:[{cell:5,dir:1,color:0}],gems:[]},r=Array(16).fill(0);for(const [id,turn] of [[6,1],[10,0],[9,1],[5,0]]){loop.field[id]={type:'mirror'};r[id]=turn;}assert.ok(lightTrace(loop,{turns:r}).segments.length<=16);assert.equal(luciolesRules.move(l,{turns},{id:2}),null);
});
test('lucioles: alternate mirror choices get a verified finite completion rather than repeated hint states',()=>{
  for(const index of [0,12,24,47]){const g=new PocketGame(luciolesRules,index),a=luciolesRules.actions(g.level,g.state).at(-1);assert.ok(g.play(a));const seen=new Set();let guard=0;while(!g.won&&guard++<35){const key=JSON.stringify(g.state);assert.ok(!seen.has(key));seen.add(key);const h=g.hint();assert.ok(h?.action);assert.ok(g.play(h.action));}assert.ok(g.won);}
});
test('aiguillages: identical crossing times collide; departure spacing clears locomotives and wagons',()=>{
  for(const index of [12,24,36,47]){const l=aiguillagesRules.create(index),danger={switches:l.targets,delays:l.delays};assert.ok(simulateRails(l,danger).lost>0);const safe={switches:l.targets,delays:l.safeDelays},flow=new RailFlow(l,safe);while(!flow.done)flow.step();assert.deepEqual(flow.result(),simulateRails(l,safe));assert.equal(flow.result().caught,l.trains.length);}
});
test('aiguillages: actual rail interruption, wrong station colors, trial replay and corrupted delays reject',()=>{
  const g=new PocketGame(aiguillagesRules,47),l=g.level,safe={switches:l.targets,delays:l.safeDelays},broken=clone(l),rail=broken.field.findIndex(t=>t?.type==='rail');broken.field[rail]={type:'pond',mask:0};assert.ok(simulateRails(broken,safe).lost>0);const wrong=clone(l);wrong.field.forEach(t=>{if(t?.type==='station')t.color=(t.color+1)%6;});assert.equal(simulateRails(wrong,safe).caught,0);for(const a of [{type:'delay',id:0,value:-1},{type:'delay',id:0,value:13},{type:'delay',id:4,value:0},{type:'switch',id:100}])assert.equal(g.play(a),false);assert.ok(g.play({type:'run'}));assert.ok(!g.won);const save=encodePocket(g,new Set()),r=decodePocket(aiguillagesRules,save);assert.deepEqual(r.game.state,g.state);assert.ok(g.undo());assert.equal(g.state.result,null);const plan=aiguillagesRules.plan(l,g.state);for(const a of plan)assert.ok(g.play(a));assert.ok(g.won);
});
test('aiguillages: opposing locomotives cannot exchange the same edge',()=>{
  const field=Array(9).fill(null);for(const id of [3,4,5])field[id]={type:'rail',mask:10};const l={size:3,field,switches:[],trains:[{source:3,dir:1,color:0,length:1},{source:4,dir:3,color:1,length:1}]},r=simulateRails(l,{switches:[],delays:[0,0]});assert.equal(r.lost,2);assert.ok(r.trains.every(t=>t.status==='crashed'));
});
test('aiguillages: a wagon keeps the crossing occupied after its locomotive leaves',()=>{
  const field=Array(9).fill(null);field[3]={type:'source',mask:2};field[1]={type:'source',mask:4};field[4]={type:'cross',mask:15};field[5]={type:'station',mask:8,color:0};field[7]={type:'station',mask:1,color:1};const l={size:3,field,switches:[],trains:[{source:3,dir:1,color:0,length:1},{source:1,dir:2,color:1,length:1}]};assert.equal(simulateRails(l,{switches:[],delays:[0,1]}).caught,2);l.trains[0].length=2;assert.equal(simulateRails(l,{switches:[],delays:[0,1]}).lost,2);assert.equal(simulateRails(l,{switches:[],delays:[0,2]}).caught,2);
});
