import { describe, it, expect } from 'vitest';
import { NavGraph } from '../src/navigation/navGraph.js';
import { shortestPath } from '../src/navigation/pathfinder.js';
import { planRoute } from '../src/navigation/routePlanner.js';
import { TIERS, SECTORS, GATES, gridDims, pointAt } from '../src/stadium/spec.js';

const graph = new NavGraph();

describe('grafo de circulação', () => {
  it('liga todo portão a todo vomitório', () => {
    for (const g of GATES) {
      for (let ti = 0; ti < TIERS.length; ti++) {
        for (let si = 0; si < SECTORS.length; si++) {
          const vom = graph.vomitory.get(`${ti}:${si}`);
          expect(vom, `vomitório ${ti}:${si}`).toBeTruthy();
          const sp = shortestPath(graph, [graph.gateOut.get(g.n)], vom.mouth);
          expect(sp, `portão ${g.n} → ${ti}:${si}`).not.toBeNull();
        }
      }
    }
  });

  it('modo acessível nunca usa escadas nem escadas rolantes', () => {
    for (let ti = 0; ti < TIERS.length; ti++) {
      for (let si = 0; si < SECTORS.length; si += 3) {
        const vom = graph.vomitory.get(`${ti}:${si}`);
        const sp = shortestPath(graph, [...graph.gateOut.values()], vom.mouth, { accessible: true });
        expect(sp).not.toBeNull();
        expect(sp.edges.some((e) => e.type === 'escada' || e.type === 'rolante')).toBe(false);
      }
    }
  });

  it('anel superior exige circulação vertical', () => {
    const vom = graph.vomitory.get('2:0');
    const sp = shortestPath(graph, [graph.gateOut.get(1)], vom.mouth);
    expect(sp.edges.some((e) => ['escada', 'elevador', 'rolante', 'rampa'].includes(e.type))).toBe(true);
  });
});

describe('planejador de rota', () => {
  const dims = gridDims(0.5);
  const seatAt = (ti, si, row) => {
    const tier = TIERS[ti];
    const sec = SECTORS[si];
    const t = (sec.t0 + Math.min(sec.t1, sec.t0 + 40)) / 2 + 2;
    const p = pointAt(sec.seg, Math.min(t, sec.t1 - 0.5), tier.d0 + row + 0.75);
    return {
      i: Math.floor((p.x - dims.ox) / dims.voxel), j: 0, k: Math.floor((p.z - dims.oz) / dims.voxel),
      tier: ti, sector: si, row, num: 7,
    };
  };

  it('gera pontos, passos e termina no assento', () => {
    const r = planRoute(graph, seatAt(2, 8, 12), dims, { gate: 'auto' });
    expect(r).not.toBeNull();
    expect(r.points.length).toBeGreaterThan(20);
    expect(r.steps.at(-1).type).toBe('chegada');
    expect(r.steps[0].type).toBe('esplanada');
    const last = r.points.at(-1);
    expect(last.y).toBeCloseTo(TIERS[2].treads[12] + 0.5, 5);
    expect(r.distance).toBeGreaterThan(50);
  });

  it('respeita o portão escolhido', () => {
    const r = planRoute(graph, seatAt(0, 2, 4), dims, { gate: 7 });
    expect(r.gate.n).toBe(7);
  });

  it('filas abaixo da boca do anel inferior descem pelo eixo do vomitório', () => {
    const r = planRoute(graph, seatAt(0, 3, 3), dims, {});
    expect(r.steps.some((s) => s.text.startsWith('Desça 6 filas'))).toBe(true);
  });
});
