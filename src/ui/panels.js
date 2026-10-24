// Conteúdo dos painéis. Cada função devolve { title, icon|swatch, body }.
// Valores numéricos ficam em caixas de largura fixa: arrastar um slider não move nada.
import { h, blk } from './hud.js';
import { LEVELS, TIERS, SECTORS, SECTOR_ORDER, GATES, HALF_X, HALF_Z } from '../stadium/spec.js';
import { CATEGORIES } from '../stadium/palette.js';

const SHORT = {
  estrutura: 'Estrutura', assentos: 'Assentos', circulacao: 'Circulação', vertical: 'Escadas', servicos: 'Serviços',
  operacoes: 'Operação', cobertura: 'Cobertura', campo: 'Campo', terreno: 'Terreno', instalacoes: 'Instalações',
  fachada: 'Fachada', iluminacao: 'Luzes',
};

let sliderTick = () => {};
/** Som de "clique de bloco" enquanto arrasta um slider. */
export function setSliderTick(fn) {
  sliderTick = fn;
}

/** Linha rótulo + slider + valor fixo. */
function ctrl(label, { min, max, step = 1, value, fmt = (v) => String(v), onInput }) {
  const val = h('div', { class: 'val' }, fmt(value));
  const input = h('input', { type: 'range', min, max, step, value });
  let last = 0;
  input.addEventListener('input', () => {
    const v = Number(input.value);
    val.textContent = fmt(v);
    onInput(v);
    const now = performance.now();
    if (now - last > 90) {
      last = now;
      sliderTick();
    }
  });
  return h('div', { class: 'ctrl' }, h('span', { class: 'lbl' }, label), input, val);
}

/** Grupo de blocos em que só um fica ligado. */
function choice(cols, items, current, onPick, opts = {}) {
  const grid = h('div', { class: `grid c${cols}` });
  for (const it of items) {
    const b = blk({ icon: it.icon, label: it.label, swatch: it.swatch, on: it.id === current, cls: opts.tall ? 'tall' : '', size: opts.tall ? 22 : 18 });
    b.addEventListener('click', () => {
      [...grid.children].forEach((c) => c.classList.toggle('on', c === b));
      onPick(it.id);
    });
    grid.append(b);
  }
  return grid;
}

const fmtM = (v) => `${v.toFixed(1).replace('.', ',')} m`;

// ---------------------------------------------------------------------------
export function cutPanel(ctx) {
  const mode = ctx.cutMode;
  const body = h('div', {},
    choice(4, [
      { id: 'nenhum', label: 'Nenhum', icon: 'cube' },
      { id: 'planta', label: 'Planta', icon: 'plan' },
      { id: 'secao', label: 'Seção', icon: 'section' },
      { id: 'fatia', label: 'Fatia', icon: 'pie' },
    ], mode, (m) => ctx.setCutMode(m), { tall: true }));
  const st = ctx.cuts.state;
  if (mode === 'planta') {
    body.append(
      h('p', {}, 'Corta na horizontal e mostra a planta de cada pavimento, 1,5 m acima do piso.'),
      choice(3, LEVELS.slice(0, 6).map((l, i) => ({ id: i, label: l.short })), ctx.planLevel, (i) => ctx.setPlanLevel(i)),
      ctrl('Altura', { min: -12, max: 46, step: 0.5, value: st.h.y, fmt: fmtM, onInput: (v) => ctx.cuts.set('h', { on: true, y: v }) }));
  } else if (mode === 'secao') {
    const limit = st.v.axis === 'ns' ? HALF_X : HALF_Z;
    body.append(
      h('p', {}, 'Um plano vertical atravessa a arena e mostra o perfil das arquibancadas, lajes, subsolo e gramado.'),
      choice(2, [{ id: 'lo', label: 'Leste–Oeste' }, { id: 'ns', label: 'Norte–Sul' }], st.v.axis, (axis) => {
        ctx.cuts.set('v', { on: true, axis, pos: 0 });
        ctx.refreshPanel();
      }),
      ctrl('Posição', { min: -limit + 2, max: limit - 2, step: 0.5, value: st.v.pos, fmt: (v) => `${Math.round(v)} m`, onInput: (v) => ctx.cuts.set('v', { on: true, pos: v }) }),
      h('div', { class: 'grid c1' }, blk({ icon: 'reset', label: 'Inverter o lado', onClick: () => ctx.flipSection() })));
  } else if (mode === 'fatia') {
    body.append(
      h('p', {}, 'Tira uma fatia da arena para ver o interior. Cada cor é um sistema.'),
      choice(4, [{ id: 45, label: '1/8' }, { id: 90, label: '1/4' }, { id: 180, label: '1/2' }, { id: 270, label: '3/4' }], Math.round(st.w.open), (v) => ctx.animateWedge(v)),
      ctrl('Girar', { min: 0, max: 360, step: 1, value: st.w.rot, fmt: (v) => `${v}°`, onInput: (v) => ctx.cuts.set('w', { on: true, rot: v }) }));
  } else {
    body.append(h('p', {}, 'Escolha um corte para ver o estádio por dentro, em camadas como um bolo.'));
  }
  return { title: 'Cortar', icon: 'cut', body };
}

export function explodePanel(ctx) {
  const ex = ctx.explode;
  const pct = (v) => `${Math.round(v)}%`;
  const body = h('div', {},
    h('p', {}, 'Separe os 7 pavimentos como camadas de bolo, ou divida a arena em 4 pedaços.'),
    h('div', { class: 'grid c2' },
      blk({ icon: 'levels', label: 'Níveis', on: ex.levels > 0.01, onClick: () => ctx.toggleExplode('niveis') }),
      blk({ icon: 'quads', label: 'Pedaços', on: ex.quads > 0.01, onClick: () => ctx.toggleExplode('pedacos') })),
    ctrl('Níveis', { min: 0, max: 100, value: Math.round(ex.levels * 100), fmt: pct, onInput: (v) => ctx.setExplode('niveis', v / 100, false) }),
    ctrl('Pedaços', { min: 0, max: 100, value: Math.round(ex.quads * 100), fmt: pct, onInput: (v) => ctx.setExplode('pedacos', v / 100, false) }),
    h('div', { class: 'grid c1' }, blk({ icon: 'cube', label: 'Montar tudo', onClick: () => ctx.assemble() })));
  return { title: 'Desmontar', icon: 'explode', body };
}

export function layersPanel(ctx) {
  const grid = h('div', { class: 'grid c3' });
  CATEGORIES.forEach((c, i) => {
    const off = ((ctx.layers.hidden >> i) & 1) === 1;
    const b = blk({ swatch: c.color, label: SHORT[c.id] || c.name, cls: off ? 'off' : '' });
    b.addEventListener('click', () => b.classList.toggle('off', ctx.toggleCategory(i)));
    grid.append(b);
  });
  const body = h('div', {},
    h('p', {}, 'Cada cor é um sistema do estádio. Toque para esconder ou mostrar.'),
    grid,
    h('div', { class: 'grid c3' },
      blk({ icon: 'xray', label: 'Raio-X', on: ctx.ghost, onClick: (e) => e.currentTarget.classList.toggle('on', ctx.toggleXray()) }),
      blk({ icon: 'eye', label: 'Tudo', onClick: () => { ctx.setHidden(0); ctx.refreshPanel(); } }),
      blk({ icon: 'cube', label: 'Só estrutura', onClick: () => { ctx.isolate(['estrutura']); ctx.refreshPanel(); } })));
  return { title: 'Camadas', icon: 'layers', body };
}

export function showPanel(ctx) {
  const show = ctx.show;
  const fx = !!show?.fxOn;
  const body = h('div', {},
    h('p', {}, 'Torcida nas arquibancadas, mini partida e telões animados. A noite de jogo acende refletores e fogos.'),
    h('div', { class: 'ctrl-row' }, h('span', { class: 'lbl' }, 'Luz')),
    choice(2, [{ id: 'dia', label: 'Dia', icon: 'sun' }, { id: 'noite', label: 'Noite', icon: 'moon' }], show?.nightOn ? 'noite' : 'dia', (id) => ctx.setNight(id === 'noite')),
    h('div', { class: 'ctrl-row' }, h('span', { class: 'lbl' }, 'Efeitos')),
    choice(2, [{ id: 'on', label: 'Ligados', icon: 'show' }, { id: 'off', label: 'Desligados', icon: 'close' }], fx ? 'on' : 'off', (id) => ctx.setFx(id === 'on')),
    h('div', { class: 'grid c3' },
      blk({ icon: 'goal', label: 'Gol!', disabled: !fx, onClick: () => show.goal(0, true) }),
      blk({ icon: 'wave', label: 'Ola', disabled: !fx, onClick: () => show.wave() }),
      blk({ icon: 'fireworks', label: 'Fogos', disabled: !fx, onClick: () => ctx.fireworks() })));
  return { title: 'Efeitos', icon: 'show', body };
}

export function infoPanel(info, ctx) {
  const body = h('div', {},
    h('div', { class: 'chips' }, info.category ? h('span', {}, info.category) : null, ...info.meta.map((m) => h('span', {}, m))),
    h('p', {}, info.text),
    info.seat ? h('div', { class: 'grid c1' }, blk({ icon: 'route', label: 'Rota até aqui', cls: 'gold big', onClick: () => ctx.routeToSeat(info.seat) })) : null);
  return { title: info.title, swatch: info.color, body };
}

export function ticketPanel(ctx) {
  const t = ctx.ticket;
  const sel = (opts) => h('select', {}, ...opts);
  const selTier = sel(TIERS.map((tr, i) => h('option', { value: i, selected: i === t.tier }, tr.name)));
  const selSector = sel(SECTOR_ORDER.map((id) => {
    const i = SECTORS.findIndex((s) => s.id === id);
    return h('option', { value: i, selected: i === t.sector }, `${id} · ${SECTORS[i].name}`);
  }));
  const selRow = h('select');
  const selSeat = h('select');
  const selGate = sel([h('option', { value: 'auto' }, 'Automático (mais rápido)'), ...GATES.map((g) => h('option', { value: g.n, selected: String(g.n) === String(t.gate) }, g.name))]);
  let accessible = t.accessible;
  const fillSeats = () => {
    const max = ctx.seatsIn(Number(selTier.value), Number(selSector.value), Number(selRow.value));
    selSeat.replaceChildren(...Array.from({ length: max }, (_, n) => h('option', { value: n + 1, selected: n + 1 === t.num }, `Assento ${n + 1}`)));
  };
  const fillRows = () => {
    const rows = ctx.rowsFor(Number(selTier.value), Number(selSector.value));
    selRow.replaceChildren(...rows.map((r) => h('option', { value: r.row, selected: r.row === t.row }, `Fila ${r.row + 1}`)));
    if (!rows.some((r) => r.row === t.row) && rows.length) selRow.value = rows[0].row;
    fillSeats();
  };
  selTier.addEventListener('change', fillRows);
  selSector.addEventListener('change', fillRows);
  selRow.addEventListener('change', fillSeats);
  fillRows();
  const field = (label, el) => h('div', { class: 'field' }, h('span', { class: 'lbl' }, label), el);
  const read = () => ({
    tier: Number(selTier.value), sector: Number(selSector.value), row: Number(selRow.value), num: Number(selSeat.value),
    gate: selGate.value, accessible,
  });
  const body = h('div', {},
    h('div', { class: 'grid c2' }, field('Anel', selTier), field('Setor', selSector), field('Fila', selRow), field('Assento', selSeat)),
    h('div', { class: 'grid c1' }, field('Portão', selGate)),
    h('div', { class: 'grid c2' },
      blk({ icon: 'accessible', label: 'Sem escadas', on: accessible, onClick: (e) => { accessible = !accessible; e.currentTarget.classList.toggle('on', accessible); } }),
      blk({ icon: 'dice', label: 'Sortear', onClick: () => ctx.randomTicket() })),
    h('div', { class: 'grid c1' }, blk({ icon: 'route', label: 'Traçar rota', cls: 'gold big', onClick: () => ctx.traceRoute(read()) })));
  return { title: 'Seu ingresso', icon: 'ticket', body };
}

/**
 * GPS compacto: uma instrução por vez num carrossel com setas (e deslizar o dedo).
 * Devolve setStep(k) para o boneco atualizar a etapa sem redesenhar o painel.
 */
export function routePanel(route, ctx) {
  const steps = route.steps;
  const min = Math.max(1, Math.round(route.time / 60));
  const count = h('span', { class: 'gps-count' });
  const text = h('div', { class: 'gps-text' });
  const sub = h('div', { class: 'gps-sub' });
  const card = h('div', { class: 'gps-card' }, count, text, sub);
  const prev = blk({ icon: 'left', title: 'Etapa anterior', size: 22, onClick: () => ctx.gotoStep(current - 1) });
  const next = blk({ icon: 'right', title: 'Próxima etapa', size: 22, onClick: () => ctx.gotoStep(current + 1) });
  const playBtn = blk({ icon: 'pause', label: 'Pausar', size: 18 });
  let current = 0;
  const setStep = (k) => {
    current = Math.max(0, Math.min(steps.length - 1, k));
    const s = steps[current];
    count.textContent = `${current + 1}/${steps.length}`;
    text.textContent = s.text;
    sub.textContent = s.sub || '';
    prev.disabled = current === 0;
    next.disabled = current === steps.length - 1;
  };
  const setPlaying = (playing) => {
    playBtn.replaceChildren(...blk({ icon: playing ? 'pause' : 'play', label: playing ? 'Pausar' : 'Andar', size: 18 }).childNodes);
  };
  playBtn.addEventListener('click', () => setPlaying(ctx.togglePlay()));
  // deslizar o dedo no cartão troca de etapa
  let sx = null;
  card.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  card.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 36) ctx.gotoStep(current + (dx < 0 ? 1 : -1));
  });
  setStep(Math.max(0, ctx.stepIdx));
  setPlaying(ctx.playing);
  const body = h('div', {},
    h('div', { class: 'gps-sum' }, `${route.sector.id} · fila ${route.seat.row + 1} · assento ${route.seat.num}`, h('b', {}, `${Math.round(route.distance)} m · ${min} min · P${route.gate ? route.gate.n : '?'}`)),
    h('div', { class: 'gps' }, prev, card, next),
    h('div', { class: 'grid c4' },
      playBtn,
      blk({ icon: 'walk', label: 'Seguir', size: 18, on: ctx.following, disabled: !ctx.canFollow, onClick: (e) => e.currentTarget.classList.toggle('on', ctx.toggleFollow()) }),
      blk({ icon: 'ticket', label: 'Outro', size: 18, onClick: () => ctx.openTicket() }),
      blk({ icon: 'close', label: 'Limpar', size: 18, onClick: () => ctx.clearRoute() })));
  return { title: 'Rota até o seu lugar', icon: 'route', body, setStep, setPlaying };
}
