// Ambientes: corta o espaço, faz piso, paredes com porta e o mobiliário de cada tipo.
import { MAT, MAT_CAT, CAT_INDEX } from '../palette.js';
import { ROOMS } from '../spec.js';

const mod = (a, n) => ((a % n) + n) % n;
const hash = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Pré-processa a lista de salas por lado para o laço das colunas. */
export function prepareRooms() {
  const bySide = { W: [], E: [], N: [], S: [], ring: [] };
  for (const r of ROOMS) {
    const room = { ...r, floorMat: MAT[r.floor], w: r.u1 - r.u0, dd: r.d1 - r.d0 };
    const cat = MAT_CAT[room.floorMat];
    room.wallMat = r.wall ? MAT[r.wall] : cat === CAT_INDEX.operacoes || cat === CAT_INDEX.servicos ? room.floorMat : MAT.parede;
    if (r.ring) bySide.ring.push(room);
    else bySide[r.side].push(room);
  }
  return bySide;
}

export function fillRooms(col, rooms) {
  const { d, side, u, corner } = col.c;
  for (const room of rooms.ring) if (d >= room.d0 && d < room.d1) carveRoom(col, room, null, d - room.d0);
  if (corner) return;
  for (const room of rooms[side]) {
    if (u < room.u0 || u >= room.u1 || d < room.d0 || d >= room.d1) continue;
    carveRoom(col, room, u - room.u0, d - room.d0);
  }
}

function carveRoom(col, room, lu, ld) {
  const { v } = col;
  const { y0, y1 } = room;
  col.carve(y0, y1);
  col.set(y0 - 0.5, y0, room.floorMat);
  if (room.open || lu === null) {
    furnish(col, room, lu, ld);
    return;
  }
  // teto de quiosques no térreo / concourse superior
  if (y0 >= 0 && room.furniture !== 'boxes' && room.furniture !== 'booths') col.set(y1, y1 + 0.5, room.wallMat);
  // camarotes e cabines: frente envidraçada voltada ao campo, porta no fundo
  const glassFront = room.furniture === 'boxes' || room.furniture === 'booths';
  const edgeU = lu < v || lu >= room.w - v;
  const edgeD = (!glassFront && ld < v) || ld >= room.dd - v;
  if (edgeU || edgeD) {
    const mid = room.w / 2;
    const doorEdge = glassFront ? ld >= room.dd - v : ld < v;
    const door = doorEdge && (glassFront ? mod(lu, 6) > 2 && mod(lu, 6) < 4 : Math.abs(lu - mid) < 1.0);
    // balcão aberto dos bares voltado para o concourse
    const counter = room.furniture === 'bar' && ld >= room.dd - v && lu > 1 && lu < room.w - 1;
    if (counter) col.set(y0, y0 + 1, MAT.balcao);
    else if (door) col.set(y0 + 2.5, y1, room.wallMat);
    else col.set(y0, y1, room.wallMat);
    return;
  }
  furnish(col, room, lu, ld);
}

function furnish(col, room, lu, ld) {
  const { v } = col;
  const { y0 } = room;
  const w = room.w;
  const dd = room.dd;
  const inner = (m) => lu >= m && lu < w - m && ld >= m && ld < dd - m;
  switch (room.furniture) {
    case 'lockers': {
      // armários em U junto às paredes, banco contínuo à frente e quadro tático ao fundo
      const ring1 = !inner(v + 0.5);
      const ring2 = inner(v + 1.5) && !inner(v + 2.0);
      if (ring1 && ld >= v + 0.5) col.set(y0, y0 + 2, MAT.armario);
      else if (ring2 && ld >= v + 1.5) col.set(y0, y0 + 0.5, MAT.banco_vestiario);
      if (ld >= dd - v - 0.5 && Math.abs(lu - w / 2) < 2) col.set(y0 + 1, y0 + 2.5, MAT.monitor);
      break;
    }
    case 'showers':
      if (ld >= dd - v - 0.5 && mod(lu, 1.5) < v) col.set(y0, y0 + 2, MAT.parede);
      if (ld > 2 && ld < 5 && mod(lu, 3) >= 0.5 && mod(lu, 3) < 2) col.set(y0, y0 + 1, MAT.maca);
      break;
    case 'gym':
      if (inner(2)) col.set(y0 - 0.5, y0, MAT.grama_a);
      if (ld >= dd - 2 && mod(lu, 3) < 1) col.set(y0, y0 + 1, MAT.maca);
      break;
    case 'medical':
      if (ld > 2 && ld < 4 && mod(lu, 3.5) >= 0.5 && mod(lu, 3.5) < 2.5) col.set(y0, y0 + 1, MAT.maca);
      if (ld >= dd - v - 0.5 && lu < 2) col.set(y0, y0 + 1, MAT.louca);
      break;
    case 'press':
      if (ld >= dd - 2.5 && ld < dd - 1.5 && lu > 3 && lu < w - 3) col.set(y0, y0 + 1, MAT.mesa);
      if (ld >= dd - v - 0.5 && lu > 2 && lu < w - 2) col.set(y0 + 1, y0 + 3, MAT.monitor);
      if (ld > 1.5 && ld < dd - 4 && mod(ld, 1.5) < v && mod(lu, 1) < v && lu > 1.5 && lu < w - 1.5) col.set(y0, y0 + 0.5, MAT.cadeira_imprensa);
      break;
    case 'control':
      if (ld >= dd - v - 0.5 && lu > 1 && lu < w - 1) col.set(y0 + 0.5, y0 + 3.5, MAT.monitor);
      if ((Math.abs(ld - dd * 0.45) < 0.5 || Math.abs(ld - dd * 0.7) < 0.5) && lu > 2 && lu < w - 2) {
        col.set(y0, y0 + 1, MAT.mesa);
        if (mod(lu, 2) < v) col.set(y0 + 1, y0 + 1.5, MAT.monitor);
      }
      break;
    case 'parking': {
      const stall = mod(lu, 2.5);
      const lane = ld < 6 || (ld >= 12 && ld < 17.5) || ld >= 25;
      if (!lane && stall < v * 0.5 + 0.01) col.set(y0 - 0.5, y0, MAT.faixa_vaga);
      if (!lane && stall >= 0.5 && stall < 2.0) {
        const block = Math.floor(lu / 2.5) * 7 + Math.floor(ld / 6);
        const h = hash(block, 3.1);
        if (h < 0.78) {
          const m = h < 0.3 ? MAT.carro : h < 0.5 ? MAT.carro_vermelho : MAT.carro_branco;
          const cell = mod(ld, 6) < 5.5 || ld >= 17.5;
          if (cell) col.set(y0, y0 + (mod(ld, 6) > 1 && mod(ld, 6) < 4 ? 1.5 : 1), m);
        }
      }
      if (ld >= 25 && lu > 70 && lu < 82 && ld < 27.5) col.set(y0, y0 + 3.5, MAT.onibus);
      break;
    }
    case 'generators':
      if (ld > 3 && ld < 8 && mod(lu, 7) < 4.5) col.set(y0, y0 + 2.5, MAT.gerador);
      if (ld > 3 && ld < 8 && mod(lu, 7) > 1.5 && mod(lu, 7) < 2.5) col.set(y0 + 2.5, room.y1, MAT.duto);
      if (ld > 14 && ld < 18 && mod(lu, 7) < 4.5) col.set(y0, y0 + 2.5, MAT.gerador);
      break;
    case 'substation':
      if (ld > 4 && ld < 20 && mod(lu, 4) < 2.5 && lu > 1 && lu < w - 1) col.set(y0, y0 + 2.5, mod(ld, 6) < 4 ? MAT.subestacao : MAT.duto);
      break;
    case 'pumps':
      if (ld > 4 && ld < 8 && mod(lu, 3.5) < 2) col.set(y0, y0 + 1.5, MAT.bomba);
      if (ld > 7.5 && ld < 8.5) col.set(room.y1 - 1, room.y1 - 0.5, MAT.tubo_drenagem);
      if (mod(lu, 3.5) > 0.5 && mod(lu, 3.5) < 1 && ld > 7) col.set(room.y1 - 1, room.y1 - 0.5, MAT.tubo_drenagem);
      break;
    case 'kitchen':
      if (mod(ld, 5) < 1.5 && ld > 2 && lu > 2 && lu < w - 2) col.set(y0, y0 + 1, MAT.inox);
      break;
    case 'docks':
      if (ld > 8 && ld < 20 && lu > 3 && lu < 6) col.set(y0, y0 + 3.5, MAT.carro_branco);
      if (ld > 8 && ld < 11 && lu > 3 && lu < 6) col.set(y0 + 1, y0 + 3, MAT.carro_vermelho);
      if (ld > 2 && ld < 6 && mod(lu, 2) < 1.5 && lu > 8) col.set(y0, y0 + 1 + hash(lu, ld) * 1.5, MAT.deposito);
      break;
    case 'mowers':
      if (ld > 3 && ld < 6 && mod(lu, 5) < 3) col.set(y0, y0 + 1.5, MAT.trator);
      if (ld > 10 && ld < 14 && mod(lu, 4) < 2.5) col.set(y0, y0 + 2, MAT.deposito);
      break;
    case 'water':
      if (inner(v)) col.set(y0, room.y1 - 0.5, MAT.agua);
      else col.set(y0, room.y1, MAT.reservatorio);
      col.set(room.y1, room.y1 + 0.5, MAT.reservatorio);
      break;
    case 'bar':
      if (ld < 1.5 && lu > 1 && lu < w - 1) col.set(room.y0 + 0.5, room.y0 + 2, MAT.bar);
      if (ld >= 1 && ld < 1.5 && lu > 2 && lu < w - 2) col.set(room.y0 + 2, room.y0 + 3, MAT.monitor);
      break;
    case 'toilets':
      if (ld >= dd - v - 1.5 && mod(lu, 1.5) < v) col.set(y0, y0 + 2, MAT.banheiro);
      if (ld >= dd - v - 0.5 && mod(lu, 1.5) >= 0.5 && mod(lu, 1.5) < 1) col.set(y0, y0 + 0.5, MAT.louca);
      if (ld > 1 && ld < 2 && lu > 2 && lu < w - 2) col.set(y0, y0 + 1, MAT.louca);
      break;
    case 'shop':
      if (mod(lu, 3) < 0.5 && ld > 2) col.set(y0, y0 + 2, MAT.loja);
      if (ld > 1 && ld < 2 && lu > 2 && lu < 5) col.set(y0, y0 + 1, MAT.balcao);
      break;
    case 'lounge':
      if (mod(lu, 4) > 1 && mod(lu, 4) < 2.5 && mod(ld, 3.5) > 1 && mod(ld, 3.5) < 2) col.set(y0, y0 + 1, MAT.mesa);
      if (ld >= room.dd - 1 && mod(lu, 22) < 7) col.set(y0, y0 + 1.5, MAT.balcao);
      break;
    case 'boxes':
      if (mod(lu, 6) < v) col.set(y0, room.y1, MAT.parede);
      else {
        if (ld >= 0.5 && ld < 1) col.set(y0, y0 + 0.5, MAT.assento_camarote);
        if (ld >= 2 && ld < 2.5) col.set(y0, y0 + 1, MAT.assento_camarote);
        if (ld >= 4 && ld < 5 && mod(lu, 6) > 2 && mod(lu, 6) < 4) col.set(y0, y0 + 1, MAT.mesa);
      }
      break;
    case 'booths':
      if (mod(lu, 3) < v) col.set(y0, room.y1, MAT.parede);
      else {
        if (ld >= 0.5 && ld < 1.5) col.set(y0, y0 + 1, MAT.mesa);
        if (ld >= 0.5 && ld < 1 && mod(lu, 3) > 1 && mod(lu, 3) < 2) col.set(y0 + 1, y0 + 1.5, MAT.monitor);
        if (ld >= 2 && ld < 2.5 && mod(lu, 1.5) < v) col.set(y0, y0 + 0.5, MAT.cadeira_imprensa);
      }
      break;
    default:
      break;
  }
}
