import test from 'node:test';
import assert from 'node:assert/strict';
import { FACES, FACE_NAMES, DIRECTIONS, LEVELS, key, step, createLevel, solve, solveWithStops, blockerIds, availableArrows, availableMoves, travelRoute, arrowCells, surfaceLayout, exitHitsSolid, PuzzleGame, hasMechanisms } from '../src/puzzle.js';
import { readSave, writeSave, SAVE_KEY } from '../src/storage.js';

test('surface transitions are reciprocal on all twelve cube edges', () => {
  for (const size of [4, 5, 6, 7]) for (const face of FACE_NAMES) for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (const direction of DIRECTIONS) {
    const cell = { face, x, y }, next = step(cell, direction, size);
    assert.ok(next.cell.x >= 0 && next.cell.x < size && next.cell.y >= 0 && next.cell.y < size);
    const back = step(next.cell, next.direction.map(v => -v), size);
    assert.deepEqual(back.cell, cell, `${key(cell)} with ${direction}`);
    assert.deepEqual(back.direction.map(v => v || 0), direction.map(v => -v || 0));
  }
});

for (const [index, meta] of LEVELS.entries()) {
  test(`level ${index + 1}: ${meta.title} has continuous non-overlapping paths and a full solution`, () => {
    const level = createLevel(index), occupied = new Set();
    assert.equal(level.arrows.length, meta.count);
    const ids = new Set();
    for (const arrow of level.arrows) {
      assert.ok(!ids.has(arrow.id)); ids.add(arrow.id);
      assert.ok(arrow.cells.length >= 2);
      const all = arrowCells(arrow);
      for (let i = 0; i < all.length; i++) {
        const cell = all[i];
        assert.ok(FACES[cell.face]);
        const dimensions = typeof level.size === 'number' ? { width: level.size, height: level.size } : surfaceLayout(level.size).frames[cell.face];
        assert.ok(cell.x >= 0 && cell.x < dimensions.width && cell.y >= 0 && cell.y < dimensions.height);
        assert.ok(!occupied.has(key(cell)), `overlap at ${key(cell)}`); occupied.add(key(cell));
        if (i < arrow.cells.length && i) assert.ok(DIRECTIONS.some(d => key(step(arrow.cells[i - 1], d, level.size).cell) === key(cell)), 'disconnected path');
      }
      if (arrow.branch) for (let i = 1; i < arrow.branch.cells.length; i++) assert.ok(DIRECTIONS.some(d => key(step(arrow.branch.cells[i - 1], d, level.size).cell) === key(arrow.branch.cells[i])), 'disconnected branch');
      const predecessor = step(arrow.cells.at(-1), arrow.direction.map(v => -v), level.size).cell;
      assert.deepEqual(predecessor, arrow.cells.at(-2), 'arrowhead must point along the last segment');
    }
    const order = solve(level);
    assert.ok(order?.length >= meta.count);
    const game = new PuzzleGame(index);
    for (const id of order) {
      assert.ok(availableArrows(game.level, game.removed).some(a => a.id === id));
      assert.ok(['moved', 'removed', 'complete'].includes(game.tryRemove(id).status));
    }
    assert.equal(game.remaining, 0);
    assert.equal(game.tryRemove(order[0]).status, 'ignored');
    assert.ok(game.undo() !== null); assert.equal(game.remaining, 1);
    if (index > 0 && !meta.tutorial) assert.ok(level.arrows.some(a => new Set(a.cells.map(c => c.face)).size > 1), 'level should include wrapped paths');
    assert.deepEqual(createLevel(index), level, 'restarts must reproduce the same board');
  });
}

test('a blocked tap preserves every arrow; removing its blocker opens the route', () => {
  const game = new PuzzleGame();
  assert.deepEqual(blockerIds(game.level.arrows[0], game.level.arrows, game.removed, game.level.size), [1]);
  assert.equal(game.tryRemove(0).status, 'blocked');
  assert.equal(game.remaining, 18); assert.equal(game.history.length, 0);
  assert.equal(game.tryRemove(1).status, 'removed');
  assert.equal(game.tryRemove(0).status, 'removed');
  assert.equal(game.undo(), 0); assert.equal(game.undo(), 1); assert.equal(game.undo(), null);
  assert.equal(game.remaining, 18);
});

test('an ordinary hole edge still checks arrows across the gap in physical space', () => {
  const size = { x: 6, y: 6, z: 4, hole: { x: [2, 3], y: [2, 3] } };
  const cell = (x, y, face = 'front') => ({ face, x, y });
  const arrow = { id: 0, cells: [cell(2, 0), cell(2, 1)], direction: [0, 1] };
  const obstacle = { id: 1, cells: [cell(2, 5), cell(2, 4)], direction: [0, -1] };
  const across = { id: 2, cells: [cell(1, 4), cell(2, 4), cell(3, 4)], direction: [1, 0] };
  const behind = { id: 3, cells: [cell(2, 4, 'back'), cell(2, 5, 'back')], direction: [0, 1] };
  assert.deepEqual(blockerIds(arrow, [arrow, obstacle], new Set(), size), [1]);
  assert.deepEqual(blockerIds(arrow, [arrow, across], new Set(), size), [2]);
  assert.deepEqual(blockerIds(arrow, [arrow, obstacle], new Set([1]), size), []);
  assert.deepEqual(blockerIds(arrow, [arrow, behind], new Set(), size), [], 'screen overlap at another depth must not block');
  const game = new PuzzleGame(); game.level = { size, arrows: [arrow, obstacle], bridges: [] };
  const before = structuredClone(game.level);
  assert.equal(game.tryRemove(0).status, 'blocked'); assert.deepEqual(game.level, before);
});

test('choosing any available arrow preserves solvability', () => {
  for (let index = 0; index < LEVELS.length; index++) {
    const level = createLevel(index), removed = new Set();
    if (level.circles?.length || hasMechanisms(level)) continue;
    while (removed.size < level.arrows.length) {
      const options = availableArrows(level, removed);
      assert.ok(options.length > 0);
      removed.add(options.at(-1).id);
    }
  }
});

test('painted edges transport directions and check blockers on the neighboring face', () => {
  const level = createLevel(12), arrow = level.arrows[1];
  const route = travelRoute(arrow, level.size, level.bridges);
  assert.equal(route.crossings.length, 1); assert.equal(route.states.at(-1).cell.face, 'right');
  assert.deepEqual(blockerIds(arrow, level.arrows, new Set(), level.size, level.bridges), [3, 4]);
  assert.equal(new PuzzleGame(12).tryRemove(1).status, 'blocked');
  const mirrored = { id: 10, cells: [{ face: 'right', x: 1, y: 3 }, { face: 'right', x: 0, y: 3 }], direction: [-1, 0] };
  assert.equal(travelRoute(mirrored, 4, level.bridges).states.at(-1).cell.face, 'front');
});

test('a closed belt of colored edges is blocked rather than looping forever', () => {
  const arrow = { id: 0, cells: [{ face: 'front', x: 2, y: 1 }, { face: 'front', x: 3, y: 1 }], direction: [1, 0] };
  const bridges = [['front', 'right'], ['right', 'back'], ['back', 'left'], ['left', 'front']].map(faces => ({ faces }));
  assert.equal(travelRoute(arrow, 4, bridges).loop, true);
  assert.deepEqual(availableMoves({ size: 4, arrows: [arrow], bridges }), []);
});

test('opposite-ended arrows honor the tapped head', () => {
    const game = new PuzzleGame(13);
    assert.equal(game.tryRemove(0, 0).status, 'blocked');
    assert.equal(game.tryRemove(0, 1).status, 'removed');
    assert.ok(game.removed.has(0));
    assert.equal(game.undo(), 0); assert.ok(!game.removed.has(0));
});

test('forks require both routes, whichever head is tapped, and undo as one arrow', () => {
  const cell = (x, y) => ({ face: 'front', x, y });
  const fork = { id: 0, cells: [cell(1, 1), cell(1, 2), cell(2, 2), cell(3, 2)], direction: [1, 0], branch: { cells: [cell(1, 2), cell(1, 3)], direction: [0, 1] } };
  const game = new PuzzleGame();
  game.level = { size: 6, arrows: [fork,
    { id: 1, cells: [cell(5, 1), cell(5, 2)], direction: [0, 1] },
    { id: 2, cells: [cell(0, 5), cell(1, 5)], direction: [1, 0] },
  ] };
  assert.deepEqual(blockerIds(fork, game.level.arrows, game.removed, 6), [1, 2]);
  for (const end of [0, 1]) assert.equal(game.tryRemove(0, end).status, 'blocked');
  assert.equal(game.history.length, 0);
  game.tryRemove(1);
  for (const end of [0, 1]) assert.equal(game.tryRemove(0, end).status, 'blocked', 'secondary route must also be clear');
  assert.ok(!availableMoves(game.level, game.removed).some(m => m.id === 0));
  game.tryRemove(2);
  assert.deepEqual(availableMoves(game.level, game.removed), [{ id: 0, end: 0 }]);
  const result = game.tryRemove(0, 1);
  assert.equal(result.status, 'complete');
  assert.equal(result.routes.length, 2);
  assert.deepEqual(result.routes.map(r => r.states[0].direction), [[1, 0], [0, 1]]);
  assert.equal(game.undo(), 0); assert.deepEqual(game.level.arrows[0], fork);
});

test('fork blockers on both adjacent faces are required before colored-ridge departure', () => {
  const game = new PuzzleGame(19), fork = game.level.arrows[0];
  assert.deepEqual(blockerIds(fork, game.level.arrows, game.removed, 5, game.level.bridges), [1, 3]);
  assert.equal(game.tryRemove(0, 1).status, 'blocked');
  game.tryRemove(1);
  assert.equal(game.tryRemove(0, 0).status, 'blocked');
  game.tryRemove(3);
  const result = game.tryRemove(0);
  assert.equal(result.status, 'removed');
  assert.deepEqual(result.routes.map(r => r.crossings.length), [1, 1]);
});

test('a fork cannot move if its second head has a closed route', () => {
  const game = new PuzzleGame(18);
  game.level.arrows = [game.level.arrows[0]];
  game.level.bridges = [['front', 'top'], ['top', 'back'], ['back', 'bottom'], ['bottom', 'front']].map(faces => ({ faces }));
  assert.equal(travelRoute(game.level.arrows[0], 5, game.level.bridges, 1).loop, true);
  assert.equal(game.tryRemove(0, 0).status, 'blocked');
  assert.deepEqual(availableMoves(game.level), []);
});

test('a fork parked on a circle preserves each part and undoes as one move', () => {
  const cell = (x, y) => ({ face: 'front', x, y });
  const fork = { id: 0, cells: [cell(1, 1), cell(1, 2), cell(2, 2), cell(3, 2)], direction: [1, 0], branch: { cells: [cell(1, 2), cell(1, 3)], direction: [0, 1] } };
  for (const circles of [[cell(4, 2), cell(1, 4)], [cell(4, 2)], [cell(1, 4)]]) {
    const game = new PuzzleGame(); game.level = { size: 6, arrows: [fork], circles };
    assert.equal(game.tryRemove(0, 1).status, 'moved');
    assert.equal(game.remaining, 1);
    const parked = game.level.arrows[0];
    assert.equal(arrowCells(parked).length, circles.length === 2 ? 6 : circles[0].x === 4 ? 4 : 2);
    assert.equal(game.tryRemove(0).status, 'complete');
    assert.equal(game.undo(), 0); assert.deepEqual(game.level.arrows[0], parked);
    assert.equal(game.undo(), 0); assert.deepEqual(game.level.arrows[0], fork);
  }
});

test('inner-wall exits into solid geometry are blocked and never generated', () => {
  const level = createLevel(21), bottom = surfaceLayout(level.size).cells.find(c => c.face.startsWith('top@'));
  assert.ok(bottom);
  assert.equal(exitHitsSolid(bottom, [1, 0], level.size), true);
  assert.equal(exitHitsSolid(bottom, [-1, 0], level.size), true);
  assert.equal(exitHitsSolid(bottom, [0, 1], level.size), false);
  const arrow = { id: 0, cells: [{ ...bottom, x: bottom.x + 1 }, bottom], direction: [-1, 0] };
  const game = new PuzzleGame(); game.level = { ...level, arrows: [arrow], bridges: [] };
  assert.equal(game.tryRemove(0).solid, true);
  assert.deepEqual(availableMoves(game.level), []);
  for (const index of [20, 21, 22]) for (const a of createLevel(index).arrows) {
    assert.equal(travelRoute(a, createLevel(index).size, createLevel(index).bridges).solid, false, `invalid exit for level ${index + 1}, arrow ${a.id}`);
  }
});

test('circle parking breaks a dependency cycle and survives undo and saved replay', () => {
  const game = new PuzzleGame(16);
  assert.equal(solve({ ...game.level, circles: [] }), null, 'without a stop these arrows block each other');
  assert.equal(game.tryRemove(1).status, 'blocked');
  assert.equal(game.tryRemove(0).status, 'moved');
  assert.equal(game.remaining, 2);
  assert.deepEqual(game.level.arrows[0].cells, [{ face: 'front', x: 1, y: 1 }, { face: 'front', x: 2, y: 1 }]);
  assert.equal(game.tryRemove(0).status, 'blocked', 'parked arrow still cannot pass the winding arrow');
  const resumed = new PuzzleGame(16); resumed.load(16, [...game.removed], game.saveMoves);
  assert.deepEqual(resumed.level.arrows, game.level.arrows);
  assert.equal(resumed.undo(), 0); assert.deepEqual(resumed.level.arrows, createLevel(16).arrows);
  assert.equal(game.tryRemove(1).status, 'removed');
  assert.equal(game.tryRemove(0).status, 'complete');
  assert.equal(game.undo(), 0); assert.equal(game.remaining, 1);
  assert.equal(game.undo(), 1); assert.equal(game.undo(), 0);
  assert.deepEqual(game.level.arrows, createLevel(16).arrows);
  assert.deepEqual(solveWithStops(game.level), [{ id: 0, end: 0 }, { id: 1, end: 0 }, { id: 0, end: 0 }]);
});

test('save validation, corrupted JSON, denied storage, and resume with undo', () => {
  const store = new Map(), storage = { getItem: k => store.get(k), setItem: (k, v) => store.set(k, v) };
  assert.equal(readSave(storage).index, 0);
  assert.equal(writeSave({ version: 1, index: 1, removed: [3, 3, 6], completed: [0, 0, 2, 20], theme: 'dusk', sound: true }, storage), true);
  const save = readSave(storage);
  assert.deepEqual(save.removed, [3, 6]); assert.deepEqual(save.completed, [0, 2, 20]); assert.equal(save.theme, 'dusk');
  const game = new PuzzleGame(save.index); game.load(save.index, save.removed);
  assert.equal(game.undo(), 6); assert.equal(game.remaining, 21);
  store.set(SAVE_KEY, '{bad'); assert.equal(readSave(storage).index, 0);
  store.set(SAVE_KEY, JSON.stringify({ version: 1, index: -1, removed: 'bad', completed: null, theme: 'not-a-theme' }));
  assert.equal(readSave(storage).theme, 'ivory');
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(readSave(denied).index, 0); assert.equal(writeSave(save, denied), false);
});

test('prism, tunnel walls, and terrace steps form reciprocal connected surfaces', () => {
  for (const index of [20, 21, 22]) {
    const level = createLevel(index), layout = surfaceLayout(level.size), keys = new Set(layout.cells.map(key));
    for (const cell of layout.cells) for (const direction of DIRECTIONS) {
      const next = step(cell, direction, level.size);
      assert.ok(keys.has(key(next.cell)));
      assert.deepEqual(step(next.cell, next.direction.map(v => -v), level.size).cell, cell);
    }
    const visited = new Set(), stack = [layout.cells[0]];
    while (stack.length) {
      const cell = stack.pop(); if (visited.has(key(cell))) continue;
      visited.add(key(cell)); DIRECTIONS.forEach(d => stack.push(step(cell, d, level.size).cell));
    }
    assert.equal(visited.size, layout.cells.length, 'all surfaces belong to one connected board');
    if (index === 21) assert.ok(layout.cells.some(c => c.face.includes('@')), 'hole needs real inner walls');
    if (index === 22) assert.ok(Object.keys(layout.frames).filter(f => f.startsWith('top@')).length >= 3, 'terrace is part of a larger solid with multiple treads');
  }
});
