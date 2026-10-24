// Conteúdo do painel inferior para cada ferramenta.
import { h, icon } from './hud.js';
import { LEVELS, TIERS, SECTORS, SECTOR_ORDER, GATES, HALF_X, HALF_Z } from '../stadium/spec.js';
import { CATEGORIES } from '../stadium/palette.js';

const title = (iconName, text, color) =>
  h('h3', {}, color ? h('span', { class: 'swatch', style: { background: color } }) : icon(iconName), text);

function slider({ min, max, step = 1, value, onInput, label, fmt = (v) => v }) {
  const out = h('span', { class: 'chip' }, fmt(value));
  const input = h('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => {
    out.textContent = fmt(Number(input.value));
    onInput(Number(input.value));
  });
  return h('div', { class: 'row' }, h('span', { class: 'label' }, label), input, out);
}

function pills(items, current, onPick) {
  const row = h('div', { class: 'row' });
  for (const it of items) {
    const b = h('button', { class: `pill${it.id === current ? ' on' : ''}` },
      it.color ? h('span', { class: 'sw', style: { background: it.color } }) : null, it.label);
    b.addEventListener('click', () => {
      [...row.children].forEach((c) => c.classList.toggle('on', c === b));
      onPick(it.id);
    });
    row.append(b);
  }
  return row;
}

export function planPanel(ctx) {
  const st = ctx.cuts.state.h;
  const levelItems = LEVELS.slice(0, 6).map((l, i) => ({ id: i, label: l.short }));
  return h('div', {},
    title('plan', 'Planta baixa (corte horizontal)'),
    h('p', {}, 'Corta o estádio na altura escolhida e mostra a planta de cada pavimento, como um arquiteto desenharia, 1,5 m acima do piso.'),
    pills(levelItems, -1, (i) => ctx.setPlanLevel(i)),
    slider({ min: -12, max: 46, step: 0.5, value: st.y, label: 'Altura', fmt: (v) => `${v.toFixed(1)} m`, onInput: (v) => ctx.cuts.set('h', { on: true, y: v }) }),
    h('div', { class: 'row' }, h('button', { class: 'pill', onClick: () => ctx.toggleTool('planta', false) }, 'Desligar corte')));
}

export function sectionPanel(ctx) {
  const st = ctx.cuts.state.v;
  const limit = st.axis === 'ns' ? HALF_X : HALF_Z;
  return h('div', {},
    title('section', 'Seção (corte vertical)'),
    h('p', {}, 'Um plano vertical atravessa a arena: veja o perfil das arquibancadas, as lajes dos concourses, o subsolo e as camadas do gramado.'),
    pills([{ id: 'lo', label: 'Leste–Oeste' }, { id: 'ns', label: 'Norte–Sul' }], st.axis, (axis) => {
      ctx.cuts.set('v', { on: true, axis, pos: 0 });
      ctx.refreshPanel();
    }),
    slider({ min: -limit + 2, max: limit - 2, step: 0.5, value: st.pos, label: 'Posição', fmt: (v) => `${v.toFixed(0)} m`, onInput: (v) => ctx.cuts.set('v', { on: true, pos: v }) }),
    h('div', { class: 'row' },
      h('button', { class: 'pill', onClick: () => { ctx.cuts.set('v', { side: -st.side }); ctx.synth.whoosh(0.4); } }, 'Inverter lado'),
      h('button', { class: 'pill', onClick: () => ctx.toggleTool('secao', false) }, 'Desligar corte')));
}

export function slicePanel(ctx) {
  const st = ctx.cuts.state.w;
  return h('div', {},
    title('pie', 'Fatia de torta'),
    h('p', {}, 'Tira uma fatia da arena para ver o interior em 3D. Cada cor é um sistema: concreto, circulação, assentos, serviços, solo…'),
    slider({ min: 10, max: 300, step: 1, value: st.open, label: 'Abertura', fmt: (v) => `${v}°`, onInput: (v) => ctx.cuts.set('w', { on: true, open: v }) }),
    slider({ min: 0, max: 360, step: 1, value: st.rot, label: 'Girar', fmt: (v) => `${v}°`, onInput: (v) => ctx.cuts.set('w', { on: true, rot: v }) }),
    pills([{ id: 45, label: '⅛' }, { id: 90, label: '¼' }, { id: 180, label: 'Metade' }, { id: 270, label: '¾' }], st.open, (v) => ctx.animateWedge(v)),
    h('div', { class: 'row' }, h('button', { class: 'pill', onClick: () => ctx.toggleTool('fatia', false) }, 'Desligar fatia')));
}

export function explodePanel(ctx, kind) {
  const isLevels = kind === 'niveis';
  const value = isLevels ? ctx.explode.levels : ctx.explode.quads;
  return h('div', {},
    title(isLevels ? 'levels' : 'quads', isLevels ? 'Desmontar por níveis' : 'Desmontar em pedaços'),
    h('p', {}, isLevels
      ? 'Os pavimentos se separam como camadas de um bolo: fundações, nível do campo, térreo, nível clube, concourse superior, topo e cobertura.'
      : 'A arena se divide em quatro pedaços de torta (Noroeste, Nordeste, Sudoeste e Sudeste).'),
    slider({ min: 0, max: 100, step: 1, value: Math.round(value * 100), label: 'Separação', fmt: (v) => `${v}%`, onInput: (v) => ctx.setExplode(kind, v / 100, false) }),
    isLevels ? h('div', { class: 'meta' }, ...LEVELS.map((l) => h('span', {}, l.name))) : null,
    h('div', { class: 'row' },
      h('button', { class: 'pill on', onClick: () => ctx.setExplode(kind, 1, true) }, 'Desmontar'),
      h('button', { class: 'pill', onClick: () => ctx.toggleTool(kind, false) }, 'Montar')));
}

export function layersPanel(ctx) {
  const grid = h('div', { class: 'layers' });
  CATEGORIES.forEach((c, i) => {
    const off = ((ctx.layers.hidden >> i) & 1) === 1;
    const b = h('button', { class: `layer${off ? ' off' : ''}` }, h('span', { class: 'sw', style: { background: c.color } }), c.name);
    b.addEventListener('click', () => {
      const nowOff = ctx.toggleCategory(i);
      b.classList.toggle('off', nowOff);
    });
    grid.append(b);
  });
  return h('div', {},
    title('layers', 'Sistemas do estádio'),
    h('p', {}, 'Cada cor é um sistema. Toque para esconder ou mostrar e ver o que existe por trás.'),
    grid,
    h('div', { class: 'row' },
      h('button', { class: 'pill', onClick: () => { ctx.setHidden(0); ctx.refreshPanel(); } }, 'Mostrar tudo'),
      h('button', { class: 'pill', onClick: () => { ctx.isolate(['estrutura']); ctx.refreshPanel(); } }, 'Só estrutura'),
      h('button', { class: 'pill', onClick: () => { ctx.isolate(['circulacao', 'vertical']); ctx.refreshPanel(); } }, 'Só circulação')));
}

export function showPanel(ctx) {
  return h('div', {},
    title('show', 'Noite de jogo'),
    h('p', {}, 'Refletores, telões e fachada de LED acendem; a torcida lota as arquibancadas e começa a partida.'),
    h('div', { class: 'row' },
      h('button', { class: 'pill on', onClick: () => ctx.show.goal(0) }, icon('goal'), ' Gol!'),
      h('button', { class: 'pill', onClick: () => ctx.show.wave() }, icon('wave'), ' Ola'),
      h('button', { class: 'pill', onClick: () => { for (let k = 0; k < 4; k++) setTimeout(() => ctx.show.launchFirework(), k * 250); } }, icon('fireworks'), ' Fogos'),
      h('button', { class: 'pill', onClick: () => ctx.toggleTool('show', false) }, 'Desligar')));
}

export function infoPanel(info, ctx) {
  return h('div', {},
    title(null, info.title, info.color),
    h('div', { class: 'meta' }, info.category ? h('span', {}, info.category) : null, ...info.meta.map((m) => h('span', {}, m))),
    h('p', {}, info.text),
    info.seat ? h('div', { class: 'row' }, h('button', { class: 'btn primary', style: { flex: 1 }, onClick: () => ctx.routeToSeat(info.seat) }, icon('route'), ' Rota até aqui')) : null);
}

export function ticketPanel(ctx) {
  const t = ctx.ticket;
  const selTier = h('select', {}, ...TIERS.map((tr, i) => h('option', { value: i, selected: i === t.tier }, tr.name)));
  const selSector = h('select', {}, ...SECTOR_ORDER.map((id) => {
    const i = SECTORS.findIndex((s) => s.id === id);
    return h('option', { value: i, selected: i === t.sector }, `${id} · ${SECTORS[i].name}`);
  }));
  const selRow = h('select');
  const selSeat = h('select');
  const selGate = h('select', {}, h('option', { value: 'auto' }, 'Automático (mais rápido)'), ...GATES.map((g) => h('option', { value: g.n, selected: String(g.n) === String(t.gate) }, g.name)));
  const acc = h('input', { type: 'checkbox', checked: t.accessible });
  const fillRows = () => {
    const rows = ctx.rowsFor(Number(selTier.value), Number(selSector.value));
    selRow.replaceChildren(...rows.map((r) => h('option', { value: r.row, selected: r.row === t.row }, `Fila ${r.row + 1}`)));
    if (!rows.some((r) => r.row === t.row) && rows.length) selRow.value = rows[0].row;
    fillSeats();
  };
  const fillSeats = () => {
    const max = ctx.seatsIn(Number(selTier.value), Number(selSector.value), Number(selRow.value));
    selSeat.replaceChildren(...Array.from({ length: max }, (_, n) => h('option', { value: n + 1, selected: n + 1 === t.num }, `Assento ${n + 1}`)));
  };
  selTier.addEventListener('change', fillRows);
  selSector.addEventListener('change', fillRows);
  selRow.addEventListener('change', fillSeats);
  fillRows();
  const read = () => ({
    tier: Number(selTier.value), sector: Number(selSector.value), row: Number(selRow.value), num: Number(selSeat.value),
    gate: selGate.value, accessible: acc.checked,
  });
  return h('div', {},
    title('ticket', 'Seu ingresso'),
    h('p', {}, 'Escolha onde vai sentar e veja o caminho completo em 3D: portão, catraca, concourse, escadas ou elevador, vomitório, corredor e fila.'),
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'Anel'), selTier),
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'Setor'), selSector),
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'Fila'), selRow, selSeat),
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'Portão'), selGate),
    h('label', { class: 'switch' }, acc, 'Rota acessível (sem escadas)'),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', style: { flex: 1 }, onClick: () => ctx.traceRoute(read()) }, icon('route'), ' Traçar rota'),
      h('button', { class: 'btn', onClick: () => ctx.randomTicket() }, '🎲')));
}

export function routePanel(route, ctx) {
  const list = h('ol', { class: 'steps' }, ...route.steps.map((s) => h('li', {}, s.text, s.sub ? h('small', {}, s.sub) : null)));
  const min = Math.max(1, Math.round(route.time / 60));
  return h('div', {},
    title('route', `Rota até o assento ${route.seat.num}`),
    h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('b', {}, `${Math.round(route.distance)} m`), h('span', {}, 'distância')),
      h('div', { class: 'kpi' }, h('b', {}, `~${min} min`), h('span', {}, 'caminhando')),
      h('div', { class: 'kpi' }, h('b', {}, route.gate ? `P${route.gate.n}` : '—'), h('span', {}, 'portão'))),
    list,
    h('div', { class: 'row' },
      h('button', { class: 'pill on', onClick: () => ctx.replayRoute() }, icon('play'), ' Repetir'),
      ctx.canFollow ? h('button', { class: `pill${ctx.following ? ' on' : ''}`, onClick: (e) => { ctx.toggleFollow(); e.currentTarget.classList.toggle('on', ctx.following); } }, icon('walk'), ' Seguir boneco') : null,
      h('button', { class: 'pill', onClick: () => ctx.openTicket() }, icon('ticket'), ' Outro assento'),
      h('button', { class: 'pill', onClick: () => ctx.toggleTool('rota', false) }, 'Limpar')));
}

export function highlightStep(sheetBody, idx) {
  const items = sheetBody.querySelectorAll('.steps li');
  items.forEach((li, i) => li.classList.toggle('now', i === idx));
  const el = items[idx];
  if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
