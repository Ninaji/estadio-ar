// Grafo de circulação do público gerado a partir do spec:
// esplanada → portão/catraca → anel do concourse (0, 8, 18 m) → escadas/elevadores/
// escadas rolantes/rampas → vomitório → boca do vomitório no corredor transversal.
import {
  SEGMENTS, GATES, TIERS, SECTORS, VOMITORIES, STAIRS, ELEVATORS, ESCALATORS, RAMPS, RAMP, R,
  FACADE_D, FACADE_OUT, pointAt, sidePoint, arcAt, perimeterAt, contourAt,
} from '../stadium/spec.js';

export const RING_D = 43.5;
export const RING_LEVELS = [0, 8, 18];
const LEVEL_NAMES = { 0: 'concourse inferior (térreo)', 8: 'nível clube', 18: 'concourse superior' };

/** Inverso de arcAt: (comprimento de arco no contorno d) → ponto. */
export function pointAtArc(sd, d) {
  const P = perimeterAt(d);
  let s = ((sd % P) + P) % P;
  for (let seg = 0; seg < SEGMENTS.length; seg++) {
    const corner = SEGMENTS[seg].kind === 'corner';
    const len = corner ? ((R + d) * Math.PI) / 2 : SEGMENTS[seg].len;
    if (s <= len || seg === SEGMENTS.length - 1) {
      const t = corner ? s / (R + d) : s;
      return { ...pointAt(seg, Math.min(t, corner ? Math.PI / 2 : len), d), seg, t };
    }
    s -= len;
  }
  return null;
}

export class NavGraph {
  constructor() {
    this.nodes = [];
    this.adj = [];
    this.vomitory = new Map(); // `${tier}:${sector}` → { mouth, seg, t }
    this.gateOut = new Map(); // número do portão → nó
    this.#build();
  }

  addNode(x, y, z, meta = {}) {
    const id = this.nodes.length;
    this.nodes.push({ id, x, y, z, ...meta });
    this.adj.push([]);
    return id;
  }

  addEdge(a, b, type, pts = [], meta = {}) {
    const A = this.nodes[a];
    const B = this.nodes[b];
    const poly = [A, ...pts, B];
    let len = 0;
    for (let i = 1; i < poly.length; i++) len += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y, poly[i].z - poly[i - 1].z);
    const rise = B.y - A.y;
    this.adj[a].push({ to: b, type, len, rise, pts, ...meta });
    this.adj[b].push({ to: a, type, len, rise: -rise, pts: [...pts].reverse(), ...meta });
  }

  #build() {
    const attach = { 0: [], 8: [], 18: [] };
    const ringPoint = (sd, y) => {
      const p = pointAtArc(sd, RING_D);
      return { x: p.x, y, z: p.z };
    };
    const arcAtPoint = (x, z) => {
      const c = contourAt(x, z);
      return arcAt(c.seg, c.t, RING_D);
    };

    // portões
    for (const g of GATES) {
      const out = pointAt(g.seg, g.t, FACADE_OUT + 4);
      const turn = pointAt(g.seg, g.t, FACADE_D + 0.75);
      const o = this.addNode(out.x, 0, out.z, { kind: 'gate', gate: g.n, label: g.name });
      const tn = this.addNode(turn.x, 0, turn.z, { kind: 'turnstile', gate: g.n });
      this.addEdge(o, tn, 'esplanada');
      attach[0].push({ sd: arcAt(g.seg, g.t, RING_D), node: tn, type: 'catraca' });
      this.gateOut.set(g.n, o);
    }

    // escadas em caixa
    for (const b of STAIRS) {
      const u = b.u0 + 1;
      const entries = b.levels.map((y) => {
        const p = sidePoint(b.side, u, b.d0 - 1);
        const id = this.addNode(p.x, y, p.z, { kind: 'stair', label: b.name });
        attach[y]?.push({ sd: arcAtPoint(p.x, p.z), node: id, type: 'concourse' });
        return id;
      });
      for (let k = 0; k + 1 < b.levels.length; k++) {
        const ya = b.levels[k];
        const yb = b.levels[k + 1];
        const half = (yb - ya) / 2;
        const run = half * 2;
        const d1 = b.d0 + 1;
        const d2 = b.d1 - 1;
        const dm = (b.d0 + b.d1) / 2;
        const P = (uu, dd, yy) => ({ ...sidePoint(b.side, uu, dd), y: yy });
        const pts = [
          P(u, d1, ya), P(b.u0 + 2, d1, ya), P(b.u0 + 2 + run, d1, ya + half), P(b.u0 + 3 + run, dm, ya + half),
          P(b.u0 + 2 + run, d2, ya + half), P(b.u0 + 2, d2, yb), P(u, d2, yb), P(u, d1, yb),
        ].map((p) => ({ x: p.x, y: p.y, z: p.z }));
        this.addEdge(entries[k], entries[k + 1], 'escada', pts, { name: b.name });
      }
    }
    // elevadores
    for (const e of ELEVATORS) {
      const u = (e.u0 + e.u1) / 2;
      const front = sidePoint(e.side, u, e.d0 - 1);
      const shaft = sidePoint(e.side, u, (e.d0 + e.d1) / 2);
      const ids = RING_LEVELS.map((y) => {
        const id = this.addNode(front.x, y, front.z, { kind: 'elevator', label: e.name });
        attach[y].push({ sd: arcAtPoint(front.x, front.z), node: id, type: 'concourse' });
        return id;
      });
      for (let k = 0; k + 1 < ids.length; k++) {
        const ya = RING_LEVELS[k];
        const yb = RING_LEVELS[k + 1];
        this.addEdge(ids[k], ids[k + 1], 'elevador', [{ x: shaft.x, y: ya, z: shaft.z }, { x: shaft.x, y: yb, z: shaft.z }], { name: e.name });
      }
    }
    // escadas rolantes
    for (const e of ESCALATORS) {
      const dm = (e.d0 + e.d1) / 2;
      const bot = sidePoint(e.side, e.u0 + 1, dm);
      const top = sidePoint(e.side, e.u1 - 1, dm);
      const a = this.addNode(bot.x, e.y0, bot.z, { kind: 'escalator', label: e.name });
      const b = this.addNode(top.x, e.y1, top.z, { kind: 'escalator', label: e.name });
      const p1 = sidePoint(e.side, e.u0 + 2, dm);
      const p2 = sidePoint(e.side, e.u1 - 2, dm);
      this.addEdge(a, b, 'rolante', [{ x: p1.x, y: e.y0, z: p1.z }, { x: p2.x, y: e.y1, z: p2.z }], { name: e.name });
      attach[e.y0].push({ sd: arcAtPoint(bot.x, bot.z), node: a, type: 'concourse' });
      attach[e.y1].push({ sd: arcAtPoint(top.x, top.z), node: b, type: 'concourse' });
    }
    // rampas helicoidais (dos portões de canto até 8 m e 18 m)
    for (const r of RAMPS) {
      const gate = GATES.find((g) => g.seg === r.seg);
      const bridgePhi = Math.atan2(-r.nz, -r.nx);
      const rm = (RAMP.rIn + RAMP.rOut) / 2;
      const helix = (y) => {
        const phi = bridgePhi + ((y - 8) / RAMP.risePerTurn) * Math.PI * 2;
        return { x: r.x + Math.cos(phi) * rm, y, z: r.z + Math.sin(phi) * rm };
      };
      const bottom = helix(0);
      const b0 = this.addNode(bottom.x, 0, bottom.z, { kind: 'ramp', label: r.name });
      this.addEdge(this.gateOut.get(gate.n), b0, 'esplanada');
      let prev = b0;
      let prevY = 0;
      for (const y of [8, 18]) {
        const pts = [];
        for (let yy = prevY + 0.25; yy < y; yy += 0.25) pts.push(helix(yy));
        const top = helix(y);
        const id = this.addNode(top.x, y, top.z, { kind: 'ramp', label: r.name });
        this.addEdge(prev, id, 'rampa', pts, { name: 'Rampa helicoidal' });
        // passarela até a fachada e entrada no anel
        const face = pointAt(r.seg, Math.PI / 4, FACADE_D);
        const fid = this.addNode(face.x, y, face.z, { kind: 'bridge' });
        this.addEdge(id, fid, 'passarela');
        attach[y].push({ sd: arcAt(r.seg, Math.PI / 4, RING_D), node: fid, type: 'concourse' });
        prev = id;
        prevY = y;
      }
    }
    // vomitórios: um por setor e anel
    TIERS.forEach((tier, ti) => {
      SECTORS.forEach((sec, si) => {
        const tv = VOMITORIES[sec.seg].find((t) => t >= sec.t0 && t < sec.t1);
        if (tv === undefined) return;
        const f = tier.vomFloor;
        const tun = pointAt(sec.seg, tv, tier.vomEnd);
        const crossD = tier.d0 + tier.crossRow + 0.75;
        const mouthY = tier.treads[tier.crossRow];
        const mouth = pointAt(sec.seg, tv, crossD);
        const inner = this.addNode(tun.x, f, tun.z, { kind: 'vomitory' });
        const m = this.addNode(mouth.x, mouthY, mouth.z, { kind: 'mouth', tier: ti, sector: si });
        const mid = pointAt(sec.seg, tv, Math.max(crossD + 1, tier.d0 + tier.crossRow + 2));
        this.addEdge(inner, m, 'vomitorio', [{ x: mid.x, y: f, z: mid.z }], { name: `Vomitório ${sec.id}` });
        const ring = pointAt(sec.seg, tv, RING_D);
        const rn = this.addNode(ring.x, f, ring.z, { kind: 'ring' });
        this.addEdge(rn, inner, 'concourse');
        attach[f].push({ sd: arcAt(sec.seg, tv, RING_D), node: rn, type: 'concourse' });
        this.vomitory.set(`${ti}:${si}`, { mouth: m, seg: sec.seg, t: tv });
      });
    });

    // anéis: une os pontos de acesso em ordem de arco, com nós de preenchimento a cada 10 m
    const P = perimeterAt(RING_D);
    for (const y of RING_LEVELS) {
      const list = attach[y].slice();
      for (let s = 0; s < P; s += 10) list.push({ sd: s, node: -1 });
      list.sort((a, b) => a.sd - b.sd);
      const ring = list.map((a) => {
        const p = ringPoint(a.sd, y);
        const id = this.addNode(p.x, y, p.z, { kind: 'ring', level: y });
        if (a.node >= 0) this.addEdge(id, a.node, a.type);
        return { id, sd: a.sd };
      });
      for (let q = 0; q < ring.length; q++) {
        const a = ring[q];
        const b = ring[(q + 1) % ring.length];
        let span = b.sd - a.sd;
        if (span < 0) span += P;
        const pts = [];
        for (let s = 3; s < span; s += 3) pts.push(ringPoint(a.sd + s, y));
        this.addEdge(a.id, b.id, 'concourse', pts, { level: y });
      }
    }
  }
}

export { LEVEL_NAMES };
