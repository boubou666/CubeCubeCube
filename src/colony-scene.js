import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS } from './colony-puzzle.js';

export class ColonyScene {
  constructor(container, onPick) {
    this.container = container; this.onPick = onPick; this.ants = new Map(); this.materials = [];
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-6, 6, 6, -6, .1, 100);
    this.camera.position.set(0, 18, 11); this.camera.lookAt(0, 0, .2);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const canvas = this.renderer.domElement; canvas.id = 'colony-canvas'; canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Plateau 3D de la colonie. Les fourmis ramassent les cubes et les rapportent au nid.');
    container.append(canvas);
    this.scene.add(new THREE.HemisphereLight(0xfff5dd, 0x7d9f8d, 2.8));
    const light = new THREE.DirectionalLight(0xfff4dd, 3); light.position.set(-5, 12, 5); light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024); Object.assign(light.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); light.shadow.bias = -.0005;
    this.scene.add(light);
    this.rounded = new RoundedBoxGeometry(1, 1, 1, 2, .08);
    this.sphere = new THREE.SphereGeometry(1, 10, 8); this.legGeo = new THREE.CylinderGeometry(.018, .018, 1, 5);
    this.cubeGeo = new RoundedBoxGeometry(.45, .37, .45, 2, .035);
    this.colorMaterials = Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, this.material(c.hex)]));
    this.dark = this.material('#354641'); this.eye = this.material('#fefbe8'); this.legMat = this.material('#344741');
    this.antPaint = this.material('#ffffff'); this.antParts = [];
    this.tray = new THREE.Group(); this.scene.add(this.tray);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), this.material('#eff0e3')); ground.rotation.x = -Math.PI / 2; ground.position.y = -.22; ground.receiveShadow = true; this.scene.add(ground);
    // Small paper-like garden decorations, built from geometry.
    for (const [x, z, r] of [[-5, -3, .6], [5, 1, -.8], [-4.7, 5, .4]]) {
      const leaf = new THREE.Mesh(this.sphere, this.material('#bacbaa')); leaf.scale.set(.4, .045, .75); leaf.rotation.y = r; leaf.position.set(x, -.1, z); this.scene.add(leaf);
    }
    this.ray = new THREE.Raycaster();
    canvas.addEventListener('click', event => {
      if (!this.cubes) return;
      const rect = canvas.getBoundingClientRect(); this.ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
      const hit = this.ray.intersectObject(this.cubes)[0];
      if (hit && this.game.state.remaining.includes(hit.instanceId)) this.onPick?.(this.game.level.cells[hit.instanceId]);
    });
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container); this.resize();
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); container.dispatchEvent(new CustomEvent('colony-render-error')); });
  }
  material(color) { const m = new THREE.MeshStandardMaterial({ color, roughness: .74 }); this.materials.push(m); return m; }
  box(parent, position, size, mat) {
    const mesh = new THREE.Mesh(this.rounded, mat); mesh.position.set(...position); mesh.scale.set(...size); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  point(x, y) { const { width, height } = this.game.level, cell = 7.68 / Math.max(width, height); return new THREE.Vector3((x - (width - 1) / 2) * cell, .08, (y - (height - 1) / 2) * cell - 1); }
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h); const aspect = w / h, height = Math.max(11.4, 10.5 / aspect);
    this.camera.left = -height * aspect / 2; this.camera.right = height * aspect / 2; this.camera.top = height / 2; this.camera.bottom = -height / 2; this.camera.updateProjectionMatrix();
  }
  setGame(game) {
    this.game = game;
    this.initAntInstances(game.level.cells.length);
    for (const { group } of this.ants.values()) this.scene.remove(group); this.ants.clear();
    if (this.cubes) { this.scene.remove(this.cubes); this.cubes.dispose(); }
    for (const child of [...this.tray.children]) {
      this.tray.remove(child);
      if (child.isInstancedMesh) child.dispose();
      if (child.geometry && ![this.rounded, this.cubeGeo].includes(child.geometry)) child.geometry.dispose();
    }
    const wood = this.frameMat ||= this.material('#d4c5a4'), paper = this.paperMat ||= this.material('#fdf6df');
    this.box(this.tray, [0, -.12, -1], [8.32, .18, 8.32], wood);
    this.box(this.tray, [0, -.01, -1], [7.83, .12, 7.83], paper);
    this.box(this.tray, [-4.03, .13, -1], [.16, .38, 8.23], wood); this.box(this.tray, [4.03, .13, -1], [.16, .38, 8.23], wood);
    this.box(this.tray, [0, .13, -5.03], [8.23, .38, .16], wood); this.box(this.tray, [0, .13, 3.03], [8.23, .38, .16], wood);
    const n = game.level.cells.length, matrix = new THREE.Matrix4(), cellScale = 16 / game.level.width;
    const backing = new THREE.InstancedMesh(this.cubeGeo, this.backingMat ||= this.material('#ffffff'), n);
    game.level.cells.forEach((c, id) => {
      const p = this.point(id % game.level.width, Math.floor(id / game.level.width)); p.y = .015;
      matrix.compose(p, new THREE.Quaternion(), new THREE.Vector3(cellScale, .03, cellScale)); backing.setMatrixAt(id, matrix);
      backing.setColorAt(id, new THREE.Color(COLORS[c].hex).lerp(new THREE.Color('#fff5df'), .68));
    }); this.tray.add(backing);
    this.cubes = new THREE.InstancedMesh(this.cubeGeo, this.cubeMat ||= this.material('#ffffff'), n); this.cubes.castShadow = true; this.cubes.receiveShadow = true;
    game.level.cells.forEach((c, id) => this.cubes.setColorAt(id, new THREE.Color(COLORS[c].hex))); this.scene.add(this.cubes);
    const nest = new THREE.Mesh(new THREE.CylinderGeometry(.45, .53, .035, 32), this.dark); nest.position.set(0, -.03, 4.13); this.tray.add(nest);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .12, 32), wood); lid.position.set(.74, .02, 4.27); lid.rotation.z = .15; this.tray.add(lid);
    this.sync();
  }
  sync() {
    if (!this.game) return;
    const ids = new Set(this.game.state.remaining), matrix = new THREE.Matrix4(), scale = 16 / this.game.level.width;
    this.game.level.cells.forEach((c, id) => {
      const p = this.point(id % this.game.level.width, Math.floor(id / this.game.level.width)); p.y = .245;
      matrix.compose(p, new THREE.Quaternion(), new THREE.Vector3(ids.has(id) ? scale : 0, ids.has(id) ? 1 : 0, ids.has(id) ? scale : 0)); this.cubes.setMatrixAt(id, matrix);
    }); this.cubes.instanceMatrix.needsUpdate = true; this.cubes.computeBoundingSphere();
  }
  makeAnt(job) {
    const group = new THREE.Object3D(); group.scale.setScalar(16 / this.game.level.width);
    const route = [new THREE.Vector3((job.slot - 2) * .46, .08, 4.5), new THREE.Vector3(0, .08, 4.13), ...job.route.map(p => this.point(...p))];
    route.at(-1).y = .4;
    // Each route follows actual outside-connected empty cells.
    const lengths = [0]; for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + route[i].distanceTo(route[i - 1]));
    return { group, route, lengths, distance: lengths.at(-1) };
  }
  initAntInstances(capacity) {
    for (const part of this.antParts) { this.scene.remove(part.mesh); part.mesh.dispose(); }
    this.antParts = [];
    const part = (geometry, position, scale, rotation = [0, 0, 0], options = {}) => {
      const mesh = new THREE.InstancedMesh(geometry, options.material || this.antPaint, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = Boolean(options.shadow);
      const transform = new THREE.Object3D(); transform.position.set(...position); transform.scale.set(...scale); transform.rotation.set(...rotation);
      if (!options.material) { mesh.setColorAt(0, new THREE.Color('#ffffff')); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      this.scene.add(mesh); this.antParts.push({ mesh, transform, painted: !options.material, ...options });
    };
    part(this.sphere, [0, .1, -.13], [.09, .08, .12], undefined, { shadow: true });
    part(this.sphere, [0, .1, .01], [.055, .06, .07]); part(this.sphere, [0, .1, .12], [.08, .065, .075]);
    for (const side of [-1, 1]) part(this.sphere, [side * .041, .1, .16], [.021, .024, .021], undefined, { material: this.eye });
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) part(this.legGeo, [side * .092, .055, -.08 + i * .075], [1, .19, 1], [(i - 1) * .6, 0, side * 1.1], { material: this.legMat, leg: this.antParts.length });
    for (const side of [-1, 1]) part(this.legGeo, [side * .046, .12, .215], [.7, .12, .7], [.9, 0, side * .5]);
    part(this.cubeGeo, [0, .28, .1], [.58, .58, .58], undefined, { cargo: true, shadow: true });
    this.antMatrix ||= new THREE.Matrix4();
  }
  render(time) {
    const live = new Set(this.game.state.jobs.map(j => j.id));
    for (const [id, ant] of this.ants) if (!live.has(id)) { this.scene.remove(ant.group); this.ants.delete(id); }
    let instance = 0;
    for (const job of this.game.state.jobs) {
      if (!this.ants.has(job.id)) this.ants.set(job.id, this.makeAnt(job));
      const ant = this.ants.get(job.id), progress = Math.min(1, job.elapsed / job.duration), returning = progress >= .5;
      const distance = ant.distance * (returning ? (1 - progress) * 2 : progress * 2);
      let i = 1; while (i < ant.lengths.length - 1 && ant.lengths[i] < distance) i++;
      const t = (distance - ant.lengths[i - 1]) / Math.max(.001, ant.lengths[i] - ant.lengths[i - 1]);
      ant.group.position.copy(ant.route[i - 1]).lerp(ant.route[i], t); const direction = ant.route[i].clone().sub(ant.route[i - 1]);
      ant.group.rotation.y = Math.atan2(direction.x, direction.z) + (returning ? Math.PI : 0);
      ant.group.position.y += this.reducedMotion ? 0 : Math.sin(time * 22 + job.id) * .012; ant.group.updateMatrix();
      for (const part of this.antParts) {
        if (part.leg !== undefined) part.transform.rotation.x = this.reducedMotion ? 0 : Math.sin(time * 25 + part.leg * Math.PI + job.id) * .4;
        if (part.cargo) part.transform.scale.setScalar(job.picked ? .58 : 0);
        part.transform.updateMatrix(); this.antMatrix.multiplyMatrices(ant.group.matrix, part.transform.matrix); part.mesh.setMatrixAt(instance, this.antMatrix);
        if (part.painted) part.mesh.setColorAt(instance, this.colorMaterials[job.color].color);
      }
      instance++;
    }
    for (const part of this.antParts) { part.mesh.count = instance; part.mesh.instanceMatrix.needsUpdate = true; if (part.painted) part.mesh.instanceColor.needsUpdate = true; }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.resizeObserver.disconnect(); this.rounded.dispose(); this.sphere.dispose(); this.legGeo.dispose(); this.cubeGeo.dispose();
    this.scene.traverse(o => { if (o.geometry && ![this.rounded, this.sphere, this.legGeo, this.cubeGeo].includes(o.geometry)) o.geometry.dispose(); });
    this.materials.forEach(m => m.dispose()); this.renderer.dispose();
  }
}
