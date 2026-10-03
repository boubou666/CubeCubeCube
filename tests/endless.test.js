import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, DIRECTIONS, createLevel, levelMeta, surfaceLayout, arrowCells, key, step, availableMoves, travelRoute, solveWithStops, PuzzleGame } from '../src/puzzle.js';
import { SAVE_KEY, readSave, writeSave, markCompleted, hasCompleted, completedCount } from '../src/storage.js';

test('generated puzzles across early and distant tiers have valid surfaces and complete solutions', () => {
  const ordinals = [...Array.from({ length: 40 }, (_, i) => i), 48, 72, 79, 127, 255, 1000, 1000000000, Number.MAX_SAFE_INTEGER - LEVELS.length - 2];
  for (const ordinal of ordinals) {
    const index = LEVELS.length + ordinal, level = createLevel(index), layout = surfaceLayout(level.size);
    const valid = new Set(layout.cells.map(key)), occupied = new Set();
    assert.ok(level.arrows.length >= 35, `too sparse: ${index}`);
    for (const arrow of level.arrows) {
      const pocketStart = level.arrows.length - levelMeta(index).stopPockets * 2;
      if (arrow.id < pocketStart && level.circles.length) {
        for (const end of arrow.twoHeads || arrow.branch ? [0, 1] : [0]) assert.equal(travelRoute(arrow, level.size, level.bridges, end, level.circles).stopped, false, 'filler routes must never hit a parking circle');
      }
      for (const cell of arrowCells(arrow)) {
        assert.ok(valid.has(key(cell)), `unsupported surface: ${index} ${key(cell)}`);
        assert.ok(!occupied.has(key(cell)), `overlap: ${index} ${key(cell)}`); occupied.add(key(cell));
      }
      for (const part of [arrow, ...(arrow.branch ? [arrow.branch] : [])]) {
        for (let i = 1; i < part.cells.length; i++) assert.ok(DIRECTIONS.some(d => key(step(part.cells[i - 1], d, level.size).cell) === key(part.cells[i])), 'disconnected arrow');
      }
      for (const end of arrow.branch ? [0, 1] : [0]) {
        const route = travelRoute(arrow, level.size, level.bridges, end, level.circles);
        assert.ok(!route.loop && !route.solid, 'generated head must have a possible exit');
      }
    }
    const game = new PuzzleGame(index);
    // Reverse choice order also exercises circles before filler arrows; their
    // reserved pockets must not cause a deadlock after any legal player move.
    for (let move = 0; move < level.arrows.length * 3 && game.remaining; move++) {
      const option = availableMoves(game.level, game.removed).at(-1);
      assert.ok(option, `deadlock at puzzle ${index + 1}`);
      assert.ok(['moved', 'removed', 'complete'].includes(game.tryRemove(option.id, option.end).status));
    }
    assert.equal(game.remaining, 0, `incomplete puzzle ${index + 1}`);
    assert.deepEqual(createLevel(index), level, 'play must not mutate the seeded original');
  }
});

test('later tiers increase board size, arrow density, fork pressure, and dependency depth', () => {
  const first = levelMeta(23), later = levelMeta(95);
  assert.ok(later.count > first.count * 2);
  assert.ok(later.size > first.size);
  assert.ok(later.maxLength > first.maxLength);
  assert.ok(later.branches > first.branches && later.pressure > first.pressure);
  assert.ok(later.bridges.length > first.bridges.length);
  assert.ok(createLevel(95).difficultyStats.depth > createLevel(23).difficultyStats.depth);
  const fingerprints = Array.from({ length: 16 }, (_, i) => JSON.stringify(createLevel(23 + i).arrows));
  assert.equal(new Set(fingerprints).size, fingerprints.length);
});

test('endless circle pockets require parking and resume with undo and saved moves', () => {
  const index = LEVELS.length + 31, original = createLevel(index), game = new PuzzleGame(index);
  const solution = solveWithStops(original);
  assert.ok(solution && solution.length > original.arrows.length);
  const pocketId = original.arrows.length - 4;
  assert.equal(game.tryRemove(pocketId + 1).status, 'blocked');
  assert.equal(game.tryRemove(pocketId).status, 'moved');
  const resumed = new PuzzleGame(index, [...game.removed], game.saveMoves);
  assert.deepEqual(resumed.level.arrows, game.level.arrows);
  assert.equal(resumed.undo(), pocketId); assert.deepEqual(resumed.level, original);
});

test('endless completions use compact ranges, preserve legacy progress, and validate corruption', () => {
  const store = new Map(), storage = { getItem: k => store.get(k), setItem: (k, v) => store.set(k, v) };
  store.set(SAVE_KEY, JSON.stringify({ version: 2, index: 19, completed: [0, 19, 22], removed: [1], moves: [{ id: 1, end: 0 }], theme: 'mint', sound: true }));
  const save = readSave(storage);
  assert.equal(save.index, 19); assert.deepEqual(save.completed, [0, 19, 22]);
  assert.equal(save.theme, 'mint'); assert.equal(save.sound, true);
  for (let i = 23; i < 10023; i++) markCompleted(save, i);
  markCompleted(save, 1000000000); markCompleted(save, 1000000000);
  assert.deepEqual(save.endlessCompleted, [[23, 10022], [1000000000, 1000000000]]);
  assert.equal(completedCount(save), 10004);
  assert.equal(hasCompleted(save, 23), true); assert.equal(hasCompleted(save, 10023), false);
  save.index = 1000000000;
  assert.equal(writeSave(save, storage), true);
  assert.ok(store.get(SAVE_KEY).length < 400);
  assert.deepEqual(readSave(storage), save);
  store.set(SAVE_KEY, JSON.stringify({ version: 3, index: Infinity, endlessCompleted: [[-1, 2], [25, 24], [23, 25], [24, 28], [29, 29], ['30', 31]] }));
  const repaired = readSave(storage);
  assert.equal(repaired.index, 0); assert.deepEqual(repaired.endlessCompleted, [[23, 29]]);
  assert.throws(() => createLevel(Number.MAX_SAFE_INTEGER), RangeError);
});
