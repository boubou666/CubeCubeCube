export const SAVE_KEY = 'cubecubecube.save.v1';
import { LEVELS, isLevelIndex, ORIGINAL_OPENING_COUNT, NEW_OPENING_COUNT } from './puzzle.js';
const EMPTY = { version: 4, generation: 2, index: 0, removed: [], moves: [], completed: [], endlessCompleted: [], frontier: LEVELS.length, sound: false, theme: 'ivory' };
const emptySave = () => ({ ...EMPTY, removed: [], moves: [], completed: [], endlessCompleted: [] });

export function hasCompleted(save, index) {
  return index < LEVELS.length ? save.completed.includes(index) : save.endlessCompleted.some(([start, end]) => index >= start && index <= end);
}
export function completedCount(save) {
  return save.completed.length + save.endlessCompleted.reduce((sum, [start, end]) => sum + (end - start + 1), 0);
}
export function markCompleted(save, index) {
  if (index < LEVELS.length) { if (!save.completed.includes(index)) save.completed.push(index); return; }
  const ranges = [...save.endlessCompleted, [index, index]].sort((a, b) => a[0] - b[0]);
  save.endlessCompleted = [];
  for (const range of ranges) {
    const previous = save.endlessCompleted.at(-1);
    if (previous && range[0] <= previous[1] + 1) previous[1] = Math.max(previous[1], range[1]);
    else save.endlessCompleted.push([...range]);
  }
  save.frontier = Math.max(save.frontier, Math.min(Number.MAX_SAFE_INTEGER - 1, index + 1));
}
export function readSave(storage = globalThis.localStorage) {
  try {
    let s = JSON.parse(storage.getItem(SAVE_KEY));
    if (![1, 2, 3, 4].includes(s?.version)) return emptySave();
    if (s.version < 4) {
      const migrateIndex = i => isLevelIndex(i) && i >= ORIGINAL_OPENING_COUNT ? Math.min(Number.MAX_SAFE_INTEGER - 1, i + NEW_OPENING_COUNT) : i;
      s = { ...s, generation: s.index >= ORIGINAL_OPENING_COUNT ? 1 : 2, index: migrateIndex(s.index), frontier: migrateIndex(s.frontier),
        completed: Array.isArray(s.completed) ? s.completed.map(migrateIndex) : [],
        endlessCompleted: Array.isArray(s.endlessCompleted) ? s.endlessCompleted.map(r => Array.isArray(r) && r.length === 2 ? r.map(migrateIndex) : r) : [] };
    }
    const result = {
      version: 4,
      generation: s.generation === 1 ? 1 : 2,
      index: isLevelIndex(s.index) ? s.index : 0,
      removed: Array.isArray(s.removed) ? [...new Set(s.removed.filter(v => Number.isInteger(v) && v >= 0))] : [],
      moves: Array.isArray(s.moves) ? s.moves.slice(0, 1000).filter(m => Number.isInteger(m?.id) && m.id >= 0 && (m.end === 0 || m.end === 1)).map(({ id, end }) => ({ id, end })) : [],
      completed: Array.isArray(s.completed) ? [...new Set(s.completed.filter(v => isLevelIndex(v) && v < LEVELS.length))] : [],
      endlessCompleted: [],
      frontier: isLevelIndex(s.frontier) ? Math.max(LEVELS.length, s.frontier) : LEVELS.length,
      sound: s.sound === true,
      theme: ['ivory', 'mint', 'dusk'].includes(s.theme) ? s.theme : 'ivory',
    };
    if (Array.isArray(s.endlessCompleted)) {
      const ranges = s.endlessCompleted.filter(r => Array.isArray(r) && r.length === 2 && r.every(isLevelIndex) && r[0] >= LEVELS.length && r[0] <= r[1]).sort((a, b) => a[0] - b[0]);
      for (const [start, end] of ranges) {
        const previous = result.endlessCompleted.at(-1);
        if (previous && start <= previous[1] + 1) previous[1] = Math.max(previous[1], end);
        else result.endlessCompleted.push([start, end]);
      }
    }
    for (const index of Array.isArray(s.completed) ? s.completed.filter(v => isLevelIndex(v) && v >= LEVELS.length) : []) markCompleted(result, index);
    result.frontier = Math.max(result.frontier, result.index, Math.min(Number.MAX_SAFE_INTEGER - 1, (result.endlessCompleted.at(-1)?.[1] ?? LEVELS.length - 1) + 1));
    return result;
  } catch { return emptySave(); }
}
export function writeSave(save, storage = globalThis.localStorage) {
  try { storage.setItem(SAVE_KEY, JSON.stringify({ ...save, version: 4 })); return true; }
  catch { return false; }
}
