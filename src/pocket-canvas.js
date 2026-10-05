import { COLORS } from './pocket-core.js';
const W = 640, H = 600;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
export class PocketCanvas {
  constructor(container, mode, callbacks) {
    this.mode = mode; this.callbacks = callbacks; this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; this.canvas = document.createElement('canvas');
    this.canvas.id = 'pocket-canvas'; this.canvas.tabIndex = 0; this.canvas.setAttribute('aria-label', mode === 'bobines' ? 'Les fils à démêler' : 'Jardin : choisissez une extrémité puis une case voisine, ou faites glisser');
    container.prepend(this.canvas); this.ctx = this.canvas.getContext('2d'); this.effects = []; this.frame = 0;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
    this.canvas.addEventListener('pointerdown', event => {
      if (this.mode !== 'escapade' || !this.callbacks.enabled()) return;
      this.canvas.focus({ preventScroll: true }); this.canvas.setPointerCapture(event.pointerId); this.dragging = true;
      const cell = this.cell(event); this.lastCell = cell?.join(','); if (cell) this.callbacks.cell(cell, false);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.dragging || !this.callbacks.enabled()) return;
      const cell = this.cell(event); if (cell && cell.join(',') !== this.lastCell) { this.lastCell = cell.join(','); this.callbacks.cell(cell, true); }
    });
    const release = () => { this.dragging = false; this.lastCell = null; };
    this.canvas.addEventListener('pointerup', release); this.canvas.addEventListener('pointercancel', release);
    const loop = () => { this.frame = requestAnimationFrame(loop); if (!document.hidden) this.draw(); }; loop();
  }
  resize() { const rect = this.canvas.parentElement.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); this.canvas.width = Math.round(rect.width * dpr); this.canvas.height = Math.round(rect.height * dpr); this.draw(); }
  update(level, state, hint, selected, previous) {
    this.level = level; this.state = state; this.hint = hint; this.selected = selected;
    if (previous && !this.reduced && this.mode === 'bobines') {
      const q = state.queues.findIndex((n, i) => n > previous.queues[i]), slot = previous.slots.indexOf(null), launched = q === -1 ? null : level.queues[q][previous.queues[q]];
      if (launched) this.effects.push({ bobbin:launched, slot, start:performance.now() });
      for (let col = 0; col < level.lines.length; col++) for (let row = previous.cursors[col]; row < state.cursors[col]; row++) {
        const color = level.lines[col][row], active = previous.slots.findIndex(s => s?.color === color), target = active === -1 ? slot : active;
        this.effects.push({ x: this.threadX(col), y: 100 + (row - previous.cursors[col]) * this.threadStep(), target:205 + Math.max(0, target) * 115, color, start: performance.now() });
      }
    }
    if (previous && !this.reduced && this.mode === 'escapade') {
      this.motion = { previous, start:performance.now() };
      for (const snake of previous.snakes) if (!state.snakes.some(s => s.id === snake.id)) this.effects.push({ snake, start: performance.now() });
    }
    if (!previous) { this.effects = []; this.motion = null; } this.draw();
  }
  threadX(col) { return 100 + col * (440 / Math.max(1, this.level.lines.length - 1)); }
  threadStep() { return Math.min(44, 345 / Math.max(...this.level.lines.map(l => l.length))); }
  grid() { const cell = 480 / this.level.size; return { cell, x:80, y:64 }; }
  screenPoint(cell) { const g = this.grid(), rect = this.canvas.getBoundingClientRect(); return { x:rect.x + (g.x + (cell[0] + .5) * g.cell) / W * rect.width, y:rect.y + (g.y + (cell[1] + .5) * g.cell) / H * rect.height }; }
  cell(event) { if (!this.level) return null; const rect = this.canvas.getBoundingClientRect(), g = this.grid(), x = Math.floor(((event.clientX - rect.left) / rect.width * W - g.x) / g.cell), y = Math.floor(((event.clientY - rect.top) / rect.height * H - g.y) / g.cell); return x >= 0 && y >= 0 && x < this.level.size && y < this.level.size ? [x, y] : null; }
  round(x, y, w, h, r, fill, stroke) { const c = this.ctx; c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); } }
  text(text, x, y, size = 12, color = '#69786d') { const c = this.ctx; c.fillStyle = color; c.font = `${size}px Segoe UI, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y); }
  bobbin(x, y, color, scale = 1) {
    const c = this.ctx; c.save(); c.translate(x, y); c.scale(scale, scale);
    this.round(-25, -27, 50, 10, 5, '#d0b98d'); this.round(-19, -19, 38, 37, 8, COLORS[color].hex);
    c.strokeStyle = '#ffffff6a'; c.lineWidth = 1.8; for (let n = -11; n < 18; n += 5) { c.beginPath(); c.moveTo(-16, n); c.quadraticCurveTo(0, n + 4, 16, n); c.stroke(); }
    this.round(-25, 18, 50, 10, 5, '#d0b98d'); this.text(COLORS[color].mark, 0, 0, 15, '#244c42'); c.restore();
  }
  drawThreads() {
    const c = this.ctx, level = this.level, step = this.threadStep();
    this.round(60, 63, 520, 399, 28, '#f7f6ea', '#d8decf');
    this.round(70, 70, 500, 15, 7, '#d6c39e'); this.round(70, 443, 500, 12, 6, '#d6c39e');
    for (let col = 0; col < level.lines.length; col++) {
      const x = this.threadX(col), remaining = level.lines[col].slice(this.state.cursors[col]);
      c.strokeStyle = '#d6ddcd'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, 82); c.lineTo(x, 441); c.stroke();
      remaining.forEach((color, row) => {
        const y = 108 + row * step;
        c.strokeStyle = COLORS[color].hex; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 18, y); c.bezierCurveTo(x - 34, y - 18, x + 34, y - 18, x + 18, y); c.bezierCurveTo(x + 34, y + 18, x - 34, y + 18, x - 18, y); c.stroke();
        c.strokeStyle = '#ffffff80'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 15, y - 6); c.quadraticCurveTo(x, y - 15, x + 14, y - 6); c.stroke();
        this.text(COLORS[color].mark, x, y, 11, '#34594c');
        if (row === 0) { c.strokeStyle = '#889c7c'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 29, 0, Math.PI * 2); c.stroke(); }
      });
      if (!remaining.length) this.text('✓', x, 109, 22, '#88a27b');
    }
    this.text('LES FILS ACCESSIBLES SONT EN HAUT', 320, 480, 10, '#8b977e');
    for (let slot = 0; slot < 3; slot++) {
      const x = 205 + slot * 115, winding = this.effects.find(fx => fx.bobbin && fx.slot === slot && performance.now() - fx.start < 620), bobbin = this.state.slots[slot];
      this.round(x - 37, 504, 74, 72, 16, '#e5ebde', '#d8dfd0');
      if (bobbin) { this.bobbin(x, 534, bobbin.color, .75); this.text(`${bobbin.remaining}`, x, 567, 10); }
      else if (winding) { c.save(); c.globalAlpha = 1 - Math.max(0, (performance.now() - winding.start - 460) / 160); this.bobbin(x, 534, winding.bobbin.color, .75 + Math.sin((performance.now() - winding.start) / 70) * .025); this.text('↻', x, 568, 13); c.restore(); }
      else this.text('·', x, 541, 32, '#a8b7a0');
    }
    for (const fx of this.effects) {
      if (fx.bobbin) continue;
      const t = Math.min(1, (performance.now() - fx.start) / 620); if (t >= 1) continue;
      const x = fx.x + (fx.target - fx.x) * t, y = fx.y + (530 - fx.y) * t;
      c.globalAlpha = 1 - t; c.strokeStyle = COLORS[fx.color].hex; c.lineWidth = 5; c.beginPath(); c.moveTo(fx.x, fx.y); c.bezierCurveTo(fx.x + 80 * Math.sin(t * Math.PI), y, x - 45, y + 20, x, y); c.stroke(); c.globalAlpha = 1;
    }
  }
  drawSnake(snake, alpha = 1) {
    const c = this.ctx, g = this.grid(), p = cell => [g.x + (cell[0] + .5) * g.cell, g.y + (cell[1] + .5) * g.cell];
    c.save(); c.globalAlpha = alpha; c.strokeStyle = '#39544316'; c.lineWidth = g.cell * .64; c.lineCap = c.lineJoin = 'round'; c.beginPath();
    snake.cells.forEach((cell, i) => { const [x, y] = p(cell); if (!i) c.moveTo(x + 1, y + 4); else c.lineTo(x + 1, y + 4); }); c.stroke();
    c.strokeStyle = COLORS[snake.color].hex; c.lineWidth = g.cell * .57; c.beginPath(); snake.cells.forEach((cell, i) => { const [x, y] = p(cell); if (!i) c.moveTo(x, y); else c.lineTo(x, y); }); c.stroke();
    for (let i = 1; i < snake.cells.length; i++) { const [x, y] = p(snake.cells[i]); c.fillStyle = '#fffaf32d'; c.beginPath(); c.arc(x, y, g.cell * .1, 0, 7); c.fill(); }
    for (const cell of [snake.cells[0], snake.cells.at(-1)]) { const [x, y] = p(cell); c.fillStyle = COLORS[snake.color].hex; c.beginPath(); c.arc(x, y, g.cell * .30, 0, 7); c.fill(); }
    const [x, y] = p(snake.cells[0]), second = p(snake.cells[1]), angle = Math.atan2(y - second[1], x - second[0]);
    c.save(); c.translate(x, y); c.rotate(angle); c.fillStyle = '#fbfcf5'; for (const offset of [-.13, .13]) { c.beginPath(); c.arc(g.cell * .11, g.cell * offset, g.cell * .09, 0, 7); c.fill(); }
    c.fillStyle = '#34514a'; for (const offset of [-.13, .13]) { c.beginPath(); c.arc(g.cell * .14, g.cell * offset, g.cell * .045, 0, 7); c.fill(); } c.restore();
    const tail = p(snake.cells.at(-1)); this.text(COLORS[snake.color].mark, tail[0], tail[1], Math.max(11, g.cell * .20), '#34514a');
    if (this.selected?.id === snake.id || this.hint?.action?.id === snake.id) {
      const end = this.hint?.action?.id === snake.id ? this.hint.action.end : this.selected.end, cell = end === 'tail' ? snake.cells.at(-1) : snake.cells[0], [hx, hy] = p(cell);
      c.strokeStyle = '#ac9250'; c.lineWidth = 3; c.setLineDash([5, 4]); c.beginPath(); c.arc(hx, hy, g.cell * .40, 0, 7); c.stroke(); c.setLineDash([]);
    }
    c.restore();
  }
  drawGarden() {
    const c = this.ctx, level = this.level, g = this.grid();
    this.round(g.x - 16, g.y - 16, 512, 512, 28, '#d9e2cd', '#ccd6c1');
    for (let y = 0; y < level.size; y++) for (let x = 0; x < level.size; x++) this.round(g.x + x * g.cell + 2, g.y + y * g.cell + 2, g.cell - 4, g.cell - 4, 9, (x + y) % 2 ? '#f1f3e7' : '#eaf0e0');
    for (const [x, y] of level.walls) { const sx = g.x + x * g.cell, sy = g.y + y * g.cell; this.round(sx + 7, sy + 7, g.cell - 14, g.cell - 14, 12, '#a3b391', '#93a581'); this.text('✳', sx + g.cell / 2, sy + g.cell / 2, 25, '#cad6b9'); }
    for (const snake of level.snakes) {
      const x = g.x + (snake.hole[0] + .5) * g.cell, y = g.y + (snake.hole[1] + .5) * g.cell;
      c.fillStyle = COLORS[snake.color].hex; c.beginPath(); c.arc(x, y, g.cell * .36, 0, 7); c.fill();
      c.fillStyle = '#40534b'; c.beginPath(); c.arc(x, y, g.cell * .25, 0, 7); c.fill(); this.text(this.state.snakes.some(s => s.id === snake.id) ? COLORS[snake.color].mark : '✓', x, y, g.cell * .22, '#fcfcf4');
    }
    const t = this.motion ? Math.min(1, (performance.now() - this.motion.start) / 120) : 1;
    for (const snake of this.state.snakes) {
      const before = this.motion?.previous.snakes.find(s => s.id === snake.id);
      this.drawSnake(t < 1 && before ? { ...snake, cells:snake.cells.map((p, i) => [before.cells[i][0] + (p[0] - before.cells[i][0]) * t, before.cells[i][1] + (p[1] - before.cells[i][1]) * t]) } : snake);
    }
    for (const fx of this.effects) if (fx.snake) {
      const t = Math.min(1, (performance.now() - fx.start) / 420); if (t < 1) this.drawSnake(fx.snake, 1 - t);
    }
    if (this.hint?.action) { const to = this.hint.action.to; this.round(g.x + to[0] * g.cell + 5, g.y + to[1] * g.cell + 5, g.cell - 10, g.cell - 10, 12, '#e9d59475', '#b39b5b'); this.text('→', g.x + (to[0] + .5) * g.cell, g.y + (to[1] + .5) * g.cell, 24, '#786633'); }
    this.text('UNE EXTRÉMITÉ, PUIS UNE CASE VOISINE', 320, 571, 10, '#829575');
  }
  draw() {
    if (!this.level || !this.canvas.width) return; const c = this.ctx;
    c.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0); c.clearRect(0, 0, W, H);
    this.effects = this.effects.filter(fx => performance.now() - fx.start < 700);
    if (this.mode === 'bobines') this.drawThreads(); else this.drawGarden();
  }
  dispose() { cancelAnimationFrame(this.frame); this.observer.disconnect(); }
}
