// Base dos modos AR: retícula no chão, posicionamento, escala, gestos e seleção por toque.
import * as THREE from 'three';
import gsap from 'gsap';

export const AR_SCALES = [
  { id: 'maquete', label: 'Maquete 1:500', scale: 1 / 500 },
  { id: 'mesa', label: 'Mesa 1:300', scale: 1 / 300 },
  { id: 'sala', label: 'Sala 1:150', scale: 1 / 150 },
];

export class ARBase {
  constructor(ctx) {
    this.ctx = ctx; // { hud, onPlaced, onTap, onExit, synth }
    this.placed = false;
    this.scaleId = 'mesa';
    this.reticle = this.#makeReticle();
    this.ownsProjection = false;
  }

  #makeReticle() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.12, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }),
    );
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(0.03, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xa66bff, transparent: true, opacity: 0.9, depthTest: false }),
    );
    // contorno da maquete na escala escolhida (prévia)
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(208, 0.01, 244)),
      new THREE.LineBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.8 }),
    );
    g.add(ring, inner, outline);
    g.userData = { ring, outline };
    g.renderOrder = 10;
    g.visible = false;
    return g;
  }

  /** Cada modo chama isto ao iniciar. */
  setupAR(app, bodyClass) {
    this.app = app;
    this.isSetup = true;
    this.bodyClass = bodyClass;
    document.body.classList.add('ar', bodyClass, 'ar-placing');
    app.scene.add(this.reticle);
    app.stage.visible = false;
    app.camera.near = 0.01;
    app.camera.far = 80;
    app.camera.updateProjectionMatrix();
    this.#buildScaleChips();
    this.#bindGestures();
    const { hud } = this.ctx;
    hud.btnPlace.disabled = true;
    hud.btnPlace.onclick = () => this.place();
    hud.btnExit.style.display = '';
    hud.btnExit.onclick = () => this.ctx.onExit();
    hud.arTip.textContent = 'Mova o celular devagar apontando para o chão…';
    app.resize(); // o 8th Wall ignora (é dono do canvas); nos demais restaura o tamanho
  }

  #buildScaleChips() {
    const { hud } = this.ctx;
    hud.scaleChips.replaceChildren(...AR_SCALES.map((s) => {
      const b = document.createElement('button');
      b.className = `pill${s.id === this.scaleId ? ' on' : ''}`;
      b.textContent = s.label;
      b.onclick = () => {
        this.scaleId = s.id;
        this.ctx.synth?.click();
        [...hud.scaleChips.children].forEach((c) => c.classList.toggle('on', c === b));
        if (this.placed) this.#animateScale(s.scale);
      };
      return b;
    }));
  }

  get scale() {
    return AR_SCALES.find((s) => s.id === this.scaleId).scale;
  }

  /** Atualiza a retícula com uma pose (Vector3 + validade) a cada quadro. */
  updateReticle(pos, valid) {
    const r = this.reticle;
    if (this.placed) {
      r.visible = false;
      return;
    }
    r.visible = !!valid;
    if (valid) {
      r.position.copy(pos);
      const cam = this.app.camera;
      const yaw = Math.atan2(cam.position.x - pos.x, cam.position.z - pos.z);
      r.rotation.set(0, yaw, 0);
      r.userData.outline.scale.setScalar(this.scale);
      r.userData.ring.scale.setScalar(1 + Math.sin(performance.now() * 0.006) * 0.08);
    }
    const { hud } = this.ctx;
    if (hud.btnPlace.disabled === !!valid) {
      hud.btnPlace.disabled = !valid;
      hud.arTip.textContent = valid ? 'Chão encontrado! Escolha a escala e posicione.' : 'Mova o celular devagar apontando para o chão…';
    }
  }

  place() {
    const { app } = this;
    if (!this.reticle.visible) return;
    this.placed = true;
    app.stage.position.copy(this.reticle.position);
    app.stage.rotation.set(0, this.reticle.rotation.y, 0);
    app.stage.scale.setScalar(this.scale * 0.01);
    app.stage.visible = true;
    gsap.to(app.stage.scale, { x: this.scale, y: this.scale, z: this.scale, duration: 0.9, ease: 'back.out(1.6)' });
    document.body.classList.remove('ar-placing');
    this.ctx.onPlaced?.(this.reticle.position.clone());
  }

  reposition() {
    this.placed = false;
    this.app.stage.visible = false;
    document.body.classList.add('ar-placing');
  }

  #animateScale(s) {
    gsap.to(this.app.stage.scale, { x: s, y: s, z: s, duration: 0.6, ease: 'power2.out' });
  }

  /** Câmera usada para transformar toques em raios. */
  pickCamera() {
    return this.app.camera;
  }

  #bindGestures() {
    const layer = document.createElement('div');
    layer.className = 'gesture-layer';
    Object.assign(layer.style, { position: 'fixed', inset: '0', touchAction: 'none' });
    document.getElementById('ui').prepend(layer);
    layer.addEventListener('beforexrselect', (e) => e.preventDefault());
    this.layer = layer;
    const pts = new Map();
    let start = null;
    let pinch = null;
    const stage = () => this.app.stage;
    layer.addEventListener('pointerdown', (e) => {
      layer.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) start = { x: e.clientX, y: e.clientY, t: performance.now(), rot: stage().rotation.y, moved: false };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), scale: stage().scale.x, rot: stage().rotation.y };
      }
    });
    layer.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!this.placed) return;
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const s = THREE.MathUtils.clamp(pinch.scale * (dist / pinch.dist), 1 / 2000, 1 / 40);
        stage().scale.setScalar(s);
        stage().rotation.y = pinch.rot - (ang - pinch.ang);
        if (start) start.moved = true;
      } else if (pts.size === 1 && start) {
        const dx = e.clientX - start.x;
        if (Math.abs(dx) > 8 || Math.abs(e.clientY - start.y) > 8) start.moved = true;
        if (start.moved) stage().rotation.y = start.rot + dx * 0.008;
      }
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0 && start) {
        const tap = !start.moved && performance.now() - start.t < 350;
        if (tap && this.placed) {
          const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
          const ray = new THREE.Raycaster();
          ray.setFromCamera(ndc, this.pickCamera());
          this.ctx.onTap?.(ray.ray);
        }
        start = null;
      }
    };
    layer.addEventListener('pointerup', up);
    layer.addEventListener('pointercancel', up);
  }

  teardownAR() {
    if (!this.isSetup) return;
    this.isSetup = false;
    const { app } = this;
    document.body.classList.remove('ar', this.bodyClass, 'ar-placing');
    app.scene.remove(this.reticle);
    app.stage.visible = true;
    this.layer?.remove();
    const { hud } = this.ctx;
    hud.btnExit.style.display = 'none';
    gsap.killTweensOf(app.stage.scale);
  }
}

/** Interseção do raio do centro da tela com o chão (y = 0). */
export function centerFloorHit(camera, out = new THREE.Vector3()) {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = ray.ray.intersectPlane(plane, out);
  if (!hit) return null;
  if (hit.distanceTo(camera.position) > 8) return null;
  return hit;
}
