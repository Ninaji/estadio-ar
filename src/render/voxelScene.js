// Monta as malhas voxel vindas do worker e controla cortes, camadas e desmontagem.
import * as THREE from 'three';
import { createPaletteTexture, createSharedUniforms, createVoxelMaterial } from './voxelMaterial.js';
import { LEVELS, QUADRANTS } from '../stadium/spec.js';
import { CATEGORIES } from '../stadium/palette.js';
import { anyCut } from '../slicing/cutPredicate.js';

const EXPLODE_SET = 13;

export class VoxelArena {
  constructor() {
    this.root = new THREE.Group(); // em metros, centro do campo na origem
    this.root.name = 'arena';
    this.content = new THREE.Group(); // em unidades de grade
    this.root.add(this.content);
    this.uniforms = createSharedUniforms(createPaletteTexture());
    this.materials = {
      opaque: createVoxelMaterial(this.uniforms),
      opaqueCut: createVoxelMaterial(this.uniforms, { cut: true }),
      translucent: createVoxelMaterial(this.uniforms, { translucent: true }),
      translucentCut: createVoxelMaterial(this.uniforms, { translucent: true, cut: true }),
      ghost: createVoxelMaterial(this.uniforms, { ghost: true }),
      ghostCut: createVoxelMaterial(this.uniforms, { ghost: true, cut: true }),
    };
    this.ghostMeshes = [];
    this.groups = [];
    this.meshes = [];
    this.capMeshes = [];
    this.hiddenMask = 0;
    this.ghostMask = 0;
    this.explodeLevels = 0;
    this.explodeQuads = 0;
    this.cutActive = false;
  }

  /** Recebe o resultado do worker. */
  build(dims, meshes) {
    this.dims = dims;
    const { voxel, ox, oy, oz } = dims;
    this.content.scale.setScalar(voxel);
    this.content.position.set(ox, oy, oz);
    const groupCount = LEVELS.length * 4;
    for (let g = 0; g < groupCount; g++) {
      const obj = new THREE.Group();
      obj.userData.level = g >> 2;
      obj.userData.quad = g & 3;
      this.groups.push(obj);
      this.content.add(obj);
    }
    for (const m of meshes) {
      const mesh = this.#makeMesh(m);
      mesh.userData.set = m.set;
      mesh.visible = m.set === 0;
      this.groups[m.group].add(mesh);
      this.meshes.push(mesh);
    }
    this.uniforms.uWedgeC.value.set(dims.nx / 2, dims.nz / 2);
    this.uniforms.uVoxel.value = voxel;
    this.uniforms.uOrigin.value.set(ox, oy, oz);
  }

  #makeMesh(m) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    geo.setAttribute('aMI', new THREE.BufferAttribute(m.mi, 2));
    geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, m.translucent ? this.materials.translucent : this.materials.opaque);
    mesh.userData.translucent = !!m.translucent;
    if (m.translucent) mesh.renderOrder = 2;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }

  /** Atualiza uniforms do corte (estado em unidades de grade) e troca o material. */
  setCut(cut) {
    const u = this.uniforms;
    u.uCutH.value = cut.h.on ? 1 : 0;
    u.uCutJ.value = cut.h.j;
    u.uCutV.value = cut.v.on ? 1 : 0;
    u.uCutAxis.value = cut.v.axis === 0 ? 0 : 1;
    u.uCutIdx.value = cut.v.idx;
    u.uCutSide.value = cut.v.side;
    u.uCutW.value = cut.w.on ? 1 : 0;
    u.uWedgeA0.value = cut.w.a0;
    u.uWedgeAW.value = cut.w.aw;
    const active = anyCut(cut);
    if (active !== this.cutActive) {
      this.cutActive = active;
      for (const mesh of this.meshes) {
        mesh.material = mesh.userData.translucent
          ? active ? this.materials.translucentCut : this.materials.translucent
          : active ? this.materials.opaqueCut : this.materials.opaque;
      }
      if (!active) this.setCaps([]);
      this.#syncGhosts();
    }
  }

  /** Substitui as tampas do corte. */
  setCaps(meshes) {
    const old = new Set(this.capMeshes);
    this.ghostMeshes = this.ghostMeshes.filter((g) => {
      if (!old.has(g.userData.source)) return true;
      g.parent?.remove(g);
      return false;
    });
    for (const c of this.capMeshes) {
      c.parent?.remove(c);
      c.geometry.dispose();
    }
    this.capMeshes = [];
    for (const m of meshes) {
      const mesh = this.#makeMesh(m);
      mesh.material = this.materials.opaqueCut;
      this.groups[m.group].add(mesh);
      this.capMeshes.push(mesh);
      if (this.ghostMeshes.length) this.#addGhost(mesh);
    }
    this.#syncGhosts();
  }

  setHidden(mask) {
    this.hiddenMask = mask;
    this.uniforms.uHidden.value = mask;
    this.#updateRevealSets();
  }

  /** Raio-X: segundo passe translúcido só com as categorias fantasma. */
  setGhost(mask) {
    this.ghostMask = mask;
    this.uniforms.uGhost.value = mask;
    if (mask && !this.ghostMeshes.length) {
      for (const mesh of [...this.meshes, ...this.capMeshes]) {
        if (mesh.userData.translucent) continue;
        this.#addGhost(mesh);
      }
    }
    this.#syncGhosts();
  }

  #addGhost(mesh) {
    const g = new THREE.Mesh(mesh.geometry, this.cutActive ? this.materials.ghostCut : this.materials.ghost);
    g.renderOrder = 3;
    g.matrixAutoUpdate = false;
    g.userData.source = mesh;
    mesh.parent.add(g);
    this.ghostMeshes.push(g);
  }

  #syncGhosts() {
    for (const g of this.ghostMeshes) {
      g.visible = this.ghostMask !== 0 && g.userData.source.visible && !!g.userData.source.parent;
      g.material = this.cutActive ? this.materials.ghostCut : this.materials.ghost;
    }
  }

  /** Desmontagem: fatores 0..1 para níveis e quadrantes (em metros: até 9 m e 22 m). */
  setExplode(levels, quads) {
    this.explodeLevels = levels;
    this.explodeQuads = quads;
    const v = this.dims.voxel;
    for (const obj of this.groups) {
      const L = obj.userData.level;
      const q = QUADRANTS[obj.userData.quad];
      obj.position.set((q.dx * quads * 22) / v, (L * levels * 9) / v, (q.dz * quads * 22) / v);
    }
    this.#updateRevealSets();
  }

  /** Deslocamentos por grupo em unidades de grade (para a seleção no worker). */
  groupOffsets() {
    if (this.explodeLevels < 1e-3 && this.explodeQuads < 1e-3) return null;
    const out = new Float32Array(this.groups.length * 3);
    this.groups.forEach((g, i) => {
      out[i * 3] = g.position.x;
      out[i * 3 + 1] = g.position.y;
      out[i * 3 + 2] = g.position.z;
    });
    return out;
  }

  #updateRevealSets() {
    const exploded = this.explodeLevels > 1e-3 || this.explodeQuads > 1e-3;
    for (const mesh of this.meshes) {
      const s = mesh.userData.set;
      if (s === 0) continue;
      mesh.visible = s === EXPLODE_SET ? exploded : ((this.hiddenMask >> (s - 1)) & 1) === 1;
    }
    this.#syncGhosts();
  }

  /** Converte um ponto do mundo para coordenadas de grade (sem desmontagem). */
  worldToGrid(p, out = new THREE.Vector3()) {
    out.copy(p);
    this.content.worldToLocal(out);
    return out;
  }

  get categoryCount() {
    return CATEGORIES.length;
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }
}
