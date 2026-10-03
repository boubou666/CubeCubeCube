import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FACES, worldPoint, worldDirection, travelRoute, arrowEnd, orientArrow, surfaceLayout, ridgeSegments } from './puzzle.js';

const THEMES = {
  ivory: { cube: '#f6f1e5', ink: '#284e47', accents: ['#284e47', '#284e47', '#284e47', '#a46d51', '#6b8570'] },
  mint: { cube: '#dce9dc', ink: '#234f49', accents: ['#234f49', '#234f49', '#54796c', '#8a6c4f', '#234f49'] },
  dusk: { cube: '#d6d1e1', ink: '#514962', accents: ['#514962', '#514962', '#766187', '#9a6670', '#514962'] },
};
const vec = values => new THREE.Vector3(...values);
const HOME = new THREE.Vector3(6.8, 5.7, 7.6);

function setTipOrientation(tip, direction, normal) {
  if (direction.lengthSq() < 1e-8) return;
  const tangent = direction.clone().normalize();
  const up = normal.clone().addScaledVector(tangent, -normal.dot(tangent)).normalize();
  if (up.lengthSq() < 1e-8) up.set(Math.abs(tangent.x) < 0.8 ? 1 : 0, Math.abs(tangent.x) < 0.8 ? 0 : 1, 0).addScaledVector(tangent, -up.dot(tangent)).normalize();
  tip.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent.clone().cross(up), tangent, up));
}

function surfaceNormal(point) {
  return point.clone().sub(point.clone().clampScalar(-1.69, 1.69)).normalize();
}

function roundedPoints(points, radius = 0.13) {
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const r = Math.min(radius, a.distanceTo(b) * 0.3, b.distanceTo(c) * 0.3);
    const before = b.clone().lerp(a, r / a.distanceTo(b));
    const after = b.clone().lerp(c, r / b.distanceTo(c));
    result.push(before);
    for (let j = 1; j <= 5; j++) {
      const t = j / 5;
      result.push(before.clone().multiplyScalar((1 - t) ** 2).addScaledVector(b, 2 * t * (1 - t)).addScaledVector(after, t * t));
    }
  }
  result.push(points.at(-1));
  return result;
}

class Polyline extends THREE.Curve {
  constructor(points) {
    super(); this.points = points; this.distances = [0];
    for (let i = 1; i < points.length; i++) this.distances.push(this.distances[i - 1] + points[i].distanceTo(points[i - 1]));
    this.length = this.distances.at(-1);
  }
  atDistance(distance, target = new THREE.Vector3()) {
    distance = THREE.MathUtils.clamp(distance, 0, this.length);
    let i = 1;
    while (i < this.distances.length - 1 && this.distances[i] < distance) i++;
    const span = this.distances[i] - this.distances[i - 1];
    return target.copy(this.points[i - 1]).lerp(this.points[i], span ? (distance - this.distances[i - 1]) / span : 0);
  }
  getPoint(t, target) { return this.atDistance(t * this.length, target); }
}

class WindowCurve extends THREE.Curve {
  constructor(path, start, length) { super(); this.path = path; this.start = start; this.length = length; }
  getPoint(t, target) { return this.path.atDistance(this.start + t * this.length, target); }
}

function arrowPath(arrow, size) {
  const points = [];
  for (let i = 0; i < arrow.cells.length; i++) {
    const cell = arrow.cells[i], normal = vec(FACES[cell.face].normal);
    const point = vec(worldPoint(cell, size)).addScaledVector(normal, 0.055);
    if (i && arrow.cells[i - 1].face !== cell.face) {
      const previous = arrow.cells[i - 1], oldNormal = vec(FACES[previous.face].normal);
      const edge = point.clone();
      // Both incident normals meet just outside the rounded physical cube edge.
      for (let axis = 0; axis < 3; axis++) {
        if (oldNormal.getComponent(axis)) edge.setComponent(axis, worldPoint(previous, size)[axis] + oldNormal.getComponent(axis) * 0.055);
        if (normal.getComponent(axis)) edge.setComponent(axis, worldPoint(cell, size)[axis] + normal.getComponent(axis) * 0.055);
      }
      points.push(edge);
    }
    points.push(point);
  }
  return roundedPoints(points);
}

export class CubeScene {
  constructor(container, { onPick, onHover, onRotate, onReady }) {
    this.container = container; this.onPick = onPick; this.onHover = onHover;
    this.onRotate = onRotate; this.meshes = new Map(); this.animations = new Map(); this.effects = [];
    this.theme = 'ivory'; this.hintId = null; this.hoverId = null; this.frame = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-label', '3D arrow puzzle. Drag to rotate. Tap an arrow to release. Keyboard: arrow keys rotate, H finds a hint, Enter releases the hinted arrow.');
    canvas.setAttribute('tabindex', '0'); canvas.id = 'cube-canvas';
    container.append(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 60);
    this.camera.position.copy(HOME); this.camera.lookAt(0, 0, 0);
    // Keep the actual screen-up vector, rather than a fixed world-up axis.
    // Trackball rotation can then pass through either pole without clamping or flipping.
    this.camera.up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.controls = new TrackballControls(this.camera, canvas);
    this.controls.staticMoving = true; this.controls.noPan = true;
    this.controls.rotateSpeed = 1.3; this.controls.keys = [];
    this.controls.minZoom = 0.7; this.controls.maxZoom = 1.7;
    this.controls.addEventListener('start', () => { this.cameraTween = null; });
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xadb6a2, 2.65));
    const light = new THREE.DirectionalLight(0xffffff, 2.6); light.position.set(-3, 7, 5); this.scene.add(light);
    const fill = new THREE.DirectionalLight(0xd7e4ec, 0.6); fill.position.set(5, 1, -4); this.scene.add(fill);
    this.cube = new THREE.Mesh(new RoundedBoxGeometry(3.6, 3.6, 3.6, 4, 0.11), new THREE.MeshStandardMaterial({ color: THEMES.ivory.cube, roughness: 0.9, metalness: 0 }));
    this.scene.add(this.cube);
    this.ridges = new THREE.Group(); this.scene.add(this.ridges);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.arrowGeometry = new THREE.ShapeGeometry(new THREE.Shape().moveTo(0, 0.155).lineTo(-0.12, -0.105).quadraticCurveTo(0, -0.055, 0.12, -0.105).lineTo(0, 0.155));
    this.tailGeometry = new THREE.SphereGeometry(0.037, 8, 6);
    this.addShadow();
    this.bindPointer(canvas);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
    this.resize(); this.animate(); onReady?.();
  }

  addShadow() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(44,63,49,.18)'); gradient.addColorStop(0.4, 'rgba(44,63,49,.07)'); gradient.addColorStop(1, 'rgba(44,63,49,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -2.65; this.scene.add(shadow);
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const vertical = aspect < 1 ? 3.5 / aspect : 3.85;
    this.camera.left = -vertical * aspect; this.camera.right = vertical * aspect;
    this.camera.top = vertical; this.camera.bottom = -vertical;
    this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false);
    this.controls.handleResize();
  }

  bindPointer(canvas) {
    let down = null;
    const activePointers = new Set();
    canvas.addEventListener('pointerdown', e => {
      activePointers.add(e.pointerId);
      if (activePointers.size > 1) { down = null; return; }
      down = { x: e.clientX, y: e.clientY, time: performance.now(), dragged: false };
    });
    canvas.addEventListener('pointermove', e => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.dragged = true;
      if (e.buttons) { this.setHover(null); return; }
      const picked = this.pick(e.clientX, e.clientY); this.setHover(picked?.id ?? null);
      canvas.style.cursor = picked === null ? 'grab' : 'pointer';
    });
    canvas.addEventListener('pointerup', e => {
      if (activePointers.size === 1 && down && !down.dragged && performance.now() - down.time < 700) {
        const picked = this.pick(e.clientX, e.clientY); if (picked !== null) this.onPick(picked.id, picked.end);
      } else if (down?.dragged) this.onRotate?.();
      activePointers.delete(e.pointerId); down = null;
    });
    canvas.addEventListener('pointercancel', e => { activePointers.delete(e.pointerId); down = null; });
    canvas.addEventListener('pointerleave', () => this.setHover(null));
  }

  pick(x, y) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [this.cube];
    for (const [id, entry] of this.meshes) if (!this.animations.has(id)) {
      if (!entry.arrow.exited) targets.push(entry.hit, entry.tip);
      if (entry.otherTip && !entry.arrow.branch?.exited) targets.push(entry.otherTip);
      if (entry.branchHit && !entry.arrow.branch.exited) targets.push(entry.branchHit);
    }
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit || hit.object === this.cube) return null;
    const id = hit.object.userData.arrowId, entry = this.meshes.get(id);
    const end = entry.otherTip && hit.point.distanceToSquared(entry.otherTip.position) < hit.point.distanceToSquared(entry.tip.position) ? 1 : 0;
    return { id, end };
  }

  setHover(id) {
    if (id === this.hoverId) return;
    this.hoverId = id; this.onHover?.(id); this.paint();
  }

  load(level, removed, theme = this.theme) {
    this.level = level; this.animations.clear(); this.effects = []; this.hintId = this.hoverId = null;
    for (const entry of this.meshes.values()) this.disposeArrow(entry);
    this.meshes.clear(); this.theme = theme; this.cube.material.color.set(THEMES[theme].cube);
    this.drawSolid();
    this.drawRidges();
    for (const arrow of level.arrows) if (!removed.has(arrow.id)) this.addArrow(arrow);
  }

  drawSolid() {
    this.cube.geometry.dispose();
    this.surfaceSamples = surfaceLayout(this.level.size).cells.map(cell => ({ face: cell.face, point: vec(worldPoint(cell, this.level.size)).addScaledVector(vec(FACES[cell.face].normal), 0.055), normal: vec(FACES[cell.face].normal) }));
    if (typeof this.level.size === 'number') { this.cube.geometry = new RoundedBoxGeometry(3.6, 3.6, 3.6, 4, 0.11); return; }
    const layout = surfaceLayout(this.level.size);
    if (!this.level.size.hole && !this.level.size.heights && !this.level.size.terrace) {
      this.cube.geometry = new RoundedBoxGeometry(...layout.dimensions.map(n => n * layout.pitch), 4, 0.09); return;
    }
    const positions = [], normals = [];
    for (const cell of layout.cells) {
      const frame = FACES[cell.face], center = worldPoint(cell, this.level.size);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => center.map((p, axis) => p + (frame.u[axis] * u + frame.v[axis] * v) * layout.pitch / 2));
      for (const i of [0, 1, 2, 0, 2, 3]) { positions.push(...corners[i]); normals.push(...frame.normal); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.computeBoundingSphere(); this.cube.geometry = geometry;
  }

  normalAt(point) {
    if (typeof this.level.size === 'number') return surfaceNormal(point);
    let nearest = null, distance = Infinity;
    for (const sample of this.surfaceSamples) {
      const d = sample.point.distanceToSquared(point);
      if (d < distance) { nearest = sample; distance = d; }
    }
    const normal = nearest.normal.clone(), used = new Set([nearest.face]);
    for (const sample of this.surfaceSamples) {
      const difference = sample.point.distanceToSquared(point) - distance;
      if (!used.has(sample.face) && difference < 0.04) { normal.addScaledVector(sample.normal, 1 - difference / 0.04); used.add(sample.face); }
    }
    return normal.normalize();
  }

  drawRidges() {
    for (const child of [...this.ridges.children]) {
      child.geometry.dispose(); child.material.dispose(); this.ridges.remove(child);
    }
    for (const bridge of this.level.bridges ?? []) {
      for (const [a, b] of ridgeSegments(bridge.faces, this.level.size)) {
        const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(vec(a), vec(b)), 1, 0.046, 10, false), new THREE.MeshBasicMaterial({ color: bridge.color }));
        this.ridges.add(line);
      }
    }
    for (const cell of this.level.circles ?? []) {
      const normal = vec(FACES[cell.face].normal);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.023, 6, 24), new THREE.MeshBasicMaterial({ color: '#b3934d' }));
      ring.position.copy(vec(worldPoint(cell, this.level.size))).addScaledVector(normal, 0.055);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal); this.ridges.add(ring);
    }
  }

  addArrow(arrow) {
    const points = arrowPath(arrow, this.level.size), path = new Polyline(points);
    const group = new THREE.Group(); const color = THEMES[this.theme].accents[arrow.id % 5];
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true });
    const line = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(16, points.length * 3), 0.037, 7, false), material);
    const hit = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(16, points.length * 2), 0.105, 4, false), new THREE.MeshBasicMaterial({ visible: false }));
    const head = arrow.cells.at(-1); const direction = vec(worldDirection(head.face, arrow.direction));
    const normal = vec(FACES[head.face].normal);
    const tip = new THREE.Mesh(this.arrowGeometry, material.clone()); tip.position.copy(points.at(-1));
    const matrix = new THREE.Matrix4().makeBasis(direction.clone().cross(normal), direction, normal);
    tip.quaternion.setFromRotationMatrix(matrix);
    tip.userData.arrowId = hit.userData.arrowId = arrow.id;
    let tail = new THREE.Mesh(this.tailGeometry, material), otherTip = null, branchLine = null, branchHit = null;
    if (arrow.twoHeads || arrow.branch) {
      const second = arrowEnd(arrow, this.level.size, 1);
      otherTip = new THREE.Mesh(this.arrowGeometry, material.clone());
      otherTip.position.copy(vec(worldPoint(second.cell, this.level.size))).addScaledVector(vec(FACES[second.cell.face].normal), 0.055);
      setTipOrientation(otherTip, vec(worldDirection(second.cell.face, second.direction)), vec(FACES[second.cell.face].normal));
      otherTip.userData.arrowId = arrow.id;
      if (arrow.twoHeads) tail = otherTip;
      else {
        const branchPath = new Polyline(arrowPath(arrow.branch, this.level.size));
        branchLine = new THREE.Mesh(new THREE.TubeGeometry(branchPath, 48, 0.037, 7, false), material);
        branchHit = new THREE.Mesh(new THREE.TubeGeometry(branchPath, 36, 0.105, 4, false), new THREE.MeshBasicMaterial({ visible: false }));
        branchHit.userData.arrowId = arrow.id;
        group.add(branchLine, branchHit, otherTip);
      }
    }
    tail.position.copy(points[0]);
    group.add(line, hit, tip, tail); this.scene.add(group);
    if (arrow.exited) line.visible = hit.visible = tip.visible = tail.visible = false;
    if (arrow.branch?.exited) branchLine.visible = branchHit.visible = otherTip.visible = false;
    const entry = { arrow, group, line, hit, tip, tail, otherTip, branchLine, branchHit, material, path, direction, points, color };
    this.meshes.set(arrow.id, entry); this.paint(); return entry;
  }

  disposeArrow(entry) {
    this.scene.remove(entry.group); entry.line.geometry.dispose(); entry.hit.geometry.dispose();
    entry.hit.material.dispose(); entry.material.dispose();
    entry.tip.material.dispose(); entry.otherTip?.material.dispose();
    entry.branchLine?.geometry.dispose(); entry.branchHit?.geometry.dispose(); entry.branchHit?.material.dispose();
  }

  paint() {
    for (const [id, entry] of this.meshes) {
      const color = id === this.hintId ? '#cc913d' : id === this.hoverId ? '#65a391' : entry.color;
      entry.material.color.set(color);
      entry.tip.material.color.set(id === this.hintId && this.hintEnd === 1 && !entry.arrow.branch ? entry.color : color);
      entry.otherTip?.material.color.set(id === this.hintId && (this.hintEnd === 1 || entry.arrow.branch) ? '#cc913d' : id === this.hoverId ? '#65a391' : entry.color);
    }
  }

  setTheme(theme) {
    this.theme = theme; this.cube.material.color.set(THEMES[theme].cube);
    for (const [id, entry] of this.meshes) entry.color = THEMES[theme].accents[id % 5];
    this.paint();
  }

  hint(id, end = 0) {
    this.hintId = id; this.hintEnd = end; this.paint();
    if (id !== null) {
      const arrow = this.meshes.get(id)?.arrow; if (!arrow) return;
      const head = arrowEnd(arrow, this.level.size, end).cell;
      const f = FACES[head.face];
      const position = vec(f.normal).multiplyScalar(8).addScaledVector(vec(f.u), 3.8).addScaledVector(vec(f.v), 3.1);
      this.tweenCamera(position);
    }
  }

  tweenCamera(target) {
    const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(target, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)));
    this.cameraTween = {
      from: this.camera.quaternion.clone(), target: orientation,
      distance: this.camera.position.length(), start: performance.now(),
      duration: this.reducedMotion ? 1 : 650,
    };
  }
  resetView() { this.camera.zoom = 1; this.camera.updateProjectionMatrix(); this.tweenCamera(HOME.clone()); }
  rotate(dx, dy) {
    this.cameraTween = null;
    const yaw = new THREE.Quaternion().setFromAxisAngle(this.camera.up, dx);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).applyQuaternion(yaw);
    const rotation = new THREE.Quaternion().setFromAxisAngle(right, dy).multiply(yaw);
    this.camera.position.applyQuaternion(rotation); this.camera.up.applyQuaternion(rotation);
    this.controls.update(); this.onRotate?.();
  }

  motion(part, route) {
    const points = arrowPath(part, this.level.size), length = new Polyline(points).length;
    const continuation = arrowPath({ cells: route.states.map(s => s.cell) }, this.level.size);
    const last = route.states.at(-1), direction = vec(worldDirection(last.cell.face, last.direction));
    const surface = new Polyline([...points, ...continuation.slice(1)]);
    return {
      length, extended: route.stopped ? surface : new Polyline([...surface.points, surface.points.at(-1).clone().addScaledVector(direction, length + 13)]),
      distance: route.stopped ? surface.length - length : surface.length + 9,
      surfaceLength: surface.length, finalNormal: vec(FACES[last.cell.face].normal), stopped: route.stopped,
    };
  }

  remove(id, onDone, route, end = 0, updatedArrow = null, routes = null) {
    const entry = this.meshes.get(id);
    if (!entry) { onDone?.(); return; }
    if (this.hintId === id) this.hintId = null;
    if (this.hoverId === id) this.setHover(null);
    if (entry.arrow.branch) {
      routes ??= [0, 1].map(i => travelRoute(entry.arrow, this.level.size, this.level.bridges, i, this.level.circles));
      const legs = routes.map((r, i) => r ? {
        ...this.motion(i ? entry.arrow.branch : entry.arrow, r),
        line: i ? entry.branchLine : entry.line, tip: i ? entry.otherTip : entry.tip, tail: i ? null : entry.tail,
      } : null).filter(Boolean);
      this.animations.set(id, {
        start: performance.now(), duration: this.reducedMotion ? 160 : 1000 + Math.max(...legs.map(l => l.surfaceLength)) * 45,
        legs, onDone, updatedArrow,
      });
      return;
    }
    route ??= travelRoute(entry.arrow, this.level.size, this.level.bridges, end, this.level.circles);
    const { spine } = orientArrow(entry.arrow, this.level.size, end);
    const points = arrowPath(spine, this.level.size), path = new Polyline(points), length = path.length;
    const continuation = arrowPath({ cells: route.states.map(s => s.cell) }, this.level.size);
    const last = route.states.at(-1), direction = vec(worldDirection(last.cell.face, last.direction));
    const surface = new Polyline([...points, ...continuation.slice(1)]);
    const extended = route.stopped ? surface : new Polyline([...surface.points, surface.points.at(-1).clone().addScaledVector(direction, length + 13)]);
    this.animations.set(id, {
      start: performance.now(), duration: this.reducedMotion ? 160 : route.stopped ? 700 : 1000 + surface.length * 45,
      extended, length, distance: route.stopped ? surface.length - length : surface.length + 9,
      surfaceLength: surface.length, finalNormal: vec(FACES[last.cell.face].normal), end,
      onDone, updatedArrow,
    });
  }

  blocked(id, blockers) {
    for (const target of [id, ...blockers]) {
      const entry = this.meshes.get(target); if (!entry) continue;
      this.effects.push({ id: target, start: performance.now(), duration: 650, shake: target === id });
    }
  }

  restore(id) {
    const anim = this.animations.get(id); if (anim) this.animations.delete(id);
    const entry = this.meshes.get(id);
    if (entry) { this.disposeArrow(entry); this.meshes.delete(id); }
    this.addArrow(this.level.arrows.find(a => a.id === id));
  }

  animate = () => {
    this.frame = requestAnimationFrame(this.animate);
    const now = performance.now();
    if (this.cameraTween) {
      const t = Math.min(1, (now - this.cameraTween.start) / this.cameraTween.duration);
      // Slerp the entire orientation so both position and screen-up stay continuous,
      // including reset/hint transitions from an upside-down view.
      const orientation = this.cameraTween.from.clone().slerp(this.cameraTween.target, t * t * (3 - 2 * t));
      this.camera.position.set(0, 0, 1).applyQuaternion(orientation).multiplyScalar(this.cameraTween.distance);
      this.camera.up.set(0, 1, 0).applyQuaternion(orientation);
      if (t === 1) this.cameraTween = null;
    }
    this.controls.update();
    for (const [id, animation] of this.animations) {
      const entry = this.meshes.get(id); if (!entry) continue;
      const t = Math.min(1, (now - animation.start) / animation.duration);
      if (animation.legs) {
        for (const leg of animation.legs) {
          const distance = leg.distance * (t * t * (3 - 2 * t));
          leg.line.geometry.dispose();
          leg.line.geometry = new THREE.TubeGeometry(new WindowCurve(leg.extended, distance, leg.length), 48, 0.037, 7, false);
          const headDistance = distance + leg.length;
          leg.extended.atDistance(headDistance, leg.tip.position);
          const tangent = leg.extended.atDistance(headDistance + 0.035).sub(leg.extended.atDistance(headDistance - 0.035)).normalize();
          setTipOrientation(leg.tip, tangent, headDistance > leg.surfaceLength ? leg.finalNormal : this.normalAt(leg.tip.position));
          if (leg.tail) leg.extended.atDistance(distance, leg.tail.position);
          leg.line.visible = leg.tip.visible = leg.stopped || t < 1;
        }
      } else {
        const distance = animation.distance * (t * t * (3 - 2 * t));
        const slice = new WindowCurve(animation.extended, distance, animation.length);
        entry.line.geometry.dispose(); entry.line.geometry = new THREE.TubeGeometry(slice, 48, 0.037, 7, false);
        const movingTip = animation.end === 1 ? entry.otherTip : entry.tip;
        const headDistance = distance + animation.length;
        animation.extended.atDistance(headDistance, movingTip.position);
        const tangent = animation.extended.atDistance(headDistance + 0.035).sub(animation.extended.atDistance(headDistance - 0.035)).normalize();
        const headNormal = headDistance > animation.surfaceLength ? animation.finalNormal : this.normalAt(movingTip.position);
        setTipOrientation(movingTip, tangent, headNormal);
        const tail = animation.end === 1 ? entry.tip : entry.tail;
        animation.extended.atDistance(distance, tail.position);
        if (entry.otherTip) {
          const backwards = animation.extended.atDistance(distance + 0.035).sub(tail.position).negate().normalize();
          setTipOrientation(tail, backwards, distance > animation.surfaceLength ? animation.finalNormal : this.normalAt(tail.position));
        }
      }
      const opacity = animation.updatedArrow ? 1 : 1 - Math.max(0, (t - 0.7) / 0.3);
      entry.material.opacity = entry.tip.material.opacity = opacity;
      if (entry.otherTip) entry.otherTip.material.opacity = opacity;
      if (t === 1) {
        this.disposeArrow(entry); this.meshes.delete(id); this.animations.delete(id);
        if (animation.updatedArrow) this.addArrow(animation.updatedArrow);
        animation.onDone?.();
      }
    }
    if (this.effects.length) {
      this.paint();
      this.effects = this.effects.filter(effect => {
        const entry = this.meshes.get(effect.id); if (!entry) return false;
        const t = (now - effect.start) / effect.duration;
        if (t >= 1) { entry.group.position.set(0, 0, 0); return false; }
        entry.material.color.lerp(new THREE.Color('#cf665c'), Math.sin(t * Math.PI));
        if (effect.shake && !this.reducedMotion) entry.group.position.copy(entry.direction).multiplyScalar(Math.sin(t * Math.PI * 4) * 0.07 * (1 - t));
        return true;
      });
      if (!this.effects.length) this.paint();
    }
    if (this.hintId !== null && !this.effects.some(e => e.id === this.hintId)) {
      const entry = this.meshes.get(this.hintId);
      if (entry) entry.material.color.set('#bb822f').lerp(new THREE.Color('#ecc571'), (Math.sin(now / 240) + 1) * 0.25);
    }
    this.renderer.render(this.scene, this.camera);
  };

  // Used by browser integration tests to aim real pointer events at rendered arrows.
  screenPoint(id, end = 0) {
    const entry = this.meshes.get(id); if (!entry) return null;
    this.scene.updateMatrixWorld(); this.camera.updateMatrixWorld();
    const p = (end === 1 ? entry.otherTip : entry.tip).getWorldPosition(new THREE.Vector3()).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  }
}
