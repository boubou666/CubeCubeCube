import { checkIndex, clone, random, shuffle } from './pocket-core.js';

const TITLES = ['Deux bouts de chemin','Le jardin des lignes','Un joli détour','Le coin tranquille','Les chemins voisins','Au fil des cases','Une boucle de plus','Les petits croisements','Le chemin long','Tout se rejoint','Un peu de patience','Le dernier lien'];
export const neighbors = (size, a, b) => Math.abs(a % size - b % size) + Math.abs(Math.floor(a / size) - Math.floor(b / size)) === 1;
function move(level, state, action) {
  if (!action || !Number.isInteger(action.color) || !level.pairs[action.color] || !Array.isArray(action.path)) return null;
  const path = action.path, ends = level.pairs[action.color];
  if (path.length && !ends.includes(path[0])) return null;
  const occupied = new Set(state.paths.flatMap((p, color) => color === action.color ? [] : p));
  const forbidden = new Set(level.pairs.flatMap((p, color) => color === action.color ? [] : p));
  const seen = new Set();
  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    if (!Number.isInteger(cell) || cell < 0 || cell >= level.size ** 2 || seen.has(cell) || occupied.has(cell) || forbidden.has(cell) || i && !neighbors(level.size, path[i-1], cell) || i > 0 && ends.includes(cell) && i !== path.length-1) return null;
    seen.add(cell);
  }
  const next = clone(state); next.paths[action.color] = [...path];
  return JSON.stringify(next) === JSON.stringify(state) ? null : next;
}
export const connectedPath = (level, path, color) => path.length > 1 && level.pairs[color].includes(path[0]) && level.pairs[color].includes(path.at(-1)) && path[0] !== path.at(-1);
const won = (level, state) => state.paths.every((p,c) => connectedPath(level,p,c)) && state.paths.reduce((n,p) => n+p.length,0) === level.size ** 2;
export function createLiaisonsLevel(index) {
  checkIndex(index); const tier = Math.floor(index / 12), size = 4 + tier, count = 3 + tier, rng = random(29483 + index * 9173);
  let best;
  for (let attempt = 0; attempt < 12; attempt++) {
    let path = Array.from({length:size ** 2}, (_,n) => Math.floor(n/size)*size + (Math.floor(n/size)%2 ? size-1-n%size : n%size));
    // Backbite moves preserve a Hamiltonian path while breaking the row pattern.
    for (let step = 0; step < 120 + tier * 100; step++) {
      const start = rng() < .5, endpoint = start ? path[0] : path.at(-1);
      const choices = path.map((cell,i) => ({cell,i})).filter(({cell,i}) => neighbors(size,endpoint,cell) && (start ? i > 1 : i < path.length-2));
      if (!choices.length) continue; const {i} = choices[Math.floor(rng()*choices.length)];
      path = start ? [...path.slice(0,i).reverse(), ...path.slice(i)] : [...path.slice(0,i+1), ...path.slice(i+1).reverse()];
    }
    const lengths = Array(count).fill(4); for (let n=count*4; n<size**2; n++) lengths[Math.floor(rng()*count)]++;
    let cursor = 0; const paths = shuffle(lengths.map(length => {const p=path.slice(cursor,cursor+length);cursor+=length;return p;}),rng);
    const score = paths.reduce((n,p) => n+Math.abs(p[0]%size-p.at(-1)%size)+Math.abs(Math.floor(p[0]/size)-Math.floor(p.at(-1)/size)),0);
    if (!best || score > best.score) best = {paths,score};
  }
  const colors = shuffle([0,1,2,3,4,5,6,7],rng).slice(0,count);
  return {index,tier,title:TITLES[index%12],size,colors,pairs:best.paths.map(p=>[p[0],p.at(-1)]),solution:best.paths.map((path,color)=>({color,path}))};
}
export const liaisonsRules = {
  create:createLiaisonsLevel, initial:level => ({paths:level.pairs.map(()=>[])}), move, won,
  actions:() => [],
  plan(level, state) {
    if (won(level,state)) return [];
    let next = clone(state); const route = [];
    // Keep canonical paths in either direction. Clear conflicting strokes before
    // drawing the audited full-grid solution; each suggested edit is transactional.
    for (let color=0;color<next.paths.length;color++) {
      const path=next.paths[color], expected=level.solution[color].path;
      if (path.length && JSON.stringify(path)!==JSON.stringify(expected) && JSON.stringify([...path].reverse())!==JSON.stringify(expected)) {
        const action={color,path:[]};next=move(level,next,action);route.push(action);
      }
    }
    for (const action of level.solution) if (!connectedPath(level,next.paths[action.color],action.color)) {next=move(level,next,action);if(!next)return null;route.push(action);}
    return won(level,next) ? route : null;
  },
};
