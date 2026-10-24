// Gera a Arena Aurora inteira numa grade voxel. Roda dentro do Web Worker.
import { VoxelGrid, Column } from '../worker/grid.js';
import { isSeatMaterial } from './palette.js';
import { SECTORS, TIERS, FACADE_OUT, contourAt, sectorIndex, tierRowAt, gridDims } from './spec.js';
import { fillStrata, fillEsplanade, fillPitch } from './fill/ground.js';
import { fillSection, buildSeatMaterials } from './fill/bowl.js';
import { fillAisles, fillVomitories, fillAccessible, fillColumns, fillRakers, fillFacade } from './fill/features.js';
import { prepareRooms, fillRooms } from './fill/rooms.js';
import { fillVertical } from './fill/vertical.js';
import { fillRoof } from './fill/roof.js';
import { fillStamps } from './fill/stamps.js';

export function generateArena(voxel = 0.5, onProgress = () => {}) {
  const dims = gridDims(voxel);
  const grid = new VoxelGrid(dims);
  const col = new Column(dims);
  const seatMats = buildSeatMaterials(SECTORS);
  const rooms = prepareRooms();
  const { nx, ny, nz, data, sliceSize } = grid;

  // registro bruto de assentos: i, j, k, tier, setor, fila, posição de arco (×10)
  const raw = [];

  for (let k = 0; k < nz; k++) {
    const z = grid.cz(k);
    for (let i = 0; i < nx; i++) {
      const x = grid.cx(i);
      col.buf.fill(0);
      col.x = x;
      col.z = z;
      const c = contourAt(x, z, col.c);

      fillStrata(col);
      if (c.d < 0) fillPitch(col);
      else if (c.d < FACADE_OUT) {
        fillSection(col, seatMats);
        fillAisles(col);
        fillVomitories(col);
        fillAccessible(col);
        fillRooms(col, rooms);
        fillColumns(col);
        fillRakers(col);
        fillVertical(col);
        fillFacade(col);
      } else {
        fillEsplanade(col);
        fillVertical(col);
      }
      fillRoof(col);

      // copia para a grade e registra assentos
      const buf = col.buf;
      let p = k * nx + i;
      for (let j = 0; j < ny; j++, p += sliceSize) {
        const m = buf[j];
        if (m === 0) continue;
        data[p] = m;
        if (isSeatMaterial(m)) {
          const yb = col.yOf(j);
          for (let ti = 0; ti < TIERS.length; ti++) {
            const tr = tierRowAt(TIERS[ti], c.d);
            const center = yb + voxel / 2;
            if (tr && center >= tr.tread && center < tr.tread + 0.5) {
              raw.push(i, j, k, ti, sectorIndex(c.seg, c.t), tr.row, Math.round(c.sd * 10));
              break;
            }
          }
        }
      }
    }
    if ((k & 15) === 0) onProgress(0.05 + (0.6 * k) / nz, 'Erguendo a arena…');
  }

  fillStamps(grid);
  onProgress(0.68, 'Numerando assentos…');
  const seats = numberSeats(raw);
  return { grid, dims, seats };
}

/**
 * Numera os assentos dentro de cada (anel, setor, fila) no sentido horário.
 * Retorna Int32Array com 7 inteiros por assento: i, j, k, tier, setor, fila, número.
 */
function numberSeats(raw) {
  const n = raw.length / 7;
  const order = new Int32Array(n);
  for (let s = 0; s < n; s++) order[s] = s;
  const key = (s) => (raw[s * 7 + 3] * 64 + raw[s * 7 + 4]) * 64 + raw[s * 7 + 5];
  order.sort((a, b) => key(a) - key(b) || raw[a * 7 + 6] - raw[b * 7 + 6]);
  const out = new Int32Array(n * 7);
  let lastKey = -1;
  let num = 0;
  for (let q = 0; q < n; q++) {
    const s = order[q];
    const kk = key(s);
    if (kk !== lastKey) { lastKey = kk; num = 0; }
    num++;
    out.set([raw[s * 7], raw[s * 7 + 1], raw[s * 7 + 2], raw[s * 7 + 3], raw[s * 7 + 4], raw[s * 7 + 5], num], q * 7);
  }
  return out;
}
