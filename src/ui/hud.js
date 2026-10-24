// HUD: tela inicial, barra superior, ferramentas laterais, painel inferior, avisos e modais.
import { ICONS } from './icons.js';

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

const parser = new DOMParser();
/** Ícone SVG a partir das constantes de icons.js (conteúdo fixo do app). */
export function icon(name) {
  const doc = parser.parseFromString(ICONS[name], 'image/svg+xml');
  return document.importNode(doc.documentElement, true);
}

export const TOOLS = [
  { id: 'planta', label: 'Planta', icon: 'plan', title: 'Corte horizontal (planta baixa)' },
  { id: 'secao', label: 'Seção', icon: 'section', title: 'Corte vertical' },
  { id: 'fatia', label: 'Fatia', icon: 'pie', title: 'Fatia de torta' },
  { id: 'niveis', label: 'Níveis', icon: 'levels', title: 'Desmontar por níveis' },
  { id: 'pedacos', label: 'Pedaços', icon: 'quads', title: 'Desmontar em pedaços' },
  { id: 'camadas', label: 'Camadas', icon: 'layers', title: 'Sistemas e legenda' },
  { id: 'raiox', label: 'Raio-X', icon: 'xray', title: 'Estrutura transparente' },
  { id: 'rota', label: 'Rota', icon: 'route', title: 'Rota até o assento' },
  { id: 'show', label: 'Show', icon: 'show', title: 'Modo show noturno' },
  { id: 'reset', label: 'Resetar', icon: 'reset', title: 'Voltar ao início' },
];

export class Hud {
  constructor(root) {
    this.root = root;
    this.onTool = () => {};
    this.onSheetClosed = null;
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
    this.btnAR = h('button', { class: 'btn primary', disabled: true }, icon('ar'), h('span', {}, 'Ver em AR'));
    this.btn3D = h('button', { class: 'btn', disabled: true }, icon('cube'), h('span', {}, 'Explorar em 3D'));
    this.arHint = h('div', { class: 'hint' }, 'Detectando recursos do aparelho…');
    this.intro = h('section', { class: 'intro' },
      logo,
      h('h1', {}, 'ARENA AURORA'),
      h('p', { class: 'sub' }, 'Uma maquete voxel de um estádio completo. Coloque no seu chão, corte como uma fatia de torta, desmonte os níveis e encontre o caminho até o seu assento.'),
      h('div', { class: 'progress' }, this.progressBar),
      this.progressLabel,
      h('div', { class: 'actions' }, this.btnAR, this.btn3D),
      this.arHint,
      h('button', { class: 'credits-link', onClick: () => this.openModal() }, 'Como usar · créditos'));
    this.root.append(this.intro);
  }

  #buildHud() {
    this.modeChip = h('span', { class: 'chip' }, '3D');
    this.btnSound = h('button', { class: 'icon-btn', title: 'Som' }, icon('sound'));
    this.btnHelp = h('button', { class: 'icon-btn', title: 'Ajuda', onClick: () => this.openModal() }, icon('help'));
    this.btnExit = h('button', { class: 'icon-btn', title: 'Sair do AR', style: { display: 'none' } }, icon('exit'));
    this.btnARTop = h('button', { class: 'icon-btn on', title: 'Ver em AR', style: { display: 'none' } }, icon('ar'));
    const topbar = h('div', { class: 'topbar' },
      h('div', { class: 'brand' }, h('b', {}, 'ARENA AURORA'), this.modeChip),
      h('div', { class: 'spacer' }), this.btnARTop, this.btnSound, this.btnHelp, this.btnExit);

    this.toolButtons = {};
    const toolbar = h('nav', { class: 'toolbar' });
    for (const t of TOOLS) {
      const b = h('button', { class: 'tool', title: t.title, onClick: () => this.onTool(t.id) }, icon(t.icon), h('span', {}, t.label));
      this.toolButtons[t.id] = b;
      toolbar.append(b);
    }
    this.sheetBody = h('div');
    this.sheet = h('section', { class: 'sheet' },
      h('button', { class: 'close', title: 'Fechar', onClick: () => this.closeSheet(true) }, icon('close')), this.sheetBody);
    this.toastEl = h('div', { class: 'toast' });
    this.arTip = h('div', { class: 'ar-tip' }, 'Mova o celular devagar apontando para o chão…');
    this.btnPlace = h('button', { class: 'btn primary', disabled: true }, icon('place'), h('span', {}, 'Posicionar estádio'));
    this.scaleChips = h('div', { class: 'scale-chips' });
    this.arPanel = h('div', { class: 'ar-panel' }, this.arTip, this.scaleChips, this.btnPlace);
    this.attribution = h('a', {
      class: 'attribution', href: 'https://github.com/8thwall/engine/blob/main/LICENSE', target: '_blank', rel: 'noopener',
    }, 'Rastreamento AR: 8th Wall Engine © Niantic Spatial — XR Engine License');
    this.fpsEl = h('div', { class: 'fps' });
    this.hud = h('div', { class: 'hud' }, topbar, toolbar, this.sheet, this.toastEl, this.arPanel, this.attribution, this.fpsEl);
    this.root.append(this.hud);
  }

  #buildModal() {
    this.modal = h('div', { class: 'modal', onClick: (e) => { if (e.target === this.modal) this.closeModal(); } },
      h('div', { class: 'card' },
        h('h2', {}, 'Como usar'),
        h('ul', {},
          h('li', {}, 'AR: aponte para o chão até aparecer o anel, escolha a escala e toque em "Posicionar estádio".'),
          h('li', {}, '3D: arraste com um dedo para girar, pinça para zoom, dois dedos para mover.'),
          h('li', {}, 'Toque em qualquer parte do estádio para saber o que é e como funciona.'),
          h('li', {}, 'Planta, Seção e Fatia cortam a maquete e mostram as camadas internas, como um bolo.'),
          h('li', {}, 'Níveis e Pedaços desmontam a arena; Camadas liga e desliga cada sistema.'),
          h('li', {}, 'Rota: escolha setor, fila e assento e veja o caminho em 3D desde o portão.'),
          h('li', {}, 'Show: noite de jogo com refletores, telões, torcida, ola e fogos.')),
        h('h2', {}, 'Créditos'),
        h('p', {}, 'Arena Aurora é um estádio fictício gerado proceduralmente em voxels (0,5 m) com three.js. Sons sintetizados em tempo real com Web Audio.'),
        h('p', {}, 'No iPhone e em Android sem ARCore, o rastreamento de chão usa o 8th Wall Engine (binário distribuído), © Niantic Spatial, Inc., sob a ',
          h('a', { href: 'https://github.com/8thwall/engine/blob/main/LICENSE', target: '_blank', rel: 'noopener' }, 'XR Engine License Agreement'),
          ', fornecido "como está", sem garantias.'),
        h('button', { class: 'btn primary', onClick: () => this.closeModal() }, 'Entendi')));
    this.root.append(this.modal);
  }

  setProgress(p, label) {
    this.progressBar.style.width = `${Math.round(p * 100)}%`;
    if (label) this.progressLabel.textContent = label;
  }

  hideIntro() {
    this.intro.classList.add('hide');
    this.hud.classList.add('show');
    setTimeout(() => (this.intro.style.display = 'none'), 700);
  }

  showIntro() {
    this.intro.style.display = '';
    requestAnimationFrame(() => this.intro.classList.remove('hide'));
    this.hud.classList.remove('show');
  }

  setActiveTools(ids) {
    for (const [id, b] of Object.entries(this.toolButtons)) b.classList.toggle('active', ids.includes(id));
  }

  flashTool(id) {
    const b = this.toolButtons[id];
    if (!b) return;
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  }

  openSheet(content, key = null) {
    this.sheetKey = key;
    this.sheetBody.replaceChildren(content);
    this.sheet.classList.add('open');
    this.sheet.scrollTop = 0;
  }

  closeSheet(user = false) {
    this.sheet.classList.remove('open');
    const key = this.sheetKey;
    this.sheetKey = null;
    if (user && this.onSheetClosed) this.onSheetClosed(key);
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
    this.btnSound.replaceChildren(icon(on ? 'sound' : 'mute'));
  }
}
