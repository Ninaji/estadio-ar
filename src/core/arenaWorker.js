// Cliente do Web Worker voxel com respostas por promessa e descarte de pedidos antigos.

export class ArenaWorker {
  constructor() {
    this.worker = new Worker(new URL('../worker/voxelWorker.js', import.meta.url), { type: 'module' });
    this.pending = new Map();
    this.seq = 0;
    this.latestCaps = 0;
    this.onProgress = () => {};
    this.worker.onmessage = (e) => this.#onMessage(e.data);
    this.worker.onerror = (e) => console.error('Worker', e.message || e);
  }

  #onMessage(msg) {
    if (msg.type === 'progress') return this.onProgress(msg.p, msg.label);
    if (msg.type === 'error') {
      console.error(msg.message);
      for (const [, p] of this.pending) p.reject(new Error(msg.message));
      this.pending.clear();
      return;
    }
    if (msg.type === 'built') {
      const p = this.pending.get('build');
      this.pending.delete('build');
      return p?.resolve(msg);
    }
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    p.resolve(msg);
  }

  build(voxel) {
    return new Promise((resolve, reject) => {
      this.pending.set('build', { resolve, reject });
      this.worker.postMessage({ type: 'build', voxel });
    });
  }

  /** Tampas do corte; resolve null se um pedido mais novo já foi feito. */
  caps(cut) {
    const id = ++this.seq;
    this.latestCaps = id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (msg) => resolve(id === this.latestCaps ? msg.meshes : null),
        reject,
      });
      this.worker.postMessage({ type: 'caps', id, cut });
    });
  }

  pick(origin, dir, cut, hidden, offsets) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (msg) => resolve(msg.hit), reject });
      this.worker.postMessage({ type: 'pick', id, origin, dir, cut, hidden, offsets });
    });
  }
}
