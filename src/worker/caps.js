// Tampas do corte: faces de voxels mantidos cujo vizinho sólido foi removido e que
// a malha principal não desenhou. São as "camadas do bolo" que aparecem no corte.
import { MAT_TRANSLUCENT } from '../stadium/palette.js';
import { QuadSink, emitQuad, faceNeeded } from './mesher.js';
import { isRemoved, verticalRemoved, wedgeRemoved } from '../slicing/cutPredicate.js';

const AO_FULL = [3, 3, 3, 3];

export function buildCaps(grid, info, cut) {
  const { nx, ny, nz, data } = grid;
  const { levelJ, qI, qK, boundary } = info;
  const sinks = [];
  const sinkFor = (g) => sinks[g] || (sinks[g] = new QuadSink(1024));
  const groupOf = (i, j, k) => levelJ[j] * 4 + qI[i] + qK[k];
  const idx = (i, j, k) => (j * nz + k) * nx + i;
  const solidOpaque = (m) => m !== 0 && MAT_TRANSLUCENT[m] === 0;
  const capKey = (A, B, isB, i, j, k) => {
    if (!solidOpaque(A) || !solidOpaque(B) || faceNeeded(A, B, isB)) return 0;
    return A | (groupOf(i, j, k) << 16);
  };

  // --- corte horizontal: fatia j = h.j − 1 olhando para cima (eixo d=1, u=z, v=x)
  if (cut.h.on && cut.h.j > 0 && cut.h.j < ny) {
    const jA = cut.h.j - 1;
    const isB = boundary[1][cut.h.j] === 1;
    const mask = new Int32Array(nz * nx);
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        if ((cut.v.on && verticalRemoved(cut.v, i, k)) || (cut.w.on && wedgeRemoved(cut.w, i, k))) continue;
        mask[i * nz + k] = capKey(data[idx(i, jA, k)], data[idx(i, cut.h.j, k)], isB, i, jA, k);
      }
    }
    greedy2D(mask, nz, nx, (key, a, b, w, h) => emitQuad(sinkFor((key >> 16) & 31), 1, cut.h.j, a, b, w, h, false, key & 0xff, AO_FULL, 1));
  }

  // --- corte vertical em x (d=0, u=y, v=z) ou z (d=2, u=x, v=y)
  if (cut.v.on && cut.v.idx > 0 && cut.v.idx < (cut.v.axis === 0 ? nx : nz)) {
    const d = cut.v.axis;
    const plane = cut.v.idx;
    const neg = cut.v.side < 0;
    const cA = neg ? plane : plane - 1;
    const cB = neg ? plane - 1 : plane;
    const isB = boundary[d][plane] === 1;
    if (d === 0) {
      const mask = new Int32Array(ny * nz);
      for (let k = 0; k < nz; k++) {
        if (cut.w.on && wedgeRemoved(cut.w, cA, k)) continue;
        for (let j = 0; j < ny; j++) {
          if (cut.h.on && j >= cut.h.j) continue;
          mask[k * ny + j] = capKey(data[idx(cA, j, k)], data[idx(cB, j, k)], isB, cA, j, k);
        }
      }
      greedy2D(mask, ny, nz, (key, a, b, w, h) => emitQuad(sinkFor((key >> 16) & 31), 0, plane, a, b, w, h, neg, key & 0xff, AO_FULL, 1));
    } else {
      const mask = new Int32Array(nx * ny);
      for (let j = 0; j < ny; j++) {
        if (cut.h.on && j >= cut.h.j) continue;
        for (let i = 0; i < nx; i++) {
          if (cut.w.on && wedgeRemoved(cut.w, i, cA)) continue;
          mask[j * nx + i] = capKey(data[idx(i, j, cA)], data[idx(i, j, cB)], isB, i, j, cA);
        }
      }
      greedy2D(mask, nx, ny, (key, a, b, w, h) => emitQuad(sinkFor((key >> 16) & 31), 2, plane, a, b, w, h, neg, key & 0xff, AO_FULL, 1));
    }
  }

  // --- cunha: colunas mantidas vizinhas de colunas removidas
  if (cut.w.on) {
    const rem = new Uint8Array(nx * nz);
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) rem[k * nx + i] = wedgeRemoved(cut.w, i, k) ? 1 : 0;
    const neighbors = [[1, 0, 0, false], [-1, 0, 0, true], [0, 1, 2, false], [0, -1, 2, true]];
    for (let k = 0; k < nz; k++) {
      for (let i = 0; i < nx; i++) {
        if (rem[k * nx + i]) continue;
        if (cut.v.on && verticalRemoved(cut.v, i, k)) continue;
        for (const [di, dk, d, neg] of neighbors) {
          const ni = i + di;
          const nk = k + dk;
          if (ni < 0 || nk < 0 || ni >= nx || nk >= nz || !rem[nk * nx + ni]) continue;
          const plane = d === 0 ? (neg ? i : i + 1) : neg ? k : k + 1;
          const isB = boundary[d][plane] === 1;
          let runStart = -1;
          let runKey = 0;
          const flush = (jEnd) => {
            if (runKey === 0) return;
            const sink = sinkFor((runKey >> 16) & 31);
            const mat = runKey & 0xff;
            if (d === 0) emitQuad(sink, 0, plane, runStart, k, jEnd - runStart, 1, neg, mat, AO_FULL, 1);
            else emitQuad(sink, 2, plane, i, runStart, 1, jEnd - runStart, neg, mat, AO_FULL, 1);
          };
          const jMax = cut.h.on ? Math.min(ny, cut.h.j) : ny;
          for (let j = 0; j < jMax; j++) {
            const key = capKey(data[idx(i, j, k)], data[idx(ni, j, nk)], isB, i, j, k);
            if (key !== runKey) {
              flush(j);
              runKey = key;
              runStart = j;
            }
          }
          flush(jMax);
        }
      }
    }
  }

  const out = [];
  sinks.forEach((sink, g) => {
    if (sink && sink.n) out.push({ group: g, translucent: 0, ...sink.export() });
  });
  return out;
}

/** Greedy 2D sobre uma máscara du × dv (índice b*du + a). */
function greedy2D(mask, du, dv, emit) {
  for (let b = 0; b < dv; b++) {
    const row = b * du;
    for (let a = 0; a < du;) {
      const key = mask[row + a];
      if (key === 0) { a++; continue; }
      let w = 1;
      while (a + w < du && mask[row + a + w] === key) w++;
      let h = 1;
      outer: while (b + h < dv) {
        const r2 = (b + h) * du + a;
        for (let q = 0; q < w; q++) if (mask[r2 + q] !== key) break outer;
        h++;
      }
      for (let hh = 0; hh < h; hh++) {
        const r2 = (b + hh) * du + a;
        for (let q = 0; q < w; q++) mask[r2 + q] = 0;
      }
      emit(key, a, b, w, h);
      a += w;
    }
  }
}

export { isRemoved };
