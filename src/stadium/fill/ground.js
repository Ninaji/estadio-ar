// Terreno (camadas do solo), gramado em camadas e esplanada.
import { MAT } from '../palette.js';
import { PITCH, Y_MIN, Y_MAX, FACADE_OUT, HALF_X, HALF_Z } from '../spec.js';

const mod = (a, n) => ((a % n) + n) % n;

/** Estratos do solo com ondulações suaves — viram "camadas de bolo" nos cortes. */
export function fillStrata(col) {
  const { x, z } = col;
  const w1 = Math.sin(x * 0.045) * Math.cos(z * 0.037) * 1.2;
  const w2 = Math.sin(x * 0.021 + 1.7) * Math.sin(z * 0.029) * 1.0;
  col.set(Y_MIN, Y_MIN + 1, MAT.base_maquete);
  col.set(Y_MIN + 1, -10.5 + w1, MAT.rocha);
  col.set(-10.5 + w1, -6.5 + w2, MAT.argila);
  col.set(-6.5 + w2, -2.5 + w1 * 0.5, MAT.solo);
  col.set(-2.5 + w1 * 0.5, 0, MAT.terra);
}

/** Esplanada externa: piso desenhado, jardins nas bordas da maquete. */
export function fillEsplanade(col) {
  const { x, z } = col;
  const edge = Math.min(HALF_X - Math.abs(x), HALF_Z - Math.abs(z));
  if (edge < 2.5) {
    col.set(-0.5, 0, MAT.jardim);
    return;
  }
  const d = col.c.d;
  const ring = mod(d - FACADE_OUT, 6) < 0.5;
  const ray = mod(col.c.sd, 8) < 0.5;
  col.set(-0.5, 0, ring || ray ? MAT.piso_esplanada_b : MAT.piso_esplanada);
  if (d > 68 && edge > 4 && Math.abs(x) > 72 && Math.abs(z) > 92) col.set(-0.5, 0, MAT.jardim);
}

function grassMaterial(col) {
  const { x, z, v } = col;
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const inPitch = ax <= PITCH.halfW && az <= PITCH.halfL;
  if (!inPitch) return MAT.grama_entorno;

  // Linhas (largura de um voxel, do lado de dentro de cada marcação).
  const onX = (L) => ax >= L - v && ax < L;
  const onZ = (L) => az >= L - v && az < L;
  const tol = v * 0.62;
  if (onX(PITCH.halfW) || onZ(PITCH.halfL)) return MAT.linha;
  if (z >= 0 && z < v) return MAT.linha; // linha do meio
  const rc = Math.hypot(x, z);
  if (Math.abs(rc - 9.15) < tol || rc < v * 0.8) return MAT.linha;
  // grande área (16,5 m) e pequena área (5,5 m)
  const pa = PITCH.halfL - 16.5;
  if (onZ(pa + v) && ax < 20.16 && az >= pa) return MAT.linha;
  if (onX(20.16) && az >= pa) return MAT.linha;
  const ga = PITCH.halfL - 5.5;
  if (onZ(ga + v) && ax < 9.16 && az >= ga) return MAT.linha;
  if (onX(9.16) && az >= ga) return MAT.linha;
  // marca do pênalti e meia-lua
  const ps = PITCH.halfL - 11;
  const rp = Math.hypot(x, az - ps);
  if (rp < v * 0.8) return MAT.linha;
  if (Math.abs(rp - 9.15) < tol && az < pa) return MAT.linha;
  // arcos de escanteio
  if (Math.abs(Math.hypot(ax - PITCH.halfW, az - PITCH.halfL) - 1) < tol) return MAT.linha;
  // aspersores pop-up
  if (mod(x + 8, 16) < v && mod(z + 8, 16) < v) return MAT.aspersor;
  // faixas de corte da grama
  return Math.floor((z + PITCH.halfL) / 5.25) % 2 === 0 ? MAT.grama_a : MAT.grama_b;
}

/** Gramado rebaixado com todas as camadas construtivas (espessura exagerada). */
export function fillPitch(col) {
  const { x, z, v } = col;
  const d = col.c.d;
  col.carve(-9.5, Y_MAX);
  col.set(-9.5, -8.5, MAT.subleito);
  col.set(-8.5, -7.5, MAT.brita);
  col.set(-7.5, -7.0, MAT.transicao);
  col.set(-7.0, -6.5, MAT.zona_raizes);
  col.set(-6.5, -6.0, grassMaterial(col));

  const ax = Math.abs(x);
  const az = Math.abs(z);
  // drenagem em espinha de peixe: coletor central + ramais a 45°
  const collector = ax < v * 0.6;
  const lateral = mod(ax + az, 7) < v;
  const perimeter = d > -1.0 && d <= -0.5;
  if ((collector || lateral) && az < PITCH.halfL + 4) col.set(-8.5, -8.0, MAT.tubo_drenagem);
  if (perimeter) col.set(-8.5, -7.5, MAT.tubo_drenagem);
  // tubos de aquecimento sob a zona de raízes
  if (ax <= PITCH.halfW + 2 && az <= PITCH.halfL + 2 && mod(z, 2) < v) col.set(-7.0, -6.5, MAT.tubo_aquecimento);

  // placas de publicidade LED em volta do campo
  if (d >= -2.5 && d < -2.5 + v) {
    const benches = col.c.side === 'W' && Math.abs(z) < 21;
    if (!benches) col.set(-6, -5, MAT.placa_led);
  }
}
