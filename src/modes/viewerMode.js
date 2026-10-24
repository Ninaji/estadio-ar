// Modo 3D: gira com um dedo, pinça para zoom, dois dedos para arrastar.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class ViewerMode {
  constructor() {
    this.id = 'viewer';
    this.label = '3D';
    this.ownsProjection = false;
  }

  async start(app) {
    this.app = app;
    const { camera, renderer } = app;
    camera.near = 0.5;
    camera.far = 5000;
    camera.updateProjectionMatrix();
    app.stage.position.set(0, 0, 0);
    app.stage.quaternion.identity();
    app.stage.scale.setScalar(1);
    app.stage.updateMatrixWorld(true);
    this.controls = new OrbitControls(camera, renderer.domElement);
    this.controls.target.set(0, -2, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 25;
    this.controls.maxDistance = 900;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 1.1;
    this.controls.screenSpacePanning = true;
    this.controls.update();
    document.body.classList.add('mode-viewer');
    renderer.setAnimationLoop((t) => {
      app.tick(t);
      this.controls.update();
      app.render();
    });
  }

  /** Voa a câmera suavemente até um alvo (usado ao focar partes e rotas). */
  focus(target, distance = 120, gsap) {
    const c = this.controls;
    if (!c) return;
    const cam = this.app.camera;
    const dir = cam.position.clone().sub(c.target).normalize();
    const to = target.clone().add(dir.multiplyScalar(distance));
    if (gsap) {
      gsap.to(c.target, { x: target.x, y: target.y, z: target.z, duration: 1.1, ease: 'power2.inOut' });
      gsap.to(cam.position, { x: to.x, y: to.y, z: to.z, duration: 1.1, ease: 'power2.inOut' });
    } else {
      c.target.copy(target);
      cam.position.copy(to);
    }
  }

  /** Raio da câmera a partir de coordenadas normalizadas da tela. */
  rayFromScreen(ndc) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.app.camera);
    return ray.ray;
  }

  async stop() {
    this.app.renderer.setAnimationLoop(null);
    this.controls?.dispose();
    this.controls = null;
    document.body.classList.remove('mode-viewer');
  }
}
