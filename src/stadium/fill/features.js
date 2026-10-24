// Elementos que dependem da posição ao longo do contorno: corredores, vomitórios,
// espaços PCD, pilares, fachada e portões.
import { MAT } from '../palette.js';
import {
  TIERS, AISLES, AISLE_HALF, VOMITORIES, VOM_HALF, COLUMN_LINES, COLUMN_D, GATES, GATE_HALF, GATE_H,
  FACADE_D, FACADE_OUT, ROOF, tierRowAt, nearestLine, arcAt,
} from '../spec.js';

const mod = (a, n) => ((a % n) + n) % n;

/** Escadas radiais da arquibancada: sem assento, degrau amarelo. */
export function fillAisles(col) {
  const { d, seg, t } = col.c;
  const near = nearestLine(seg, t, d, AISLES[seg]);
  if (near.dist >= AISLE_HALF) return;
  for (const tier of TIERS) {
    const tr = tierRowAt(tier, d);
    if (!tr) continue;
    col.set(tr.tread - 0.5, tr.tread, MAT.degrau_corredor);
    col.carve(tr.tread, tr.tread + 0.5);
  }
}

/**
 * Vomitórios: túnel do concourse até o meio da arquibancada. Na "boca" (filas entre
 * o piso do túnel e o teto) as filas são removidas e ladeadas por muretas.
 */
export function fillVomitories(col) {
  const { d, seg, t } = col.c;
  const near = nearestLine(seg, t, d, VOMITORIES[seg]);
  if (near.dist >= VOM_HALF + 0.5) return;
  const inside = near.dist < VOM_HALF;
  for (const tier of TIERS) {
    if (d < tier.d0 || d >= tier.vomEnd) continue;
    const f = tier.vomFloor;
    const top = f + tier.vomH;
    const tr = tierRowAt(tier, d);
    if (tr && tr.tread < f) continue; // filas abaixo do túnel continuam
    const mouth = tr && tr.tread < top + 0.5;
    if (inside) {
      if (mouth) {
        col.carve(f, tr.tread + 1.5);
        // mantém o guarda-corpo de vidro na frente dos anéis superiores
        if (tier.d0 > 0 && tr.row === 0 && tr.frac < 0.5) col.set(f, tr.tread + 1, MAT.vidro);
      }
      else {
        col.carve(f, top);
        col.fillAir(top, top + 0.5, MAT.concreto);
      }
      col.set(f - 0.5, f, MAT.piso_vomitorio);
    } else if (mouth) {
      col.set(tr.tread, top + 0.5, MAT.concreto);
    } else {
      col.fillAir(f - 0.5, top + 0.5, MAT.concreto);
    }
  }
}

/** Plataformas para cadeira de rodas ao lado dos vomitórios do anel inferior, no nível do túnel. */
export function fillAccessible(col) {
  const { d, seg, t } = col.c;
  if (d < 9 || d >= 11) return;
  const near = nearestLine(seg, t, d, VOMITORIES[seg]);
  if (near.dist < VOM_HALF + 0.5 || near.dist >= VOM_HALF + 3.5) return;
  col.carve(0, 1.5);
  col.set(-1, -0.5, MAT.concreto);
  col.set(-0.5, 0, MAT.espaco_pcd);
}

/** Pilares e estacas nas linhas estruturais (divisas de setor). */
export function fillColumns(col) {
  const { d, seg, t, side, u } = col.c;
  const near = nearestLine(seg, t, d, COLUMN_LINES[seg]);
  if (near.dist >= 1.0) return;
  if (side === 'W' && Math.abs(u) < 3) return; // eixo do túnel e da zona mista
  for (const dc of COLUMN_D) {
    const dd = Math.abs(d - dc);
    if (dd >= 1.0) continue;
    col.set(-8, -6.5, MAT.bloco_fundacao);
    if (near.dist >= 0.5 || dd >= 0.5) continue;
    col.set(-13, -8, MAT.estaca);
    if (dc < 20) {
      const tr = tierRowAt(TIERS[0], d);
      col.fillAir(-1, tr ? tr.tread - 1 : 0, MAT.concreto_escuro);
    } else {
      col.fillAir(-6, 17, MAT.concreto_escuro);
    }
  }
}

/** Vigas-jacaré sob as lajes dos anéis intermediário e superior. */
export function fillRakers(col) {
  const { d, seg, t } = col.c;
  const near = nearestLine(seg, t, d, AISLES[seg]);
  if (near.dist >= 0.25) return;
  for (const ti of [1, 2]) {
    const tr = tierRowAt(TIERS[ti], d);
    if (!tr) continue;
    col.fillAir(tr.tread - 2, tr.tread - 1, MAT.concreto_escuro);
  }
}

/** Fachada com brises, vidro, painéis LED, mastros da cobertura e portões com catracas. */
export function fillFacade(col) {
  const { d, seg, t, sd } = col.c;
  if (d < FACADE_D || d >= FACADE_OUT) return;
  const outer = d >= FACADE_OUT - 0.5;
  const roofTop = ROOF.yIn + ((ROOF.yOut - ROOF.yIn) * (d - ROOF.dIn)) / (ROOF.dOut - ROOF.dIn);

  col.set(-6.5, 0, MAT.concreto);
  const mast = nearestLine(seg, t, d, AISLES[seg]).dist < 0.75;
  if (mast) {
    col.set(0, roofTop, MAT.pilar_fachada);
  } else if (outer) {
    // pele única: faixas horizontais + brises verticais como padrão de cor
    const fin = mod(sd, 3) < 0.5;
    col.set(0, 7, fin ? MAT.brise : MAT.vidro_fachada);
    col.set(7, 8, MAT.brise);
    col.set(8, 17, fin ? MAT.brise : MAT.vidro_fachada);
    col.set(17, 18, MAT.brise);
    for (let y = 18; y < 30; y += 4) {
      const led = (Math.floor(sd / 6) + Math.floor(y / 4)) % 2 === 0;
      col.set(y, y + 4, led ? MAT.fachada_led : fin ? MAT.brise : MAT.vidro_fachada);
    }
    col.set(30, 44, fin || mod(sd, 6) < 3 ? MAT.brise : MAT.vidro_fachada);
  }

  // portões
  for (const g of GATES) {
    if (g.seg !== seg) continue;
    const gsd = arcAt(seg, g.t, d);
    const off = sd - gsd;
    if (Math.abs(off) >= GATE_HALF) continue;
    col.carve(0, GATE_H);
    col.set(GATE_H, GATE_H + 1, MAT.portao);
    if (d >= FACADE_D + 0.5 && d < FACADE_D + 1 && mod(off + GATE_HALF, 1) < 0.5) col.set(0, 1, MAT.catraca);
  }
  // aberturas das passarelas das rampas (cantos)
  if (col.c.corner && Math.abs(t - Math.PI / 4) * (16 + d) < 1.5) {
    col.carve(8, 10.5);
    col.carve(18, 20.5);
  }
}
