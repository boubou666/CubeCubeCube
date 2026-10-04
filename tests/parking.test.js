import test from 'node:test';
import assert from 'node:assert/strict';
import { PARKING_PATTERNS } from '../src/parking.js';
import { PuzzleGame, solveWithStops, solve, createLevel, LEVELS } from '../src/puzzle.js';
import { readSave, SAVE_KEY } from '../src/storage.js';

test('every parking pattern needs multiple arrows and its audited minimum parking moves', () => {
  for (const pattern of PARKING_PATTERNS) {
    const cells = points => points.map(([x, y]) => ({ face: 'back', x, y }));
    const level = { size: 7, bridges: [], circles: cells(pattern.circles), arrows: pattern.arrows.map((a, id) => ({ ...a, id, cells: cells(a.cells), ...(a.branch ? { branch: { ...a.branch, cells: cells(a.branch.cells) } } : {}) })) };
    assert.equal(solve({ ...level, circles: [] }), null, pattern.name);
    const solution = solveWithStops(level); assert.ok(solution, pattern.name);
    assert.equal(solution.length - level.arrows.length, pattern.parks, pattern.name);
    const game = new PuzzleGame(); game.level = structuredClone(level);
    const parked = new Set();
    for (const m of solution) {
      const result = game.tryRemove(m.id, m.end);
      assert.notEqual(result.status, 'blocked', pattern.name);
      if (result.status === 'moved') parked.add(m.id);
    }
    assert.equal(game.remaining, 0); assert.ok(parked.size >= 2, pattern.name);
  }
});

test('circle layouts vary across the journey and remain present in late tiers', () => {
  for (const [tier, minimum] of [[1, 3], [3, 4], [6, 5], [9, 7]]) {
    const patterns = new Set();
    for (let i = 0; i < 6; i++) {
      const index = LEVELS.length + (tier - 1 + i) * 8 + 2;
      const level = createLevel(index), solution = solveWithStops(level);
      assert.ok(level.parkingStats.minimumParks >= minimum);
      patterns.add(level.parkingStats.pattern);
      assert.ok(solution);
      assert.equal(solution.length - level.arrows.length, level.parkingStats.minimumParks);
    }
    assert.ok(patterns.size >= 3, `repeated patterns in tier ${tier}`);
  }
});

test('saved generation two preserves an active puzzle; generation three keeps new parking', () => {
  const index = LEVELS.length + 31;
  const old = new PuzzleGame(index, [], [], 2), fresh = new PuzzleGame(index);
  assert.equal(old.level.parkingGroups, undefined); assert.ok(fresh.level.parkingGroups);
  const move = solveWithStops(fresh.level)[0]; fresh.tryRemove(move.id, move.end);
  const save = readSave({ getItem: k => k === SAVE_KEY ? JSON.stringify({ version: 4, generation: 3, index, moves: fresh.saveMoves }) : null });
  const replay = new PuzzleGame(index, [], save.moves, save.generation);
  assert.deepEqual(replay.level, fresh.level); replay.undo(); assert.deepEqual(replay.level, createLevel(index));
  const oldSave = readSave({ getItem: () => JSON.stringify({ version: 4, generation: 2, index }) });
  assert.deepEqual(new PuzzleGame(index, [], [], oldSave.generation).level, old.level);
});
