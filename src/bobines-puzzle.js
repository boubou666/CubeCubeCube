import { checkIndex, clone, random, shuffle } from './pocket-core.js';

const TITLES = ['Un fil à la fois', 'Les rubans', 'Le petit métier', 'Les couleurs du matin', 'Les entrelacs', 'La nappe du jardin', 'Les doux détours', 'Les écheveaux', 'Le tissage', 'La grande bobine', 'Les fils croisés', 'La dernière maille'];
export function createBobinesLevel(index) {
  checkIndex(index); const rng = random(91873 + index * 6701), tier = Math.floor(index / 12);
  const colors = shuffle([0, 1, 2, 3, 4, 5], rng).slice(0, 3 + tier);
  const width = 3 + tier, depth = 4 + tier * 2 + index % 3;
  const lines = Array.from({ length: width }, () => Array.from({ length: depth }, () => colors[Math.floor(rng() * colors.length)]));
  const cursors = lines.map(() => 0), batches = [];
  while (cursors.some((n, i) => n < lines[i].length)) {
    const available = [...new Set(lines.map((line, i) => line[cursors[i]]).filter(c => c !== undefined))];
    const color = available[Math.floor(rng() * available.length)]; let count = 0;
    for (let i = 0; i < width; i++) while (lines[i][cursors[i]] === color) { count++; cursors[i]++; }
    batches.push({ color, count });
  }
  const queues = Array.from({ length: 4 }, () => []), solution = [];
  // Every reserve has a route proved by the actual peeling order above.
  for (const batch of batches) { const q = Math.floor(rng() * 4); queues[q].push(batch); solution.push(q); }
  return { index, title: TITLES[index % 12], tier, lines, queues, solution, slotCount: 3 };
}
function wind(level, state) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let slot = 0; slot < state.slots.length; slot++) {
      const bobbin = state.slots[slot]; if (!bobbin) continue;
      for (let i = 0; i < level.lines.length && bobbin.remaining; i++) {
        while (bobbin.remaining && level.lines[i][state.cursors[i]] === bobbin.color) {
          state.cursors[i]++; bobbin.remaining--; changed = true;
        }
      }
      if (!bobbin.remaining) { state.slots[slot] = null; changed = true; }
    }
  }
}
export const bobinesRules = {
  create: createBobinesLevel,
  initial: level => ({ cursors: level.lines.map(() => 0), queues: level.queues.map(() => 0), slots: Array(level.slotCount).fill(null) }),
  won: (level, state) => state.cursors.every((n, i) => n === level.lines[i].length) && state.slots.every(s => !s),
  actions: (level, state) => state.slots.includes(null) ? level.queues.map((queue, q) => queue[state.queues[q]] ? q : null).filter(q => q !== null).sort((a, b) => {
    const visible = level.lines.map((line, i) => line[state.cursors[i]]);
    return Number(visible.includes(level.queues[b][state.queues[b]].color)) - Number(visible.includes(level.queues[a][state.queues[a]].color));
  }) : [],
  move(level, state, q) {
    if (!Number.isInteger(q) || q < 0 || q >= level.queues.length) return null;
    const batch = level.queues[q][state.queues[q]], slot = state.slots.indexOf(null); if (!batch || slot === -1) return null;
    const next = clone(state); next.queues[q]++; next.slots[slot] = { ...batch, remaining: batch.count }; wind(level, next); return next;
  },
};
