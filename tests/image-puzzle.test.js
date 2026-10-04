import test from 'node:test';
import assert from 'node:assert/strict';
import { generateImagePuzzle, MIN_IMAGE_ARROW_CELLS, ImagePuzzleGame, imageGrid, imageColours, imageBlockers, validImageLevel } from '../src/image-puzzle.js';

function pixels(cols, rows, transparent = false) {
  return Uint8ClampedArray.from({ length: cols * rows * 4 }, (_, i) => {
    const cell = Math.floor(i / 4), x = cell % cols, y = Math.floor(cell / cols);
    return i % 4 === 3 ? transparent && (x + y) % 7 === 0 ? 0 : 255 : i % 4 === 0 ? x * 255 / cols : i % 4 === 1 ? y * 255 / rows : 180;
  });
}
test('flat image puzzles use long paths with sampled colours and have complete solutions', () => {
  for (const [cols, rows] of [[4, 4], [22, 18], [34, 34], [4, 72], [72, 4], [46, 52]]) {
    for (const difficulty of ['gentle', 'thoughtful', 'tangled']) {
      const rgba = pixels(cols, rows, true), colours = imageColours(rgba);
      const level = generateImagePuzzle({ cols, rows, pixels: rgba, difficulty }), seen = new Set(), game = new ImagePuzzleGame(level);
      assert.equal(validImageLevel(level), true);
      for (const arrow of level.arrows) {
        assert.ok(arrow.cells.length >= MIN_IMAGE_ARROW_CELLS);
        const head = arrow.cells.at(-1), neck = arrow.cells.at(-2);
        assert.deepEqual([head[0] - neck[0], head[1] - neck[1]], arrow.direction);
        for (const [i, [x, y]] of arrow.cells.entries()) {
          const id = y * cols + x;
          assert.ok(!seen.has(id)); seen.add(id); assert.ok(rgba[id * 4 + 3] >= 24);
          assert.deepEqual(arrow.colours[i], colours[id]);
          if (i) assert.equal(Math.abs(x - arrow.cells[i - 1][0]) + Math.abs(y - arrow.cells[i - 1][1]), 1);
        }
        assert.ok(!imageBlockers(level, arrow).includes(arrow.id), 'an arrow cannot block itself');
      }
      const visible = Array.from(rgba).filter((v, i) => i % 4 === 3 && v >= 24).length;
      assert.equal(seen.size, level.stats.pixels);
      assert.equal(seen.size + level.stats.skippedPixels, visible);
      assert.ok(seen.size >= visible * 0.6, 'fragmented images retain most visible cells');
      for (const id of level.solution) assert.equal(game.release(id).status, 'removed');
      assert.equal(game.remaining, 0);
    }
  }
});
test('blocked clicks are transactional, available choices remain solvable, and history replays with undo', () => {
  const level = generateImagePuzzle({ cols: 22, rows: 18, pixels: pixels(22, 18) }), game = new ImagePuzzleGame(level);
  const blocked = level.arrows.find(a => imageBlockers(level, a).length);
  assert.equal(game.release(blocked.id).status, 'blocked'); assert.equal(game.history.length, 0);
  for (let i = 0; i < 10; i++) game.release(game.available().at(-1).id);
  const replay = new ImagePuzzleGame(level, game.history);
  assert.deepEqual(replay.removed, game.removed); const last = replay.undo(); assert.equal(replay.removed.has(last), false);
  while (replay.remaining) { const arrow = replay.available().at(-1); assert.ok(arrow); replay.release(arrow.id); }
  assert.equal(replay.remaining, 0);
});
test('settings and image seeds are deterministic; rearrangements change the puzzle', () => {
  const input = { cols: 22, rows: 22, pixels: pixels(22, 22) };
  assert.deepEqual(generateImagePuzzle(input), generateImagePuzzle(input));
  assert.notDeepEqual(generateImagePuzzle(input).arrows, generateImagePuzzle({ ...input, variation: 1 }).arrows);
  const flat = new Uint8ClampedArray(34 * 34 * 4).fill(255);
  const samples = difficulty => Array.from({ length: 5 }, (_, variation) => generateImagePuzzle({ cols: 34, rows: 34, pixels: flat, difficulty, variation }));
  const gentle = samples('gentle'), tangled = samples('tangled');
  const total = (levels, key) => levels.reduce((n, l) => n + l.stats[key], 0);
  assert.ok(total(tangled, 'depth') > total(gentle, 'depth'));
  assert.ok(total(tangled, 'openingMoves') < total(gentle, 'openingMoves'));
  assert.ok(total(tangled, 'arrows') < total(gentle, 'arrows'));
  assert.ok([...gentle, ...tangled].every(l => l.stats.pixels >= flat.length / 4 * 0.9));
});

test('short transparent islands never turn into tiny arrows, across settings and seeds', () => {
  const cols = 22, rows = 18, rgba = new Uint8ClampedArray(cols * rows * 4);
  const paint = (x, y) => rgba.set([20, 120, 90, 255], (y * cols + x) * 4);
  for (let y = 4; y < 16; y++) for (let x = 4; x < 20; x++) paint(x, y);
  paint(0, 0); paint(0, 1); paint(1, 1); // Three-cell disconnected island.
  for (const difficulty of ['gentle', 'thoughtful', 'tangled']) for (let variation = 0; variation < 8; variation++) {
    const level = generateImagePuzzle({ cols, rows, pixels: rgba, difficulty, variation });
    assert.equal(validImageLevel(level), true);
    assert.ok(level.arrows.every(a => a.cells.length >= MIN_IMAGE_ARROW_CELLS));
    assert.ok(level.arrows.every(a => a.cells.every(([x, y]) => x >= 4 && y >= 4)));
    const game = new ImagePuzzleGame(level);
    for (const id of level.solution) assert.equal(game.release(id).status, 'removed');
  }
  const isolated = new Uint8ClampedArray(cols * rows * 4); isolated.set([20, 120, 90, 255], 0);
  assert.throws(() => generateImagePuzzle({ cols, rows, pixels: isolated }), /fragmented.*longer arrows/);
});
test('grid resolution respects aspect, detail and bounds; transparent crops give an actionable error', () => {
  assert.deepEqual(imageGrid(640, 520, 'balanced'), { cols: 42, rows: 34 });
  assert.ok(imageGrid(640, 520, 'fine').cols > imageGrid(640, 520, 'soft').cols);
  assert.equal(imageGrid(10, 10000).rows, 72);
  assert.throws(() => generateImagePuzzle({ cols: 4, rows: 4, pixels: new Uint8ClampedArray(64) }), /transparent/);
  assert.throws(() => generateImagePuzzle({ cols: 4, rows: 4, pixels: new Uint8ClampedArray(10) }), /Invalid/);
  assert.deepEqual(imageColours(new Uint8ClampedArray([0, 0, 0, 128])), [[127, 127, 127]]);
  const level = generateImagePuzzle({ cols: 4, rows: 4, pixels: pixels(4, 4) });
  level.arrows[0].direction = [0, 0]; assert.equal(validImageLevel(level), false);
  assert.throws(() => generateImagePuzzle({ cols: 4, rows: 4, pixels: pixels(4, 4), difficulty: '__proto__' }), /Unknown/);
});
