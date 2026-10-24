// Seção típica do estádio: lajes, concourses, subsolo e os três anéis de arquibancada.
import { MAT } from '../palette.js';
import { TIERS, tierRowAt, sectorIndex, seatMaterialKey, FACADE_D } from '../spec.js';

/** Escreve o perfil da seção para uma coluna com 0 ≤ d < fachada. */
export function fillSection(col, seatMats) {
  const d = col.c.d;

  // --- subsolo (nível do campo) e lajes do térreo ---------------------------
  if (d < 16) {
    col.carve(-9.5, 0); // o aterro sob o anel inferior é refeito abaixo, até a laje
  } else if (d < 18) {
    col.set(-9.5, -1, MAT.aterro);
    col.set(-1, -0.5, MAT.laje);
    col.set(-0.5, 0, MAT.piso_circulacao);
  } else if (d < FACADE_D) {
    col.set(-9.5, -6.5, MAT.aterro);
    col.set(-6.5, -6, MAT.laje);
    col.carve(-6, -1);
    col.set(-1, -0.5, MAT.laje);
    col.set(-0.5, 0, MAT.piso_circulacao);
    if (d >= FACADE_D - 0.5) col.set(-6.5, -1, MAT.concreto); // muro de arrimo
  }

  // --- nível clube, camarotes e concourse superior ------------------------
  if (d >= 27 && d < FACADE_D) {
    col.set(7, 7.5, MAT.laje);
    col.set(7.5, 8, MAT.piso_camarote);
  }
  if (d >= 27 && d < 38.5) {
    col.set(11, 11.5, MAT.laje);
    col.set(11.5, 12, MAT.piso_camarote);
    col.set(16, 16.5, MAT.laje);
    if (d < 27.5) col.set(12, 16, MAT.vidro); // vidro frontal dos camarotes
    if (d >= 38) col.set(12, 16, MAT.parede);
  }
  if (d >= 36 && d < FACADE_D) {
    col.set(17, 17.5, MAT.laje);
    col.set(17.5, 18, MAT.piso_circulacao);
  }

  // --- anéis de arquibancada ----------------------------------------------
  const sector = sectorIndex(col.c.seg, col.c.t);
  for (let ti = 0; ti < TIERS.length; ti++) {
    const tier = TIERS[ti];
    const tr = tierRowAt(tier, d);
    if (!tr) continue;
    const { tread, frac } = tr;
    if (ti === 0) {
      // anel inferior apoiado no aterro / cunha de concreto
      if (d < 16) {
        col.set(-9.5, Math.min(tread - 1, 0), MAT.aterro);
        if (tread - 1 > 0) col.set(0, tread - 1, MAT.concreto);
      }
    }
    col.set(tread - 1, tread - 0.5, MAT.concreto);
    col.set(tread - 0.5, tread, MAT.piso_arquibancada);
    col.carve(tread, tread + 0.5);
    if (tr.row === tier.crossRow) col.set(tread - 0.5, tread, MAT.piso_circulacao);
    else if (frac >= 0.5 && sector >= 0) col.set(tread, tread + 0.5, seatMats[sector][ti]);
    // guarda-corpos frontais
    if (tr.row === 0 && frac < 0.5) {
      if (ti === 0) col.set(-6.5, tread + 1, MAT.concreto);
      else col.set(tread, tread + 1, MAT.vidro);
    }
  }
  // guarda-corpo do fundo do anel inferior
  if (d >= 22 && d < 22.5) col.set(6, 7, MAT.guarda_corpo);
}

/** Tabela [setor][anel] → id do material do assento. */
export function buildSeatMaterials(sectors) {
  return sectors.map((_, si) => TIERS.map((_, ti) => MAT[seatMaterialKey(si, ti)]));
}
