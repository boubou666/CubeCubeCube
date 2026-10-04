import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, createLevel, PuzzleGame, availableMoves, solveWithStops, step, key, arrowCells, surfaceLayout } from '../src/puzzle.js';
import { pressedButtons, mechanismRoutes, rotateCell, analyzeMechanismMove } from '../src/mechanics.js';
import { readSave, SAVE_KEY } from '../src/storage.js';

test('pressure button holds its gate only while a stationary head occupies it', () => {
  const game = new PuzzleGame(23), before = structuredClone(game.level);
  assert.equal(game.tryRemove(1).status, 'blocked'); assert.deepEqual(game.level, before);
  assert.equal(game.tryRemove(0).status, 'moved'); assert.deepEqual([...pressedButtons(game.level, game.removed)], ['amber']);
  const held = structuredClone(game.level);
  assert.equal(game.tryRemove(0).status, 'blocked'); assert.deepEqual(game.level, held);
  assert.equal(game.tryRemove(1).status, 'removed');
  assert.equal(game.tryRemove(0).status, 'complete'); assert.equal(pressedButtons(game.level, game.removed).size, 0);
  assert.equal(game.undo(), 0); assert.deepEqual([...pressedButtons(game.level, game.removed)], ['amber']);
  game.undo(); game.undo(); assert.deepEqual(game.level, before);
});

test('a departing head cannot use the gate it has just released', () => {
  const game = new PuzzleGame(23);
  game.tryRemove(0);
  const head = game.level.arrows[0].cells.at(-1);
  game.level.gates = [{ id: 'self-gate', face: head.face, x: head.x + 1, y: head.y, button: 'amber' }];
  const result = game.tryRemove(0); assert.equal(result.status, 'blocked'); assert.equal(result.gate, true);
});

test('fixed turns persist; alternating turns commit only after a clear route', () => {
  const fixed = new PuzzleGame(24);
  assert.equal(fixed.tryRemove(0).status, 'blocked'); assert.equal(fixed.level.deflectors[0].turn, 1);
  fixed.tryRemove(1); const result = fixed.tryRemove(0);
  assert.deepEqual(result.route.states.at(-1).direction, [0, 1]); assert.equal(fixed.level.deflectors[0].turn, 1);
  const game = new PuzzleGame(25), before = structuredClone(game.level);
  assert.equal(game.tryRemove(1).status, 'blocked'); assert.deepEqual(game.level, before);
  assert.equal(game.tryRemove(0).status, 'moved'); assert.equal(game.level.deflectors[0].turn, -1);
  const flipped = structuredClone(game.level);
  assert.equal(game.tryRemove(1).status, 'blocked'); assert.deepEqual(game.level, flipped);
  game.tryRemove(2); game.tryRemove(0);
  assert.equal(game.tryRemove(1).status, 'complete'); assert.equal(game.level.deflectors[0].turn, 1);
  game.undo(); assert.equal(game.level.deflectors[0].turn, -1);
});

test('both fork routes must clear a deflector and gate before any state commits', () => {
  const cell = (x, y) => ({ face: 'front', x, y });
  const game = new PuzzleGame();
  game.level = { size: 6, arrows: [{ id: 0, cells: [cell(0, 1), cell(1, 1)], direction: [1, 0], branch: { cells: [cell(0, 1), cell(0, 2)], direction: [0, 1] } }],
    deflectors: [{ id: 'd', ...cell(2, 1), turn: -1, alternating: true }], gates: [{ id: 'gate', ...cell(0, 3), button: 'missing' }], buttons: [] };
  const before = structuredClone(game.level);
  for (const end of [0, 1]) { assert.equal(game.tryRemove(0, end).status, 'blocked'); assert.deepEqual(game.level, before); }
  game.level.gates = [];
  assert.equal(game.tryRemove(0).status, 'complete'); assert.equal(game.level.deflectors[0].turn, 1);
});

test('a fork shares alternating turns in passage order between its two heads', () => {
  const cell = (x, y) => ({ face: 'front', x, y });
  const arrow = { id: 0, cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]].map(([x, y]) => cell(x, y)), direction: [1, 0],
    branch: { cells: [[0, 0], [1, 0], [2, 0], [2, 1]].map(([x, y]) => cell(x, y)), direction: [0, 1] } };
  const level = { size: 6, arrows: [arrow], deflectors: [{ id: 'turn', ...cell(2, 3), turn: 1, alternating: true }] };
  const before = structuredClone(level), result = analyzeMechanismMove(level, new Set(), arrow);
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.routes[0].states.at(-1).direction, [0, 1]);
  assert.deepEqual(result.routes[1].states.at(-1).direction, [1, 0]);
  assert.equal(result.next.deflectors[0].turn, 1, 'two passages restore the original turn');
  assert.deepEqual(level, before, 'preview is transactional');
});

test('section rotation transports geometry, arrows, ridge connections, and undo together', () => {
  const game = new PuzzleGame(26), before = structuredClone(game.level);
  assert.equal(game.tryRemove(1).status, 'blocked'); assert.equal(game.tryRemove(2).status, 'blocked');
  const result = game.tryRemove(0);
  assert.equal(result.status, 'moved'); assert.deepEqual(result.rotations, ['crown']);
  assert.equal(game.level.rotors[0].turns, 1);
  assert.ok(game.level.arrows[1].cells.every(c => c.face === 'right'));
  assert.deepEqual(game.level.bridges[0].faces, ['top', 'right']);
  assert.deepEqual(game.level.arrows[2], before.arrows[2]);
  assert.ok(availableMoves(game.level).some(m => m.id === 1));
  const resumed = new PuzzleGame(26, [], game.saveMoves); assert.deepEqual(resumed.level, game.level);
  game.undo(); assert.deepEqual(game.level, before);
  for (const cell of surfaceLayout(6).cells) assert.deepEqual(rotateCell(cell, 6, 4), cell);
});

test('an arrow crossing a rotating seam blocks the entire transaction', () => {
  const game = new PuzzleGame(26);
  game.level.arrows.push({ id: 3, cells: [{ face: 'back', x: 4, y: 3 }, { face: 'back', x: 4, y: 4 }], direction: [0, 1] });
  const before = structuredClone(game.level), result = game.tryRemove(0);
  assert.equal(result.status, 'blocked'); assert.equal(result.rotationBlocked, true);
  assert.deepEqual(game.level, before); assert.equal(game.history.length, 0);
});

test('route preview never changes the shared voxel surface adjacency', () => {
  const game = new PuzzleGame(27); game.level.size = { x: 6, y: 6, z: 6 };
  const before = structuredClone([...surfaceLayout(game.level.size).adjacency]);
  for (let i = 0; i < 3; i++) { availableMoves(game.level); solveWithStops(game.level); }
  assert.deepEqual([...surfaceLayout(game.level.size).adjacency], before);
});

test('new families enter endless play progressively and preserve solutions after any legal choice', () => {
  for (const [ordinal, kind] of [[11, 'pressure'], [21, 'fixed'], [25, 'alternating'], [32, 'rotation'], [47, 'mixed'], [72, 'rotation'], [103, 'mixed']]) {
    const game = new PuzzleGame(LEVELS.length + ordinal), original = structuredClone(game.level);
    assert.ok(game.level.mechanismPocketCount);
    const solution = solveWithStops(game.level); assert.ok(solution);
    for (let i = 0; game.remaining && i < original.arrows.length * 3; i++) {
      const moves = availableMoves(game.level, game.removed), move = moves[(i * 7) % moves.length];
      assert.ok(move, `deadlock in ${kind}`); assert.notEqual(game.tryRemove(move.id, move.end).status, 'blocked');
    }
    assert.equal(game.remaining, 0, kind);
    assert.deepEqual(createLevel(game.index), original);
  }
});

test('old endless save ranges shift past the new lessons and retain legacy generation', () => {
  const legacy = { version: 3, index: 54, frontier: 55, endlessCompleted: [[23, 53]], completed: [0, 22], moves: [], removed: [] };
  const save = readSave({ getItem: key => key === SAVE_KEY ? JSON.stringify(legacy) : null });
  assert.equal(save.version, 4); assert.equal(save.index, 59); assert.equal(save.frontier, 60);
  assert.deepEqual(save.completed, [0, 22]); assert.deepEqual(save.endlessCompleted, [[28, 58]]); assert.equal(save.generation, 1);
  const game = new PuzzleGame(save.index, save.removed, save.moves, save.generation);
  assert.equal(game.level.buttons, undefined); assert.equal(game.generation, 1);
});
