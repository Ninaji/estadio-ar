// Objetos avulsos carimbados na grade depois das colunas: traves, bandeirinhas,
// bancos de reservas, túnel inflável, árvores, postes, bilheterias e a placa da maquete.
import { MAT } from '../palette.js';
import { PITCH, GATES, FACADE_OUT, HALF_X, HALF_Z, pointAt, contourAt } from '../spec.js';

const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function hash(a, b) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function goals(g) {
  const y0 = PITCH.y;
  for (const sz of [-1, 1]) {
    const zl = sz * PITCH.halfL;
    const zb = sz * (PITCH.halfL + 2);
    const zMin = Math.min(zl, zb);
    const zMax = Math.max(zl, zb);
    // rede (casca translúcida) e traves
    g.box(-3.75, y0, zMin, 3.75, y0 + 2.5, zMax, MAT.rede);
    g.box(-3.25, y0, zMin + (sz > 0 ? 0 : 0.5), 3.25, y0 + 2.0, zMax - (sz > 0 ? 0.5 : 0), 0);
    for (const sx of [-1, 1]) g.box(sx * 3.75 - 0.25, y0, zl - 0.25, sx * 3.75 + 0.25, y0 + 2.5, zl + 0.25, MAT.trave);
    g.box(-4, y0 + 2.5, zl - 0.25, 4, y0 + 3, zl + 0.25, MAT.trave);
    // bandeirinhas
    for (const sx of [-1, 1]) {
      g.box(sx * PITCH.halfW - 0.25, y0, zl - 0.25, sx * PITCH.halfW + 0.25, y0 + 1.5, zl + 0.25, MAT.trave);
      g.box(sx * PITCH.halfW - 0.25 + sx * 0.5, y0 + 1, zl - 0.25, sx * PITCH.halfW + 0.25 + sx * 0.5, y0 + 1.5, zl + 0.25, MAT.bandeira);
    }
  }
}

function benches(g) {
  const y0 = PITCH.y;
  for (const [z0, z1] of [[-19, -6], [6, 19]]) {
    g.box(-40, y0, z0, -39, y0 + 1, z1, MAT.banco_reservas);
    g.box(-40.5, y0, z0, -40, y0 + 1.5, z1, MAT.banco_reservas);
    g.box(-41, y0 + 2, z0 - 0.5, -37.5, y0 + 2.5, z1 + 0.5, MAT.cobertura_banco);
    g.box(-41, y0, z0 - 0.5, -40.5, y0 + 2, z1 + 0.5, MAT.cobertura_banco);
  }
  // túnel inflável do gramado até a boca do túnel dos jogadores
  g.box(-43, y0 + 3, -2.5, -37, y0 + 3.5, 2.5, MAT.cobertura_banco);
  g.box(-43, y0, -2.5, -37, y0 + 3, -2, MAT.cobertura_banco);
  g.box(-43, y0, 2, -37, y0 + 3, 2.5, MAT.cobertura_banco);
}

function tree(g, x, z, h, bloom) {
  g.box(x - 0.25, 0, z - 0.25, x + 0.25, h, z + 0.25, MAT.tronco);
  const r = 1.5 + h * 0.25;
  const crown = bloom ? MAT.copa_b : MAT.copa;
  for (let dy = 0; dy < r * 1.6; dy += 0.5) {
    const rr = r * Math.sqrt(1 - ((dy - r * 0.8) / (r * 0.8 + 0.01)) ** 2);
    if (!(rr > 0.3)) continue;
    for (let dx = -rr; dx <= rr; dx += 0.5) {
      for (let dz = -rr; dz <= rr; dz += 0.5) {
        if (dx * dx + dz * dz <= rr * rr) g.setAt(x + dx, h - 0.5 + dy, z + dz, crown);
      }
    }
  }
}

function esplanade(g) {
  // árvores nos cantos da maquete, fora das rampas
  for (let x = -HALF_X + 4; x <= HALF_X - 4; x += 7) {
    for (let z = -HALF_Z + 4; z <= HALF_Z - 4; z += 7) {
      const jx = x + (hash(x, z) - 0.5) * 3;
      const jz = z + (hash(z, x) - 0.5) * 3;
      const c = contourAt(jx, jz);
      if (c.d < 75 || Math.abs(jx) > HALF_X - 3 || Math.abs(jz) > HALF_Z - 3) continue;
      tree(g, jx, jz, 3 + hash(jx, jz) * 2.5, hash(jz, jx) > 0.7);
    }
  }
  // postes de luz ao redor da fachada
  for (let i = 0; i < 64; i++) {
    const seg = [0, 2, 4, 6, 8][i % 5];
    const p = pointAt(seg, (i * 7.3) % (seg === 4 ? 92 : seg === 2 || seg === 6 ? 54 : 46), FACADE_OUT + 3);
    if (Math.abs(p.x) > HALF_X - 1 || Math.abs(p.z) > HALF_Z - 1) continue;
    g.box(p.x - 0.25, 0, p.z - 0.25, p.x + 0.25, 4, p.z + 0.25, MAT.poste);
    g.box(p.x - 0.5, 4, p.z - 0.5, p.x + 0.5, 4.5, p.z + 0.5, MAT.luminaria);
  }
  // bilheterias ao lado de cada portão
  for (const gate of GATES) {
    for (const off of [-5.5, 5.5]) {
      const p = pointAt(gate.seg, gate.t, FACADE_OUT + 2.5);
      const tx = -p.nz;
      const tz = p.nx;
      const cx = p.x + tx * off;
      const cz = p.z + tz * off;
      if (Math.abs(cx) > HALF_X - 1.5 || Math.abs(cz) > HALF_Z - 1.5) continue;
      g.box(cx - 1.25, 0, cz - 1.25, cx + 1.25, 2.5, cz + 1.25, MAT.bilheteria);
      g.box(cx - 1.5, 2.5, cz - 1.5, cx + 1.5, 3, cz + 1.5, MAT.balcao);
    }
  }
}

/** Placa dourada com "ARENA AURORA" em pixels, na face sul da base da maquete. */
function plaque(g) {
  const text = 'ARENA AURORA';
  const px = g.voxel;
  const width = text.length * 6 * px;
  const x0 = -width / 2;
  const yTop = -1;
  const z0 = HALF_Z - px;
  g.box(x0 - 2, yTop - 7 * px - 2, z0, x0 + width + 1.5, yTop + 1, HALF_Z, MAT.placa);
  for (let ci = 0; ci < text.length; ci++) {
    const glyph = FONT[text[ci]];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (glyph[r][c] !== '1') continue;
        const x = x0 + (ci * 6 + c) * px;
        const y = yTop - (r + 1) * px;
        g.box(x, y, z0, x + px, y + px, HALF_Z, MAT.base_maquete);
      }
    }
  }
}

export function fillStamps(g) {
  goals(g);
  benches(g);
  esplanade(g);
  plaque(g);
}
