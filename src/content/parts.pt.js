// Textos educativos: o que é cada parte da arena e como ela funciona.
import { MATERIALS, CATEGORIES, isSeatMaterial } from '../stadium/palette.js';
import {
  ROOMS, STAIRS, ELEVATORS, ESCALATORS, RAMPS, RAMP, TIERS, SECTORS, LEVELS, levelOfY, contourAt,
} from '../stadium/spec.js';

const CATEGORY_TEXT = {
  estrutura: 'Esqueleto de concreto armado: pilares, vigas e lajes que levam o peso das pessoas até as fundações.',
  assentos: 'Assentos numerados presos aos degraus. Cada fila tem 1 m de profundidade: meio metro para as pernas e meio para a cadeira.',
  circulacao: 'Caminhos horizontais por onde o público circula: concourses, corredores e vomitórios, dimensionados para esvaziar o estádio em poucos minutos.',
  vertical: 'Escadas, rampas, elevadores e escadas rolantes que ligam os pavimentos.',
  servicos: 'Bares, banheiros, lojas e primeiros socorros espalhados pelos concourses, perto de cada setor.',
  operacoes: 'Áreas de bastidores: vestiários, imprensa, controle, cozinha, estacionamento e logística.',
  cobertura: 'Cobertura metálica em balanço: treliças radiais presas num anel de compressão protegem o público da chuva e do sol.',
  campo: 'O gramado é um sistema em camadas: grama, raízes, areia, brita e drenagem.',
  terreno: 'Solo natural e aterro onde o estádio está parcialmente enterrado (o campo fica 6 m abaixo da rua).',
  instalacoes: 'Redes de água, drenagem, energia e climatização escondidas sob pisos e lajes.',
  fachada: 'Pele externa com brises, vidro e painéis de LED; os portões ficam no térreo.',
  iluminacao: 'Refletores LED, telões e placas de publicidade que acendem no modo Show.',
};

const MATERIAL_TEXT = {
  concreto: 'Concreto armado moldado no local. Nas arquibancadas ele forma lajes em degraus apoiadas em vigas inclinadas (vigas-jacaré).',
  concreto_escuro: 'Pilares e vigas principais: recebem as cargas das lajes e descem até os blocos de fundação.',
  laje: 'Laje de piso. Entre pavimentos, separa os concourses e suporta multidões em movimento.',
  piso_arquibancada: 'Degrau da arquibancada. A altura de cada degrau define a visibilidade (linha C) de quem senta atrás.',
  parede: 'Parede de vedação interna.',
  estaca: 'Estaca profunda: transfere a carga dos pilares para a rocha firme.',
  bloco_fundacao: 'Bloco de coroamento: une a cabeça das estacas e recebe o pilar.',
  vidro: 'Guarda-corpo ou fachada de vidro laminado: protege sem bloquear a vista.',
  guarda_corpo: 'Guarda-corpo do fundo da arquibancada (altura mínima de 1,1 m).',
  espaco_pcd: 'Plataforma plana para cadeira de rodas, no nível do vomitório, com lugar para acompanhante.',
  piso_circulacao: 'Concourse: o grande corredor anelar com bares e banheiros que liga portões, escadas e vomitórios.',
  degrau_corredor: 'Escada do corredor da arquibancada, sinalizada em amarelo para a evacuação.',
  piso_vomitorio: 'Vomitório: túnel que leva o público do concourse direto ao meio da arquibancada.',
  corredor_servico: 'Anel técnico no subsolo, usado por equipes, segurança, ambulâncias e abastecimento.',
  piso_camarote: 'Área premium do nível clube e dos camarotes.',
  tunel_jogadores: 'Túnel dos jogadores, dos vestiários até o gramado.',
  escada: 'Escada de lances retos com patamares a cada meio pavimento.',
  rampa: 'Rampa helicoidal com inclinação de cerca de 8%, acessível e usada também na evacuação.',
  elevador_cabine: 'Cabine de elevador.',
  poco_elevador: 'Poço de elevador envidraçado, prioridade para pessoas com deficiência, idosos e serviço.',
  escada_rolante: 'Escadas rolantes entre o térreo e o nível clube.',
  corrimao: 'Corrimão e guarda-corpo.',
  grama_a: 'Gramado híbrido: grama natural reforçada com fibras sintéticas, cortada em faixas.',
  grama_b: 'Gramado híbrido: as faixas claras e escuras vêm do sentido do corte.',
  grama_entorno: 'Área de escape ao redor do campo, com a mesma grama.',
  linha: 'Marcação do campo (105 × 68 m), pintada com tinta à base de água.',
  trave: 'Trave do gol: 7,32 m de largura por 2,44 m de altura.',
  rede: 'Rede do gol.',
  zona_raizes: 'Zona de raízes: areia com fibras onde a grama se fixa (cerca de 30 cm).',
  transicao: 'Camada de transição de areia grossa, que evita a areia descer para a brita.',
  brita: 'Brita drenante: a água da chuva atravessa o gramado e escoa pelos tubos.',
  subleito: 'Subleito compactado, inclinado para levar a água aos drenos.',
  tubo_drenagem: 'Drenos em espinha de peixe: a água da chuva sai do gramado em minutos.',
  tubo_aquecimento: 'Tubos de aquecimento sob o gramado, que evitam congelamento e ajudam a grama a crescer.',
  aspersor: 'Aspersor escamoteável: sobe do gramado para irrigar e se esconde durante o jogo.',
  banco_reservas: 'Banco de reservas com cobertura, dentro da área técnica.',
  placa_led: 'Placas de LED de publicidade ao redor do campo.',
  telao: 'Telão de LED para replays e placar.',
  refletor: 'Anel de refletores LED na borda da cobertura: ilumina o campo para TV em 4K sem sombras.',
  trelica: 'Treliça metálica radial: barras em zigue-zague vencem até 60 m de balanço.',
  trelica_escura: 'Banzo da treliça e anel de compressão, que equilibram os esforços da cobertura.',
  membrana: 'Membrana translúcida de PTFE: deixa passar luz natural para o gramado.',
  passarela: 'Passarela técnica para manutenção dos refletores e do som.',
  calha: 'Calha que coleta a chuva da cobertura e leva ao reservatório de reúso.',
  brise: 'Brise: lâminas que sombreiam e ventilam o interior.',
  fachada_led: 'Painel de mídia em LED na fachada: muda de cor nos dias de jogo.',
  vidro_fachada: 'Pele de vidro da fachada.',
  pilar_fachada: 'Mastro da fachada: sustenta a borda externa da cobertura.',
  catraca: 'Catraca com leitor de ingresso digital e biometria facial.',
  portao: 'Portão de acesso do público.',
  terra: 'Terra vegetal da superfície.',
  solo: 'Solo arenoso.',
  argila: 'Camada de argila.',
  rocha: 'Rocha sã: onde as estacas se apoiam.',
  aterro: 'Aterro compactado sob o anel inferior, apoiado direto no terreno.',
  piso_esplanada: 'Esplanada: praça externa onde o público se acomoda antes de entrar.',
  base_maquete: 'Base da maquete.',
  placa: 'Placa da Arena Aurora.',
  reservatorio: 'Reservatório enterrado de água de reúso.',
  agua: 'Água da chuva armazenada para irrigação e descargas.',
  bilheteria: 'Bilheteria e atendimento ao torcedor.',
};

export function categoryOf(matId) {
  return CATEGORIES[MATERIALS[matId]?.cat] || null;
}

function inSideBox(c, side, u0, u1, d0, d1) {
  return !c.corner && c.side === side && c.u >= u0 && c.u < u1 && c.d >= d0 && c.d < d1;
}

/**
 * Descreve um voxel selecionado. hit = { i, j, k, mat, seat? }; dims = dimensões da grade.
 * Retorna { title, kind, color, level, text, meta: [], seat?, focus: {x,y,z}, box?: {min,max} }.
 */
export function describeHit(hit, dims) {
  const v = dims.voxel;
  const x = dims.ox + (hit.i + 0.5) * v;
  const y = dims.oy + (hit.j + 0.5) * v;
  const z = dims.oz + (hit.k + 0.5) * v;
  const mat = MATERIALS[hit.mat];
  const cat = categoryOf(hit.mat);
  const level = LEVELS[levelOfY(y)];
  const c = contourAt(x, z);
  const base = {
    color: mat.color,
    category: cat?.name,
    level: level.name,
    focus: { x, y, z },
    meta: [],
  };

  if (hit.seat) {
    const [, , , ti, si, row, num] = hit.seat;
    const tier = TIERS[ti];
    const sec = SECTORS[si];
    return {
      ...base,
      kind: 'seat',
      title: `Assento ${num} · Fila ${row + 1}`,
      text: `${tier.name}, setor ${sec.name}. ${MATERIAL_TEXT.piso_arquibancada} Toque em "Rota até aqui" para ver o caminho desde o portão.`,
      meta: [`Setor ${sec.id}`, tier.name, `Fila ${row + 1}`, `Assento ${num}`],
      seat: { tier: ti, sector: si, row, num },
    };
  }

  for (const r of ROOMS) {
    const yy = y >= r.y0 - 0.6 && y < r.y1 + 0.6;
    if (!yy) continue;
    if (r.ring ? c.d >= r.d0 && c.d < r.d1 && !c.corner && Math.abs(y - r.y0) < 5 : inSideBox(c, r.side, r.u0, r.u1, r.d0, r.d1)) {
      return { ...base, kind: 'room', title: r.name, text: r.desc, meta: [level.name], room: r };
    }
  }
  for (const b of STAIRS) {
    if (inSideBox(c, b.side, b.u0, b.u1, b.d0, b.d1)) {
      return { ...base, kind: 'vertical', title: b.name, text: `${MATERIAL_TEXT.escada} Atende os pisos ${b.levels.join(', ')} m.`, meta: [`Pisos ${b.levels.join(' · ')} m`] };
    }
  }
  for (const b of ELEVATORS) {
    if (inSideBox(c, b.side, b.u0, b.u1, b.d0, b.d1)) {
      return { ...base, kind: 'vertical', title: b.name, text: MATERIAL_TEXT.poco_elevador, meta: ['Do subsolo ao concourse superior'] };
    }
  }
  for (const b of ESCALATORS) {
    if (inSideBox(c, b.side, b.u0, b.u1, b.d0, b.d1)) {
      return { ...base, kind: 'vertical', title: b.name, text: MATERIAL_TEXT.escada_rolante, meta: ['Térreo ↔ nível clube'] };
    }
  }
  for (const r of RAMPS) {
    if (Math.hypot(x - r.x, z - r.z) < RAMP.rOut + 1) {
      return { ...base, kind: 'vertical', title: 'Rampa helicoidal', text: MATERIAL_TEXT.rampa, meta: ['Esplanada → 8 m → 18 m'] };
    }
  }

  const text = MATERIAL_TEXT[mat.key] || CATEGORY_TEXT[cat?.id] || '';
  return { ...base, kind: 'material', title: mat.name, text, meta: [level.name] };
}

export { CATEGORY_TEXT, isSeatMaterial };
