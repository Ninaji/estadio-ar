// AR nativo (WebXR immersive-ar + hit-test + dom-overlay) — Android Chrome com ARCore.
import * as THREE from 'three';
import { ARBase } from './arBase.js';

export class WebXRMode extends ARBase {
  constructor(ctx) {
    super(ctx);
    this.id = 'webxr';
    this.label = 'AR';
    this.ownsProjection = true;
  }

  /** Deve ser chamado dentro do toque do usuário. */
  async start(app) {
    this.app = app;
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'local-floor'],
      domOverlay: { root: document.getElementById('ui') },
    });
    this.session = session;
    this.setupAR(app, 'ar-xr');
    const { renderer } = app;
    renderer.xr.setReferenceSpaceType('local');
    renderer.xr.setFramebufferScaleFactor(0.85);
    const tmp = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    // o laço precisa ser definido ANTES da sessão: no r186 setAnimationLoop religa o laço
    // da janela, e depois do sessionstart isso desenharia fora dos quadros XR
    renderer.setAnimationLoop((t, frame) => {
      if (!frame) return;
      if (this.hitSource && !this.placed) {
        const ref = renderer.xr.getReferenceSpace();
        const hits = frame.getHitTestResults(this.hitSource);
        const pose = hits.length ? hits[0].getPose(ref) : null;
        if (pose) {
          tmp.fromArray(pose.transform.matrix);
          pos.setFromMatrixPosition(tmp);
        }
        // a câmera XR ainda não foi atualizada neste quadro: usa a do quadro anterior
        this.app.camera.position.setFromMatrixPosition(renderer.xr.getCamera().matrixWorld);
        this.updateReticle(pos, !!pose);
      }
      app.tick(t);
      app.render();
    });
    await renderer.xr.setSession(session);
    const viewer = await session.requestReferenceSpace('viewer');
    this.hitSource = await session.requestHitTestSource({ space: viewer });
    session.addEventListener('end', () => {
      this.session = null;
      this.ctx.onExit?.(true);
    });
    // sem dom-overlay a interface some: um toque na tela posiciona o estádio
    if (!session.domOverlayState) {
      session.addEventListener('select', () => {
        if (!this.placed) this.place();
      });
    }
  }

  pickCamera() {
    const xrCam = this.app.renderer.xr.getCamera();
    return xrCam.cameras?.[0] || xrCam;
  }

  async stop() {
    if (!this.app) return;
    this.app.renderer.setAnimationLoop(null);
    this.hitSource?.cancel?.();
    this.hitSource = null;
    if (this.session) {
      const s = this.session;
      this.session = null;
      await s.end().catch(() => {});
    }
    this.teardownAR();
  }
}
