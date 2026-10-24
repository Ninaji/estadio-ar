// Cobertura: treliças radiais, anel de compressão, membrana translúcida,
// faixa de refletores, passarela técnica, calha e telões.
import { MAT } from '../palette.js';
import { ROOF, AISLES, nearestLine } from '../spec.js';

const mod = (a, n) => ((a % n) + n) % n;

export function roofTop(d) {
  return ROOF.yIn + ((ROOF.yOut - ROOF.yIn) * (d - ROOF.dIn)) / (ROOF.dOut - ROOF.dIn);
}

export function fillRoof(col) {
  const { d, seg, t, side, u } = col.c;
  if (d < ROOF.dIn || d >= ROOF.dOut) return;
  const yTop = Math.round(roofTop(d) * 2) / 2;
  const depth = 1 + (3 * (d - ROOF.dIn)) / (ROOF.dOut - ROOF.dIn);
  const yBot = Math.round((yTop - depth) * 2) / 2;
  const rel = d - ROOF.dIn;

  col.set(yTop, yTop + 0.5, MAT.membrana);

  const truss = nearestLine(seg, t, d, AISLES[seg]).dist < 0.5;
  if (truss) {
    col.set(yTop - 0.5, yTop + 0.5, MAT.trelica_escura);
    col.set(yBot, yBot + 0.5, MAT.trelica_escura);
    const panel = Math.floor(rel / 6);
    const f = mod(rel, 6) / 6;
    if (mod(rel, 6) < 0.5) col.set(yBot, yTop, MAT.trelica);
    const yd = yBot + (panel % 2 === 0 ? f : 1 - f) * (yTop - yBot);
    col.set(yd - 0.25, yd + 0.25, MAT.trelica);
  }

  if (rel < 1) col.set(yTop - 1.5, yTop + 0.5, MAT.trelica_escura); // anel de compressão
  else if (rel < 2) col.set(yTop - 2, yTop - 1, MAT.refletor);
  else if (rel < 3.5) {
    col.set(yTop - 3, yTop - 2.5, MAT.passarela);
    if (rel >= 3) col.set(yTop - 2.5, yTop - 1.5, MAT.corrimao);
  }
  if (d >= ROOF.dOut - 1) col.set(yTop - 0.5, yTop + 1, MAT.calha);

  // telões atrás dos gols
  if ((side === 'N' || side === 'S') && Math.abs(u) < 12 && rel >= 1 && rel < 2) col.set(33, 39, MAT.telao);
  if ((side === 'N' || side === 'S') && Math.abs(u) < 12 && rel >= 2 && rel < 2.5) col.set(33, 39, MAT.trelica_escura);
}
