// Visual da rota: tubo luminoso com traços fluindo (visível também através das paredes),
// trilha de cubinhos que acende em sequência, bonequinho voxel caminhando e farol no assento.
import * as THREE from 'three';

const tubeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const tubeFragment = /* glsl */ `
  uniform float uTime, uLength, uProgress, uOccluded;
  varying vec2 vUv;
  void main() {
    float s = vUv.x * uLength;
    float dash = step(0.45, fract(s * 0.18 - uTime * 1.6));
    vec3 a = vec3(1.0, 0.24, 0.55);
    vec3 b = vec3(0.30, 0.75, 1.0);
    vec3 col = mix(a, b, vUv.x);
    float walked = step(vUv.x, uProgress);
    col = mix(col, vec3(1.0, 0.95, 0.4), walked * 0.6);
    float alpha = uOccluded > 0.5 ? 0.22 * dash : 0.55 + 0.45 * dash;
    gl_FragColor = vec4(col * (1.2 + dash * 0.8), alpha);
  }
`;

export class RouteView {
  constructor(parent, synth) {
    this.parent = parent;
    this.synth = synth;
    this.group = new THREE.Group();
    this.group.visible = false;
    parent.add(this.group);
    this.uniforms = { uTime: { value: 0 }, uLength: { value: 1 }, uProgress: { value: 0 }, uOccluded: { value: 0 } };
    this.avatar = this.#makeAvatar();
    this.group.add(this.avatar);
    this.beacon = this.#makeBeacon();
    this.group.add(this.beacon);
    this.progress = 0;
    this.speed = 9; // m/s na animação
    this.playing = false;
    this.onStep = () => {};
    this.onArrive = () => {};
    this.stepIdx = -1;
    this.stepTimer = 0;
  }

  #makeAvatar() {
    const g = new THREE.Group();
    const mat = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.55), mat(0xff3d8b, 0x330a1c));
    body.position.y = 1.55;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), mat(0xf1c27d));
    head.position.y = 2.45;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.8), mat(0x2f6bff));
    cap.position.set(0, 2.8, 0.06);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.0, 0.4), mat(0x1e293b));
    const legR = legL.clone();
    legL.geometry = legL.geometry.clone().translate(0, -0.5, 0);
    legR.geometry = legL.geometry;
    legL.position.set(-0.22, 1.0, 0);
    legR.position.set(0.22, 1.0, 0);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.95, 0.3).translate(0, -0.45, 0), mat(0xff3d8b));
    const armR = armL.clone();
    armL.position.set(-0.6, 2.05, 0);
    armR.position.set(0.6, 2.05, 0);
    g.add(body, head, cap, legL, legR, armL, armR);
    g.userData = { legL, legR, armL, armR };
    // halo para achar o boneco de longe
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 2.0, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide }),
    );
    halo.position.y = 0.1;
    halo.renderOrder = 9;
    g.add(halo);
    g.userData.halo = halo;
    g.scale.setScalar(2.2);
    return g;
  }

  #makeBeacon() {
    const g = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 60, 12, 1, true).translate(0, 30, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.25, 6, 24).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe14d, depthTest: false }),
    );
    ring.renderOrder = 9;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    seat.position.y = 0.3;
    g.add(pillar, ring, seat);
    g.userData = { ring, pillar };
    return g;
  }

  /** Mostra uma rota (pontos em metros, espaço da arena). */
  show(route) {
    this.clear();
    this.route = route;
    const lift = 0.7;
    const pts = route.points.map((p) => new THREE.Vector3(p.x, p.y + lift, p.z));
    // arco acumulado para animar o boneco
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.total = this.cum[this.cum.length - 1];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.1);
    const segs = Math.min(2400, Math.max(64, Math.round(this.total * 2.2)));
    const tubeGeo = new THREE.TubeGeometry(curve, segs, 0.85, 8, false);
    this.uniforms.uLength.value = this.total;
    const front = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: tubeVertex, fragmentShader: tubeFragment, transparent: true, depthWrite: false });
    const behindUniforms = { ...this.uniforms, uOccluded: { value: 1 } };
    const behind = new THREE.ShaderMaterial({
      uniforms: behindUniforms, vertexShader: tubeVertex, fragmentShader: tubeFragment, transparent: true, depthWrite: false, depthFunc: THREE.GreaterDepth,
    });
    this.tube = new THREE.Mesh(tubeGeo, front);
    this.tube.renderOrder = 7;
    this.tubeBehind = new THREE.Mesh(tubeGeo, behind);
    this.tubeBehind.renderOrder = 8;
    this.group.add(this.tube, this.tubeBehind);

    // trilha de cubinhos a cada 2,5 m
    const n = Math.max(2, Math.floor(this.total / 2.5));
    const crumbs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), n);
    crumbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.crumbT = [];
    const m = new THREE.Matrix4();
    for (let q = 0; q < n; q++) {
      const s = (q / (n - 1)) * this.total;
      const p = this.#pointAt(s);
      m.makeTranslation(p.x, p.y + 1.6, p.z);
      crumbs.setMatrixAt(q, m);
      this.crumbT.push(s);
    }
    crumbs.renderOrder = 7;
    this.crumbs = crumbs;
    this.group.add(crumbs);

    const end = pts[pts.length - 1];
    this.beacon.position.set(end.x, end.y - lift, end.z);
    this.group.visible = true;
    this.progress = 0;
    this.stepIdx = -1;
    this.arrived = false;
    this.playing = true;
  }

  #pointAt(s, outDir) {
    const { pts, cum } = this;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const a = pts[lo];
    const b = pts[Math.min(lo + 1, pts.length - 1)];
    const span = cum[lo + 1] - cum[lo] || 1;
    const f = THREE.MathUtils.clamp((s - cum[lo]) / span, 0, 1);
    if (outDir) outDir.subVectors(b, a);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, idx: lo };
  }

  clear() {
    for (const obj of [this.tube, this.tubeBehind, this.crumbs]) {
      if (!obj) continue;
      this.group.remove(obj);
      obj.geometry.dispose();
      obj.material.dispose();
    }
    this.tube = this.tubeBehind = this.crumbs = null;
    this.group.visible = false;
    this.playing = false;
    this.route = null;
  }

  restart() {
    if (!this.route) return;
    this.progress = 0;
    this.stepIdx = -1;
    this.arrived = false;
    this.playing = true;
  }

  /** Posição atual do boneco (para a câmera seguir). */
  get avatarPosition() {
    return this.avatar.position;
  }

  update(dt, t) {
    this.uniforms.uTime.value = t;
    if (!this.route) return;
    const dir = new THREE.Vector3();
    if (this.playing) {
      // anda mais devagar em escadas e na arquibancada (pontos com desnível)
      const here = this.#pointAt(this.progress, dir);
      const slope = Math.abs(dir.y) / Math.max(0.01, Math.hypot(dir.x, dir.z));
      this.progress = Math.min(this.total, this.progress + dt * this.speed * (slope > 0.2 ? 0.45 : 1));
      if (here.idx !== this._lastIdx) {
        this._lastIdx = here.idx;
        const steps = this.route.steps;
        let k = 0;
        for (let q = 0; q < steps.length; q++) if (steps[q].startIdx <= here.idx) k = q;
        if (k !== this.stepIdx) {
          this.stepIdx = k;
          this.onStep(k);
        }
      }
      this.stepTimer += dt;
      if (this.stepTimer > 0.32) {
        this.stepTimer = 0;
        this.synth?.step();
      }
      if (this.progress >= this.total && !this.arrived) {
        this.arrived = true;
        this.playing = false;
        this.stepIdx = this.route.steps.length - 1;
        this.onStep(this.stepIdx);
        this.onArrive(this.pts[this.pts.length - 1]);
      }
    }
    const p = this.#pointAt(this.progress, dir);
    this.avatar.position.set(p.x, p.y - 0.7, p.z);
    if (dir.lengthSq() > 1e-6) this.avatar.rotation.y = Math.atan2(dir.x, dir.z);
    const swing = this.playing ? Math.sin(t * 14) * 0.7 : 0;
    const u = this.avatar.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    if (this.arrived) {
      u.armL.rotation.x = Math.PI + Math.sin(t * 8) * 0.3;
      u.armR.rotation.x = Math.PI - Math.sin(t * 8) * 0.3;
      this.avatar.position.y += Math.abs(Math.sin(t * 6)) * 0.5;
    }
    u.halo.scale.setScalar(1 + Math.sin(t * 5) * 0.12);
    this.uniforms.uProgress.value = this.progress / this.total;
    // cubinhos acendem conforme a onda e o progresso
    const c = new THREE.Color();
    for (let q = 0; q < this.crumbT.length; q++) {
      const s = this.crumbT[q];
      const walked = s <= this.progress;
      const pulse = 0.5 + 0.5 * Math.sin(t * 6 - s * 0.35);
      if (walked) c.setRGB(1, 0.9, 0.35);
      else c.setHSL(0.92 - (s / this.total) * 0.35, 1, 0.45 + pulse * 0.25);
      this.crumbs.setColorAt(q, c);
    }
    this.crumbs.instanceColor.needsUpdate = true;
    const r = this.beacon.userData.ring;
    r.scale.setScalar(1 + ((t * 0.8) % 1) * 1.5);
    r.material.opacity = 1 - ((t * 0.8) % 1);
    r.material.transparent = true;
  }
}
