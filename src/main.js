import { LEVELS, FAMILIES, levelMeta, isLevelIndex, PuzzleGame, availableArrows, availableMoves, solveWithStops, hasMechanisms } from './puzzle.js';
import { readSave, writeSave, hasCompleted, completedCount, markCompleted } from './storage.js';
import { CubeScene } from './scene.js';

const paths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1.4"/><rect x="14" y="4" width="6" height="6" rx="1.4"/><rect x="4" y="14" width="6" height="6" rx="1.4"/><rect x="14" y="14" width="6" height="6" rx="1.4"/>',
  undo: '<path d="M8 4 3 9l5 5M3 9h10a6 6 0 0 1 0 12h-3"/>',
  hint: '<path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8ZM20 2v4m-2-2h4"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  rotate: '<path d="M4 8c2-4 13-5 16 0M20 4v4h-4M20 16c-2 4-13 5-16 0M4 20v-4h4"/><path d="m12 8 4 2v4l-4 2-4-2v-4Z"/>',
  sound: '<path d="m11 4-5 4H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 4-5 4H3v8h3l5 4ZM16 9l5 6m0-6-5 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.6 2.6 0 1 1 4.5 2c-1.5 1-2 1.5-2 3M12 17h.01"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  palette: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 3a9 9 0 0 1 0 18"/><path d="M12 7h6M12 11h8M12 15h7"/>',
};
function icon(name, cls = '') { return `<svg class="icon ${cls}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`; }
const cubeMark = `<svg viewBox="0 0 48 54" fill="none" aria-hidden="true"><path d="m24 3 20 11v25L24 51 4 39V14Z" fill="currentColor"/><path d="m4 14 20 12 20-12M24 26v25" stroke="var(--page)" stroke-width="1.6"/><path d="m14 8 20 12v25M34 8 14 20v25M4 26l20 12 20-12" stroke="var(--page)" stroke-width="1.3"/></svg>`;
const save = readSave();
const game = new PuzzleGame(save.index, save.removed, save.moves, save.generation);
let scene, selectedId = null, selectedEnd = 0, winTimer = null, toastTimer = null, revision = 0, audioContext, winShown = false;
let currentHelp = 0;
let endlessPage = 0;
let collectionFamily = 'All';

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Cube Cube Cube home">${cubeMark}<span>cube<span>cube</span>cube</span><span class="brand-note">A small escape.</span></a>
    <nav class="topnav" aria-label="Game controls">
      <button id="levels-button" class="collection-button">${icon('grid')}<span>The collection</span><span id="collection-count">01 / ∞</span></button>
      <div class="nav-divider"></div>
      <button id="sound-button" class="icon-button" aria-label="Turn sound on" aria-pressed="false" title="Sound">${icon('muted')}</button>
      <button id="theme-button" class="icon-button" aria-label="Change color palette" title="Color palette">${icon('palette')}</button>
      <button id="help-button" class="icon-button" aria-label="How to play" title="How to play">${icon('help')}</button>
    </nav>
  </header>
  <main class="play-layout">
    <section class="intro-panel">
      <div class="eyebrow"><span class="tiny-line"></span>A MOMENT FOR YOURSELF</div>
      <h1>A little<br><em>perspective.</em></h1>
      <p class="intro-copy">Turn things around.<br>Find a clear path.<br>Let a little go.</p>
      <div class="intro-rule"></div>
      <div class="tip-card">
        <span class="tip-icon">${icon('rotate')}</span>
        <div><strong id="tip-title">There’s another side.</strong><p id="tip-copy">Drag the cube to discover<br>what’s around the corner.</p></div>
      </div>
      <div class="slow-note"><span class="leaf-mark">✳</span> No rush. No move limit.</div>
    </section>
    <section class="game-panel" aria-label="Current puzzle">
      <div class="level-heading">
        <span id="level-number" class="eyebrow">LEVEL 01</span>
        <h2 id="level-title">First light</h2>
        <span id="difficulty" class="difficulty"><i></i>Gentle</span>
        <p id="mechanic-notice" class="mechanic-notice" hidden></p>
      </div>
      <div class="scene-shell">
        <div class="orbit-decoration" aria-hidden="true"></div>
        <div id="scene-container"></div>
        <div id="loading" class="loading">Finding a little perspective…</div>
        <button id="view-button" class="view-button" aria-label="Reset camera view" title="Reset view">${icon('rotate')}</button>
        <div id="toast" class="toast" role="status" aria-live="polite"></div>
      </div>
      <div class="game-toolbar" aria-label="Puzzle actions">
        <button id="undo-button" class="tool-button" disabled>${icon('undo')}<span>Undo</span></button>
        <button id="hint-button" class="tool-button hint-button">${icon('hint')}<span>A little hint</span><kbd>H</kbd></button>
        <button id="restart-button" class="tool-button">${icon('reset')}<span>Restart</span></button>
      </div>
      <p class="interaction-note"><span>Drag to rotate</span><i></i><span>Tap an arrow to let it go</span></p>
    </section>
    <aside class="progress-panel" aria-label="Puzzle progress">
      <span class="eyebrow">LITTLE BY LITTLE</span>
      <div class="progress-ring">
        <svg viewBox="0 0 160 160" aria-hidden="true"><circle class="ring-track" cx="80" cy="80" r="71"/><circle id="ring-progress" cx="80" cy="80" r="71"/></svg>
        <div class="ring-label"><strong id="remaining">18</strong><span>arrows left</span></div>
      </div>
      <div class="cleared-label"><span class="small-dot"></span><span id="cleared">0 of 18 cleared</span></div>
      <p id="level-caption" class="level-caption">Every little journey starts<br>with a clear path.</p>
      <div class="journey-card"><div><span class="eyebrow">YOUR COLLECTION</span><strong><span id="completed-count">0</span> <span>/ ∞</span></strong></div><button id="journey-button" class="icon-button" aria-label="Explore the collection">${icon('arrow')}</button><div class="journey-dots" aria-hidden="true">${LEVELS.map((_, i) => `<i data-level-dot="${i}"></i>`).join('')}</div></div>
    </aside>
  </main>
  <footer class="footer"><span>A little less tangled.</span><span>Made for a quieter kind of play.<span class="footer-flower">✳</span></span></footer>
  <dialog id="levels-dialog" class="modal collection-modal">
    <div class="modal-heading"><div><span class="eyebrow">ENDLESS LITTLE ESCAPES</span><h2>The collection</h2></div><button class="icon-button close-dialog" aria-label="Close collection">${icon('close')}</button></div>
    <p class="modal-description">${LEVELS.length} opening puzzles, then an endless journey. Take all the time you need.</p>
    <button id="endless-button" class="primary-button">Continue the journey ${icon('arrow')}</button>
    <div id="family-filters" class="family-filters" role="group" aria-label="Opening puzzle families"></div>
    <div id="level-grid" class="level-grid"></div>
    <section class="endless-section" aria-label="Endless puzzles">
      <div class="endless-heading"><div><span class="eyebrow">A LITTLE DEEPER, EACH TIME</span><h3>The endless journey</h3><p>Bigger boards. More connections. New perspectives.</p></div><span class="infinity-mark" aria-hidden="true">∞</span></div>
      <div class="endless-pages"><button id="endless-prev" class="text-button" aria-label="Previous endless puzzles">← Previous</button><span id="endless-page-label"></span><button id="endless-next" class="text-button" aria-label="Next endless puzzles">Next →</button></div>
      <div id="endless-grid" class="level-grid"></div>
      <form id="jump-form" class="jump-form"><label for="puzzle-jump">Jump to puzzle</label><input id="puzzle-jump" type="number" min="${LEVELS.length + 1}" max="${Number.MAX_SAFE_INTEGER - 1}" step="1" required><button class="text-button" type="submit">Go ${icon('arrow')}</button></form>
    </section>
    <p class="modal-footnote">Your progress is saved automatically on this device.</p>
  </dialog>
  <dialog id="help-dialog" class="modal help-modal">
    <div class="modal-heading"><div><span class="eyebrow">A LITTLE GUIDANCE</span><h2>Make room. Let go.</h2></div><button class="icon-button close-dialog" aria-label="Close how to play">${icon('close')}</button></div>
    <div class="help-illustration" aria-hidden="true"><svg viewBox="0 0 300 94"><path d="M34 68V28h78v38h60V28h75"/><path d="m232 13 16 15-16 15"/><circle cx="34" cy="68" r="4"/></svg><span>Follow the path, all the way to its head.</span></div>
    <ol class="help-steps"><li><strong>Turn it around.</strong><p>Drag with your mouse or finger to see all six sides. Scroll or pinch to zoom.</p></li><li><strong>Find a clear way out.</strong><p>Tap an arrow. It slides in the direction its head points, then flies off the edge. Another arrow in front of it? Clear that one first.</p></li><li><strong>Untangle the whole cube.</strong><p>Paths can wrap around corners. Keep turning, keep clearing. There’s no timer, and mistakes cost nothing.</p></li></ol>
    <div class="extra-rules"><p><strong>Colored ridges</strong> carry an arrow onto the next face. Follow its route across every connected side.</p><p><strong>Opposite heads</strong> give you a choice. Tap the head you want to lead; the entire arrow follows.</p><p><strong>Forks</strong> send both heads along their own routes at once. Both paths must be clear before the arrow can move.</p><p><strong>Small circles</strong> pause an arrow when its head reaches them. The arrow stays on the cube, opening or blocking different paths. Tap again to continue.</p><p><strong>Pressure buttons</strong> pause a head and open gates of the same color. The gates close as soon as that head leaves. Keep the button occupied while another arrow passes.</p><p><strong>Bent tiles</strong> turn a passing head a quarter turn left or right. Blue tiles stay fixed. Striped purple tiles reverse their turn after each head passes successfully. Tap arrows to interact with them.</p><p><strong>Blue spirals</strong> pause a head and turn the upper section a quarter turn, carrying its arrows, tiles, and colored ridges. An arrow stretched across the section seam must move clear first. Tap the parked arrow again to continue.</p></div>
    <div class="keyboard-guide"><span>Keyboard shortcuts</span><p><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> rotate · <kbd>H</kbd> hint · <kbd>Enter</kbd> release hint · <kbd>U</kbd> undo · <kbd>R</kbd> restart</p></div>
    <button class="primary-button close-dialog">A little clearer ${icon('arrow')}</button>
  </dialog>
  <dialog id="theme-dialog" class="modal theme-modal">
    <div class="modal-heading"><div><span class="eyebrow">SET THE MOOD</span><h2>A change of scenery.</h2></div><button class="icon-button close-dialog" aria-label="Close color palette">${icon('close')}</button></div>
    <div class="theme-options">${[['ivory', 'Warm ivory', 'A soft place to land.'], ['mint', 'Garden mint', 'A breath of fresh air.'], ['dusk', 'Quiet dusk', 'A gentler kind of evening.']].map(([id, title, description]) => `<button class="theme-option" data-theme-choice="${id}" aria-pressed="false"><span class="theme-swatch theme-${id}">${cubeMark}</span><strong>${title}</strong><span>${description}</span></button>`).join('')}</div>
  </dialog>
  <dialog id="win-dialog" class="modal win-modal">
    <div class="modal-heading"><span class="eyebrow">A LITTLE ROOM TO BREATHE</span><button class="icon-button close-dialog" aria-label="Close completed puzzle">${icon('close')}</button></div>
    <div class="win-mark">${icon('check')}</div><h2>Beautifully<br><em>untangled.</em></h2><p id="win-copy">You made room, one arrow at a time.</p>
    <div class="win-stats"><span id="win-level">01</span><div><strong id="win-title">First light</strong><span>All clear. Well played.</span></div><span class="stat-check">${icon('check')}</span></div>
    <button id="next-button" class="primary-button">A new perspective ${icon('arrow')}</button><button id="win-collection-button" class="text-button">Back to the collection</button>
  </dialog>
  <div id="confetti" aria-hidden="true"></div>
`;

const $ = selector => document.querySelector(selector);
function persist() {
  save.index = game.index; save.removed = [...game.removed]; save.moves = game.saveMoves;
  save.generation = game.generation;
  if (game.index >= LEVELS.length) save.frontier = Math.max(save.frontier, game.index);
  const ok = writeSave(save);
  if (!ok && !persist.warned) { persist.warned = true; toast('Your browser cannot save progress. You can still play.'); }
}
function toast(message, duration = 2700) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), duration);
}
function renderUI() {
  const meta = levelMeta(game.index), total = game.level.arrows.length;
  $('#level-number').textContent = `LEVEL ${String(game.index + 1).padStart(2, '0')}`;
  $('#level-title').textContent = meta.title;
  $('#difficulty').innerHTML = `<i></i>${meta.difficulty}`;
  const mechanics = [];
  if (game.level.bridges?.length) mechanics.push('Colored ridge → next face');
  if (game.level.arrows.some(a => a.twoHeads)) mechanics.push('Tap a head to choose');
  if (game.level.arrows.some(a => a.branch)) mechanics.push('Both head paths must be clear');
  if (game.level.circles?.length) mechanics.push('Circle = pause');
  if (game.level.buttons?.length) mechanics.push('Hold button → matching gate');
  if (game.level.deflectors?.length) mechanics.push(game.level.deflectors.some(d => d.alternating) ? 'Striped turn switches after passage' : 'Bent tile = quarter turn');
  if (game.level.rotors?.length) mechanics.push('Spiral → rotate upper section');
  if (typeof game.level.size === 'object') mechanics.push(game.level.size.hole ? 'Inner walls' : game.level.size.terrace ? 'Treads & risers' : 'Unequal faces');
  $('#mechanic-notice').hidden = mechanics.length === 0;
  $('#mechanic-notice').textContent = mechanics.join(' · ');
  $('#remaining').textContent = game.remaining;
  $('#cleared').textContent = `${total - game.remaining} of ${total} cleared`;
  $('#ring-progress').style.strokeDashoffset = 446.1 * (game.remaining / total);
  $('#level-caption').textContent = meta.caption;
  $('#collection-count').textContent = `${String(game.index + 1).padStart(2, '0')} / ∞`;
  $('#completed-count').textContent = completedCount(save);
  $('#undo-button').disabled = game.history.length === 0;
  $('#hint-button').disabled = game.remaining === 0;
  document.querySelectorAll('[data-level-dot]').forEach(dot => {
    const index = Number(dot.dataset.levelDot);
    dot.classList.toggle('completed', save.completed.includes(index)); dot.classList.toggle('current', index === game.index);
  });
}

function sound(kind) {
  if (!save.sound) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const notes = kind === 'win' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'blocked' ? [190, 160] : [420 + (game.level.arrows.length - game.remaining) % 5 * 65, 630];
    notes.forEach((frequency, i) => {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      const at = audioContext.currentTime + i * 0.08;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.07, at + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
      oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(at); oscillator.stop(at + 0.27);
    });
  } catch { /* Audio is optional; gameplay continues if unavailable. */ }
}

function removeArrow(id, end = 0) {
  if (hasMechanisms(game.level) && scene.busy) { toast('Let the mechanisms settle, then tap an arrow.', 1800); return; }
  if (scene.animations.has(id)) { toast('Let the arrow settle, then tap again.', 1600); return; }
  const result = game.tryRemove(id, end);
  if (result.status === 'blocked') {
    scene.blocked(id, result.blockers); sound('blocked'); toast(result.rotationBlocked ? 'An arrow crosses the section seam. Move it clear before turning.' : result.gate ? 'The gate is closed. Park a head on its matching button.' : result.solid ? 'The solid blocks this exit.' : result.loop ? 'This route loops around the cube. Clear another arrow.' : result.conflict ? 'The two heads would collide. Both routes must be clear.' : result.arrow?.branch ? 'Both head paths must be clear. Clear the arrows ahead first.' : 'Something’s in the way. Clear the arrow ahead first.');
    return;
  }
  if (result.status === 'ignored') return;
  selectedId = null; scene.hint(null); sound('remove'); renderUI(); persist();
  if (result.status === 'complete') {
    markCompleted(save, game.index);
    renderUI(); persist();
  }
  const thisRevision = revision;
  if (result.mechanisms) scene.releaseButton(id);
  const finished = () => {
    if (thisRevision === revision && game.remaining === 0) {
      clearTimeout(winTimer);
      winTimer = setTimeout(() => { if (game.remaining === 0 && thisRevision === revision) showWin(); }, 180);
    }
  };
  scene.remove(id, () => {
    if (thisRevision !== revision) return;
    if (result.mechanisms) {
      const refresh = () => { if (thisRevision !== revision) return; scene.load(game.level, game.removed, save.theme); finished(); };
      if (result.rotations.length) scene.rotateSection(result.rotations[0], result.rotations.length, refresh);
      else refresh();
    } else finished();
  }, result.route, result.end, result.mechanisms ? result.parkedArrow : result.updatedArrow, result.routes);
  if (result.status === 'moved') toast(result.rotations?.length ? 'The upper section is turning. Its arrows move with it.' : result.route?.trigger ? 'Paused on the spiral.' : game.level.buttons?.some(b => result.updatedArrow?.cells.at(-1)?.face === b.face && result.updatedArrow.cells.at(-1).x === b.x && result.updatedArrow.cells.at(-1).y === b.y) ? 'Button held. The matching gate is open.' : 'Paused on the circle. Tap this arrow again to continue.', 3500);
  else if (game.remaining && game.remaining % 6 === 0) toast(['A little more room.', 'Things are opening up.', 'One step at a time.'][Math.floor(game.remaining / 6) % 3], 1500);
}

function undo() {
  clearTimeout(winTimer); closeDialog($('#win-dialog')); winShown = false; revision++;
  const id = game.undo(); if (id === null) return;
  selectedId = null; scene.load(game.level, game.removed, save.theme); renderUI(); persist(); toast('A little step back.', 1600);
}
function hint() {
  if (hasMechanisms(game.level) && scene.busy) { toast('Let the mechanisms settle for a moment.', 1600); return; }
  let moves = availableMoves(game.level, game.removed).filter(m => !scene.animations.has(m.id));
  if (hasMechanisms(game.level) || (game.level.circles?.length && !game.level.independentStops)) {
    const solution = solveWithStops(game.level, game.removed);
    if (solution?.length && !scene.animations.has(solution[0].id)) moves = [solution[0]];
  }
  if (!moves.length) { toast('Let the arrows settle for a moment.', 1600); return; }
  // Cycle hints so keyboard players can choose another route, including other faces.
  const current = moves.findIndex(m => m.id === selectedId && m.end === selectedEnd);
  const next = moves[(current + 1) % moves.length]; selectedId = next.id; selectedEnd = next.end;
  scene.hint(selectedId, selectedEnd); toast(game.level.arrows.find(a => a.id === selectedId)?.branch ? 'Both golden heads have clear routes. Tap the arrow, or press Enter.' : 'The golden head has a clear route. Tap it, or press Enter.', 4500);
}
function loadLevel(index, restart = false) {
  if (index === game.index && !restart) return;
  revision++; winShown = false; clearTimeout(winTimer); clearTimeout(toastTimer); $('#toast').classList.remove('visible');
  closeDialog($('#win-dialog')); selectedId = null;
  game.load(index, [], [], restart ? game.generation : 2); scene.load(game.level, game.removed, save.theme); scene.resetView(); renderUI(); persist();
  if (restart) toast('A fresh start.', 1600);
}
function renderCollection() {
  $('#family-filters').innerHTML = ['All', ...FAMILIES].map(f => `<button class="family-filter" aria-pressed="${f === collectionFamily}" data-family="${f}">${f}</button>`).join('');
  $('#family-filters').querySelectorAll('button').forEach(button => { button.onclick = () => { collectionFamily = button.dataset.family; renderCollection(); }; });
  $('#level-grid').innerHTML = LEVELS.map((level, i) => collectionFamily !== 'All' && level.family !== collectionFamily ? '' : `<button class="level-card ${save.completed.includes(i) ? 'is-complete' : ''} ${game.index === i ? 'is-current' : ''}" data-level="${i}" ${game.index === i ? 'aria-current="true"' : ''}><span class="level-card-top"><span>${String(i + 1).padStart(2, '0')}</span>${save.completed.includes(i) ? icon('check') : i === game.index ? '<span class="current-tag">Playing</span>' : ''}</span><span class="mini-cube">${cubeMark}</span><strong>${level.title}</strong><span class="level-card-difficulty">${level.family} · ${level.difficulty}</span></button>`).join('');
  $('#level-grid').querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => { loadLevel(Number(button.dataset.level)); closeDialog($('#levels-dialog')); }));
  const resume = game.index >= LEVELS.length && game.remaining ? game.index : save.frontier;
  $('#endless-button').innerHTML = `${resume === LEVELS.length ? 'Start' : 'Continue'} the journey · Puzzle ${resume + 1} ${icon('arrow')}`;
  $('#endless-button').onclick = () => { loadLevel(resume); closeDialog($('#levels-dialog')); };
  renderEndlessPage();
}

function renderEndlessPage() {
  const first = LEVELS.length + endlessPage * 12;
  const indices = Array.from({ length: Math.min(12, Number.MAX_SAFE_INTEGER - first) }, (_, i) => first + i);
  $('#endless-page-label').textContent = `${first + 1}–${first + indices.length}`;
  $('#endless-prev').disabled = endlessPage === 0;
  $('#endless-next').disabled = !isLevelIndex(first + 12);
  $('#endless-grid').innerHTML = indices.map(i => {
    const meta = levelMeta(i), complete = hasCompleted(save, i);
    return `<button class="level-card ${complete ? 'is-complete' : ''} ${game.index === i ? 'is-current' : ''}" data-level="${i}" ${game.index === i ? 'aria-current="true"' : ''}><span class="level-card-top"><span>${i + 1}</span>${complete ? icon('check') : i === game.index ? '<span class="current-tag">Playing</span>' : ''}</span><span class="mini-cube">${cubeMark}</span><strong>${meta.family}</strong><span class="level-card-difficulty">Tier ${meta.tier} · ${meta.shape}</span></button>`;
  }).join('');
  $('#endless-grid').querySelectorAll('[data-level]').forEach(button => button.onclick = () => { loadLevel(Number(button.dataset.level)); closeDialog($('#levels-dialog')); });
  $('#puzzle-jump').value = first + 1;
}

function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
function closeDialog(dialog) { if (dialog.open) dialog.close(); }
function showCollection() { endlessPage = Math.floor((Math.max(LEVELS.length, game.index >= LEVELS.length ? game.index : save.frontier) - LEVELS.length) / 12); renderCollection(); openDialog($('#levels-dialog')); }
function showWin() {
  if (winShown) return;
  winShown = true;
  $('#win-title').textContent = levelMeta(game.index).title; $('#win-level').textContent = String(game.index + 1).padStart(2, '0');
  $('#next-button').innerHTML = `${game.index === LEVELS.length - 1 ? 'Begin the endless journey' : 'A new perspective'} ${icon('arrow')}`;
  $('#win-copy').textContent = game.index === LEVELS.length - 1 ? 'The journey keeps going. New puzzles, a little deeper each time.' : 'You made room, one arrow at a time.';
  openDialog($('#win-dialog')); sound('win');
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $('#confetti').innerHTML = Array.from({ length: 32 }, (_, i) => `<i style="--x:${12 + Math.random() * 76}vw;--delay:${Math.random() * 0.6}s;--spin:${Math.random() * 720}deg;--color:${['#7b9d7c', '#deb477', '#c4a0a6', '#adc6bb'][i % 4]}"></i>`).join('');
    setTimeout(() => { $('#confetti').innerHTML = ''; }, 3500);
  }
}

function applyTheme() {
  document.body.dataset.theme = save.theme;
  scene?.setTheme(save.theme);
  document.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === save.theme)));
}
function renderSound() {
  $('#sound-button').innerHTML = icon(save.sound ? 'sound' : 'muted');
  $('#sound-button').setAttribute('aria-label', save.sound ? 'Turn sound off' : 'Turn sound on');
  $('#sound-button').setAttribute('aria-pressed', String(save.sound));
}

$('#levels-button').addEventListener('click', showCollection); $('#journey-button').addEventListener('click', showCollection);
$('#help-button').addEventListener('click', () => openDialog($('#help-dialog')));
$('#theme-button').addEventListener('click', () => openDialog($('#theme-dialog')));
$('#undo-button').addEventListener('click', undo); $('#hint-button').addEventListener('click', hint);
$('#restart-button').addEventListener('click', () => loadLevel(game.index, true));
$('#view-button').addEventListener('click', () => { scene.resetView(); toast('Back to a familiar view.', 1500); });
$('#sound-button').addEventListener('click', () => { save.sound = !save.sound; renderSound(); persist(); if (save.sound) sound('remove'); });
$('#next-button').addEventListener('click', () => { closeDialog($('#win-dialog')); if (isLevelIndex(game.index + 1)) loadLevel(game.index + 1); else showCollection(); });
$('#endless-prev').addEventListener('click', () => { if (endlessPage) { endlessPage--; renderEndlessPage(); } });
$('#endless-next').addEventListener('click', () => { endlessPage++; renderEndlessPage(); });
$('#jump-form').addEventListener('submit', e => {
  e.preventDefault(); const index = Number($('#puzzle-jump').value) - 1;
  if (isLevelIndex(index) && index >= LEVELS.length) { loadLevel(index); closeDialog($('#levels-dialog')); }
});
$('#win-collection-button').addEventListener('click', () => { closeDialog($('#win-dialog')); showCollection(); });
document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => { save.theme = button.dataset.themeChoice; applyTheme(); persist(); }));
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(dialog); } }));
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || e.ctrlKey || e.altKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'h') { e.preventDefault(); hint(); }
  if (k === 'u') { e.preventDefault(); undo(); }
  if (k === 'r') { e.preventDefault(); loadLevel(game.index, true); }
  if (k === 'enter' && selectedId !== null && (e.target.tagName !== 'BUTTON' || e.target.id === 'hint-button')) { e.preventDefault(); removeArrow(selectedId, selectedEnd); }
  if (e.key.startsWith('Arrow')) {
    e.preventDefault(); scene.rotate(e.key === 'ArrowLeft' ? 0.18 : e.key === 'ArrowRight' ? -0.18 : 0, e.key === 'ArrowUp' ? -0.18 : e.key === 'ArrowDown' ? 0.18 : 0);
  }
});

applyTheme(); renderSound(); renderUI();
try {
  scene = new CubeScene($('#scene-container'), {
    onPick: removeArrow,
    onRotate: () => {
      if (currentHelp === 0) { currentHelp = 1; $('#tip-title').textContent = 'Find a little opening.'; $('#tip-copy').innerHTML = 'Follow an arrow to its head.<br>A clear path lets it fly away.'; }
    },
    onReady: () => $('#loading').remove(),
  });
  scene.load(game.level, game.removed, save.theme);
  if (game.remaining === 0) showWin();
  if (import.meta.env.DEV) window.__cubeDebug = { game, scene, available: () => availableArrows(game.level, game.removed).map(a => a.id) };
} catch (error) {
  console.error(error); $('#loading').innerHTML = '<strong>The cube needs WebGL.</strong><span>Enable hardware acceleration in your browser, then reload to play.</span>';
}
