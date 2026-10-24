// Planeja a rota completa portão → assento e gera as instruções passo a passo.
import { TIERS, SECTORS, AISLES, GATES, SEGMENTS, R, pointAt, contourAt } from '../stadium/spec.js';
import { shortestPath, SPEED, WAIT } from './pathfinder.js';
import { LEVEL_NAMES } from './navGraph.js';

const fmtM = (m) => `${Math.max(1, Math.round(m))} m`;

/** Pontos ao longo do contorno deslocado d, de t1 a t2 no mesmo segmento. */
function lateral(seg, t1, t2, d, y) {
  const corner = SEGMENTS[seg].kind === 'corner';
  const arc = Math.abs(t2 - t1) * (corner ? R + d : 1);
  const n = Math.max(1, Math.ceil(arc / 1.5));
  const pts = [];
  for (let q = 1; q <= n; q++) {
    const t = t1 + ((t2 - t1) * q) / n;
    const p = pointAt(seg, t, d);
    pts.push({ x: p.x, y, z: p.z });
  }
  return { pts, len: arc };
}

/**
 * seat: { i, j, k, tier, sector, row, num }; dims: grade; opts: { gate: 'auto'|n, accessible }
 */
export function planRoute(graph, seat, dims, opts = {}) {
  const tier = TIERS[seat.tier];
  const sec = SECTORS[seat.sector];
  const vom = graph.vomitory.get(`${seat.tier}:${seat.sector}`);
  if (!vom) return null;
  const sources = opts.gate && opts.gate !== 'auto' ? [graph.gateOut.get(Number(opts.gate))] : [...graph.gateOut.values()];
  const sp = shortestPath(graph, sources, vom.mouth, { accessible: !!opts.accessible });
  if (!sp) return null;

  const points = [];
  const steps = [];
  let distance = 0;
  let time = 0;
  const push = (p) => {
    const last = points[points.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y, last.z - p.z) < 0.05) return;
    points.push({ x: p.x, y: p.y, z: p.z });
  };
  const startNode = graph.nodes[sp.nodes[0]];
  const gate = GATES.find((g) => g.n === startNode.gate);
  push(startNode);

  // agrupa trechos consecutivos do mesmo tipo (o concourse vira um único passo)
  let current = null;
  const flush = () => {
    if (current) steps.push(current);
    current = null;
  };
  sp.edges.forEach((e) => {
    const from = points.length - 1;
    for (const p of e.pts) push(p);
    push(graph.nodes[e.to]);
    distance += e.len;
    time += e.len / (SPEED[e.type] || 1.2) + (WAIT[e.type] || 0);
    const toNode = graph.nodes[e.to];
    const sameRun = current && current.type === e.type
      && (e.type === 'concourse' || e.type === 'esplanada' || (current.name && current.name === e.name));
    if (sameRun) {
      current.len += e.len;
      current.rise += e.rise;
      current.endY = toNode.y;
      return;
    }
    flush();
    current = { type: e.type, startIdx: from, len: e.len, rise: e.rise, endY: toNode.y, name: e.name };
  });
  flush();

  // textos dos passos do edifício
  for (const s of steps) {
    const lvl = LEVEL_NAMES[Math.round(s.endY)] || `${Math.round(s.endY)} m`;
    const up = s.rise >= 0 ? 'Suba' : 'Desça';
    switch (s.type) {
      case 'esplanada': s.text = `Chegue pela esplanada ao ${gate ? gate.name : 'portão'}`; break;
      case 'catraca': s.text = 'Passe pela catraca com o ingresso digital'; s.sub = 'Revista e leitura do QR code'; break;
      case 'concourse': s.text = `Siga pelo ${lvl}`; s.sub = `${fmtM(s.len)} entre bares e banheiros`; break;
      case 'escada': s.text = `${up} a ${s.name.toLowerCase()} até o ${lvl}`; s.sub = `${Math.abs(Math.round(s.rise))} m de desnível`; break;
      case 'elevador': s.text = `Pegue o ${s.name.toLowerCase()} até o ${lvl}`; s.sub = 'Prioridade para PCD, idosos e gestantes'; break;
      case 'rolante': s.text = `${up} pelas escadas rolantes até o ${lvl}`; break;
      case 'rampa': s.text = `${up} a rampa helicoidal até o ${lvl}`; s.sub = 'Inclinação suave, acessível'; break;
      case 'passarela': s.text = 'Atravesse a passarela para dentro do estádio'; break;
      case 'vomitorio': s.text = `Entre no vomitório do setor ${sec.id} (${tier.name.toLowerCase()})`; s.sub = 'O túnel leva direto à arquibancada'; break;
      default: s.text = s.type;
    }
  }

  // --- dentro da arquibancada (trecho analítico) -----------------------------
  const v = dims.voxel;
  const sx = dims.ox + (seat.i + 0.5) * v;
  const sz = dims.oz + (seat.k + 0.5) * v;
  const c = contourAt(sx, sz);
  const seg = vom.seg;
  const rowM = tier.crossRow;
  const treads = tier.treads;
  // escada de corredor: o próprio eixo do vomitório para filas abaixo da boca (anel inferior),
  // senão a escada mais próxima do assento
  let aisleT;
  if (seat.tier === 0 && seat.row < rowM) aisleT = vom.t;
  else {
    const cands = AISLES[seg].filter((t) => Math.abs(t - vom.t) > 1e-6);
    aisleT = cands.reduce((best, t) => (Math.abs(t - c.t) < Math.abs(best - c.t) ? t : best), cands[0]);
  }
  const crossD = tier.d0 + rowM + 0.75;
  const yCross = treads[rowM];
  let idx = points.length - 1;
  if (Math.abs(aisleT - vom.t) > 1e-6) {
    const lat = lateral(seg, vom.t, aisleT, crossD, yCross);
    lat.pts.forEach(push);
    distance += lat.len;
    time += lat.len / SPEED.arquibancada;
    steps.push({ type: 'arquibancada', startIdx: idx, text: 'Caminhe pelo corredor transversal até a escada', sub: fmtM(lat.len) });
    idx = points.length - 1;
  }
  const dir = seat.row >= rowM ? 1 : -1;
  const nRows = Math.abs(seat.row - rowM);
  if (nRows > 0) {
    for (let r = rowM + dir; dir > 0 ? r <= seat.row : r >= seat.row; r += dir) {
      const p = pointAt(seg, aisleT, tier.d0 + r + 0.5);
      push({ x: p.x, y: treads[r], z: p.z });
    }
    const rise = Math.abs(treads[seat.row] - yCross);
    distance += nRows + rise;
    time += (nRows + rise) / 0.5;
    steps.push({ type: 'arquibancada', startIdx: idx, text: `${dir > 0 ? 'Suba' : 'Desça'} ${nRows} ${nRows === 1 ? 'fila' : 'filas'} pela escada até a fila ${seat.row + 1}`, sub: 'Degraus amarelos do corredor' });
    idx = points.length - 1;
  }
  const rowD = tier.d0 + seat.row + 0.25;
  const along = lateral(seg, aisleT, c.t, rowD, treads[seat.row]);
  along.pts.forEach(push);
  const end = pointAt(seg, c.t, tier.d0 + seat.row + 0.75);
  push({ x: end.x, y: treads[seat.row] + 0.5, z: end.z });
  distance += along.len;
  time += along.len / SPEED.fila;
  steps.push({ type: 'fila', startIdx: idx, text: `Entre na fila ${seat.row + 1} e siga até o assento ${seat.num}`, sub: `${fmtM(along.len)} · peça licença 😉` });
  steps.push({ type: 'chegada', startIdx: points.length - 1, text: `Chegou! Setor ${sec.name}, fila ${seat.row + 1}, assento ${seat.num}`, sub: tier.name });

  return { points, steps, distance, time, gate, tier, sector: sec, seat };
}
