import { checkIndex, clone, random, shuffle } from './pocket-core.js';

const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const key = p => p.join(',');
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TITLES = ['La porte du jardin', 'À petits pas', 'Le sentier', 'Les voisins', 'Le détour fleuri', 'Les allées', 'Cache-cache', 'Les grands chemins', 'Les croisements', 'La ronde', 'Les passages secrets', 'Tout le monde rentre'];
function candidate(index, seed) {
  const rng = random(seed), tier = Math.floor(index / 12), size = 6 + tier, count = 3 + tier;
  const border = [];
  for (let n = 1; n < size - 1; n++) border.push([n, 0], [n, size - 1], [0, n], [size - 1, n]);
  const holes = shuffle(border, rng).slice(0, count), colors = shuffle([0, 1, 2, 3, 4, 5], rng);
  const used = new Set(), reserved = new Set(holes.map(key)), snakes = [], paths = [];
  const walls = shuffle(Array.from({ length: (size - 2) ** 2 }, (_, i) => [i % (size - 2) + 1, Math.floor(i / (size - 2)) + 1]), rng).slice(0, tier + (index % 4 === 3 ? 2 : 0));
  const wallSet = new Set(walls.map(key));
  for (let id = 0; id < count; id++) {
    const length = 3 + (id + index) % (2 + Math.min(tier, 1)), desired = length + 2 + tier + index % 3;
    let best = [holes[id]], budget = 1500;
    function grow(path) {
      if (!budget--) return false;
      if (path.length > best.length) best = path.map(p => [...p]);
      if (path.length === desired) return true;
      for (const [dx, dy] of shuffle(DIRS, rng)) {
        const p = [path.at(-1)[0] + dx, path.at(-1)[1] + dy];
        if (p.some(n => n < 0 || n >= size) || used.has(key(p)) || wallSet.has(key(p)) || reserved.has(key(p)) || path.some(q => same(p, q))) continue;
        path.push(p); if (grow(path)) return true; path.pop();
      }
      return false;
    }
    grow([holes[id]]); if (best.length < length + 1) return null;
    const cells = best.slice(-length), route = best.slice(0, best.length - length).reverse();
    cells.forEach(p => used.add(key(p))); snakes.push({ id, color: colors[id], cells, hole: holes[id] }); paths.push(route);
  }
  let score = 0;
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) score += paths[i].filter(p => snakes[j].cells.some(c => same(c, p))).length * 3;
  score += paths.reduce((n, path) => n + path.length, 0);
  const solution = [];
  for (let id = count - 1; id >= 0; id--) for (const to of paths[id]) solution.push({ id, end: 'head', to });
  return { index, tier, title: TITLES[index % 12], size, walls, snakes, solution, score };
}
export function createEscapadeLevel(index) {
  checkIndex(index); let best = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const next = candidate(index, 32719 + index * 92821 + attempt * 1033);
    if (next && (!best || next.score > best.score)) best = next;
    if (attempt >= 5 && best?.score >= (3 + Math.floor(index / 12)) * 5) break;
  }
  if (!best) throw new Error('Could not construct escapade'); return best;
}
function step(level, state, action) {
  if (!action || !Number.isInteger(action.id) || !['head', 'tail'].includes(action.end) || !Array.isArray(action.to) || action.to.length !== 2 || !action.to.every(Number.isInteger)) return null;
  const snake = state.snakes.find(s => s.id === action.id); if (!snake) return null;
  const cells = action.end === 'tail' ? [...snake.cells].reverse() : snake.cells;
  if (Math.abs(cells[0][0] - action.to[0]) + Math.abs(cells[0][1] - action.to[1]) !== 1) return null;
  if (action.to.some(n => n < 0 || n >= level.size) || level.walls.some(w => same(w, action.to))) return null;
  if (level.snakes.some(s => s.id !== snake.id && same(s.hole, action.to))) return null;
  if (state.snakes.some(s => (s.id === snake.id ? cells.slice(0, -1) : s.cells).some(c => same(c, action.to)))) return null;
  const next = clone(state), moved = next.snakes.find(s => s.id === snake.id);
  if (same(level.snakes.find(s => s.id === snake.id).hole, action.to)) next.snakes = next.snakes.filter(s => s.id !== snake.id);
  else { const body = [action.to, ...cells.slice(0, -1)]; moved.cells = action.end === 'tail' ? body.reverse() : body; }
  return next;
}
function escapeRoute(level, state, id, deadline) {
  const initial = state.snakes.find(s => s.id === id), queue = [{ cells: initial.cells, actions: [] }], seen = new Set([JSON.stringify(initial.cells)]);
  for (let n = 0; n < queue.length && n < 5000 && Date.now() < deadline; n++) {
    const { cells, actions } = queue[n], temp = { snakes: state.snakes.map(s => s.id === id ? { ...s, cells } : s) };
    for (const end of ['head', 'tail']) {
      const first = end === 'head' ? cells[0] : cells.at(-1);
      for (const [dx, dy] of DIRS) {
        const action = { id, end, to: [first[0] + dx, first[1] + dy] }, next = step(level, temp, action); if (!next) continue;
        const body = next.snakes.find(s => s.id === id); if (!body) return [...actions, action];
        const k = JSON.stringify(body.cells); if (seen.has(k)) continue; seen.add(k); queue.push({ cells: body.cells, actions: [...actions, action] });
      }
    }
  }
  return null;
}
export const escapadeRules = {
  create: createEscapadeLevel,
  initial: level => ({ snakes: level.snakes.map(({ id, color, cells }) => ({ id, color, cells: clone(cells) })) }),
  won: (_, state) => !state.snakes.length,
  move: step,
  actions(level, state) {
    return state.snakes.flatMap(s => ['head', 'tail'].flatMap(end => {
      const p = end === 'head' ? s.cells[0] : s.cells.at(-1);
      return DIRS.map(([dx, dy]) => ({ id: s.id, end, to: [p[0] + dx, p[1] + dy] })).filter(a => step(level, state, a));
    }));
  },
  plan(level, start) {
    if (!start.snakes.length) return [];
    let prefix = this.initial(level); const startKey = JSON.stringify(start);
    for (let i = 0; i <= level.solution.length; i++) {
      if (JSON.stringify(prefix) === startKey) return level.solution.slice(i);
      if (i < level.solution.length) prefix = step(level, prefix, level.solution[i]);
    }
    // First try the constructed route. It is instant for an untouched board.
    let state = clone(start), canonical = [];
    for (const action of level.solution) {
      if (!state.snakes.some(s => s.id === action.id)) continue;
      const next = step(level, state, action); if (!next) { canonical = null; break; }
      canonical.push(action); state = next;
    }
    if (canonical && !state.snakes.length) return canonical;
    // Search real body configurations, then verify that ALL remaining creatures escape.
    const deadline = Date.now() + 120; state = clone(start); const result = [];
    while (state.snakes.length) {
      let route = null;
      for (const snake of [...state.snakes].reverse()) { route = escapeRoute(level, state, snake.id, deadline); if (route) break; }
      if (!route) return null;
      for (const action of route) { state = step(level, state, action); result.push(action); }
    }
    return result;
  },
};
