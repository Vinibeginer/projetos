// ===== 18-eletrica.js — projeto elétrico (NBR 5410): pontos, circuitos, dimensionamento e camada "Elétrica" =====
// Fonte única do anteprojeto elétrico, como o 17-hidro.js no hidrossanitário:
//   • eletrica.html (plantas, 3D, quadro de cargas, materiais e pranchas em PDF) carrega este arquivo;
//   • o estúdio desenha pontos e eletrodutos por cima da casa quando a camada "Elétrica" está ligada (ui.show.eletrica).
// Os pontos (PONTOS) são gerados por tools/gera-eletrica.js a partir dos ambientes da planta, pelas regras da
// NBR 5410:2004 (9.5.2); circuitos, fases, seções, disjuntores, DR e queda de tensão são calculados aqui.
// Coordenadas em mm no sistema do estúdio; z = altura do ponto sobre o piso acabado do pavimento.
(function () {
  const DD = (window.DD = window.DD || {});

  // ================================================================================================ dados
  const LEVEL = { T: 0, 1: 2880, 2: 5760 };
  const TETO = 2780;            // face inferior da laje (os eletrodutos correm na laje e descem nas paredes)
  const VFN = 127, VFF = 220;   // Enel RJ (Campos dos Goytacazes): 127/220 V
  const RHO = 0.0225;           // Ω·mm²/m — cobre a 70 °C (queda de tensão em operação)
  const DV_MAX = 4, DV_TOTAL = 5; // % — circuitos terminais; total do padrão ao ponto (NBR 5410 6.2.7)
  const ALIM_SECAO = 16;          // mm² — seção mínima do ramal principal definida pela obra (sobe se a demanda passar)
  const FCA = 0.7;              // agrupamento: até 3 circuitos por eletroduto (Tabela 42)
  const FCT = 1.0;              // 30 °C (Tabela 40, PVC)
  const QDC_XY = { x: 5925, y: 8750 }; // QDC à direita da porta do quarto do térreo (parede do quarto, lado da sala)
  // Um quadro trifásico por andar: os circuitos de cada pavimento saem do quadro do próprio pavimento (caminhos curtos,
  // sem uma prumada por circuito); o QDC do térreo recebe o alimentador, tem o geral, o DPS e alimenta o QD-1 e o QD-2.
  const BOARDS = {
    T: { id: 'QDC', fl: 'T', x: QDC_XY.x, y: QDC_XY.y, nome: 'QDC — térreo (geral)' },
    1: { id: 'QD-1', fl: '1', x: 5925, y: 8750, nome: 'QD-1 — 1º pavimento' },
    2: { id: 'QD-2', fl: '2', x: 7100, y: 8600, nome: 'QD-2 — 2º pavimento' },
  };
  const RISER = { T: BOARDS.T, 1: BOARDS[1], 2: BOARDS[2] };
  // alimentadores dos quadros de andar, a partir do QDC (saem pelo topo do QDC, z = 1,85 m)
  const SUB_ROUTE = {
    1: [[5925, 8750, 1850], [5925, 8750, 2880 + 1150]], // sobe na mesma parede direto para o QD-1
    2: [[5925, 8750, 1850], [5925, 8750, 5760 - 100], [7100, 8750, 5760 - 100], [7100, 8675, 5760 - 100], [7100, 8675, 5760 + 1150]], // na laje do 2º até a parede da escada
  };
  const FCA_SUB = 0.8;
  // Área coberta por laje em cada pavimento (os eletrodutos correm na laje do teto). Pontos fora dela — motor do
  // portão no muro da frente, arandelas nos muros da varanda descoberta — são ligados POR BAIXO: enterrados no térreo
  // (−0,40 m, eletroduto PEAD) ou no contrapiso do 2º, saindo do quadro do andar.
  const COBERTO = { T: [[1500, 2850, 8925, 10500], [75, 10425, 8925, 15000]], 1: [[1500, 2850, 8925, 10500], [75, 10425, 8925, 16100]], 2: [[1500, 2850, 8925, 10500]] };
  const coberto = (p) => COBERTO[p.fl].some((r) => p.x >= r[0] - 1 && p.x <= r[2] + 1 && p.y >= r[1] - 1 && p.y <= r[3] + 1);
  const Z_BAIXO = { T: -400, 1: -50, 2: -50 }; // profundidade do eletroduto por baixo: vala no térreo, contrapiso acima // os dois alimentadores sobem juntos até o 1º (Tabela 42, 2 circuitos)
  // alimentador: padrão (quina do muro esquerdo com o da frente) → enterrado a −0,40 m até a parede do lavabo (lado da
  // garagem) → sobe na parede até a laje do térreo → corre na laje → desce no QDC
  const ALIM_ROUTE = [[400, 19850, 1500], [400, 19850, -400], [400, 19650, -400], [2800, 19650, -400], [2800, 10425, -400], [2800, 10425, TETO], [5925, 10425, TETO], [5925, 8750, TETO], [5925, 8750, 1850]];
  // fibra / rede: caixa de entrada no muro esquerdo → vala paralela, 20 cm ao lado → caixa de passagem na parede do
  // lavabo → laje → quadro de telecom (QDT) sob a escada; distribuição Cat6 em eletrodutos próprios
  const QDT_XY = { x: 6650, y: 8750 };
  const TEL_ROUTE = [[150, 19300, 1500], [150, 19300, -400], [150, 19450, -400], [2600, 19450, -400], [2600, 10500, -400], [2600, 10500, 300], [2600, 10425, 300], [2600, 10425, TETO], [2600, 9800, TETO], [6650, 9800, TETO], [6650, 8750, TETO], [6650, 8750, 1700]];
  const TEL_RISER = { T: QDT_XY, 1: QDT_XY, 2: QDT_XY };

  // <PONTOS> gerado por tools/gera-eletrica.js — não editar à mão
  const PONTOS = [
    {id: "T-IL1", fl: "T", k: "il", tipo: "teto", amb: "Cozinha", x: 2900, y: 5800, z: 2780, va: 220, desc: "Ponto de luz no teto — Cozinha"},
    {id: "T-S1", fl: "T", k: "int", amb: "Cozinha", x: 3025, y: 3000, z: 1100, liga: ["T-IL1"], desc: "Interruptor simples — Cozinha"},
    {id: "T-T1", fl: "T", k: "tug", amb: "Cozinha", x: 1650, y: 5800, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Cozinha"},
    {id: "T-T2", fl: "T", k: "tug", amb: "Cozinha", x: 1650, y: 6500, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Cozinha"},
    {id: "T-T3", fl: "T", k: "tug", amb: "Cozinha", x: 1650, y: 4200, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Cozinha"},
    {id: "T-T4", fl: "T", k: "tug", amb: "Cozinha", x: 4150, y: 4850, z: 300, va: 100, molhada: true, desc: "TUG — Cozinha"},
    {id: "T-T5", fl: "T", k: "tug", amb: "Cozinha", x: 1650, y: 6300, z: 300, va: 100, molhada: true, desc: "TUG — Cozinha"},
    {id: "T-IL2", fl: "T", k: "il", tipo: "teto", amb: "Desp.", x: 4600, y: 3800, z: 2780, va: 100, desc: "Ponto de luz no teto — Desp."},
    {id: "T-S2", fl: "T", k: "int", amb: "Desp.", x: 4300, y: 3575, z: 1100, liga: ["T-IL2"], desc: "Interruptor simples — Desp."},
    {id: "T-T6", fl: "T", k: "tug", amb: "Desp.", x: 4900, y: 4300, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Desp."},
    {id: "T-IL3", fl: "T", k: "il", tipo: "teto", amb: "Suíte", x: 6200, y: 3800, z: 2780, va: 100, desc: "Ponto de luz no teto — Suíte"},
    {id: "T-S3", fl: "T", k: "int", amb: "Suíte", x: 6375, y: 4600, z: 1100, liga: ["T-IL3"], desc: "Interruptor simples — Suíte"},
    {id: "T-T7", fl: "T", k: "tug", amb: "Suíte", x: 5050, y: 3780, z: 1100, va: 600, molhada: true, desc: "TUG junto ao lavatório (≥ 0,60 m do box) — Suíte"},
    {id: "T-IL4", fl: "T", k: "il", tipo: "teto", amb: "Quarto", x: 5825, y: 6675, z: 2780, va: 160, desc: "Ponto de luz no teto — Quarto"},
    {id: "T-S4", fl: "T", k: "int", amb: "Quarto", x: 5600, y: 8600, z: 1100, liga: ["T-IL4"], desc: "Interruptor simples — Quarto"},
    {id: "T-T8", fl: "T", k: "tug", amb: "Quarto", x: 7350, y: 5050, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto"},
    {id: "T-T9", fl: "T", k: "tug", amb: "Quarto", x: 7050, y: 8600, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto"},
    {id: "T-T10", fl: "T", k: "tug", amb: "Quarto", x: 4300, y: 7050, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto"},
    {id: "T-AC1", fl: "T", k: "tue", eq: "ac", amb: "Quarto", x: 7350, y: 7445, z: 2200, va: 1500, v: 220, desc: "Ar-condicionado split 12.000 BTU/h (1.500 VA, 220 V) — Quarto"},
    {id: "T-IL5", fl: "T", k: "il", tipo: "teto", amb: "Lav.", x: 2325, y: 9550, z: 2780, va: 100, desc: "Ponto de luz no teto — Lav."},
    {id: "T-S5", fl: "T", k: "int", amb: "Lav.", x: 3000, y: 9725, z: 1100, liga: ["T-IL5"], desc: "Interruptor simples — Lav."},
    {id: "T-T11", fl: "T", k: "tug", amb: "Lav.", x: 1700, y: 8750, z: 1100, va: 600, molhada: true, desc: "TUG junto ao lavatório (≥ 0,60 m do box) — Lav."},
    {id: "T-IL6", fl: "T", k: "il", tipo: "teto", amb: "Sala", x: 6000, y: 10580, z: 2780, va: 200, desc: "Ponto de luz no teto — Sala"},
    {id: "T-IL7", fl: "T", k: "il", tipo: "teto", amb: "Sala", x: 6000, y: 13020, z: 2780, va: 200, desc: "Ponto de luz no teto — Sala"},
    {id: "T-S6", fl: "T", k: "int", amb: "Sala", x: 6350, y: 14850, z: 1100, liga: ["T-IL6","T-IL7"], desc: "Interruptor simples — Sala"},
    {id: "T-T12", fl: "T", k: "tug", amb: "Sala", x: 7210, y: 8750, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Sala"},
    {id: "T-T13", fl: "T", k: "tug", amb: "Sala", x: 8850, y: 10280, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Sala"},
    {id: "T-T14", fl: "T", k: "tug", amb: "Sala", x: 6550, y: 14850, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Sala"},
    {id: "T-T15", fl: "T", k: "tug", amb: "Sala", x: 4300, y: 14530, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Sala"},
    {id: "T-T16", fl: "T", k: "tug", amb: "Sala", x: 4300, y: 10860, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Sala"},
    {id: "T-IL8", fl: "T", k: "il", tipo: "teto", amb: "Garagem", x: 2150, y: 11850, z: 2780, va: 140, desc: "Ponto de luz no teto — Garagem"},
    {id: "T-IL9", fl: "T", k: "il", tipo: "teto", amb: "Garagem", x: 2150, y: 13650, z: 2780, va: 140, desc: "Ponto de luz no teto — Garagem"},
    {id: "T-S7", fl: "T", k: "int", amb: "Garagem", x: 3050, y: 10500, z: 1100, liga: ["T-IL8","T-IL9"], desc: "Interruptor simples — Garagem"},
    {id: "T-T17", fl: "T", k: "tug", amb: "Garagem", x: 4150, y: 11350, z: 300, va: 100, molhada: true, externa: false, desc: "TUG — Garagem"},
    {id: "T-T18", fl: "T", k: "tug", amb: "Garagem", x: 150, y: 14550, z: 300, va: 100, molhada: true, externa: false, desc: "TUG — Garagem"},
    {id: "1-IL1", fl: "1", k: "il", tipo: "teto", amb: "Closet", x: 2900, y: 3800, z: 2780, va: 100, desc: "Ponto de luz no teto — Closet"},
    {id: "1-S1", fl: "1", k: "int", amb: "Closet", x: 3050, y: 4600, z: 1100, liga: ["1-IL1"], desc: "Interruptor simples — Closet"},
    {id: "1-T1", fl: "1", k: "tug", amb: "Closet", x: 3700, y: 3000, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Closet"},
    {id: "1-T2", fl: "1", k: "tug", amb: "Closet", x: 2100, y: 4600, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Closet"},
    {id: "1-IL2", fl: "1", k: "il", tipo: "teto", amb: "Closet", x: 5825, y: 3800, z: 2780, va: 100, desc: "Ponto de luz no teto — Closet"},
    {id: "1-S2", fl: "1", k: "int", amb: "Closet", x: 5325, y: 4600, z: 1100, liga: ["1-IL2"], desc: "Interruptor simples — Closet"},
    {id: "1-T3", fl: "1", k: "tug", amb: "Closet", x: 6625, y: 3000, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Closet"},
    {id: "1-T4", fl: "1", k: "tug", amb: "Closet", x: 4300, y: 4275, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Closet"},
    {id: "1-IL3", fl: "1", k: "il", tipo: "teto", amb: "Quarto Master", x: 4284, y: 6675, z: 2780, va: 110, desc: "Ponto de luz no teto — Quarto Master"},
    {id: "1-IL4", fl: "1", k: "il", tipo: "teto", amb: "Quarto Master", x: 6216, y: 6675, z: 2780, va: 110, desc: "Ponto de luz no teto — Quarto Master"},
    {id: "1-S3", fl: "1", k: "int", amb: "Quarto Master", x: 5450, y: 4750, z: 1100, liga: ["1-IL3","1-IL4"], desc: "Interruptor simples — Quarto Master"},
    {id: "1-T5", fl: "1", k: "tug", amb: "Quarto Master", x: 6213, y: 4750, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto Master"},
    {id: "1-T6", fl: "1", k: "tug", amb: "Quarto Master", x: 7350, y: 7038, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto Master"},
    {id: "1-T7", fl: "1", k: "tug", amb: "Quarto Master", x: 5338, y: 8600, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto Master"},
    {id: "1-T8", fl: "1", k: "tug", amb: "Quarto Master", x: 3150, y: 6763, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto Master"},
    {id: "1-AC1", fl: "1", k: "tue", eq: "ac", amb: "Quarto Master", x: 7350, y: 7750, z: 2200, va: 1500, v: 220, desc: "Ar-condicionado split 12.000 BTU/h (1.500 VA, 220 V) — Quarto Master — parede lateral, depois da janela"},
    {id: "1-IL5", fl: "1", k: "il", tipo: "teto", amb: "Suíte", x: 2325, y: 6125, z: 2780, va: 100, desc: "Ponto de luz no teto — Suíte"},
    {id: "1-S4", fl: "1", k: "int", amb: "Suíte", x: 3000, y: 5775, z: 1100, liga: ["1-IL5"], desc: "Interruptor simples — Suíte"},
    {id: "1-T9", fl: "1", k: "tug", amb: "Suíte", x: 1650, y: 4750, z: 1100, va: 600, molhada: true, desc: "TUG junto ao lavatório (≥ 0,60 m do box) — Suíte"},
    {id: "1-IL6", fl: "1", k: "il", tipo: "teto", amb: "Banhº", x: 2325, y: 9000, z: 2780, va: 100, desc: "Ponto de luz no teto — Banhº"},
    {id: "1-S5", fl: "1", k: "int", amb: "Banhº", x: 3000, y: 9325, z: 1100, liga: ["1-IL6"], desc: "Interruptor simples — Banhº"},
    {id: "1-T10", fl: "1", k: "tug", amb: "Banhº", x: 1650, y: 9620, z: 1100, va: 600, molhada: true, desc: "TUG junto ao lavatório (≥ 0,60 m do box) — Banhº"},
    {id: "1-IL7", fl: "1", k: "il", tipo: "teto", amb: "Circulação", x: 6000, y: 9550, z: 2780, va: 100, desc: "Ponto de luz no teto — Circulação"},
    {id: "1-S6", fl: "1", k: "int", amb: "Circulação", x: 3150, y: 9325, z: 1100, liga: ["1-IL7"], desc: "Interruptor simples — Circulação"},
    {id: "1-T11", fl: "1", k: "tug", amb: "Circulação", x: 4600, y: 8750, z: 300, va: 100, molhada: true, externa: false, desc: "TUG — Circulação"},
    {id: "1-T12", fl: "1", k: "tug", amb: "Circulação", x: 5500, y: 10350, z: 300, va: 100, molhada: true, externa: false, desc: "TUG — Circulação"},
    {id: "1-IL8", fl: "1", k: "il", tipo: "teto", amb: "Quarto 1", x: 2150, y: 11805, z: 2780, va: 110, desc: "Ponto de luz no teto — Quarto 1"},
    {id: "1-IL9", fl: "1", k: "il", tipo: "teto", amb: "Quarto 1", x: 2150, y: 13545, z: 2780, va: 110, desc: "Ponto de luz no teto — Quarto 1"},
    {id: "1-S7", fl: "1", k: "int", amb: "Quarto 1", x: 3700, y: 14850, z: 1100, liga: ["1-IL8","1-IL9"], desc: "Interruptor simples — Quarto 1"},
    {id: "1-T13", fl: "1", k: "tug", amb: "Quarto 1", x: 2238, y: 10500, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 1"},
    {id: "1-T14", fl: "1", k: "tug", amb: "Quarto 1", x: 4150, y: 12663, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 1"},
    {id: "1-T15", fl: "1", k: "tug", amb: "Quarto 1", x: 2463, y: 14850, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 1"},
    {id: "1-T16", fl: "1", k: "tug", amb: "Quarto 1", x: 150, y: 12588, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 1"},
    {id: "1-AC2", fl: "1", k: "tue", eq: "ac", amb: "Quarto 1", x: 1700, y: 14850, z: 2450, va: 1500, v: 220, desc: "Ar-condicionado split 12.000 BTU/h (1.500 VA, 220 V) — Quarto 1 — acima da janela (fachada)"},
    {id: "1-IL10", fl: "1", k: "il", tipo: "teto", amb: "Quarto 2", x: 5529, y: 12675, z: 2780, va: 140, desc: "Ponto de luz no teto — Quarto 2"},
    {id: "1-IL11", fl: "1", k: "il", tipo: "teto", amb: "Quarto 2", x: 7622, y: 12675, z: 2780, va: 140, desc: "Ponto de luz no teto — Quarto 2"},
    {id: "1-S8", fl: "1", k: "int", amb: "Quarto 2", x: 7400, y: 14850, z: 1100, liga: ["1-IL10","1-IL11"], desc: "Interruptor simples — Quarto 2"},
    {id: "1-T17", fl: "1", k: "tug", amb: "Quarto 2", x: 6525, y: 10500, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 2"},
    {id: "1-T18", fl: "1", k: "tug", amb: "Quarto 2", x: 8850, y: 12625, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 2"},
    {id: "1-T19", fl: "1", k: "tug", amb: "Quarto 2", x: 7625, y: 14850, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 2"},
    {id: "1-T20", fl: "1", k: "tug", amb: "Quarto 2", x: 4300, y: 11675, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 2"},
    {id: "1-AC3", fl: "1", k: "tue", eq: "ac", amb: "Quarto 2", x: 8000, y: 14850, z: 2200, va: 1500, v: 220, desc: "Ar-condicionado split 12.000 BTU/h (1.500 VA, 220 V) — Quarto 2 — fachada, à direita da janela"},
    {id: "1-IL12", fl: "1", k: "il", tipo: "teto", amb: "Varanda", x: 4500, y: 15525, z: 2780, va: 100, desc: "Ponto de luz no teto — Varanda"},
    {id: "1-S9", fl: "1", k: "int", amb: "Varanda", x: 3700, y: 15000, z: 1100, liga: ["1-IL12"], desc: "Interruptor simples — Varanda"},
    {id: "1-T21", fl: "1", k: "tug", amb: "Varanda", x: 4725, y: 15000, z: 300, va: 100, molhada: true, externa: true, desc: "TUG — Varanda"},
    {id: "1-T22", fl: "1", k: "tug", amb: "Varanda", x: 150, y: 15825, z: 300, va: 100, molhada: true, externa: true, desc: "TUG — Varanda"},
    {id: "2-IL1", fl: "2", k: "il", tipo: "teto", amb: "Varanda coberta", x: 3450, y: 4838, z: 2780, va: 150, desc: "Ponto de luz no teto — Varanda coberta"},
    {id: "2-IL2", fl: "2", k: "il", tipo: "teto", amb: "Varanda coberta", x: 7050, y: 4838, z: 2780, va: 150, desc: "Ponto de luz no teto — Varanda coberta"},
    {id: "2-IL3", fl: "2", k: "il", tipo: "teto", amb: "Varanda coberta", x: 3450, y: 8513, z: 2780, va: 150, desc: "Ponto de luz no teto — Varanda coberta"},
    {id: "2-IL4", fl: "2", k: "il", tipo: "teto", amb: "Varanda coberta", x: 7050, y: 8513, z: 2780, va: 150, desc: "Ponto de luz no teto — Varanda coberta"},
    {id: "2-S1", fl: "2", k: "int", amb: "Varanda coberta", x: 5450, y: 10350, z: 1100, liga: ["2-IL1","2-IL2","2-IL3","2-IL4"], desc: "Interruptor simples — Varanda coberta"},
    {id: "2-T1", fl: "2", k: "tug", amb: "Varanda coberta", x: 1650, y: 6200, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Varanda coberta"},
    {id: "2-T2", fl: "2", k: "tug", amb: "Varanda coberta", x: 1650, y: 6500, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Varanda coberta"},
    {id: "2-T3", fl: "2", k: "tug", amb: "Varanda coberta", x: 1650, y: 3800, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Varanda coberta"},
    {id: "2-T4", fl: "2", k: "tug", amb: "Varanda coberta", x: 5958, y: 3000, z: 300, va: 100, molhada: true, desc: "TUG — Varanda coberta"},
    {id: "2-T5", fl: "2", k: "tug", amb: "Varanda coberta", x: 6478, y: 8600, z: 300, va: 100, molhada: true, desc: "TUG — Varanda coberta"},
    {id: "2-T6", fl: "2", k: "tug", amb: "Varanda coberta", x: 3150, y: 10023, z: 300, va: 100, molhada: true, desc: "TUG — Varanda coberta"},
    {id: "2-T7", fl: "2", k: "tug", amb: "Varanda coberta", x: 1650, y: 7458, z: 300, va: 100, molhada: true, desc: "TUG — Varanda coberta"},
    {id: "2-IL5", fl: "2", k: "il", tipo: "teto", amb: "Lav.", x: 2325, y: 9550, z: 2780, va: 100, desc: "Ponto de luz no teto — Lav."},
    {id: "2-S2", fl: "2", k: "int", amb: "Lav.", x: 3000, y: 9700, z: 1100, liga: ["2-IL5"], desc: "Interruptor simples — Lav."},
    {id: "2-T8", fl: "2", k: "tug", amb: "Lav.", x: 1650, y: 8850, z: 1100, va: 600, molhada: true, desc: "TUG junto ao lavatório (≥ 0,60 m do box) — Lav."},
    {id: "2-IL6", fl: "2", k: "il", tipo: "arandela", amb: "Varanda descoberta", x: 5550, y: 10500, z: 2200, va: 180, desc: "Arandela — Varanda descoberta"},
    {id: "2-IL7", fl: "2", k: "il", tipo: "arandela", amb: "Varanda descoberta", x: 8850, y: 14550, z: 2200, va: 180, desc: "Arandela — Varanda descoberta"},
    {id: "2-IL8", fl: "2", k: "il", tipo: "arandela", amb: "Varanda descoberta", x: 150, y: 14550, z: 2200, va: 180, desc: "Arandela — Varanda descoberta"},
    {id: "2-S3", fl: "2", k: "int", amb: "Varanda descoberta", x: 5450, y: 10500, z: 1100, liga: ["2-IL6","2-IL7","2-IL8"], desc: "Interruptor simples — Varanda descoberta"},
    {id: "2-T9", fl: "2", k: "tug", amb: "Varanda descoberta", x: 6450, y: 10500, z: 600, va: 100, molhada: true, externa: true, desc: "TUG externa (IP44) — Varanda descoberta"},
    {id: "T-CH1", fl: "T", k: "tue", eq: "chuveiro", amb: "Suíte", x: 6950, y: 2990, z: 2200, va: 6500, v: 220, desc: "Chuveiro elétrico 6.500 W (220 V) — ponto T-CH2"},
    {id: "1-CH1", fl: "1", k: "tue", eq: "chuveiro", amb: "Suíte", x: 2325, y: 7530, z: 2200, va: 6500, v: 220, desc: "Chuveiro elétrico 6.500 W (220 V) — ponto 1-CH-S"},
    {id: "1-CH2", fl: "1", k: "tue", eq: "chuveiro", amb: "Banhº", x: 2325, y: 7620, z: 2200, va: 6500, v: 220, desc: "Chuveiro elétrico 6.500 W (220 V) — ponto 1-CH-B"},
    {id: "2-ML1", fl: "2", k: "tue", eq: "mlr", amb: "Área de serviço", x: 2100, y: 8610, z: 1100, va: 1200, v: 127, molhada: true, desc: "Máquina de lavar roupa (1.200 VA, 127 V)"},
    {id: "QDC", fl: "T", k: "qdc", amb: "Sala (pé da escada)", x: 5925, y: 8750, z: 1500, desc: "Quadro de distribuição (QDC) — à direita da porta do quarto, parede do quarto (lado da sala)"},
    {id: "QD1", fl: "1", k: "qdc", amb: "Circulação (chegada da escada)", x: 5925, y: 8750, z: 1500, desc: "Quadro de distribuição do 1º (QD-1) — acima do QDC, parede do quarto master (lado da circulação)"},
    {id: "QD2", fl: "2", k: "qdc", amb: "Varanda coberta (parede da escada)", x: 7100, y: 8600, z: 1500, desc: "Quadro de distribuição do 2º (QD-2) — parede da escada, lado da varanda coberta"},
    {id: "PE", fl: "T", k: "medidor", amb: "Muro da frente (quina esquerda)", x: 400, y: 19850, z: 1500, desc: "Padrão de entrada / medição (Enel) com haste de aterramento — quina do muro esquerdo com o da frente"},
    {id: "T-MO1", fl: "T", k: "tue", eq: "microondas", amb: "Cozinha", x: 4150, y: 6900, z: 1600, va: 1500, v: 127, molhada: true, desc: "Micro-ondas / forno (1.500 VA, 127 V)"},
    {id: "T-PT1", fl: "T", k: "tue", eq: "portao", amb: "Garagem (portão)", x: 4400, y: 19850, z: 400, va: 600, v: 127, externa: true, desc: "Motor do portão eletrônico ½ cv (600 VA)"},
    {id: "T-IL-E1", fl: "T", k: "il", tipo: "arandela", amb: "Fachada", x: 4650, y: 15000, z: 2200, va: 100, externa: true, desc: "Arandela externa — fachada, ao lado da porta"},
    {id: "T-IL-E2", fl: "T", k: "il", tipo: "arandela", amb: "Fachada", x: 6450, y: 15000, z: 2200, va: 100, externa: true, desc: "Arandela externa — fachada"},
    {id: "T-IL-E3", fl: "T", k: "il", tipo: "arandela", amb: "Quintal", x: 3950, y: 2850, z: 2200, va: 100, externa: true, desc: "Arandela externa — quintal (fundos)"},
    {id: "T-IL-E4", fl: "T", k: "il", tipo: "arandela", amb: "Corredor lateral", x: 1500, y: 6000, z: 2200, va: 100, externa: true, desc: "Arandela externa — corredor lateral"},
    {id: "T-S-E", fl: "T", k: "int", amb: "Sala", x: 4700, y: 14850, z: 1100, liga: ["T-IL-E1","T-IL-E2"], desc: "Interruptor das arandelas da fachada (junto à porta de entrada)"},
    {id: "T-S-Q", fl: "T", k: "int", amb: "Cozinha", x: 3025, y: 3000, z: 1100, liga: ["T-IL-E3","T-IL-E4"], desc: "Interruptor das arandelas do quintal e do corredor (junto à porta dos fundos) (mesma caixa do T-S1)", caixa: "T-S1"},
    {id: "T-T-E1", fl: "T", k: "tug", amb: "Quintal", x: 2600, y: 2850, z: 600, va: 100, molhada: true, externa: true, desc: "TUG externa IP44 — quintal"},
    {id: "T-IL-ESC", fl: "T", k: "il", tipo: "arandela", amb: "Escada", x: 8850, y: 9550, z: 2400, va: 100, desc: "Arandela da escada (térreo → 1º)"},
    {id: "T-S3a", fl: "T", k: "int3", amb: "Escada", x: 5560, y: 8750, z: 1100, liga: ["T-IL-ESC"], desc: "Interruptor paralelo — pé da escada (térreo)"},
    {id: "1-S3b", fl: "1", k: "int3", amb: "Circulação", x: 5560, y: 8750, z: 1100, liga: ["T-IL-ESC"], desc: "Interruptor paralelo — chegada da escada (1º)"},
    {id: "1-IL-ESC", fl: "1", k: "il", tipo: "arandela", amb: "Escada", x: 8850, y: 9550, z: 2400, va: 100, desc: "Arandela da escada (1º → 2º)"},
    {id: "1-S3a", fl: "1", k: "int3", amb: "Circulação", x: 5900, y: 10350, z: 1100, liga: ["1-IL-ESC"], desc: "Interruptor paralelo — pé da escada (1º)"},
    {id: "2-S3b", fl: "2", k: "int3", amb: "Varanda coberta", x: 6300, y: 8600, z: 1100, liga: ["1-IL-ESC"], desc: "Interruptor paralelo — chegada da escada (2º)"},
    {id: "T-TV1", fl: "T", k: "tug", amb: "Sala", x: 4300, y: 12500, z: 300, va: 100, desc: "TUG da TV (1/3) — parede da TV, atrás do rack"},
    {id: "T-TV2", fl: "T", k: "tug", amb: "Sala", x: 4300, y: 12700, z: 300, va: 100, desc: "TUG da TV (2/3) — parede da TV, atrás do rack"},
    {id: "T-TV3", fl: "T", k: "tug", amb: "Sala", x: 4300, y: 13300, z: 300, va: 100, desc: "TUG da TV (3/3) — parede da TV, atrás do rack"},
    {id: "T-T-RT", fl: "T", k: "tug", amb: "Sala", x: 4600, y: 14550, z: 2780, va: 100, desc: "Tomada no teto para o roteador Wi-Fi (junto ao ponto de rede)"},
    {id: "T-T-QDT", fl: "T", k: "tug", amb: "Sala (pé da escada)", x: 7000, y: 8750, z: 1500, va: 100, desc: "TUG do roteador / ONT da fibra (ao lado do QDT)"},
    {id: "CXT", fl: "T", k: "tel", tel: "entrada", amb: "Muro esquerdo (frente)", x: 150, y: 19300, z: 1500, desc: "Caixa de entrada da fibra (operadora) — muro esquerdo, ao lado do padrão"},
    {id: "CPT", fl: "T", k: "tel", tel: "passagem", amb: "Garagem", x: 2600, y: 10500, z: 300, desc: "Caixa de passagem 4×4 da fibra — parede do lavabo, lado da garagem"},
    {id: "QDT", fl: "T", k: "tel", tel: "qdt", amb: "Sala (sob a escada)", x: 6650, y: 8750, z: 1500, desc: "Quadro de telecom (QDT) 40×40 — ONT da fibra, roteador e distribuição Cat6"},
    {id: "T-RJ1", fl: "T", k: "tel", tel: "rj", amb: "Sala", x: 4300, y: 13500, z: 300, desc: "Ponto de rede RJ45 (TV) — Sala, ao lado das tomadas da TV"},
    {id: "T-RJ2", fl: "T", k: "tel", tel: "rj", amb: "Quarto", x: 4300, y: 6450, z: 300, desc: "Ponto de rede RJ45 — Quarto"},
    {id: "T-RT1", fl: "T", k: "tel", tel: "roteador", amb: "Sala", x: 4600, y: 14550, z: 2780, desc: "Ponto no teto para o roteador Wi-Fi (Cat6 do QDT + tomada no teto) — Sala, depois da 2ª janela da parede da garagem"},
    {id: "1-RJ1", fl: "1", k: "tel", tel: "rj", amb: "Quarto Master", x: 3150, y: 7063, z: 300, desc: "Ponto de rede RJ45 — Quarto Master"},
    {id: "1-RJ2", fl: "1", k: "tel", tel: "rj", amb: "Quarto 1", x: 4150, y: 13163, z: 300, desc: "Ponto de rede RJ45 — Quarto 1"},
    {id: "1-RJ3", fl: "1", k: "tel", tel: "rj", amb: "Quarto 2", x: 4300, y: 11975, z: 300, desc: "Ponto de rede RJ45 — Quarto 2"},
    {id: "1-AP1", fl: "1", k: "tel", tel: "ap", amb: "Circulação", x: 4700, y: 9550, z: 2780, desc: "Ponto de Wi-Fi no teto (access point) — Circulação do 1º"},
    {id: "2-RJ1", fl: "2", k: "tel", tel: "rj", amb: "Varanda coberta", x: 7350, y: 7800, z: 300, desc: "Ponto de rede RJ45 (TV) — Varanda coberta"},
    {id: "2-AP1", fl: "2", k: "tel", tel: "ap", amb: "Varanda coberta", x: 5250, y: 6700, z: 2780, desc: "Ponto de Wi-Fi no teto (access point) — Varanda coberta"},
  ];
  // </PONTOS>
  const PBY = Object.fromEntries(PONTOS.map((p) => [p.id, p]));

  // ================================================================================================ tabelas NBR 5410
  // Capacidade de condução (A), cobre/PVC 70 °C, método B1 (eletroduto embutido em alvenaria) — Tabela 36
  const IZ2 = { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125, 50: 151 }; // 2 condutores carregados
  const IZ3 = { 1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 110, 50: 134 };  // 3 condutores carregados
  const SECOES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];
  const DISJ = [10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100];
  // Fatores de demanda usuais das concessionárias (iluminação + TUG em kW; TUE pelo número de aparelhos)
  const FD_IT = [[1, 0.86], [2, 0.75], [3, 0.66], [4, 0.59], [5, 0.52], [6, 0.45], [7, 0.4], [8, 0.35], [9, 0.31], [10, 0.27], [1e9, 0.24]];
  const FD_TUE = [1, 1, 1, 0.84, 0.76, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52, 0.49, 0.48, 0.46, 0.45, 0.44];
  const fmtm = (mm, d = 2) => (mm / 1000).toFixed(d).replace('.', ',');
  const fmtn = (v, d = 2) => (+v).toFixed(d).replace('.', ',');

  // ================================================================================================ circuitos
  // Separação (NBR 5410 9.5.3): iluminação e tomadas em circuitos distintos; TUE com corrente > 10 A ou fixo em
  // circuito próprio; tomadas de cozinha/serviço e de banheiros separadas das demais; cada circuito com folga.
  const CAP = { il: 1200, tugM: 1800, tugS: 1500 }; // VA por circuito (127 V: 9,4 A / 14,2 A / 11,8 A)
  const FL_NAME = { T: 'térreo', 1: '1º pav.', 2: '2º pav.' };
  const EQ_NAME = { chuveiro: 'Chuveiro', ac: 'Ar-condicionado', microondas: 'Micro-ondas', mlr: 'Máquina de lavar', portao: 'Portão eletrônico' };
  function buildCircuits() {
    const C = [];
    /** Divide os pontos (na ordem dos cômodos) em k circuitos de carga parecida, cada um até `cap`. */
    const group = (key, tipo, desc, list, cap) => {
      if (!list.length) return;
      const tot = list.reduce((s, p) => s + (p.va || 0), 0), k = Math.ceil(tot / cap), alvo = tot / k;
      let c = null, i = 0;
      list.forEach((p) => {
        if (!c || (c.va + (p.va || 0) > cap) || (c.va >= alvo * 0.95 && i < k)) {
          c = { n: 0, key: key + i, tipo, desc, v: VFN, pts: [], va: 0 };
          C.push(c);
          i++;
        }
        c.pts.push(p.id);
        c.va += p.va || 0;
        p.circ = c;
      });
    };
    const banho = (p) => /Lav|Banh|Suíte/.test(p.amb);
    ['T', '1', '2'].forEach((fl) => {
      const P = PONTOS.filter((p) => p.fl === fl);
      group('il' + fl, 'il', 'Iluminação — ' + FL_NAME[fl], P.filter((p) => p.k === 'il'), CAP.il);
      group('tc' + fl, 'tug', 'Tomadas da cozinha/bancada — ' + FL_NAME[fl], P.filter((p) => p.k === 'tug' && p.va >= 600 && !banho(p)), CAP.tugM);
      group('tb' + fl, 'tug', 'Tomadas dos banheiros — ' + FL_NAME[fl], P.filter((p) => p.k === 'tug' && banho(p)), CAP.tugM);
      group('tg' + fl, 'tug', 'Tomadas de uso geral — ' + FL_NAME[fl], P.filter((p) => p.k === 'tug' && !p.circ), CAP.tugS);
    });
    PONTOS.filter((p) => p.k === 'tue').forEach((p) => {
      const c = { n: 0, key: p.id, tipo: 'tue', desc: EQ_NAME[p.eq] + ' — ' + p.amb + ' (' + FL_NAME[p.fl] + ')', v: p.v || VFN, pts: [p.id], va: p.va, eq: p.eq };
      p.circ = c;
      C.push(c);
    });
    // interruptores seguem o circuito da primeira lâmpada que comandam
    PONTOS.filter((p) => p.k === 'int' || p.k === 'int3').forEach((p) => {
      const l = PBY[(p.liga || [])[0]];
      if (l && l.circ) (p.circ = l.circ), l.circ.pts.push(p.id);
    });
    const order = { il: 0, tug: 1, tue: 2 };
    const flr = (c) => ({ T: 0, 1: 1, 2: 2 })[PBY[c.pts[0]].fl];
    C.forEach((c) => (c.fl = PBY[c.pts[0]].fl));
    C.sort((a, b) => order[a.tipo] - order[b.tipo] || flr(a) - flr(b) || (a.v - b.v) || a.key.localeCompare(b.key, 'pt', { numeric: true }));
    C.forEach((c, i) => (c.n = i + 1));
    return C;
  }
  const CIRC = buildCircuits();

  // ------------------------------------------------------------------ fases (127 V numa fase; 220 V entre duas)
  // Chuveiros primeiro, cada um num par de fases diferente (AB, BC, CA): dois ligados juntos nunca somam 2 × 34 A nas
  // mesmas duas fases. Os demais circuitos equilibram cada quadro partindo da carga dos chuveiros daquele quadro.
  CIRC.filter((c) => c.eq === 'chuveiro').forEach((c, i) => (c.fases = ['AB', 'BC', 'CA'][i % 3]));
  function balance(list) {
    const load = { A: 0, B: 0, C: 0 };
    list.filter((c) => c.eq === 'chuveiro').forEach((c) => c.fases.split('').forEach((f) => (load[f] += c.va / 2)));
    list.filter((c) => c.eq !== 'chuveiro').sort((a, b) => b.va - a.va).forEach((c) => {
      if (c.v === VFF) {
        const pair = [['A', 'B'], ['B', 'C'], ['C', 'A']].sort((p, q) => load[p[0]] + load[p[1]] - (load[q[0]] + load[q[1]]))[0];
        c.fases = pair.join('');
        pair.forEach((f) => (load[f] += c.va / 2));
      } else {
        const f = ['A', 'B', 'C'].sort((p, q) => load[p] - load[q])[0];
        c.fases = f;
        load[f] += c.va;
      }
    });
    return load;
  }
  // equilíbrio em cada quadro (cada um é trifásico); o total da casa é a soma
  const FASES_Q = Object.fromEntries(['T', '1', '2'].map((b) => [b, balance(CIRC.filter((c) => c.fl === b))]));
  const FASES = ['A', 'B', 'C'].reduce((o, f) => ((o[f] = FASES_Q.T[f] + FASES_Q[1][f] + FASES_Q[2][f]), o), {});

  // ------------------------------------------------------------------ caminhos (laje + descidas) e comprimentos
  const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const polyLen = (P) => P.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - P[i][0], q[1] - P[i][1], q[2] - P[i][2]), 0);
  /** Árvore (Prim, distância ortogonal) ligando a prumada do quadro aos pontos do circuito naquele pavimento. */
  function tree(fl, ids, riser) {
    const r = (riser || RISER)[fl];
    const root = { id: 'R' + fl, x: r.x, y: r.y, z: TETO, fl, root: true };
    const nodes = [root].concat(ids.map((id) => PBY[id]));
    const inT = new Set([0]), edges = [], dist = nodes.map((n) => man(n, root)), par = nodes.map(() => 0);
    while (inT.size < nodes.length) {
      let bi = -1;
      nodes.forEach((n, i) => { if (!inT.has(i) && (bi < 0 || dist[i] < dist[bi])) bi = i; });
      inT.add(bi);
      edges.push({ a: nodes[par[bi]], b: nodes[bi], L: man(nodes[par[bi]], nodes[bi]) });
      nodes.forEach((n, i) => { if (!inT.has(i)) { const d = man(n, nodes[bi]); if (d < dist[i]) (dist[i] = d), (par[i] = bi); } });
    }
    return { root, edges };
  }
  /** Do quadro do circuito (centro a 1,50 m) até a laje do pavimento `fl` (o mesmo, ou outro no caso da escada). */
  const rise = (fl, board) => LEVEL[fl] + TETO - (LEVEL[board || fl] + 1500) + man(BOARDS[board || fl], BOARDS[fl]);
  /** Comprimentos de um circuito saindo do quadro `board` (eletroduto e caminho até o ponto mais distante). */
  function lengths(c, board) {
    const byFl = {};
    let conduite = 0, Lmax = 0;
    c.pts.forEach((id) => {
      const p = PBY[id];
      if (coberto(p)) return (byFl[p.fl] = byFl[p.fl] || []).push(id);
      const L = plen(baixo(p, p.fl)) + (p.fl !== board ? LEVEL[p.fl] - LEVEL[board] : 0);
      conduite += L;
      Lmax = Math.max(Lmax, L);
    });
    Object.keys(byFl).forEach((fl) => {
      const t = tree(fl, byFl[fl], fl === board ? { [fl]: BOARDS[board] } : board === 'T' && fl !== 'T' ? { [fl]: fl === '2' ? { x: 6400, y: 8750 } : QDC_XY } : RISER);
      const depth = new Map([[t.root, 0]]);
      t.edges.forEach((e) => depth.set(e.b, depth.get(e.a) + e.L));
      const up = board === 'T' && fl !== 'T' ? LEVEL[fl] + TETO - 1500 + (fl === '2' ? 475 : 0) : rise(fl, board);
      conduite += t.edges.reduce((a, e) => a + e.L, 0) + byFl[fl].reduce((a, id) => a + Math.max(0, TETO - PBY[id].z), 0) + up;
      byFl[fl].forEach((id) => (Lmax = Math.max(Lmax, up + depth.get(PBY[id]) + Math.max(0, TETO - PBY[id].z))));
    });
    return { conduite, Lmax };
  }
  /** Caminho por baixo, do quadro do andar até um ponto descoberto (z relativo ao piso do andar). */
  function baixo(p, board) {
    const B = BOARDS[board], z = Z_BAIXO[p.fl], yy = p.y > B.y ? p.y - 200 : p.y + 200;
    return [[B.x, B.y, 1150], [B.x, B.y, z], [B.x, yy, z], [p.x, yy, z], [p.x, p.y, z], [p.x, p.y, p.z]];
  }
  const plen = (P) => P.slice(1).reduce((s2, q, i) => s2 + Math.abs(q[0] - P[i][0]) + Math.abs(q[1] - P[i][1]) + Math.abs(q[2] - P[i][2]), 0);
  function routeCircuit(c) {
    c.board = c.fl;
    // pontos descobertos saem do circuito da laje e vão por baixo
    c.baixo = c.pts.filter((id) => !coberto(PBY[id]) && PBY[id].fl === c.board).map((id) => ({ id, fl: PBY[id].fl, path: baixo(PBY[id], c.board) }));
    const fora = new Set(c.baixo.map((b) => b.id));
    const byFl = {};
    c.pts.filter((id) => !fora.has(id)).forEach((id) => (byFl[PBY[id].fl] = byFl[PBY[id].fl] || []).push(id));
    c.trees = {};
    let horiz = 0, drops = 0, risers = 0, Lmax = 0;
    Object.keys(byFl).forEach((fl) => {
      const t = tree(fl, byFl[fl]);
      c.trees[fl] = t;
      horiz += t.edges.reduce((s, e) => s + e.L, 0);
      drops += byFl[fl].reduce((s, id) => s + Math.max(0, TETO - PBY[id].z), 0);
      risers += rise(fl, c.board);
      // caminho até o ponto mais distante (para a queda de tensão)
      const depth = new Map([[t.root, 0]]);
      t.edges.forEach((e) => depth.set(e.b, depth.get(e.a) + e.L));
      byFl[fl].forEach((id) => (Lmax = Math.max(Lmax, rise(fl, c.board) + depth.get(PBY[id]) + Math.max(0, TETO - PBY[id].z))));
    });
    c.baixo.forEach((b) => ((horiz += plen(b.path)), (Lmax = Math.max(Lmax, plen(b.path)))));
    c.conduite = horiz + drops + risers; // mm de eletroduto do circuito
    c.Lmax = Lmax;
    c.enterrado = c.baixo.filter((b) => b.fl === 'T').reduce((s2, b) => s2 + plen(b.path.slice(1, -1)), 0);
    c.cond = c.tipo === 'il' ? 3 : 3; // F + N (ou F + F) + PE; retornos contados à parte
    c.retorno = c.tipo === 'il' ? c.pts.filter((id) => /int/.test(PBY[id].k)).reduce((s, id) => s + (TETO - PBY[id].z), 0) * 1 : 0;
    c.unico = lengths(c, 'T'); // o mesmo circuito saindo de um quadro só, no térreo (para comparar)
  }
  CIRC.forEach(routeCircuit);

  // ------------------------------------------------------------------ rede de dados (Cat6 em estrela a partir do QDT)
  function telNet() {
    const pts = PONTOS.filter((p) => p.k === 'tel' && (p.tel === 'rj' || p.tel === 'ap' || p.tel === 'roteador'));
    const trees = {}, cabos = [];
    ['T', '1', '2'].forEach((fl) => {
      const ids = pts.filter((p) => p.fl === fl).map((p) => p.id);
      if (!ids.length) return;
      const t = tree(fl, ids, TEL_RISER);
      trees[fl] = t;
      const depth = new Map([[t.root, 0]]);
      t.edges.forEach((e) => depth.set(e.b, depth.get(e.a) + e.L));
      ids.forEach((id) => {
        const p = PBY[id];
        // cada ponto tem seu cabo do QDT: prumada + caminho na laje + descida + 3 m de folga (patch no QDT)
        cabos.push({ id, L: LEVEL[fl] + TETO - 1500 + depth.get(p) + Math.max(0, TETO - p.z) + 3000 });
      });
    });
    const conduite = Object.keys(trees).reduce((s, fl) => s + trees[fl].edges.reduce((a, e) => a + e.L, 0) + pts.filter((p) => p.fl === fl).reduce((a, p) => a + Math.max(0, TETO - p.z), 0) + (fl === 'T' ? TETO - 1500 : LEVEL[fl] + TETO - 1500), 0);
    return { pts, trees, cabos, conduite, entrada: polyLen(TEL_ROUTE) };
  }
  const TEL = telNet();

  // ------------------------------------------------------------------ dimensionamento
  function size(c) {
    c.ib = c.va / c.v;
    c.fca = c.eq === 'chuveiro' ? 1 : FCA; // chuveiros em eletroduto exclusivo
    c.disj = DISJ.find((d) => d >= c.ib);
    // mínimo: 1,5 iluminação, 2,5 força; chuveiros 6 mm² (recomendação dos fabricantes para 220 V acima de 5.500 W)
    let s = SECOES.find((x) => x >= (c.tipo === 'il' ? 1.5 : c.eq === 'chuveiro' ? 6 : 2.5) && IZ2[x] * c.fca * FCT >= c.disj);
    const dv = (sec) => (200 * RHO * (c.Lmax / 1000) * c.ib) / (sec * c.v);
    while (dv(s) > DV_MAX && s < 50) s = SECOES[SECOES.indexOf(s) + 1];
    c.secao = s;
    c.iz = IZ2[s] * c.fca * FCT;
    c.dv = dv(s);
    c.pe = s; // PE com a mesma seção da fase até 16 mm² (Tabela 58)
    c.ok = c.ib <= c.disj && c.disj <= c.iz && c.dv <= DV_MAX;
  }
  CIRC.forEach(size);

  // ------------------------------------------------------------------ proteção diferencial (DR 30 mA) e DPS
  // NBR 5410 5.1.3.2.2: DR ≤ 30 mA em banheiros, cozinhas, áreas de serviço, áreas externas e tomadas que possam
  // alimentar equipamentos externos. Aqui: DR em todos os circuitos, em grupos, para um disparo não apagar a casa.
  // Em cada quadro: um DR para iluminação, um para tomadas e um para os demais aparelhos; cada chuveiro com DR próprio.
  const GRUPOS = [
    ['Iluminação', (c) => c.tipo === 'il'],
    ['Tomadas', (c) => c.tipo === 'tug'],
    ['Aparelhos (ar, micro-ondas, máquina, portão)', (c) => c.tipo === 'tue' && c.eq !== 'chuveiro'],
  ];
  const DRS = [];
  ['T', '1', '2'].forEach((b) => {
    const mine = CIRC.filter((c) => c.board === b);
    // quadro pequeno (até 4 circuitos sem chuveiro): um DR só para todos
    const grupos = mine.filter((c) => c.eq !== 'chuveiro').length <= 4 ? [['Todos os circuitos do quadro', (c) => c.eq !== 'chuveiro']] : GRUPOS;
    grupos.forEach(([desc, f]) => {
      const L = mine.filter(f);
      if (!L.length) return;
      const ia = ['A', 'B', 'C'].map((ph) => L.filter((c) => c.fases.includes(ph)).reduce((s, c) => s + (c.v === VFF ? c.va / VFF : c.va / VFN), 0));
      const fases = new Set(L.map((c) => c.fases).join('').split('')).size;
      DRS.push({ id: 'DR-' + (DRS.length + 1), board: b, polos: fases > 2 ? 4 : fases === 2 ? 4 : 2, desc, circ: L.map((c) => c.n), in: [25, 40, 63, 80, 100].find((x) => x >= Math.max(...ia)) || 100 });
    });
    mine.filter((c) => c.eq === 'chuveiro').forEach((c) => DRS.push({ id: 'DR-' + (DRS.length + 1), board: b, polos: 2, desc: c.desc, circ: [c.n], in: c.disj <= 40 ? 40 : 63 }));
  });
  CIRC.forEach((c) => (c.dr = (DRS.find((d) => d.circ.includes(c.n)) || {}).id));

  // ------------------------------------------------------------------ demanda e alimentador
  function demandaDe(L0) {
    const ilW = L0.filter((c) => c.tipo === 'il').reduce((s, c) => s + c.va, 0) * 1.0;
    const tugW = L0.filter((c) => c.tipo === 'tug').reduce((s, c) => s + c.va, 0) * 0.8;
    const it = (ilW + tugW) / 1000;
    // fator por faixa, aplicado de forma acumulada (cada kW na sua faixa)
    let rest = it, prev = 0, dIT = 0;
    FD_IT.forEach(([lim, f]) => { const part = Math.max(0, Math.min(rest, lim - prev)); dIT += part * f; rest -= part; prev = lim; });
    const tues = L0.filter((c) => c.tipo === 'tue');
    const pfTue = (c) => (c.eq === 'ac' ? 0.9 : c.eq === 'portao' ? 0.75 : 1);
    const tueW = tues.reduce((s, c) => s + c.va * pfTue(c), 0) / 1000;
    const fTue = FD_TUE[Math.min(tues.length, FD_TUE.length - 1)];
    const D = dIT + tueW * fTue; // kW
    const inst = (ilW + tugW) / 1000 + tueW;
    const I = (D * 1000) / (Math.sqrt(3) * VFF * 0.92);
    return { ilW, tugW, it, dIT, tueW, fTue, nTue: tues.length, D, inst, I };
  }
  // ------------------------------------------------------------------ demanda pelo uso real (cenários de pico)
  // A NBR 5410 deixa a demanda a critério do projetista; a concessionária usa as tabelas dela só para o padrão.
  // Aqui: corrente em cada fase = Σ Ib × Fu × Fs, com
  //   Fu (fator de utilização) — fração da potência nominal que o aparelho usa quando está ligado;
  //   Fs (fator de simultaneidade) — fração dos pontos/aparelhos do grupo ligados ao mesmo tempo no pico.
  // Chuveiros são contados um a um: no pico, os dois que mais carregam a mesma fase.
  const FATORES = {
    il: { fu: 0.4, fs: 0.6, nome: 'Iluminação', obs: 'LED consome ~40 % da carga mínima da NBR; 60 % das luzes acesas' },
    tug: { fu: 1, fs: 0.15, nome: 'Tomadas de uso geral (100 VA)', obs: 'carregadores, TV, notebook…: poucos ao mesmo tempo' },
    tug600: { fu: 1, fs: 0.3, nome: 'Tomadas de bancada e banheiro (600 VA)', obs: 'liquidificador, cafeteira, secador: uso curto' },
    ac: { fu: 0.8, fs: 0.75, nome: 'Ar-condicionado', obs: '3 dos 4 ligados; compressor não fica 100 % do tempo' },
    microondas: { fu: 1, fs: 0.3, nome: 'Micro-ondas', obs: 'uso de poucos minutos' },
    mlr: { fu: 0.6, fs: 0.5, nome: 'Máquina de lavar', obs: 'ciclo com aquecimento só parte do tempo' },
    portao: { fu: 1, fs: 0.05, nome: 'Portão', obs: 'segundos por acionamento' },
  };
  const CENARIOS = [
    // uso da casa: um chuveiro de cada vez (definido pelo proprietário)
    { id: 'verao', nome: 'Noite de verão: ar ligado, 1 chuveiro na posição verão', chuveiros: 1, fuCh: 0.55, ac: true, projeto: true },
    { id: 'veraoQ', nome: 'Noite de verão: ar ligado, 1 chuveiro na posição inverno', chuveiros: 1, fuCh: 1, ac: true, projeto: true },
    { id: 'inverno', nome: 'Noite de inverno: ar desligado, 1 chuveiro na posição inverno', chuveiros: 1, fuCh: 1, ac: false, projeto: true },
    { id: 'semch', nome: 'Noite de verão sem chuveiro', chuveiros: 0, fuCh: 0, ac: true, projeto: true },
    { id: 'dois', nome: 'Fora do uso previsto: 2 chuveiros juntos na posição inverno, ar ligado', chuveiros: 2, fuCh: 1, ac: true },
  ];
  function cenario(cn) {
    const sh = CIRC.filter((c) => c.eq === 'chuveiro');
    // todas as combinações de n chuveiros ligados juntos
    const comb = (L, n) => (n === 0 ? [[]] : L.flatMap((x, i) => comb(L.slice(i + 1), n - 1).map((r) => [x].concat(r))));
    const combos = comb(sh, Math.min(cn.chuveiros, sh.length));
    let pior = null;
    combos.forEach((on) => {
      const I = { A: 0, B: 0, C: 0 };
      CIRC.forEach((c) => {
        let k;
        if (c.eq === 'chuveiro') { if (!on.includes(c)) return; k = { fu: cn.fuCh, fs: 1 }; }
        else if (c.eq === 'ac') k = cn.ac ? FATORES.ac : { fu: 0, fs: 0 };
        else if (c.tipo === 'tue') k = FATORES[c.eq];
        else if (c.tipo === 'tug') k = c.pts.some((id) => PBY[id].va >= 600) ? FATORES.tug600 : FATORES.tug;
        else k = FATORES.il;
        const ib = (c.va / c.v) * k.fu * k.fs;
        c.fases.split('').forEach((f) => (I[f] += ib));
      });
      const m = Math.max(I.A, I.B, I.C);
      if (!pior || m > pior.max) pior = { I, max: m };
    });
    return Object.assign({}, cn, pior);
  }
  const CENARIO = CENARIOS.map(cenario);
  function demanda() {
    // corrente de projeto do ramal: a maior fase no cenário de projeto (pico típico) — não a média trifásica
    const d = demandaDe(CIRC), proj = CENARIO.filter((c) => c.projeto).sort((a, b) => b.max - a.max)[0], I = proj.max;
    d.cenarioProjeto = proj.id;
    d.Iconc = d.I;
    const L = polyLen(ALIM_ROUTE) + 1000; // percurso real + 1 m de sobra nas ligações
    const disj = DISJ.find((d) => d >= I);
    // seção definida (16 mm²): confere capacidade (Iz ≥ In do geral) e a queda de tensão entra no total de 5 %
    const s = SECOES.find((x) => x >= ALIM_SECAO && IZ3[x] * FCT >= disj), iz = IZ3[s] * FCT;
    const dv = (100 * Math.sqrt(3) * RHO * (L / 1000) * I) / (s * VFF);
    // situações mais raras (2 ou 3 chuveiros no inverno): a corrente pode passar do In por alguns minutos; o disjuntor
    // curva C não desarma até 1,13 × In e só desarma em menos de 1 h acima de 1,45 × In (NBR NM 60898)
    const raros = CENARIO.filter((c) => !c.projeto || c === proj).map((c) => ({ id: c.id, nome: c.nome, max: c.max, xIn: c.max / disj }));
    return Object.assign(d, { Iproj: I, L, disj, secao: s, iz, okIz: disj <= iz, minimo: ALIM_SECAO, subiu: s > ALIM_SECAO, dv, neutro: s, pe: s <= 16 ? s : 16, raros });
  }
  const ALIM = demanda();
  // alimentadores dos quadros de andar (QDC → QD-1 e QD-2): demanda do andar, disjuntor 3P no QDC, cabo pela capacidade
  // (2 alimentadores juntos na prumada) e pela queda de tensão (≤ 1 %)
  const SUB = {};
  ['1', '2'].forEach((b) => {
    const d = demandaDe(CIRC.filter((c) => c.board === b));
    const L = polyLen(SUB_ROUTE[b]) + 1000;
    // seletividade: um degrau acima do maior disjuntor do quadro do andar
    const maxDown = Math.max(...CIRC.filter((c) => c.board === b).map((c) => c.disj));
    const disj = DISJ.find((x) => x >= d.I && x > maxDown);
    let s = SECOES.find((x) => x >= 6 && IZ3[x] * FCA_SUB * FCT >= disj);
    const dv = (sec) => (100 * Math.sqrt(3) * RHO * (L / 1000) * d.I) / (sec * VFF);
    while (dv(s) > 1 && s < 50) s = SECOES[SECOES.indexOf(s) + 1];
    SUB[b] = Object.assign(d, { board: BOARDS[b], L, disj, secao: s, iz: IZ3[s] * FCA_SUB * FCT, dv: dv(s), neutro: s, pe: s <= 16 ? s : 16, ok: disj <= IZ3[s] * FCA_SUB * FCT });
  });
  // queda total (alimentador + alimentador do andar + circuito) ≤ 5 %: aumenta a seção do circuito se precisar
  CIRC.forEach((c) => {
    const dv = (sec) => (200 * RHO * (c.Lmax / 1000) * c.ib) / (sec * c.v);
    const up = ALIM.dv + (SUB[c.board] ? SUB[c.board].dv : 0);
    while (dv(c.secao) + up > DV_TOTAL && c.secao < 50) c.secao = SECOES[SECOES.indexOf(c.secao) + 1];
    c.dv = dv(c.secao);
    c.iz = IZ2[c.secao] * c.fca * FCT;
    c.pe = c.secao;
    c.dvTot = c.dv + up;
    c.ok = c.ib <= c.disj && c.disj <= c.iz && c.dv <= DV_MAX && c.dvTot <= DV_TOTAL;
  });

  // ------------------------------------------------------------------ materiais
  function quantities() {
    const cabos = {}; // seção → { fase, neutro, terra, retorno } em m
    const addCabo = (s, k, m) => { cabos[s] = cabos[s] || { fase: 0, neutro: 0, terra: 0, retorno: 0 }; cabos[s][k] += m; };
    CIRC.forEach((c) => {
      const L = (c.conduite / 1000) * 1.1;
      if (c.v === VFF) addCabo(c.secao, 'fase', 2 * L);
      else (addCabo(c.secao, 'fase', L), addCabo(c.secao, 'neutro', L));
      addCabo(c.pe, 'terra', L);
      if (c.retorno) addCabo(c.secao, 'retorno', (c.retorno / 1000) * 1.1 * 1.5);
    });
    Object.values(SUB).forEach((d) => {
      addCabo(d.secao, 'fase', 3 * (d.L / 1000) * 1.1);
      addCabo(d.neutro, 'neutro', (d.L / 1000) * 1.1);
      addCabo(d.pe, 'terra', (d.L / 1000) * 1.1);
    });
    addCabo(ALIM.secao, 'fase', 3 * (ALIM.L / 1000) * 1.1);
    addCabo(ALIM.neutro, 'neutro', (ALIM.L / 1000) * 1.1);
    addCabo(ALIM.pe, 'terra', (ALIM.L / 1000) * 1.1);
    const items = [];
    const it = (grupo, desc, un, q, obs) => items.push({ grupo, desc, un, q, obs: obs || '' });
    SECOES.filter((s) => cabos[s]).forEach((s) => {
      const c = cabos[s], tot = c.fase + c.neutro + c.terra + c.retorno;
      it('Cabos', `Cabo flexível 750 V ${String(s).replace('.', ',')} mm²`, 'm', Math.ceil(tot / 5) * 5, `fase ${Math.ceil(c.fase)} · neutro (azul) ${Math.ceil(c.neutro)} · terra (verde) ${Math.ceil(c.terra)}${c.retorno ? ' · retorno ' + Math.ceil(c.retorno) : ''} m; rolos de 100 m`);
    });
    // eletrodutos: um por circuito nas descidas, compartilhados na laje (estimado: 75 % do somatório)
    const conduit = (f) => CIRC.filter(f).reduce((s, c) => s + c.conduite, 0) / 1000;
    const e20 = conduit((c) => c.secao <= 2.5) * 0.75, e25 = conduit((c) => c.secao > 2.5) * 0.9;
    it('Eletrodutos', 'Eletroduto corrugado (conduíte) Ø 20 mm (¾")', 'm', Math.ceil(e20 / 5) * 5, 'laje e descidas — iluminação e tomadas');
    it('Eletrodutos', 'Eletroduto corrugado reforçado Ø 25 mm (1")', 'm', Math.ceil(e25 / 5) * 5, 'chuveiros e circuitos de 4 mm² ou mais (um por circuito)');
    it('Eletrodutos', 'Eletroduto corrugado reforçado Ø 40 mm — alimentadores dos quadros de andar', 'm', Math.ceil(Object.values(SUB).reduce((s, d) => s + d.L, 0) / 1000 + 1), 'QDC → QD-1 (na parede) e QDC → QD-2 (parede + laje do 2º)');
    const ent = CIRC.reduce((s2, c) => s2 + (c.enterrado || 0), 0);
    if (ent) it('Eletrodutos', 'Eletroduto PEAD corrugado Ø 32 mm (enterrado) — circuitos externos', 'm', Math.ceil(ent / 1000 + 2), 'motor do portão: do QDC por baixo do piso até o muro da frente, a −0,40 m, com fita de aviso');
    it('Eletrodutos', 'Eletroduto PEAD corrugado Ø 50 mm (enterrado) — alimentador', 'm', Math.ceil(ALIM.L / 1000 + 2), 'do padrão de entrada ao QDC, a −0,40 m, com fita de aviso');
    const n = (k, f) => PONTOS.filter((p) => p.k === k && (!f || f(p))).length;
    it('Caixas', 'Caixa octogonal 4×4" de laje (fundo móvel)', 'un', n('il', (p) => p.tipo === 'teto'), 'pontos de luz no teto');
    const caixas2 = new Set(PONTOS.filter((p) => /int|tug|tue/.test(p.k) && p.eq !== 'chuveiro').map((p) => p.caixa || p.id)).size + n('il', (p) => p.tipo === 'arandela');
    it('Caixas', 'Caixa 4×2" para parede', 'un', caixas2, 'tomadas, interruptores, arandelas e ar-condicionado');
    it('Caixas', 'Caixa 4×4" para parede', 'un', n('tue', (p) => p.eq === 'chuveiro') + 3, 'chuveiros (conector) e passagens das prumadas');
    it('Dispositivos', 'Tomada 2P+T 10 A (NBR 14136) com placa', 'un', n('tug', (p) => p.va < 600) + n('tug', (p) => p.va >= 600 && p.amb && /Lav|Banh|Suíte/.test(p.amb)), 'uso geral e banheiros');
    it('Dispositivos', 'Tomada 2P+T 20 A (NBR 14136) com placa', 'un', n('tug', (p) => p.va >= 600 && !/Lav|Banh|Suíte/.test(p.amb)) + n('tue', (p) => p.eq !== 'chuveiro' && p.eq !== 'portao'), 'bancadas, ar-condicionado, micro-ondas e máquina');
    it('Dispositivos', 'Tomada externa 2P+T 10 A com tampa (IP44)', 'un', n('tug', (p) => !!p.externa), 'quintal, varandas');
    const ints = PONTOS.filter((p) => p.k === 'int' || p.k === 'int3');
    const boxes = {};
    ints.forEach((p) => ((boxes[p.caixa || p.id] = boxes[p.caixa || p.id] || []).push(p)));
    const nb = (f) => Object.values(boxes).filter(f).length;
    it('Dispositivos', 'Interruptor simples 1 tecla 10 A com placa', 'un', nb((b) => b.length === 1 && b[0].k === 'int'));
    it('Dispositivos', 'Interruptor 2 teclas simples 10 A com placa', 'un', nb((b) => b.length === 2 && b.every((p) => p.k === 'int')), 'onde dois comandos ficam na mesma caixa');
    it('Dispositivos', 'Interruptor paralelo (three-way) 10 A com placa', 'un', ints.filter((p) => p.k === 'int3').length, 'escada: um em baixo e um em cima de cada lance');
    it('Dispositivos', 'Conector/terminal para chuveiro 6 mm²', 'un', n('tue', (p) => p.eq === 'chuveiro'), 'ligação direta, sem tomada');
    // quadros
    const disj = {};
    CIRC.forEach((c) => { const k = (c.v === VFF ? '2P ' : '1P ') + c.disj + ' A'; disj[k] = (disj[k] || 0) + 1; });
    Object.keys(disj).sort().forEach((k) => it('Quadros', 'Disjuntor termomagnético DIN curva C ' + k, 'un', disj[k], 'circuitos terminais'));
    it('Quadros', 'Disjuntor geral DIN curva C 3P ' + ALIM.disj + ' A', 'un', 1, 'no QDC (o do padrão é definido pela Enel)');
    Object.values(SUB).forEach((d) => it('Quadros', 'Disjuntor DIN curva C 3P ' + d.disj + ' A — alimentador do ' + d.board.id, 'un', 1, 'no QDC'));
    Object.values(SUB).forEach((d) => it('Quadros', 'Interruptor geral (seccionador) 3P ' + [40, 63, 80, 100].find((x) => x >= d.disj) + ' A — ' + d.board.id, 'un', 1, 'chave geral do quadro do andar'));
    DRS.forEach((d) => it('Quadros', `Interruptor diferencial (DR) ${d.polos}P ${d.in} A 30 mA`, 'un', 1, BOARDS[d.board].id + ' · ' + d.id + ': ' + d.desc));
    it('Quadros', 'DPS classe II 275 V 20 kA', 'un', 4, '3 fases + neutro, no QDC (NBR 5410 6.3.5); os quadros de andar ficam a menos de 10 m');
    const MOD = {};
    ['T', '1', '2'].forEach((b) => {
      const mod = CIRC.filter((c) => c.board === b).reduce((s, c) => s + (c.v === VFF ? 2 : 1), 0) + DRS.filter((d) => d.board === b).reduce((s, d) => s + d.polos, 0) + 3 + (b === 'T' ? 4 + 3 * Object.keys(SUB).length : 0);
      const tam = [12, 18, 24, 36, 48, 56, 72].find((m) => m >= mod * 1.2) || 72;
      MOD[b] = { mod, tam };
      it('Quadros', `Quadro de distribuição de embutir ${tam} módulos DIN, barramentos trifásico, neutro e terra — ${BOARDS[b].id}`, 'un', 1, mod + ' módulos ocupados + reserva (NBR 5410 6.5.4.7)');
    });
    // rede (fibra + Cat6)
    const nRJ = PONTOS.filter((p) => p.tel === 'rj').length, nAP = PONTOS.filter((p) => p.tel === 'ap' || p.tel === 'roteador').length;
    it('Rede e fibra', 'Eletroduto PEAD corrugado Ø 32 mm (enterrado) — entrada da fibra', 'm', Math.ceil(TEL.entrada / 1000 + 2), 'da caixa de entrada no muro até a parede do lavabo, 20 cm ao lado do alimentador');
    it('Rede e fibra', 'Eletroduto corrugado Ø 25 mm (1") — rede, exclusivo', 'm', Math.ceil(((TEL.conduite + 8000) / 1000) * 1.1 / 5) * 5, 'laje, prumadas e descidas — nunca junto com cabos de energia');
    it('Rede e fibra', 'Arame-guia galvanizado (ou fita-guia) em todos os eletrodutos de rede', 'm', Math.ceil((TEL.entrada + TEL.conduite) / 1000 * 1.2), 'deixar dentro de cada eletroduto, amarrado nas caixas');
    it('Rede e fibra', 'Quadro de telecom (QDT) de embutir 40×40×12 cm com tampa', 'un', 1, 'sob a escada, ao lado do QDC — ONT, roteador e patch panel');
    it('Rede e fibra', 'Caixa de entrada de telecom 20×20 (muro) e caixa de passagem 4×4', 'un', 2, 'entrada no muro esquerdo e passagem na parede do lavabo (lado da garagem)');
    it('Rede e fibra', 'Cabo U/UTP Cat6 (por metro ou caixa de 305 m)', 'm', Math.ceil((TEL.cabos.reduce((s, c) => s + c.L, 0) / 1000) / 5) * 5, nRJ + ' pontos RJ45 + ' + nAP + ' pontos de Wi-Fi, um cabo por ponto, do QDT');
    it('Rede e fibra', 'Tomada RJ45 Cat6 com placa 4×2', 'un', nRJ, 'ao lado de uma tomada de energia');
    it('Rede e fibra', 'Caixa octogonal 4×4" de laje para Wi-Fi (roteador / access point)', 'un', nAP, 'roteador no teto da sala (térreo) e access points PoE no 1º e no 2º');
    it('Rede e fibra', 'Patch panel 12 portas Cat6 + patch cords', 'un', 1, 'no QDT');
    it('Aterramento', 'Haste de aterramento cobreada 5/8" × 2,40 m com conector', 'un', 3, 'no padrão de entrada, interligadas (medir ≤ 10 Ω)');
    it('Aterramento', 'Caixa de inspeção do aterramento 30×30', 'un', 1, '');
    it('Acessórios', 'Fita isolante, terminais, abraçadeiras, buchas e arruelas', 'vb', 1, '');
    return { cabos, items, MOD, modulos: MOD.T.mod, qdc: MOD.T.tam };
  }
  const QT = quantities();
  // comparação com um quadro só no térreo (mesmas seções): metros de cabo e de eletroduto dos circuitos
  const COMPARA = (() => {
    const cond = (c) => (c.v === VFF ? 2 : 2) + 1; // F+N ou F+F, mais o PE
    const sum = (f) => CIRC.reduce((s, c) => s + f(c), 0) / 1000;
    const subCabo = Object.values(SUB).reduce((s, d) => s + (d.L / 1000) * 5, 0);
    return {
      cabosQuadros: sum((c) => c.conduite * cond(c)) + subCabo,
      cabosUnico: sum((c) => c.unico.conduite * cond(c)),
      dutoQuadros: sum((c) => c.conduite),
      dutoUnico: sum((c) => c.unico.conduite),
      subCabo,
    };
  })();

  // ================================================================================================ camada do estúdio
  const COLOR = { il: '#d39b00', tug: '#e0572f', tue: '#b4235a', qdc: '#2b2b2b', medidor: '#2b2b2b', int: '#d39b00', int3: '#d39b00', tel: '#0e7490', alim: '#2b2b2b' };
  const TIPO_NAME = { il: 'Iluminação', tug: 'Tomadas (TUG)', tue: 'Uso específico (TUE)', tel: 'Rede / internet' };
  const planKey = (floor) => { const lv = floor && floor.level ? floor.level : 0; return lv >= 5000 ? '2' : lv >= 2000 ? '1' : 'T'; };
  const ptsOf = (fl) => PONTOS.filter((p) => p.fl === fl);
  /** Trechos de eletroduto da prancha: [{a, b, c}] em L (primeiro x, depois y). */
  function conduits(fl) {
    const out = [];
    CIRC.forEach((c) => {
      const t = c.trees[fl];
      if (!t) return;
      t.edges.forEach((e) => out.push({ c, a: e.a, b: e.b }));
    });
    return out;
  }
  const cache = {};
  const conduitsOf = (fl) => cache[fl] || (cache[fl] = conduits(fl));
  const telConduits = (fl) => (TEL.trees[fl] ? TEL.trees[fl].edges.map((e) => ({ a: e.a, b: e.b })) : []);
  /** Trechos (x, y) de um percurso 3D que ficam no pavimento: térreo leva o enterrado e a laje do térreo. */
  const routeXY = (R, fl) => (fl === 'T' ? R.slice(1).map((q, i) => [R[i], q]).filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 1) : []);
  /** Símbolo de um ponto na planta, em mm (contexto do mundo); s = tamanho base em mm. */
  function symbol(ctx, p, s, lw) {
    const col = p.k === 'tel' ? COLOR.tel : p.k === 'tue' ? COLOR.tue : p.k === 'tug' ? COLOR.tug : p.k === 'qdc' || p.k === 'medidor' ? COLOR.qdc : COLOR.il;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    if (p.k === 'tel') {
      if (p.tel === 'rj') {
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s, p.y); ctx.closePath();
        ctx.fill();
      } else if (p.tel === 'ap' || p.tel === 'roteador') {
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.45, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      } else {
        const w = p.tel === 'qdt' ? 2.6 : 1.4;
        ctx.rect(p.x - s * w / 2, p.y - s * 0.6, s * w, s * 1.2);
        ctx.fillStyle = col; ctx.fill();
      }
      return;
    }
    if (p.k === 'il' && p.tipo === 'teto') {
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      const k = s * 0.7;
      ctx.moveTo(p.x - k, p.y - k); ctx.lineTo(p.x + k, p.y + k); ctx.moveTo(p.x + k, p.y - k); ctx.lineTo(p.x - k, p.y + k);
      ctx.stroke();
    } else if (p.k === 'il') {
      ctx.arc(p.x, p.y, s * 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.k === 'int' || p.k === 'int3') {
      ctx.rect(p.x - s * 0.55, p.y - s * 0.55, s * 1.1, s * 1.1);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.stroke();
      if (p.k === 'int3') { ctx.beginPath(); ctx.moveTo(p.x - s * 0.55, p.y + s * 0.55); ctx.lineTo(p.x + s * 0.55, p.y - s * 0.55); ctx.stroke(); }
    } else if (p.k === 'tug' || p.k === 'tue') {
      const h = s * (p.k === 'tue' ? 1.1 : 0.95);
      ctx.moveTo(p.x, p.y - h); ctx.lineTo(p.x + h, p.y + h * 0.75); ctx.lineTo(p.x - h, p.y + h * 0.75); ctx.closePath();
      if (p.k === 'tue' || (p.va || 0) >= 600) ctx.fill();
      else { ctx.fillStyle = '#fff'; ctx.fill(); }
      ctx.stroke();
    } else {
      ctx.rect(p.x - s * 1.6, p.y - s * 0.6, s * 3.2, s * 1.2);
      ctx.fillStyle = '#2b2b2b';
      ctx.fill();
    }
  }
  function draw2dWorld(rc) {
    if (!rc.floor) return;
    const { ctx, px } = rc, fl = planKey(rc.floor);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([5 * px, 3 * px]);
    conduitsOf(fl).forEach(({ c, a, b }) => {
      ctx.strokeStyle = COLOR[c.tipo];
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.4 * px;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    // circuitos que vão por baixo (enterrados / no contrapiso): traço longo
    ctx.setLineDash([12 * px, 4 * px]);
    ctx.globalAlpha = 0.9;
    CIRC.forEach((c) => c.baixo.filter((b) => b.fl === fl).forEach((b) => {
      ctx.strokeStyle = COLOR[c.tipo];
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      ctx.moveTo(b.path[1][0], b.path[1][1]);
      b.path.slice(2).forEach((q) => ctx.lineTo(q[0], q[1]));
      ctx.stroke();
    }));
    // rede de dados e entradas (alimentador e fibra) — traço-ponto
    ctx.setLineDash([8 * px, 3 * px, 2 * px, 3 * px]);
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.4 * px;
    ctx.strokeStyle = COLOR.tel;
    telConduits(fl).forEach(({ a, b }) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
    [[ALIM_ROUTE, COLOR.alim, 2.4], [TEL_ROUTE, COLOR.tel, 1.8]].forEach(([R, col, w]) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w * px;
      routeXY(R, fl).forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const s = Math.max(70, 4.2 * px);
    ptsOf(fl).forEach((p) => symbol(ctx, p, s, 1.3 * px));
  }
  function draw2dScreen(rc) {
    if (!rc.floor) return;
    const { ctx, v } = rc, fl = planKey(rc.floor);
    const w2s = (x, y) => ({ x: v.width / 2 + (x - v.cx) * v.scale, y: v.height / 2 + (y - v.cy) * v.scale });
    const mono = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
    if (v.scale > 0.045) {
      ctx.font = '600 9px ' + mono;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ptsOf(fl).forEach((p) => {
        if (!p.circ && p.k !== 'qdc') return;
        const q = w2s(p.x, p.y), txt = p.k === 'qdc' ? 'QDC' : String(p.circ.n);
        const w = ctx.measureText(txt).width + 6;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillRect(q.x + 7, q.y - 13, w, 12);
        ctx.fillStyle = p.k === 'qdc' ? COLOR.qdc : COLOR[p.circ.tipo];
        ctx.fillText(txt, q.x + 10, q.y - 7);
      });
    }
    // legenda
    const items = [['il', 'Iluminação'], ['tug', 'Tomadas'], ['tue', 'Uso específico'], ['tel', 'Rede']];
    ctx.font = '500 10px ' + mono;
    const widths = items.map(([, t]) => ctx.measureText(t).width + 30), total = widths.reduce((a, b) => a + b, 0) + 10;
    const x0 = 210, y0 = v.height - (rc.footer || 0) - 32 - (rc.show && rc.show.hidro ? 26 : 0);
    ctx.fillStyle = rc.exporting ? 'rgba(255,255,255,0.9)' : 'rgba(243,239,230,0.88)';
    ctx.fillRect(x0, y0, total, 22);
    let x = x0 + 8;
    items.forEach(([k, t], i) => {
      ctx.strokeStyle = COLOR[k];
      ctx.lineWidth = 2.2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath(); ctx.moveTo(x, y0 + 11); ctx.lineTo(x + 16, y0 + 11); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#3a3631';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(t, x + 21, y0 + 11.5);
      x += widths[i];
    });
  }
  /** Eletrodutos e pontos de um pavimento no 3D (metros, y = altura), em "raio X" por cima das paredes. */
  function build3d(THREE, doc, floor) {
    const g = new THREE.Group();
    g.name = 'eletrica:' + floor.id;
    const fl = planKey(floor), lv = LEVEL[fl], MM = 0.001;
    const mats = {};
    const mat = (color, op) => mats[color + op] || (mats[color + op] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthTest: false, depthWrite: false }));
    const up = new THREE.Vector3(0, 1, 0);
    const put = (m) => { m.renderOrder = 21; m.userData.noPick = true; m.userData.eletrica = true; g.add(m); };
    const tube = (a, b, r, m) => {
      const A = new THREE.Vector3(a[0] * MM, a[2] * MM, a[1] * MM), B = new THREE.Vector3(b[0] * MM, b[2] * MM, b[1] * MM), L = A.distanceTo(B);
      if (L < 0.005) return;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), m);
      cyl.position.copy(A).add(B).multiplyScalar(0.5);
      cyl.quaternion.setFromUnitVectors(up, B.clone().sub(A).normalize());
      put(cyl);
    };
    const zc = lv + TETO;
    conduitsOf(fl).forEach(({ c, a, b }) => {
      const m = mat(COLOR[c.tipo], 0.85), r = 0.012;
      tube([a.x, a.y, zc], [b.x, a.y, zc], r, m);
      tube([b.x, a.y, zc], [b.x, b.y, zc], r, m);
      if (!b.root && b.z < TETO) tube([b.x, b.y, zc], [b.x, b.y, lv + b.z], r, m);
    });
    CIRC.forEach((c) => c.baixo.filter((b) => b.fl === fl).forEach((b) => b.path.slice(1).forEach((q, i) => tube([b.path[i][0], b.path[i][1], lv + b.path[i][2]], [q[0], q[1], lv + q[2]], 0.014, mat(COLOR[c.tipo], 0.9)))));
    // subida do quadro do andar até a laje, alimentadores dos quadros de andar e prumada do QDT (rede)
    const R = BOARDS[fl];
    tube([R.x, R.y, lv + 1500], [R.x, R.y, zc], 0.02, mat('#555555', 0.9));
    if (fl === 'T') Object.values(SUB_ROUTE).forEach((Rt) => Rt.slice(1).forEach((q, i) => tube(Rt[i], q, 0.02, mat(COLOR.alim, 0.9))));
    tube([QDT_XY.x, QDT_XY.y, fl === 'T' ? 1700 : lv - 160], [QDT_XY.x, QDT_XY.y, zc], 0.016, mat(COLOR.tel, 0.9));
    telConduits(fl).forEach(({ a, b }) => {
      const m = mat(COLOR.tel, 0.85), r = 0.011;
      tube([a.x, a.y, zc], [b.x, a.y, zc], r, m);
      tube([b.x, a.y, zc], [b.x, b.y, zc], r, m);
      if (!b.root && b.z < TETO) tube([b.x, b.y, zc], [b.x, b.y, lv + b.z], r, m);
    });
    if (fl === 'T')
      [[ALIM_ROUTE, COLOR.alim, 0.022], [TEL_ROUTE, COLOR.tel, 0.016]].forEach(([Rt, col, r]) => Rt.slice(1).forEach((q, i) => tube(Rt[i], q, r, mat(col, 0.9))));
    ptsOf(fl).forEach((p) => {
      const col = p.k === 'tel' ? COLOR.tel : p.k === 'tue' ? COLOR.tue : p.k === 'tug' ? COLOR.tug : p.k === 'qdc' || p.k === 'medidor' ? COLOR.qdc : COLOR.il;
      const sz = p.k === 'qdc' ? (p.id === 'QDC' ? [0.5, 0.7, 0.12] : [0.4, 0.5, 0.12]) : p.tel === 'qdt' ? [0.4, 0.4, 0.12] : p.k === 'il' || p.tel === 'ap' || p.tel === 'roteador' ? [0.12, 0.05, 0.12] : [0.07, 0.1, 0.07];
      const m = new THREE.Mesh(new THREE.BoxGeometry(sz[0], sz[1], sz[2]), mat(col, 1));
      m.position.set(p.x * MM, (lv + p.z) * MM, p.y * MM);
      put(m);
    });
    return g;
  }

  DD.eletrica = {
    LEVEL, TETO, VFN, VFF, RHO, DV_MAX, DV_TOTAL, ALIM_SECAO, FCA, FCT, QDC_XY, QDT_XY, RISER, BOARDS, FATORES, CENARIO, COBERTO, coberto, SUB, SUB_ROUTE, FASES_Q, COMPARA, ALIM_ROUTE, TEL_ROUTE, TEL, PONTOS, PBY, IZ2, IZ3, CIRC, FASES, DRS, ALIM, QT, CAP,
    COLOR, TIPO_NAME, fmtm, fmtn, planKey, conduits: conduitsOf, telConduits, routeXY, symbol, draw2dWorld, draw2dScreen, build3d,
  };
})();
