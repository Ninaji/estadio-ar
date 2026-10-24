// HUD em blocos: barra fixa em cima (marca, AR, som, ajuda, Reset), dock fixo embaixo
// com 5 ferramentas e um único painel acima do dock. Nada muda de tamanho.
import { pixelIcon } from './pixelIcons.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Botão-bloco. opts: icon, label, swatch (cor), on, cls, title, onClick, size (ícone). */
export function blk({ icon, label, swatch, on, cls = '', title, onClick, size = 20, disabled } = {}) {
  const b = h('button', { class: `blk${on ? ' on' : ''}${cls ? ` ${cls}` : ''}`, title: title || label, disabled, onClick });
  if (swatch) b.append(h('i', { class: 'sw', style: { background: swatch } }));
  if (icon) b.append(pixelIcon(icon, size));
  if (label) b.append(h('span', {}, label));
  return b;
}

export const DOCK = [
  { id: 'cortar', label: 'Cortar', icon: 'cut' },
  { id: 'desmontar', label: 'Desmontar', icon: 'explode' },
  { id: 'camadas', label: 'Camadas', icon: 'layers' },
  { id: 'rota', label: 'Rota', icon: 'route' },
  { id: 'show', label: 'Show', icon: 'show' },
];

export class Hud {
  constructor(root) {
    this.root = root;
    this.onTool = () => {};
    this.onPanelClosed = null;
    this.panelKey = null;
    this.#buildIntro();
    this.#buildHud();
    this.#buildModal();
  }

  #buildIntro() {
    const colors = ['#2f6bff', '#a66bff', '#ff3d8b', '#ffd23f', '#3ccf4e', '#22d3ee'];
    const logo = h('div', { class: 'logo' }, ...Array.from({ length: 18 }, (_, i) =>
      h('span', { style: { background: colors[(i * 7) % colors.length], animationDelay: `${(i % 6) * 0.12}s`, opacity: i % 5 === 4 ? 0.35 : 1 } })));
    this.progressBar = h('i');
    this.progressLabel = h('div', { class: 'progress-label' }, 'Preparando…');
    this.btnAR = blk({ icon: 'ar', label: 'Ver em AR', cls: 'gold', size: 24, disabled: true });
    this.btn3D = blk({ icon: 'cube', label: 'Explorar em 3D', size: 24, disabled: true });
    this.arHint = h('div', { class: 'hint' }, 'Detectando recursos do aparelho…');
    this.intro = h('section', { class: 'intro' },
      logo,
      h('h1', {}, 'ARENA AURORA'),
      h('p', { class: 'sub' }, 'Maquete voxel de um estádio completo. Coloque no chão, corte em camadas, desmonte e ache o caminho até o seu assento.'),
      h('div', { class: 'progress' }, this.progressBar),
      this.progressLabel,
      h('div', { class: 'actions' }, this.btnAR, this.btn3D),
      this.arHint,
      h('button', { class: 'link', onClick: () => this.openModal() }, 'Como usar · créditos'));
    this.root.append(this.intro);
  }

  #buildHud() {
    this.modeChip = h('span', { class: 'mode-chip' }, '3D');
    this.btnARTop = blk({ icon: 'ar', title: 'Ver em AR', cls: 'gold' });
    this.btnARTop.style.display = 'none';
    this.btnExit = blk({ icon: 'exit', title: 'Sair do AR' });
    this.btnExit.style.display = 'none';
    this.btnSound = blk({ icon: 'sound', title: 'Som' });
    this.btnHelp = blk({ icon: 'help', title: 'Ajuda', onClick: () => this.openModal() });
    this.btnReset = blk({ icon: 'reset', label: 'Reset', cls: 'wide', title: 'Voltar tudo ao início', size: 18 });
    const topbar = h('header', { class: 'topbar' },
      h('div', { class: 'brand' }, h('b', {}, 'AURORA'), this.modeChip),
      h('div', { class: 'spacer' }),
      this.btnARTop, this.btnExit, this.btnSound, this.btnHelp, this.btnReset);

    this.dockButtons = {};
    const dock = h('nav', { class: 'dock' });
    for (const t of DOCK) {
      const b = blk({ icon: t.icon, label: t.label, size: 28, onClick: () => this.onTool(t.id) });
      b.append(h('i', { class: 'dot' }));
      this.dockButtons[t.id] = b;
      dock.append(b);
    }
    this.panelIcon = h('span');
    this.panelTitle = h('h3');
    this.panelBody = h('div');
    this.panel = h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, this.panelIcon, this.panelTitle, blk({ icon: 'close', title: 'Fechar', size: 16, onClick: () => this.closePanel(true) })),
      this.panelBody);
    this.toastEl = h('div', { class: 'toast' });
    this.arTip = h('div', { class: 'ar-tip' }, 'Mova o celular devagar apontando para o chão…');
    this.btnPlace = blk({ icon: 'place', label: 'Posicionar estádio', cls: 'gold big', size: 22, disabled: true });
    this.scaleChips = h('div', { class: 'grid c3' });
    this.arPanel = h('div', { class: 'ar-panel' }, this.arTip, this.scaleChips, this.btnPlace);
    this.attribution = h('a', {
      class: 'attribution', href: 'https://github.com/8thwall/engine/blob/main/LICENSE', target: '_blank', rel: 'noopener',
    }, 'AR: 8th Wall Engine © Niantic Spatial — XR Engine License');
    this.fpsEl = h('div', { class: 'fps' });
    this.hud = h('div', { class: 'hud' }, topbar, this.panel, dock, this.toastEl, this.arPanel, this.attribution, this.fpsEl);
    this.root.append(this.hud);
  }

  #buildModal() {
    this.modal = h('div', { class: 'modal', onClick: (e) => { if (e.target === this.modal) this.closeModal(); } },
      h('div', { class: 'card' },
        h('h2', {}, 'Como usar'),
        h('ul', {},
          h('li', {}, 'AR: aponte para o chão até aparecer o anel, escolha a escala e toque em "Posicionar estádio".'),
          h('li', {}, '3D: um dedo gira, pinça dá zoom, dois dedos movem.'),
          h('li', {}, 'Toque em qualquer parte do estádio para saber o que é.'),
          h('li', {}, 'Cortar: planta (horizontal), seção (vertical) ou fatia de torta.'),
          h('li', {}, 'Desmontar: separa os níveis ou os 4 pedaços.'),
          h('li', {}, 'Camadas: liga e desliga cada sistema; Raio-X deixa a estrutura transparente.'),
          h('li', {}, 'Rota: escolha o assento e veja o caminho desde o portão.'),
          h('li', {}, 'Reset (no alto) volta tudo ao início.')),
        h('h2', {}, 'Créditos'),
        h('p', {}, 'Estádio fictício gerado em voxels de 0,5 m com three.js. Sons sintetizados com Web Audio. Fonte Pixelify Sans (OFL).'),
        h('p', {}, 'No iPhone e em Android sem ARCore, o rastreamento de chão usa o 8th Wall Engine, © Niantic Spatial, Inc., sob a ',
          h('a', { href: 'https://github.com/8thwall/engine/blob/main/LICENSE', target: '_blank', rel: 'noopener' }, 'XR Engine License Agreement'),
          ', fornecido "como está", sem garantias.'),
        blk({ label: 'Entendi', cls: 'gold', onClick: () => this.closeModal() })));
    this.root.append(this.modal);
  }

  setProgress(p, label) {
    this.progressBar.style.width = `${Math.round(p * 100)}%`;
    if (label) this.progressLabel.textContent = label;
  }

  hideIntro() {
    this.intro.classList.add('hide');
    this.hud.classList.add('show');
    setTimeout(() => (this.intro.style.display = 'none'), 600);
  }

  /** sel = ferramenta com painel aberto; live = ferramentas com efeito ativo. */
  setDock(sel, live) {
    for (const [id, b] of Object.entries(this.dockButtons)) {
      b.classList.toggle('sel', id === sel);
      b.classList.toggle('live', live.has(id));
    }
  }

  openPanel({ key, title, icon, swatch, body }) {
    this.panelKey = key;
    this.panelIcon.replaceChildren(swatch ? h('i', { class: 'swatch', style: { background: swatch } }) : pixelIcon(icon || 'help', 24));
    this.panelTitle.textContent = title;
    this.panelBody.replaceChildren(body);
    this.panel.classList.add('open');
    this.panel.scrollTop = 0;
  }

  /** Troca só o corpo, mantendo a rolagem (para atualizar valores sem "pular"). */
  updatePanelBody(body) {
    const top = this.panel.scrollTop;
    this.panelBody.replaceChildren(body);
    this.panel.scrollTop = top;
  }

  closePanel(user = false) {
    const key = this.panelKey;
    this.panelKey = null;
    this.panel.classList.remove('open');
    if (user && this.onPanelClosed) this.onPanelClosed(key);
  }

  toast(msg, ms = 2600) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  openModal() {
    this.modal.classList.add('open');
  }

  closeModal() {
    this.modal.classList.remove('open');
  }

  setSoundIcon(on) {
    this.btnSound.replaceChildren(pixelIcon(on ? 'sound' : 'mute', 20));
  }
}
