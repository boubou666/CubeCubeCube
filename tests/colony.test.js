import { COLONY_SAMPLE } from './campaign-sample.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NEW_COLONY_ART, ART_COLORS } from '../src/colony-art.js';
import { createColonyLevel, createLegacyColonyLevel, ColonyGame, reachable, outsidePaths, COLORS, MOTIFS, colonyDifficulty, encodeColonySave, decodeColonySave } from '../src/colony-puzzle.js';

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
test('every available matching block gets a worker, without a four-worker cap', () => {
  const level = { width: 8, height: 4, cells: Array(32).fill('coral'), queues: [[{ id: 0, color: 'coral', count: 32 }], [], [], []] };
  const game = new ColonyGame(level); game.launch(0); game.advance(0);
  assert.equal(game.state.jobs.length, 20, 'all perimeter cubes are reserved immediately');
  assert.equal(new Set(game.state.jobs.map(j => j.cell)).size, 20);
  game.advance(100); assert.equal(game.state.jobs.length, 12, 'newly exposed cubes get workers in the same update');
  game.advance(100); assert.ok(game.won);
});

test('original pictures and representative campaign solutions conserve quotas', () => {
  assert.equal(MOTIFS.length, 24); assert.equal(new Set(MOTIFS).size, 24);
  for (const art of NEW_COLONY_ART) {
    assert.equal(art.rows.length, 16);
    for (const row of art.rows) { assert.equal(row.length, 16); assert.ok([...row].every(c => c === '.' || ART_COLORS[c])); }
  }
  const pictures = new Set();
  for (const index of COLONY_SAMPLE) {
    const level = createColonyLevel(index), game = new ColonyGame(level);
    if (index < 24) pictures.add(level.cells.join(','));
    for (const color of Object.keys(COLORS)) assert.equal(level.cells.filter(c => c === color).length, level.queues.flat().filter(b => b.color === color).reduce((n, b) => n + b.count, 0));
    for (const q of level.solution) { assert.ok(game.launch(q), `launch ${index}`); game.settle(); }
    assert.ok(game.won, `complete ${index}`);
  }
  assert.equal(pictures.size, COLONY_SAMPLE.filter(index => index < 24).length);
});
test('difficulty grows through board size, overlapping waiting boxes and more colours', () => {
  assert.equal(createColonyLevel(0).width, 16); assert.equal(createColonyLevel(6).width, 20);
  assert.equal(createColonyLevel(48).width, 22); assert.equal(createColonyLevel(72).width, 24);
  assert.deepEqual([0, 6, 24, 48, 72].map(i => colonyDifficulty(i).name), ['Découverte', 'Malin', 'Corsé', 'Difficile', 'Expert']);
  for (const index of [72, 80, 99, 144]) {
    const level = createColonyLevel(index); assert.ok(level.pressure.maxOccupied >= 4); assert.ok(level.pressure.waitingMoves >= 3); assert.ok(level.pressure.colors >= 6);
  }
  const a = createColonyLevel(144), b = createColonyLevel(168);
  assert.notDeepEqual(a.queues, b.queues, 'later journeys vary their reserve instead of repeating it');
});
test('old saves retain their exact board, ongoing workers, history and earned completions', () => {
  const { save, fingerprint } = JSON.parse(readFileSync(new URL('./fixtures/colony-v1.json', import.meta.url), 'utf8'));
  const restored = decodeColonySave(save); assert.ok(restored);
  assert.equal(createHash('sha256').update(JSON.stringify({ cells: restored.game.level.cells, queues: restored.game.level.queues })).digest('hex'), fingerprint);
  assert.deepEqual(restored.game.state, save.state); assert.deepEqual(restored.game.history, save.history);
  assert.deepEqual(restored.completed, [0, 3, 20]); assert.equal(restored.speed, 2); assert.equal(restored.game.level.generation, 1);
  const migrated = encodeColonySave(restored.game, restored.completed, restored.speed);
  assert.equal(migrated.version, 2); assert.equal(migrated.generation, 1); assert.deepEqual(decodeColonySave(migrated).game.state, save.state);
  assert.notDeepEqual(createColonyLevel(save.index).cells, restored.game.level.cells);
});
test('legacy puzzles remain solvable with unrestricted workers using state-aware hints', () => {
  for (const index of [0, 1, 2, 3, 4, 5, 27, 80]) {
    const game = new ColonyGame(createLegacyColonyLevel(index));
    for (let step = 0; step < 80 && !game.won; step++) {
      const hint = game.hint(); assert.equal(hint.type, 'box', `legacy hint ${index}`); game.launch(hint.queue); game.settle();
    }
    assert.ok(game.won, `legacy ${index}`);
  }
});
test('larger-board saves preserve return trips and hints handle pending teams', () => {
  for (const index of [6, 24, 48, 72, 80]) {
    const game = new ColonyGame(createColonyLevel(index));
    for (const q of game.level.solution) {
      const hint = game.hint(); assert.ok(['box', 'wait'].includes(hint.type));
      assert.ok(game.launch(q)); game.advance(0); game.advance(.9);
      const restored = decodeColonySave(encodeColonySave(game)); assert.ok(restored, `save ${index}`);
      assert.deepEqual(restored.game.state, game.state); game.settle();
    }
    assert.ok(game.won);
  }
});
