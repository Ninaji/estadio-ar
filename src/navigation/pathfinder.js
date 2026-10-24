// Busca do melhor caminho (Dijkstra com fila de prioridade) e política de custo por tipo de trecho.

// Velocidades médias de caminhada (m/s) e esperas fixas (s) por tipo de trecho.
export const SPEED = {
  esplanada: 1.4, catraca: 1.0, concourse: 1.3, escada: 0.55, rolante: 0.75, elevador: 1.0,
  rampa: 1.1, passarela: 1.3, vomitorio: 1.2, arquibancada: 0.7, fila: 0.6,
};
export const WAIT = { catraca: 8, elevador: 35 };

/**
 * Custo (segundos estimados) de um trecho. Modo acessível proíbe degraus e escadas rolantes.
 */
export function edgeCost(edge, prefs = {}) {
  if (prefs.accessible && (edge.type === 'escada' || edge.type === 'rolante')) return Infinity;
  const time = edge.len / (SPEED[edge.type] || 1.2) + (WAIT[edge.type] || 0);
  // quem não precisa evita a fila do elevador; quem precisa o prefere às rampas longas
  if (edge.type === 'elevador' && !prefs.accessible) return time * 1.6;
  if (edge.type === 'rampa' && prefs.accessible) return time * 1.2;
  return time;
}

class Heap {
  constructor() { this.a = []; }
  push(item, pri) {
    const a = this.a;
    a.push([pri, item]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

/**
 * Menor caminho de qualquer nó de `sources` até `target`.
 * Retorna { nodes: [ids], edges: [edge], cost } ou null.
 */
export function shortestPath(graph, sources, target, prefs = {}) {
  const n = graph.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const prevEdge = new Array(n).fill(null);
  const heap = new Heap();
  for (const s of sources) {
    dist[s] = 0;
    heap.push(s, 0);
  }
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > dist[u]) continue;
    if (u === target) break;
    for (const e of graph.adj[u]) {
      const c = edgeCost(e, prefs);
      if (!Number.isFinite(c)) continue;
      const nd = d + c;
      if (nd < dist[e.to]) {
        dist[e.to] = nd;
        prev[e.to] = u;
        prevEdge[e.to] = e;
        heap.push(e.to, nd);
      }
    }
  }
  if (!Number.isFinite(dist[target])) return null;
  const nodes = [];
  const edges = [];
  for (let v = target; v !== -1; v = prev[v]) {
    nodes.push(v);
    if (prevEdge[v]) edges.push(prevEdge[v]);
  }
  nodes.reverse();
  edges.reverse();
  return { nodes, edges, cost: dist[target] };
}
