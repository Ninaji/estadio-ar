// Web Worker: gera a arena, monta as malhas, calcula tampas de corte e responde à seleção.
import { generateArena } from '../stadium/generate.js';
import { makeGroupInfo, meshGrid } from './mesher.js';
import { buildCaps } from './caps.js';
import { pickVoxel } from './pick.js';

let state = null;

const progress = (p, label) => postMessage({ type: 'progress', p, label });

function transferList(meshes) {
  const list = [];
  for (const m of meshes) list.push(m.pos.buffer, m.mi.buffer, m.idx.buffer);
  return list;
}

self.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'build') {
      const t0 = performance.now();
      progress(0.02, 'Preparando o terreno…');
      const { grid, dims, seats } = generateArena(msg.voxel, progress);
      const t1 = performance.now();
      const info = makeGroupInfo(dims);
      progress(0.7, 'Encaixando os voxels…');
      const meshes = meshGrid(grid, info, (f) => progress(0.7 + f * 0.28, 'Encaixando os voxels…'));
      const t2 = performance.now();
      // índice voxel → assento para a seleção
      const seatIndex = new Map();
      for (let s = 0; s < seats.length / 7; s++) seatIndex.set(grid.index(seats[s * 7], seats[s * 7 + 1], seats[s * 7 + 2]), s);
      state = { grid, dims, info, seats, seatIndex };
      let voxels = 0;
      for (let p = 0; p < grid.data.length; p++) if (grid.data[p]) voxels++;
      const quads = meshes.reduce((a, m) => a + m.quads, 0);
      const seatsCopy = seats.slice();
      postMessage(
        {
          type: 'built',
          dims,
          meshes,
          seats: seatsCopy,
          stats: { voxels, quads, seats: seats.length / 7, genMs: Math.round(t1 - t0), meshMs: Math.round(t2 - t1) },
        },
        [...transferList(meshes), seatsCopy.buffer],
      );
    } else if (msg.type === 'caps') {
      if (!state) return;
      const meshes = buildCaps(state.grid, state.info, msg.cut);
      postMessage({ type: 'caps', id: msg.id, meshes }, transferList(meshes));
    } else if (msg.type === 'pick') {
      if (!state) return;
      const hit = pickVoxel(state.grid, state.info, msg.origin, msg.dir, msg.cut, msg.hidden, msg.offsets);
      if (hit) {
        const s = state.seatIndex.get(state.grid.index(hit.i, hit.j, hit.k));
        if (s !== undefined) hit.seat = Array.from(state.seats.subarray(s * 7, s * 7 + 7));
      }
      postMessage({ type: 'pick', id: msg.id, hit });
    }
  } catch (err) {
    postMessage({ type: 'error', message: String(err && err.stack ? err.stack : err) });
  }
};
