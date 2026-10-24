// Material voxel: cor da paleta, bisel suave por voxel, AO por vértice,
// descarte pelos cortes/camadas, raio-X e emissivos animados no modo Show.
import * as THREE from 'three';
import { MATERIALS } from '../stadium/palette.js';

export function createPaletteTexture() {
  const data = new Uint8Array(256 * 2 * 4);
  MATERIALS.forEach((m, i) => {
    const c = new THREE.Color(m.color);
    data[i * 4] = Math.round(c.r * 255);
    data[i * 4 + 1] = Math.round(c.g * 255);
    data[i * 4 + 2] = Math.round(c.b * 255);
    data[i * 4 + 3] = Math.round(m.alpha * 255);
    const o = (256 + i) * 4;
    data[o] = Math.round(Math.min(2.5, m.emissive) * 100);
    data[o + 1] = Math.max(0, m.cat);
    data[o + 2] = m.screen ? 255 : m.key === 'fachada_led' ? 128 : 0;
    data[o + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, 256, 2, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createSharedUniforms(palette) {
  return {
    uPalette: { value: palette },
    uCutH: { value: 0 },
    uCutJ: { value: 0 },
    uCutV: { value: 0 },
    uCutAxis: { value: 0 },
    uCutIdx: { value: 0 },
    uCutSide: { value: 1 },
    uCutW: { value: 0 },
    uWedgeC: { value: new THREE.Vector2() },
    uWedgeA0: { value: 0 },
    uWedgeAW: { value: 0 },
    uHidden: { value: 0 },
    uGhost: { value: 0 },
    uTime: { value: 0 },
    uNight: { value: 0 },
    uFx: { value: 0 },
    uBuildJ: { value: 1e5 },
    uLightDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() },
    uOpacity: { value: 1 },
    uVoxel: { value: 0.5 },
    uOrigin: { value: new THREE.Vector3() },
  };
}

const vertex = /* glsl */ `
  in vec2 aMI;
  uniform sampler2D uPalette;
  out vec3 vGrid;
  out vec3 vN;
  out vec3 vCol;
  out float vAlpha;
  out float vAO;
  out float vCap;
  out vec4 vInfo;

  void main() {
    float f = aMI.y;
    float dir = mod(f, 8.0);
    float axis = floor(dir / 2.0);
    float sgn = mod(dir, 2.0) > 0.5 ? -1.0 : 1.0;
    vN = vec3(axis < 0.5 ? sgn : 0.0, abs(axis - 1.0) < 0.5 ? sgn : 0.0, axis > 1.5 ? sgn : 0.0);
    vAO = mod(floor(f / 8.0), 4.0);
    vCap = floor(f / 32.0);
    int mat = int(aMI.x + 0.5);
    vec4 c = texelFetch(uPalette, ivec2(mat, 0), 0);
    vCol = pow(c.rgb, vec3(2.2));
    vAlpha = c.a;
    vInfo = texelFetch(uPalette, ivec2(mat, 1), 0);
    vGrid = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uCutH, uCutJ, uCutV, uCutAxis, uCutIdx, uCutSide, uCutW, uWedgeA0, uWedgeAW;
  uniform vec2 uWedgeC;
  uniform int uHidden;
  uniform int uGhost;
  uniform float uTime, uNight, uFx, uBuildJ, uOpacity, uVoxel;
  uniform vec3 uLightDir, uOrigin;
  in vec3 vGrid;
  in vec3 vN;
  in vec3 vCol;
  in float vAlpha;
  in float vAO;
  in float vCap;
  in vec4 vInfo;

  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  vec3 hsv(float h, float s, float v) {
    vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return v * mix(vec3(1.0), k, s);
  }

  void main() {
    vec3 vox = floor(vGrid - vN * 0.5);
    #ifdef USE_CUT
      if (uCutH > 0.5 && vox.y >= uCutJ) discard;
      if (uCutV > 0.5) {
        float c = uCutAxis < 0.5 ? vox.x : vox.z;
        if (uCutSide > 0.0 ? c >= uCutIdx : c < uCutIdx) discard;
      }
      if (uCutW > 0.5) {
        vec2 p = vox.xz + 0.5 - uWedgeC;
        float da = mod(atan(p.y, p.x) - uWedgeA0, 6.28318530718);
        if (da < uWedgeAW) discard;
      }
    #endif
    if (vox.y > uBuildJ) discard;
    int cat = int(vInfo.g * 255.0 + 0.5);
    if (((uHidden >> cat) & 1) == 1) discard;

    // bisel suave: escurece a borda de cada voxel (antisserrilhado por fwidth)
    vec3 fr = fract(vGrid);
    vec2 uv = abs(vN.x) > 0.5 ? fr.yz : (abs(vN.y) > 0.5 ? fr.xz : fr.xy);
    vec2 e2 = min(uv, 1.0 - uv);
    float edge = min(e2.x, e2.y);
    float fw = max(length(fwidth(vGrid)), 1e-4);
    float bevel = smoothstep(0.03, 0.09 + fw, edge);
    float fade = clamp(1.6 - fw * 2.2, 0.0, 1.0);

    bool ghost = ((uGhost >> cat) & 1) == 1;
    #ifdef GHOST_PASS
      if (!ghost) discard;
    #else
      if (ghost) discard;
    #endif

    vec3 base = vCol * (0.9 + 0.16 * hash3(vox));
    float diff = max(dot(vN, uLightDir), 0.0);
    float sky = 0.5 + 0.5 * vN.y;
    float aoF = mix(0.42, 1.0, vAO / 3.0);
    vec3 ambient = mix(vec3(0.46, 0.42, 0.40), vec3(0.66, 0.72, 0.82), sky);
    vec3 light = ambient * aoF + vec3(1.0, 0.95, 0.88) * diff * 0.78 * mix(0.55, 1.0, aoF);
    light *= mix(1.0, 0.3, uNight);
    // refletores: à noite o gramado e as arquibancadas baixas ficam banhados de luz
    if (uNight > 0.0) {
      vec3 pm = vGrid * uVoxel + uOrigin;
      float spread = length(max(abs(pm.xz) - vec2(30.0, 48.0), 0.0));
      float flood = uNight * (1.0 - smoothstep(4.0, 60.0, spread)) * (1.0 - smoothstep(10.0, 40.0, pm.y));
      light += vec3(1.0, 0.97, 0.9) * flood * (0.55 + 0.45 * max(vN.y, 0.0)) * aoF;
    }
    vec3 col = base * light;
    col *= mix(1.0, mix(0.68, 1.04, bevel), fade);

    // tampas do corte: camadas de bolo mais vivas
    if (vCap > 0.5) col = mix(col, base * 1.08 + 0.025, 0.55);

    // emissivos (LEDs, refletores, telões)
    float em = vInfo.r * 2.55;
    if (em > 0.0) {
      vec3 ec = base;
      if (vInfo.b > 0.9) {
        float s = sin(vGrid.x * 0.35 + vGrid.z * 0.35 - uTime * 3.0) * 0.5 + 0.5;
        float px = step(0.25, fract(vGrid.y)) * step(0.25, fract(vGrid.x + vGrid.z));
        ec = mix(hsv(fract(uTime * 0.05 + vGrid.y * 0.02), 0.8, 1.0), vec3(1.0), s * 0.4) * (0.55 + 0.45 * px);
      } else if (vInfo.b > 0.4) {
        ec = hsv(fract(uTime * 0.12 + vGrid.y * 0.012 + (vGrid.x + vGrid.z) * 0.004), 0.75, 1.0);
      }
      // de dia com efeitos os LEDs e telões já brilham; à noite brilham bem mais
      col += ec * em * (0.12 + 0.38 * uFx * (1.0 - uNight) + 0.95 * uNight);
    }
    #ifdef GHOST_PASS
      // raio-X: vidro azulado com as arestas dos voxels acesas
      float rim = (1.0 - bevel) * fade;
      gl_FragColor = vec4(mix(col, vec3(0.45, 0.85, 1.0), 0.7) + rim * 0.25, 0.07 + rim * 0.22);
      #include <colorspace_fragment>
      return;
    #endif

    // borda brilhante da camada sendo "impressa" na construção
    if (uBuildJ < 1e4 && vox.y > uBuildJ - 1.5) col += vec3(0.25, 0.9, 1.0) * 0.8;

    gl_FragColor = vec4(col, vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

export function createVoxelMaterial(uniforms, { translucent = false, cut = false, ghost = false } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: translucent || ghost,
    depthWrite: !(translucent || ghost),
    side: THREE.FrontSide,
  });
  mat.defines = {};
  if (cut) mat.defines.USE_CUT = '';
  if (ghost) mat.defines.GHOST_PASS = '';
  return mat;
}
