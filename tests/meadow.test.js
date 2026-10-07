import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_SAMPLE} from './campaign-sample.js';
import {PocketGame,clone,encodePocket,decodePocket} from '../src/pocket-core.js';
import {basculesRules,rollCells,rollPose} from '../src/bascules-puzzle.js';
import {sillonsRules,paintSlide} from '../src/sillons-puzzle.js';
import {raccordsRules,jointConnections,jointCanShift} from '../src/raccords-puzzle.js';
import {rollingVertices} from '../src/roll-geometry.js';

const modes={bascules:basculesRules,sillons:sillonsRules,raccords:raccordsRules};
for(const [name,rules]of Object.entries(modes)){
  test(`${name}: sampled deterministic layouts finish legally and undo every action exactly`,()=>{
    const unique=new Set();for(const index of CAMPAIGN_SAMPLE){
      const g=new PocketGame(rules,index),initial=clone(g.state),signature=clone(g.level);delete signature.index;delete signature.title;delete signature.solution;unique.add(JSON.stringify(signature));assert.deepEqual(rules.create(index),g.level);assert.equal(g.won,false);
      for(const action of g.level.solution){const before=clone(g.state);assert.ok(g.play(action),`${name} ${index+1} ${JSON.stringify(action)}`);if(name==='sillons')assert.ok(before.painted.every((v,id)=>!v||g.state.painted[id]));if(name==='raccords')assert.equal(new Set(g.state.positions).size,g.level.pieces.length);assert.ok(g.undo());assert.deepEqual(g.state,before);assert.ok(g.play(action));}
      assert.ok(g.won,`${name} ${index+1}`);while(g.undo()){}assert.deepEqual(g.state,initial);
    }assert.equal(unique.size,CAMPAIGN_SAMPLE.length);assert.throws(()=>rules.create(-1));assert.throws(()=>rules.create(48));
  });
  test(`${name}: sampled hint routes make finite progress across chapter boundaries`,()=>{
    for(const index of CAMPAIGN_SAMPLE){const g=new PocketGame(rules,index),seen=new Set();let guard=0;while(!g.won&&guard++<180){const key=JSON.stringify(g.state);assert.ok(!seen.has(key),`${name} ${index+1} repeated hint`);seen.add(key);const hint=g.hint();assert.ok(hint?.action);assert.ok(g.play(hint.action));}assert.ok(g.won);}
  });
  test(`${name}: saved moves reconstruct exact state, undo history and badges`,()=>{
    const g=new PocketGame(rules,47);for(const a of g.level.solution.slice(0,3))assert.ok(g.play(a));const save=encodePocket(g,new Set([0,47]),true),read=decodePocket(rules,save);assert.deepEqual(read.game.state,g.state);assert.deepEqual(read.game.history,g.history);assert.equal(read.sound,true);assert.deepEqual([...read.completed],[0,47]);g.undo();read.game.undo();assert.deepEqual(read.game.state,g.state);for(const bad of [{...save,moves:[{dir:9,id:99,type:'bad'}]},{...save,index:48},{...save,moves:[null]}])assert.equal(decodePocket(rules,bad),null);
  });
}
test('bascules: soft and upright-only plates toggle actual bridges; fragile floors reject standing weight',()=>{
  const l={cols:8,rows:3,field:Array.from({length:24},()=>({kind:'stone'})),goal:23},s={x:0,y:1,pose:'upright',gates:0};l.field[9]={kind:'plate',gate:0,hard:false};l.field[12]={kind:'bridge',gate:0};let next=basculesRules.move(l,s,{dir:1});assert.equal(next.gates,1);assert.deepEqual(rollCells(next),[[1,1],[2,1]]);next=basculesRules.move(l,next,{dir:1});assert.equal(next.pose,'upright');assert.ok(basculesRules.move(l,next,{dir:1}));assert.equal(basculesRules.move(l,{...next,gates:0},{dir:1}),null);assert.equal(basculesRules.move(l,next,{dir:3}).gates,0);
  l.field[9].hard=true;assert.equal(basculesRules.move(l,s,{dir:1}).gates,0);l.field[11]={kind:'plate',gate:0,hard:true};const lying=basculesRules.move(l,s,{dir:1});assert.equal(basculesRules.move(l,lying,{dir:1}).gates,1);l.field[11]={kind:'fragile'};assert.equal(basculesRules.move(l,lying,{dir:1}),null);l.field[9]={kind:'fragile'};assert.ok(basculesRules.move(l,s,{dir:1}));assert.deepEqual(s,{x:0,y:1,pose:'upright',gates:0});
});
test('bascules: a real quarter roll ends on the discrete footprint, keeps rigid edges and stays above its pivot',()=>{
  for(const pose of ['upright','east','south'])for(let dir=0;dir<4;dir++){
    const s={x:3,y:3,pose,gates:0},end=rollingVertices(s,dir,1),next=rollPose(s,dir),cells=rollCells(next);assert.ok(Math.abs(Math.min(...end.map(p=>p[0]))-Math.min(...cells.map(p=>p[0])))<1e-9);assert.ok(Math.abs(Math.min(...end.map(p=>p[1]))-Math.min(...cells.map(p=>p[1])))<1e-9);assert.ok(Math.abs(Math.max(...end.map(p=>p[0]))-Math.max(...cells.map(p=>p[0]))-1)<1e-9);assert.ok(Math.abs(Math.max(...end.map(p=>p[1]))-Math.max(...cells.map(p=>p[1]))-1)<1e-9);
    const before=rollingVertices(s),during=rollingVertices(s,dir,.41);assert.ok(during.every(p=>p[2]>=-1e-9&&p.every(Number.isFinite)));for(let id=1;id<8;id++)assert.ok(Math.abs(Math.hypot(...before[id].map((v,n)=>v-before[0][n]))-Math.hypot(...during[id].map((v,n)=>v-during[0][n])))<1e-9);
  }
});
test('sillons: halts stop actual strokes, arrows restrict departures, and only crossed cells are painted',()=>{
  const l={cols:5,rows:3,field:Array(15).fill(true),start:5,stops:[7],arrows:{7:2}},s=sillonsRules.initial(l);assert.deepEqual(paintSlide(l,5,1),[5,6,7]);const next=sillonsRules.move(l,s,{dir:1});assert.equal(next.at,7);assert.deepEqual(next.painted.map((v,id)=>v?id:null).filter(v=>v!==null),[5,6,7]);assert.equal(sillonsRules.move(l,next,{dir:3}),null);assert.deepEqual(paintSlide(l,7,2),[7,12]);assert.equal(s.painted.filter(Boolean).length,1);assert.equal(paintSlide(l,0,0),null);
});
test('raccords: six movement permissions, occupied places and bounds are transactional',()=>{
  const l=raccordsRules.create(47),s=raccordsRules.initial(l),before=clone(s);for(const p of l.pieces){const turn=raccordsRules.move(l,s,{type:'turn',id:p.id});assert.equal(Boolean(turn),!['fixed','move','line'].includes(p.kind));if(turn)assert.deepEqual(turn.positions,s.positions);if(['fixed','pivot'].includes(p.kind))assert.equal(jointCanShift(l,s,p.id,l.cols*l.rows-1),false);if(['line','line-turn'].includes(p.kind)){const wrong=Array.from({length:l.cols*l.rows},(_,id)=>id).find(id=>!s.positions.includes(id)&&Math.floor(id/l.cols)!==Math.floor(s.positions[p.id]/l.cols));assert.equal(jointCanShift(l,s,p.id,wrong),false);}}
  for(const a of [{type:'shift',id:2,to:s.positions[0]},{type:'shift',id:2,to:-1},{type:'shift',id:2,to:.5},{type:'turn',id:99}])assert.equal(raccordsRules.move(l,s,a),null);assert.deepEqual(s,before);
});
test('raccords: all colored ports must close and separate completed loops do not win',()=>{
  const l={cols:3,rows:1,pieces:[{id:0,ports:[null,0,null,null]},{id:1,ports:[null,null,null,0]}]},s={positions:[0,1],turns:[0,0]};assert.ok(raccordsRules.won(l,s));assert.equal(jointConnections(l,s).matched,1);assert.equal(raccordsRules.won(l,{...s,positions:[0,2]}),false);l.pieces[1].ports[3]=1;assert.equal(raccordsRules.won(l,s),false);
  const pattern=[[null,0,0,null],[null,null,0,0],[0,0,null,null],[0,null,null,0]],loops={cols:5,rows:2,pieces:Array.from({length:8},(_,id)=>({id,ports:pattern[id%4]}))},separate={positions:[0,1,5,6,3,4,8,9],turns:Array(8).fill(0)},connected=jointConnections(loops,separate);assert.ok(connected.loose.every(n=>n===0));assert.equal(connected.groups.length,2);assert.equal(raccordsRules.won(loops,separate),false);
});
test('alternate legal choices have a verified finish or an exact undo rather than a blind hint',()=>{
  for(const [name,rules]of Object.entries(modes))for(const index of [0,12,24,47]){const g=new PocketGame(rules,index),before=clone(g.state),actions=rules.actions(g.level,g.state),a=actions.find(a=>JSON.stringify(a)!==JSON.stringify(g.level.solution[0])&&rules.move(g.level,g.state,a));assert.ok(a,`${name} ${index}`);assert.ok(g.play(a));if(g.won)continue;const hint=g.hint();assert.ok(hint);if(hint.undo){g.undo();assert.deepEqual(g.state,before);}else{const plan=rules.plan(g.level,g.state);assert.ok(plan);for(const step of plan)assert.ok(g.play(step));assert.ok(g.won);}}
});
