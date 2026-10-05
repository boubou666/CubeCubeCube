import './pocket-style.css';
import { COLORS, CHAPTERS, LEVEL_COUNT, PocketGame, clone, encodePocket, decodePocket } from './pocket-core.js';
import { atelierRules, exposedPlate } from './atelier-puzzle.js';
import { bobinesRules } from './bobines-puzzle.js';
import { escapadeRules } from './escapade-puzzle.js';
import { PocketCanvas } from './pocket-canvas.js';

const mode = document.body.dataset.pocket;
const configs = {
  atelier: { name:'Atelier', rules:atelierRules, eyebrow:'CHAQUE PIÈCE A SON MOMENT', title:'Un tour.<br><em>Et tout se libère.</em>', copy:'De petites vis, de belles couleurs.<br>Démontez le monde, pièce après pièce.', steps:[['Regardez sous les planches.', 'Une planche supérieure cache les vis du dessous. Retirez ses trois vis pour la libérer.'], ['Triez sans vous coincer.', 'Deux boîtes de trois vis, et quelques places de côté. Choisissez le bon ordre.']], note:'Tournez l’objet · Cliquez une vis', unit:'vis à retirer', reserve:'Les bonnes places.', reserveCopy:'Les vis rejoignent une boîte de leur couleur. Les autres attendent de côté.', finish:'Tout se libère.', rulesText:['Cliquez sur une vis accessible dans l’objet, ou sur son bouton dans la réserve. Faites glisser l’objet pour le tourner ; la molette permet de zoomer.', 'Chaque boîte reçoit trois vis de sa couleur, puis laisse la place à la suivante. Les vis en attente rejoignent automatiquement une boîte compatible.', 'Une planche disparaît quand ses trois vis sont retirées. Ses voisines du dessous deviennent accessibles.', 'Si les places d’attente sont pleines, il faut libérer une boîte ou annuler un choix. Un indice vérifie une suite complète de coups avant de vous guider.'] },
  bobines: { name:'Bobines', rules:bobinesRules, eyebrow:'LE BON FIL, AU BON MOMENT', title:'Un fil.<br><em>Puis un autre.</em>', copy:'Des couleurs à démêler.<br>De petits instants à dérouler.', steps:[['Choisissez votre bobine.', 'La première bobine de chaque file peut rejoindre l’une des trois places du métier.'], ['Laissez les fils venir.', 'Elle enroule les nœuds accessibles de sa couleur. Une couleur cachée attend son tour.']], note:'Choisissez une bobine dans la réserve', unit:'nœuds à démêler', reserve:'La réserve de fils.', reserveCopy:'Le nombre de chaque bobine indique les nœuds qu’elle doit enrouler.', finish:'Plus un seul nœud.', rulesText:['Seule la première bobine de chaque file peut être choisie. Elle occupe une des trois places du métier.', 'Les nœuds entourés en haut de chaque ligne sont accessibles. Les fils de la bonne couleur s’enroulent automatiquement sur les bobines actives.', 'Une bobine pleine disparaît et rend sa place. Si sa couleur est cachée sous une autre, elle patiente.', 'Trois bobines qui attendent peuvent bloquer le métier. Annulez ou demandez un indice pour retrouver une suite gagnante.'] },
  escapade: { name:'Escapade', rules:escapadeRules, eyebrow:'DE PETITS VOISINS, DE GRANDS DÉTOURS', title:'Chacun<br><em>son chemin.</em>', copy:'Un jardin plein de petits voisins.<br>Aidez-les à retrouver leur maison.', steps:[['Prenez une extrémité.', 'Cliquez sur la tête ou la queue, puis sur une case voisine. Vous pouvez aussi faire glisser.'], ['Gardez des passages.', 'Le corps suit votre chemin. Conduisez chaque créature au trou de sa couleur.']], note:'Faites glisser une tête ou une queue', unit:'voisins à guider', reserve:'Les petits voisins.', reserveCopy:'Chaque couleur a sa maison. La tête et la queue peuvent toutes deux mener le chemin.', finish:'Tous à la maison.', rulesText:['Cliquez sur la tête ou la queue d’une créature, puis sur une case voisine, ou faites glisser cette extrémité de case en case.', 'Le corps suit le chemin, une case à la fois. Vous pouvez aussi sélectionner un voisin dans la liste et utiliser les flèches du clavier ou les boutons directionnels.', 'Les haies, les autres créatures et les trous d’une autre couleur bloquent le passage. La dernière case du corps peut être occupée si elle se libère pendant ce même mouvement.', 'Une créature rentre dès qu’une extrémité atteint son trou. Il n’y a aucun chrono. Si l’indice ne trouve pas une suite complète dans son budget de recherche, il propose d’annuler un détour.'] },
};
const config = configs[mode], rules = config.rules, $ = selector => document.querySelector(selector), base = import.meta.env.BASE_URL;
config.title = config.title.replace('<br>', '<br> ');
const key = `cubecubecube-${mode}-v1`; let saved;
try { saved = decodePocket(rules, JSON.parse(localStorage.getItem(key))); } catch { /* Storage is optional. */ }
let game = saved?.game || new PocketGame(rules), completed = saved?.completed || new Set(), sound = saved?.sound || false;
let scene, hint = null, selected = null, chapter = Math.floor(game.level.index / 12), busyUntil = 0, audioContext, hintTimer;
$('#app').innerHTML = `<header class="pocket-header"><a class="pocket-brand" href="${base}"><span>↗</span><strong>cube cube cube<small>A small escape.</small></strong></a><nav class="pocket-nav" aria-label="Navigation"><a href="${base}">Les jeux</a><button id="pocket-collection">La collection <span id="pocket-total"></span></button><button id="pocket-help" aria-label="Voir les règles">?</button></nav></header>
<main class="pocket-layout"><section class="pocket-intro"><span class="eyebrow">${config.eyebrow}</span><h1>${config.title}</h1><p>${config.copy}</p>${config.steps.map(([title, text], i) => `<div class="pocket-tip"><span>0${i + 1}</span><div><strong>${title}</strong><p>${text}</p></div></div>`).join('')}<span class="slow-note">✳ Pas de chrono. Prenez votre temps.</span></section>
<section class="pocket-play" aria-label="Puzzle ${config.name}"><div class="pocket-heading"><div><span id="pocket-number" class="eyebrow"></span><h2 id="pocket-title"></h2><span id="pocket-difficulty" class="difficulty"></span></div><div class="pocket-count"><strong id="pocket-remaining"></strong><small>${config.unit}</small></div></div><div class="pocket-progress"><span id="pocket-progress"></span></div><div id="pocket-stage" class="pocket-stage"><span class="pocket-stage-note">${config.name.toUpperCase()} · UNE PETITE PAUSE</span>${mode === 'atelier' ? '<button class="pocket-view" id="pocket-view" aria-label="Recentrer la vue">↻ Recentrer</button>' : ''}<div id="pocket-finish" class="pocket-finish" hidden><span class="eyebrow">UNE BELLE CHOSE DE PLUS</span><h2>${config.finish}</h2><p id="pocket-finish-copy"></p><button id="pocket-next">Le prochain puzzle →</button><button id="pocket-replay" class="secondary">Rejouer ce puzzle</button></div><div id="pocket-error" class="pocket-error" role="alert" hidden>Le rendu 3D est indisponible. Les boutons de la réserve permettent toujours de jouer.</div></div><div class="pocket-toolbar"><button id="pocket-undo">↶ Annuler <kbd>U</kbd></button><button id="pocket-hint">✧ Un petit indice <kbd>H</kbd></button><button id="pocket-restart">↻ Recommencer <kbd>R</kbd></button><button id="pocket-sound" aria-label="Activer le son" aria-pressed="false">♫</button></div><p id="pocket-status" role="status" aria-live="polite">${config.note}</p></section>
<aside class="pocket-aside" aria-label="Réserve et commandes"><span class="eyebrow">À VOUS DE CHOISIR</span><h2>${config.reserve}</h2><p>${config.reserveCopy}</p><div id="pocket-controls"></div></aside></main>
<footer class="pocket-footer"><span>Les petites choses font les belles pauses.</span><span>48 puzzles · Sans publicité · Sauvegardé ici ✳</span></footer>
<dialog id="pocket-collection-dialog" class="pocket-dialog"><div class="pocket-dialog-head"><h2>La collection.</h2><button data-close aria-label="Fermer la collection">×</button></div><p>48 petits puzzles. Quatre chapitres, de plus en plus malins. Tous sont accessibles.</p><div id="pocket-chapters" class="pocket-chapters">${CHAPTERS.map((title, i) => `<button data-chapter="${i}">${title}</button>`).join('')}</div><div id="pocket-levels" class="pocket-levels"></div></dialog>
<dialog id="pocket-help-dialog" class="pocket-dialog"><div class="pocket-dialog-head"><h2>${config.name}.</h2><button data-close aria-label="Fermer les règles">×</button></div><ol>${config.rulesText.map(text => `<li>${text}</li>`).join('')}</ol><p>H : indice · Entrée : jouer l’indice · U : annuler · R : recommencer.${mode === 'escapade' ? ' Flèches : déplacer l’extrémité choisie.' : ''}</p><p>Votre progression reste sur cet appareil. Les sons sont facultatifs.</p><button data-close class="tool-button hint-button">C’est parti →</button></dialog>`;

function persist() { try { localStorage.setItem(key, JSON.stringify(encodePocket(game, completed, sound))); } catch { /* Gameplay continues if storage is blocked or full. */ } }
function status(text) { $('#pocket-status').textContent = text; }
function remaining() {
  if (mode === 'atelier') return game.level.screws.length - game.state.removed.length;
  if (mode === 'bobines') return game.level.lines.reduce((n, line, i) => n + line.length - game.state.cursors[i], 0);
  return game.state.snakes.length;
}
function total() { return mode === 'atelier' ? game.level.screws.length : mode === 'bobines' ? game.level.lines.reduce((n, l) => n + l.length, 0) : game.level.snakes.length; }
function enabled() { return performance.now() >= busyUntil && !$('dialog[open]') && !game.won; }
function tone() {
  if (!sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume();
    const osc = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
    osc.type = 'sine'; osc.frequency.setValueAtTime(game.won ? 660 : 340 + remaining() % 6 * 55, now); gain.gain.setValueAtTime(.035, now); gain.gain.exponentialRampToValueAtTime(.001, now + .15); osc.connect(gain).connect(audioContext.destination); osc.start(now); osc.stop(now + .16);
  } catch { /* Audio is optional. */ }
}
const dot = color => `<span class="color-dot" style="--color:${COLORS[color].hex}" aria-label="${COLORS[color].name}">${COLORS[color].mark}</span>`;
function bobbinSvg(color) { return `<svg viewBox="0 0 40 46" aria-hidden="true"><rect x="6" y="6" width="28" height="33" rx="7" fill="${COLORS[color].hex}"/><g stroke="#fff9" stroke-width="1.4"><path d="M8 14q12 6 24 0M8 20q12 6 24 0M8 26q12 6 24 0M8 32q12 6 24 0"/></g><rect x="1" y="2" width="38" height="8" rx="4" fill="#cbb58f"/><rect x="1" y="37" width="38" height="8" rx="4" fill="#cbb58f"/><text x="20" y="27" text-anchor="middle" font-size="12" fill="#34564a">${COLORS[color].mark}</text></svg>`; }
function controls() {
  if (mode === 'atelier') {
    const exposed = game.level.screws.filter(s => !game.state.removed.includes(s.id) && exposedPlate(game.level, game.state, game.level.plates.find(p => p.id === s.plate)));
    return `<div class="pocket-trays">${game.state.trays.map(box => `<div class="pocket-tray">${box ? `${dot(box.color)}<strong>${box.count} / 3</strong><small>${COLORS[box.color].name}</small>` : '<strong>✓</strong><small>Tout est trié</small>'}</div>`).join('')}</div><span class="pocket-reserve-label">EN ATTENTE · ${game.state.buffer.length} / ${game.level.bufferSize}</span><div class="pocket-buffer">${Array.from({ length:game.level.bufferSize }, (_, i) => game.state.buffer[i] !== undefined ? `<span style="--color:${COLORS[game.state.buffer[i]].hex}">${COLORS[game.state.buffer[i]].mark}</span>` : '<span>·</span>').join('')}</div><span class="pocket-reserve-label">LES PROCHAINES BOÎTES</span><div class="pocket-upcoming">${game.level.boxes.slice(game.state.nextBox).map(color => `<span style="--color:${COLORS[color].hex}" title="${COLORS[color].name}">${COLORS[color].mark}</span>`).join('') || '<small>Plus de boîte en réserve</small>'}</div><span class="pocket-reserve-label">VIS ACCESSIBLES · OU CLIQUEZ DANS L’OBJET</span><div class="screw-options">${exposed.map(s => `<button data-screw="${s.id}" class="${hint?.action === s.id ? 'hinted' : ''}" aria-label="Vis ${s.id + 1}, ${COLORS[s.color].name}">${dot(s.color)}<br>Vis ${s.id + 1}</button>`).join('')}</div>`;
  }
  if (mode === 'bobines') {
    return `<div class="pocket-slots">${game.state.slots.map((bobbin, i) => `<div class="pocket-slot">${bobbin ? `${dot(bobbin.color)}<strong>${bobbin.remaining}</strong><small>À enrouler</small>` : `<strong>+</strong><small>Place ${i + 1}</small>`}</div>`).join('')}</div><span class="pocket-reserve-label">LA PREMIÈRE BOBINE DE CHAQUE FILE</span><div class="bobbin-queues">${game.level.queues.map((queue, q) => `<div class="bobbin-queue"><span class="eyebrow">0${q + 1}</span>${queue.slice(game.state.queues[q], game.state.queues[q] + 3).map((bobbin, i) => `<button class="bobbin-button ${i ? 'buried' : 'ready'} ${!i && hint?.action === q ? 'hinted' : ''}" data-queue="${q}" ${i || !game.state.slots.includes(null) || game.won ? 'disabled' : ''} aria-label="${COLORS[bobbin.color].name}, ${bobbin.count} nœuds, file ${q + 1}">${bobbinSvg(bobbin.color)}<strong>${bobbin.count}</strong><small>${i ? 'En réserve' : 'Envoyer ↑'}</small></button>`).join('') || '<small>✓</small>'}<small>${Math.max(0, queue.length - game.state.queues[q] - 3) ? `+${queue.length - game.state.queues[q] - 3}` : ''}</small></div>`).join('')}</div>`;
  }
  return `<div class="creature-list">${game.level.snakes.map(s => `<button data-creature="${s.id}" style="--color:${COLORS[s.color].hex}" class="creature-button" aria-pressed="${selected?.id === s.id}" ${!game.state.snakes.some(n => n.id === s.id) ? 'disabled' : ''}><span>${game.state.snakes.some(n => n.id === s.id) ? '••' : '✓'}</span>${COLORS[s.color].name} ${COLORS[s.color].mark}</button>`).join('')}</div><p class="pocket-reserve-label">${selected ? `${COLORS[game.level.snakes[selected.id].color].name} · ${selected.end === 'head' ? 'Tête' : 'Queue'} sélectionnée` : 'Choisissez une tête ou une queue dans le jardin.'}</p><button id="pocket-end" class="tool-button">↔ Changer d’extrémité</button><div class="pocket-pad" aria-label="Déplacer la créature"><button data-direction="0,-1" aria-label="Monter">↑</button><button data-direction="-1,0" aria-label="Aller à gauche">←</button><button data-direction="0,1" aria-label="Descendre">↓</button><button data-direction="1,0" aria-label="Aller à droite">→</button></div>`;
}
function update(previous = null) {
  $('#pocket-number').textContent = `PUZZLE ${String(game.level.index + 1).padStart(2, '0')} / 48 · ${config.name.toUpperCase()}`;
  $('#pocket-title').textContent = game.level.title; $('#pocket-difficulty').textContent = CHAPTERS[game.level.tier];
  $('#pocket-remaining').textContent = remaining(); $('#pocket-progress').style.width = `${(1 - remaining() / total()) * 100}%`;
  $('#pocket-undo').disabled = !game.history.length; $('#pocket-hint').disabled = game.won;
  $('#pocket-sound').setAttribute('aria-pressed', String(sound)); $('#pocket-sound').setAttribute('aria-label', sound ? 'Couper le son' : 'Activer le son');
  $('#pocket-controls').innerHTML = controls(); scene?.update(game.level, game.state, hint, selected, previous);
  if (game.won) completed.add(game.level.index); $('#pocket-total').textContent = `${completed.size} / 48`;
  $('#pocket-finish').hidden = !game.won;
  $('#pocket-finish-copy').textContent = completed.size === LEVEL_COUNT ? 'Les 48 puzzles sont dans votre collection. Bravo !' : `${completed.size} puzzle${completed.size > 1 ? 's' : ''} dans votre collection. Prenez le temps de savourer.`;
  $('#pocket-next').textContent = game.level.index === LEVEL_COUNT - 1 ? 'Retrouver la collection →' : 'Le prochain puzzle →';
  if (mode === 'escapade') $('#pocket-end').disabled = !selected;
  persist();
}
function play(action) {
  if (!enabled()) return false;
  const previous = clone(game.state);
  if (!game.play(action)) { status(mode === 'atelier' ? 'Cette vis ne peut pas partir : vérifiez les planches et les places en attente.' : mode === 'bobines' ? 'Les trois places sont occupées. Annulez un choix pour faire de la place.' : 'Ce passage est occupé. Essayez une autre case ou l’autre extrémité.'); return false; }
  hint = null; if (mode === 'escapade' && selected && !game.state.snakes.some(s => s.id === selected.id)) selected = null;
  busyUntil = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches || mode === 'escapade' ? 0 : mode === 'atelier' ? 800 : 650); tone();
  update(previous); status(game.won ? 'Un petit monde de plus dans votre collection.' : mode === 'bobines' && !game.state.slots.includes(null) ? 'Les trois bobines attendent. Annulez un choix ou demandez un indice.' : config.note); return true;
}
function undo() { busyUntil = 0; hint = null; if (game.undo()) { selected = null; update(); status('Votre dernier choix est annulé.'); } }
function restart() { busyUntil = 0; hint = null; selected = null; game.restart(); update(); status('Le même puzzle, une nouvelle tentative.'); }
function load(index) { clearTimeout(hintTimer); game = new PocketGame(rules, index); hint = null; selected = null; busyUntil = 0; update(); status(config.note); }
function showHint() {
  if (!enabled()) return;
  status('Je cherche une suite qui mène jusqu’au bout…');
  hintTimer = setTimeout(() => {
    hint = game.hint(); if (hint?.action !== undefined && mode === 'escapade') selected = { id:hint.action.id, end:hint.action.end };
    update(); status(hint?.undo ? 'Annulez le dernier détour pour retrouver une suite vérifiée. Entrée permet de l’annuler.' : hint ? 'Le prochain choix est indiqué. Cliquez dessus ou appuyez sur Entrée.' : 'Aucun indice trouvé pour ce plateau.');
    $('#pocket-canvas')?.focus({ preventScroll:true });
  }, 20);
}
function cell(to, dragging) {
  if (!enabled()) return;
  const snake = game.state.snakes.find(s => s.id === selected?.id);
  if (snake) {
    const from = selected.end === 'tail' ? snake.cells.at(-1) : snake.cells[0];
    if (Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) === 1) { if (play({ ...selected, to })) return; }
  }
  if (dragging) return;
  const hit = game.state.snakes.find(s => s.cells.some(c => c[0] === to[0] && c[1] === to[1]));
  if (hit) { selected = { id:hit.id, end:hit.cells.at(-1)[0] === to[0] && hit.cells.at(-1)[1] === to[1] ? 'tail' : 'head' }; hint = null; update(); status('L’extrémité est choisie. Glissez ou choisissez une case voisine.'); }
}
function direction(dx, dy) { const snake = game.state.snakes.find(s => s.id === selected?.id); if (!snake) { status('Choisissez d’abord une petite créature.'); return; } const from = selected.end === 'tail' ? snake.cells.at(-1) : snake.cells[0]; play({ ...selected, to:[from[0] + dx, from[1] + dy] }); }
function collection() {
  $('#pocket-chapters').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.chapter) === chapter)));
  $('#pocket-levels').innerHTML = Array.from({ length:12 }, (_, i) => {
    const index = chapter * 12 + i, level = rules.create(index);
    return `<button data-level="${index}" aria-current="${index === game.level.index}" aria-label="Puzzle ${index + 1}, ${level.title}${completed.has(index) ? ', terminé' : ''}"><strong>${String(index + 1).padStart(2, '0')} ${completed.has(index) ? '✓' : ''}</strong><small>${level.title}</small></button>`;
  }).join('');
}
$('#pocket-controls').addEventListener('click', e => {
  const target = e.target.closest('button'); if (!target || target.disabled) return;
  if (target.dataset.screw !== undefined) play(Number(target.dataset.screw));
  if (target.dataset.queue !== undefined) play(Number(target.dataset.queue));
  if (target.dataset.creature !== undefined) { selected = { id:Number(target.dataset.creature), end:'head' }; hint = null; update(); $('#pocket-canvas').focus({ preventScroll:true }); }
  if (target.id === 'pocket-end' && selected) { selected.end = selected.end === 'head' ? 'tail' : 'head'; hint = null; update(); }
  if (target.dataset.direction) direction(...target.dataset.direction.split(',').map(Number));
});
$('#pocket-undo').addEventListener('click', undo); $('#pocket-restart').addEventListener('click', restart); $('#pocket-replay').addEventListener('click', restart); $('#pocket-hint').addEventListener('click', showHint);
$('#pocket-sound').addEventListener('click', () => { sound = !sound; update(); tone(); });
$('#pocket-next').addEventListener('click', () => { if (game.level.index < LEVEL_COUNT - 1) load(game.level.index + 1); else { chapter = 0; collection(); $('#pocket-collection-dialog').showModal(); } });
$('#pocket-collection').addEventListener('click', () => { chapter = Math.floor(game.level.index / 12); collection(); $('#pocket-collection-dialog').showModal(); });
$('#pocket-help').addEventListener('click', () => $('#pocket-help-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$('#pocket-chapters').addEventListener('click', event => { const b = event.target.closest('[data-chapter]'); if (b) { chapter = Number(b.dataset.chapter); collection(); } });
$('#pocket-levels').addEventListener('click', event => { const b = event.target.closest('[data-level]'); if (b) { $('#pocket-collection-dialog').close(); load(Number(b.dataset.level)); } });
document.addEventListener('keydown', event => {
  if ($('dialog[open]') || ['INPUT', 'TEXTAREA'].includes(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
  const pressed = event.key.toLowerCase();
  if (pressed === 'h') { event.preventDefault(); showHint(); }
  if (pressed === 'u') { event.preventDefault(); undo(); }
  if (pressed === 'r') { event.preventDefault(); restart(); }
  if (pressed === 'enter' && hint) { event.preventDefault(); if (hint.undo) undo(); else play(hint.action); }
  if (mode === 'bobines' && /^[1-4]$/.test(pressed)) { event.preventDefault(); play(Number(pressed) - 1); }
  if (mode === 'escapade' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); direction(...({ ArrowUp:[0, -1], ArrowDown:[0, 1], ArrowLeft:[-1, 0], ArrowRight:[1, 0] })[event.key]); }
});
update();
try {
  if (mode === 'atelier') { const { AtelierScene } = await import('./atelier-scene.js'); scene = new AtelierScene($('#pocket-stage'), { enabled, screw:play, error:() => { $('#pocket-error').hidden = false; } }); $('#pocket-view').addEventListener('click', () => scene.resetView()); }
  else scene = new PocketCanvas($('#pocket-stage'), mode, { enabled, cell });
  update();
} catch { $('#pocket-error').hidden = false; }
window.__pocketDebug = { get game() { return game; }, get scene() { return scene; }, get hint() { return hint; }, get selected() { return selected; }, get ready() { return performance.now() >= busyUntil; } };
window.addEventListener('pagehide', () => { persist(); scene?.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
