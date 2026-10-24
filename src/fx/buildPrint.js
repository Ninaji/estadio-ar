// Construção estilo impressora 3D: a arena "sobe" camada por camada com faíscas e bipes.
import gsap from 'gsap';
import { CONFETTI } from './particles.js';
import { pointAt } from '../stadium/spec.js';

export function playBuild({ arena, sparks, confetti, synth, duration = 3.4 }) {
  const dims = arena.dims;
  const u = arena.uniforms.uBuildJ;
  const state = { j: 0 };
  let lastBeep = -1;
  return new Promise((resolve) => {
    gsap.to(state, {
      j: dims.ny + 2,
      duration,
      ease: 'power1.inOut',
      onUpdate: () => {
        u.value = state.j;
        const y = dims.oy + state.j * dims.voxel;
        const layer = Math.floor(state.j / 4);
        if (layer !== lastBeep) {
          lastBeep = layer;
          synth.beep(0.8 + (state.j / dims.ny) * 0.8);
          for (let n = 0; n < 6; n++) {
            const seg = (Math.random() * 9) | 0;
            const d = -6 + Math.random() * 62;
            const t = seg % 2 === 1 ? Math.random() * Math.PI / 2 : Math.random() * 40;
            const p = pointAt(seg, t, d);
            sparks.emit({ position: { x: p.x, y, z: p.z }, count: 4, speed: 6, spread: 1, colors: [0x7df9ff, 0xffffff, 0xa66bff], life: [0.3, 0.7], size: [0.5, 0.9], gravity: -4 });
          }
        }
      },
      onComplete: () => {
        u.value = 1e5;
        synth.thump();
        synth.chime();
        confetti.emit({ position: { x: 0, y: 50, z: 0 }, count: 260, speed: 22, spread: 1, colors: CONFETTI, life: [2.5, 4.5], size: [0.6, 1.1], gravity: -4, drag: 1, flutter: 8 });
        resolve();
      },
    });
  });
}
