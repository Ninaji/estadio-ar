// Malha de voxels: faces visíveis + greedy meshing + AO por vértice.
// As faces são agrupadas por (nível × quadrante) para a desmontagem animada.
import { MAT_CAT, MAT_TRANSLUCENT } from '../stadium/palette.js';
import { LEVELS, Y_MIN } from '../stadium/spec.js';

export const NO_U = 1 << 22; // AO varia ao longo de u: não fundir em u
export const NO_V = 1 << 23; // AO varia ao longo de v: não fundir em v
export const TRANS_BIT = 1 << 21;
export const SET_SHIFT = 24;
export const EXPLODE_SET = 13;

/** Informações de agrupamento por eixo (nível em y, quadrante em x/z). */
export function makeGroupInfo(dims) {
  const { nx, ny, nz, voxel } = dims;
  const levelJ = new Uint8Array(ny);
  for (let j = 0; j < ny; j++) {
    const y = Y_MIN + (j + 0.5) * voxel;
    let L = 0;
    for (let q = LEVELS.length - 1; q >= 0; q--) if (y >= LEVELS[q].y0) { L = q; break; }
    levelJ[j] = L;
  }
  const qI = new Uint8Array(nx);
  for (let i = 0; i < nx; i++) qI[i] = i < nx / 2 ? 0 : 1;
  const qK = new Uint8Array(nz);
  for (let k = 0; k < nz; k++) qK[k] = k < nz / 2 ? 0 : 2;
  // planos de fronteira de grupo por eixo
  const boundary = [new Uint8Array(nx + 1), new Uint8Array(ny + 1), new Uint8Array(nz + 1)];
  boundary[0][nx / 2] = 1;
  boundary[2][nz / 2] = 1;
  for (let j = 1; j < ny; j++) if (levelJ[j] !== levelJ[j - 1]) boundary[1][j] = 1;
  return { levelJ, qI, qK, boundary, groupCount: LEVELS.length * 4 };
}

/** Uma face precisa existir entre o voxel a (dono) e o vizinho b? */
export function faceNeeded(a, b, boundary) {
  if (b === 0) return true;
  const ta = MAT_TRANSLUCENT[a];
  const tb = MAT_TRANSLUCENT[b];
  if (ta) return tb ? a !== b : false;
  if (tb) return true;
  if (MAT_CAT[a] !== MAT_CAT[b]) return true;
  return boundary;
}

/** Buffer crescente de quads de um grupo. */
export class QuadSink {
  constructor(cap = 4096) {
    this.n = 0;
    this.pos = new Uint16Array(cap * 12);
    this.mi = new Uint8Array(cap * 8);
    this.idx = new Uint32Array(cap * 6);
  }

  grow() {
    const cap = (this.pos.length / 12) * 2;
    const pos = new Uint16Array(cap * 12);
    pos.set(this.pos);
    const mi = new Uint8Array(cap * 8);
    mi.set(this.mi);
    const idx = new Uint32Array(cap * 6);
    idx.set(this.idx);
    this.pos = pos;
    this.mi = mi;
    this.idx = idx;
  }

  /** p: 12 coordenadas (4 vértices), ao: 4 valores 0..3, flags base = dir | cap<<5. */
  add(p, mat, dirFlags, ao) {
    if ((this.n + 1) * 12 > this.pos.length) this.grow();
    const q = this.n++;
    this.pos.set(p, q * 12);
    const m = this.mi;
    const v0 = q * 4;
    for (let c = 0; c < 4; c++) {
      m[(v0 + c) * 2] = mat;
      m[(v0 + c) * 2 + 1] = dirFlags | (ao[c] << 3);
    }
    const ix = this.idx;
    const o = q * 6;
    if (ao[0] + ao[2] > ao[1] + ao[3]) {
      ix[o] = v0; ix[o + 1] = v0 + 1; ix[o + 2] = v0 + 2;
      ix[o + 3] = v0; ix[o + 4] = v0 + 2; ix[o + 5] = v0 + 3;
    } else {
      ix[o] = v0 + 1; ix[o + 1] = v0 + 2; ix[o + 2] = v0 + 3;
      ix[o + 3] = v0 + 1; ix[o + 4] = v0 + 3; ix[o + 5] = v0;
    }
  }

  /** Copia ajustada ao tamanho para transferir ao thread principal. */
  export() {
    return {
      quads: this.n,
      pos: this.pos.slice(0, this.n * 12),
      mi: this.mi.slice(0, this.n * 8),
      idx: this.idx.slice(0, this.n * 6),
    };
  }
}

const P = new Uint16Array(12);
const AO4 = [0, 0, 0, 0];

/**
 * Emite um quad no plano `s` do eixo `d`, ocupando [a, a+w) × [b, b+h) em (u, v).
 * neg = normal apontando para −d.
 */
export function emitQuad(sink, d, s, a, b, w, h, neg, mat, ao, capFlag = 0) {
  const u = (d + 1) % 3;
  const v = (d + 2) % 3;
  const corners = neg
    ? [[a, b], [a, b + h], [a + w, b + h], [a + w, b]]
    : [[a, b], [a + w, b], [a + w, b + h], [a, b + h]];
  const aoOrder = neg ? [ao[0], ao[3], ao[2], ao[1]] : ao;
  for (let c = 0; c < 4; c++) {
    P[c * 3 + d] = s;
    P[c * 3 + u] = corners[c][0];
    P[c * 3 + v] = corners[c][1];
  }
  const dir = d * 2 + (neg ? 1 : 0);
  sink.add(P, mat, dir | (capFlag << 5), aoOrder);
}

/** Varre os três eixos montando máscaras por fatia e fundindo faces iguais. */
export function meshGrid(grid, info, onProgress = () => {}) {
  const { nx, ny, nz, data } = grid;
  const dims = [nx, ny, nz];
  const strides = [1, nx * nz, nx];
  // conjuntos: 0 = superfície visível; 1..12 = revela ao ocultar a categoria (set−1);
  // EXPLODE_SET = faces nas fronteiras de nível/quadrante (só na desmontagem)
  const sinks = [];
  const sinkFor = (group, trans, set) => {
    const key = (set * 64 + group) * 2 + trans;
    return sinks[key] || (sinks[key] = new QuadSink(set === 0 ? 4096 : 512));
  };
  const { levelJ, qI, qK } = info;
  const coord = [0, 0, 0];
  const opaque = (m) => m !== 0 && MAT_TRANSLUCENT[m] === 0;

  let work = 0;
  const totalWork = nx + ny + nz + 3;
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const du = dims[u];
    const dv = dims[v];
    const dd = dims[d];
    const sd = strides[d];
    const su = strides[u];
    const sv = strides[v];
    const maskP = new Int32Array(du * dv);
    const maskN = new Int32Array(du * dv);
    const bnd = info.boundary[d];

    for (let s = 0; s <= dd; s++) {
      const isB = bnd[s] === 1;
      let any = false;
      let n = 0;
      for (let b = 0; b < dv; b++) {
        for (let a = 0; a < du; a++, n++) {
          const base = a * su + b * sv;
          const A = s > 0 ? data[base + (s - 1) * sd] : 0;
          const B = s < dd ? data[base + s * sd] : 0;
          maskP[n] = 0;
          maskN[n] = 0;
          if (A === B && (A === 0 || !isB)) continue;
          if (A !== 0 && faceNeeded(A, B, isB)) {
            maskP[n] = faceKey(A, B, true, s, a, b) | (faceSet(A, B, isB) << SET_SHIFT);
            any = true;
          }
          if (B !== 0 && faceNeeded(B, A, isB)) {
            maskN[n] = faceKey(B, A, false, s, a, b) | (faceSet(B, A, isB) << SET_SHIFT);
            any = true;
          }
        }
      }
      if (any) {
        greedy(maskP, false, s, isB);
        greedy(maskN, true, s, isB);
      }
    }
    work += dd;
    onProgress(work / totalWork);

    // chave da face: material | AO | grupo | flags
    function faceKey(owner, other, pos, s, a, b) {
      coord[d] = pos ? s - 1 : s;
      coord[u] = a;
      coord[v] = b;
      const group = levelJ[coord[1]] * 4 + qI[coord[0]] + qK[coord[2]];
      const trans = MAT_TRANSLUCENT[owner];
      let ao = 0xff; // 3,3,3,3
      let nomerge = 0; // bits NO_U / NO_V
      if (other === 0 && !trans) {
        const layer = pos ? s : s - 1; // camada de ar à frente da face
        if (layer >= 0 && layer < dd) {
          const lb = layer * sd;
          const am = a > 0;
          const ap = a < du - 1;
          const bm = b > 0;
          const bp = b < dv - 1;
          const at = (aa, bb) => data[lb + aa * su + bb * sv];
          const sU0 = am && opaque(at(a - 1, b)) ? 1 : 0;
          const sU1 = ap && opaque(at(a + 1, b)) ? 1 : 0;
          const sV0 = bm && opaque(at(a, b - 1)) ? 1 : 0;
          const sV1 = bp && opaque(at(a, b + 1)) ? 1 : 0;
          {
            const c00 = am && bm && opaque(at(a - 1, b - 1)) ? 1 : 0;
            const c10 = ap && bm && opaque(at(a + 1, b - 1)) ? 1 : 0;
            const c11 = ap && bp && opaque(at(a + 1, b + 1)) ? 1 : 0;
            const c01 = am && bp && opaque(at(a - 1, b + 1)) ? 1 : 0;
            const v00 = vao(sU0, sV0, c00);
            const v10 = vao(sU1, sV0, c10);
            const v11 = vao(sU1, sV1, c11);
            const v01 = vao(sU0, sV1, c01);
            ao = v00 | (v10 << 2) | (v11 << 4) | (v01 << 6);
            if (v00 !== v10 || v01 !== v11) nomerge |= NO_U;
            if (v00 !== v01 || v10 !== v11) nomerge |= NO_V;
          }
        }
      }
      return owner | (ao << 8) | (group << 16) | (trans ? TRANS_BIT : 0) | nomerge;
    }

    function greedy(mask, neg, s, isB) {
      for (let b = 0; b < dv; b++) {
        const row = b * du;
        for (let a = 0; a < du;) {
          const key = mask[row + a];
          if (key === 0) { a++; continue; }
          let w = 1;
          let h = 1;
          if (!(key & NO_U)) while (a + w < du && mask[row + a + w] === key) w++;
          if (!(key & NO_V)) {
            outer: while (b + h < dv) {
              const r2 = (b + h) * du + a;
              for (let q = 0; q < w; q++) if (mask[r2 + q] !== key) break outer;
              h++;
            }
          }
          for (let hh = 0; hh < h; hh++) {
            const r2 = (b + hh) * du + a;
            for (let q = 0; q < w; q++) mask[r2 + q] = 0;
          }
          const ao = (key >> 8) & 0xff;
          AO4[0] = ao & 3;
          AO4[1] = (ao >> 2) & 3;
          AO4[2] = (ao >> 4) & 3;
          AO4[3] = (ao >> 6) & 3;
          const group = (key >> 16) & 31;
          const trans = key & TRANS_BIT ? 1 : 0;
          const set = (key >>> SET_SHIFT) & 15;
          emitQuad(sinkFor(group, trans, set), d, s, a, b, w, h, neg, key & 0xff, AO4);
          // faces de fronteira entre categorias distintas também aparecem na desmontagem
          if (set > 0 && set < EXPLODE_SET && isB) emitQuad(sinkFor(group, trans, EXPLODE_SET), d, s, a, b, w, h, neg, key & 0xff, AO4);
          a += w;
        }
      }
    }
  }

  const out = [];
  sinks.forEach((sink, key) => {
    if (!sink || sink.n === 0) return;
    out.push({ group: (key >> 1) & 63, translucent: key & 1, set: key >> 7, ...sink.export() });
  });
  return out;
}

/** Conjunto da face: 0 visível; 1+categoria do vizinho opaco; EXPLODE_SET fronteira de grupo. */
function faceSet(owner, other, isB) {
  if (other === 0 || MAT_TRANSLUCENT[other]) return 0;
  if (MAT_TRANSLUCENT[owner]) return 0;
  if (MAT_CAT[owner] !== MAT_CAT[other]) return 1 + MAT_CAT[other];
  return isB ? EXPLODE_SET : 0;
}

function vao(s1, s2, c) {
  if (s1 && s2) return 0;
  return 3 - (s1 + s2 + c);
}
