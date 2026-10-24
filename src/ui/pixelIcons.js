// Ícones em pixel art 16×16, desenhados uma vez num canvas e exportados como imagens estáticas.
// O alfa é binarizado para que, ampliados com image-rendering: pixelated, fiquem nítidos.

const C = {
  w: '#f4f7ff', g: '#b8c0d4', d: '#5a6378', k: '#141826',
  b: '#2f6bff', B: '#7fb2ff', p: '#a66bff', r: '#ff3d8b', R: '#ff2d4b',
  y: '#ffd23f', o: '#ff8a1f', G: '#3ccf4e', e: '#1f8f34', c: '#22d3ee',
  n: '#7a4f2e', l: '#efe3c8', s: '#f1c27d',
};

function painter(ctx) {
  const P = (x, y, w, h, c) => {
    ctx.fillStyle = C[c] || c;
    ctx.fillRect(x, y, w, h);
  };
  const dot = (x, y, c) => P(x, y, 1, 1, c);
  const line = (x0, y0, x1, y1, c) => {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      dot(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  const box = (x, y, w, h, fill, edge = 'k') => {
    P(x, y, w, h, edge);
    P(x + 1, y + 1, w - 2, h - 2, fill);
  };
  // bloco com brilho no topo e sombra embaixo (estilo voxel)
  const block = (x, y, w, h, fill, light, dark) => {
    box(x, y, w, h, fill);
    if (light) P(x + 1, y + 1, w - 2, 1, light);
    if (dark) P(x + 1, y + h - 2, w - 2, 1, dark);
  };
  return { P, dot, line, box, block };
}

const DRAW = {
  // Cortar: bolo em camadas com uma fatia saindo
  cut({ P, dot, box }) {
    box(1, 4, 10, 10, 'l');
    P(2, 5, 8, 2, 'w');
    P(2, 7, 8, 1, 'r');
    P(2, 8, 8, 2, 'l');
    P(2, 10, 8, 1, 'r');
    P(2, 11, 8, 2, 'n');
    dot(3, 5, 'r'); dot(6, 6, 'y'); dot(8, 5, 'c');
    box(11, 2, 4, 10, 'l');
    P(12, 3, 2, 2, 'w');
    P(12, 5, 2, 1, 'r');
    P(12, 6, 2, 2, 'l');
    P(12, 8, 2, 1, 'r');
    P(12, 9, 2, 2, 'n');
  },
  // Desmontar: três lajes separadas
  explode({ block, P }) {
    block(1, 1, 14, 4, 'B', 'w', 'b');
    block(2, 6, 12, 4, 'y', 'w', 'o');
    block(1, 11, 14, 4, 'G', '#8ff59c', 'e');
    P(7, 5, 2, 1, 'w');
    P(7, 10, 2, 1, 'w');
  },
  // Camadas: quatro amostras de cor
  layers({ block }) {
    block(1, 1, 7, 7, 'b', 'B', 'k');
    block(8, 1, 7, 7, 'G', '#8ff59c', 'e');
    block(1, 8, 7, 7, 'y', 'w', 'o');
    block(8, 8, 7, 7, 'p', '#d4b8ff', 'k');
  },
  // Rota: caminho de blocos até a bandeira
  route({ P, box }) {
    P(10, 1, 1, 9, 'w');
    box(11, 1, 5, 4, 'R');
    P(9, 9, 3, 1, 'g');
    const path = [[1, 13], [3, 12], [5, 11], [6, 9], [8, 8]];
    for (const [x, y] of path) P(x, y, 2, 2, 'y');
    box(0, 13, 3, 3, 'w');
  },
  // Show: explosão de fogos
  show({ P, dot }) {
    const rays = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    const cols = ['y', 'r', 'c', 'p', 'y', 'G', 'o', 'B'];
    rays.forEach(([dx, dy], i) => {
      for (let s = 2; s < 7; s++) if (s !== 4) dot(8 + dx * s, 8 + dy * s, cols[i]);
    });
    P(7, 7, 2, 2, 'w');
  },
  // AR: cubo dentro dos cantos da câmera
  ar({ P, block }) {
    for (const [x, y, w, h] of [[0, 0, 4, 1], [0, 0, 1, 4], [12, 0, 4, 1], [15, 0, 1, 4], [0, 15, 4, 1], [0, 12, 1, 4], [12, 15, 4, 1], [15, 12, 1, 4]]) P(x, y, w, h, 'w');
    block(4, 4, 8, 8, 'b', 'B', 'k');
    P(5, 5, 6, 2, 'B');
  },
  sound({ P }) {
    P(1, 6, 3, 4, 'w');
    P(4, 5, 1, 6, 'w');
    P(5, 4, 1, 8, 'w');
    P(6, 3, 1, 10, 'w');
    P(9, 6, 1, 4, 'g');
    P(11, 4, 1, 8, 'g');
    P(13, 2, 1, 12, 'g');
  },
  mute({ P, line }) {
    P(1, 6, 3, 4, 'w');
    P(4, 5, 1, 6, 'w');
    P(5, 4, 1, 8, 'w');
    P(6, 3, 1, 10, 'w');
    line(9, 5, 14, 10, 'R');
    line(14, 5, 9, 10, 'R');
  },
  help({ P }) {
    P(5, 2, 6, 2, 'w');
    P(3, 4, 2, 3, 'w');
    P(11, 4, 2, 3, 'w');
    P(9, 7, 2, 2, 'w');
    P(7, 9, 2, 2, 'w');
    P(7, 12, 2, 2, 'y');
  },
  reset({ P, dot }) {
    // seta circular feita de pixels
    const pts = [[6, 2], [7, 2], [8, 2], [9, 2], [10, 3], [11, 3], [12, 4], [12, 5], [13, 6], [13, 7], [13, 8], [13, 9], [12, 10], [12, 11], [11, 12], [10, 12], [9, 13], [8, 13], [7, 13], [6, 13], [5, 12], [4, 12], [3, 11], [3, 10], [2, 9], [2, 8], [2, 7]];
    for (const [x, y] of pts) P(x, y, 1, 1, 'w');
    for (const [x, y] of pts.slice(1)) dot(x, y + 1, 'g');
    P(1, 4, 4, 1, 'y');
    P(2, 3, 2, 1, 'y');
    P(3, 2, 1, 1, 'y');
    P(1, 5, 1, 2, 'y');
    P(4, 5, 1, 2, 'y');
  },
  close({ line }) {
    line(3, 3, 12, 12, 'w');
    line(4, 3, 13, 12, 'w');
    line(12, 3, 3, 12, 'w');
    line(13, 3, 4, 12, 'w');
  },
  exit({ P, box }) {
    box(1, 2, 8, 12, 'd', 'w');
    P(7, 7, 7, 2, 'y');
    P(11, 5, 1, 6, 'y');
    P(12, 6, 1, 4, 'y');
  },
  place({ P, box }) {
    box(4, 1, 8, 8, 'r');
    P(6, 3, 4, 4, 'w');
    P(7, 9, 2, 3, 'r');
    P(5, 13, 6, 2, 'g');
  },
  // Planta: bloco cortado na horizontal (tampa levantada)
  plan({ block, P }) {
    block(2, 1, 12, 5, 'B', 'w', 'b');
    P(1, 7, 14, 1, 'y');
    block(2, 9, 12, 6, 'l', 'w', 'n');
    P(4, 11, 3, 2, 'p');
    P(9, 11, 3, 2, 'c');
  },
  // Seção: bloco cortado na vertical
  section({ block, P }) {
    block(1, 2, 6, 12, 'B', 'w', 'b');
    P(8, 1, 1, 14, 'y');
    block(9, 2, 6, 12, 'l', 'w', 'n');
    P(10, 9, 4, 2, 'r');
    P(10, 5, 4, 2, 'G');
  },
  // Fatia: torta com um pedaço faltando
  pie({ P }) {
    const cx = 7.5;
    const cy = 8.5;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const r = Math.hypot(dx, dy);
        if (r > 6.8) continue;
        if (dx > 0 && dy < 0) continue; // fatia removida
        P(x, y, 1, 1, r > 5.6 ? 'n' : r > 4.6 ? 'y' : 'l');
      }
    }
    for (let y = 1; y < 8; y++) for (let x = 9; x < 16; x++) {
      const dx = x + 0.5 - (cx + 2);
      const dy = y + 0.5 - (cy - 2);
      const r = Math.hypot(dx, dy);
      if (r <= 6.2 && dx >= 0 && dy <= 0) P(x, y, 1, 1, r > 5 ? 'n' : r > 4 ? 'y' : 'l');
    }
  },
  levels({ block }) {
    block(1, 1, 14, 4, 'B', 'w', 'b');
    block(1, 6, 14, 4, 'y', 'w', 'o');
    block(1, 11, 14, 4, 'n', 'l', 'k');
  },
  quads({ block }) {
    block(0, 0, 7, 7, 'r', 'w', 'k');
    block(9, 0, 7, 7, 'G', 'w', 'e');
    block(0, 9, 7, 7, 'y', 'w', 'o');
    block(9, 9, 7, 7, 'b', 'B', 'k');
  },
  xray({ P }) {
    P(4, 4, 8, 1, 'c');
    P(2, 5, 2, 1, 'c'); P(12, 5, 2, 1, 'c');
    P(1, 6, 1, 4, 'c'); P(14, 6, 1, 4, 'c');
    P(2, 10, 2, 1, 'c'); P(12, 10, 2, 1, 'c');
    P(4, 11, 8, 1, 'c');
    P(6, 6, 4, 4, 'w');
    P(7, 7, 2, 2, 'k');
  },
  goal({ P }) {
    P(1, 3, 14, 1, 'w');
    P(1, 3, 1, 10, 'w');
    P(14, 3, 1, 10, 'w');
    for (let x = 3; x < 14; x += 2) P(x, 4, 1, 9, 'd');
    for (let y = 5; y < 13; y += 2) P(2, y, 12, 1, 'd');
    P(6, 11, 4, 4, 'w');
    P(7, 12, 2, 2, 'k');
  },
  wave({ P }) {
    const h = [3, 5, 8, 10, 8, 5, 3, 2];
    h.forEach((v, i) => {
      P(i * 2, 15 - v, 2, 2, 's');
      P(i * 2, 17 - v, 2, v - 2, i % 2 ? 'b' : 'r');
    });
  },
  fireworks({ P, dot }) {
    for (const [cx, cy, c] of [[5, 5, 'y'], [11, 9, 'r']]) {
      for (const [dx, dy] of [[0, -3], [2, -2], [3, 0], [2, 2], [0, 3], [-2, 2], [-3, 0], [-2, -2]]) dot(cx + dx, cy + dy, c);
      P(cx, cy, 1, 1, 'w');
    }
    P(5, 9, 1, 6, 'g');
  },
  play({ P }) {
    for (let x = 0; x < 9; x++) {
      const inset = Math.floor(x * 0.7);
      P(4 + x, 2 + inset, 1, 12 - inset * 2, 'G');
    }
  },
  left({ P }) {
    for (let x = 0; x < 7; x++) P(4 + x, 8 - x, 2, 1 + x * 2 > 13 ? 13 : 1 + x * 2, 'y');
    P(4, 7, 1, 2, 'y');
  },
  right({ P }) {
    for (let x = 0; x < 7; x++) P(10 - x, 8 - x, 2, 1 + x * 2 > 13 ? 13 : 1 + x * 2, 'y');
    P(11, 7, 1, 2, 'y');
  },
  pause({ P }) {
    P(4, 3, 3, 10, 'y');
    P(9, 3, 3, 10, 'y');
  },
  walk({ P }) {
    P(7, 1, 3, 3, 's');
    P(6, 4, 4, 5, 'r');
    P(4, 5, 2, 1, 'r'); P(10, 6, 2, 1, 'r');
    P(6, 9, 2, 4, 'b'); P(9, 9, 2, 3, 'b');
    P(5, 13, 2, 2, 'b'); P(10, 12, 2, 2, 'b');
  },
  dice({ box, P }) {
    box(1, 1, 14, 14, 'w');
    for (const [x, y] of [[4, 4], [11, 4], [7, 7], [4, 11], [11, 11]]) P(x - 1, y - 1, 2, 2, 'k');
  },
  ticket({ box, P }) {
    box(0, 3, 16, 10, 'y');
    P(10, 4, 1, 8, 'o');
    P(2, 6, 6, 1, 'k');
    P(2, 9, 4, 1, 'k');
    P(12, 6, 2, 4, 'r');
  },
  accessible({ P }) {
    P(7, 1, 3, 3, 'w');
    P(7, 4, 2, 5, 'w');
    P(7, 8, 5, 2, 'w');
    P(11, 10, 2, 4, 'w');
    for (const [x, y] of [[3, 8], [3, 9], [3, 10], [4, 11], [4, 12], [5, 13], [6, 13], [7, 13], [8, 12], [9, 12]]) P(x, y, 1, 1, 'B');
  },
  cube({ block, P }) {
    block(2, 4, 12, 10, 'b', 'B', 'k');
    P(4, 2, 10, 2, 'B');
    P(3, 6, 10, 2, 'B');
  },
  eye({ P }) {
    P(4, 5, 8, 1, 'w'); P(2, 6, 2, 1, 'w'); P(12, 6, 2, 1, 'w');
    P(1, 7, 1, 2, 'w'); P(14, 7, 1, 2, 'w');
    P(2, 9, 2, 1, 'w'); P(12, 9, 2, 1, 'w'); P(4, 10, 8, 1, 'w');
    P(6, 6, 4, 4, 'c'); P(7, 7, 2, 2, 'k');
  },
};

const cache = new Map();

/** URL (data:) do ícone; tamanho lógico 16×16. */
export function iconURL(name) {
  if (cache.has(name)) return cache.get(name);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  (DRAW[name] || DRAW.help)(painter(ctx));
  const img = ctx.getImageData(0, 0, 16, 16);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 100 ? 255 : 0;
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL('image/png');
  cache.set(name, url);
  return url;
}

/** Elemento <img> do ícone (sempre estático). */
export function pixelIcon(name, size = 24) {
  const img = document.createElement('img');
  img.src = iconURL(name);
  img.width = size;
  img.height = size;
  img.alt = '';
  img.draggable = false;
  img.className = 'px-icon';
  return img;
}

export const ICON_NAMES = Object.keys(DRAW);
