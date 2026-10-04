import './colony-style.css';
import { COLORS, MOTIFS, ColonyGame, createColonyLevel, encodeColonySave, decodeColonySave, SAVE_KEY } from './colony-puzzle.js';
import { ColonyScene } from './colony-scene.js';

const $ = selector => document.querySelector(selector);
let saved; try { saved = decodeColonySave(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { /* Storage is optional. */ }
let game = saved?.game || new ColonyGame(), completed = saved?.completed || [], speed = saved?.speed || 1;
let paused = false, hintQueue = null, lastSave = 0, scene, lastTime = 0, frame, statusText = '', wonRecorded = false, queuesSignature = '';
const base = import.meta.env.BASE_URL;
$('#app').innerHTML = `
  <header class="colony-header">
    <a class="colony-brand" href="${base}"><span class="colony-mark">↗</span><span>cube cube cube<small>A small escape.</small></span></a>
    <nav aria-label="Game modes"><a href="${base}cube.html">The cube <small>3D</small></a><a href="${base}image.html">Picture puzzles <small>2D</small></a><a href="${base}colony.html" aria-current="page">Colony <small>3D</small></a></nav>
    <button id="colony-collection" class="collection-link">La collection <span id="collection-total">0</span> ↗</button>
  </header>
  <main class="colony-layout">
    <section class="colony-intro"><span class="eyebrow">DE PETITES FOURMIS,<br>DE GRANDES IDÉES</span><h1>Un petit<br><em>monde<br>en marche.</em></h1><p>Une couleur. Une équipe.<br>Un aller-retour à la fois.</p><div class="colony-rule"></div><div class="colony-tip"><span>01</span><div><strong>Faites de la place.</strong><p>Choisissez une boîte. Ses fourmis récoltent les cubes accessibles de la même couleur.</p></div></div><div class="colony-tip"><span>02</span><div><strong>Gardez le mouvement.</strong><p>Cinq places seulement. Une boîte pleine libère sa place ; une couleur enfouie attend.</p></div></div><span class="slow-note">✳ Pas de chrono. Prenez votre temps.</span><button id="colony-help" class="colony-help-link">Les règles du petit monde ↗</button></section>
    <section class="colony-play" aria-label="Puzzle de la colonie">
      <div class="colony-heading"><div><span class="eyebrow" id="colony-number"></span><h2 id="colony-title"></h2></div><div class="colony-counter"><strong id="colony-remaining"></strong><span>cubes à rapporter</span></div></div>
      <div class="colony-progress"><span id="colony-progress"></span></div>
      <div class="colony-stage"><div class="stage-label"><span class="small-dot"></span><span id="colony-activity">La colonie se repose</span></div><div id="colony-scene"></div><div class="stage-controls"><button id="colony-rules" aria-label="Voir les règles">?</button><button id="colony-pause" aria-label="Mettre en pause" aria-pressed="false">Ⅱ</button><button id="colony-speed" aria-pressed="false">×2</button></div><div id="colony-finish" class="colony-finish" hidden><span class="eyebrow">CHAQUE PETIT VOYAGE COMPTE</span><h2>Tout est<br><em>à la maison.</em></h2><p id="colony-finish-copy"></p><button id="colony-next">Le prochain petit monde →</button><button id="colony-replay">Rejouer ce puzzle</button></div><div id="colony-error" hidden role="alert">Le rendu 3D est interrompu. Rechargez la page pour reprendre votre colonie.</div></div>
      <div class="slots-heading"><span class="eyebrow">LES CINQ PLACES</span><span id="slot-count">0 / 5 occupées</span></div>
      <div id="colony-slots" class="colony-slots" aria-label="Boîtes actives"></div>
      <div class="colony-toolbar"><button id="colony-undo">↶ <span>Annuler</span><kbd>U</kbd></button><button id="colony-hint">✧ <span>Un petit indice</span><kbd>H</kbd></button><button id="colony-restart">↻ <span>Recommencer</span><kbd>R</kbd></button></div>
      <p id="colony-status" role="status" aria-live="polite">Choisissez une boîte dans la réserve pour réveiller ses fourmis.</p>
    </section>
    <aside class="colony-reserve" aria-label="Réserve de boîtes"><div class="reserve-heading"><span class="eyebrow">À VOUS DE CHOISIR</span><h2>La réserve.</h2><p>La première boîte de chaque file<br>est prête à partir.</p></div><div id="colony-queues" class="colony-queues"></div><div class="reserve-foot"><span id="reserve-count"></span><span>↓ Débloquez la suivante<br>en envoyant celle du dessus.</span></div><div class="colony-legend"><span class="legend-dot"></span> Couleur enfouie ?<p>Les fourmis attendent que d'autres équipes dégagent un passage.</p></div></aside>
  </main>
  <footer class="colony-footer"><span>Les petits efforts font les belles choses.</span><span>Une colonie, à votre rythme. ✳</span></footer>
  <dialog id="colony-collection-dialog" class="colony-dialog"><div class="dialog-heading"><div><span class="eyebrow">VOS PETITS MONDES</span><h2>La collection.</h2></div><button data-close aria-label="Fermer la collection">×</button></div><p>Six images, puis de nouvelles réserves et des boîtes plus petites.</p><div id="colony-levels"></div><form id="colony-jump"><label for="colony-level-input">Aller au puzzle</label><input id="colony-level-input" type="number" min="1" max="1000000" required><button>Jouer →</button></form></dialog>
  <dialog id="colony-help-dialog" class="colony-dialog"><div class="dialog-heading"><h2>Une petite colonie.</h2><button data-close aria-label="Fermer les règles">×</button></div><ol><li><strong>Choisissez une boîte.</strong> Seule celle du dessus de chaque file est disponible. Son nombre indique les cubes qu'elle doit rapporter.</li><li><strong>Regardez les fourmis.</strong> Elles atteignent les cubes par l'extérieur et les espaces déjà dégagés, puis les ramènent au nid.</li><li><strong>Gérez cinq emplacements.</strong> Les boîtes restent jusqu'à leur remplissage. Si leur couleur est enfouie, elles attendent les autres équipes.</li><li><strong>Gardez une place libre.</strong> Cinq boîtes qui attendent peuvent bloquer la colonie. Annulez un choix ou demandez un indice pour repartir.</li></ol><p>H : indice · Entrée : envoyer la boîte indiquée · U : annuler · R : recommencer · Espace : pause.</p><p>Votre progression se sauvegarde sur cet appareil.</p><button class="dialog-primary" data-close>C'est parti →</button></dialog>`;

function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(encodeColonySave(game, completed, speed))); } catch { /* Play remains available without storage. */ } }
function status(text) { if (statusText !== text) { statusText = text; $('#colony-status').textContent = text; } }
function colorStyle(c) { return `--box-color:${COLORS[c].hex}`; }
function renderQueues() {
  const signature = `${game.level.index}|${game.state.cursors}|${game.state.slots.includes(null)}|${hintQueue}|${game.won}`;
  if (queuesSignature === signature) return; queuesSignature = signature;
  $('#colony-queues').innerHTML = game.level.queues.map((queue, q) => `<div class="colony-queue" aria-label="File ${q + 1}"><span class="queue-label">0${q + 1}</span>${queue.slice(game.state.cursors[q]).map((box, i) => `<button class="ant-box ${i ? 'buried' : 'ready'} ${hintQueue === q && !i ? 'hinted' : ''}" style="${colorStyle(box.color)}" data-queue="${q}" ${i || !game.state.slots.includes(null) || game.won ? 'disabled' : ''} aria-label="${COLORS[box.color].name}, ${box.count} cubes, file ${q + 1}${i ? ', enfouie' : ''}"><span class="box-ant" aria-hidden="true">♧</span><strong>${box.count}</strong><span class="box-color-name">${COLORS[box.color].name}</span>${!i ? '<span class="send-mark" aria-hidden="true">↑</span>' : ''}</button>`).join('') || '<span class="queue-empty">✓<small>Tout est parti</small></span>'}</div>`).join('');
  $('#reserve-count').textContent = `${game.heads.reduce((n, _, q) => n + game.level.queues[q].length - game.state.cursors[q], 0)} boîtes en réserve`;
}
function update() {
  $('#colony-number').textContent = `PUZZLE ${String(game.level.index + 1).padStart(2, '0')} · ${game.level.index < 6 ? 'LES PREMIERS PAS' : 'UN PEU PLUS LOIN'}`;
  $('#colony-title').textContent = game.level.title; $('#colony-remaining').textContent = game.remaining;
  $('#colony-progress').style.width = `${100 * (1 - game.remaining / game.level.cells.length)}%`;
  const occupied = game.state.slots.filter(Boolean).length;
  $('#slot-count').textContent = `${occupied} / 5 occupées`;
  $('#colony-slots').innerHTML = game.state.slots.map((box, i) => {
    if (!box) return `<div class="colony-slot vacant"><span>+</span><small>Place ${i + 1}</small></div>`;
    const jobs = game.state.jobs.filter(j => j.slot === i).length;
    return `<div class="colony-slot occupied ${!jobs ? 'waiting' : ''}" style="${colorStyle(box.color)}" aria-label="${COLORS[box.color].name}, ${box.remaining} cubes restants"><span class="slot-color"></span><strong>${box.remaining}<small> / ${box.count}</small></strong><small>${jobs ? `${jobs} fourmis` : 'En attente'}</small><span class="slot-fill" style="width:${100 * (1 - box.remaining / box.count)}%"></span></div>`;
  }).join('');
  $('#colony-undo').disabled = !game.history.length; $('#colony-hint').disabled = game.won;
  $('#colony-speed').setAttribute('aria-pressed', String(speed === 2)); $('#colony-pause').setAttribute('aria-pressed', String(paused));
  $('#colony-pause').setAttribute('aria-label', paused ? 'Reprendre' : 'Mettre en pause'); $('#colony-pause').textContent = paused ? '▷' : 'Ⅱ';
  $('#colony-activity').textContent = paused ? 'La colonie fait une pause' : game.state.jobs.length ? `${game.state.jobs.length} fourmis en chemin` : 'La colonie se repose';
  $('#collection-total').textContent = completed.length;
  $('#colony-finish').hidden = !game.won;
  if (game.won && !wonRecorded) {
    wonRecorded = true; if (!completed.includes(game.level.index)) completed.push(game.level.index);
    $('#collection-total').textContent = completed.length; $('#colony-finish-copy').textContent = `${game.level.cells.length} cubes récoltés. Un petit monde de plus dans votre collection.`;
    status('Tous les cubes sont à la maison. La colonie a terminé ce puzzle.'); persist();
  } else if (game.stalled) status('Les cinq boîtes attendent une couleur enfouie. Annulez un choix pour libérer la colonie.');
  renderQueues();
}
function launch(q) {
  if (!game.launch(q)) { status('Attendez qu’une boîte se remplisse pour libérer une place.'); return; }
  hintQueue = null; game.advance(0); status('La nouvelle équipe est en route. Observez les couleurs qui se dégagent.'); update(); persist();
}
function start(index) { game = new ColonyGame(createColonyLevel(index)); hintQueue = null; paused = false; wonRecorded = false; scene.setGame(game); status('Choisissez une boîte dans la réserve pour réveiller ses fourmis.'); update(); persist(); }
function undo() { if (!game.undo()) return; hintQueue = null; wonRecorded = false; scene.setGame(game); status('Une petite marche arrière. Vous pouvez choisir une autre boîte.'); update(); persist(); }
function hint() {
  const result = game.hint(); hintQueue = result.type === 'box' ? result.queue : null;
  if (hintQueue !== null) { const box = game.heads[hintQueue]; status(`Essayez la boîte ${COLORS[box.color].name.toLowerCase()} de la file ${hintQueue + 1}. Entrée pour l'envoyer.`); }
  else status(result.type === 'wait' ? 'Laissez les fourmis terminer leurs voyages pour libérer une place.' : result.type === 'unknown' ? 'Ce puzzle demande un peu de réflexion. Privilégiez une couleur accessible et gardez une place libre.' : 'Ce choix a fermé le passage. Annulez une boîte, puis demandez un nouvel indice.');
  renderQueues();
}
$('#colony-queues').addEventListener('click', event => { const button = event.target.closest('button[data-queue]'); if (button && !button.disabled) launch(Number(button.dataset.queue)); });
$('#colony-undo').onclick = undo; $('#colony-hint').onclick = hint; $('#colony-restart').onclick = () => start(game.level.index);
$('#colony-next').onclick = () => start(game.level.index < 999999 ? game.level.index + 1 : 0); $('#colony-replay').onclick = () => start(game.level.index);
$('#colony-speed').onclick = () => { speed = speed === 1 ? 2 : 1; update(); persist(); };
$('#colony-pause').onclick = () => { paused = !paused; update(); };
$('#colony-help').onclick = () => $('#colony-help-dialog').showModal();
$('#colony-rules').onclick = () => $('#colony-help-dialog').showModal();
$('#colony-collection').onclick = () => {
  const page = Math.floor(game.level.index / 12) * 12;
  $('#colony-levels').innerHTML = Array.from({ length: Math.min(12, 1000000 - page) }, (_, n) => {
    const index = page + n, level = createColonyLevel(index);
    const miniature = `<svg viewBox="0 0 16 16" aria-hidden="true">${level.cells.map((c, id) => `<rect x="${id % 16}" y="${Math.floor(id / 16)}" width="1" height="1" fill="${COLORS[c].hex}"/>`).join('')}</svg>`;
    return `<button data-level="${index}" ${index === game.level.index ? 'aria-current="true"' : ''}>${miniature}<span><small>${String(index + 1).padStart(2, '0')} ${completed.includes(index) ? '✓' : ''}</small>${level.title}</span></button>`;
  }).join(''); $('#colony-level-input').value = game.level.index + 1; $('#colony-collection-dialog').showModal();
};
$('#colony-levels').onclick = event => { const button = event.target.closest('[data-level]'); if (button) { start(Number(button.dataset.level)); $('#colony-collection-dialog').close(); } };
$('#colony-jump').onsubmit = event => { event.preventDefault(); const index = Number($('#colony-level-input').value) - 1; if (Number.isSafeInteger(index) && index >= 0 && index < 1000000) { start(index); $('#colony-collection-dialog').close(); } };
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'h') hint(); else if (key === 'u') undo(); else if (key === 'r') start(game.level.index);
  else if (key === 'enter' && hintQueue !== null) { event.preventDefault(); launch(hintQueue); }
  else if (key === ' ' && !event.target.closest('button,a')) { event.preventDefault(); paused = !paused; update(); }
  else if (/^[1-4]$/.test(key)) launch(Number(key) - 1);
});
$('#colony-scene').addEventListener('colony-render-error', () => { paused = true; $('#colony-error').hidden = false; persist(); });
try {
  scene = new ColonyScene($('#colony-scene'), color => {
    const count = game.state.remaining.filter(id => game.level.cells[id] === color).length;
    status(`${COLORS[color].name} : ${count} cubes sur le plateau. Choisissez une boîte de cette couleur quand le passage est dégagé.`);
  });
  scene.setGame(game); game.advance(0); update();
  function animate(time) {
    const dt = lastTime ? Math.min(.08, (time - lastTime) / 1000) : 0; lastTime = time;
    const dialog = Boolean(document.querySelector('dialog[open]'));
    if (!paused && !dialog && !document.hidden && !game.won) {
      const events = game.advance(dt * speed);
      if (events.length) { if (events.some(e => e.type === 'pickup')) scene.sync(); update(); }
      if (time - lastSave > 1500 && (events.length || game.state.jobs.length)) { persist(); lastSave = time; }
    }
    scene.render(time / 1000); frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
} catch (error) {
  $('#colony-error').hidden = false; $('#colony-error').textContent = 'Le rendu 3D nécessite WebGL. Essayez un navigateur avec l’accélération graphique activée.'; update(); console.error(error);
}
document.addEventListener('visibilitychange', () => { lastTime = 0; if (document.hidden) persist(); });
window.addEventListener('pagehide', persist);
window.addEventListener('beforeunload', () => { persist(); cancelAnimationFrame(frame); scene?.dispose(); });
if (import.meta.env.DEV) window.__colonyDebug = { get game() { return game; }, get scene() { return scene; }, start, launch, undo, advance: seconds => { game.advance(seconds); scene.sync(); update(); persist(); }, get paused() { return paused; } };
