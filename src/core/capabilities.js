// Detecta o melhor backend de AR disponível no aparelho.

export async function detectCapabilities() {
  const ua = navigator.userAgent;
  const isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const touch = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const mobile = isIOS || isAndroid;
  const secure = window.isSecureContext;
  const camera = !!navigator.mediaDevices?.getUserMedia;
  let webxr = false;
  try {
    webxr = !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'));
  } catch {
    webxr = false;
  }
  const wasm = typeof WebAssembly === 'object';
  let backend = null;
  let hint;
  if (webxr) {
    backend = 'webxr';
    hint = 'AR nativo (ARCore) com detecção de chão.';
  } else if (mobile && camera && secure && wasm) {
    backend = 'xr8';
    hint = isIOS ? 'AR no Safari com rastreamento de chão (8th Wall).' : 'AR com rastreamento de chão (8th Wall).';
  } else if (touch && camera && secure) {
    backend = 'gyro';
    hint = 'AR simplificado: câmera + giroscópio.';
  } else {
    hint = secure ? 'Abra este endereço no celular para ver em AR.' : 'AR exige HTTPS.';
  }
  const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  return { isIOS, isAndroid, mobile, touch, secure, camera, webxr, backend, hint, lowEnd };
}
