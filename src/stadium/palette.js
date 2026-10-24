// Paleta de materiais voxel. Cada material tem um id (0 = ar), cor, categoria (sistema)
// e flags opcionais: emissivo (acende no modo Show) e translúcido (vidro, membrana, rede).

export const CATEGORIES = [
  { id: 'estrutura', name: 'Estrutura', color: '#efe3c8' },
  { id: 'assentos', name: 'Assentos', color: '#2f6bff' },
  { id: 'circulacao', name: 'Circulação', color: '#ffd23f' },
  { id: 'vertical', name: 'Escadas, rampas e elevadores', color: '#ff8a1f' },
  { id: 'servicos', name: 'Serviços ao torcedor', color: '#22d3ee' },
  { id: 'operacoes', name: 'Operação e vestiários', color: '#a66bff' },
  { id: 'cobertura', name: 'Cobertura', color: '#f4f7fb' },
  { id: 'campo', name: 'Campo e gramado', color: '#3ccf4e' },
  { id: 'terreno', name: 'Terreno e esplanada', color: '#a8714a' },
  { id: 'instalacoes', name: 'Instalações (água/energia)', color: '#3b82f6' },
  { id: 'fachada', name: 'Fachada e portões', color: '#cfd8e3' },
  { id: 'iluminacao', name: 'Iluminação e telões', color: '#fff3a0' },
];
export const CAT_INDEX = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]));

// [chave, nome, cor, categoria, opções]
const DEFS = [
  // estrutura
  ['concreto', 'Concreto estrutural', '#e9dcc0', 'estrutura'],
  ['concreto_escuro', 'Concreto (vigas e pilares)', '#cdbd9c', 'estrutura'],
  ['laje', 'Laje de piso', '#dccfb4', 'estrutura'],
  ['piso_arquibancada', 'Piso da arquibancada (degrau)', '#f3ead6', 'estrutura'],
  ['parede', 'Parede interna', '#f6efe0', 'estrutura'],
  ['estaca', 'Estaca de fundação', '#9a8f7a', 'estrutura'],
  ['bloco_fundacao', 'Bloco de coroamento', '#b3a68a', 'estrutura'],
  ['vidro', 'Vidro', '#9fd8ff', 'estrutura', { alpha: 0.35 }],
  ['guarda_corpo', 'Guarda-corpo', '#d7dde6', 'estrutura'],

  // assentos (por setor e anel)
  ['assento_oeste_i', 'Assento Oeste (inferior)', '#1f5bff', 'assentos'],
  ['assento_oeste_m', 'Assento Oeste (intermediário)', '#4f86ff', 'assentos'],
  ['assento_oeste_u', 'Assento Oeste (superior)', '#7fa8ff', 'assentos'],
  ['assento_norte_i', 'Assento Norte (inferior)', '#ff2d4b', 'assentos'],
  ['assento_norte_m', 'Assento Norte (intermediário)', '#ff5f76', 'assentos'],
  ['assento_norte_u', 'Assento Norte (superior)', '#ff8b9c', 'assentos'],
  ['assento_leste_i', 'Assento Leste (inferior)', '#10b981', 'assentos'],
  ['assento_leste_m', 'Assento Leste (intermediário)', '#34d399', 'assentos'],
  ['assento_leste_u', 'Assento Leste (superior)', '#6ee7b7', 'assentos'],
  ['assento_sul_i', 'Assento Sul (inferior)', '#ff7a00', 'assentos'],
  ['assento_sul_m', 'Assento Sul (intermediário)', '#ff9a3d', 'assentos'],
  ['assento_sul_u', 'Assento Sul (superior)', '#ffbb77', 'assentos'],
  ['assento_canto_i', 'Assento de canto (inferior)', '#8b5cf6', 'assentos'],
  ['assento_canto_m', 'Assento de canto (intermediário)', '#a78bfa', 'assentos'],
  ['assento_canto_u', 'Assento de canto (superior)', '#c4b5fd', 'assentos'],
  ['assento_visitante', 'Assento do setor visitante', '#ffe14d', 'assentos'],
  ['assento_camarote', 'Poltrona de camarote', '#d4a017', 'assentos'],
  ['espaco_pcd', 'Espaço para cadeira de rodas (PCD)', '#0ea5e9', 'assentos'],

  // circulação
  ['piso_circulacao', 'Piso do concourse', '#ffd84d', 'circulacao'],
  ['degrau_corredor', 'Degrau do corredor da arquibancada', '#ffe680', 'circulacao'],
  ['piso_vomitorio', 'Piso do vomitório', '#ffc21a', 'circulacao'],
  ['corredor_servico', 'Corredor de serviço (anel técnico)', '#f2c94c', 'circulacao'],
  ['piso_camarote', 'Corredor dos camarotes', '#ffe9a8', 'circulacao'],
  ['tunel_jogadores', 'Piso do túnel dos jogadores', '#ffb703', 'circulacao'],

  // circulação vertical
  ['escada', 'Escada', '#ff8a1f', 'vertical'],
  ['rampa', 'Rampa helicoidal', '#ff9f43', 'vertical'],
  ['elevador_cabine', 'Cabine de elevador', '#ff6b00', 'vertical'],
  ['poco_elevador', 'Poço de elevador (vidro)', '#ffb27a', 'vertical', { alpha: 0.4 }],
  ['escada_rolante', 'Escada rolante', '#ff7b29', 'vertical'],
  ['corrimao', 'Corrimão', '#ffd1a6', 'vertical'],

  // serviços
  ['bar', 'Bar e lanchonete', '#22d3ee', 'servicos'],
  ['balcao', 'Balcão de atendimento', '#0891b2', 'servicos'],
  ['banheiro', 'Banheiro', '#67e8f9', 'servicos'],
  ['louca', 'Louça sanitária', '#ffffff', 'servicos'],
  ['primeiros_socorros', 'Posto de primeiros socorros', '#f43f5e', 'servicos'],
  ['loja', 'Loja oficial', '#06b6d4', 'servicos'],
  ['mesa', 'Mesas do lounge', '#7dd3fc', 'servicos'],
  ['bilheteria', 'Bilheteria', '#0ea5b7', 'servicos'],

  // operações
  ['vestiario', 'Piso do vestiário', '#a66bff', 'operacoes'],
  ['armario', 'Armários dos atletas', '#7c3aed', 'operacoes'],
  ['banco_vestiario', 'Banco do vestiário', '#c4a1ff', 'operacoes'],
  ['chuveiro', 'Área de chuveiros', '#b794f4', 'operacoes'],
  ['maca', 'Maca de fisioterapia', '#e9d5ff', 'operacoes'],
  ['sala_imprensa', 'Sala de imprensa', '#8b5cf6', 'operacoes'],
  ['cadeira_imprensa', 'Cadeiras da coletiva', '#ddd6fe', 'operacoes'],
  ['cabine_tv', 'Cabine de rádio e TV', '#9f7aea', 'operacoes'],
  ['controle', 'Centro de controle e segurança', '#6d28d9', 'operacoes'],
  ['monitor', 'Telas de monitoramento', '#38bdf8', 'operacoes', { emissive: 0.8 }],
  ['deposito', 'Depósito', '#9d8bc4', 'operacoes'],
  ['carro', 'Veículo', '#475569', 'operacoes'],
  ['carro_vermelho', 'Veículo', '#dc2626', 'operacoes'],
  ['carro_branco', 'Veículo', '#f1f5f9', 'operacoes'],
  ['onibus', 'Ônibus da delegação', '#2563eb', 'operacoes'],
  ['vaga', 'Piso do estacionamento', '#8e88a8', 'operacoes'],
  ['faixa_vaga', 'Faixa de vaga', '#f8fafc', 'operacoes'],
  ['cozinha', 'Cozinha central', '#c084fc', 'operacoes'],
  ['inox', 'Bancada inox', '#e2e8f0', 'operacoes'],
  ['doca', 'Doca de carga', '#7e6fa8', 'operacoes'],
  ['trator', 'Trator do gramado', '#16a34a', 'operacoes'],

  // cobertura
  ['trelica', 'Treliça metálica da cobertura', '#f1f5f9', 'cobertura'],
  ['trelica_escura', 'Banzo da treliça', '#cbd5e1', 'cobertura'],
  ['membrana', 'Membrana translúcida', '#ffffff', 'cobertura', { alpha: 0.42 }],
  ['passarela', 'Passarela técnica', '#94a3b8', 'cobertura'],
  ['calha', 'Calha de água pluvial', '#60a5fa', 'cobertura'],

  // campo
  ['grama_a', 'Gramado (faixa clara)', '#3ccf4e', 'campo'],
  ['grama_b', 'Gramado (faixa escura)', '#2fb042', 'campo'],
  ['grama_entorno', 'Gramado do entorno do campo', '#279a3a', 'campo'],
  ['linha', 'Marcação do campo', '#ffffff', 'campo'],
  ['trave', 'Trave do gol', '#ffffff', 'campo'],
  ['rede', 'Rede do gol', '#e5e7eb', 'campo', { alpha: 0.5 }],
  ['bandeira', 'Bandeirinha de escanteio', '#facc15', 'campo'],
  ['zona_raizes', 'Zona de raízes (areia + fibras)', '#d9b76a', 'campo'],
  ['transicao', 'Camada de transição (areia grossa)', '#c49a52', 'campo'],
  ['brita', 'Brita drenante', '#9ca3af', 'campo'],
  ['subleito', 'Subleito compactado', '#8a6a46', 'campo'],
  ['banco_reservas', 'Banco de reservas', '#1e3a8a', 'campo'],
  ['cobertura_banco', 'Cobertura do banco de reservas', '#bfdbfe', 'campo', { alpha: 0.55 }],

  // terreno
  ['terra', 'Terra vegetal', '#7a4f2e', 'terreno'],
  ['solo', 'Solo arenoso', '#b98a57', 'terreno'],
  ['argila', 'Argila', '#c46a3a', 'terreno'],
  ['rocha', 'Rocha', '#7c7f87', 'terreno'],
  ['aterro', 'Aterro compactado', '#a07850', 'terreno'],
  ['piso_esplanada', 'Piso da esplanada', '#d6d3cc', 'terreno'],
  ['piso_esplanada_b', 'Piso da esplanada (detalhe)', '#b8b2a6', 'terreno'],
  ['jardim', 'Jardim', '#4ade80', 'terreno'],
  ['tronco', 'Tronco de árvore', '#7c4a24', 'terreno'],
  ['copa', 'Copa de árvore', '#22c55e', 'terreno'],
  ['copa_b', 'Copa de árvore (flores)', '#f472b6', 'terreno'],
  ['base_maquete', 'Base da maquete', '#1f2433', 'terreno'],
  ['placa', 'Placa da maquete', '#e8c66a', 'terreno', { emissive: 0.2 }],
  ['asfalto', 'Asfalto', '#4b5563', 'terreno'],

  // instalações
  ['tubo_drenagem', 'Tubo de drenagem', '#3b82f6', 'instalacoes'],
  ['tubo_aquecimento', 'Tubo de aquecimento do gramado', '#ef4444', 'instalacoes'],
  ['aspersor', 'Aspersor de irrigação', '#93c5fd', 'instalacoes'],
  ['reservatorio', 'Reservatório de água', '#2563eb', 'instalacoes'],
  ['agua', 'Água de reuso', '#60a5fa', 'instalacoes', { alpha: 0.6 }],
  ['gerador', 'Gerador de energia', '#facc15', 'instalacoes'],
  ['subestacao', 'Subestação elétrica', '#f97316', 'instalacoes'],
  ['bomba', 'Bombas hidráulicas', '#1d4ed8', 'instalacoes'],
  ['duto', 'Duto de ar-condicionado', '#cbd5e1', 'instalacoes'],

  // fachada
  ['brise', 'Brise da fachada', '#e2e8f0', 'fachada'],
  ['fachada_led', 'Painel LED da fachada', '#7dd3fc', 'fachada', { emissive: 1.0 }],
  ['vidro_fachada', 'Pele de vidro', '#a5d8ff', 'fachada', { alpha: 0.3 }],
  ['portao', 'Portão', '#334155', 'fachada'],
  ['catraca', 'Catraca', '#f59e0b', 'fachada'],
  ['pilar_fachada', 'Pilar da fachada / mastro da cobertura', '#d1d5db', 'fachada'],

  // iluminação
  ['refletor', 'Refletor LED', '#fffbe6', 'iluminacao', { emissive: 1.4 }],
  ['telao', 'Telão', '#111827', 'iluminacao', { emissive: 1.0, screen: true }],
  ['placa_led', 'Placa de publicidade LED', '#0f172a', 'iluminacao', { emissive: 1.0, screen: true }],
  ['poste', 'Poste de iluminação', '#9ca3af', 'iluminacao'],
  ['luminaria', 'Luminária', '#fef9c3', 'iluminacao', { emissive: 1.2 }],
];

export const MATERIALS = [{ key: 'ar', name: 'Ar', color: '#000000', cat: -1, alpha: 0, emissive: 0 }];
export const MAT = { ar: 0 };
for (const [key, name, color, cat, opt = {}] of DEFS) {
  MAT[key] = MATERIALS.length;
  MATERIALS.push({
    key,
    name,
    color,
    cat: CAT_INDEX[cat],
    alpha: opt.alpha ?? 1,
    emissive: opt.emissive ?? 0,
    screen: !!opt.screen,
  });
}
if (MATERIALS.length > 255) throw new Error('Paleta excede 255 materiais');

/** Tabelas rápidas por id para o worker e o mesher. */
export const MAT_CAT = new Uint8Array(256).fill(255);
export const MAT_TRANSLUCENT = new Uint8Array(256);
MATERIALS.forEach((m, i) => {
  if (i === 0) return;
  MAT_CAT[i] = m.cat;
  MAT_TRANSLUCENT[i] = m.alpha < 1 ? 1 : 0;
});

export function isSeatMaterial(id) {
  return MAT_CAT[id] === CAT_INDEX.assentos && id !== MAT.espaco_pcd && id !== MAT.assento_camarote;
}
