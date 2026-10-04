import { FACES, DIRECTIONS, key, arrowCells, arrowEnd, headCount, step, worldPoint, worldDirection, surfaceLayout, edgeKey, exitHitsSolid, flightBlockerIds } from './puzzle.js';

export const hasMechanisms = level => Boolean(level.buttons?.length || level.gates?.length || level.deflectors?.length || level.rotors?.length || level.triggers?.length);
export const turnDirection = ([x, y], turn) => (turn === 1 ? [-y, x] : [y, -x]).map(n => n || 0);
export const inSection = (cell, size, section) => worldPoint(cell, size)[1] >= (section.start - surfaceLayout(size).dimensions[1] / 2) * surfaceLayout(size).pitch - 1e-8;

export function pressedButtons(level, removed = new Set(), departingId = null) {
  const heads = new Set(level.arrows.filter(a => a.id !== departingId && !removed.has(a.id)).flatMap(a =>
    Array.from({ length: headCount(a) }, (_, end) => (end === 1 && a.branch ? a.branch : a).exited ? [] : [key(arrowEnd(a, level.size, end).cell)]).flat()
  ));
  return new Set((level.buttons ?? []).filter(b => heads.has(key(b))).map(b => b.id));
}

export function bridgeConnects(bridge, from, to, level) {
  if (edgeKey(...bridge.faces) !== edgeKey(from.face, to.face)) return false;
  if (!bridge.section) return true;
  const section = level.rotors?.find(s => s.id === bridge.section);
  return section && inSection(from, level.size, section) && inSection(to, level.size, section);
}

// Trace both fork heads in lockstep. Alternating tiles share one transactional
// state, so an earlier head can change the turn encountered by the other head.
export function mechanismRoutes(arrow, level, removed, end) {
  const ends = arrow.branch ? [0, 1] : [end];
  const routes = ends.map(i => (i === 1 && arrow.branch ? arrow.branch : arrow).exited ? null : {
    states: [arrowEnd(arrow, level.size, i)], crossings: [], end: i, stopped: false, loop: false,
  });
  const flips = new Map((level.deflectors ?? []).map(d => [d.id, d.turn]));
  const pressed = pressedButtons(level, removed, arrow.id), seen = new Set();
  const stoppedAt = [...(level.circles ?? []), ...(level.buttons ?? []), ...(level.triggers ?? [])];
  for (let tick = 0; tick < 10000; tick++) {
    if (routes.every(r => !r || r.done)) return { routes, flips };
    const signature = JSON.stringify([routes.map(r => !r || r.done ? null : r.states.at(-1)), [...flips]]);
    if (seen.has(signature)) { routes.filter(r => r && !r.done).forEach(r => { r.loop = true; r.done = true; }); return { routes, flips }; }
    seen.add(signature);
    const changed = [];
    for (const route of routes) {
      if (!route || route.done) continue;
      const state = route.states.at(-1), stepped = step(state.cell, state.direction, level.size);
      const next = { cell: stepped.cell, direction: [...stepped.direction] };
      if (next.cell.face !== state.cell.face) {
        const bridge = (level.bridges ?? []).find(b => bridgeConnects(b, state.cell, next.cell, level));
        if (!bridge) { route.solid = exitHitsSolid(state.cell, state.direction, level.size); route.done = true; continue; }
        route.crossings.push({ from: state.cell.face, to: next.cell.face, color: bridge.color });
      }
      const gate = (level.gates ?? []).find(g => key(g) === key(next.cell) && !pressed.has(g.button));
      if (gate) { route.gate = gate.id; route.done = true; continue; }
      const tile = (level.deflectors ?? []).find(d => key(d) === key(next.cell));
      if (tile) {
        next.direction = turnDirection(next.direction, flips.get(tile.id));
        if (tile.alternating) changed.push(tile.id);
      }
      route.states.push(next);
      if (stoppedAt.some(c => key(c) === key(next.cell))) {
        route.stopped = true; route.done = true;
        route.trigger = (level.triggers ?? []).find(c => key(c) === key(next.cell))?.rotor;
      }
    }
    if (routes[0] && routes[1] && !routes[0].done && !routes[1].done && key(routes[0].states.at(-1).cell) === key(routes[1].states.at(-1).cell)) {
      routes.forEach(r => { r.conflict = true; r.done = true; });
    }
    for (const id of changed) flips.set(id, -flips.get(id));
  }
  routes.filter(Boolean).forEach(r => { r.loop = true; }); return { routes, flips };
}

function slidePart(part, route, reverse = false) {
  if (!route) return part;
  if (!route.stopped) return { ...part, exited: true };
  const cells = [...(reverse ? [...part.cells].reverse() : part.cells), ...route.states.slice(1).map(s => s.cell)].slice(-part.cells.length);
  return { ...part, cells, direction: route.states.at(-1).direction };
}

export function rotateCell(cell, size, quarter = 1) {
  const layout = surfaceLayout(size), pitch = layout.pitch;
  let p = worldPoint(cell, size).map(n => n / pitch), n = [...FACES[cell.face].normal];
  for (let i = 0; i < (quarter % 4 + 4) % 4; i++) { p = [p[2], p[1], -p[0]]; n = [n[2], n[1], -n[0]]; }
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const face = Object.keys(layout.frames).find(f => dot(layout.frames[f].normal, n) === 1 && Math.abs(layout.frames[f].plane - dot(p, n)) < 1e-8);
  if (!face) throw new Error('Rotating section must preserve the exposed solid');
  const f = layout.frames[face];
  return { face, x: Math.round(dot(p, f.u) + (f.width - 1) / 2), y: Math.round(dot(p, f.v) + (f.height - 1) / 2) };
}

function rotatePart(part, size, section) {
  if (part.exited || !part.cells.every(c => inSection(c, size, section))) return part;
  const cell = rotateCell(part.cells.at(-1), size);
  const [x, y, z] = worldDirection(part.cells.at(-1).face, part.direction), rotated = [z, y, -x], frame = FACES[cell.face];
  const dot = a => a.reduce((sum, v, i) => sum + v * rotated[i], 0);
  return { ...part, cells: part.cells.map(c => rotateCell(c, size)), direction: [dot(frame.u), dot(frame.v)] };
}

function rotateSection(level, removed, id) {
  const section = level.rotors.find(r => r.id === id);
  if (!section) return false;
  // A ribbon across the seam cannot be cut in half by a rotation.
  if (level.arrows.some(a => !removed.has(a.id) && arrowCells(a).some(c => inSection(c, level.size, section)) && !arrowCells(a).every(c => inSection(c, level.size, section)))) return false;
  level.arrows = level.arrows.map(a => removed.has(a.id) ? a : { ...rotatePart(a, level.size, section), ...(a.branch ? { branch: rotatePart(a.branch, level.size, section) } : {}) });
  for (const property of ['circles', 'buttons', 'gates', 'deflectors', 'triggers']) level[property] = (level[property] ?? []).map(c => inSection(c, level.size, section) ? { ...c, ...rotateCell(c, level.size) } : c);
  level.bridges = (level.bridges ?? []).map(b => b.section === id ? { ...b, faces: b.faces.map(face => rotateCell(surfaceLayout(level.size).cells.find(c => c.face === face && inSection(c, level.size, section)), level.size).face) } : b);
  section.turns = ((section.turns ?? 0) + 1) % 4;
  const occupied = new Set();
  for (const a of level.arrows.filter(a => !removed.has(a.id))) for (const c of arrowCells(a)) {
    if (occupied.has(key(c))) return false; occupied.add(key(c));
  }
  return true;
}

export function analyzeMechanismMove(level, removed, arrow, end = 0, preview = false) {
  const { routes, flips } = mechanismRoutes(arrow, level, removed, end);
  const ahead = new Set(routes.filter(Boolean).flatMap(r => r.states.slice(1).map(s => key(s.cell))));
  const blockers = [...new Set([
    ...level.arrows.filter(a => !removed.has(a.id) && arrowCells(a).some(c => ahead.has(key(c)))).map(a => a.id),
    ...routes.filter(Boolean).flatMap(r => flightBlockerIds(r, level.arrows, removed, level.size)),
  ])];
  const flags = Object.fromEntries(['loop', 'solid', 'gate', 'conflict'].map(k => [k, routes.some(r => r?.[k] !== undefined && r[k] !== false)]));
  if (blockers.length || Object.values(flags).some(Boolean)) return { status: 'blocked', arrow, blockers, ...flags };
  const rotations = routes.filter(r => r?.trigger).map(r => r.trigger);
  if (preview && !rotations.length) return { status: routes.some(r => r?.stopped) ? 'moved' : 'removed' };
  const next = structuredClone(level), nextRemoved = new Set(removed), stopped = routes.some(r => r?.stopped);
  let updatedArrow = arrow.branch ? { ...slidePart(arrow, routes[0]), branch: slidePart(arrow.branch, routes[1]) } : slidePart(arrow, routes[0], end === 1);
  if (stopped) next.arrows = next.arrows.map(a => a.id === arrow.id ? updatedArrow : a);
  else nextRemoved.add(arrow.id);
  const parkedArrow = stopped ? updatedArrow : null;
  next.deflectors = (next.deflectors ?? []).map(d => ({ ...d, turn: flips.get(d.id) }));
  for (const id of rotations) if (!rotateSection(next, nextRemoved, id)) return { status: 'blocked', arrow, blockers: [], rotationBlocked: true };
  if (stopped) updatedArrow = next.arrows.find(a => a.id === arrow.id);
  return { status: stopped ? 'moved' : nextRemoved.size === next.arrows.length ? 'complete' : 'removed', arrow, updatedArrow: stopped ? updatedArrow : null,
    routes, route: routes.find(Boolean), end, next, nextRemoved, rotations, parkedArrow, mechanisms: true };
}

export function solveMechanisms(level, initial = new Set(), maxStates = 20000) {
  const queue = [{ level: structuredClone(level), removed: new Set(initial), moves: [] }], seen = new Set();
  for (let cursor = 0; cursor < queue.length && cursor < maxStates; cursor++) {
    const current = queue[cursor];
    if (current.removed.size === level.arrows.length) return current.moves;
    const signature = JSON.stringify([current.level.arrows.filter(a => !current.removed.has(a.id)), current.level.deflectors, current.level.rotors, current.level.bridges, current.level.buttons, current.level.gates, current.level.triggers]);
    if (seen.has(signature)) continue; seen.add(signature);
    let advanced = false;
    for (const arrow of current.level.arrows.filter(a => !current.removed.has(a.id))) {
      for (const end of arrow.branch ? [arrow.exited ? 1 : 0] : headCount(arrow) === 2 ? [0, 1] : [0]) {
        const result = analyzeMechanismMove(current.level, current.removed, arrow, end);
        if (result.status === 'blocked') continue;
        queue.push({ level: result.next, removed: result.nextRemoved, moves: [...current.moves, { id: arrow.id, end }] });
        advanced = true;
        if (level.independentMechanisms) break;
      }
      if (advanced && level.independentMechanisms) break;
    }
  }
  return null;
}

const cells = (face, points) => points.map(([x, y]) => ({ face, x, y }));
export function mechanismPuzzle(kind, size = 6, face = 'front') {
  const arrows = [], buttons = [], gates = [], deflectors = [], circles = [], triggers = [], rotors = [], bridges = [];
  if (kind === 'pressure' || kind === 'mixed') {
    arrows.push({ id: 0, cells: cells(face, [[0, 1], [1, 1]]), direction: [1, 0] },
      { id: 1, cells: cells(face, [[3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2]]), direction: [0, -1] });
    buttons.push({ id: 'amber', ...cells(face, [[2, 1]])[0], color: '#d89b54' });
    gates.push({ id: 'amber-gate', ...cells(face, [[kind === 'mixed' ? 1 : 0, 0]])[0], button: 'amber', color: '#d89b54' });
    if (kind === 'mixed') deflectors.push({ id: 'turn', ...cells(face, [[0, 0]])[0], turn: 1, alternating: true });
  } else if (kind === 'fixed' || kind === 'alternating') {
    if (kind === 'fixed') {
      arrows.push({ id: 0, cells: cells(face, [[0, 1], [1, 1]]), direction: [1, 0] }, { id: 1, cells: cells(face, [[2, 3], [2, 4]]), direction: [0, 1] });
      deflectors.push({ id: 'turn', ...cells(face, [[2, 1]])[0], turn: 1, alternating: false });
    } else {
      arrows.push({ id: 0, cells: cells(face, [[0, 2], [1, 2]]), direction: [1, 0] },
        { id: 1, cells: cells(face, [[2, 0], [2, 1]]), direction: [0, 1] }, { id: 2, cells: cells(face, [[4, 1], [4, 2]]), direction: [0, 1] });
      deflectors.push({ id: 'turn', ...cells(face, [[2, 2]])[0], turn: 1, alternating: true });
      circles.push(...cells(face, [[2, 3]]));
    }
  } else if (kind === 'rotation') {
    arrows.push({ id: 0, cells: cells('front', [[2, 1], [3, 1]]), direction: [1, 0] },
      { id: 1, cells: cells('front', [[1, size - 1], [1, size - 2]]), direction: [0, -1] },
      { id: 2, cells: cells('front', [[1, 2], [1, 3]]), direction: [0, 1] });
    rotors.push({ id: 'crown', start: size - 2, turns: 0 });
    triggers.push({ ...cells('front', [[4, 1]])[0], rotor: 'crown', color: '#92a3ba' });
    bridges.push({ faces: ['top', 'front'], section: 'crown', color: '#92a3ba' });
  }
  return { size, arrows, buttons, gates, deflectors, circles, triggers, rotors, bridges, seed: 0 };
}
