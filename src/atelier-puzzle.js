import { checkIndex, clone, random, shuffle } from './pocket-core.js';

const TITLES = ['Les petites planches', 'Le moulin', 'Le pont', 'Les ailes', 'La maisonnette', 'Le carrousel', 'Le jardin suspendu', 'Les terrasses', 'La cabane', 'Le belvédère', 'Les trois ateliers', 'Le grand assemblage'];
export function createAtelierLevel(index) {
  checkIndex(index); const rng = random(18741 + index * 7919), tier = Math.floor(index / 12);
  const stacks = tier < 2 ? 2 : 3, count = 4 + tier * 2 + (index % 3 === 2 ? 2 : 0);
  const colors = shuffle([0, 1, 2, 3, 4, 5], rng).slice(0, Math.min(3 + tier, 6));
  const plates = [], screws = [], solution = [], boxes = [], heights = Array(stacks).fill(0);
  // First construct a legal dismantling order, then stack it in reverse.
  const order = Array.from({ length: count }, (_, i) => ({ stack: (i + Math.floor(index / 3)) % stacks, pair: Math.floor(i / 2), half: i % 2 }));
  const pairColors = Array.from({ length: count / 2 }, (_, i) => {
    const a = colors[(i * 2) % colors.length], b = colors[(i * 2 + 1) % colors.length]; boxes.push(a, b); return [a, b];
  });
  for (let i = count - 1; i >= 0; i--) {
    const item = order[i], [a, b] = pairColors[item.pair], plate = { id: i, stack: item.stack, layer: heights[item.stack]++, screws: [], style: (index + i) % 4 };
    const cs = shuffle(item.half ? [b, a, b] : [a, b, a], rng);
    for (let j = 0; j < 3; j++) { const id = screws.length; screws.push({ id, plate: i, color: cs[j], position: j }); plate.screws.push(id); }
    plates.push(plate);
  }
  for (let i = 0; i < count; i++) solution.push(...plates.find(p => p.id === i).screws);
  return { index, title: TITLES[index % 12], tier, stacks, plates, screws, boxes, solution, bufferSize: tier < 2 ? 5 : 4 };
}
function settle(level, state) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const box of state.trays) {
      if (!box) continue;
      for (let i = state.buffer.length - 1; i >= 0 && box.count < 3; i--) if (state.buffer[i] === box.color) { state.buffer.splice(i, 1); box.count++; changed = true; }
    }
    for (let i = 0; i < state.trays.length; i++) if (state.trays[i]?.count === 3) {
      state.trays[i] = state.nextBox < level.boxes.length ? { color: level.boxes[state.nextBox++], count: 0 } : null; changed = true;
    }
  }
}
export function exposedPlate(level, state, plate) {
  return !level.plates.some(p => p.stack === plate.stack && p.layer > plate.layer && p.screws.some(id => !state.removed.includes(id)));
}
export const atelierRules = {
  create: createAtelierLevel,
  initial: level => ({ removed: [], buffer: [], nextBox: 2, trays: level.boxes.slice(0, 2).map(color => ({ color, count: 0 })) }),
  won: (level, state) => state.removed.length === level.screws.length && state.buffer.length === 0,
  actions(level, state) {
    const seen = new Set();
    return level.screws.filter(s => {
      const key = `${s.plate}:${s.color}`;
      if (state.removed.includes(s.id) || !exposedPlate(level, state, level.plates.find(p => p.id === s.plate)) || seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a, b) => Number(state.trays.some(t => t?.color === b.color)) - Number(state.trays.some(t => t?.color === a.color))).map(s => s.id);
  },
  move(level, state, id) {
    const screw = level.screws[id]; if (!Number.isInteger(id) || !screw || state.removed.includes(id)) return null;
    if (!exposedPlate(level, state, level.plates.find(p => p.id === screw.plate))) return null;
    const next = clone(state); next.removed.push(id); next.buffer.push(screw.color); settle(level, next);
    if (next.buffer.length > level.bufferSize) return null;
    return next;
  },
};
