import { checkIndex, clone, random, shuffle, searchPlan } from './pocket-core.js';

export const POTION_CAPACITY = 4;
const TITLES = ['La première infusion','Un parfum de sauge','Les fioles du matin','La bonne dose','Un mélange délicat','La réserve du jardin','Deux petites gouttes','Le fond du flacon','La recette oubliée','Les couleurs du soir','Une place précieuse','La dernière potion'];
export function pourAmount(state, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || !state.bottles[from]?.length || !state.bottles[to] || state.bottles[to].length >= POTION_CAPACITY) return 0;
  const source = state.bottles[from], target = state.bottles[to], color = source.at(-1);
  if (target.length && target.at(-1) !== color) return 0;
  let run = 0; for (let i = source.length - 1; i >= 0 && source[i] === color; i--) run++;
  return Math.min(run, POTION_CAPACITY - target.length);
}
function move(_, state, action) {
  if (!action) return null;
  const amount = pourAmount(state, action.from, action.to); if (!amount) return null;
  const next = clone(state); next.bottles[action.to].push(...next.bottles[action.from].splice(-amount)); return next;
}
export const settledBottle = bottle => bottle.length === POTION_CAPACITY && bottle.every(c => c === bottle[0]);
const won = (_, state) => state.bottles.every(b => !b.length || settledBottle(b));
const disorder = bottles => bottles.reduce((sum, b) => sum + b.slice(1).filter((c, i) => c !== b[i]).length, 0);
export function createPotionsLevel(index) {
  checkIndex(index); const tier = Math.floor(index / 12), rng = random(84071 + index * 7529), count = 3 + tier;
  const colors = shuffle([0,1,2,3,4,5,6,7], rng).slice(0, count);
  let best;
  // Reverse only pours whose exact inverse is a legal maximal forward pour.
  // The recorded route therefore conserves every drop and always solves the board.
  for (let attempt = 0; attempt < 5; attempt++) {
    let state = { bottles: [...colors.map(c => Array(4).fill(c)), [], []] }, route = [];
    const seen = new Set([JSON.stringify(state)]);
    for (let step = 0; step < 16 + tier * 14; step++) {
      const choices = [];
      for (let from = 0; from < state.bottles.length; from++) for (let to = 0; to < state.bottles.length; to++) {
        if (from === to) continue; const source = state.bottles[from], target = state.bottles[to];
        let run = 0; for (let n = source.length - 1; n >= 0 && source[n] === source.at(-1); n--) run++;
        for (let amount = 1; amount <= Math.min(run, 4 - target.length); amount++) {
          const next = clone(state); next.bottles[to].push(...next.bottles[from].splice(-amount));
          const action = { from: to, to: from }, restored = move(null, next, action), key = JSON.stringify(next);
          if (!restored || JSON.stringify(restored) !== JSON.stringify(state) || seen.has(key)) continue;
          choices.push({ next, action, key, score: disorder(next.bottles) + rng() * 2 });
        }
      }
      if (!choices.length) break;
      choices.sort((a,b) => b.score - a.score); const choice = choices[Math.floor(rng() * Math.min(5, choices.length))];
      state = choice.next; seen.add(choice.key); route.unshift(choice.action);
      if (state.bottles.some(b => !b.length) && disorder(state.bottles) >= 3 + tier && (!best || disorder(state.bottles) > best.score)) best = { bottles:clone(state.bottles), solution:clone(route), score:disorder(state.bottles) };
    }
  }
  if (!best) throw new Error('Could not build a mixed potion puzzle');
  const level = { index, tier, title:TITLES[index % 12], colors, ...best };
  let audit = {bottles:clone(level.bottles)};
  for(let n=0;n<level.solution.length;n++){audit=move(level,audit,level.solution[n]);if(won(level,audit)){level.solution=level.solution.slice(0,n+1);break;}}
  return level;
}
export const potionsRules = {
  create:createPotionsLevel, initial:level => ({ bottles:clone(level.bottles) }), move, won,
  actions(level, state) {
    const actions = [];
    for (let from = 0; from < state.bottles.length; from++) for (let to = 0; to < state.bottles.length; to++) {
      const amount = pourAmount(state, from, to); if (!amount) continue;
      // Moving a uniform bottle to an empty one only renames its position.
      if (!state.bottles[to].length && state.bottles[from].every(c => c === state.bottles[from][0])) continue;
      const next = move(level, state, {from,to}); actions.push({from,to,score:(settledBottle(next.bottles[to]) ? 6 : 0) + (next.bottles[from].length ? 0 : 3) + amount});
    }
    return actions.sort((a,b) => b.score-a.score).map(({from,to}) => ({from,to}));
  },
  plan:(level, state) => searchPlan(potionsRules, level, state, 35000),
};
