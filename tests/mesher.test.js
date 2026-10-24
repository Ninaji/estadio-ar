import { describe, it, expect } from 'vitest';
import { VoxelGrid } from '../src/worker/grid.js';
import { meshGrid, makeGroupInfo } from '../src/worker/mesher.js';
import { buildCaps } from '../src/worker/caps.js';
import { MAT } from '../src/stadium/palette.js';
import { isRemoved, emptyCut } from '../src/slicing/cutPredicate.js';

const dims = { nx: 8, ny: 8, nz: 8, ox: -2, oy: -14, oz: -2, voxel: 0.5 };
const visibleQuads = (out) => out.filter((m) => m.set === 0).reduce((a, m) => a + m.quads, 0);

describe('mesher', () => {
  it('cubo isolado gera 6 quads', () => {
    const g = new VoxelGrid(dims);
    g.set(3, 3, 3, MAT.concreto);
    expect(visibleQuads(meshGrid(g, makeGroupInfo(dims)))).toBe(6);
  });

  it('voxels iguais adjacentes se fundem', () => {
    const g = new VoxelGrid(dims);
    for (let i = 0; i < 4; i++) g.set(i, 1, 1, MAT.concreto); // dentro de um só quadrante
    expect(visibleQuads(meshGrid(g, makeGroupInfo(dims)))).toBe(6);
  });

  it('categorias diferentes viram faces de revelação, não faces visíveis', () => {
    const g = new VoxelGrid(dims);
    g.set(2, 3, 3, MAT.concreto);
    g.set(3, 3, 3, MAT.assento_oeste_i);
    const out = meshGrid(g, makeGroupInfo(dims));
    expect(out.filter((m) => m.set > 0).reduce((a, m) => a + m.quads, 0)).toBe(2);
  });
});

describe('tampas do corte', () => {
  it('cobrem a fatia removida de um bloco sólido', () => {
    const g = new VoxelGrid(dims);
    for (let i = 1; i < 7; i++) for (let j = 1; j < 7; j++) for (let k = 1; k < 7; k++) g.set(i, j, k, MAT.concreto);
    const cut = emptyCut();
    cut.h = { on: true, j: 4 };
    const caps = buildCaps(g, makeGroupInfo(dims), cut);
    const quads = caps.reduce((a, m) => a + m.quads, 0);
    expect(quads).toBe(4); // 6×6 voxels fundidos: um quad por quadrante (pedaço da torta)
    expect(isRemoved(cut, 2, 4, 2)).toBe(true);
    expect(isRemoved(cut, 2, 3, 2)).toBe(false);
  });
});

describe('tampas na fronteira dos quadrantes', () => {
  it('aparecem quando o corte vertical coincide com o plano z = 0', () => {
    const g = new VoxelGrid(dims);
    for (let i = 1; i < 7; i++) for (let j = 1; j < 3; j++) for (let k = 1; k < 7; k++) g.set(i, j, k, MAT.rocha);
    const cut = emptyCut();
    cut.v = { on: true, axis: 2, idx: dims.nz / 2, side: 1 };
    const caps = buildCaps(g, makeGroupInfo(dims), cut);
    expect(caps.reduce((a, m) => a + m.quads, 0)).toBeGreaterThan(0);
  });
});
