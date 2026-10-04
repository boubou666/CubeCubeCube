import test from 'node:test';
import assert from 'node:assert/strict';
import { createColonyLevel, ColonyGame, reachable, outsidePaths, COLORS, encodeColonySave, decodeColonySave } from '../src/colony-puzzle.js';

test('all motifs and later tiers conserve every color and have complete five-slot solutions', () => {
  for (const index of [0, 1, 2, 3, 4, 5, 6, 17, 39, 99, 999999]) {
    const level = createColonyLevel(index), game = new ColonyGame(level);
    assert.deepEqual(level, createColonyLevel(index));
    for (const color of Object.keys(COLORS)) assert.equal(level.queues.flat().filter(b => b.color === color).reduce((n, b) => n + b.count, 0), level.cells.filter(c => c === color).length);
    for (const queue of level.solution) { assert.ok(game.launch(queue)); game.settle(); }
    assert.ok(game.won, `puzzle ${index}`); assert.equal(game.remaining, 0); assert.ok(game.state.slots.every(s => !s));
  }
});
test('enclosed pixels stay inaccessible until the outer ring opens', () => {
  const level = { width: 3, height: 3, cells: ['moss', 'moss', 'moss', 'moss', 'coral', 'moss', 'moss', 'moss', 'moss'] };
  assert.equal(reachable(level, [0, 1, 2, 3, 4, 5, 6, 7, 8], 'coral'), null);
  assert.ok(reachable(level, [0, 1, 2, 3, 4, 5, 6, 8], 'coral'));
  assert.ok(!outsidePaths(level, [1, 3, 5, 7]).has('1,1'), 'empty cavity still enclosed');
});
test('workers reserve unique pixels, pick up halfway and free a slot only after delivery', () => {
  const level = { width: 2, height: 1, cells: ['coral', 'coral'], queues: [[{ id: 0, color: 'coral', count: 1 }], [{ id: 1, color: 'coral', count: 1 }], [], []] };
  const game = new ColonyGame(level); game.launch(0); game.launch(1); game.advance(0);
  assert.equal(game.state.jobs.length, 2); assert.equal(new Set(game.state.jobs.map(j => j.cell)).size, 2);
  const dt = Math.max(...game.state.jobs.map(j => j.duration)) * .55; game.advance(dt);
  assert.equal(game.state.remaining.length, 0); assert.equal(game.remaining, 2); assert.ok(game.state.slots[0]); assert.ok(!game.won);
  game.advance(100); assert.ok(game.won); assert.equal(game.state.jobs.length, 0);
});
test('five blocked colors produce a real deadlock that undo and hints resolve', () => {
  const cells = Array(49).fill('moss'); for (const id of [16, 17, 18, 23, 24]) cells[id] = 'coral';
  const boxes = Array.from({ length: 5 }, (_, id) => ({ id, color: 'coral', count: 1 }));
  const level = { width: 7, height: 7, cells, queues: [boxes, [{ id: 5, color: 'moss', count: 44 }], [], []] };
  const game = new ColonyGame(level); for (let i = 0; i < 5; i++) game.launch(0);
  game.advance(0); assert.ok(game.stalled); assert.equal(game.launch(1), false); assert.equal(game.hint().type, 'undo');
  game.undo(); assert.ok(!game.stalled); assert.ok(game.launch(1)); game.settle(); assert.equal(game.state.remaining.length, 1);
  game.launch(0); game.settle(); assert.ok(game.won);
});
test('undo restores the exact state, including older workers already in flight', () => {
  const game = new ColonyGame(); game.launch(0); game.advance(.3); game.advance(.3);
  const previous = structuredClone(game.state); game.launch(1); game.settle();
  assert.ok(game.undo()); assert.deepEqual(game.state, previous); assert.ok(game.state.jobs.length);
});
test('saves round-trip both outward and returning trips, reject damage and preserve independent progress', () => {
  const game = new ColonyGame(); game.launch(0); game.advance(0); game.advance(1);
  const save = encodeColonySave(game, [0, 1], 2), restored = decodeColonySave(save);
  assert.deepEqual(restored.game.state, game.state); assert.equal(restored.speed, 2); assert.deepEqual(restored.completed, [0, 1]);
  game.settle(); restored.game.settle(); assert.deepEqual(restored.game.state, game.state);
  const damaged = structuredClone(save); damaged.state.remaining.push(99999); assert.equal(decodeColonySave(damaged), null);
  const mismatched = structuredClone(save); mismatched.state.slots[0].remaining = 999; assert.equal(decodeColonySave(mismatched), null);
  assert.equal(decodeColonySave({ version: 1, index: -1 }), null);
});
test('hints can finish every opening board from its current state', () => {
  for (let i = 0; i < 6; i++) {
    const game = new ColonyGame(createColonyLevel(i));
    for (let step = 0; !game.won && step < 40; step++) {
      const hint = game.hint(); assert.equal(hint.type, 'box'); assert.ok(game.launch(hint.queue)); game.settle();
    }
    assert.ok(game.won);
  }
});
