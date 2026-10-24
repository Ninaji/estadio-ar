import * as THREE from 'three';
import gsap from 'gsap';
import { App } from './core/app.js';
import { ArenaWorker } from './core/arenaWorker.js';
import { detectCapabilities } from './core/capabilities.js';
import { VoxelArena } from './render/voxelScene.js';
import { Highlight } from './render/highlight.js';
import { ViewerMode } from './modes/viewerMode.js';
import { WebXRMode } from './modes/webxrMode.js';
import { XR8Mode, preloadXR8, requestMotionPermission } from './modes/xr8Mode.js';
import { GyroMode } from './modes/gyroMode.js';
import { Hud } from './ui/hud.js';
import * as panels from './ui/panels.js';
import { Synth } from './audio/synth.js';
import { CutController } from './slicing/cutController.js';
import { VoxelParticles, CONFETTI } from './fx/particles.js';
import { Crowd } from './fx/crowd.js';
import { MiniMatch } from './fx/match.js';
import { ShowMode } from './fx/showMode.js';
import { playBuild } from './fx/buildPrint.js';
import { NavGraph } from './navigation/navGraph.js';
import { planRoute } from './navigation/routePlanner.js';
import { RouteView } from './navigation/routeView.js';
import { describeHit } from './content/parts.pt.js';
import { CAT_INDEX } from './stadium/palette.js';
import { LEVELS, BOWL } from './stadium/spec.js';

const params = new URLSearchParams(location.search);
// animações no tempo real mesmo quando o aparelho perde quadros
gsap.ticker.lagSmoothing(0);
if (params.has('debug')) document.body.classList.add('debug');

// ---------------------------------------------------------------------------
// Núcleo
// ---------------------------------------------------------------------------
const hud = new Hud(document.getElementById('ui'));
const app = new App(document.getElementById('scene'));
const synth = new Synth();
const worker = new ArenaWorker();
const arena = new VoxelArena();
arena.root.position.y = 14; // base da maquete apoiada no chão do palco
app.stage.add(arena.root);
app.stage.add(makeGroundShadow());

const confetti = new VoxelParticles(arena.root, { max: 2600 });
const sparks = new VoxelParticles(arena.root, { max: 3600, additive: true });
const highlight = new Highlight(arena.root);
const routeView = new RouteView(arena.root, synth);
const graph = new NavGraph();
const viewer = new ViewerMode();
const cuts = new CutController(arena, worker, () => syncCutTools());

const maskOf = (keys) => keys.reduce((m, k) => m | (1 << CAT_INDEX[k]), 0);
// raio-X normal: casca transparente; raio-X da rota: só assentos e circulação vertical sólidos
const GHOST_XRAY = maskOf(['estrutura', 'fachada', 'cobertura', 'terreno', 'campo']);
const GHOST_ROUTE = maskOf(['estrutura', 'fachada', 'cobertura', 'terreno', 'campo', 'circulacao', 'servicos', 'operacoes', 'instalacoes']);
const state = {
  active: new Set(),
  explode: { levels: 0, quads: 0 },
  hidden: 0,
  ghost: false,
  following: false,
  built: false,
  ticket: { tier: 2, sector: 8, row: 10, num: 12, gate: 'auto', accessible: false },
};
let caps = null;
let seats = null;
let crowd = null;
let match = null;
let show = null;
const seatIndex = new Map();
const rowsInfo = new Map();
const seatKey = (t, s, r, n) => ((t * 64 + s) * 64 + r) * 4096 + n;

app.onUpdate((dt, t) => {
  arena.update(t);
  confetti.update(dt, t);
  sparks.update(dt, t);
  routeView.update(dt, t);
  highlight.update();
  if (state.following && routeView.route && app.mode === viewer && viewer.controls) {
    const p = routeView.avatarPosition.clone();
    arena.root.localToWorld(p);
    const c = viewer.controls;
    c.target.lerp(p, Math.min(1, dt * 4));
    const want = p.clone().add(new THREE.Vector3(14, 12, 14));
    app.camera.position.lerp(want, Math.min(1, dt * 2));
  }
  if (document.body.classList.contains('debug')) {
    const info = app.renderer.info.render;
    hud.fpsEl.textContent = `${app.fps.toFixed(0)} fps · ${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris`;
  }
});

function makeGroundShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(330, 380).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.position.y = -0.2;
  mesh.renderOrder = -1;
  return mesh;
}

// ---------------------------------------------------------------------------
// Construção da arena (worker) e tela inicial
// ---------------------------------------------------------------------------
worker.onProgress = (p, label) => hud.setProgress(p, label);

async function boot() {
  caps = await detectCapabilities();
  hud.arHint.textContent = caps.hint;
  const voxel = params.get('qualidade') === 'leve' ? 1 : 0.5;
  const built = await worker.build(voxel);
  arena.build(built.dims, built.meshes);
  arena.uniforms.uBuildJ.value = -1;
  seats = built.seats;
  indexSeats();
  crowd = new Crowd(arena.root, arena, seats, caps.lowEnd ? 0.3 : 0.5);
  match = new MiniMatch(arena.root);
  show = new ShowMode({ app, arena, crowd, match, sparks, confetti, synth, hud });
  const nSeats = built.stats.seats.toLocaleString('pt-BR');
  const nVox = (built.stats.voxels / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  hud.setProgress(1, `Pronta: ${nSeats} lugares · ${nVox} milhões de voxels`);
  hud.btn3D.disabled = false;
  hud.btnAR.disabled = !caps.backend;
  if (caps.backend === 'xr8') preloadXR8().catch(() => {});
  await app.setMode(viewer);
  resetCamera(false);
}

/** Enquadra a maquete inteira; telas em retrato precisam de mais distância. */
function resetCamera(animate) {
  const aspect = window.innerWidth / window.innerHeight;
  const k = aspect < 1 ? 1.15 / aspect : 1;
  const to = { x: 210 * k * 0.85, y: 185 * k * 0.85, z: 250 * k * 0.85 };
  if (animate) {
    gsap.to(viewer.controls.target, { x: 0, y: 10, z: 0, duration: 1 });
    gsap.to(app.camera.position, { ...to, duration: 1, ease: 'power2.inOut' });
  } else {
    viewer.controls.target.set(0, 10, 0);
    app.camera.position.set(to.x, to.y, to.z);
    viewer.controls.update();
  }
}

function indexSeats() {
  const n = seats.length / 7;
  for (let q = 0; q < n; q++) {
    const [, , , t, s, r, num] = seats.subarray(q * 7, q * 7 + 7);
    seatIndex.set(seatKey(t, s, r, num), q);
    const k = t * 64 + s;
    if (!rowsInfo.has(k)) rowsInfo.set(k, new Map());
    const rows = rowsInfo.get(k);
    rows.set(r, Math.max(rows.get(r) || 0, num));
  }
}

function seatRecord(q) {
  const a = seats.subarray(q * 7, q * 7 + 7);
  return { i: a[0], j: a[1], k: a[2], tier: a[3], sector: a[4], row: a[5], num: a[6] };
}

async function startExperience() {
  hud.hideIntro();
  if (!state.built) {
    state.built = true;
    await playBuild({ arena, sparks, confetti, synth });
    show.showCabins();
    synth.whistle(false);
    hud.toast('Toque em qualquer parte para descobrir o que é', 3200);
  }
}

hud.btn3D.addEventListener('click', async () => {
  synth.unlock();
  hud.modeChip.textContent = '3D';
  startExperience();
});

hud.btnAR.addEventListener('click', () => enterAR());

async function enterAR() {
  synth.unlock();
  // permissão de movimento precisa ser pedida dentro do toque, antes de qualquer await
  const motion = caps.backend === 'xr8' || caps.backend === 'gyro' ? requestMotionPermission() : Promise.resolve(true);
  hud.hideIntro();
  const ctx = {
    hud,
    synth,
    onPlaced: () => {
      synth.thump();
      sparks.emit({ position: { x: 0, y: -13, z: 0 }, count: 160, speed: 40, spread: 0.3, dir: { x: 0, y: 0.2, z: 0 }, ring: 110, colors: [0xffffff, 0xd6d3cc, 0x7df9ff], life: [0.6, 1.2], size: [1.5, 3], gravity: 0, drag: 2 });
      startExperience();
      hud.modeChip.textContent = 'AR';
    },
    onTap: (ray) => pickRay(ray),
    onExit: () => exitAR(),
    onFail: (err) => arFailed(err),
  };
  try {
    if (caps.backend === 'webxr') await app.setMode(new WebXRMode(ctx));
    else if (caps.backend === 'xr8') {
      hud.arTip.textContent = 'Carregando o motor de AR…';
      await motion;
      await app.setMode(new XR8Mode(ctx));
    } else {
      await motion;
      await app.setMode(new GyroMode(ctx));
    }
    hud.modeChip.textContent = 'AR';
    closeSheet();
  } catch (err) {
    arFailed(err);
  }
}

async function arFailed(err) {
  console.error(err);
  // 8th Wall falhou? tenta o modo câmera + giroscópio; senão volta ao 3D
  if (app.mode?.id === 'xr8' || caps.backend === 'xr8') {
    caps.backend = 'gyro';
    hud.toast('Rastreamento de chão indisponível — usando câmera + giroscópio', 3500);
    try {
      await app.setMode(new GyroMode({ hud, synth, onPlaced: () => startExperience(), onTap: (r) => pickRay(r), onExit: () => exitAR() }));
      return;
    } catch (e2) {
      console.error(e2);
    }
  }
  hud.toast('Não foi possível abrir a câmera. Abrindo em 3D.', 3500);
  await exitAR();
  startExperience();
}

async function exitAR() {
  if (app.mode === viewer) return;
  await app.setMode(viewer);
  resetCamera(false);
  hud.modeChip.textContent = '3D';
}

// som
hud.btnSound.addEventListener('click', () => {
  synth.unlock();
  synth.setMuted(!synth.muted);
  hud.setSoundIcon(!synth.muted);
  if (!synth.muted) synth.click();
});

// ---------------------------------------------------------------------------
// Seleção por toque
// ---------------------------------------------------------------------------
{
  let down = null;
  const canvas = app.canvas;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || app.mode !== viewer || !state.built) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved < 8 && performance.now() - down.t < 400) {
      const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, app.camera);
      pickRay(ray.ray);
    }
    down = null;
  });
}

async function pickRay(ray) {
  synth.unlock();
  arena.content.updateMatrixWorld(true);
  const inv = arena.content.matrixWorld.clone().invert();
  const o = ray.origin.clone().applyMatrix4(inv);
  const d = ray.direction.clone().transformDirection(inv);
  const hit = await worker.pick([o.x, o.y, o.z], [d.x, d.y, d.z], cuts.toGrid(), state.hidden, arena.groupOffsets());
  if (!hit) {
    highlight.hide();
    if (hud.sheetKey === 'info') closeSheet();
    return;
  }
  const info = describeHit(hit, arena.dims);
  const { voxel, ox, oy, oz } = arena.dims;
  const g = arena.groups[groupOfHit(hit)];
  const off = g.position.clone().multiplyScalar(voxel);
  let min;
  let max;
  if (info.room && !info.room.ring) {
    ({ min, max } = roomBounds(info.room));
  } else {
    min = new THREE.Vector3(ox + hit.i * voxel, oy + hit.j * voxel, oz + hit.k * voxel);
    max = min.clone().addScalar(voxel);
  }
  highlight.show(min.add(off), max.add(off), info.color);
  hud.openSheet(panels.infoPanel(info, ctxApi), 'info');
  synth.click();
}

function groupOfHit(hit) {
  const y = arena.dims.oy + (hit.j + 0.5) * arena.dims.voxel;
  let L = 0;
  for (let q = LEVELS.length - 1; q >= 0; q--) if (y >= LEVELS[q].y0) { L = q; break; }
  return L * 4 + (hit.i < arena.dims.nx / 2 ? 0 : 1) + (hit.k < arena.dims.nz / 2 ? 0 : 2);
}

function roomBounds(r) {
  const { hx, hz } = BOWL;
  let x0;
  let x1;
  let z0;
  let z1;
  if (r.side === 'W') { x0 = -(hx + r.d1); x1 = -(hx + r.d0); z0 = r.u0; z1 = r.u1; }
  else if (r.side === 'E') { x0 = hx + r.d0; x1 = hx + r.d1; z0 = r.u0; z1 = r.u1; }
  else if (r.side === 'N') { z0 = -(hz + r.d1); z1 = -(hz + r.d0); x0 = r.u0; x1 = r.u1; }
  else { z0 = hz + r.d0; z1 = hz + r.d1; x0 = r.u0; x1 = r.u1; }
  return { min: new THREE.Vector3(x0, r.y0, z0), max: new THREE.Vector3(x1, r.y1, z1) };
}

// ---------------------------------------------------------------------------
// Ferramentas
// ---------------------------------------------------------------------------
const PANEL_TOOLS = ['planta', 'secao', 'fatia', 'niveis', 'pedacos', 'camadas', 'rota', 'show'];

hud.onTool = (id) => {
  synth.unlock();
  if (!state.built) return;
  if (state.active.has(id) && hud.sheetKey !== id && PANEL_TOOLS.includes(id)) {
    openPanel(id);
    synth.click();
    return;
  }
  if (id === 'camadas') {
    if (hud.sheetKey === 'camadas') closeSheet();
    else openPanel('camadas');
    synth.click();
    return;
  }
  toggleTool(id);
};

hud.onSheetClosed = () => highlight.hide();

function setActive(id, on) {
  if (on) state.active.add(id);
  else state.active.delete(id);
  const list = [...state.active];
  if (state.hidden) list.push('camadas');
  hud.setActiveTools(list);
}

function openPanel(id) {
  const map = {
    planta: () => panels.planPanel(ctxApi),
    secao: () => panels.sectionPanel(ctxApi),
    fatia: () => panels.slicePanel(ctxApi),
    niveis: () => panels.explodePanel(ctxApi, 'niveis'),
    pedacos: () => panels.explodePanel(ctxApi, 'pedacos'),
    camadas: () => panels.layersPanel(ctxApi),
    show: () => panels.showPanel(ctxApi),
    rota: () => (routeView.route ? panels.routePanel(routeView.route, ctxApi) : panels.ticketPanel(ctxApi)),
  };
  if (!map[id]) return;
  highlight.hide();
  hud.openSheet(map[id](), id);
  if (id === 'rota' && routeView.route) panels.highlightStep(hud.sheetBody, routeView.stepIdx);
}

function closeSheet() {
  hud.closeSheet(false);
}

function closeIf(id) {
  if (hud.sheetKey === id) closeSheet();
}

function toggleTool(id, force) {
  const on = force ?? !state.active.has(id);
  switch (id) {
    case 'planta': {
      if (on) {
        const st = cuts.state.h;
        const target = st.y;
        cuts.set('h', { on: true, y: 46 });
        gsap.to(st, { y: target, duration: 1.1, ease: 'power3.out', onUpdate: () => cuts.apply() });
        synth.whoosh(0.9, false);
        openPanel('planta');
      } else {
        cuts.set('h', { on: false });
        closeIf('planta');
        synth.whoosh(0.5, true);
      }
      break;
    }
    case 'secao':
      cuts.set('v', { on });
      synth.whoosh(0.6, on);
      if (on) openPanel('secao');
      else closeIf('secao');
      break;
    case 'fatia':
      if (on) {
        const open = cuts.state.w.open > 10 ? cuts.state.w.open : 90;
        cuts.state.w.open = 0;
        cuts.state.w.on = true;
        animateWedge(open);
        openPanel('fatia');
      } else {
        gsap.to(cuts.state.w, { open: 0, duration: 0.6, ease: 'power2.in', onUpdate: () => cuts.apply(), onComplete: () => { cuts.state.w.open = 90; cuts.set('w', { on: false }); } });
        synth.whoosh(0.6, false);
        closeIf('fatia');
      }
      break;
    case 'niveis':
    case 'pedacos':
      setExplode(id, on ? 1 : 0, true);
      if (on) openPanel(id);
      else closeIf(id);
      break;
    case 'raiox':
      state.ghost = on;
      arena.setGhost(on ? (routeView.route ? GHOST_ROUTE : GHOST_XRAY) : 0);
      synth.toggle(on);
      hud.toast(on ? 'Raio-X: estrutura, fachada, cobertura e solo transparentes' : 'Raio-X desligado');
      break;
    case 'rota':
      if (on) {
        openPanel('rota');
        return;
      }
      clearRoute();
      break;
    case 'show':
      show.toggle(on);
      if (on) openPanel('show');
      else closeIf('show');
      break;
    case 'reset':
      resetAll();
      return;
    default:
      return;
  }
  if (id !== 'rota') setActive(id, on);
  if (id === 'planta' || id === 'secao' || id === 'fatia') synth.toggle(on);
}

function syncCutTools() {
  const s = cuts.state;
  for (const [id, on] of [['planta', s.h.on], ['secao', s.v.on], ['fatia', s.w.on]]) {
    if (on !== state.active.has(id)) setActive(id, on);
  }
}

function animateWedge(open) {
  gsap.to(cuts.state.w, { open, duration: 0.9, ease: 'back.out(1.4)', onUpdate: () => cuts.apply() });
  synth.whoosh(0.8, true);
}

function setExplode(kind, value, animate) {
  const key = kind === 'niveis' ? 'levels' : 'quads';
  if (value > 0 && routeView.route) clearRoute();
  const apply = () => arena.setExplode(state.explode.levels, state.explode.quads);
  if (animate) {
    gsap.to(state.explode, {
      [key]: value,
      duration: value > 0 ? 1.4 : 0.9,
      ease: value > 0 ? 'elastic.out(1, 0.55)' : 'power3.inOut',
      onUpdate: apply,
      onComplete: () => value === 0 && synth.thump(),
    });
    synth.whoosh(value > 0 ? 1.0 : 0.7, value > 0);
  } else {
    state.explode[key] = value;
    apply();
  }
  setActive(kind, value > 0);
}

function setPlanLevel(i) {
  const L = LEVELS[i];
  const y = L.floor + 1.5;
  gsap.to(cuts.state.h, { y, duration: 0.8, ease: 'power2.inOut', onUpdate: () => cuts.set('h', { on: true }) });
  synth.whoosh(0.5, y > cuts.state.h.y);
  hud.toast(`Planta: ${L.name}`);
}

function setHidden(mask) {
  state.hidden = mask;
  arena.setHidden(mask);
  setActive('camadas', false);
}

function toggleCategory(i) {
  const off = ((state.hidden >> i) & 1) === 0;
  setHidden(off ? state.hidden | (1 << i) : state.hidden & ~(1 << i));
  synth.toggle(!off);
  return off;
}

function isolate(keep) {
  const keepIdx = keep.map((k) => CAT_INDEX[k]);
  let mask = 0;
  for (let i = 0; i < 12; i++) if (!keepIdx.includes(i)) mask |= 1 << i;
  setHidden(mask);
  synth.whoosh(0.5);
}

function resetAll() {
  gsap.killTweensOf(cuts.state.h);
  gsap.killTweensOf(cuts.state.w);
  cuts.clear();
  setExplode('niveis', 0, true);
  setExplode('pedacos', 0, true);
  setHidden(0);
  if (state.ghost) toggleTool('raiox', false);
  clearRoute();
  if (show?.on) toggleTool('show', false);
  highlight.hide();
  closeSheet();
  state.active.clear();
  hud.setActiveTools([]);
  if (app.mode === viewer) {
    resetCamera(true);
  } else if (app.mode?.reposition) {
    app.mode.reposition();
  }
  synth.whoosh(0.7, false);
}

// ---------------------------------------------------------------------------
// Rota até o assento
// ---------------------------------------------------------------------------
function traceRoute(ticket) {
  Object.assign(state.ticket, ticket);
  const q = seatIndex.get(seatKey(ticket.tier, ticket.sector, ticket.row, ticket.num));
  if (q === undefined) {
    hud.toast('Esse assento não existe nesta fila.');
    return;
  }
  const seat = seatRecord(q);
  const route = planRoute(graph, seat, arena.dims, { gate: ticket.gate, accessible: ticket.accessible });
  if (!route) {
    hud.toast('Não encontrei um caminho para esse assento.');
    return;
  }
  if (state.explode.levels || state.explode.quads) {
    setExplode('niveis', 0, true);
    setExplode('pedacos', 0, true);
  }
  routeView.show(route);
  state.ghost = true;
  setActive('raiox', true);
  arena.setGhost(GHOST_ROUTE);
  routeView.onStep = (k) => {
    if (hud.sheetKey === 'rota') panels.highlightStep(hud.sheetBody, k);
    synth.beep(1.3);
  };
  routeView.onArrive = (p) => {
    confetti.emit({ position: { x: p.x, y: p.y + 3, z: p.z }, count: 120, speed: 9, spread: 1, colors: CONFETTI, life: [1.5, 3], size: [0.3, 0.6], gravity: -4, drag: 1, flutter: 6 });
    synth.chime();
    hud.toast('Você chegou ao seu lugar! 🎉', 3000);
  };
  setActive('rota', true);
  hud.openSheet(panels.routePanel(route, ctxApi), 'rota');
  synth.chime();
  // enquadra a rota
  if (app.mode === viewer) {
    const box = new THREE.Box3();
    route.points.forEach((p) => box.expandByPoint(new THREE.Vector3(p.x, p.y + 14, p.z)));
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    viewer.focus(c, Math.max(70, size * 0.9), gsap);
  }
}

function clearRoute() {
  routeView.clear();
  state.following = false;
  setActive('rota', false);
  closeIf('rota');
  if (state.ghost) toggleTool('raiox', false);
}

function randomTicket() {
  const n = seats.length / 7;
  const seat = seatRecord(Math.floor(Math.random() * n));
  synth.click();
  traceRoute({ ...state.ticket, tier: seat.tier, sector: seat.sector, row: seat.row, num: seat.num });
}

// API usada pelos painéis
const ctxApi = {
  cuts,
  synth,
  get explode() { return state.explode; },
  get layers() { return { hidden: state.hidden }; },
  get show() { return show; },
  get ticket() { return state.ticket; },
  get following() { return state.following; },
  get canFollow() { return app.mode === viewer; },
  toggleTool,
  refreshPanel: () => hud.sheetKey && openPanel(hud.sheetKey),
  setPlanLevel,
  animateWedge,
  setExplode,
  setHidden,
  toggleCategory,
  isolate,
  traceRoute,
  randomTicket,
  routeToSeat: (s) => traceRoute({ ...state.ticket, ...s }),
  replayRoute: () => { routeView.restart(); synth.click(); },
  toggleFollow: () => { state.following = !state.following; synth.toggle(state.following); },
  openTicket: () => { hud.openSheet(panels.ticketPanel(ctxApi), 'rota'); },
  rowsFor: (t, s) => [...(rowsInfo.get(t * 64 + s) || new Map()).entries()].sort((a, b) => a[0] - b[0]).map(([row, count]) => ({ row, count })),
  seatsIn: (t, s, r) => rowsInfo.get(t * 64 + s)?.get(r) || 0,
};

// impede que toques nos painéis virem seleção no WebXR
for (const el of [hud.hud, hud.modal]) el.addEventListener('beforexrselect', (e) => e.preventDefault());

// ganchos de depuração para testes automatizados
window.__arena = { app, arena, worker, cuts, routeView, graph, state, THREE, ui: ctxApi, hud, get show() { return show; }, viewer, pickRay };

boot().catch((err) => {
  console.error(err);
  hud.setProgress(1, `Erro ao gerar a arena: ${err.message}`);
});
