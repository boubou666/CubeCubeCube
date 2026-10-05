// Shared deterministic utilities. Every game keeps independent rules and saves.
export const COLORS = [
  { name: 'Sauge', hex: '#88ad91', mark: '●' }, { name: 'Corail', hex: '#df8c77', mark: '◆' },
  { name: 'Azur', hex: '#80afc5', mark: '▲' }, { name: 'Miel', hex: '#dfba65', mark: '★' },
  { name: 'Prune', hex: '#aa8bb6', mark: '✚' }, { name: 'Pétale', hex: '#d8a5bd', mark: '♥' },
  { name: 'Crème', hex: '#efddb2', mark: '◇' }, { name: 'Encre', hex: '#456052', mark: '■' },
];
export const CHAPTERS = ['Les premiers pas', 'Un peu de malice', 'Tout se croise', 'Les grands détours'];
export const LEVEL_COUNT = 48;
export const clone = v => JSON.parse(JSON.stringify(v));
export function random(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function checkIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVEL_COUNT) throw new Error('Invalid puzzle number');
}
export function searchPlan(rules, level, start, limit = 12000) {
  const startKey = JSON.stringify(start); let canonical = rules.initial(level);
  for (let i = 0; i <= level.solution.length; i++) {
    if (JSON.stringify(canonical) === startKey) return level.solution.slice(i);
    if (i < level.solution.length) canonical = rules.move(level, canonical, level.solution[i]);
    if (!canonical) break;
  }
  const visited = new Set(), deadline = Date.now() + 150; let nodes = 0;
  const visit = state => {
    if (rules.won(level, state)) return [];
    if (++nodes > limit || Date.now() > deadline) return null;
    const key = JSON.stringify(state); if (visited.has(key)) return null; visited.add(key);
    for (const action of rules.actions(level, state)) {
      const next = rules.move(level, state, action); if (!next) continue;
      const tail = visit(next); if (tail) return [action, ...tail];
    }
    return null;
  };
  return visit(start);
}
export class PocketGame {
  constructor(rules, index = 0) { this.rules = rules; this.level = rules.create(index); this.state = rules.initial(this.level); this.history = []; this.moves = []; }
  get won() { return this.rules.won(this.level, this.state); }
  play(action) {
    if (this.won) return false;
    const next = this.rules.move(this.level, this.state, action); if (!next) return false;
    this.history.push(clone(this.state)); this.moves.push(clone(action)); this.state = next; return true;
  }
  undo() { if (!this.history.length) return false; this.state = this.history.pop(); this.moves.pop(); return true; }
  restart() { this.state = this.rules.initial(this.level); this.history = []; this.moves = []; }
  hint() {
    const plan = this.rules.plan ? this.rules.plan(this.level, this.state) : searchPlan(this.rules, this.level, this.state);
    return plan?.length ? { action: plan[0] } : this.history.length ? { undo: true } : null;
  }
}
export function encodePocket(game, completed, sound = false) {
  return { version: 1, generation: 1, index: game.level.index, moves: game.moves, completed: [...completed], sound };
}
export function decodePocket(rules, value) {
  try {
    if (!value || value.version !== 1 || value.generation !== 1 || !Array.isArray(value.moves) || value.moves.length > 5000 || !Array.isArray(value.completed)) return null;
    checkIndex(value.index); const game = new PocketGame(rules, value.index);
    for (const action of value.moves) if (!game.play(action)) return null;
    return { game, completed: new Set(value.completed.filter(n => Number.isInteger(n) && n >= 0 && n < LEVEL_COUNT)), sound: value.sound === true };
  } catch { return null; }
}
