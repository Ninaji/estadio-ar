// AR com rastreamento de chão (SLAM) do 8th Wall Engine — iPhone/iPad Safari e Android sem ARCore.
// Usa um módulo de pipeline próprio: o mesmo canvas e o mesmo WebGLRenderer do app.
import * as THREE from 'three';
import { ARBase, centerFloorHit } from './arBase.js';

const XR8_URL = 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1.0.0/dist/xr.js';
const LOAD_TIMEOUT = 45000;
let loading = null;

/** Injeta o script do engine uma única vez (pode ser chamado cedo para pré-carregar). */
export function preloadXR8() {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (window.XR8) return resolve(window.XR8);
    let script = document.querySelector('script[data-xr8]');
    // o engine só dispara 'xrloaded' depois de baixar o pedaço 'slam'; sem timeout, uma
    // falha nesse download deixaria a promessa pendente para sempre
    const timer = setTimeout(() => fail(new Error('O motor de AR demorou demais para carregar.')), LOAD_TIMEOUT);
    function done() {
      clearTimeout(timer);
      resolve(window.XR8);
    }
    function fail(err) {
      clearTimeout(timer);
      loading = null;
      reject(err);
    }
    window.addEventListener('xrloaded', done, { once: true });
    if (!script) {
      script = document.createElement('script');
      script.src = XR8_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.preloadChunks = 'slam';
      script.dataset.xr8 = '';
      script.onerror = () => {
        script.remove();
        fail(new Error('Não foi possível baixar o motor de AR.'));
      };
      document.head.append(script);
    }
  });
  return loading;
}

/** Pede permissão de sensores de movimento (iOS) — chamar no toque, antes de qualquer await. */
export function requestMotionPermission() {
  const asks = [];
  if (window.DeviceOrientationEvent?.requestPermission) asks.push(window.DeviceOrientationEvent.requestPermission());
  if (window.DeviceMotionEvent?.requestPermission) asks.push(window.DeviceMotionEvent.requestPermission());
  return Promise.all(asks).then((r) => r.every((x) => x === 'granted')).catch(() => false);
}

export class XR8Mode extends ARBase {
  constructor(ctx) {
    super(ctx);
    this.id = 'xr8';
    this.label = 'AR';
    this.ownsProjection = true;
    this.ownsCanvas = true;
  }

  async start(app) {
    this.app = app;
    const XR8 = await preloadXR8();
    if (XR8.loadChunk) await XR8.loadChunk('slam');
    this.XR8 = XR8;
    this.setupAR(app, 'ar-xr8');
    const { renderer, camera } = app;
    // canvasWidth/Height do engine já são pixels do buffer: com pixel ratio > 1 o
    // setSize multiplicaria de novo a cada redimensionamento
    this.savedPixelRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.autoClear = false;
    camera.position.set(0, 1.5, 0);
    camera.quaternion.identity();
    const hit = new THREE.Vector3();
    const module = {
      name: 'arena-aurora',
      onStart: ({ canvasWidth, canvasHeight }) => {
        renderer.setSize(canvasWidth, canvasHeight, false);
        XR8.XrController.updateCameraProjectionMatrix({
          origin: camera.position,
          facing: camera.quaternion,
        });
      },
      onCanvasSizeChange: ({ canvasWidth, canvasHeight }) => renderer.setSize(canvasWidth, canvasHeight, false),
      onUpdate: ({ processCpuResult }) => {
        const reality = processCpuResult?.reality;
        if (!reality) return;
        const { rotation, position, intrinsics } = reality;
        if (intrinsics) {
          camera.projectionMatrix.fromArray(intrinsics);
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        }
        if (position) camera.position.set(position.x, position.y, position.z);
        if (rotation) camera.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        camera.updateMatrixWorld(true);
        if (!this.placed) {
          const p = centerFloorHit(camera, hit);
          this.updateReticle(hit, !!p);
        }
      },
      onRender: () => {
        app.tick(performance.now());
        renderer.resetState();
        renderer.clear(false, true, true);
        app.render();
      },
      onCameraStatusChange: ({ status, reason }) => {
        if (status === 'failed') this.ctx.onFail?.(new Error(`Câmera indisponível (${reason || 'falha'})`));
      },
      onException: (err) => {
        console.error('8th Wall', err);
        this.ctx.onFail?.(err);
      },
    };
    this.module = module;
    XR8.XrController.configure({ scale: 'responsive', disableWorldTracking: false });
    XR8.addCameraPipelineModules([XR8.XrController.pipelineModule(), XR8.GlTextureRenderer.pipelineModule(), module]);
    XR8.run({ canvas: app.canvas, allowedDevices: XR8.XrConfig.device().ANY });
  }

  async stop() {
    if (!this.app) return;
    const XR8 = this.XR8;
    if (XR8) {
      try {
        XR8.stop();
        XR8.clearCameraPipelineModules();
      } catch (e) {
        console.warn(e);
      }
    }
    const { app } = this;
    app.renderer.autoClear = true;
    app.renderer.resetState();
    if (this.savedPixelRatio) app.renderer.setPixelRatio(this.savedPixelRatio);
    this.teardownAR();
  }
}
