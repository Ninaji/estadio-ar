// Modo Show: noite de jogo com refletores, telões, torcida, ola, fogos e mini partida.
import * as THREE from 'three';
import gsap from 'gsap';
import { ROOF, pointAt, SEGMENTS, ELEVATORS, sidePoint } from '../stadium/spec.js';
import { CONFETTI } from './particles.js';

const beamVertex = /* glsl */ `
  varying float vH;
  void main() { vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const beamFragment = /* glsl */ `
  uniform float uIntensity; uniform vec3 uColor; varying float vH;
  void main() { gl_FragColor = vec4(uColor, pow(vH, 1.6) * 0.22 * uIntensity); }
`;

export class ShowMode {
  constructor({ app, arena, crowd, match, sparks, confetti, synth, hud }) {
    Object.assign(this, { app, arena, crowd, match, sparks, confetti, synth, hud });
    this.fxOn = false;
    this.nightOn = false;
    this.waveTimer = 8;
    this.night = { v: 0 };
    this.fireworkTimer = 0;
    this.shells = [];
    this.waveTween = null;
    this.beams = new THREE.Group();
    this.beams.visible = false;
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uIntensity: { value: 0 }, uColor: { value: new THREE.Color(0xfff6d8) } },
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    // 16 feixes a partir do anel de refletores
    for (let n = 0; n < 16; n++) {
      const seg = [0, 1, 2, 3, 4, 5, 6, 7, 8][n % 9];
      const t = SEGMENTS[seg].kind === 'corner' ? Math.PI / 4 : (SEGMENTS[seg].len || 40) * ((n * 0.37) % 1);
      const p = pointAt(seg, t, ROOF.dIn + 1.5);
      const from = new THREE.Vector3(p.x, 39.2, p.z);
      const to = new THREE.Vector3(p.x * 0.25, -6, p.z * 0.25);
      const len = from.distanceTo(to);
      const geo = new THREE.CylinderGeometry(1.2, 15, len, 20, 1, true);
      geo.translate(0, -len / 2, 0);
      // uv.y = 1 no topo (fonte de luz)
      const beam = new THREE.Mesh(geo, this.beamMat);
      beam.position.copy(from);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
      beam.renderOrder = 6;
      this.beams.add(beam);
    }
    arena.root.add(this.beams);
    this.#buildElevators();
    app.onUpdate((dt) => this.update(dt));
    match.onGoal = (team) => this.goal(team, false);
  }

  #buildElevators() {
    this.cabins = [];
    const geo = new THREE.BoxGeometry(1.8, 2.4, 1.8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff6b00, emissive: 0x552200 });
    for (const e of ELEVATORS) {
      const u = (e.u0 + e.u1) / 2;
      const d = (e.d0 + e.d1) / 2;
      const p = sidePoint(e.side, u, d);
      const cab = new THREE.Mesh(geo, mat);
      cab.position.set(p.x, e.y0 + 1.2, p.z);
      cab.visible = false;
      this.arena.root.add(cab);
      const tl = gsap.timeline({ repeat: -1, delay: Math.random() * 4 });
      for (const y of [0, 8, 18, 8, -6]) tl.to(cab.position, { y: y + 1.2, duration: 2.5, ease: 'power2.inOut' }).to({}, { duration: 1.5 });
      this.cabins.push(cab);
    }
  }

  showCabins() {
    for (const c of this.cabins) c.visible = true;
  }

  /** Efeitos (padrão, de dia): torcida, mini partida, telões e LEDs animados, ola automática. */
  setFx(on) {
    this.fxOn = on;
    this.crowd.visible = on;
    this.match.visible = on;
    if (on) this.match.kickoff();
    gsap.to(this.arena.uniforms.uFx, { value: on ? 1 : 0, duration: 0.8 });
    this.waveTimer = 8;
  }

  /** Noite de jogo: escurece, acende refletores e feixes de luz; fogos de tempos em tempos. */
  setNight(on) {
    this.nightOn = on;
    const { arena } = this;
    document.body.classList.toggle('night', on);
    gsap.to(this.night, {
      v: on ? 1 : 0,
      duration: 1.6,
      ease: 'power2.inOut',
      onUpdate: () => {
        arena.uniforms.uNight.value = this.night.v;
        this.beamMat.uniforms.uIntensity.value = this.night.v;
        this.app.lights.hemi.intensity = 1.6 - this.night.v * 1.1;
        this.app.lights.sun.intensity = 2.2 - this.night.v * 1.8;
      },
    });
    this.beams.visible = true;
    this.fireworkTimer = 3;
    if (!on) setTimeout(() => { if (!this.nightOn) this.beams.visible = false; }, 1700);
  }

  get on() {
    return this.nightOn;
  }

  wave(silent = false) {
    const u = this.crowd.uniforms;
    this.waveTween?.kill();
    u.uWavePos.value = 0;
    gsap.to(u.uWave, { value: 1, duration: 0.6 });
    this.waveTween = gsap.to(u.uWavePos, {
      value: Math.PI * 4,
      duration: 9,
      ease: 'none',
      onComplete: () => gsap.to(u.uWave, { value: 0, duration: 0.8 }),
    });
    if (!silent) this.synth.whoosh(1.2, true);
  }

  /** Gol: manual (botão) é a festa completa; os gols da mini partida são discretos. */
  goal(team = 0, manual = true) {
    const { synth, confetti, crowd } = this;
    if (manual) {
      synth.whistle(false);
      setTimeout(() => synth.horn(), 250);
    } else {
      synth.chime();
    }
    gsap.fromTo(crowd.uniforms.uCheer, { value: 1 }, { value: 0, duration: 5, ease: 'power2.in' });
    const bursts = manual ? 6 : 3;
    for (let k = 0; k < bursts; k++) {
      const a = (k / bursts) * Math.PI * 2;
      confetti.emit({
        position: { x: Math.cos(a) * 60, y: 38, z: Math.sin(a) * 75 },
        count: manual ? 90 : 50, speed: 10, spread: 1, colors: CONFETTI, life: [3, 5], size: [0.5, 0.9], gravity: -3, drag: 1.2, flutter: 8,
      });
    }
    const shots = manual ? 5 : 2;
    for (let k = 0; k < shots; k++) setTimeout(() => this.launchFirework(manual), k * 350);
    if (this.nightOn) gsap.fromTo(this.arena.uniforms.uNight, { value: this.night.v }, { value: this.night.v * 0.6, duration: 0.15, yoyo: true, repeat: 7 });
    void team;
  }

  launchFirework(sound = true) {
    const seg = (Math.random() * 9) | 0;
    const len = SEGMENTS[seg].kind === 'corner' ? Math.PI / 2 : SEGMENTS[seg].len;
    const p = pointAt(seg, Math.random() * len, 50);
    this.shells.push({
      pos: new THREE.Vector3(p.x, 45, p.z),
      vel: new THREE.Vector3(-p.x * 0.05, 38 + Math.random() * 10, -p.z * 0.05),
      t: 1.1 + Math.random() * 0.4,
      color: CONFETTI[(Math.random() * CONFETTI.length) | 0],
    });
    if (sound) this.synth.firework();
  }

  update(dt) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.t -= dt;
      s.vel.y -= 9.8 * dt;
      s.pos.addScaledVector(s.vel, dt);
      this.sparks.emit({ position: s.pos, count: 2, speed: 2, spread: 1, colors: [0xffe7a0], life: [0.3, 0.6], size: [0.6, 1], gravity: -2 });
      if (s.t <= 0) {
        this.sparks.emit({ position: s.pos, count: 160, speed: 28, spread: 1, colors: [s.color, 0xffffff], life: [1.2, 2.2], size: [0.9, 1.6], gravity: -5, drag: 1.1 });
        this.shells.splice(i, 1);
      }
    }
    if (!this.fxOn) return;
    this.crowd.update();
    this.match.update(dt);
    // ola automática de vez em quando (sem som)
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = 35 + Math.random() * 25;
      this.wave(true);
    }
    // fogos periódicos só à noite, sem som
    if (this.nightOn) {
      this.fireworkTimer -= dt;
      if (this.fireworkTimer <= 0) {
        this.fireworkTimer = 8 + Math.random() * 6;
        this.launchFirework(false);
      }
    }
  }
}
