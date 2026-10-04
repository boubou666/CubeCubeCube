// Discrete surface rules. This module deliberately has no renderer or DOM dependencies.
import { hasMechanisms, analyzeMechanismMove, solveMechanisms, mechanismPuzzle, inSection } from './mechanics.js';
import { parkingPocket } from './parking.js';
export { hasMechanisms } from './mechanics.js';
export const FACES = {
  front: { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  right: { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  back: { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  left: { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  top: { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  bottom: { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
};
export const FACE_NAMES = Object.keys(FACES);
export const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const key = ({ face, x, y }) => `${face}:${x}:${y}`;
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

const shapeCache = new Map();
// Build a real exposed surface from solid voxels. Face names identify a normal
// and a plane, so inner tunnel walls and stair treads have their own grids.
export function surfaceLayout(size) {
  const cacheKey = JSON.stringify(size);
  if (shapeCache.has(cacheKey)) return shapeCache.get(cacheKey);
  const dimensions = typeof size === 'number' ? [size, size, size] : [size.x, size.y, size.z];
  const pitch = 3.6 / Math.max(...dimensions), cells = [], frames = {}, edges = new Map(), adjacency = new Map();
  const solid = new Set(), voxelKey = p => p.join(',');
  for (let x = 0; x < dimensions[0]; x++) for (let y = 0; y < dimensions[1]; y++) for (let z = 0; z < dimensions[2]; z++) {
    if (size.hole && x >= size.hole.x[0] && x <= size.hole.x[1] && y >= size.hole.y[0] && y <= size.hole.y[1]) continue;
    if (size.heights && y >= size.heights[x]) continue;
    if (size.terrace && x >= size.terrace.x[0] && x <= size.terrace.x[1] && z >= size.terrace.z[0] && z <= size.terrace.z[1] && y >= size.terrace.heights[x - size.terrace.x[0]]) continue;
    solid.add(voxelKey([x, y, z]));
  }
  for (const voxel of solid) {
    const coordinates = voxel.split(',').map(Number);
    for (const name of FACE_NAMES) {
      const f = FACES[name], normalAxis = f.normal.findIndex(v => v);
      if (solid.has(voxelKey(coordinates.map((v, i) => v + f.normal[i])))) continue;
      const p = coordinates.map((v, i) => v - (dimensions[i] - 1) / 2 + f.normal[i] * 0.5);
      const plane = dot(p, f.normal);
      const face = plane === dimensions[normalAxis] / 2 ? name : `${name}@${plane}`;
      FACES[face] = f;
      const width = dimensions[f.u.findIndex(v => v)], height = dimensions[f.v.findIndex(v => v)];
      frames[face] = { ...f, plane, width, height };
      const cell = { face, x: Math.round(dot(p, f.u) + (width - 1) / 2), y: Math.round(dot(p, f.v) + (height - 1) / 2) };
      cells.push(cell);
      for (const direction of DIRECTIONS) {
        const tangent = worldDirection(face, direction), perpendicular = worldDirection(face, [-direction[1], direction[0]]);
        const middle = p.map((v, i) => v + tangent[i] * 0.5);
        const endpoints = [-1, 1].map(sign => middle.map((v, i) => v + perpendicular[i] * 0.5 * sign));
        const edge = endpoints.map(point => point.map(v => Math.round(v * 2)).join(',')).sort().join('|');
        if (!edges.has(edge)) edges.set(edge, []);
        edges.get(edge).push({ cell, direction, middle, endpoints, center: p });
      }
    }
  }
  for (const incident of edges.values()) {
    if (incident.length !== 2) throw new Error('Each surface edge must connect exactly two cells');
    for (let i = 0; i < 2; i++) {
      const a = incident[i], b = incident[1 - i], f = FACES[b.cell.face];
      const forward = b.center.map((v, axis) => (v - a.middle[axis]) * 2);
      adjacency.set(`${key(a.cell)}:${a.direction}`, { cell: b.cell, direction: [Math.round(dot(forward, f.u)), Math.round(dot(forward, f.v))] });
    }
  }
  const result = { dimensions, pitch, cells, frames, edges, adjacency, solid }; shapeCache.set(cacheKey, result); return result;
}

export function ridgeSegments(faces, size) {
  const layout = surfaceLayout(size), pair = edgeKey(...faces);
  return [...layout.edges.values()].filter(items => items[0].cell.face !== items[1].cell.face && edgeKey(items[0].cell.face, items[1].cell.face) === pair).map(items => {
    const offset = FACES[faces[0]].normal.map((v, i) => (v + FACES[faces[1]].normal[i]) * 0.035);
    return items[0].endpoints.map(point => point.map((v, i) => v * layout.pitch + offset[i]));
  });
}

export function worldPoint(cell, size, half = 1.8) {
  if (typeof size === 'object') {
    const layout = surfaceLayout(size), f = layout.frames[cell.face];
    return f.normal.map((v, i) => (v * f.plane + f.u[i] * (cell.x - (f.width - 1) / 2) + f.v[i] * (cell.y - (f.height - 1) / 2)) * layout.pitch);
  }
  const f = FACES[cell.face];
  const spacing = half * 2 / size;
  return f.normal.map((v, i) => v * half + f.u[i] * (cell.x - (size - 1) / 2) * spacing + f.v[i] * (cell.y - (size - 1) / 2) * spacing);
}

export function worldDirection(face, direction) {
  const f = FACES[face];
  return f.u.map((v, i) => v * direction[0] + f.v[i] * direction[1]);
}

// Parallel transport over a cube edge: the new tangent is minus the old normal.
export function step(cell, direction, size) {
  if (typeof size === 'object') return surfaceLayout(size).adjacency.get(`${key(cell)}:${direction}`);
  const x = cell.x + direction[0], y = cell.y + direction[1];
  if (x >= 0 && x < size && y >= 0 && y < size) {
    return { cell: { face: cell.face, x, y }, direction: [...direction] };
  }
  const old = FACES[cell.face];
  const tangent = worldDirection(cell.face, direction);
  const face = FACE_NAMES.find(name => dot(FACES[name].normal, tangent) === 1);
  const f = FACES[face];
  const p = worldPoint(cell, size, size / 2).map((v, i) => v + tangent[i] * 0.5 - old.normal[i] * 0.5);
  return {
    cell: { face, x: Math.round(dot(p, f.u) + (size - 1) / 2), y: Math.round(dot(p, f.v) + (size - 1) / 2) },
    direction: [-dot(old.normal, f.u), -dot(old.normal, f.v)],
  };
}

export const edgeKey = (a, b) => [a, b].sort().join(':');
export const arrowCells = arrow => [...new Map([
  ...(arrow.exited ? [] : arrow.cells),
  ...(arrow.branch?.exited ? [] : arrow.branch?.cells ?? []),
].map(cell => [key(cell), cell])).values()];
export const headCount = arrow => arrow.twoHeads || arrow.branch ? 2 : 1;

export function orientArrow(arrow, size, end = 0) {
  return { spine: { ...arrow, cells: end ? [...arrow.cells].reverse() : arrow.cells, direction: arrowEnd(arrow, size, end).direction } };
}

export function arrowEnd(arrow, size, end = 0) {
  if (end === 0) return { cell: arrow.cells.at(-1), direction: [...arrow.direction] };
  if (arrow.branch && end === 1) return { cell: arrow.branch.cells.at(-1), direction: [...arrow.branch.direction] };
  if (!arrow.twoHeads || end !== 1) throw new RangeError('This arrow has no second head');
  const inward = DIRECTIONS.find(d => key(step(arrow.cells[0], d, size).cell) === key(arrow.cells[1]));
  return { cell: arrow.cells[0], direction: inward.map(v => -v) };
}

// An ordinary surface edge is only an exit if its straight flight clears the solid.
// Probe the ray in voxel coordinates, slightly above the arrow's supporting face.
export function exitHitsSolid(cell, direction, size) {
  if (typeof size === 'number') return false;
  const { dimensions, pitch, solid } = surfaceLayout(size), f = FACES[cell.face];
  const origin = worldPoint(cell, size).map((v, i) => v / pitch + dimensions[i] / 2 + f.normal[i] * 0.055 / pitch);
  const tangent = worldDirection(cell.face, direction);
  for (let distance = 0.25; distance <= Math.max(...dimensions) * 2; distance += 0.25) {
    const voxel = origin.map((v, i) => Math.floor(v + tangent[i] * distance));
    if (solid.has(voxel.join(','))) return true;
  }
  return false;
}

// A painted physical ridge works from either incident face. Ordinary edges are exits.
export function travelRoute(arrow, size, bridges = [], end = 0, circles = []) {
  let state = arrowEnd(arrow, size, end);
  const states = [state], crossings = [], seen = new Set([`${key(state.cell)}:${state.direction}`]);
  const connected = new Map(bridges.map(b => [edgeKey(...b.faces), b]));
  while (true) {
    const next = step(state.cell, state.direction, size);
    if (next.cell.face !== state.cell.face) {
      const bridge = connected.get(edgeKey(state.cell.face, next.cell.face));
      if (!bridge) return { states, crossings, loop: false, end, stopped: false, solid: exitHitsSolid(state.cell, state.direction, size) };
      crossings.push({ from: state.cell.face, to: next.cell.face, color: bridge.color });
    }
    const visit = `${key(next.cell)}:${next.direction}`;
    if (seen.has(visit)) return { states, crossings, loop: true, end };
    seen.add(visit); states.push(next); state = next;
    // The circle under the starting head is intentionally skipped: another tap resumes.
    if (circles.some(c => key(c) === key(next.cell))) return { states, crossings, loop: false, end, stopped: true };
  }
}

export function exitCells(arrow, size, bridges = [], end = 0, circles = []) {
  return travelRoute(arrow, size, bridges, end, circles).states.slice(1).map(s => s.cell);
}

// Leaving a surface is still a physical flight. A tunnel can interrupt the cell
// grid while another arrow remains directly ahead, on the far side of the gap.
function rayTouchesSegment(origin, direction, a, b, radius = 0.105) {
  const v = b.map((n, i) => n - a[i]), w = origin.map((n, i) => n - a[i]);
  const c = dot(v, v), uv = dot(direction, v), uw = dot(direction, w), vw = dot(v, w);
  const candidates = [0, 1];
  if (c > 1e-10) candidates.push(Math.max(0, Math.min(1, vw / c)));
  const denominator = c - uv * uv;
  if (denominator > 1e-10) {
    const t = (vw - uv * uw) / denominator;
    if (t >= 0 && t <= 1) candidates.push(t);
  }
  return candidates.some(t => {
    const p = a.map((n, i) => n + v[i] * t);
    const distance = Math.max(0, dot(p.map((n, i) => n - origin[i]), direction));
    return p.reduce((sum, n, i) => sum + (n - origin[i] - direction[i] * distance) ** 2, 0) < radius ** 2;
  });
}

const flightGeometry = new WeakMap();
export function flightBlockerIds(route, arrows, removed, size) {
  if (route.stopped || route.loop || route.solid || typeof size === 'number' || !(size.hole || size.terrace || size.heights)) return [];
  const last = route.states.at(-1), normal = FACES[last.cell.face].normal;
  const direction = worldDirection(last.cell.face, last.direction);
  const pitch = surfaceLayout(size).pitch;
  const origin = worldPoint(last.cell, size).map((n, i) => n + normal[i] * 0.055 + direction[i] * pitch * 0.5);
  return arrows.filter(a => !removed.has(a.id) && [a, ...(a.branch ? [a.branch] : [])].some(part => {
    if (part.exited) return false;
    let cached = flightGeometry.get(part.cells);
    if (!cached || cached.size !== size) {
      cached = { size, points: part.cells.map(cell => worldPoint(cell, size).map((n, i) => n + FACES[cell.face].normal[i] * 0.055)) };
      flightGeometry.set(part.cells, cached);
    }
    const points = cached.points;
    return points.some((point, i) => rayTouchesSegment(origin, direction, point, points[i + 1] ?? point));
  })).map(a => a.id);
}

export function blockerIds(arrow, arrows, removed, size, bridges = [], end = 0, circles = []) {
  const ends = arrow.branch ? [0, 1].filter(i => !(i ? arrow.branch : arrow).exited) : [end];
  const routes = ends.map(i => travelRoute(arrow, size, bridges, i, circles));
  const ahead = new Set(routes.flatMap(r => r.states.slice(1)).map(s => key(s.cell)));
  return [...new Set([
    ...arrows.filter(a => !removed.has(a.id) && arrowCells(a).some(c => ahead.has(key(c)))).map(a => a.id),
    ...routes.flatMap(route => flightBlockerIds(route, arrows, removed, size)),
  ])];
}

// Forks have one move: both live heads must be able to advance together.
function movementRoutes(arrow, level, end) {
  const ends = arrow.branch ? [0, 1] : [end];
  return ends.map(i => (i && arrow.branch ? arrow.branch : arrow).exited ? null : travelRoute(arrow, level.size, level.bridges, i, level.circles));
}

export function availableMoves(level, removed = new Set()) {
  if (hasMechanisms(level)) return level.arrows.filter(a => !removed.has(a.id)).flatMap(arrow =>
    (arrow.branch ? [arrow.exited ? 1 : 0] : headCount(arrow) === 2 ? [0, 1] : [0]).filter(end => analyzeMechanismMove(level, removed, arrow, end, true).status !== 'blocked').map(end => ({ id: arrow.id, end })));
  return level.arrows.filter(a => !removed.has(a.id)).flatMap(arrow => (arrow.branch ? [arrow.exited ? 1 : 0] : headCount(arrow) === 2 ? [0, 1] : [0]).filter(end =>
    !movementRoutes(arrow, level, end).some(route => route?.loop || route?.solid) && blockerIds(arrow, level.arrows, removed, level.size, level.bridges, end, level.circles).length === 0
  ).map(end => ({ id: arrow.id, end })));
}

export function availableArrows(level, removed = new Set()) {
  const ids = new Set(availableMoves(level, removed).map(m => m.id));
  return level.arrows.filter(a => ids.has(a.id));
}

export function solve(level, initial = new Set()) {
  if (hasMechanisms(level)) return solveMechanisms(level, initial)?.map(m => m.id) ?? null;
  if (level.circles?.length) return solveWithStops(level, initial)?.map(m => m.id) ?? null;
  const removed = new Set(initial), order = [];
  while (removed.size < level.arrows.length) {
    const arrow = availableArrows(level, removed)[0];
    if (!arrow) return null;
    removed.add(arrow.id); order.push(arrow.id);
  }
  return order;
}

function shiftedArrow(arrow, route, end, size) {
  const { spine } = orientArrow(arrow, size, end);
  const future = route.states.slice(1).map(s => s.cell);
  const cells = [...spine.cells, ...future].slice(-spine.cells.length);
  const updated = { ...arrow, cells, direction: route.states.at(-1).direction };
  return updated;
}

function advanceArrow(arrow, routes, end, size) {
  if (!arrow.branch) return shiftedArrow(arrow, routes[0], end, size);
  const advance = (part, route) => route?.stopped ? {
    ...part, cells: [...part.cells, ...route.states.slice(1).map(s => s.cell)].slice(-part.cells.length),
    direction: route.states.at(-1).direction,
  } : { ...part, exited: true };
  return { ...advance(arrow, routes[0]), branch: advance(arrow.branch, routes[1]) };
}

// Circle puzzles can change occupancy. Search board states, not just removal sets.
export function solveWithStops(level, initial = new Set(), maxStates = 20000) {
  if (hasMechanisms(level)) return solveMechanisms(level, initial, maxStates);
  if (level.parkingGroups) {
    // Search each protected group, never combinations of unrelated filler moves.
    const moves = [], grouped = new Set(level.parkingGroups.flat());
    for (const ids of level.parkingGroups) {
      const pocket = { ...level, arrows: level.arrows.filter(a => ids.includes(a.id)), independentStops: false, parkingGroups: null };
      const solution = solveWithStops(pocket, new Set(ids.filter(id => initial.has(id))), maxStates);
      if (!solution) return null;
      moves.push(...solution);
    }
    const filler = { ...level, arrows: level.arrows.filter(a => !grouped.has(a.id)), circles: [], parkingGroups: null, independentStops: true };
    const solution = solveWithStops(filler, new Set([...initial].filter(id => !grouped.has(id))), maxStates);
    return solution ? [...moves, ...solution] : null;
  }
  // Generated circle pockets are isolated from the filler routes. Their small
  // parking cycles can be solved greedily without searching the whole large board.
  if (level.independentStops) {
    const current = structuredClone(level), removed = new Set(initial), moves = [];
    for (let i = 0; i < level.arrows.length * 3; i++) {
      if (removed.size === level.arrows.length) return moves;
      const move = availableMoves(current, removed)[0]; if (!move) return null;
      const arrow = current.arrows.find(a => a.id === move.id), routes = movementRoutes(arrow, current, move.end);
      if (routes.some(r => r?.stopped)) current.arrows = current.arrows.map(a => a.id === move.id ? advanceArrow(arrow, routes, move.end, current.size) : a);
      else removed.add(move.id);
      moves.push(move);
    }
    return null;
  }
  const queue = [{ level: structuredClone(level), removed: new Set(initial), moves: [] }], seen = new Set();
  for (let cursor = 0; cursor < queue.length && cursor < maxStates; cursor++) {
    const current = queue[cursor];
    if (current.removed.size === level.arrows.length) return current.moves;
    const signature = JSON.stringify(current.level.arrows.filter(a => !current.removed.has(a.id)));
    if (seen.has(signature)) continue;
    seen.add(signature);
    for (const move of availableMoves(current.level, current.removed)) {
      const next = { level: { ...current.level, arrows: [...current.level.arrows] }, removed: new Set(current.removed), moves: [...current.moves, move] };
      const arrow = next.level.arrows.find(a => a.id === move.id);
      const routes = movementRoutes(arrow, current.level, move.end);
      if (routes.some(route => route?.stopped)) next.level.arrows = next.level.arrows.map(a => a.id === arrow.id ? advanceArrow(arrow, routes, move.end, level.size) : a);
      else next.removed.add(arrow.id);
      queue.push(next);
    }
  }
  return null;
}

function circlePuzzle(combined = false) {
  const front = points => points.map(([x, y]) => ({ face: 'front', x, y }));
  const arrows = [
    { id: 0, cells: front([[0, 1], [1, 1]]), direction: [1, 0] },
    { id: 1, cells: front([[3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2]]), direction: [0, -1] },
  ];
  if (combined) {
    arrows.push({ id: 2, cells: [{ face: 'top', x: 1, y: 1 }, { face: 'top', x: 2, y: 1 }], direction: [1, 0], twoHeads: true });
    arrows.push({ id: 3, cells: [{ face: 'right', x: 2, y: 1 }, { face: 'right', x: 3, y: 1 }], direction: [1, 0] });
  }
  return { size: 4, seed: 0, arrows, circles: [{ face: 'front', x: 2, y: 1 }], bridges: combined ? [{ faces: ['top', 'right'], color: '#b97e93' }] : [] };
}

function branchPuzzle(bridged = false) {
  const cells = (face, points) => points.map(([x, y]) => ({ face, x, y }));
  const arrows = [
    { id: 0, cells: cells('front', [[1, 1], [1, 2], [2, 2], [3, 2]]), direction: [1, 0], branch: { cells: cells('front', [[1, 2], [1, 3], [1, 4]]), direction: [0, 1] } },
    { id: 1, cells: cells(bridged ? 'right' : 'front', bridged ? [[3, 1], [3, 2]] : [[4, 1], [4, 2]]), direction: [0, 1] },
    { id: 2, cells: cells('front', [[0, 4], [0, 3]]), direction: [0, -1] },
    { id: 3, cells: cells('top', [[0, 1], [1, 1], [2, 1]]), direction: [1, 0] },
  ];
  return { size: 5, seed: 0, arrows, bridges: bridged ? [{ faces: ['front', 'right'], color: '#d89b54' }, { faces: ['front', 'top'], color: '#b97e93' }] : [] };
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

// Build in reverse removal order. Every added path is clear in the current board,
// so removing paths in reverse construction order always solves the final board.
export function generateLevel({ size, count, seed, maxLength = 6, wrap = true, bridges = [], twoHeads = false, branches = 0, reserved = [], packed = false, pressure = 0 }) {
  const rng = random(seed), occupied = new Set(), arrows = [];
  const openRoutes = new Map();
  const protectedCells = new Set(reserved.map(key));
  const shapedCells = typeof size === 'object' ? surfaceLayout(size).cells : null;
  for (let attempt = 0; attempt < 25000 && arrows.length < count; attempt++) {
    const head = shapedCells ? { ...shapedCells[Math.floor(rng() * shapedCells.length)] } : { face: FACE_NAMES[Math.floor(rng() * 6)], x: Math.floor(rng() * size), y: Math.floor(rng() * size) };
    if (occupied.has(key(head)) || protectedCells.has(key(head))) continue;
    const direction = DIRECTIONS[Math.floor(rng() * 4)];
    const candidate = { id: arrows.length, cells: [head], direction: [...direction] };
    const route = travelRoute(candidate, size, bridges);
    if (route.loop || route.solid) continue;
    if (flightBlockerIds(route, arrows, new Set(), size).length) continue;
    const ahead = new Set(exitCells(candidate, size, bridges).map(key));
    if ([...ahead].some(k => occupied.has(k) || protectedCells.has(k))) continue;
    let cell = head, backwards = direction.map(v => -v);
    const used = new Set([key(head)]);
    // Short paths remain common even in the intricate boards, leaving room for
    // later paths while still allowing long, multi-face snakes.
    const capacity = shapedCells?.length ?? 6 * size * size;
    const lengthLimit = packed ? Math.min(maxLength, Math.max(2, Math.floor((capacity * 0.72 - occupied.size - protectedCells.size) / (count - arrows.length)))) : maxLength;
    const length = 2 + Math.floor(rng() ** 1.7 * (lengthLimit - 1));
    for (let i = 1; i < length; i++) {
      const possibilities = [backwards, ...DIRECTIONS.filter(d => dot(d, backwards) === 0)];
      // First step establishes the actual direction at the arrowhead.
      if (i > 1 && rng() < 0.38) possibilities.reverse();
      let choice;
      for (const d of i === 1 ? [backwards] : possibilities) {
        const next = step(cell, d, size);
        if (!wrap && next.cell.face !== cell.face) continue;
        const k = key(next.cell);
        if (!occupied.has(k) && !protectedCells.has(k) && !used.has(k) && !ahead.has(k)) { choice = next; break; }
      }
      if (!choice) break;
      cell = choice.cell; backwards = choice.direction;
      candidate.cells.unshift(cell); used.add(key(cell));
    }
    if (candidate.cells.length < 2) continue;
    if (flightBlockerIds(route, [candidate], new Set(), size).length) continue;
    if (branches && candidate.cells.length >= 3 && rng() < branches) {
      const joint = candidate.cells[1 + Math.floor(rng() * (candidate.cells.length - 2))];
      const start = Math.floor(rng() * 4);
      for (let i = 0; i < 4; i++) {
        let branchStep = step(joint, DIRECTIONS[(start + i) % 4], size);
        const branch = { cells: [joint], direction: branchStep.direction };
        for (let j = 0, length = 1 + Math.floor(rng() * 2); j < length; j++) {
          const k = key(branchStep.cell);
          if (occupied.has(k) || protectedCells.has(k) || used.has(k) || ahead.has(k)) break;
          branch.cells.push(branchStep.cell); branch.direction = branchStep.direction;
          branchStep = step(branchStep.cell, branchStep.direction, size);
        }
        if (branch.cells.length < 2 || Math.abs(dot(worldDirection(branch.cells.at(-1).face, branch.direction), worldDirection(head.face, direction))) > 0.9) continue;
        candidate.branch = branch;
        const branchRoute = travelRoute(candidate, size, bridges, 1);
        const branchAhead = new Set(branchRoute.states.slice(1).map(s => key(s.cell)));
        if (branchRoute.loop || branchRoute.solid || flightBlockerIds(branchRoute, [...arrows, candidate], new Set(), size).length || flightBlockerIds(route, [candidate], new Set(), size).length || [...branchAhead].some(k => occupied.has(k) || protectedCells.has(k)) || arrowCells(candidate).some(c => branchAhead.has(key(c)))) {
          delete candidate.branch; continue;
        }
        break;
      }
    }
    const body = new Set(arrowCells(candidate).map(key));
    const newlyBlocked = [...openRoutes].filter(([, route]) => [...body].some(k => route.has(k))).map(([id]) => id);
    if (arrows.length && pressure && !newlyBlocked.length && rng() < pressure) continue;
    if (twoHeads && !candidate.branch) candidate.twoHeads = typeof twoHeads === 'number' ? rng() < twoHeads : candidate.id % 3 === 0;
    // Either direction of an opposite-ended filler arrow must stay outside the
    // protected parking pockets; a circle must never move a filler body.
    if (candidate.twoHeads && protectedCells.size && exitCells(candidate, size, bridges, 1).some(c => protectedCells.has(key(c)))) delete candidate.twoHeads;
    arrowCells(candidate).forEach(c => occupied.add(key(c)));
    arrows.push(candidate);
    if (pressure) {
      newlyBlocked.forEach(id => openRoutes.delete(id));
      openRoutes.set(candidate.id, new Set([0, ...(candidate.branch ? [1] : [])].flatMap(end => exitCells(candidate, size, bridges, end)).map(key)));
    }
  }
  if (arrows.length !== count) throw new Error(`Could only place ${arrows.length}/${count} arrows for seed ${seed}`);
  return { size, arrows, seed, bridges };
}

// Handcrafted opening: three arrows per face. A clearly readable first dependency.
function firstLight() {
  const arrows = [];
  for (const face of FACE_NAMES) {
    for (const [cells, direction] of [
      [[[0, 1], [0, 2], [1, 2]], [1, 0]],
      [[[2, 1], [2, 2], [3, 2]], [1, 0]],
      [[[3, 0], [2, 0], [1, 0]], [-1, 0]],
    ]) arrows.push({ id: arrows.length, cells: cells.map(([x, y]) => ({ face, x, y })), direction });
  }
  return { size: 4, arrows, seed: 0 };
}

export const LEVELS = [
  { title: 'First light', caption: 'Every little journey starts with a clear path.', difficulty: 'Gentle', size: 4, count: 18, seed: 0 },
  { title: 'Around the bend', caption: 'A new perspective is just a turn away.', difficulty: 'Gentle', size: 4, count: 22, seed: 217, maxLength: 4 },
  { title: 'Loose ends', caption: 'Take it one arrow at a time.', difficulty: 'Gentle', size: 4, count: 25, seed: 831, maxLength: 5 },
  { title: 'Quiet corners', caption: 'Some answers are hiding around the corner.', difficulty: 'Thoughtful', size: 5, count: 32, seed: 1301 },
  { title: 'A different angle', caption: 'Turn it over. See what opens up.', difficulty: 'Thoughtful', size: 5, count: 36, seed: 1947 },
  { title: 'Little by little', caption: 'Small moves make room for big ones.', difficulty: 'Thoughtful', size: 5, count: 38, seed: 2751 },
  { title: 'The long way', caption: 'Let your eyes follow the winding paths.', difficulty: 'Intricate', size: 6, count: 46, seed: 3127, maxLength: 7 },
  { title: 'Interwoven', caption: 'Everything untangles eventually.', difficulty: 'Intricate', size: 6, count: 50, seed: 4529, maxLength: 7 },
  { title: 'Room to breathe', caption: 'Find a little space. Make a little more.', difficulty: 'Intricate', size: 6, count: 52, seed: 5879, maxLength: 7 },
  { title: 'A closer look', caption: 'There is always another side to the story.', difficulty: 'Deep focus', size: 7, count: 65, seed: 6737, maxLength: 8 },
  { title: 'Softly, slowly', caption: 'No hurry. Just you and the next move.', difficulty: 'Deep focus', size: 7, count: 68, seed: 7920, maxLength: 8 },
  { title: 'Full circle', caption: 'A little patience brings it all together.', difficulty: 'Deep focus', size: 7, count: 72, seed: 8971, maxLength: 8 },
  { title: 'Across the seam', caption: 'An amber ridge leads to the next face. Follow it around.', difficulty: 'New mechanic', size: 4, count: 18, seed: 0, tutorial: 'ridges', bridges: [{ faces: ['front', 'right'], color: '#d89b54' }] },
  { title: 'Two ways to go', caption: 'One head blocked? Tap the other. You choose the direction.', difficulty: 'New mechanic', size: 4, count: 18, seed: 0, tutorial: 'twoHeads', twoHeads: true },
  { title: 'Connected thoughts', caption: 'Two heads. A colored seam. A different way through.', difficulty: 'Thoughtful', size: 4, count: 20, seed: 9031, maxLength: 4, twoHeads: true, bridges: [{ faces: ['front', 'right'], color: '#d89b54' }] },
  { title: 'A meeting of sides', caption: 'Follow the amber and rose ridges. Look beyond the first face.', difficulty: 'Intricate', size: 5, count: 32, seed: 10007, maxLength: 5, twoHeads: true, bridges: [{ faces: ['front', 'right'], color: '#d89b54' }, { faces: ['top', 'right'], color: '#b97e93' }] },
  { title: 'A place to pause', caption: 'Park the short arrow on the circle. It frees a path for the winding arrow.', difficulty: 'New mechanic', size: 4, count: 2, seed: 0, tutorial: 'circles' },
  { title: 'Pause & perspective', caption: 'A circle, two heads, a colored ridge. Take it one move at a time.', difficulty: 'Thoughtful', size: 4, count: 4, seed: 0, tutorial: 'combined' },
  { title: 'A fork in the path', caption: 'Two heads, two journeys. Both paths must be clear.', difficulty: 'New mechanic', size: 5, count: 4, seed: 0, tutorial: 'branches' },
  { title: 'Branching out', caption: 'Follow both heads around the ridges. Clear both routes to let them go.', difficulty: 'Thoughtful', size: 5, count: 4, seed: 0, tutorial: 'branchRidges' },
  { title: 'Different proportions', caption: 'A long face, a short face. The same rules, a new perspective.', difficulty: 'New shape', size: { x: 6, y: 4, z: 3 }, count: 22, seed: 10243, maxLength: 4, twoHeads: true },
  { title: 'Through the middle', caption: 'A hole through the cube. An amber ridge leads into its inner wall.', difficulty: 'New shape', size: { x: 6, y: 6, z: 4, hole: { x: [2, 3], y: [2, 3] } }, count: 28, seed: 12007, maxLength: 5, twoHeads: true, bridges: [{ faces: ['front', 'right@-1'], color: '#d89b54' }] },
  { title: 'Hidden terraces', caption: 'One connected shape, with stepped sections tucked into it. Follow every riser.', difficulty: 'New shape', size: { x: 6, y: 6, z: 6, terrace: { x: [0, 2], z: [3, 5], heights: [2, 3, 4] } }, count: 32, seed: 14797, maxLength: 5, twoHeads: true, bridges: [{ faces: ['front', 'top@-1'], color: '#d89b54' }] },
  { title: 'Hold the door', caption: 'Park on the amber button. Keep the matching gate open until the winding arrow is through.', difficulty: 'New mechanic', family: 'Parking', size: 6, count: 2, tutorial: 'pressure' },
  { title: 'A turn of events', caption: 'The bent tile turns a passing head left. Clear the arrow beyond the bend first.', difficulty: 'New mechanic', family: 'Deflection', size: 6, count: 2, tutorial: 'fixed' },
  { title: 'One turn, then another', caption: 'A striped deflector switches between left and right after each passing head. Only arrows can change it.', difficulty: 'New mechanic', family: 'Deflection', size: 6, count: 3, tutorial: 'alternating' },
  { title: 'A moving crown', caption: 'Park on the blue spiral. The upper section turns, carrying its arrows and colored ridges with it.', difficulty: 'New mechanic', family: 'Rotation', size: 6, count: 3, tutorial: 'rotation' },
  { title: 'Working together', caption: 'An amber button holds the gate. A striped turn guides the winding arrow through it.', difficulty: 'Combined mechanics', family: 'Mixed', size: 6, count: 2, tutorial: 'mixed' },
];

export const ORIGINAL_OPENING_COUNT = 23;
export const NEW_OPENING_COUNT = LEVELS.length - ORIGINAL_OPENING_COUNT;
export const FAMILIES = ['Foundations', 'Connections', 'Parking', 'Branches', 'Tunnels', 'Terraces', 'Deflection', 'Rotation', 'Mixed'];
LEVELS.forEach((meta, index) => { meta.family ??= index === 21 ? 'Tunnels' : index === 22 ? 'Terraces' : index >= 18 && index <= 19 ? 'Branches' : index >= 16 && index <= 17 ? 'Parking' : index >= 12 && index <= 15 ? 'Connections' : 'Foundations'; });

export const isLevelIndex = index => Number.isSafeInteger(index) && index >= 0 && index < Number.MAX_SAFE_INTEGER;
const endlessCache = new Map();

function seedFor(index, attempt = 0) {
  let hash = 2166136261;
  for (const c of `endless-v1:${index - NEW_OPENING_COUNT}:${attempt}`) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function levelMeta(index) {
  if (!isLevelIndex(index)) throw new RangeError('Unknown level');
  if (index < LEVELS.length) return LEVELS[index];
  const ordinal = index - LEVELS.length, tier = 1 + Math.floor(ordinal / 8);
  const side = Math.min(10, 7 + Math.floor(ordinal / 24)), variation = ordinal % 8;
  let size = side, shape = 'Cube';
  if (variation === 2) { size = { x: Math.min(10, side + 1), y: side, z: side - 1 }; shape = 'Unequal faces'; }
  if (variation === 4) {
    const lo = Math.floor(side / 2) - 1;
    size = { x: side, y: side, z: side - 2, hole: { x: [lo, lo + 1], y: [lo, lo + 1] } }; shape = 'Tunnel';
  }
  if (variation === 6 || variation === 7) {
    const width = Math.floor(side / 2);
    size = { x: side, y: side, z: side, terrace: { x: [0, width - 1], z: [Math.floor(side / 2), side - 1], heights: Array.from({ length: width }, (_, i) => Math.min(side - 1, side - 4 + i)) } }; shape = 'Terraces';
  }
  const connections = [['front', 'right'], ['top', 'right'], ['front', 'left'], ['bottom', 'left']];
  if (size.hole && tier >= 3) connections[2] = ['front', `right@${size.hole.x[0] - side / 2}`];
  if (size.terrace && tier >= 3) connections[2] = ['front', `top@${size.terrace.heights[0] - side / 2}`];
  const bridges = connections.slice(0, Math.min(4, 1 + Math.floor(ordinal / 16))).map((faces, i) => ({ faces, color: ['#d89b54', '#b97e93', '#8aa99b', '#92a3ba'][i] }));
  const cells = surfaceLayout(size).cells.length;
  const mechanism = variation === 3 && tier >= 2 ? 'pressure' : variation === 5 && tier >= 3 ? 'fixed' : variation === 1 && tier >= 4 ? 'alternating' : variation === 0 && tier >= 5 ? 'rotation' : variation === 7 && tier >= 6 ? 'mixed' : null;
  const family = mechanism === 'pressure' ? 'Parking' : mechanism === 'rotation' ? 'Rotation' : mechanism === 'mixed' ? 'Mixed' : mechanism ? 'Deflection' : variation === 2 || variation === 3 ? 'Parking' : shape === 'Tunnel' ? 'Tunnels' : shape === 'Terraces' ? 'Terraces' : variation === 1 ? 'Branches' : 'Connections';
  return {
    title: `Beyond the corners ${ordinal + 1}`, caption: 'A new puzzle, a little deeper. There is always another perspective.',
    difficulty: `Tier ${tier} · ${family}`, family, mechanism, endless: true, ordinal, tier, shape, size,
    count: Math.floor(cells * Math.min(0.225, 0.18 + ordinal * 0.0007)),
    maxLength: Math.min(11, 5 + Math.floor(ordinal / 12)), seed: seedFor(index), bridges,
    twoHeads: 0.12, branches: Math.min(0.35, 0.08 + ordinal * 0.003),
    pressure: 0.9 * ordinal / (ordinal + 100),
    stopPockets: variation === 3 || variation === 7 ? side >= 8 && tier >= 4 ? 2 : 1 : 0,
    parkingChallenge: variation === 2 || variation === 3 || variation === 7,
  };
}

function circlePockets(meta) {
  const { width, height } = surfaceLayout(meta.size).frames.back;
  const arrows = [], circles = [];
  const rng = random(meta.seed ^ 0x51a7c3), turns = Math.floor(rng() * 4);
  const margin = meta.stopPockets === 1 ? width - 4 : Math.floor((width - 8) / 2);
  const offsetX = Math.floor(rng() * (margin + 1)), offsetY = Math.floor(rng() * (margin + 1));
  for (let i = 0; i < meta.stopPockets; i++) {
    const cell = ([x, y]) => {
      x += offsetX; y += offsetY;
      if (i) { x = width - 1 - x; y = height - 1 - y; }
      for (let turn = 0; turn < turns; turn++) [x, y] = [y, width - 1 - x];
      return { face: 'back', x, y };
    };
    const direction = d => {
      let [x, y] = d.map(v => i ? -v : v);
      for (let turn = 0; turn < turns; turn++) [x, y] = [y, -x];
      return [x, y];
    };
    arrows.push({ cells: [[0, 1], [1, 1]].map(cell), direction: direction([1, 0]) });
    arrows.push({ cells: [[3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2]].map(cell), direction: direction([0, -1]) });
    circles.push(cell([2, 1]));
  }
  const reserved = arrows.flatMap(a => [...a.cells, ...exitCells(a, meta.size, meta.bridges)]);
  return { arrows, circles, reserved };
}

export function difficultyStats(level) {
  const depths = new Map();
  for (const arrow of [...level.arrows].reverse()) {
    const blockers = blockerIds(arrow, level.arrows, new Set(), level.size, level.bridges, 0, level.circles);
    depths.set(arrow.id, 1 + Math.max(0, ...blockers.filter(id => id !== arrow.id).map(id => depths.get(id) ?? 0)));
  }
  return { depth: Math.max(0, ...depths.values()), choices: availableArrows(level).length, forks: level.arrows.filter(a => a.branch).length };
}

function generateEndless(index, generation = 3) {
  const meta = levelMeta(index), advanced = generation > 1 && meta.mechanism;
  const complexParking = generation >= 3 && !advanced && meta.parkingChallenge;
  const special = advanced ? mechanismPuzzle(meta.mechanism, typeof meta.size === 'number' ? meta.size : meta.size.x, 'back') : null;
  const pockets = advanced ? { ...special, reserved: [] } : complexParking ? parkingPocket(meta, surfaceLayout(meta.size)) : circlePockets(meta);
  if (advanced) {
    // Keep each stateful teaching pocket independent of the large filler board.
    // Reserve its face and every exit corridor; rotating crowns own the upper slab.
    const layout = surfaceLayout(meta.size);
    const controlled = new Set(special.arrows.flatMap(a => arrowCells(a).map(c => c.face)));
    pockets.reserved = layout.cells.filter(c => controlled.has(c.face) || (special.rotors?.length && (c.face === 'right' || special.rotors.some(r => inSection(c, meta.size, r)))));
  }
  const controlled = new Set(special?.arrows.flatMap(a => arrowCells(a).map(c => c.face)) ?? []);
  const generationMeta = { ...meta, bridges: advanced ? meta.bridges.filter(b => !b.faces.some(f => controlled.has(f))) : meta.bridges };
  let best = null, bestScore = -Infinity;
  // Select among deterministic candidates for fewer obvious opening moves and
  // deeper dependencies. Every candidate is solvable by reverse construction.
  for (let attempt = 0; attempt < 4; attempt++) {
    let level;
    try { level = generateLevel({ ...generationMeta, packed: true, count: meta.count - pockets.arrows.length, reserved: pockets.reserved, seed: seedFor(index, attempt) }); }
    catch { continue; }
    const stats = difficultyStats(level), score = stats.depth * 3 + stats.forks * 2 - stats.choices;
    if (score > bestScore) { best = level; bestScore = score; }
  }
  // A bounded fallback keeps unusual seeds playable instead of exposing a failed
  // generator. It keeps the same shape and mechanics, with shorter filler paths.
  for (let reduction = 0; !best && reduction < 8; reduction++) {
    try { best = generateLevel({ ...generationMeta, packed: true, maxLength: 3, branches: 0.08, count: Math.floor((meta.count - pockets.arrows.length) * 0.9 ** reduction), reserved: pockets.reserved, seed: seedFor(index, 10 + reduction) }); }
    catch { /* Try the next deterministic density. */ }
  }
  if (!best) throw new Error(`Unable to generate endless puzzle ${index + 1}`);
  const nextId = best.arrows.length;
  best.arrows.push(...pockets.arrows.map((a, i) => ({ ...a, id: nextId + i })));
  best.circles = pockets.circles; best.independentStops = true; best.endless = true;
  if (complexParking) {
    best.parkingGroups = [pockets.arrows.map((_, i) => nextId + i)];
    best.parkingPocketCount = pockets.arrows.length;
    best.parkingStats = pockets.stats;
    best.independentStops = false;
  }
  if (advanced) {
    for (const property of ['buttons', 'gates', 'deflectors', 'triggers', 'rotors']) best[property] = pockets[property];
    best.bridges = [...best.bridges, ...pockets.bridges];
    // Filler does not use any colored ridge belonging to a pocket face.
    const controlled = new Set(pockets.arrows.flatMap(a => arrowCells(a).map(c => c.face)));
    best.bridges = best.bridges.filter(b => b.section || !b.faces.some(f => controlled.has(f)));
    best.independentMechanisms = true; best.independentStops = false;
    best.mechanismPocketCount = pockets.arrows.length;
  }
  best.difficultyStats = difficultyStats(best);
  return best;
}

export function createLevel(index, generation = 3) {
  // Preserve the older boolean API as well as existing saved generations.
  if (typeof generation === 'boolean') generation = generation ? 1 : 2;
  if (!isLevelIndex(index)) throw new RangeError('Unknown level');
  if (index >= LEVELS.length) {
    const cacheId = `${index}:${generation}`;
    if (!endlessCache.has(cacheId)) {
      if (endlessCache.size >= 8) endlessCache.delete(endlessCache.keys().next().value);
      endlessCache.set(cacheId, generateEndless(index, generation));
    }
    return structuredClone(endlessCache.get(cacheId));
  }
  const meta = LEVELS[index];
  if (['pressure', 'fixed', 'alternating', 'rotation', 'mixed'].includes(meta.tutorial)) return mechanismPuzzle(meta.tutorial);
  if (meta.tutorial === 'branches' || meta.tutorial === 'branchRidges') return branchPuzzle(meta.tutorial === 'branchRidges');
  if (meta.tutorial === 'circles' || meta.tutorial === 'combined') return circlePuzzle(meta.tutorial === 'combined');
  if (meta.tutorial) {
    const level = firstLight(); level.bridges = meta.bridges ?? [];
    if (meta.twoHeads) level.arrows.forEach(a => { a.twoHeads = a.id % 3 === 0; });
    return level;
  }
  return index === 0 ? firstLight() : generateLevel(LEVELS[index]);
}

export class PuzzleGame {
  constructor(index = 0, savedRemoved = [], savedMoves = [], generation = 3) { this.load(index, savedRemoved, savedMoves, generation); }
  load(index, savedRemoved = [], savedMoves = [], generation = 3) {
    this.index = index; this.generation = generation; this.level = createLevel(index, generation);
    this.removed = new Set(savedMoves.length ? [] : savedRemoved.filter(id => this.level.arrows.some(a => a.id === id)));
    this.history = [...this.removed].map(id => ({ id, end: 0, removed: true }));
    this.mistakes = 0;
    for (const move of savedMoves) {
      const result = this.tryRemove(move.id, move.end);
      if (result.status === 'blocked' || result.status === 'ignored') break;
    }
  }
  tryRemove(id, end) {
    const arrow = this.level.arrows.find(a => a.id === id);
    if (!arrow || this.removed.has(id)) return { status: 'ignored' };
    end ??= availableMoves(this.level, this.removed).find(m => m.id === id)?.end ?? 0;
    if (end !== 0 && (end !== 1 || headCount(arrow) < 2)) return { status: 'ignored' };
    if (arrow.branch) end = arrow.exited ? 1 : 0;
    if (hasMechanisms(this.level)) {
      const result = analyzeMechanismMove(this.level, this.removed, arrow, end);
      if (result.status === 'blocked') { this.mistakes++; return result; }
      this.history.push({ id, end, beforeLevel: this.level, beforeRemoved: this.removed });
      this.level = result.next; this.removed = result.nextRemoved; return result;
    }
    const routes = movementRoutes(arrow, this.level, end), route = routes.find(Boolean);
    const blockers = blockerIds(arrow, this.level.arrows, this.removed, this.level.size, this.level.bridges, end, this.level.circles);
    const loop = routes.some(r => r?.loop), stopped = routes.some(r => r?.stopped), solid = routes.some(r => r?.solid);
    if (blockers.length || loop || solid) { this.mistakes++; return { status: 'blocked', arrow, blockers, loop, solid }; }
    this.history.push({ id, end, before: arrow, removed: !stopped });
    if (stopped) {
      const updatedArrow = advanceArrow(arrow, routes, end, this.level.size);
      this.level.arrows = this.level.arrows.map(a => a.id === id ? updatedArrow : a);
      return { status: 'moved', arrow, updatedArrow, route, routes, end };
    }
    this.removed.add(id);
    return { status: this.remaining === 0 ? 'complete' : 'removed', arrow, route, routes, end };
  }
  undo() {
    const move = this.history.pop();
    if (!move) return null;
    if (move.beforeLevel) { this.level = move.beforeLevel; this.removed = move.beforeRemoved; return move.id; }
    if (move.before) this.level.arrows = this.level.arrows.map(a => a.id === move.id ? move.before : a);
    this.removed.delete(move.id); return move.id;
  }
  get saveMoves() { return this.history.map(({ id, end }) => ({ id, end })); }
  get remaining() { return this.level.arrows.length - this.removed.size; }
}
