// Grade voxel densa (1 byte = id de material por célula).
// Índice: ((j * nz) + k) * nx + i  → cada fatia horizontal é contígua.

export class VoxelGrid {
  constructor(dims) {
    Object.assign(this, dims);
    this.sliceSize = this.nx * this.nz;
    this.data = new Uint8Array(this.sliceSize * this.ny);
  }

  index(i, j, k) {
    return (j * this.nz + k) * this.nx + i;
  }

  get(i, j, k) {
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return 0;
    return this.data[(j * this.nz + k) * this.nx + i];
  }

  set(i, j, k, v) {
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return;
    this.data[(j * this.nz + k) * this.nx + i] = v;
  }

  /** Centro do voxel em metros. */
  cx(i) { return this.ox + (i + 0.5) * this.voxel; }
  cy(j) { return this.oy + (j + 0.5) * this.voxel; }
  cz(k) { return this.oz + (k + 0.5) * this.voxel; }

  /** Primeiro índice cujo centro é ≥ coordenada (metros). */
  ix(x) { return Math.ceil((x - this.ox) / this.voxel - 0.5 - 1e-6); }
  jy(y) { return Math.ceil((y - this.oy) / this.voxel - 0.5 - 1e-6); }
  kz(z) { return Math.ceil((z - this.oz) / this.voxel - 0.5 - 1e-6); }

  /** Preenche uma caixa em metros: voxels cujo centro está em [x0,x1)×[y0,y1)×[z0,z1). */
  box(x0, y0, z0, x1, y1, z1, mat, onlyAir = false) {
    const i0 = Math.max(0, this.ix(x0));
    const i1 = Math.min(this.nx, this.ix(x1));
    const j0 = Math.max(0, this.jy(y0));
    const j1 = Math.min(this.ny, this.jy(y1));
    const k0 = Math.max(0, this.kz(z0));
    const k1 = Math.min(this.nz, this.kz(z1));
    const { data, nx, nz } = this;
    for (let j = j0; j < j1; j++) {
      for (let k = k0; k < k1; k++) {
        let p = (j * nz + k) * nx + i0;
        for (let i = i0; i < i1; i++, p++) {
          if (!onlyAir || data[p] === 0) data[p] = mat;
        }
      }
    }
  }

  /** Voxel com o centro mais próximo do ponto (metros). */
  setAt(x, y, z, mat) {
    this.set(Math.floor((x - this.ox) / this.voxel), Math.floor((y - this.oy) / this.voxel), Math.floor((z - this.oz) / this.voxel), mat);
  }
}

/**
 * Buffer de uma coluna vertical (i, k). As funções de preenchimento escrevem
 * intervalos em metros; no final a coluna é copiada para a grade.
 */
export class Column {
  constructor(dims) {
    this.dims = dims;
    this.v = dims.voxel;
    this.oy = dims.oy;
    this.ny = dims.ny;
    this.buf = new Uint8Array(dims.ny);
    this.c = {};
  }

  j(y) {
    return Math.ceil((y - this.oy) / this.v - 0.5 - 1e-6);
  }

  set(y0, y1, mat) {
    const a = Math.max(0, this.j(y0));
    const b = Math.min(this.ny, this.j(y1));
    for (let j = a; j < b; j++) this.buf[j] = mat;
  }

  carve(y0, y1) {
    this.set(y0, y1, 0);
  }

  fillAir(y0, y1, mat) {
    const a = Math.max(0, this.j(y0));
    const b = Math.min(this.ny, this.j(y1));
    for (let j = a; j < b; j++) if (this.buf[j] === 0) this.buf[j] = mat;
  }

  replaceSolid(y0, y1, mat) {
    const a = Math.max(0, this.j(y0));
    const b = Math.min(this.ny, this.j(y1));
    for (let j = a; j < b; j++) if (this.buf[j] !== 0) this.buf[j] = mat;
  }

  get(y) {
    const j = this.j(y);
    return j >= 0 && j < this.ny ? this.buf[j] : 0;
  }

  /** Altura (metros) da base do voxel j. */
  yOf(j) {
    return this.oy + j * this.v;
  }
}
