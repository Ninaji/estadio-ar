// Núcleo de renderização: um único WebGLRenderer compartilhado por todos os modos
// (3D, WebXR, 8th Wall, giroscópio). O modo ativo é dono do laço de quadros.
import * as THREE from 'three';

export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    // celulares: até 1,5× para manter a taxa de quadros; desktop: até 2×
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.xr.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 5000);
    this.camera.position.set(210, 170, 250);
    this.scene.add(this.camera);

    // "palco": tudo que pertence à maquete (arena, rota, efeitos). Em AR é escalado e ancorado.
    this.stage = new THREE.Group();
    this.stage.name = 'stage';
    this.scene.add(this.stage);

    const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x6b5a48, 1.6);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sun.position.set(0.45, 0.8, 0.35);
    this.scene.add(hemi, sun);
    this.lights = { hemi, sun };

    this.updaters = new Set();
    this.mode = null;
    this.time = 0;
    this.lastT = 0;
    this.fps = 60;
    this.frameCount = 0;
    this.fpsT = 0;

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  resize() {
    if (this.renderer.xr.isPresenting || this.mode?.ownsCanvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (!this.mode || !this.mode.ownsProjection) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  async setMode(mode) {
    const old = this.mode;
    if (old) {
      try {
        await old.stop();
      } catch (err) {
        console.warn('Falha ao encerrar o modo', old.id, err);
      }
    }
    this.mode = mode;
    await mode.start(this);
  }

  /** Avança animações; chamado pelo modo ativo antes de desenhar. */
  tick(tMs) {
    const t = tMs / 1000;
    const dt = Math.min(0.1, this.lastT ? t - this.lastT : 0.016);
    this.lastT = t;
    this.time += dt;
    for (const fn of this.updaters) fn(dt, this.time);
    this.frameCount++;
    if (t - this.fpsT > 1) {
      this.fps = this.frameCount / (t - this.fpsT);
      this.frameCount = 0;
      this.fpsT = t;
    }
    return dt;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onUpdate(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }
}
