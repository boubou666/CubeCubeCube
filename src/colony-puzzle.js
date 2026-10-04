// Discrete rules, level construction and saves. No renderer or browser dependencies.
export const COLORS = {
  moss: { name: 'Sauge', hex: '#97b896' }, cream: { name: 'Crème', hex: '#f4dfaa' },
  coral: { name: 'Corail', hex: '#e6816c' }, gold: { name: 'Miel', hex: '#efbe57' },
  plum: { name: 'Prune', hex: '#77628e' }, sky: { name: 'Azur', hex: '#84b9ce' },
  ink: { name: 'Encre', hex: '#344b4a' }, leaf: { name: 'Feuille', hex: '#547f63' },
};
export const MOTIFS = ['La petite pousse', 'Un coin de forêt', 'À pas de renard', 'Le grand départ', 'La pause sucrée', 'Au cœur du jardin'];
export const SAVE_KEY = 'cubecubecube-colony-v1';
const copy = value => JSON.parse(JSON.stringify(value));
const validIndex = n => Number.isSafeInteger(n) && n >= 0 && n < 1000000;

function pixel(motif, x, y) {
  const dx = x - 7.5;
  switch (motif) {
    case 0:
      if (y >= 11 && y <= 13 && Math.abs(dx) <= (y === 13 ? 2 : 3)) return 'coral';
      if (y === 10 && Math.abs(dx) <= 4) return 'cream';
      if (x === 8 && y >= 5 && y <= 9) return 'leaf';
      if ((x >= 4 && x <= 7 && y >= 5 && y <= 6) || (x >= 9 && x <= 11 && y >= 3 && y <= 5)) return 'leaf';
      return 'moss';
    case 1:
      if (y >= 4 && y <= 8 && Math.abs(dx) <= [2, 4, 5, 5, 6][y - 4]) return ((x + y * 3) % 7 === 0 ? 'cream' : 'coral');
      if (y >= 9 && y <= 12 && Math.abs(dx) <= 2) return 'cream';
      if (y === 13 && Math.abs(dx) <= 5) return 'leaf';
      return 'moss';
    case 2:
      if (y >= 3 && y <= 6 && ((x >= 3 && x <= 5) || (x >= 10 && x <= 12))) return y < 5 ? 'ink' : 'coral';
      if (y >= 6 && y <= 12 && Math.abs(dx) <= (y < 10 ? 5 : 12 - y + 2)) {
        if (y === 8 && (x === 5 || x === 10) || y === 12 && (x === 7 || x === 8)) return 'ink';
        if (y >= 10 && Math.abs(dx) <= 12 - y + 1 || y === 9 && (x === 3 || x === 12)) return 'cream';
        return 'coral';
      }
      return 'sky';
    case 3:
      if ((x === 3 && y === 4) || (x === 12 && y === 3) || (x === 11 && y === 11)) return 'gold';
      if (y >= 2 && y <= 10 && Math.abs(dx) <= (y < 5 ? y - 1 : 2)) {
        if (y < 5) return 'coral';
        if (y >= 5 && y <= 7 && (x === 7 || x === 8)) return 'sky';
        return 'cream';
      }
      if (y >= 8 && y <= 11 && Math.abs(dx) >= 3 && Math.abs(dx) <= 4) return 'coral';
      if (y >= 11 && y <= 13 && Math.abs(dx) <= 13 - y) return 'gold';
      return 'plum';
    case 4:
      if (y >= 4 && y <= 8 && Math.abs(dx) <= [2, 4, 5, 4, 3][y - 4]) return 'cream';
      if (y >= 9 && y <= 13 && Math.abs(dx) <= (14 - y) / 2) return (x + y) % 3 === 0 ? 'coral' : 'gold';
      if (y === 3 && x === 8) return 'coral';
      return 'sky';
    default:
      if (y >= 9 && y <= 13 && x === 8 || y === 11 && x >= 5 && x <= 7) return 'leaf';
      if ((x - 8) ** 2 + (y - 6) ** 2 <= 3) return 'gold';
      if (((x - 8) ** 2 + (y - 6) ** 2 <= 16) && (Math.abs(x - 8) <= 1 || Math.abs(y - 6) <= 1)) return 'coral';
      return 'moss';
  }
}

// Empty space is flood-filled from outside. Enclosed holes aren't reachable.
export function outsidePaths(level, remaining) {
  const { width: w, height: h } = level, occupied = new Set(remaining.map(id => `${id % w},${Math.floor(id / w)}`));
  const start = `${Math.floor(w / 2)},${h}`, parents = new Map([[start, null]]), queue = [[Math.floor(w / 2), h]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const key = `${nx},${ny}`;
      if (nx < -1 || nx > w || ny < -1 || ny > h || occupied.has(key) || parents.has(key)) continue;
      parents.set(key, `${x},${y}`); queue.push([nx, ny]);
    }
  }
  return parents;
}
export function reachable(level, remaining, color, reserved = new Set(), paths = outsidePaths(level, remaining)) {
  const w = level.width;
  for (const id of [...remaining].sort((a, b) => b - a)) {
    if (reserved.has(id) || level.cells[id] !== color) continue;
    const x = id % w, y = Math.floor(id / w);
    for (const key of [`${x},${y + 1}`, `${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`]) {
      if (!paths.has(key)) continue;
      const route = [[x, y]];
      for (let p = key; p !== null; p = paths.get(p)) route.push(p.split(',').map(Number));
      return { id, route: route.reverse() };
    }
  }
  return null;
}

export function createColonyLevel(index = 0) {
  if (!validIndex(index)) throw new RangeError('Invalid colony level');
  const motif = index % MOTIFS.length, tier = Math.floor(index / MOTIFS.length), size = 16;
  const cells = Array.from({ length: size * size }, (_, id) => {
    const x = id % size, y = Math.floor(id / size);
    // Later journeys add a contrasting border, preserving each picture.
    return tier > 0 && (x === 0 || y === 0 || x === 15 || y === 15) ? ['gold', 'ink', 'plum'][tier % 3] : pixel(motif, x, y);
  });
  const level = { index, width: size, height: size, cells, title: MOTIFS[motif], queues: [[], [], [], []], solution: [] };
  const remaining = cells.map((_, id) => id), quota = Math.max(12, 40 - tier * 4), colors = Object.keys(COLORS);
  let last = null;
  while (remaining.length) {
    const paths = outsidePaths(level, remaining);
    const options = colors.filter(c => reachable(level, remaining, c, new Set(), paths));
    const color = options.find(c => c !== last) || options[0];
    let count = 0;
    for (; count < quota; count++) {
      const target = reachable(level, remaining, color);
      if (!target) break;
      remaining.splice(remaining.indexOf(target.id), 1);
    }
    const queue = level.solution.length % 4, id = level.solution.length;
    level.queues[queue].push({ id, color, count }); level.solution.push(queue); last = color;
  }
  return level;
}

export class ColonyGame {
  constructor(level = createColonyLevel(), state = null) {
    this.level = level; this.history = [];
    this.state = state ? copy(state) : { remaining: level.cells.map((_, i) => i), cursors: [0, 0, 0, 0], slots: Array(5).fill(null), jobs: [], serial: 0, launched: [] };
  }
  get remaining() { return this.state.remaining.length + this.state.jobs.filter(j => j.picked).length; }
  get won() { return this.remaining === 0 && this.state.slots.every(s => !s); }
  get heads() { return this.level.queues.map((q, i) => q[this.state.cursors[i]] || null); }
  launch(queue) {
    const box = this.heads[queue], slot = this.state.slots.indexOf(null);
    if (!box || slot < 0 || this.won) return false;
    this.history.push(copy(this.state));
    this.state.slots[slot] = { ...box, remaining: box.count }; this.state.cursors[queue]++;
    this.state.launched.push(box.id); return true;
  }
  advance(dt) {
    const events = [], s = this.state;
    for (const job of [...s.jobs]) {
      job.elapsed += Math.max(0, dt);
      if (!job.picked && job.elapsed >= job.duration / 2) {
        s.remaining.splice(s.remaining.indexOf(job.cell), 1); job.picked = true; events.push({ type: 'pickup', cell: job.cell });
      }
      if (job.elapsed >= job.duration) {
        const box = s.slots[job.slot]; box.remaining--;
        s.jobs.splice(s.jobs.indexOf(job), 1); events.push({ type: 'delivery', slot: job.slot });
        if (box.remaining === 0) { s.slots[job.slot] = null; events.push({ type: 'free', slot: job.slot }); }
      }
    }
    const reserved = new Set(s.jobs.map(j => j.cell)), paths = outsidePaths(this.level, s.remaining);
    s.slots.forEach((box, slot) => {
      if (!box) return;
      const live = s.jobs.filter(j => j.slot === slot).length;
      for (let i = live; i < Math.min(4, box.remaining); i++) {
        const target = reachable(this.level, s.remaining, box.color, reserved, paths);
        if (!target) break;
        reserved.add(target.id);
        s.jobs.push({ id: ++s.serial, slot, cell: target.id, color: box.color, route: target.route, elapsed: 0, duration: 1.15 + target.route.length * .045, picked: false });
        events.push({ type: 'dispatch', cell: target.id });
      }
    });
    return events;
  }
  settle() { for (let i = 0; i < this.level.cells.length * 2; i++) { this.advance(100); if (!this.state.jobs.length) break; } return this; }
  get stalled() { return !this.won && !this.state.jobs.length && this.state.slots.every(Boolean) && !this.state.slots.some(b => reachable(this.level, this.state.remaining, b.color)); }
  undo() { if (!this.history.length) return false; this.state = this.history.pop(); return true; }
  hint(limit = 2500) {
    const settled = new ColonyGame(this.level, this.state).settle();
    if (settled.won) return { type: 'wait' };
    const seen = new Set(); let visited = 0;
    const search = game => {
      if (game.won) return [];
      if (++visited > limit) return null;
      const s = game.state, key = `${s.cursors}|${s.slots.map(b => b ? `${b.color}:${b.remaining}` : '-')}|${s.remaining.join(',')}`;
      if (seen.has(key)) return null; seen.add(key);
      if (!s.slots.includes(null)) return null;
      for (const q of [0, 1, 2, 3].sort((a, b) => (game.heads[a]?.id ?? Infinity) - (game.heads[b]?.id ?? Infinity))) {
        if (!game.heads[q]) continue;
        const next = new ColonyGame(this.level, s); next.launch(q); next.settle();
        const rest = search(next); if (rest) return [q, ...rest];
      }
      return null;
    };
    const path = search(settled);
    if (path?.length) return this.state.slots.includes(null) ? { type: 'box', queue: path[0] } : { type: 'wait' };
    return this.state.jobs.length ? { type: 'wait' } : visited > limit ? { type: 'unknown' } : { type: 'undo' };
  }
}

export function encodeColonySave(game, completed = [], speed = 1) {
  return { version: 1, index: game.level.index, state: copy(game.state), history: copy(game.history), completed: completed.filter(validIndex), speed: speed === 2 ? 2 : 1 };
}
export function decodeColonySave(raw) {
  try {
    if (!raw || raw.version !== 1 || !validIndex(raw.index)) return null;
    const level = createColonyLevel(raw.index), game = new ColonyGame(level);
    const validate = state => {
      if (!state || !Array.isArray(state.remaining) || !Array.isArray(state.cursors) || state.cursors.length !== 4 || !Array.isArray(state.slots) || state.slots.length !== 5 || !Array.isArray(state.jobs) || !Array.isArray(state.launched) || !Number.isSafeInteger(state.serial) || state.serial < 0) return false;
      if (state.cursors.some((n, q) => !Number.isInteger(n) || n < 0 || n > level.queues[q].length)) return false;
      const launched = level.queues.flatMap((q, i) => q.slice(0, state.cursors[i]));
      if (state.launched.length !== launched.length || new Set(state.launched).size !== launched.length || state.launched.some(id => !launched.some(b => b.id === id))) return false;
      if (state.remaining.some(id => !Number.isInteger(id) || id < 0 || id >= level.cells.length) || new Set(state.remaining).size !== state.remaining.length) return false;
      const boxes = state.slots.filter(Boolean);
      if (new Set(boxes.map(b => b.id)).size !== boxes.length || boxes.some(b => !launched.some(l => l.id === b.id && l.color === b.color && l.count === b.count) || !Number.isInteger(b.remaining) || b.remaining <= 0 || b.remaining > b.count)) return false;
      if (new Set(state.jobs.map(j => j.id)).size !== state.jobs.length || new Set(state.jobs.map(j => j.cell)).size !== state.jobs.length) return false;
      if (state.jobs.some(j => !Number.isInteger(j.cell) || j.cell < 0 || j.cell >= level.cells.length || !Number.isSafeInteger(j.id) || j.id <= 0 || j.id > state.serial || !state.slots[j.slot] || state.slots[j.slot].color !== j.color || level.cells[j.cell] !== j.color || typeof j.picked !== 'boolean' || state.remaining.includes(j.cell) === j.picked || !Number.isFinite(j.elapsed) || j.elapsed < 0 || !Number.isFinite(j.duration) || j.duration <= 0 || !Array.isArray(j.route) || !j.route.length || j.route.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n))))) return false;
      if (state.jobs.some(j => !Number.isInteger(j.slot) || j.slot < 0 || j.slot >= 5 || j.elapsed >= j.duration || j.picked !== (j.elapsed >= j.duration / 2) || j.route[0][0] !== Math.floor(level.width / 2) || j.route[0][1] !== level.height || j.route.at(-1)[0] !== j.cell % level.width || j.route.at(-1)[1] !== Math.floor(j.cell / level.width) || j.route.some((p, i) => !Number.isInteger(p[0]) || !Number.isInteger(p[1]) || p[0] < -1 || p[0] > level.width || p[1] < -1 || p[1] > level.height || i > 0 && Math.abs(p[0] - j.route[i - 1][0]) + Math.abs(p[1] - j.route[i - 1][1]) !== 1))) return false;
      for (const color of Object.keys(COLORS)) {
        const collected = launched.filter(b => b.color === color).reduce((n, b) => n + b.count, 0) - boxes.filter(b => b.color === color).reduce((n, b) => n + b.remaining, 0);
        const removed = level.cells.filter(c => c === color).length - state.remaining.filter(id => level.cells[id] === color).length - state.jobs.filter(j => j.picked && j.color === color).length;
        if (collected !== removed || boxes.some(b => state.jobs.filter(j => j.slot === state.slots.indexOf(b)).length > b.remaining)) return false;
      }
      return true;
    };
    if (!validate(raw.state) || !Array.isArray(raw.history) || raw.history.length > level.solution.length || raw.history.some(s => !validate(s))) return null;
    game.state = copy(raw.state); game.history = copy(raw.history);
    return { game, completed: Array.isArray(raw.completed) ? [...new Set(raw.completed.filter(validIndex))] : [], speed: raw.speed === 2 ? 2 : 1 };
  } catch { return null; }
}
