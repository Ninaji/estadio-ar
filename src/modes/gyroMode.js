// Fallback AR 3DOF: câmera traseira ao fundo + orientação do aparelho (giroscópio).
// Gira junto com o celular; não acompanha deslocamentos (sem rastreamento de posição).
import * as THREE from 'three';
import { ARBase, centerFloorHit } from './arBase.js';

const zee = new THREE.Vector3(0, 0, 1);
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // −90° em x
const euler = new THREE.Euler();

function orientationToQuaternion(q, alpha, beta, gamma, orient) {
  euler.set(beta, alpha, -gamma, 'YXZ');
  q.setFromEuler(euler);
  q.multiply(q1);
  q.multiply(q0.setFromAxisAngle(zee, -orient));
}

export class GyroMode extends ARBase {
  constructor(ctx) {
    super(ctx);
    this.id = 'gyro';
    this.label = 'AR 3DOF';
  }

  async start(app) {
    this.setupAR(app, 'ar-camera');
    const video = document.createElement('video');
    video.id = 'camera-feed';
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.autoplay = true;
    document.body.prepend(video);
    this.video = video;
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = this.stream;
    await video.play().catch(() => {});
    const cam = app.camera;
    cam.position.set(0, 1.4, 0);
    this.alpha0 = null;
    this.onOrient = (e) => {
      if (e.alpha === null) return;
      if (this.alpha0 === null) this.alpha0 = e.alpha;
      const a = THREE.MathUtils.degToRad(e.alpha - this.alpha0);
      const b = THREE.MathUtils.degToRad(e.beta);
      const g = THREE.MathUtils.degToRad(e.gamma);
      const o = THREE.MathUtils.degToRad(screen.orientation?.angle || window.orientation || 0);
      orientationToQuaternion(cam.quaternion, a, b, g, o);
    };
    window.addEventListener('deviceorientation', this.onOrient);
    const hit = new THREE.Vector3();
    app.renderer.setAnimationLoop((t) => {
      cam.updateMatrixWorld(true);
      if (!this.placed) this.updateReticle(hit, !!centerFloorHit(cam, hit));
      app.tick(t);
      app.render();
    });
  }

  async stop() {
    this.app.renderer.setAnimationLoop(null);
    window.removeEventListener('deviceorientation', this.onOrient);
    this.stream?.getTracks().forEach((tr) => tr.stop());
    this.video?.remove();
    this.teardownAR();
  }
}
