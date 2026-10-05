import test from 'node:test';
import assert from 'node:assert/strict';
import { PocketGame, encodePocket, decodePocket, searchPlan } from '../src/pocket-core.js';
import { atelierRules, exposedPlate } from '../src/atelier-puzzle.js';
import { bobinesRules } from '../src/bobines-puzzle.js';
import { escapadeRules } from '../src/escapade-puzzle.js';

const all = { atelier:atelierRules, bobines:bobinesRules, escapade:escapadeRules };
for (const [name, rules] of Object.entries(all)) {
  test(`${name}: 48 distinct deterministic boards have complete legal solutions and rising sizes`, () => {
    const layouts = new Set(); let firstSize, lastSize;
    for (let index = 0; index < 48; index++) {
      const level = rules.create(index); assert.deepEqual(level, rules.create(index));
      layouts.add(JSON.stringify(name === 'atelier' ? [level.plates, level.screws, level.boxes] : name === 'bobines' ? [level.lines, level.queues] : [level.snakes, level.walls]));
      const game = new PocketGame(rules, index), original = structuredClone(game.state);
      const size = name === 'atelier' ? level.screws.length : name === 'bobines' ? level.lines.flat().length : level.size * level.snakes.length;
      if (index === 0) firstSize = size; if (index === 47) lastSize = size;
      for (const action of level.solution) {
        const before = structuredClone(game.state); assert.equal(game.play(action), true, `${name} ${index + 1} ${JSON.stringify(action)}`);
        assert.deepEqual(game.history.at(-1), before);
      }
      assert.equal(game.won, true, `Puzzle ${index + 1}`);
      while (game.history.length) game.undo(); assert.deepEqual(game.state, original);
    }
    assert.equal(layouts.size, 48); assert.ok(lastSize > firstSize);
    assert.throws(() => rules.create(48)); assert.throws(() => rules.create(-1)); assert.throws(() => rules.create(1.5));
  });
  test(`${name}: save replay retains exact state and undo; invalid saves fail safely`, () => {
    const game = new PocketGame(rules, 39);
    for (const action of game.level.solution.slice(0, 5)) assert.ok(game.play(action));
    const saved = encodePocket(game, new Set([0, 1, 47]), true), restored = decodePocket(rules, saved);
    assert.ok(restored); assert.deepEqual(restored.game.state, game.state); assert.deepEqual(restored.game.history, game.history); assert.equal(restored.sound, true);
    game.undo(); restored.game.undo(); assert.deepEqual(restored.game.state, game.state);
    for (const invalid of [null, {}, { ...saved, version:9 }, { ...saved, index:48 }, { ...saved, moves:[null] }, { ...saved, moves:[{ id:99, to:[0,0] }] }]) assert.equal(decodePocket(rules, invalid), null);
    game.restart(); assert.deepEqual(game.state, rules.initial(game.level)); assert.equal(game.history.length, 0);
  });
  test(`${name}: hints prove a complete route from canonical partial states`, () => {
    for (const index of [0, 11, 12, 23, 24, 35, 36, 47]) {
      const game = new PocketGame(rules, index);
      for (const action of game.level.solution.slice(0, Math.floor(game.level.solution.length / 2))) assert.ok(game.play(action));
      const plan = rules.plan ? rules.plan(game.level, game.state) : searchPlan(rules, game.level, game.state);
      assert.ok(plan?.length, `${name} ${index}`); for (const action of plan) assert.ok(game.play(action)); assert.ok(game.won);
    }
  });
}
test('atelier: covered screws cannot be removed and matching boxes consume exactly three', () => {
  const game = new PocketGame(atelierRules, 24);
  const buried = game.level.plates.find(p => !exposedPlate(game.level, game.state, p));
  const before = structuredClone(game.state); assert.equal(game.play(buried.screws[0]), false); assert.deepEqual(game.state, before);
  for (const action of game.level.solution) {
    assert.ok(game.play(action)); assert.ok(game.state.buffer.length <= game.level.bufferSize); assert.ok(game.state.trays.every(t => !t || t.count < 3));
  }
  assert.ok(game.won); assert.ok(!game.state.trays.some(Boolean));
});
test('bobines: buried colors wait and a full reserve blocks new launches without changing state', () => {
  let deadlock;
  for (let index = 12; index < 48 && !deadlock; index++) {
    const level = bobinesRules.create(index), queue = [{ state:bobinesRules.initial(level), moves:[] }], seen = new Set();
    for (let n = 0; n < queue.length && n < 1000; n++) {
      const { state, moves } = queue[n];
      if (!state.slots.includes(null) && !bobinesRules.won(level, state)) { deadlock = { level, state, moves }; break; }
      for (const action of bobinesRules.actions(level, state)) { const next = bobinesRules.move(level, state, action), key = JSON.stringify(next); if (!seen.has(key)) { seen.add(key); queue.push({ state:next, moves:[...moves, action] }); } }
    }
  }
  assert.ok(deadlock); const game = new PocketGame(bobinesRules, deadlock.level.index);
  for (const move of deadlock.moves) game.play(move);
  const before = structuredClone(game.state); assert.equal(game.play(0), false); assert.deepEqual(game.state, before); assert.deepEqual(game.hint(), { undo:true }); assert.ok(game.undo()); assert.ok(game.state.slots.includes(null));
});
test('escapade: walls, bodies, wrong holes, nonadjacent moves and malformed coordinates block', () => {
  const game = new PocketGame(escapadeRules, 47), initial = structuredClone(game.state);
  for (const action of [{ id:0, end:'head', to:[99, 99] }, { id:0, end:'foot', to:[0, 0] }, { id:0, end:'head', to:[NaN, 0] }, { id:0, end:'head', to:[1.5, 1] }]) assert.equal(game.play(action), false);
  const snake = game.state.snakes[0]; assert.equal(game.play({ id:snake.id, end:'head', to:snake.cells[1] }), false); assert.deepEqual(game.state, initial);
  for (const snake of game.state.snakes) for (const end of ['head', 'tail']) {
    const head = end === 'head' ? snake.cells[0] : snake.cells.at(-1);
    for (const to of [...game.level.walls, ...game.level.snakes.filter(s => s.id !== snake.id).map(s => s.hole)]) {
      if (Math.abs(head[0] - to[0]) + Math.abs(head[1] - to[1]) === 1) assert.equal(escapadeRules.move(game.level, game.state, { id:snake.id, end, to }), null);
    }
  }
  const first = game.level.solution[0]; assert.ok(game.play(first)); const plan = escapadeRules.plan(game.level, game.state); assert.ok(plan?.length);
});
