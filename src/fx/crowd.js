// Torcida voxel instanciada: corpos e cabeças sobre os assentos, com ola e pulos no vertex shader.
// Respeita cortes, camadas ocultas e a desmontagem usando os mesmos uniforms da arena.
import * as THREE from 'three';
import { LEVELS, SECTORS } from '../stadium/spec.js';
import { CAT_INDEX } from '../stadium/palette.js';

const SHIRTS = {
  oeste: [0x1f5bff, 0xffffff, 0x0b2a8a],
  leste: [0x10b981, 0xffffff, 0x065f46],
  norte: [0xff2d4b, 0xffffff, 0x7f1d1d],
  sul: [0xff7a00, 0xffffff, 0x7c2d12],
  canto: [0x8b5cf6, 0xffffff, 0x4c1d95],
  visitante: [0xffe14d, 0x111111, 0xfacc15],
};
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

function hash(n) {
  const s = Math.sin(n * 91.345 + 3.7) * 43758.5453;
  return s - Math.floor(s);
}

export class Crowd {
  constructor(parent, arena, seats, fill = 0.55) {
    this.arena = arena;
    const dims = arena.dims;
    const v = dims.voxel;
    const total = seats.length / 7;
    const chosen = [];
    for (let s = 0; s < total; s++) if (hash(s) < fill) chosen.push(s);
    const n = chosen.length;
    this.uniforms = {
      ...arena.uniforms,
      uWave: { value: 0 },
      uWavePos: { value: 0 },
      uCheer: { value: 0 },
      uOffsets: { value: Array.from({ length: LEVELS.length * 4 }, () => new THREE.Vector3()) },
      uVoxel: { value: v },
      uSeatCat: { value: CAT_INDEX.assentos },
    };
    const body = new THREE.BoxGeometry(0.42, 0.62, 0.36);
    body.translate(0, 0.31, 0);
    const head = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    head.translate(0, 0.78, 0);
    const aVox = new Float32Array(n * 3);
    const aAngle = new Float32Array(n);
    const aRand = new Float32Array(n);
    const aGroup = new Float32Array(n);
    const m = new THREE.Matrix4();
    const bodyMat = this.#material();
    const headMat = this.#material();
    this.body = new THREE.InstancedMesh(body, bodyMat, n);
    this.head = new THREE.InstancedMesh(head, headMat, n);
    const c = new THREE.Color();
    for (let q = 0; q < n; q++) {
      const s = chosen[q];
      const i = seats[s * 7];
      const j = seats[s * 7 + 1];
      const k = seats[s * 7 + 2];
      const sector = SECTORS[seats[s * 7 + 4]];
      const x = dims.ox + (i + 0.5) * v;
      const y = dims.oy + (j + 1) * v;
      const z = dims.oz + (k + 0.5) * v;
      const ang = Math.atan2(-z, -x);
      m.makeRotationY(-ang + Math.PI / 2);
      m.setPosition(x, y, z);
      this.body.setMatrixAt(q, m);
      this.head.setMatrixAt(q, m);
      const palette = sector.visitor && seats[s * 7 + 3] === 0 ? SHIRTS.visitante : SHIRTS[sector.side];
      const r = hash(s * 7.1);
      c.set(palette[r < 0.6 ? 0 : r < 0.85 ? 1 : 2]);
      this.body.setColorAt(q, c);
      c.set(SKIN[(hash(s * 3.3) * SKIN.length) | 0]);
      this.head.setColorAt(q, c);
      aVox[q * 3] = i;
      aVox[q * 3 + 1] = j;
      aVox[q * 3 + 2] = k;
      aAngle[q] = Math.atan2(z, x);
      aRand[q] = hash(s * 1.7);
      const L = LEVELS.findIndex((lv, idx) => y - 0.2 >= lv.y0 && (idx === LEVELS.length - 1 || y - 0.2 < LEVELS[idx + 1].y0));
      aGroup[q] = Math.max(0, L) * 4 + (x < 0 ? 0 : 1) + (z < 0 ? 0 : 2);
    }
    for (const mesh of [this.body, this.head]) {
      mesh.geometry.setAttribute('aVox', new THREE.InstancedBufferAttribute(aVox, 3));
      mesh.geometry.setAttribute('aAngle', new THREE.InstancedBufferAttribute(aAngle, 1));
      mesh.geometry.setAttribute('aRand', new THREE.InstancedBufferAttribute(aRand, 1));
      mesh.geometry.setAttribute('aGroup', new THREE.InstancedBufferAttribute(aGroup, 1));
      mesh.frustumCulled = false;
      mesh.visible = false;
      parent.add(mesh);
    }
    this.count = n;
  }

  #material() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec3 aVox; attribute float aAngle; attribute float aRand; attribute float aGroup;
          uniform float uTime, uWave, uWavePos, uCheer, uVoxel;
          uniform vec3 uOffsets[${LEVELS.length * 4}];
          varying vec3 vVox;`)
        .replace('#include <project_vertex>', `
          vec4 mvPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
          #endif
          float da = mod(aAngle - uWavePos + 3.14159265, 6.2831853) - 3.14159265;
          float wave = uWave * exp(-da * da / 0.06);
          mvPosition.y += wave * 0.55 + uCheer * 0.35 * abs(sin(uTime * 9.0 + aRand * 40.0));
          mvPosition.xyz += uOffsets[int(aGroup + 0.5)] * uVoxel;
          vVox = aVox;
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uCutH, uCutJ, uCutV, uCutAxis, uCutIdx, uCutSide, uCutW, uWedgeA0, uWedgeAW, uBuildJ;
          uniform vec2 uWedgeC; uniform int uHidden; uniform int uSeatCat;
          varying vec3 vVox;`)
        .replace('void main() {', `void main() {
          if (((uHidden >> uSeatCat) & 1) == 1) discard;
          if (vVox.y > uBuildJ) discard;
          if (uCutH > 0.5 && vVox.y >= uCutJ) discard;
          if (uCutV > 0.5) { float c = uCutAxis < 0.5 ? vVox.x : vVox.z; if (uCutSide > 0.0 ? c >= uCutIdx : c < uCutIdx) discard; }
          if (uCutW > 0.5) { vec2 p = vVox.xz + 0.5 - uWedgeC; float d = mod(atan(p.y, p.x) - uWedgeA0, 6.28318530718); if (d < uWedgeAW) discard; }`);
    };
    return mat;
  }

  set visible(v) {
    this.body.visible = v;
    this.head.visible = v;
  }

  get visible() {
    return this.body.visible;
  }

  update() {
    const offs = this.uniforms.uOffsets.value;
    this.arena.groups.forEach((g, i) => offs[i].copy(g.position));
  }
}
