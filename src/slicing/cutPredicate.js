// Predicado de corte compartilhado entre o worker (tampas, seleção) e o shader.
// O shader reproduz exatamente esta lógica usando o centro do voxel em unidades de grade.
//
// Estado do corte (unidades de grade):
//   h: { on, j }                 remove voxels com j >= h.j            (planta baixa)
//   v: { on, axis: 0|2, idx, side } remove i|k >= idx (side 1) ou < idx (side −1)
//   w: { on, cx, cz, a0, aw }     remove a cunha de ângulo [a0, a0 + aw) ao redor de (cx, cz)

export const TWO_PI = Math.PI * 2;

export function emptyCut() {
  return {
    h: { on: false, j: 0 },
    v: { on: false, axis: 0, idx: 0, side: 1 },
    w: { on: false, cx: 0, cz: 0, a0: 0, aw: 0 },
  };
}

export function wedgeRemoved(w, i, k) {
  const a = Math.atan2(k + 0.5 - w.cz, i + 0.5 - w.cx);
  const da = (((a - w.a0) % TWO_PI) + TWO_PI) % TWO_PI;
  return da < w.aw;
}

export function verticalRemoved(v, i, k) {
  const c = v.axis === 0 ? i : k;
  return v.side > 0 ? c >= v.idx : c < v.idx;
}

export function isRemoved(cut, i, j, k) {
  if (cut.h.on && j >= cut.h.j) return true;
  if (cut.v.on && verticalRemoved(cut.v, i, k)) return true;
  if (cut.w.on && wedgeRemoved(cut.w, i, k)) return true;
  return false;
}

export function anyCut(cut) {
  return cut.h.on || cut.v.on || cut.w.on;
}
