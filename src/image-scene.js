const rgb = colour => `rgb(${colour.join(' ')})`;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function polyline(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  return { points, lengths, length: lengths.at(-1) };
}
function at(path, d) {
  d = Math.max(0, Math.min(path.length, d));
  let i = 1;
  while (i < path.lengths.length - 1 && path.lengths[i] < d) i++;
  const t = (d - path.lengths[i - 1]) / (path.lengths[i] - path.lengths[i - 1] || 1);
  return path.points[i - 1].map((v, axis) => v + (path.points[i][axis] - v) * t);
}
function slice(path, start, end) {
  return [at(path, start), ...path.points.filter((_, i) => path.lengths[i] > start && path.lengths[i] < end), at(path, end)];
}
function stroke(ctx, points) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
}
function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return distance(p, [a[0] + dx * t, a[1] + dy * t]);
}

export class ImageScene {
  constructor(canvas, { onPick, onSettled }) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.onPick = onPick; this.onSettled = onSettled;
    this.animations = new Map(); this.effects = new Map(); this.paths = new Map(); this.zoom = 1; this.pan = [0, 0]; this.selected = null; this.reference = false;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    this.bind(); this.resize();
  }
  get busy() { return this.animations.size > 0; }
  resize() {
    const rect = this.canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    this.width = rect.width; this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr); this.canvas.height = Math.round(rect.height * dpr); this.dpr = dpr;
    this.render();
  }
  load(game, image) {
    this.game = game; this.image = image; this.animations.clear(); this.effects.clear(); this.selected = null; this.reference = false;
    this.paths = new Map(game.level.arrows.map(a => {
      let points = a.cells.map(([x, y]) => [x + 0.5, y + 0.5]);
      if (points.length === 1) { const p = points[0], d = a.direction; points = [p.map((v, i) => v - d[i] * 0.25), p.map((v, i) => v + d[i] * 0.1)]; }
      return [a.id, polyline(points)];
    }));
    this.fit();
  }
  fit() { this.zoom = 1; this.pan = [0, 0]; this.render(); }
  transform() {
    if (!this.game) return { unit: 1, offset: [0, 0] };
    const { cols, rows } = this.game.level;
    const unit = Math.min((this.width - 32) / cols, (this.height - 32) / rows) * this.zoom;
    return { unit, offset: [(this.width - cols * unit) / 2 + this.pan[0], (this.height - rows * unit) / 2 + this.pan[1]] };
  }
  world(x, y) { const { unit, offset } = this.transform(); return [(x - offset[0]) / unit, (y - offset[1]) / unit]; }
  setZoom(zoom, anchor = [this.width / 2, this.height / 2]) {
    const point = this.world(...anchor); this.zoom = Math.min(5, Math.max(1, zoom));
    const { unit, offset } = this.transform(); this.pan[0] += anchor[0] - (offset[0] + point[0] * unit); this.pan[1] += anchor[1] - (offset[1] + point[1] * unit); this.render();
  }
  hit(x, y) {
    if (!this.game || this.reference) return null;
    const point = this.world(x, y);
    for (const arrow of this.game.level.arrows) {
      if (this.game.removed.has(arrow.id)) continue;
      const path = this.paths.get(arrow.id);
      if (path.points.some((p, i) => i && segmentDistance(point, path.points[i - 1], p) < 0.46)) return arrow.id;
      if (distance(point, path.points.at(-1)) < 0.5) return arrow.id;
    }
    return null;
  }
  screenPoint(id) {
    const path = this.paths.get(id); if (!path) return null;
    const { unit, offset } = this.transform(), rect = this.canvas.getBoundingClientRect(), p = path.points.at(-1);
    return { x: rect.left + offset[0] + p[0] * unit, y: rect.top + offset[1] + p[1] * unit };
  }
  bind() {
    let down = null, pinching = false;
    const pointers = new Map();
    const local = e => { const rect = this.canvas.getBoundingClientRect(); return [e.clientX - rect.left, e.clientY - rect.top]; };
    this.canvas.addEventListener('pointerdown', e => {
      this.canvas.focus(); this.canvas.setPointerCapture(e.pointerId); const p = local(e); pointers.set(e.pointerId, p);
      pinching = pointers.size > 1;
      down = { point: p, start: p, pan: [...this.pan], dragged: false };
    });
    this.canvas.addEventListener('pointermove', e => {
      const p = local(e);
      if (!pointers.has(e.pointerId)) { this.canvas.style.cursor = this.hit(...p) !== null ? 'pointer' : this.zoom > 1 ? 'grab' : 'default'; return; }
      const old = [...pointers.values()]; pointers.set(e.pointerId, p);
      if (pointers.size === 2) {
        const next = [...pointers.values()], before = distance(old[0], old[1]);
        if (before) this.setZoom(this.zoom * distance(next[0], next[1]) / before, next[0].map((v, i) => (v + next[1][i]) / 2));
        return;
      }
      if (down && !pinching) {
        down.dragged ||= distance(p, down.start) > 6;
        if (down.dragged && this.zoom > 1) { this.pan = p.map((v, i) => down.pan[i] + v - down.start[i]); this.render(); }
      }
    });
    this.canvas.addEventListener('pointerup', e => {
      if (!pinching && down && !down.dragged) { const id = this.hit(...local(e)); if (id !== null) this.onPick(id); }
      pointers.delete(e.pointerId); if (!pointers.size) { down = null; pinching = false; }
    });
    this.canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); down = null; });
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.0015), local(e)); }, { passive: false });
  }
  hint(id) {
    this.selected = id;
    const path = this.paths.get(id);
    if (path) {
      const { unit, offset } = this.transform(), point = path.points.at(-1).map((v, i) => offset[i] + v * unit);
      if (point[0] < 20 || point[0] > this.width - 20 || point[1] < 20 || point[1] > this.height - 20) {
        this.pan[0] += this.width / 2 - point[0]; this.pan[1] += this.height / 2 - point[1];
      }
    }
    this.render();
  }
  blocked(id, blockers) { for (const target of [id, ...blockers]) this.effects.set(target, performance.now() + 650); this.render(); }
  cancel() { this.animations.clear(); this.effects.clear(); this.selected = null; this.render(); }
  leave(arrow) {
    const path = this.paths.get(arrow.id), head = path.points.at(-1), direction = arrow.direction;
    const travel = Math.max(this.game.level.cols, this.game.level.rows) + path.length + 2;
    const extended = polyline([...path.points, head.map((v, i) => v + direction[i] * travel)]);
    this.animations.set(arrow.id, { path: extended, start: performance.now(), duration: this.reducedMotion ? 140 : 750, travel });
    this.selected = null; this.render();
  }
  render() { if (!this.frame) this.frame = requestAnimationFrame(this.draw); }
  draw = () => {
    this.frame = null;
    const now = performance.now(), ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.width, this.height);
    if (!this.game) return;
    for (const [id, animation] of this.animations) if (now - animation.start >= animation.duration) {
      this.animations.delete(id); if (!this.busy) this.onSettled?.();
    }
    for (const [id, until] of this.effects) if (now >= until) this.effects.delete(id);
    const { unit, offset } = this.transform(), { cols, rows } = this.game.level;
    ctx.save(); ctx.translate(...offset); ctx.scale(unit, unit);
    ctx.fillStyle = '#fffefa'; ctx.fillRect(0, 0, cols, rows);
    if (this.reference && this.image) { ctx.drawImage(this.image, 0, 0, cols, rows); ctx.restore(); return; }
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const arrow of this.game.level.arrows) {
      const animation = this.animations.get(arrow.id);
      if (this.game.removed.has(arrow.id) && !animation) continue;
      const original = this.paths.get(arrow.id), path = animation?.path ?? original;
      const progress = animation ? Math.min(1, (now - animation.start) / animation.duration) : 0;
      const shift = animation ? animation.travel * progress * progress * (3 - 2 * progress) : 0;
      const points = slice(path, shift, shift + original.length), marked = this.effects.has(arrow.id), selected = this.selected === arrow.id;
      ctx.strokeStyle = marked ? '#b65042' : selected ? '#a97727' : '#334b452f';
      ctx.lineWidth = selected || marked ? 0.82 : 0.68; stroke(ctx, points);
      const colours = arrow.colours.length > 1 ? arrow.colours : [arrow.colours[0], arrow.colours[0]];
      ctx.lineWidth = 0.59;
      for (let i = 1; i < original.points.length; i++) {
        const segment = slice(path, shift + original.lengths[i - 1], shift + original.lengths[i]);
        const a = segment[0], b = segment.at(-1), gradient = ctx.createLinearGradient(...a, ...b);
        gradient.addColorStop(0, rgb(colours[i - 1])); gradient.addColorStop(1, rgb(colours[i])); ctx.strokeStyle = gradient; stroke(ctx, segment);
      }
      const head = points.at(-1), before = at(path, shift + original.length - 0.03);
      const tangent = distance(head, before) > 0.0001 ? head.map((v, i) => (v - before[i]) / distance(head, before)) : arrow.direction;
      // The head direction stays exact at rest, including single-cell arrows.
      const d = animation ? tangent : arrow.direction, n = [-d[1], d[0]];
      ctx.beginPath(); ctx.moveTo(head[0] + d[0] * 0.43, head[1] + d[1] * 0.43);
      ctx.lineTo(head[0] - d[0] * 0.2 + n[0] * 0.37, head[1] - d[1] * 0.2 + n[1] * 0.37);
      ctx.lineTo(head[0] - d[0] * 0.2 - n[0] * 0.37, head[1] - d[1] * 0.2 - n[1] * 0.37); ctx.closePath();
      ctx.fillStyle = rgb(arrow.colours.at(-1)); ctx.fill(); ctx.lineWidth = selected || marked ? 0.12 : 0.035;
      ctx.strokeStyle = marked ? '#b65042' : selected ? '#a97727' : '#334b4570'; ctx.stroke();
    }
    ctx.restore();
    if (this.busy || this.effects.size) this.render();
  };
}
