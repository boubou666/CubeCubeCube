// Flat, image-coloured puzzles. No DOM or renderer dependencies.
export const IMAGE_DIFFICULTIES = {
  gentle: { label: 'Gentle', length: 16, turns: 0.22, pressure: 0.4 },
  thoughtful: { label: 'Thoughtful', length: 24, turns: 0.5, pressure: 1.3 },
  tangled: { label: 'Tangled', length: 36, turns: 0.75, pressure: 2.2 },
};
export const MIN_IMAGE_ARROW_CELLS = 5;
export const IMAGE_DETAILS = { soft: 22, balanced: 34, fine: 46 };
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const inside = (x, y, cols, rows) => x >= 0 && y >= 0 && x < cols && y < rows;
export function imageGrid(width, height, detail = 'balanced') {
  if (!(width > 0 && height > 0)) throw new Error('An image needs a positive width and height.');
  const edge = IMAGE_DETAILS[detail] ?? IMAGE_DETAILS.balanced;
  // Extremely wide screenshots keep their aspect ratio without huge boards.
  const scale = Math.min(edge / Math.min(width, height), 72 / Math.max(width, height));
  return { cols: Math.max(4, Math.round(width * scale)), rows: Math.max(4, Math.round(height * scale)) };
}
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function imageHash(pixels, salt) {
  let hash = 2166136261;
  for (const value of pixels) hash = Math.imul(hash ^ value, 16777619);
  return (hash ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
}
export function imageColours(pixels) {
  const colours = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    colours.push([0, 1, 2].map(c => Math.round(pixels[i + c] * alpha + 255 * (1 - alpha))));
  }
  return colours;
}
const colourDistance = (a, b) => Math.hypot(...a.map((v, i) => (v - b[i]) / 255)) / Math.sqrt(3);

function absorbFragments(arrows, cols, rows, colours, settings, rng) {
  const fragments = new Set(arrows.filter(a => a.cells.length < MIN_IMAGE_ARROW_CELLS).flatMap(a => a.cells.map(([x, y]) => y * cols + x)));
  const paths = arrows.filter(a => a.cells.length >= MIN_IMAGE_ARROW_CELLS);
  // A fragment may join a tail only if its new owner leaves before every head
  // that sees that cell. This preserves the peeling proof, including self exits.
  const firstRay = new Map();
  for (const arrow of paths) {
    const [dx, dy] = arrow.direction, [hx, hy] = arrow.cells.at(-1);
    for (let x = hx + dx, y = hy + dy; inside(x, y, cols, rows); x += dx, y += dy) {
      const key = y * cols + x;
      if (!firstRay.has(key)) firstRay.set(key, arrow.id);
    }
  }
  const mayJoin = (key, arrow) => fragments.has(key) && arrow.id < (firstRay.get(key) ?? Infinity);
  let changed;
  do {
    changed = false;
    for (const arrow of paths) {
      const [x, y] = arrow.cells[0], [bx, by] = arrow.cells[1];
      let choice = null, best = -Infinity;
      for (const [dx, dy] of directions) {
        const nx = x + dx, ny = y + dy, key = ny * cols + nx;
        if (!inside(nx, ny, cols, rows) || !mayJoin(key, arrow)) continue;
        const straight = dx === x - bx && dy === y - by;
        const score = rng() * 0.7 - colourDistance(arrow.colours[0], colours[key]) * 3 + (straight ? 1 - settings.turns : settings.turns);
        if (score > best) { best = score; choice = { key, cell: [nx, ny] }; }
      }
      if (choice) {
        arrow.cells.unshift(choice.cell); arrow.colours.unshift(colours[choice.key]); fragments.delete(choice.key); changed = true;
      }
      // A two-cell detour also absorbs gaps alongside the body. Leave the last
      // segment intact so the head always points along its incoming stroke.
      for (let i = 0; i < arrow.cells.length - 2; i++) {
        const [ax, ay] = arrow.cells[i], [bx, by] = arrow.cells[i + 1];
        const dx = bx - ax, dy = by - ay;
        const offsets = [[-dy, dx], [dy, -dx]];
        for (const [ox, oy] of offsets) {
          const first = [ax + ox, ay + oy], second = [bx + ox, by + oy];
          const keys = [first, second].map(([x, y]) => y * cols + x);
          if (![first, second].every(p => inside(...p, cols, rows)) || !keys.every(key => mayJoin(key, arrow))) continue;
          arrow.cells.splice(i + 1, 0, first, second); arrow.colours.splice(i + 1, 0, ...keys.map(key => colours[key]));
          keys.forEach(key => fragments.delete(key)); changed = true; break;
        }
      }
    }
  } while (changed);
  paths.forEach((a, i) => { a.id = i; });
  return paths;
}

function arrangement(cols, rows, pixels, colours, options, seed) {
  const rng = random(seed), settings = IMAGE_DIFFICULTIES[options.difficulty] ?? IMAGE_DIFFICULTIES.thoughtful;
  const active = new Set(Array.from({ length: cols * rows }, (_, i) => i).filter(i => pixels[i * 4 + 3] >= 24));
  const total = active.size;
  let arrows = [];
  // Peel paths off a full image in solution order. A head sees only already
  // cleared cells, and its tail grows into remaining cells. Short fragments are
  // absorbed into longer tails below rather than becoming extra tiny clicks.
  while (active.size) {
    let choice = null, best = -Infinity;
    for (const id of active) {
      const x = id % cols, y = Math.floor(id / cols);
      for (const direction of directions) {
        const [dx, dy] = direction;
        let nx = x + dx, ny = y + dy, clear = true, corridor = 0;
        while (inside(nx, ny, cols, rows)) {
          if (active.has(ny * cols + nx)) { clear = false; break; }
          corridor++; nx += dx; ny += dy;
        }
        if (!clear) continue;
        const back = (y - dy) * cols + x - dx;
        const hasTail = inside(x - dx, y - dy, cols, rows) && active.has(back);
        const score = rng() * 2 + (hasTail ? 3 : 0) + corridor / Math.max(cols, rows) * settings.pressure;
        if (score > best) { best = score; choice = { id, direction }; }
      }
    }
    if (!choice) throw new Error('No exit found while partitioning the image.');
    const cells = [choice.id], used = new Set(cells);
    let current = choice.id, previous = choice.direction.map(n => -n);
    const maxLength = 8 + Math.floor(rng() * (settings.length - 7));
    for (let length = 1; length < maxLength; length++) {
      const x = current % cols, y = Math.floor(current / cols);
      let next = null, best = -Infinity;
      for (const direction of length === 1 ? [previous] : directions) {
        const [dx, dy] = direction, nx = x + dx, ny = y + dy, id = ny * cols + nx;
        if (!inside(nx, ny, cols, rows) || !active.has(id) || used.has(id)) continue;
        const straight = dx === previous[0] && dy === previous[1];
        const score = rng() * 0.7 - colourDistance(colours[current], colours[id]) * 3 + (straight ? 1 - settings.turns : settings.turns);
        if (score > best) { best = score; next = { id, direction }; }
      }
      if (!next) break;
      cells.unshift(next.id); used.add(next.id); current = next.id; previous = next.direction;
    }
    cells.forEach(id => active.delete(id));
    arrows.push({ id: arrows.length, cells: cells.map(i => [i % cols, Math.floor(i / cols)]), direction: [...choice.direction], colours: cells.map(i => colours[i]) });
  }
  arrows = absorbFragments(arrows, cols, rows, colours, settings, rng);
  const level = { version: 1, cols, rows, arrows, seed, difficulty: options.difficulty, detail: options.detail, solution: arrows.map(a => a.id) };
  const owners = new Map(arrows.flatMap(a => a.cells.map(([x, y]) => [y * cols + x, a.id])));
  const depths = [], free = [], differences = [];
  for (const arrow of arrows) {
    const blockers = imageBlockers(level, arrow, new Set(), owners);
    depths[arrow.id] = 1 + Math.max(0, ...blockers.map(id => depths[id]));
    if (!blockers.length) free.push(arrow.id);
    for (let i = 1; i < arrow.colours.length; i++) differences.push(colourDistance(arrow.colours[i - 1], arrow.colours[i]));
  }
  const represented = arrows.reduce((sum, a) => sum + a.cells.length, 0);
  level.stats = { pixels: represented, skippedPixels: total - represented, arrows: arrows.length, depth: Math.max(0, ...depths), openingMoves: free.length };
  const fidelity = 1 - differences.reduce((sum, n) => sum + n, 0) / Math.max(1, differences.length);
  return { level, score: fidelity * 30 + represented / Math.max(1, total) * 100 + level.stats.depth * settings.pressure - free.length * 0.15 };
}

export function generateImagePuzzle({ cols, rows, pixels, difficulty = 'thoughtful', detail = 'balanced', variation = 0 }) {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > 72 || rows > 72 || pixels.length !== cols * rows * 4) throw new Error('Invalid image grid.');
  if (!Object.hasOwn(IMAGE_DIFFICULTIES, difficulty) || !Object.hasOwn(IMAGE_DETAILS, detail)) throw new Error('Unknown puzzle settings.');
  const seed = imageHash(pixels, variation), colours = imageColours(pixels);
  if (!pixels.some((v, i) => i % 4 === 3 && v >= 24)) throw new Error('This crop is transparent. Choose a visible part of the image.');
  let best = null;
  for (let i = 0; i < 3; i++) {
    const result = arrangement(cols, rows, pixels, colours, { difficulty, detail }, (seed + Math.imul(i, 0x85ebca6b)) >>> 0);
    if (!best || result.score > best.score) best = result;
  }
  if (!best.level.arrows.length) throw new Error('This crop is too fragmented for longer arrows. Choose a larger visible area or more detail.');
  return best.level;
}

export function imageBlockers(level, arrow, removed = new Set(), owners = null) {
  owners ??= new Map(level.arrows.filter(a => !removed.has(a.id)).flatMap(a => a.cells.map(([x, y]) => [y * level.cols + x, a.id])));
  const [dx, dy] = arrow.direction, head = arrow.cells.at(-1), blockers = new Set();
  for (let x = head[0] + dx, y = head[1] + dy; inside(x, y, level.cols, level.rows); x += dx, y += dy) {
    const owner = owners.get(y * level.cols + x);
    if (owner !== undefined && !removed.has(owner)) blockers.add(owner);
  }
  return [...blockers];
}
export function validImageLevel(level) {
  if (!level || !Number.isInteger(level.cols) || !Number.isInteger(level.rows) || level.cols < 1 || level.rows < 1 || level.cols > 72 || level.rows > 72 || !Array.isArray(level.arrows) || !level.arrows.length || level.arrows.length > level.cols * level.rows) return false;
  const owners = new Map();
  for (const [index, arrow] of level.arrows.entries()) {
    if (!arrow || arrow.id !== index || !directions.some(d => d[0] === arrow.direction?.[0] && d[1] === arrow.direction?.[1]) || !Array.isArray(arrow.cells) || !arrow.cells.length || !Array.isArray(arrow.colours) || arrow.colours.length !== arrow.cells.length) return false;
    for (const [i, cell] of arrow.cells.entries()) {
      if (!Array.isArray(cell) || cell.length !== 2 || !cell.every(Number.isInteger) || !inside(...cell, level.cols, level.rows)) return false;
      const key = cell[1] * level.cols + cell[0], colour = arrow.colours[i];
      if (owners.has(key) || !Array.isArray(colour) || colour.length !== 3 || !colour.every(v => Number.isFinite(v) && v >= 0 && v <= 255)) return false;
      if (i && Math.abs(cell[0] - arrow.cells[i - 1][0]) + Math.abs(cell[1] - arrow.cells[i - 1][1]) !== 1) return false;
      owners.set(key, arrow.id);
    }
  }
  // The stored generator order is also a compact proof of solvability.
  return level.arrows.every(a => imageBlockers(level, a, new Set(), owners).every(id => id < a.id));
}
export class ImagePuzzleGame {
  constructor(level, history = []) {
    this.level = level; this.history = []; this.removed = new Set();
    for (const id of history) if (this.release(id).status !== 'removed') break;
  }
  available() { return this.level.arrows.filter(a => !this.removed.has(a.id) && !imageBlockers(this.level, a, this.removed).length); }
  release(id) {
    const arrow = this.level.arrows.find(a => a.id === id);
    if (!arrow || this.removed.has(id)) return { status: 'ignored' };
    const blockers = imageBlockers(this.level, arrow, this.removed);
    if (blockers.length) return { status: 'blocked', blockers };
    this.removed.add(id); this.history.push(id); return { status: 'removed', arrow };
  }
  undo() { const id = this.history.pop(); if (id === undefined) return null; this.removed.delete(id); return id; }
  get remaining() { return this.level.arrows.length - this.removed.size; }
}
