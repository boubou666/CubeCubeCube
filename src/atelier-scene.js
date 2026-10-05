import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS } from './pocket-core.js';

export class AtelierScene {
  constructor(container, callbacks) {
    this.callbacks = callbacks; this.renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.renderer.setClearColor(0, 0); this.renderer.shadowMap.enabled = true;
    this.canvas = this.renderer.domElement; this.canvas.id = 'pocket-canvas'; this.canvas.tabIndex = 0; this.canvas.setAttribute('aria-label', 'Assemblage 3D : cliquez une vis, faites glisser pour tourner'); container.prepend(this.canvas);
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(34, 1, .1, 100); this.camera.position.set(7, 11, 14);
    this.controls = new OrbitControls(this.camera, this.canvas); this.controls.target.set(0, 1, 0); this.controls.enableDamping = true; this.controls.enablePan = false; this.controls.minDistance = 9; this.controls.maxDistance = 26; this.controls.maxPolarAngle = Math.PI * .48;
    this.scene.add(new THREE.HemisphereLight(0xfff9e7, 0x6d8868, 2.6)); const light = new THREE.DirectionalLight(0xfff8e8, 3); light.position.set(-5, 12, 7); light.castShadow = true; light.shadow.mapSize.set(1024, 1024); Object.assign(light.shadow.camera, { left:-9, right:9, top:9, bottom:-9 }); this.scene.add(light);
    this.root = new THREE.Group(); this.scene.add(this.root); this.raycaster = new THREE.Raycaster(); this.effects = []; this.screws = new Map(); this.plates = new Map();
    this.canvas.addEventListener('pointerdown', e => { this.down = [e.clientX, e.clientY]; this.canvas.focus({ preventScroll:true }); });
    this.canvas.addEventListener('pointerup', e => {
      if (!this.down || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 6 || !this.callbacks.enabled()) return;
      const rect = this.canvas.getBoundingClientRect(); this.raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.x) / rect.width * 2 - 1, -(e.clientY - rect.y) / rect.height * 2 + 1), this.camera);
      const hit = this.raycaster.intersectObjects(this.root.children, true)[0]; let object = hit?.object;
      while (object && object.userData.screw === undefined) object = object.parent;
      if (object) this.callbacks.screw(object.userData.screw);
    });
    this.canvas.addEventListener('pointercancel', () => { this.down = null; });
    this.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.callbacks.error?.(); });
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
    const loop = () => {
      this.frame = requestAnimationFrame(loop); if (document.hidden) return;
      const now = performance.now();
      for (const fx of this.effects) {
        const t = Math.max(0, Math.min(1, (now - fx.start) / fx.duration)), ease = t * t;
        fx.mesh.position.y = fx.y + ease * 3.2; fx.mesh.position.x = fx.x + ease * (fx.plate ? 3.5 : .8); fx.mesh.rotation.y = ease * Math.PI * (fx.plate ? .7 : 7); fx.mesh.scale.setScalar(1 - ease * .8);
        if (t === 1) { this.root.remove(fx.mesh); this.disposeObject(fx.mesh); }
      }
      this.effects = this.effects.filter(fx => now - fx.start < fx.duration);
      this.controls.update(); this.renderer.render(this.scene, this.camera);
    }; loop();
  }
  disposeObject(object) { object.traverse(mesh => { mesh.geometry?.dispose(); if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose(); }); }
  material(color, metalness = 0) { return new THREE.MeshStandardMaterial({ color, roughness: metalness ? .33 : .72, metalness }); }
  plateGeometry(index) {
    const profile = index % 6;
    if (profile === 0) return new RoundedBoxGeometry(3.15, .30, 2.5, 4, .14);
    const shape = new THREE.Shape();
    if (profile === 1) shape.absellipse(0, 0, 1.6, 1.30, 0, Math.PI * 2, false, 0);
    else if (profile === 5) {
      for (let n = 0; n <= 72; n++) { const angle = n / 72 * Math.PI * 2, radius = 1.35 + .13 * Math.cos(angle * 6), x = Math.cos(angle) * radius * 1.1, y = Math.sin(angle) * radius; if (!n) shape.moveTo(x,y); else shape.lineTo(x,y); }
    } else {
      const points = profile === 2 ? [[-1.6,0],[-.95,-1.25],[.95,-1.25],[1.6,0],[.95,1.25],[-.95,1.25]] : profile === 3 ? [[-1.5,-.85],[1.5,-.85],[1.5,.6],[0,1.4],[-1.5,.6]] : [[-1.6,-.85],[1.6,-.85],[1.2,.8],[0,1.25],[-1.2,.8]];
      points.forEach(([x,y], i) => i ? shape.lineTo(x,y) : shape.moveTo(x,y)); shape.closePath();
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth:.22, bevelEnabled:true, bevelThickness:.04, bevelSize:.06, bevelSegments:3, steps:1, curveSegments:40 });
    geo.rotateX(Math.PI / 2); geo.translate(0,.11,0); return geo;
  }
  mesh(geometry, material, parent, x=0, y=0, z=0) { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
  rebuild(level, state) {
    for (const child of [...this.root.children]) { this.root.remove(child); this.disposeObject(child); }
    this.effects = []; this.screws.clear(); this.plates.clear();
    this.mesh(new RoundedBoxGeometry(level.stacks * 3.5 + .5, .25, 4.1, 3, .13), this.material('#cebd98'), this.root, 0, -.18, 0);
    this.mesh(new RoundedBoxGeometry(level.stacks * 3.5 + .2, .07, 3.75, 3, .12), this.material('#e3d6b8'), this.root, 0, 0, 0);
    for (const plate of level.plates) {
      if (plate.screws.every(id => state.removed.includes(id))) continue;
      const group = new THREE.Group(), x = (plate.stack - (level.stacks - 1) / 2) * 3.5, y = .3 + plate.layer * .48;
      group.position.set(x, y, 0); this.root.add(group); this.plates.set(plate.id, group);
      const body = this.mesh(this.plateGeometry(level.index), this.material(['#b4c6a3', '#e4cf9f', '#b1ccd0', '#c7b3cf'][plate.style]), group);
      body.userData.plate = plate.id;
      for (let j = 0; j < 3; j++) {
        this.mesh(new THREE.CylinderGeometry(.19, .19, .31, 24), this.material('#9aa386'), group, (j - 1) * .92, .01, j % 2 ? .42 : -.42);
      }
      for (const id of plate.screws) {
        if (state.removed.includes(id)) continue;
        const screw = level.screws[id], head = new THREE.Group(), sx = x + (screw.position - 1) * .92, sz = screw.position % 2 ? .42 : -.42;
        head.position.set(sx, y + .25, sz); head.userData.screw = id; this.root.add(head); this.screws.set(id, head);
        this.mesh(new THREE.CylinderGeometry(.12, .12, .40, 16), this.material('#a6a59a', .55), head, 0, -.15, 0);
        this.mesh(new THREE.CylinderGeometry(.30, .30, .16, 32), this.material(COLORS[screw.color].hex, .3), head);
        this.mesh(new THREE.BoxGeometry(.30, .014, .05), this.material('#456152'), head, 0, .088, 0);
        this.mesh(new THREE.BoxGeometry(.05, .014, .30), this.material('#456152'), head, 0, .09, 0);
      }
    }
    this.scene.updateMatrixWorld(true);
  }
  update(level, state, hint, selected, previous) {
    const rebuild = this.reduced || !previous || !this.level || this.level.index !== level.index; this.level = level; this.state = state;
    if (rebuild) this.rebuild(level, state);
    else {
      for (const id of state.removed) if (!previous.removed.includes(id)) {
        const head = this.screws.get(id); if (!head) continue; this.screws.delete(id); head.userData = {}; this.effects.push({ mesh:head, x:head.position.x, y:head.position.y, start:performance.now(), duration:500 });
      }
      for (const plate of level.plates) if (plate.screws.every(id => state.removed.includes(id)) && this.plates.has(plate.id)) {
        const mesh = this.plates.get(plate.id); this.plates.delete(plate.id); this.effects.push({ mesh, plate:true, x:mesh.position.x, y:mesh.position.y, start:performance.now() + 130, duration:650 });
      }
    }
    for (const [id, group] of this.screws) group.traverse(mesh => {
      if (mesh.material) { mesh.material.emissive?.set(hint?.action === id ? '#907f38' : '#000000'); mesh.material.emissiveIntensity = hint?.action === id ? .7 : 0; }
    });
  }
  resize() { const rect = this.canvas.parentElement.getBoundingClientRect(); this.camera.aspect = rect.width / rect.height; this.camera.updateProjectionMatrix(); this.renderer.setSize(rect.width, rect.height, false); }
  resetView() { this.camera.position.set(7, 11, 14); this.controls.target.set(0, 1, 0); this.controls.update(); }
  screenPoint(id) { const mesh = this.screws.get(id); if (!mesh) return null; this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld(); const point = mesh.getWorldPosition(new THREE.Vector3()).project(this.camera), rect = this.canvas.getBoundingClientRect(); return { x:rect.x + (point.x + 1) * rect.width / 2, y:rect.y + (1 - point.y) * rect.height / 2 }; }
  dispose() { cancelAnimationFrame(this.frame); this.observer.disconnect(); this.controls.dispose(); this.disposeObject(this.root); this.renderer.dispose(); }
}
