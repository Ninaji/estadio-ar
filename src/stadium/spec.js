// Especificação da Arena Aurora — única fonte de verdade da geometria.
// Unidades em metros reais. Eixos: x = leste(+)/oeste(−), z = sul(+)/norte(−), y = altura.
// O campo fica rebaixado 6 m (estádio semienterrado); o nível da rua é y = 0.

export const ARENA_NAME = 'Arena Aurora';

export const Y_MIN = -14;
export const Y_MAX = 46;
export const HALF_X = 104;
export const HALF_Z = 122;

export const PITCH = { halfW: 34, halfL: 52.5, y: -6 };

// Contorno interno da arquibancada (d = 0): retângulo arredondado.
export const BOWL = { hx: 43, hz: 62, r: 16 };
export const CX = BOWL.hx - BOWL.r; // 27 — centro dos cantos em x
export const CZ = BOWL.hz - BOWL.r; // 46 — centro dos cantos em z
export const R = BOWL.r;
const HALF_PI = Math.PI / 2;

export const FACADE_D = 52; // face interna da fachada
export const FACADE_OUT = 53.5; // face externa
export const ROOF = { dIn: -8, dOut: 55, yIn: 41, yOut: 44 };

// ---------------------------------------------------------------------------
// Parametrização do contorno: 9 segmentos no sentido horário (visto de cima),
// começando no centro do lado Oeste e seguindo para o Norte.
// ---------------------------------------------------------------------------
export const SEGMENTS = [
  { id: 0, kind: 'side', side: 'W', len: CZ }, // z: 0 → −CZ   t = −z
  { id: 1, kind: 'corner', side: 'NW' },
  { id: 2, kind: 'side', side: 'N', len: 2 * CX }, // x: −CX → CX t = x + CX
  { id: 3, kind: 'corner', side: 'NE' },
  { id: 4, kind: 'side', side: 'E', len: 2 * CZ }, // z: −CZ → CZ t = z + CZ
  { id: 5, kind: 'corner', side: 'SE' },
  { id: 6, kind: 'side', side: 'S', len: 2 * CX }, // x: CX → −CX t = CX − x
  { id: 7, kind: 'corner', side: 'SW' },
  { id: 8, kind: 'side', side: 'W', len: CZ }, // z: CZ → 0    t = CZ − z
];
const STRAIGHT_BEFORE = [0, CZ, CZ, CZ + 2 * CX, CZ + 2 * CX, 3 * CZ + 2 * CX, 3 * CZ + 2 * CX, 3 * CZ + 4 * CX, 3 * CZ + 4 * CX];
const CORNERS_BEFORE = [0, 0, 1, 1, 2, 2, 3, 3, 4];
const CORNER_CENTER = { 1: [-CX, -CZ], 3: [CX, -CZ], 5: [CX, CZ], 7: [-CX, CZ] };

/** Perímetro do contorno deslocado d metros para fora. */
export function perimeterAt(d) {
  return 4 * CZ + 4 * CX + 2 * Math.PI * (R + d);
}

/** Início (em comprimento de arco) do segmento `seg` no contorno deslocado `d`. */
export function segStart(seg, d) {
  return STRAIGHT_BEFORE[seg] + CORNERS_BEFORE[seg] * (R + d) * HALF_PI;
}

/** Comprimento de arco de uma posição local (t) do segmento no contorno deslocado. */
export function arcAt(seg, t, d) {
  const local = SEGMENTS[seg].kind === 'corner' ? t * (R + d) : t;
  return segStart(seg, d) + local;
}

/**
 * Coordenadas de contorno de um ponto (x, z):
 *  d   distância com sinal ao contorno interno (negativo = dentro, no gramado)
 *  seg segmento; t posição local (metros nos lados, ângulo nos cantos)
 *  s   comprimento de arco no contorno interno; sd no contorno deslocado d
 *  side 'W'|'N'|'E'|'S'|'NW'...; u coordenada ao longo do lado (z em W/E, x em N/S)
 */
export function contourAt(x, z, o = {}) {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const qx = ax - CX;
  const qz = az - CZ;
  const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - R;
  let seg;
  let t;
  if (qx > 0 && qz > 0) {
    const vx = x - Math.sign(x) * CX;
    const vz = z - Math.sign(z) * CZ;
    if (z < 0 && x < 0) { seg = 1; t = Math.atan2(-vz, -vx); }
    else if (z < 0) { seg = 3; t = Math.atan2(vx, -vz); }
    else if (x > 0) { seg = 5; t = Math.atan2(vz, vx); }
    else { seg = 7; t = Math.atan2(-vx, vz); }
  } else if (qx >= qz) {
    if (x < 0) {
      if (z <= 0) { seg = 0; t = -z; } else { seg = 8; t = CZ - z; }
    } else { seg = 4; t = z + CZ; }
  } else if (z < 0) { seg = 2; t = x + CX; } else { seg = 6; t = CX - x; }
  const sg = SEGMENTS[seg];
  o.d = d;
  o.seg = seg;
  o.t = t;
  o.side = sg.side;
  o.corner = sg.kind === 'corner';
  o.u = sg.side === 'W' || sg.side === 'E' ? z : sg.side === 'N' || sg.side === 'S' ? x : NaN;
  o.s = arcAt(seg, t, 0);
  o.sd = arcAt(seg, t, d);
  return o;
}

/** Ponto (x, z) a partir de (seg, t, d) — inverso de contourAt. */
export function pointAt(seg, t, d) {
  const sg = SEGMENTS[seg];
  if (sg.kind === 'corner') {
    const [cx, cz] = CORNER_CENTER[seg];
    const rr = R + d;
    let dx;
    let dz;
    if (seg === 1) { dx = -Math.cos(t); dz = -Math.sin(t); }
    else if (seg === 3) { dx = Math.sin(t); dz = -Math.cos(t); }
    else if (seg === 5) { dx = Math.cos(t); dz = Math.sin(t); }
    else { dx = -Math.sin(t); dz = Math.cos(t); }
    return { x: cx + dx * rr, z: cz + dz * rr, nx: dx, nz: dz };
  }
  switch (seg) {
    case 0: return { x: -(BOWL.hx + d), z: -t, nx: -1, nz: 0 };
    case 8: return { x: -(BOWL.hx + d), z: CZ - t, nx: -1, nz: 0 };
    case 2: return { x: t - CX, z: -(BOWL.hz + d), nx: 0, nz: -1 };
    case 4: return { x: BOWL.hx + d, z: t - CZ, nx: 1, nz: 0 };
    default: return { x: CX - t, z: BOWL.hz + d, nx: 0, nz: 1 };
  }
}

/** Ponto de um lado reto a partir da coordenada u (z em W/E, x em N/S). */
export function sidePoint(side, u, d) {
  switch (side) {
    case 'W': return { x: -(BOWL.hx + d), z: u };
    case 'E': return { x: BOWL.hx + d, z: u };
    case 'N': return { x: u, z: -(BOWL.hz + d) };
    default: return { x: u, z: BOWL.hz + d };
  }
}

// ---------------------------------------------------------------------------
// Setores, corredores (escadas da arquibancada) e vomitórios.
// ---------------------------------------------------------------------------
const C8 = Math.PI / 8;
export const SECTORS = [
  { id: 'O1', name: 'Oeste 1', seg: 8, t0: 0, t1: 23, side: 'oeste' },
  { id: 'O2', name: 'Oeste 2', seg: 8, t0: 23, t1: 46.01, side: 'oeste' },
  { id: 'O3', name: 'Oeste 3', seg: 0, t0: 0, t1: 23, side: 'oeste' },
  { id: 'O4', name: 'Oeste 4', seg: 0, t0: 23, t1: 46.01, side: 'oeste' },
  { id: 'NO', name: 'Noroeste', seg: 1, t0: 0, t1: HALF_PI + 1e-6, side: 'canto' },
  { id: 'N1', name: 'Norte 1', seg: 2, t0: 0, t1: 27, side: 'norte' },
  { id: 'N2', name: 'Norte 2', seg: 2, t0: 27, t1: 54.01, side: 'norte' },
  { id: 'NE', name: 'Nordeste', seg: 3, t0: 0, t1: HALF_PI + 1e-6, side: 'canto' },
  { id: 'L1', name: 'Leste 1', seg: 4, t0: 0, t1: 23, side: 'leste' },
  { id: 'L2', name: 'Leste 2', seg: 4, t0: 23, t1: 46, side: 'leste' },
  { id: 'L3', name: 'Leste 3', seg: 4, t0: 46, t1: 69, side: 'leste' },
  { id: 'L4', name: 'Leste 4', seg: 4, t0: 69, t1: 92.01, side: 'leste' },
  { id: 'SE', name: 'Sudeste (visitante)', seg: 5, t0: 0, t1: HALF_PI + 1e-6, side: 'canto', visitor: true },
  { id: 'S1', name: 'Sul 1', seg: 6, t0: 0, t1: 27, side: 'sul' },
  { id: 'S2', name: 'Sul 2', seg: 6, t0: 27, t1: 54.01, side: 'sul' },
  { id: 'SO', name: 'Sudoeste', seg: 7, t0: 0, t1: HALF_PI + 1e-6, side: 'canto' },
];
// Ordem horária ao redor do campo (para numerar assentos e desenhar a legenda).
export const SECTOR_ORDER = ['O3', 'O4', 'NO', 'N1', 'N2', 'NE', 'L1', 'L2', 'L3', 'L4', 'SE', 'S1', 'S2', 'SO', 'O1', 'O2'];

export function sectorIndex(seg, t) {
  for (let i = 0; i < SECTORS.length; i++) {
    const s = SECTORS[i];
    if (s.seg === seg && t >= s.t0 && t < s.t1) return i;
  }
  return -1;
}

// Linhas de corredor (escadas radiais) em posições locais de cada segmento.
const SIDE_W = [0, 11.5, 23, 34.5, 46];
const SIDE_NS = [0, 13.5, 27, 40.5, 54];
const SIDE_E = [0, 11.5, 23, 34.5, 46, 57.5, 69, 80.5, 92];
const CORNER_A = [0, C8, 2 * C8, 3 * C8, 4 * C8];
export const AISLES = [SIDE_W, CORNER_A, SIDE_NS, CORNER_A, SIDE_E, CORNER_A, SIDE_NS, CORNER_A, SIDE_W];
export const AISLE_HALF = 0.5;
// Vomitórios no corredor central de cada setor.
export const VOMITORIES = [[11.5, 34.5], [2 * C8], [13.5, 40.5], [2 * C8], [11.5, 34.5, 57.5, 80.5], [2 * C8], [13.5, 40.5], [2 * C8], [11.5, 34.5]];
export const VOM_HALF = 1.0;
// Linhas estruturais (pilares) nas divisas de setor.
export const COLUMN_LINES = [[23, 46], [2 * C8], [0, 27, 54], [2 * C8], [0, 23, 46, 69, 92], [2 * C8], [0, 27, 54], [2 * C8], [0, 23, 46]];
export const COLUMN_D = [16.5, 27.5, 38.5];

/** Distância (em metros de arco no contorno d) de t até a linha mais próxima de `lines`. */
export function nearestLine(seg, t, d, lines) {
  const corner = SEGMENTS[seg].kind === 'corner';
  const scale = corner ? R + d : 1;
  let best = Infinity;
  let bestT = 0;
  for (const lt of lines) {
    const dist = Math.abs(t - lt) * scale;
    if (dist < best) { best = dist; bestT = lt; }
  }
  return { dist: best, t: bestT };
}

// ---------------------------------------------------------------------------
// Anéis de arquibancada (perfil da seção). Fila = 1,0 m de profundidade.
// ---------------------------------------------------------------------------
export const TIERS = [
  // crossRow: fila sem assentos na altura do vomitório (corredor transversal)
  { id: 'i', key: 'inferior', name: 'Anel inferior', d0: 0, rows: 22, y0: -4.5, rise: [0.5], vomFloor: 0, vomH: 2.5, vomEnd: 16, crossRow: 9, level: 'terreo' },
  { id: 'm', key: 'intermediario', name: 'Anel intermediário', d0: 19, rows: 8, y0: 8.5, rise: [0.5], vomFloor: 8, vomH: 2.5, vomEnd: 27, crossRow: 0, level: 'clube' },
  { id: 'u', key: 'superior', name: 'Anel superior', d0: 30, rows: 22, y0: 18.5, rise: [0.5, 0.5, 1.0], vomFloor: 18, vomH: 2.5, vomEnd: 36, crossRow: 0, level: 'superior' },
];
for (const tier of TIERS) {
  tier.treads = [];
  let y = tier.y0;
  for (let r = 0; r < tier.rows; r++) {
    tier.treads.push(y);
    y += tier.rise[r % tier.rise.length];
  }
}

/** Fila e altura do degrau de um anel na distância d (ou null fora do anel). */
export function tierRowAt(tier, d) {
  const rel = d - tier.d0;
  if (rel < 0 || rel >= tier.rows) return null;
  const row = Math.floor(rel);
  return { row, tread: tier.treads[row], frac: rel - row };
}

// ---------------------------------------------------------------------------
// Níveis (camadas da "torta") — limites nas faces inferiores das lajes.
// ---------------------------------------------------------------------------
export const LEVELS = [
  { id: 'fund', short: 'Fundações', name: 'Fundações e terreno', y0: Y_MIN, y1: -9.5, floor: -12 },
  { id: 'campo', short: 'Campo', name: 'Nível do campo e subsolo', y0: -9.5, y1: -1, floor: -6 },
  { id: 'terreo', short: 'Térreo', name: 'Térreo e concourse inferior', y0: -1, y1: 7, floor: 0 },
  { id: 'clube', short: 'Clube', name: 'Nível clube e camarotes', y0: 7, y1: 17, floor: 8 },
  { id: 'superior', short: 'Superior', name: 'Concourse e anel superior', y0: 17, y1: 27, floor: 18 },
  { id: 'topo', short: 'Topo', name: 'Topo do anel superior', y0: 27, y1: 37, floor: 28 },
  { id: 'cobertura', short: 'Cobertura', name: 'Cobertura', y0: 37, y1: Y_MAX, floor: 40 },
];

export function levelOfY(y) {
  for (let i = LEVELS.length - 1; i >= 0; i--) if (y >= LEVELS[i].y0) return i;
  return 0;
}

// Quadrantes (pedaços da torta): divisões em x = 0 e z = 0.
export const QUADRANTS = [
  { id: 'NO', name: 'Quadrante Noroeste', dx: -1, dz: -1 },
  { id: 'NE', name: 'Quadrante Nordeste', dx: 1, dz: -1 },
  { id: 'SO', name: 'Quadrante Sudoeste', dx: -1, dz: 1 },
  { id: 'SE', name: 'Quadrante Sudeste', dx: 1, dz: 1 },
];
export function quadrantOf(x, z) {
  return (x < 0 ? 0 : 1) + (z < 0 ? 0 : 2);
}

// ---------------------------------------------------------------------------
// Portões (numerados no sentido horário a partir do principal, no Oeste).
// ---------------------------------------------------------------------------
export const GATES = [
  { n: 1, seg: 0, t: 0, name: 'Portão 1 — Principal (Oeste)' },
  { n: 2, seg: 0, t: 30, name: 'Portão 2 — Oeste Norte' },
  { n: 3, seg: 1, t: 2 * C8, name: 'Portão 3 — Noroeste' },
  { n: 4, seg: 2, t: 27, name: 'Portão 4 — Norte' },
  { n: 5, seg: 3, t: 2 * C8, name: 'Portão 5 — Nordeste' },
  { n: 6, seg: 4, t: 16, name: 'Portão 6 — Leste Norte' },
  { n: 7, seg: 4, t: 46, name: 'Portão 7 — Leste' },
  { n: 8, seg: 4, t: 76, name: 'Portão 8 — Leste Sul' },
  { n: 9, seg: 5, t: 2 * C8, name: 'Portão 9 — Sudeste (visitante)' },
  { n: 10, seg: 6, t: 27, name: 'Portão 10 — Sul' },
  { n: 11, seg: 7, t: 2 * C8, name: 'Portão 11 — Sudoeste' },
  { n: 12, seg: 8, t: 16, name: 'Portão 12 — Oeste Sul' },
];
export const GATE_HALF = 3;
export const GATE_H = 5;

// ---------------------------------------------------------------------------
// Ambientes (salas) em lados retos: u ao longo do lado, d a partir do contorno.
// ---------------------------------------------------------------------------
export const ROOMS = [
  // Nível do campo — lado Oeste (operação de jogo)
  { id: 'tunel', name: 'Túnel dos jogadores', side: 'W', u0: -2, u1: 2, d0: 0, d1: 18, y0: -6, y1: -3, floor: 'tunel_jogadores', open: true, desc: 'Liga os vestiários ao gramado. Times e arbitragem entram juntos por aqui.' },
  { id: 'corredor', name: 'Corredor técnico do subsolo', ring: true, d0: 18, d1: 22, y0: -6, y1: -1, floor: 'corredor_servico', open: true, desc: 'Anel de serviço que dá a volta no estádio sob as arquibancadas, usado por equipes, segurança e abastecimento.' },
  { id: 'aquecimento', name: 'Sala de aquecimento', side: 'W', u0: -44, u1: -24, d0: 22, d1: 36, y0: -6, y1: -1, floor: 'vestiario', furniture: 'gym', desc: 'Grama sintética para os atletas se aquecerem antes do jogo e no intervalo.' },
  { id: 'vest_mandante', name: 'Vestiário mandante', side: 'W', u0: -22, u1: -5, d0: 22, d1: 36, y0: -6, y1: -1, floor: 'vestiario', furniture: 'lockers', desc: 'Armários em U, bancos e quadro tático. O mandante fica mais perto do túnel.' },
  { id: 'arbitragem', name: 'Vestiário da arbitragem', side: 'W', u0: -4, u1: 4, d0: 22, d1: 30, y0: -6, y1: -1, floor: 'vestiario', furniture: 'lockers', desc: 'Sala isolada dos times, com acesso direto ao túnel.' },
  { id: 'vest_visitante', name: 'Vestiário visitante', side: 'W', u0: 5, u1: 22, d0: 22, d1: 36, y0: -6, y1: -1, floor: 'vestiario', furniture: 'lockers', desc: 'Mesma estrutura do mandante, do outro lado do túnel.' },
  { id: 'antidoping', name: 'Sala de antidoping', side: 'W', u0: 24, u1: 33, d0: 22, d1: 36, y0: -6, y1: -1, floor: 'vestiario', furniture: 'medical', desc: 'Coleta de amostras dos atletas sorteados, com banheiro próprio.' },
  { id: 'medico', name: 'Departamento médico', side: 'W', u0: 34, u1: 44, d0: 22, d1: 36, y0: -6, y1: -1, floor: 'vestiario', furniture: 'medical', desc: 'Atendimento de atletas: macas, raio-X portátil e saída rápida para ambulância.' },
  { id: 'coletiva', name: 'Sala de coletiva de imprensa', side: 'W', u0: -44, u1: -24, d0: 38, d1: 50, y0: -6, y1: -1, floor: 'sala_imprensa', furniture: 'press', desc: 'Técnicos e jogadores falam com a imprensa após o jogo.' },
  { id: 'fisio_mandante', name: 'Chuveiros e fisioterapia (mandante)', side: 'W', u0: -22, u1: -9, d0: 38, d1: 50, y0: -6, y1: -1, floor: 'chuveiro', furniture: 'showers', desc: 'Duchas, banheiras de gelo e macas de massagem.' },
  { id: 'zona_mista', name: 'Zona mista', side: 'W', u0: -4, u1: 4, d0: 32, d1: 50, y0: -6, y1: -1, floor: 'sala_imprensa', furniture: 'none', desc: 'Corredor onde jornalistas entrevistam os atletas na saída para o ônibus.' },
  { id: 'fisio_visitante', name: 'Chuveiros e fisioterapia (visitante)', side: 'W', u0: 9, u1: 22, d0: 38, d1: 50, y0: -6, y1: -1, floor: 'chuveiro', furniture: 'showers', desc: 'Duchas e área de recuperação do time visitante.' },
  { id: 'cco', name: 'Centro de controle operacional', side: 'W', u0: 24, u1: 44, d0: 38, d1: 50, y0: -6, y1: -1, floor: 'controle', furniture: 'control', desc: 'Câmeras, catracas, iluminação e segurança monitoradas em tempo real.' },
  // Nível do campo — Leste (estacionamento)
  { id: 'estacionamento', name: 'Estacionamento subterrâneo', side: 'E', u0: -44, u1: 44, d0: 22, d1: 51.5, y0: -6, y1: -1, floor: 'vaga', furniture: 'parking', desc: 'Vagas para delegações, imprensa e convidados, com rampa para a rua.' },
  // Nível do campo — Norte (energia e água)
  { id: 'geradores', name: 'Central de geradores', side: 'N', u0: -26, u1: -6, d0: 22, d1: 51.5, y0: -6, y1: -1, floor: 'deposito', furniture: 'generators', desc: 'Geradores a diesel garantem os refletores ligados mesmo se a rede cair.' },
  { id: 'subestacao', name: 'Subestação elétrica', side: 'N', u0: -5, u1: 8, d0: 22, d1: 51.5, y0: -6, y1: -1, floor: 'deposito', furniture: 'substation', desc: 'Recebe a energia em média tensão e distribui para todo o estádio.' },
  { id: 'bombas', name: 'Casa de bombas', side: 'N', u0: 9, u1: 26, d0: 22, d1: 51.5, y0: -6, y1: -1, floor: 'deposito', furniture: 'pumps', desc: 'Bombas de incêndio, irrigação do gramado e reúso de água da chuva.' },
  // Nível do campo — Sul (logística)
  { id: 'cozinha', name: 'Cozinha central', side: 'S', u0: -26, u1: -6, d0: 22, d1: 51.5, y0: -6, y1: -1, floor: 'cozinha', furniture: 'kitchen', desc: 'Prepara e distribui a comida dos bares, camarotes e restaurantes.' },
  { id: 'docas', name: 'Docas de carga', side: 'S', u0: -5, u1: 10, d0: 22, d1: 51.5, y0: -6, y1: -1, floor: 'doca', furniture: 'docks', desc: 'Caminhões descarregam bebidas, comida e equipamentos de shows.' },
  { id: 'manutencao', name: 'Manutenção do gramado', side: 'S', u0: 11, u1: 26, d0: 22, d1: 51.5, y0: -6, y1: -1, floor: 'deposito', furniture: 'mowers', desc: 'Tratores, cortadores e lâmpadas de crescimento que cuidam da grama.' },
  // Fundação — reservatório
  { id: 'reservatorio', name: 'Reservatório de água de reúso', side: 'N', u0: -22, u1: 22, d0: 24, d1: 48, y0: -13, y1: -9.5, floor: 'reservatorio', wall: 'reservatorio', furniture: 'water', desc: 'Armazena água da chuva captada pela cobertura para irrigação e descargas.' },

  // Térreo — concourse inferior (piso 0)
  ...['W', 'E'].flatMap((side) => [
    { id: `bar_t_${side}1`, name: 'Bar e lanchonete', side, u0: -30, u1: -16, d0: 24, d1: 30, y0: 0, y1: 4, floor: 'bar', furniture: 'bar', desc: 'Pontos de venda virados para o concourse, perto dos vomitórios.' },
    { id: `wc_t_${side}1`, name: 'Banheiros', side, u0: -6, u1: 6, d0: 24, d1: 32, y0: 0, y1: 4, floor: 'banheiro', furniture: 'toilets', desc: 'Sanitários masculinos, femininos e acessíveis.' },
    { id: `bar_t_${side}2`, name: 'Bar e lanchonete', side, u0: 16, u1: 30, d0: 24, d1: 30, y0: 0, y1: 4, floor: 'bar', furniture: 'bar', desc: 'Pontos de venda virados para o concourse, perto dos vomitórios.' },
    { id: `wc_t_${side}2`, name: 'Banheiros', side, u0: -44, u1: -36, d0: 34, d1: 42, y0: 0, y1: 4, floor: 'banheiro', furniture: 'toilets', desc: 'Sanitários masculinos, femininos e acessíveis.' },
    { id: `wc_t_${side}3`, name: 'Banheiros', side, u0: 36, u1: 44, d0: 34, d1: 42, y0: 0, y1: 4, floor: 'banheiro', furniture: 'toilets', desc: 'Sanitários masculinos, femininos e acessíveis.' },
  ]),
  { id: 'socorro_W', name: 'Posto de primeiros socorros', side: 'W', u0: 24, u1: 32, d0: 34, d1: 42, y0: 0, y1: 4, floor: 'primeiros_socorros', furniture: 'medical', desc: 'Atendimento ao torcedor com saída direta para ambulâncias.' },
  { id: 'loja_W', name: 'Loja oficial', side: 'W', u0: -32, u1: -24, d0: 34, d1: 42, y0: 0, y1: 4, floor: 'loja', furniture: 'shop', desc: 'Camisas, cachecóis e lembranças da Arena Aurora.' },
  { id: 'socorro_E', name: 'Posto de primeiros socorros', side: 'E', u0: -32, u1: -24, d0: 34, d1: 42, y0: 0, y1: 4, floor: 'primeiros_socorros', furniture: 'medical', desc: 'Atendimento ao torcedor com saída direta para ambulâncias.' },
  ...['N', 'S'].flatMap((side) => [
    { id: `bar_t_${side}`, name: 'Bar e lanchonete', side, u0: -6, u1: 6, d0: 24, d1: 30, y0: 0, y1: 4, floor: 'bar', furniture: 'bar', desc: 'Pontos de venda virados para o concourse, perto dos vomitórios.' },
    { id: `wc_t_${side}1`, name: 'Banheiros', side, u0: -26, u1: -18, d0: 34, d1: 42, y0: 0, y1: 4, floor: 'banheiro', furniture: 'toilets', desc: 'Sanitários masculinos, femininos e acessíveis.' },
    { id: `wc_t_${side}2`, name: 'Banheiros', side, u0: 18, u1: 26, d0: 34, d1: 42, y0: 0, y1: 4, floor: 'banheiro', furniture: 'toilets', desc: 'Sanitários masculinos, femininos e acessíveis.' },
  ]),
  // Nível clube (piso 8) — lounges
  ...['W', 'E', 'N', 'S'].map((side) => ({
    id: `lounge_${side}`, name: 'Lounge do nível clube', side, u0: side === 'W' || side === 'E' ? -44 : -25, u1: side === 'W' || side === 'E' ? 44 : 25, d0: 27.5, d1: 38, y0: 8, y1: 11, floor: 'piso_camarote', furniture: 'lounge', open: true,
    desc: 'Restaurante e bar para quem tem ingresso do anel intermediário, com vista para o campo.',
  })),
  // Camarotes (piso 12)
  { id: 'tribuna', name: 'Tribuna de honra', side: 'W', u0: -9, u1: 9, d0: 27.5, d1: 34, y0: 12, y1: 16, floor: 'piso_camarote', furniture: 'boxes', desc: 'Camarote central para autoridades e convidados oficiais, no eixo do meio-campo.' },
  { id: 'imprensa_n', name: 'Cabines de imprensa, rádio e TV', side: 'W', u0: -44, u1: -10, d0: 27.5, d1: 34, y0: 12, y1: 16, floor: 'cabine_tv', furniture: 'booths', desc: 'Narradores e comentaristas transmitem o jogo com visão elevada do campo.' },
  { id: 'imprensa_s', name: 'Cabines de imprensa, rádio e TV', side: 'W', u0: 10, u1: 44, d0: 27.5, d1: 34, y0: 12, y1: 16, floor: 'cabine_tv', furniture: 'booths', desc: 'Narradores e comentaristas transmitem o jogo com visão elevada do campo.' },
  { id: 'camarotes_E', name: 'Camarotes', side: 'E', u0: -44, u1: 44, d0: 27.5, d1: 34, y0: 12, y1: 16, floor: 'piso_camarote', furniture: 'boxes', desc: 'Salas privativas com poltronas, frigobar e vidro de frente para o campo.' },
  { id: 'camarotes_N', name: 'Camarotes', side: 'N', u0: -25, u1: 25, d0: 27.5, d1: 34, y0: 12, y1: 16, floor: 'piso_camarote', furniture: 'boxes', desc: 'Salas privativas com poltronas, frigobar e vidro de frente para o campo.' },
  { id: 'camarotes_S', name: 'Camarotes', side: 'S', u0: -25, u1: 25, d0: 27.5, d1: 34, y0: 12, y1: 16, floor: 'piso_camarote', furniture: 'boxes', desc: 'Salas privativas com poltronas, frigobar e vidro de frente para o campo.' },
  // Concourse superior (piso 18)
  ...['W', 'E'].flatMap((side) => [
    { id: `bar_s_${side}1`, name: 'Bar do concourse superior', side, u0: -30, u1: -18, d0: 40, d1: 45, y0: 18, y1: 22, floor: 'bar', furniture: 'bar', desc: 'Bar com vista para a cidade pela fachada.' },
    { id: `wc_s_${side}`, name: 'Banheiros', side, u0: -6, u1: 6, d0: 39, d1: 46, y0: 18, y1: 22, floor: 'banheiro', furniture: 'toilets', desc: 'Sanitários do anel superior.' },
    { id: `bar_s_${side}2`, name: 'Bar do concourse superior', side, u0: 18, u1: 30, d0: 40, d1: 45, y0: 18, y1: 22, floor: 'bar', furniture: 'bar', desc: 'Bar com vista para a cidade pela fachada.' },
  ]),
  ...['N', 'S'].map((side) => ({ id: `wc_s_${side}`, name: 'Banheiros', side, u0: -6, u1: 6, d0: 39, d1: 46, y0: 18, y1: 22, floor: 'banheiro', furniture: 'toilets', desc: 'Sanitários do anel superior.' })),
];

// ---------------------------------------------------------------------------
// Circulação vertical
// ---------------------------------------------------------------------------
// Escadas em caixa (lances em zigue-zague). levels = pisos atendidos.
export const STAIRS = [
  ...['W', 'E'].flatMap((side) => [
    { id: `esc_${side}a`, name: 'Escada de público', side, u0: -24, u1: -10, d0: 45.5, d1: 50, levels: [0, 8, 18] },
    { id: `esc_${side}b`, name: 'Escada de público', side, u0: 10, u1: 24, d0: 45.5, d1: 50, levels: [0, 8, 18] },
  ]),
  { id: 'esc_N', name: 'Escada de público', side: 'N', u0: 8, u1: 22, d0: 45.5, d1: 50, levels: [0, 8, 18] },
  { id: 'esc_S', name: 'Escada de público', side: 'S', u0: -22, u1: -8, d0: 45.5, d1: 50, levels: [0, 8, 18] },
];
export const ELEVATORS = [
  { id: 'elev_W', name: 'Elevador (Oeste)', side: 'W', u0: 5, u1: 8, d0: 46.5, d1: 49.5, y0: -6, y1: 18 },
  { id: 'elev_E', name: 'Elevador (Leste)', side: 'E', u0: -7, u1: -4, d0: 46.5, d1: 49.5, y0: -6, y1: 18 },
  { id: 'elev_N', name: 'Elevador (Norte)', side: 'N', u0: -12, u1: -9, d0: 46.5, d1: 49.5, y0: -6, y1: 18 },
  { id: 'elev_S', name: 'Elevador (Sul)', side: 'S', u0: 9, u1: 12, d0: 46.5, d1: 49.5, y0: -6, y1: 18 },
];
export const ESCALATORS = [
  { id: 'rolante_W', name: 'Escadas rolantes', side: 'W', u0: 28, u1: 44, d0: 44, d1: 47, y0: 0, y1: 8 },
  { id: 'rolante_E', name: 'Escadas rolantes', side: 'E', u0: 28, u1: 44, d0: 44, d1: 47, y0: 0, y1: 8 },
];
// Rampas helicoidais nos 4 cantos, fora da fachada.
export const RAMP = { rIn: 4, rOut: 10, risePerTurn: 10 / 3, y0: 0, y1: 18, dCenter: 64 };
export const RAMPS = [1, 3, 5, 7].map((seg) => {
  const p = pointAt(seg, 2 * C8, RAMP.dCenter);
  return { id: `rampa_${SEGMENTS[seg].side}`, name: `Rampa helicoidal ${SEGMENTS[seg].side}`, seg, x: p.x, z: p.z, nx: p.nx, nz: p.nz };
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
export function sideOfSeg(seg) {
  return SEGMENTS[seg].side;
}

export function seatMaterialKey(sectorIdx, tierIdx) {
  const sec = SECTORS[sectorIdx];
  const tier = TIERS[tierIdx];
  if (sec.visitor && tier.id === 'i') return 'assento_visitante';
  return `assento_${sec.side}_${tier.id}`;
}

export function gridDims(voxel) {
  return {
    nx: Math.round((2 * HALF_X) / voxel),
    ny: Math.round((Y_MAX - Y_MIN) / voxel),
    nz: Math.round((2 * HALF_Z) / voxel),
    ox: -HALF_X,
    oy: Y_MIN,
    oz: -HALF_Z,
    voxel,
  };
}
