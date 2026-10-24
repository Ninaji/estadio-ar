// Estado dos cortes em unidades amigáveis (metros, graus) → predicado em unidades de grade,
// uniforms do shader e pedido de tampas ao worker (com coalescência enquanto arrasta).
import { emptyCut } from './cutPredicate.js';

export class CutController {
  constructor(arena, worker, onChange = () => {}) {
    this.arena = arena;
    this.worker = worker;
    this.onChange = onChange;
    this.state = {
      h: { on: false, y: 1.5 },
      v: { on: false, axis: 'lo', pos: 0, side: 1 },
      w: { on: false, open: 90, rot: 225 },
    };
    this.busy = false;
    this.dirty = false;
  }

  toGrid() {
    const d = this.arena.dims;
    const cut = emptyCut();
    const s = this.state;
    if (s.h.on) {
      cut.h.on = true;
      cut.h.j = Math.max(1, Math.min(d.ny - 1, Math.round((s.h.y - d.oy) / d.voxel)));
    }
    if (s.v.on) {
      cut.v.on = true;
      // 'lo' = plano Leste–Oeste (normal em z, corta norte/sul); 'ns' = plano Norte–Sul (normal em x)
      cut.v.axis = s.v.axis === 'ns' ? 0 : 2;
      const origin = cut.v.axis === 0 ? d.ox : d.oz;
      const n = cut.v.axis === 0 ? d.nx : d.nz;
      cut.v.idx = Math.max(1, Math.min(n - 1, Math.round((s.v.pos - origin) / d.voxel)));
      cut.v.side = s.v.side;
    }
    if (s.w.on && s.w.open > 0.5) {
      cut.w.on = true;
      cut.w.cx = d.nx / 2;
      cut.w.cz = d.nz / 2;
      cut.w.aw = (s.w.open * Math.PI) / 180;
      cut.w.a0 = ((s.w.rot - s.w.open / 2) * Math.PI) / 180;
    }
    return cut;
  }

  /** Aplica no shader imediatamente e pede as tampas (no máximo um pedido em voo). */
  apply() {
    const cut = this.toGrid();
    this.arena.setCut(cut);
    this.onChange(this.state);
    this.#requestCaps();
  }

  async #requestCaps() {
    if (this.busy) {
      this.dirty = true;
      return;
    }
    this.busy = true;
    const cut = this.toGrid();
    const any = cut.h.on || cut.v.on || cut.w.on;
    const meshes = any ? await this.worker.caps(cut) : [];
    this.busy = false;
    if (meshes) this.arena.setCaps(meshes);
    if (this.dirty) {
      this.dirty = false;
      this.#requestCaps();
    }
  }

  set(part, values) {
    Object.assign(this.state[part], values);
    this.apply();
  }

  clear() {
    this.state.h.on = false;
    this.state.v.on = false;
    this.state.w.on = false;
    this.apply();
  }

  get active() {
    const s = this.state;
    return s.h.on || s.v.on || s.w.on;
  }
}
