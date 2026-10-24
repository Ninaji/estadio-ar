# Arena Aurora — estádio voxel em AR

Maquete voxel de um estádio de futebol fictício e completo, para ver em **realidade aumentada no chão** (Android e iPhone) ou em **3D girando com o dedo**, direto no navegador.

**▶ Abrir:** https://ninaji.github.io/estadio-ar/

## O que dá para fazer

- **Posicionar no chão (AR)** — aponte para o piso, escolha a escala (1:500, 1:300, 1:150) e toque em *Posicionar estádio*. Pinça para escalar, dois dedos para girar.
- **Planta, Seção e Fatia** — corte horizontal por pavimento, corte vertical e a "fatia de torta" que remove uma cunha. As faces de corte são voxels de verdade: concreto, circulação, assentos, gramado e solo aparecem como camadas de bolo.
- **Níveis e Pedaços** — desmonta a arena em 7 camadas (fundações → cobertura) ou em 4 pedaços.
- **Camadas e Raio-X** — liga/desliga cada sistema (estrutura, assentos, circulação, serviços, operação, cobertura, instalações…).
- **Toque em qualquer parte** — vestiários, cabines de TV, drenagem do gramado, treliças da cobertura, rampas, catracas… cada uma com explicação.
- **Rota até o assento** — escolha anel, setor, fila e assento: a rota 3D animada sai do portão, passa pela catraca, concourse, escadas/elevador/rampa, vomitório e corredor até a cadeira. Modo acessível sem escadas.
- **Show** — noite de jogo com refletores, telões, fachada de LED, torcida fazendo ola, mini partida, gol e fogos (sons sintetizados).

## A arena

~49,5 mil lugares em 3 anéis, campo 105 × 68 m rebaixado 6 m, subsolo com vestiários, sala de imprensa, CCO, estacionamento, geradores e cozinha; nível clube com camarotes e cabines de imprensa; concourse superior; cobertura em treliças com membrana translúcida; 4 rampas helicoidais, 7 escadas, 4 elevadores, escadas rolantes e 12 portões. Tudo gerado proceduralmente a partir de `src/stadium/spec.js` em voxels de 0,5 m (~5,4 milhões).

## Tecnologia

- [three.js](https://threejs.org) + [GSAP](https://gsap.com), JavaScript puro com [Vite](https://vite.dev).
- Geração e malha voxel num Web Worker: greedy meshing com oclusão ambiente, faces agrupadas por nível × quadrante, tampas de corte calculadas ao vivo.
- AR: WebXR `immersive-ar` (Android/ARCore); [8th Wall Engine](https://8thwall.org) (iPhone Safari e Android sem ARCore); câmera + giroscópio como alternativa.
- Sons 100% sintetizados com Web Audio.

```bash
npm install
npm run dev          # http://localhost:5173
HTTPS=1 npm run dev  # para testar câmera/AR no celular pela rede local
npm test
npm run build
```

`?qualidade=leve` usa voxels de 1 m (mais leve); `?debug` mostra fps e triângulos.

## Créditos e licenças

Código do projeto sob licença MIT.

O rastreamento de chão no iPhone usa o **8th Wall Engine** (binário distribuído), © Niantic Spatial, Inc., carregado sem modificações de `cdn.jsdelivr.net/npm/@8thwall/engine-binary@1.0.0`, sob o [XR Engine License Agreement](https://github.com/8thwall/engine/blob/main/LICENSE). O software é fornecido "como está", sem garantias. Este projeto é gratuito e não é afiliado à Niantic Spatial.
