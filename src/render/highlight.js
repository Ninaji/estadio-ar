// Destaque da parte selecionada: caixa com arestas brilhantes e preenchimento pulsante.
import * as THREE from 'three';

export class Highlight {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.visible = false;
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false }),
    );
    this.fill = new THREE.Mesh(
      box,
      new THREE.MeshBasicMaterial({ color: 0xa66bff, transparent: true, opacity: 0.25, depthWrite: false, depthTest: false }),
    );
    this.edges.renderOrder = 11;
    this.fill.renderOrder = 10;
    this.group.add(this.fill, this.edges);
    parent.add(this.group);
  }

  /** min/max em metros no espaço da arena. */
  show(min, max, color = '#a66bff') {
    const size = new THREE.Vector3().subVectors(max, min);
    this.group.position.copy(min).addScaledVector(size, 0.5);
    this.group.scale.copy(size).max(new THREE.Vector3(0.6, 0.6, 0.6));
    this.fill.material.color.set(color);
    this.edges.material.color.set(color).lerp(new THREE.Color('#ffffff'), 0.6);
    this.group.visible = true;
    this.t0 = performance.now();
  }

  hide() {
    this.group.visible = false;
  }

  update() {
    if (!this.group.visible) return;
    const t = (performance.now() - this.t0) / 1000;
    this.fill.material.opacity = 0.18 + 0.14 * Math.sin(t * 5);
    this.edges.material.opacity = 0.7 + 0.3 * Math.sin(t * 5);
    const pop = t < 0.3 ? 1 + (0.3 - t) * 0.6 : 1;
    this.group.children.forEach((c) => c.scale.setScalar(pop));
  }
}
