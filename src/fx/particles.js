// Partículas de cubinhos (voxel): confete, poeira, faíscas e fogos. CPU simples + InstancedMesh.
import * as THREE from 'three';

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();

export class VoxelParticles {
  constructor(parent, { max = 3000, additive = false } = {}) {
    this.max = max;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !additive,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = additive ? 5 : 1;
    parent.add(this.mesh);
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.rot = new Float32Array(max * 3);
    this.spin = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.flutter = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.n = 0;
  }

  /**
   * Emite partículas. opts: position {x,y,z}, count, speed, spread (0..1), dir {x,y,z},
   * colors [hex], life [min,max], size [min,max], gravity, drag, flutter, ring (raio), box {x,z}
   */
  emit(opts) {
    const {
      position, count = 50, speed = 10, spread = 1, dir = { x: 0, y: 1, z: 0 }, colors = [0xffffff],
      life = [1, 2], size = [0.6, 1.2], gravity = -9.8, drag = 0.4, flutter = 0, ring = 0, box = null,
    } = opts;
    for (let c = 0; c < count; c++) {
      if (this.n >= this.max) this.#kill(0);
      const i = this.n++;
      let ox = 0;
      let oz = 0;
      if (ring) {
        const a = Math.random() * Math.PI * 2;
        ox = Math.cos(a) * ring;
        oz = Math.sin(a) * ring;
      } else if (box) {
        ox = (Math.random() - 0.5) * box.x;
        oz = (Math.random() - 0.5) * box.z;
      }
      this.p[i * 3] = position.x + ox;
      this.p[i * 3 + 1] = position.y;
      this.p[i * 3 + 2] = position.z + oz;
      // direção aleatória misturada com a direção base
      let rx = Math.random() * 2 - 1;
      let ry = Math.random() * 2 - 1;
      let rz = Math.random() * 2 - 1;
      const rl = Math.hypot(rx, ry, rz) || 1;
      rx /= rl; ry /= rl; rz /= rl;
      let vx = dir.x * (1 - spread) + rx * spread;
      let vy = dir.y * (1 - spread) + ry * spread;
      let vz = dir.z * (1 - spread) + rz * spread;
      if (ring) { vx += ox / ring * 0.6; vz += oz / ring * 0.6; }
      const vl = Math.hypot(vx, vy, vz) || 1;
      const sp = speed * (0.55 + Math.random() * 0.45);
      this.v[i * 3] = (vx / vl) * sp;
      this.v[i * 3 + 1] = (vy / vl) * sp;
      this.v[i * 3 + 2] = (vz / vl) * sp;
      for (let a = 0; a < 3; a++) {
        this.rot[i * 3 + a] = Math.random() * 6;
        this.spin[i * 3 + a] = (Math.random() - 0.5) * 10;
      }
      this.maxLife[i] = this.life[i] = life[0] + Math.random() * (life[1] - life[0]);
      this.size[i] = size[0] + Math.random() * (size[1] - size[0]);
      this.grav[i] = gravity;
      this.drag[i] = drag;
      this.flutter[i] = flutter;
      tmpC.set(colors[(Math.random() * colors.length) | 0]);
      this.col[i * 3] = tmpC.r;
      this.col[i * 3 + 1] = tmpC.g;
      this.col[i * 3 + 2] = tmpC.b;
    }
  }

  #kill(i) {
    const last = --this.n;
    if (i === last) return;
    for (const arr of [this.p, this.v, this.rot, this.spin, this.col]) {
      arr[i * 3] = arr[last * 3];
      arr[i * 3 + 1] = arr[last * 3 + 1];
      arr[i * 3 + 2] = arr[last * 3 + 2];
    }
    for (const arr of [this.life, this.maxLife, this.size, this.grav, this.drag, this.flutter]) arr[i] = arr[last];
  }

  update(dt, time) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.#kill(i);
        i--;
        continue;
      }
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i * 3] *= k;
      this.v[i * 3 + 1] = this.v[i * 3 + 1] * k + this.grav[i] * dt;
      this.v[i * 3 + 2] *= k;
      if (this.flutter[i]) {
        this.v[i * 3] += Math.sin(time * 6 + i) * this.flutter[i] * dt;
        this.v[i * 3 + 2] += Math.cos(time * 5 + i * 1.3) * this.flutter[i] * dt;
      }
      for (let a = 0; a < 3; a++) {
        this.p[i * 3 + a] += this.v[i * 3 + a] * dt;
        this.rot[i * 3 + a] += this.spin[i * 3 + a] * dt;
      }
    }
    const m = this.mesh;
    for (let i = 0; i < this.n; i++) {
      const f = this.life[i] / this.maxLife[i];
      const s = this.size[i] * Math.min(1, f * 3);
      tmpP.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
      tmpE.set(this.rot[i * 3], this.rot[i * 3 + 1], this.rot[i * 3 + 2]);
      tmpQ.setFromEuler(tmpE);
      tmpS.set(s, s, s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      m.setMatrixAt(i, tmpM);
      const fade = Math.min(1, f * 2.5);
      tmpC.setRGB(this.col[i * 3] * fade, this.col[i * 3 + 1] * fade, this.col[i * 3 + 2] * fade);
      m.setColorAt(i, tmpC);
    }
    m.count = this.n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}

export const CONFETTI = [0x2f6bff, 0xff3d8b, 0xffd23f, 0x3ccf4e, 0xa66bff, 0x22d3ee, 0xffffff, 0xff7a00];
