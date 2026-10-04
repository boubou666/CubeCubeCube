import './image-style.css';
import { IMAGE_DIFFICULTIES, MIN_IMAGE_ARROW_CELLS, imageGrid, ImagePuzzleGame } from './image-puzzle.js';
import { ImageScene } from './image-scene.js';
import { readImageSave, writeImageSave } from './image-storage.js';

const svg = (path, cls = '') => `<svg class="${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const icons = {
  image: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>'),
  arrow: svg('<path d="M4 12h16m-6-6 6 6-6 6"/>'),
  undo: svg('<path d="m8 4-5 5 5 5M3 9h10a6 6 0 0 1 0 12"/>'),
  hint: svg('<path d="m12 3 2 6 6 3-6 2-2 7-3-7-6-2 6-3Z"/>'),
  reset: svg('<path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/>'),
};
document.querySelector('#app').innerHTML = `
  <header class="picture-header">
    <a class="picture-brand" href="${import.meta.env.BASE_URL}"><span class="picture-mark">↗</span><span>cube cube cube<small>A small escape.</small></span></a>
    <nav aria-label="Game modes"><a href="${import.meta.env.BASE_URL}">The cube <span>3D</span></a><span class="active-mode" aria-current="page">Picture puzzles <span>2D</span></span></nav>
  </header>
  <main class="picture-layout">
    <section class="picture-intro"><div><span class="eyebrow">A DIFFERENT KIND OF PERSPECTIVE</span><h1>Your pictures.<br><em>A little less tangled.</em></h1></div><p>Bring a photo, an illustration, a memory.<br>Find the clear paths and let the picture go,<br>one colourful arrow at a time.</p></section>
    <aside class="picture-studio" aria-label="Create a picture puzzle">
      <div class="studio-heading"><span class="step-number">01</span><h2>Choose a picture</h2></div>
      <label class="upload-area" id="drop-zone" for="image-file">${icons.image}<strong>Drop an image here</strong><span>or click to choose a file</span><input id="image-file" type="file" accept="image/*" aria-label="Choose an image"></label>
      <div class="source-actions"><button id="paste-image">Paste image</button><span>or</span><button id="sample-image">Try the sample</button></div>
      <details class="image-link"><summary>Use an image link</summary><form id="image-url-form"><label for="image-url">Direct image URL</label><div><input id="image-url" type="url" placeholder="https://…/picture.jpg" required><button type="submit" aria-label="Load image link">${icons.arrow}</button></div></form><p>For a webpage, upload a screenshot of it.</p></details>
      <p id="source-status" class="studio-message" role="status">Images are processed on your device.</p>
      <div class="studio-heading crop-heading"><span class="step-number">02</span><h2>Find your frame</h2><button id="reset-crop" class="quiet-button">Reset</button></div>
      <div class="crop-shell"><canvas id="crop-preview" width="600" height="360" aria-label="Image preview. Drag to select a crop."></canvas><span id="source-name"></span></div>
      <div class="crop-presets" role="group" aria-label="Crop shape"><button data-crop="whole" aria-pressed="true">Whole image</button><button data-crop="square" aria-pressed="false">Square</button><button data-crop="portrait" aria-pressed="false">Portrait</button><button data-crop="wide" aria-pressed="false">Wide</button></div>
      <p class="crop-help">Drag in the preview to choose your own crop.</p>
      <div class="studio-heading settings-heading"><span class="step-number">03</span><h2>Make it yours</h2></div>
      <div class="settings-row"><label for="image-difficulty">Difficulty<select id="image-difficulty"><option value="gentle">Gentle</option><option value="thoughtful" selected>Thoughtful</option><option value="tangled">Tangled</option></select></label><label for="image-detail">Image detail<select id="image-detail"><option value="soft">Soft</option><option value="balanced" selected>Balanced</option><option value="fine">Fine</option></select></label></div>
      <p id="difficulty-copy" class="crop-help">More bends and paths to clear in the right order.</p>
      <button id="create-image-puzzle" class="create-button">Create puzzle ${icons.arrow}</button>
      <button id="shuffle-picture" class="shuffle-button">Try different paths</button>
      <p class="privacy-note">Your image stays on this device.</p>
    </aside>
    <section class="picture-play" aria-label="Picture puzzle">
      <div class="picture-heading"><div><span id="puzzle-settings" class="eyebrow">A PICTURE, MADE PLAYABLE</span><h2 id="puzzle-title">Finding the paths…</h2></div><div class="picture-count"><strong id="image-remaining">—</strong><span>arrows left</span></div></div>
      <div class="picture-stage">
        <canvas id="picture-canvas" tabindex="0" aria-label="2D image arrow puzzle. Tap an arrow to release it. H finds a hint, Enter releases it, U undoes, R restarts. Scroll or pinch to zoom."></canvas>
        <div id="picture-loading" class="picture-loading" hidden><span class="loading-mark">↗</span><strong>Finding the clear paths…</strong><span>A little picture. A solvable puzzle.</span></div>
        <div id="picture-win" class="picture-win" hidden><span class="eyebrow">A LITTLE ROOM TO BREATHE</span><h2>Picture<br><em>untangled.</em></h2><p>You made room, one colour at a time.</p><button id="another-picture-layout" class="create-button">Another arrangement ${icons.arrow}</button><button id="choose-new-picture" class="quiet-button">Choose a new image</button></div>
        <div class="picture-view"><button id="picture-zoom-out" aria-label="Zoom out">−</button><button id="picture-fit" aria-label="Fit picture to view">Fit</button><button id="picture-zoom-in" aria-label="Zoom in">+</button></div>
      </div>
      <div class="picture-toolbar" aria-label="Puzzle actions"><button id="image-undo" disabled>${icons.undo}<span>Undo</span></button><button id="image-hint" class="picture-hint">${icons.hint}<span>A little hint</span><kbd>H</kbd></button><button id="image-restart">${icons.reset}<span>Restart</span></button><button id="show-original" aria-pressed="false">${icons.image}<span>Original</span></button></div>
      <p id="play-status" class="play-status" role="status" aria-live="polite">Tap an arrow with a clear path to the edge.</p>
      <div class="picture-footnotes"><span id="picture-progress">One colour at a time.</span><span>Scroll / pinch to zoom · Drag to pan</span></div>
    </section>
  </main>
  <footer class="picture-footer"><span>A little less tangled.</span><span>Your picture. Your pace. <i>✳</i></span></footer>`;

const $ = selector => document.querySelector(selector);
let source = null, crop = { x: 0, y: 0, w: 1, h: 1 }, game = null, active = null, worker = null, variation = 0, selected = null, importing = 0;
let saveQueue = Promise.resolve(), saveWarned = false;
const status = text => { $('#play-status').textContent = text; };
const sourceStatus = (text, error = false) => { $('#source-status').textContent = text; $('#source-status').classList.toggle('error', error); };
const scene = new ImageScene($('#picture-canvas'), { onPick: release, onSettled: () => { update(); if (game?.remaining === 0) status('All clear. Your picture is untangled.'); } });
function update() {
  $('#image-remaining').textContent = game?.remaining ?? '—';
  $('#image-undo').disabled = !game?.history.length;
  $('#image-hint').disabled = !game?.remaining || scene.busy || scene.reference || Boolean(worker);
  $('#image-restart').disabled = !game || Boolean(worker);
  $('#show-original').disabled = !game || scene.busy || Boolean(worker);
  $('#show-original').setAttribute('aria-pressed', String(scene.reference));
  $('#picture-win').hidden = !game || game.remaining !== 0 || scene.busy || scene.reference;
  $('#create-image-puzzle').disabled = !source || Boolean(worker);
  $('#shuffle-picture').disabled = !source || Boolean(worker);
  $('#picture-loading').hidden = !worker;
  $('#picture-progress').textContent = game ? `${game.level.arrows.length - game.remaining} of ${game.level.arrows.length} cleared · ${game.level.cols} × ${game.level.rows}` : 'One colour at a time.';
}
function persist() {
  if (!active || !game) return;
  const record = { ...active, history: [...game.history] };
  // Serialize writes so a quick undo cannot be overtaken by an earlier save.
  saveQueue = saveQueue.then(() => writeImageSave(record)).catch(() => {
    if (!saveWarned) { saveWarned = true; sourceStatus('Your browser cannot save this picture. You can still play.', true); }
  });
}
function release(id) {
  if (!game || worker || scene.reference) return;
  if (scene.busy) { status('Let this arrow leave, then choose the next one.'); return; }
  const result = game.release(id);
  if (result.status === 'blocked') { scene.blocked(id, result.blockers); status('An arrow is in the way. Clear the highlighted path first.'); return; }
  if (result.status !== 'removed') return;
  selected = null; scene.leave(result.arrow); update(); persist(); status('A little more room.');
}
function hint() {
  if (!game || scene.busy || worker || scene.reference) return;
  const moves = game.available(); if (!moves.length) return;
  const index = moves.findIndex(a => a.id === selected); selected = moves[(index + 1) % moves.length].id;
  scene.hint(selected); status('The golden outline has a clear exit. Tap it, or press Enter.');
}
function undo() { if (!game || worker) return; scene.cancel(); game.undo(); selected = null; update(); persist(); status('A little step back.'); }
function restart() { if (!game || worker) return; scene.cancel(); game = new ImagePuzzleGame(game.level); scene.game = game; selected = null; update(); persist(); status('A fresh start, with the same picture and paths.'); }
function cancelGeneration() { worker?.terminate(); worker = null; update(); }
function changed() { cancelGeneration(); sourceStatus('Frame ready. Create a puzzle to use these settings.'); }

function previewRect() {
  const scale = Math.min(600 / source.bitmap.width, 360 / source.bitmap.height);
  return { x: (600 - source.bitmap.width * scale) / 2, y: (360 - source.bitmap.height * scale) / 2, w: source.bitmap.width * scale, h: source.bitmap.height * scale };
}
function drawCrop() {
  const ctx = $('#crop-preview').getContext('2d'); ctx.clearRect(0, 0, 600, 360);
  if (!source) return;
  const r = previewRect(), x = r.x + crop.x * r.w, y = r.y + crop.y * r.h, w = crop.w * r.w, h = crop.h * r.h;
  ctx.drawImage(source.bitmap, r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#f5f6f1b8'; ctx.beginPath(); ctx.rect(0, 0, 600, 360); ctx.rect(x, y, w, h); ctx.fill('evenodd');
  ctx.strokeStyle = '#fffefa'; ctx.lineWidth = 5; ctx.strokeRect(x, y, w, h); ctx.strokeStyle = '#244c42'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { ctx.fillStyle = '#244c42'; ctx.fillRect(cx - 4, cy - 4, 8, 8); }
}
function preset(kind) {
  if (!source) return;
  crop = { x: 0, y: 0, w: 1, h: 1 };
  const ratio = { square: 1, portrait: 4 / 5, wide: 4 / 3 }[kind], aspect = source.bitmap.width / source.bitmap.height;
  if (ratio) {
    if (aspect > ratio) { crop.w = ratio / aspect; crop.x = (1 - crop.w) / 2; }
    else { crop.h = aspect / ratio; crop.y = (1 - crop.h) / 2; }
  }
  document.querySelectorAll('[data-crop]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.crop === kind)));
  drawCrop(); changed();
}
let cropStart = null, cropBefore = null;
function cropPoint(e) {
  const rect = $('#crop-preview').getBoundingClientRect(), r = previewRect();
  return { x: Math.max(0, Math.min(1, ((e.clientX - rect.left) * 600 / rect.width - r.x) / r.w)), y: Math.max(0, Math.min(1, ((e.clientY - rect.top) * 360 / rect.height - r.y) / r.h)) };
}
$('#crop-preview').addEventListener('pointerdown', e => { if (!source) return; $('#crop-preview').setPointerCapture(e.pointerId); cropStart = cropPoint(e); cropBefore = { ...crop }; cancelGeneration(); });
$('#crop-preview').addEventListener('pointermove', e => {
  if (!cropStart) return;
  const p = cropPoint(e); crop = { x: Math.min(cropStart.x, p.x), y: Math.min(cropStart.y, p.y), w: Math.abs(p.x - cropStart.x), h: Math.abs(p.y - cropStart.y) }; drawCrop();
});
$('#crop-preview').addEventListener('pointerup', () => {
  if (!cropStart) return;
  if (crop.w < 0.04 || crop.h < 0.04) crop = cropBefore;
  else { document.querySelectorAll('[data-crop]').forEach(b => b.setAttribute('aria-pressed', 'false')); changed(); }
  cropStart = null; drawCrop();
});
$('#crop-preview').addEventListener('pointercancel', () => { if (cropBefore) crop = cropBefore; cropStart = null; drawCrop(); });

async function importBlob(blob, name, { automatically = false, restoring = false } = {}) {
  const request = ++importing; cancelGeneration();
  if (!blob.type.startsWith('image/')) { sourceStatus('Choose an image file, such as a PNG, JPEG or WebP.', true); return; }
  if (blob.size > 15 * 1024 * 1024) { sourceStatus('Choose an image smaller than 15 MB.', true); return; }
  sourceStatus('Opening your picture…');
  const imageUrl = URL.createObjectURL(blob);
  try {
    // HTMLImageElement decodes SVG as well as raster formats; Chromium cannot
    // consistently create an ImageBitmap directly from an SVG blob.
    const image = new Image(); image.src = imageUrl; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40000000) throw new Error('This image is very large. Resize it to under 40 megapixels first.');
    if (request !== importing) return;
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    // Lossless normalization keeps pixel colours and seeded layouts identical
    // after a save/reload, including opaque photographs.
    const dataUrl = canvas.toDataURL('image/png');
    const normalized = await createImageBitmap(canvas);
    if (request !== importing) { normalized.close(); return; }
    source?.bitmap.close(); source = { bitmap: normalized, dataUrl, name: name.slice(0, 140) };
    crop = { x: 0, y: 0, w: 1, h: 1 }; variation = 0;
    $('#source-name').textContent = source.name; document.querySelectorAll('[data-crop]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.crop === 'whole')));
    drawCrop(); update(); sourceStatus('Drag in the preview to choose a crop, or keep the whole image.');
    if (automatically && !restoring) generate();
    return source;
  } catch (error) { if (request === importing) sourceStatus(error.message.includes('megapixels') ? error.message : 'This image could not be opened. Try a PNG, JPEG or WebP.', true); }
  finally { URL.revokeObjectURL(imageUrl); }
}
function cropCanvas(selectedSource = source, selectedCrop = crop) {
  const bitmap = selectedSource.bitmap, width = bitmap.width * selectedCrop.w, height = bitmap.height * selectedCrop.h;
  const scale = Math.min(1, 900 / Math.max(width, height)), canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(bitmap, bitmap.width * selectedCrop.x, bitmap.height * selectedCrop.y, width, height, 0, 0, canvas.width, canvas.height);
  return canvas;
}
function generate() {
  if (!source || crop.w < 0.04 || crop.h < 0.04) return;
  cancelGeneration(); scene.cancel(); $('#picture-win').hidden = true;
  const difficulty = $('#image-difficulty').value, detail = $('#image-detail').value, image = cropCanvas(), grid = imageGrid(image.width, image.height, detail);
  const sample = document.createElement('canvas'); sample.width = grid.cols; sample.height = grid.rows;
  sample.getContext('2d').drawImage(image, 0, 0, grid.cols, grid.rows);
  const pixels = sample.getContext('2d').getImageData(0, 0, grid.cols, grid.rows).data;
  const record = { version: 1, source: { dataUrl: source.dataUrl, name: source.name }, crop: { ...crop }, difficulty, detail, variation, history: [] };
  const task = new Worker(new URL('./image-worker.js', import.meta.url), { type: 'module' }); worker = task; update();
  task.onmessage = ({ data }) => {
    if (worker !== task) return;
    task.terminate(); worker = null;
    if (data.error) { sourceStatus(data.error, true); update(); return; }
    game = new ImagePuzzleGame(data.level); active = { ...record, level: data.level }; selected = null;
    scene.load(game, image); $('#puzzle-title').textContent = source.name.replace(/\.[a-z\d]+$/i, '');
    $('#puzzle-settings').textContent = `${IMAGE_DIFFICULTIES[difficulty].label} · ${detail} detail`;
    sourceStatus('Ready. Longer arrows, fewer pieces to clear.'); status('Tap an arrow with a clear path to the edge.'); update(); persist();
  };
  task.onerror = () => { if (worker === task) { cancelGeneration(); sourceStatus('The puzzle could not be generated. Try a softer detail setting.', true); } };
  task.postMessage({ ...grid, pixels, difficulty, detail, variation }, [pixels.buffer]);
}
async function sampleImage() {
  const request = ++importing; cancelGeneration();
  try { const response = await fetch(`${import.meta.env.BASE_URL}sample-landscape.svg`); if (!response.ok) throw new Error(); const blob = await response.blob(); if (request !== importing) return; await importBlob(blob, 'Sunlit hills', { automatically: true }); }
  catch { if (request === importing) sourceStatus('The sample could not be loaded. Choose your own image instead.', true); }
}
$('#image-file').addEventListener('change', e => { const file = e.target.files[0]; if (file) importBlob(file, file.name); e.target.value = ''; });
$('#sample-image').addEventListener('click', sampleImage);
$('#paste-image').addEventListener('click', async () => {
  const request = ++importing; cancelGeneration();
  try {
    const items = await navigator.clipboard.read();
    if (request !== importing) return;
    for (const item of items) { const type = item.types.find(t => t.startsWith('image/')); if (type) { await importBlob(await item.getType(type), 'Pasted picture'); return; } }
    sourceStatus('Copy an image first, then paste it here.', true);
  } catch { if (request === importing) sourceStatus('Press Ctrl+V / ⌘V to paste an image, or choose a file.', true); }
});
document.addEventListener('paste', e => { const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/')); if (item) { e.preventDefault(); importBlob(item.getAsFile(), 'Pasted picture'); } });
for (const name of ['dragenter', 'dragover']) $('#drop-zone').addEventListener(name, e => { e.preventDefault(); $('#drop-zone').classList.add('dragging'); });
for (const name of ['dragleave', 'drop']) $('#drop-zone').addEventListener(name, e => { e.preventDefault(); $('#drop-zone').classList.remove('dragging'); if (name === 'drop' && e.dataTransfer.files[0]) importBlob(e.dataTransfer.files[0], e.dataTransfer.files[0].name); });
$('#image-url-form').addEventListener('submit', async e => {
  e.preventDefault(); const request = ++importing; cancelGeneration(); sourceStatus('Opening the image link…');
  try {
    const url = new URL($('#image-url').value); if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error();
    const blob = await response.blob();
    if (request !== importing) return;
    if (blob.type.includes('text/html')) { sourceStatus('That is a webpage. Upload a screenshot of it instead.', true); return; }
    await importBlob(blob, decodeURIComponent(url.pathname.split('/').at(-1) || url.hostname));
  } catch { if (request === importing) sourceStatus('This link cannot be imported. Download the image and upload it here instead.', true); }
});
document.querySelectorAll('[data-crop]').forEach(b => b.addEventListener('click', () => preset(b.dataset.crop)));
$('#reset-crop').addEventListener('click', () => preset('whole'));
$('#image-difficulty').addEventListener('change', () => { $('#difficulty-copy').textContent = { gentle: 'Shorter paths and more room to begin.', thoughtful: 'More bends and paths to clear in the right order.', tangled: 'Longer winding paths, with deeper blocking chains.' }[$('#image-difficulty').value]; changed(); });
$('#image-detail').addEventListener('change', changed);
$('#create-image-puzzle').addEventListener('click', generate);
$('#shuffle-picture').addEventListener('click', () => { variation++; generate(); });
$('#another-picture-layout').addEventListener('click', () => { variation++; generate(); });
$('#choose-new-picture').addEventListener('click', () => $('#image-file').click());
$('#image-undo').addEventListener('click', undo); $('#image-restart').addEventListener('click', restart); $('#image-hint').addEventListener('click', hint);
$('#show-original').addEventListener('click', () => { scene.reference = !scene.reference; scene.render(); update(); status(scene.reference ? 'The original picture. Switch back to arrows to keep playing.' : 'Tap an arrow with a clear path to the edge.'); });
$('#picture-zoom-in').addEventListener('click', () => scene.setZoom(scene.zoom * 1.3)); $('#picture-zoom-out').addEventListener('click', () => scene.setZoom(scene.zoom / 1.3)); $('#picture-fit').addEventListener('click', () => scene.fit());
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const key = e.key.toLowerCase();
  if (key === 'h') { e.preventDefault(); hint(); }
  if (key === 'u') { e.preventDefault(); undo(); }
  if (key === 'r') { e.preventDefault(); restart(); }
  if (key === 'enter' && selected !== null && (e.target.tagName !== 'BUTTON' || e.target.id === 'image-hint')) { e.preventDefault(); release(selected); }
});
async function boot() {
  update();
  try {
    const saved = await readImageSave(); if (importing) return;
    if (saved) {
      if (!saved.level.cols || !saved.level.rows || !Array.isArray(saved.level.arrows) || !saved.level.arrows.length) throw new Error('Invalid save');
      const token = importing, blob = await (await fetch(saved.source.dataUrl)).blob();
      if (token !== importing) return;
      const restored = await importBlob(blob, saved.source.name, { restoring: true });
      if (!restored || source !== restored) return;
      crop = saved.crop; variation = saved.variation; $('#image-difficulty').value = saved.difficulty; $('#image-detail').value = saved.detail; drawCrop();
      document.querySelectorAll('[data-crop]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.crop === 'whole' && crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1)));
      if (saved.level.arrows.some(a => a.cells.length < MIN_IMAGE_ARROW_CELLS)) { generate(); return; }
      game = new ImagePuzzleGame(saved.level, saved.history); active = saved; scene.load(game, cropCanvas());
      $('#puzzle-title').textContent = source.name.replace(/\.[a-z\d]+$/i, ''); $('#puzzle-settings').textContent = `${IMAGE_DIFFICULTIES[saved.difficulty].label} · ${saved.detail} detail`;
      update(); status('Your picture is right where you left it.'); sourceStatus('Restored from this device. Choose a new crop whenever you like.'); return;
    }
  } catch { /* A missing or unavailable save never prevents a new puzzle. */ }
  if (!importing) await sampleImage();
}
if (import.meta.env.DEV) window.__pictureDebug = { get game() { return game; }, get source() { return source; }, get crop() { return crop; }, get worker() { return worker; }, scene, get saving() { return saveQueue; } };
boot();
