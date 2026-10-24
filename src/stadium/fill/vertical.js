// Circulação vertical: escadas em caixa, elevadores, escadas rolantes e rampas helicoidais.
import { MAT } from '../palette.js';
import { STAIRS, ELEVATORS, ESCALATORS, RAMPS, RAMP, FACADE_OUT } from '../spec.js';

const mod = (a, n) => ((a % n) + n) % n;
const LANDING = 2;

function inBox(col, b) {
  const { side, u, d, corner } = col.c;
  if (corner || side !== b.side) return null;
  if (u < b.u0 || u >= b.u1 || d < b.d0 || d >= b.d1) return null;
  return { lu: u - b.u0, ld: d - b.d0, w: b.u1 - b.u0, dd: b.d1 - b.d0 };
}

/** Escada de lances em zigue-zague: lance 1 sobe em +u, patamar, lance 2 volta em −u. */
function fillStair(col, b, p) {
  const { lu, ld, w, dd } = p;
  const { v } = col;
  const levels = b.levels;
  const yTop = levels[levels.length - 1];
  col.carve(levels[0], yTop);
  col.set(levels[0] - 0.5, levels[0], MAT.escada);
  const half1 = ld < dd / 2 - 0.25;
  const half2 = ld >= dd / 2 + 0.25;
  for (let k = 0; k + 1 < levels.length; k++) {
    const ya = levels[k];
    const yb = levels[k + 1];
    const half = (yb - ya) / 2;
    const run = half * 2;
    const x = lu - LANDING;
    if (x >= run) {
      col.set(ya + half - 0.5, ya + half, MAT.escada); // patamar intermediário
    } else if (x >= 0) {
      const n = Math.floor(x);
      if (half1) col.set(ya + (n + 1) * 0.5 - 0.5, ya + (n + 1) * 0.5, MAT.escada);
      else if (half2) col.set(yb - n * 0.5 - 0.5, yb - n * 0.5, MAT.escada);
      else col.set(ya - 0.5, yb, MAT.corrimao); // parede central entre os lances
    } else {
      col.set(yb - 0.5, yb, MAT.escada); // patamar no piso de chegada
    }
  }
  // guarda-corpo no vão da escada (menos no lado do patamar de acesso)
  const edge = lu >= w - v || ld < v || ld >= dd - v;
  if (edge && lu >= LANDING) for (const y of levels.slice(1)) col.set(y, y + 1, MAT.corrimao);
}

function fillElevator(col, b, p) {
  const { lu, ld, w, dd } = p;
  const { v } = col;
  col.carve(b.y0, b.y1 + 3);
  const wall = lu < v || lu >= w - v || ld < v || ld >= dd - v;
  if (wall) {
    col.set(b.y0 - 0.5, b.y1 + 3, MAT.poco_elevador);
    if (ld < v && lu >= 1 && lu < w - 1) {
      for (const y of [-6, 0, 8, 18]) if (y >= b.y0 && y <= b.y1) col.carve(y, y + 2.5);
    }
  } else {
    col.set(b.y0 - 0.5, b.y0, MAT.concreto);
  }
  col.set(b.y1 + 3, b.y1 + 4, MAT.concreto); // casa de máquinas
}

function fillEscalator(col, b, p) {
  const { lu, ld, w } = p;
  const rise = b.y1 - b.y0;
  const start = 2;
  const run = w - 4;
  const x = lu - start;
  const balustrade = ld < 0.5 || (ld >= 1.5 && ld < 2.0) || ld >= 3.0;
  let surface;
  if (x < 0) surface = b.y0;
  else if (x >= run) surface = b.y1;
  else surface = b.y0 + Math.floor((x / run) * rise * 2 + 1) * 0.5;
  if (x >= 0 && x < run + 2) col.carve(b.y0, b.y1 + 0.01);
  col.set(surface - 0.5, surface, MAT.escada_rolante);
  if (x >= 0 && x < run) col.set(surface - 1.5, surface - 0.5, MAT.corrimao);
  if (balustrade) col.set(surface, surface + 1, MAT.corrimao);
}

/** Rampa helicoidal: superfícies y_k(φ) = (φ/2π + k)·passo + fase. */
function fillRamp(col, ramp) {
  const dx = col.x - ramp.x;
  const dz = col.z - ramp.z;
  const rho = Math.hypot(dx, dz);
  const { rIn, rOut, risePerTurn: rise, y0, y1 } = RAMP;
  // ponte até a fachada (direção para o centro do estádio)
  const along = -(dx * ramp.nx + dz * ramp.nz);
  const across = Math.abs(dx * ramp.nz - dz * ramp.nx);
  const toFacade = RAMP.dCenter - FACADE_OUT + 1;
  if (along > rIn && along < toFacade && across < 2) {
    for (const y of [8, 18]) {
      if (across < 1.5) col.set(y - 0.5, y, MAT.rampa);
      else if (along > rOut) col.set(y - 0.5, y + 1, MAT.corrimao);
    }
  }
  if (rho > rOut + 0.5) return;
  if (rho < rIn - 0.5) {
    col.set(y0 - 0.5, y1 + 3, MAT.concreto);
    return;
  }
  let phi = Math.atan2(dz, dx);
  if (phi < 0) phi += Math.PI * 2;
  const bridgePhi = mod(Math.atan2(-ramp.nz, -ramp.nx), Math.PI * 2);
  const phase = mod(8 - (bridgePhi / (Math.PI * 2)) * rise, rise);
  const base = (phi / (Math.PI * 2)) * rise + phase;
  for (let k = -1; k < 8; k++) {
    const y = base + k * rise;
    if (y < y0 || y > y1 + 0.01) continue;
    const ys = Math.round(y * 2) / 2;
    if (rho < rOut) col.set(ys - 0.5, ys, MAT.rampa);
    else col.set(ys - 0.5, ys + 1, MAT.corrimao);
  }
  if (rho < rIn) col.set(y1, y1 + 3, MAT.concreto);
}

export function fillVertical(col) {
  for (const b of STAIRS) {
    const p = inBox(col, b);
    if (p) fillStair(col, b, p);
  }
  for (const b of ELEVATORS) {
    const p = inBox(col, b);
    if (p) fillElevator(col, b, p);
  }
  for (const b of ESCALATORS) {
    const p = inBox(col, b);
    if (p) fillEscalator(col, b, p);
  }
  if (col.c.corner && col.c.d > RAMP.dCenter - RAMP.rOut - 12) for (const r of RAMPS) fillRamp(col, r);
}
