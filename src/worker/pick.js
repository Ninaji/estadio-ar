// Seleção por raio: percorre a grade voxel a voxel (Amanatides–Woo) em unidades de grade.
import { MAT_CAT, MAT_TRANSLUCENT } from '../stadium/palette.js';
import { isRemoved } from '../slicing/cutPredicate.js';

/**
 * @param origin  [x,y,z] em unidades de grade
 * @param dir     [x,y,z] normalizado
 * @param accept  (i,j,k,mat) => boolean
 */
export function raycastGrid(grid, origin, dir, accept, maxT = 4000) {
  const { nx, ny, nz, data } = grid;
  const dims = [nx, ny, nz];
  // entra na caixa da grade
  let tMin = 0;
  let tMax = maxT;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(dir[a]) < 1e-12) {
      if (origin[a] < 0 || origin[a] > dims[a]) return null;
      continue;
    }
    let t0 = (0 - origin[a]) / dir[a];
    let t1 = (dims[a] - origin[a]) / dir[a];
    if (t0 > t1) [t0, t1] = [t1, t0];
    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);
  }
  if (tMin > tMax) return null;
  const p = [0, 1, 2].map((a) => origin[a] + dir[a] * (tMin + 1e-4));
  const cell = p.map((v, a) => Math.min(dims[a] - 1, Math.max(0, Math.floor(v))));
  const step = dir.map((v) => (v > 0 ? 1 : -1));
  const tDelta = dir.map((v) => (Math.abs(v) < 1e-12 ? Infinity : Math.abs(1 / v)));
  const tNext = [0, 1, 2].map((a) => {
    if (Math.abs(dir[a]) < 1e-12) return Infinity;
    const boundary = step[a] > 0 ? cell[a] + 1 : cell[a];
    return tMin + (boundary - p[a]) / dir[a];
  });
  let t = tMin;
  let face = -1;
  for (let guard = 0; guard < 6000; guard++) {
    const [i, j, k] = cell;
    const m = data[(j * nz + k) * nx + i];
    if (m !== 0 && accept(i, j, k, m)) return { i, j, k, mat: m, t, face };
    const a = tNext[0] < tNext[1] ? (tNext[0] < tNext[2] ? 0 : 2) : tNext[1] < tNext[2] ? 1 : 2;
    t = tNext[a];
    if (t > tMax) return null;
    cell[a] += step[a];
    if (cell[a] < 0 || cell[a] >= dims[a]) return null;
    tNext[a] += tDelta[a];
    face = a * 2 + (step[a] > 0 ? 1 : 0);
  }
  return null;
}

/**
 * Seleção considerando cortes, categorias ocultas e a desmontagem (deslocamento por grupo).
 * offsets: Float32Array(grupos*3) em unidades de grade ou null.
 */
export function pickVoxel(grid, info, origin, dir, cut, hiddenMask, offsets) {
  const { levelJ, qI, qK, groupCount } = info;
  const baseAccept = (i, j, k, m) =>
    !MAT_TRANSLUCENT[m] && !((hiddenMask >> MAT_CAT[m]) & 1) && !isRemoved(cut, i, j, k);
  if (!offsets) return raycastGrid(grid, origin, dir, baseAccept);
  let best = null;
  for (let g = 0; g < groupCount; g++) {
    const o = [origin[0] - offsets[g * 3], origin[1] - offsets[g * 3 + 1], origin[2] - offsets[g * 3 + 2]];
    const hit = raycastGrid(grid, o, dir, (i, j, k, m) => levelJ[j] * 4 + qI[i] + qK[k] === g && baseAccept(i, j, k, m));
    if (hit && (!best || hit.t < best.t)) best = hit;
  }
  return best;
}
