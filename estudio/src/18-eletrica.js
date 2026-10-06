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
  const DV_MAX = 4, DV_ALIM = 1; // % — circuitos terminais e alimentador (total ≤ 5 %, NBR 5410 6.2.7)
  const FCA = 0.7;              // agrupamento: até 3 circuitos por eletroduto (Tabela 42)
  const FCT = 1.0;              // 30 °C (Tabela 40, PVC)
  const QDC_XY = { x: 6650, y: 8750 }; // quadro sob a escada (prumada sobe na mesma parede)

  // <PONTOS> gerado por tools/gera-eletrica.js — não editar à mão
  const PONTOS = [
    {id: "T-IL1", fl: "T", k: "il", tipo: "teto", amb: "Cozinha", x: 2900, y: 5800, z: 2780, va: 220, desc: "Ponto de luz no teto — Cozinha"},
    {id: "T-S1", fl: "T", k: "int", amb: "Cozinha", x: 3025, y: 3000, z: 1100, liga: ["T-IL1"], desc: "Interruptor simples — Cozinha"},
    {id: "T-T1", fl: "T", k: "tug", amb: "Cozinha", x: 1650, y: 5150, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Cozinha"},
    {id: "T-T2", fl: "T", k: "tug", amb: "Cozinha", x: 1650, y: 6550, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Cozinha"},
    {id: "T-T3", fl: "T", k: "tug", amb: "Cozinha", x: 1650, y: 4350, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Cozinha"},
    {id: "T-T4", fl: "T", k: "tug", amb: "Cozinha", x: 4150, y: 4850, z: 300, va: 100, molhada: true, desc: "TUG — Cozinha"},
    {id: "T-T5", fl: "T", k: "tug", amb: "Cozinha", x: 1650, y: 7500, z: 300, va: 100, molhada: true, desc: "TUG — Cozinha"},
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
    {id: "T-T12", fl: "T", k: "tug", amb: "Sala", x: 4310, y: 8750, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Sala"},
    {id: "T-T13", fl: "T", k: "tug", amb: "Sala", x: 8850, y: 10430, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Sala"},
    {id: "T-T14", fl: "T", k: "tug", amb: "Sala", x: 8550, y: 14850, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Sala"},
    {id: "T-T15", fl: "T", k: "tug", amb: "Sala", x: 4300, y: 14530, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Sala"},
    {id: "T-T16", fl: "T", k: "tug", amb: "Sala", x: 4300, y: 10710, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Sala"},
    {id: "T-IL8", fl: "T", k: "il", tipo: "teto", amb: "Garagem", x: 2150, y: 11850, z: 2780, va: 140, desc: "Ponto de luz no teto — Garagem"},
    {id: "T-IL9", fl: "T", k: "il", tipo: "teto", amb: "Garagem", x: 2150, y: 13650, z: 2780, va: 140, desc: "Ponto de luz no teto — Garagem"},
    {id: "T-S7", fl: "T", k: "int", amb: "Garagem", x: 3050, y: 10500, z: 1100, liga: ["T-IL8","T-IL9"], desc: "Interruptor simples — Garagem"},
    {id: "T-T17", fl: "T", k: "tug", amb: "Garagem", x: 4150, y: 11650, z: 300, va: 100, molhada: true, externa: false, desc: "TUG — Garagem"},
    {id: "T-T18", fl: "T", k: "tug", amb: "Garagem", x: 150, y: 14750, z: 300, va: 100, molhada: true, externa: false, desc: "TUG — Garagem"},
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
    {id: "1-S3", fl: "1", k: "int", amb: "Quarto Master", x: 4250, y: 4750, z: 1100, liga: ["1-IL3","1-IL4"], desc: "Interruptor simples — Quarto Master"},
    {id: "1-T5", fl: "1", k: "tug", amb: "Quarto Master", x: 6213, y: 4750, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto Master"},
    {id: "1-T6", fl: "1", k: "tug", amb: "Quarto Master", x: 7350, y: 6588, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto Master"},
    {id: "1-T7", fl: "1", k: "tug", amb: "Quarto Master", x: 5338, y: 8600, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto Master"},
    {id: "1-T8", fl: "1", k: "tug", amb: "Quarto Master", x: 3150, y: 6763, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto Master"},
    {id: "1-AC1", fl: "1", k: "tue", eq: "ac", amb: "Quarto Master", x: 7350, y: 7750, z: 2200, va: 1500, v: 220, desc: "Ar-condicionado split 12.000 BTU/h (1.500 VA, 220 V) — Quarto Master — parede lateral, depois da janela"},
    {id: "1-IL5", fl: "1", k: "il", tipo: "teto", amb: "Suíte", x: 2325, y: 6125, z: 2780, va: 100, desc: "Ponto de luz no teto — Suíte"},
    {id: "1-S4", fl: "1", k: "int", amb: "Suíte", x: 3000, y: 5775, z: 1100, liga: ["1-IL5"], desc: "Interruptor simples — Suíte"},
    {id: "1-T9", fl: "1", k: "tug", amb: "Suíte", x: 1650, y: 4750, z: 1100, va: 600, molhada: true, desc: "TUG junto ao lavatório (≥ 0,60 m do box) — Suíte"},
    {id: "1-IL6", fl: "1", k: "il", tipo: "teto", amb: "Banhº", x: 2325, y: 9000, z: 2780, va: 100, desc: "Ponto de luz no teto — Banhº"},
    {id: "1-S5", fl: "1", k: "int", amb: "Banhº", x: 3000, y: 9325, z: 1100, liga: ["1-IL6"], desc: "Interruptor simples — Banhº"},
    {id: "1-T10", fl: "1", k: "tug", amb: "Banhº", x: 1650, y: 9220, z: 1100, va: 600, molhada: true, desc: "TUG junto ao lavatório (≥ 0,60 m do box) — Banhº"},
    {id: "1-IL7", fl: "1", k: "il", tipo: "teto", amb: "Circulação", x: 6000, y: 9550, z: 2780, va: 100, desc: "Ponto de luz no teto — Circulação"},
    {id: "1-S6", fl: "1", k: "int", amb: "Circulação", x: 3150, y: 9325, z: 1100, liga: ["1-IL7"], desc: "Interruptor simples — Circulação"},
    {id: "1-T11", fl: "1", k: "tug", amb: "Circulação", x: 4400, y: 8750, z: 300, va: 100, molhada: true, externa: false, desc: "TUG — Circulação"},
    {id: "1-T12", fl: "1", k: "tug", amb: "Circulação", x: 5500, y: 10350, z: 300, va: 100, molhada: true, externa: false, desc: "TUG — Circulação"},
    {id: "1-IL8", fl: "1", k: "il", tipo: "teto", amb: "Quarto 1", x: 2150, y: 11805, z: 2780, va: 110, desc: "Ponto de luz no teto — Quarto 1"},
    {id: "1-IL9", fl: "1", k: "il", tipo: "teto", amb: "Quarto 1", x: 2150, y: 13545, z: 2780, va: 110, desc: "Ponto de luz no teto — Quarto 1"},
    {id: "1-S7", fl: "1", k: "int", amb: "Quarto 1", x: 3700, y: 14850, z: 1100, liga: ["1-IL8","1-IL9"], desc: "Interruptor simples — Quarto 1"},
    {id: "1-T13", fl: "1", k: "tug", amb: "Quarto 1", x: 2238, y: 10500, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 1"},
    {id: "1-T14", fl: "1", k: "tug", amb: "Quarto 1", x: 4150, y: 12763, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 1"},
    {id: "1-T15", fl: "1", k: "tug", amb: "Quarto 1", x: 2063, y: 14850, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 1"},
    {id: "1-T16", fl: "1", k: "tug", amb: "Quarto 1", x: 150, y: 12588, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 1"},
    {id: "1-AC2", fl: "1", k: "tue", eq: "ac", amb: "Quarto 1", x: 1700, y: 14850, z: 2450, va: 1500, v: 220, desc: "Ar-condicionado split 12.000 BTU/h (1.500 VA, 220 V) — Quarto 1 — acima da janela (fachada)"},
    {id: "1-IL10", fl: "1", k: "il", tipo: "teto", amb: "Quarto 2", x: 5529, y: 12675, z: 2780, va: 140, desc: "Ponto de luz no teto — Quarto 2"},
    {id: "1-IL11", fl: "1", k: "il", tipo: "teto", amb: "Quarto 2", x: 7622, y: 12675, z: 2780, va: 140, desc: "Ponto de luz no teto — Quarto 2"},
    {id: "1-S8", fl: "1", k: "int", amb: "Quarto 2", x: 6000, y: 14850, z: 1100, liga: ["1-IL10","1-IL11"], desc: "Interruptor simples — Quarto 2"},
    {id: "1-T17", fl: "1", k: "tug", amb: "Quarto 2", x: 6525, y: 10500, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 2"},
    {id: "1-T18", fl: "1", k: "tug", amb: "Quarto 2", x: 8850, y: 12625, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 2"},
    {id: "1-T19", fl: "1", k: "tug", amb: "Quarto 2", x: 6925, y: 14850, z: 300, va: 100, molhada: false, externa: false, desc: "TUG — Quarto 2"},
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
    {id: "2-T1", fl: "2", k: "tug", amb: "Varanda coberta", x: 1650, y: 5150, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Varanda coberta"},
    {id: "2-T2", fl: "2", k: "tug", amb: "Varanda coberta", x: 1650, y: 6550, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Varanda coberta"},
    {id: "2-T3", fl: "2", k: "tug", amb: "Varanda coberta", x: 1650, y: 4350, z: 1100, va: 600, molhada: true, desc: "TUG da bancada (600 VA) — Varanda coberta"},
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
    {id: "T-CH1", fl: "T", k: "tue", eq: "chuveiro", amb: "Suíte", x: 6950, y: 2990, z: 2200, va: 7500, v: 220, desc: "Chuveiro elétrico 7.500 W (220 V) — ponto T-CH2"},
    {id: "1-CH1", fl: "1", k: "tue", eq: "chuveiro", amb: "Suíte", x: 2325, y: 7530, z: 2200, va: 7500, v: 220, desc: "Chuveiro elétrico 7.500 W (220 V) — ponto 1-CH-S"},
    {id: "1-CH2", fl: "1", k: "tue", eq: "chuveiro", amb: "Banhº", x: 2325, y: 7620, z: 2200, va: 7500, v: 220, desc: "Chuveiro elétrico 7.500 W (220 V) — ponto 1-CH-B"},
    {id: "2-ML1", fl: "2", k: "tue", eq: "mlr", amb: "Área de serviço", x: 2100, y: 8610, z: 1100, va: 1200, v: 127, molhada: true, desc: "Máquina de lavar roupa (1.200 VA, 127 V)"},
    {id: "QDC", fl: "T", k: "qdc", amb: "Sala (sob a escada)", x: 6650, y: 8750, z: 1500, desc: "Quadro de distribuição (QDC) — sob a escada, parede do quarto"},
    {id: "PE", fl: "T", k: "medidor", amb: "Muro da frente", x: 7400, y: 19850, z: 1500, desc: "Padrão de entrada / medição (Enel) com haste de aterramento"},
    {id: "T-MO1", fl: "T", k: "tue", eq: "microondas", amb: "Cozinha", x: 4150, y: 6900, z: 1600, va: 1500, v: 127, molhada: true, desc: "Micro-ondas / forno (1.500 VA, 127 V)"},
    {id: "T-PT1", fl: "T", k: "tue", eq: "portao", amb: "Garagem (portão)", x: 4400, y: 19850, z: 400, va: 600, v: 127, externa: true, desc: "Motor do portão eletrônico ½ cv (600 VA)"},
    {id: "T-IL-E1", fl: "T", k: "il", tipo: "arandela", amb: "Fachada", x: 4650, y: 15000, z: 2200, va: 100, externa: true, desc: "Arandela externa — fachada, ao lado da porta"},
    {id: "T-IL-E2", fl: "T", k: "il", tipo: "arandela", amb: "Fachada", x: 6450, y: 15000, z: 2200, va: 100, externa: true, desc: "Arandela externa — fachada"},
    {id: "T-IL-E3", fl: "T", k: "il", tipo: "arandela", amb: "Quintal", x: 4300, y: 2850, z: 2200, va: 100, externa: true, desc: "Arandela externa — quintal (fundos)"},
    {id: "T-IL-E4", fl: "T", k: "il", tipo: "arandela", amb: "Corredor lateral", x: 1500, y: 6000, z: 2200, va: 100, externa: true, desc: "Arandela externa — corredor lateral"},
    {id: "T-S-E", fl: "T", k: "int", amb: "Sala", x: 4700, y: 14850, z: 1100, liga: ["T-IL-E1","T-IL-E2"], desc: "Interruptor das arandelas da fachada (junto à porta de entrada)"},
    {id: "T-S-Q", fl: "T", k: "int", amb: "Cozinha", x: 3025, y: 3000, z: 1100, liga: ["T-IL-E3","T-IL-E4"], desc: "Interruptor das arandelas do quintal e do corredor (junto à porta dos fundos) (mesma caixa do T-S1)", caixa: "T-S1"},
    {id: "T-T-E1", fl: "T", k: "tug", amb: "Quintal", x: 2600, y: 2850, z: 600, va: 100, molhada: true, externa: true, desc: "TUG externa IP44 — quintal"},
    {id: "T-IL-ESC", fl: "T", k: "il", tipo: "arandela", amb: "Escada", x: 8850, y: 9550, z: 2400, va: 100, desc: "Arandela da escada (térreo → 1º)"},
    {id: "T-S3a", fl: "T", k: "int3", amb: "Escada", x: 5900, y: 8750, z: 1100, liga: ["T-IL-ESC"], desc: "Interruptor paralelo — pé da escada (térreo)"},
    {id: "1-S3b", fl: "1", k: "int3", amb: "Circulação", x: 5900, y: 8750, z: 1100, liga: ["T-IL-ESC"], desc: "Interruptor paralelo — chegada da escada (1º)"},
    {id: "1-IL-ESC", fl: "1", k: "il", tipo: "arandela", amb: "Escada", x: 8850, y: 9550, z: 2400, va: 100, desc: "Arandela da escada (1º → 2º)"},
    {id: "1-S3a", fl: "1", k: "int3", amb: "Circulação", x: 5900, y: 10350, z: 1100, liga: ["1-IL-ESC"], desc: "Interruptor paralelo — pé da escada (1º)"},
    {id: "2-S3b", fl: "2", k: "int3", amb: "Varanda coberta", x: 6300, y: 8600, z: 1100, liga: ["1-IL-ESC"], desc: "Interruptor paralelo — chegada da escada (2º)"},
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
  function balance() {
    const load = { A: 0, B: 0, C: 0 };
    CIRC.slice().sort((a, b) => b.va - a.va).forEach((c) => {
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
  const FASES = balance();

  // ------------------------------------------------------------------ caminhos (laje + descidas) e comprimentos
  const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  /** Árvore (Prim, distância ortogonal) ligando a prumada do quadro aos pontos do circuito naquele pavimento. */
  function tree(fl, ids) {
    const root = { id: 'R' + fl, x: QDC_XY.x, y: QDC_XY.y, z: TETO, fl, root: true };
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
  /** Subida do quadro (z = 1,50 m no térreo) até a laje do pavimento. */
  const rise = (fl) => LEVEL[fl] + TETO - 1500;
  function routeCircuit(c) {
    const byFl = {};
    c.pts.forEach((id) => (byFl[PBY[id].fl] = byFl[PBY[id].fl] || []).push(id));
    c.trees = {};
    let horiz = 0, drops = 0, risers = 0, Lmax = 0;
    Object.keys(byFl).forEach((fl) => {
      const t = tree(fl, byFl[fl]);
      c.trees[fl] = t;
      horiz += t.edges.reduce((s, e) => s + e.L, 0);
      drops += byFl[fl].reduce((s, id) => s + Math.max(0, TETO - PBY[id].z), 0);
      risers += rise(fl);
      // caminho até o ponto mais distante (para a queda de tensão)
      const depth = new Map([[t.root, 0]]);
      t.edges.forEach((e) => depth.set(e.b, depth.get(e.a) + e.L));
      byFl[fl].forEach((id) => (Lmax = Math.max(Lmax, rise(fl) + depth.get(PBY[id]) + Math.max(0, TETO - PBY[id].z))));
    });
    c.conduite = horiz + drops + risers; // mm de eletroduto do circuito
    c.Lmax = Lmax;
    c.cond = c.tipo === 'il' ? 3 : 3; // F + N (ou F + F) + PE; retornos contados à parte
    c.retorno = c.tipo === 'il' ? c.pts.filter((id) => /int/.test(PBY[id].k)).reduce((s, id) => s + (TETO - PBY[id].z), 0) * 1 : 0;
  }
  CIRC.forEach(routeCircuit);

  // ------------------------------------------------------------------ dimensionamento
  function size(c) {
    c.ib = c.va / c.v;
    c.fca = c.eq === 'chuveiro' ? 1 : FCA; // chuveiros em eletroduto exclusivo
    c.disj = DISJ.find((d) => d >= c.ib);
    let s = SECOES.find((x) => x >= (c.tipo === 'il' ? 1.5 : 2.5) && IZ2[x] * c.fca * FCT >= c.disj);
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
  const DRS = [
    { id: 'DR-1', polos: 4, desc: 'Iluminação', f: (c) => c.tipo === 'il' },
    { id: 'DR-2', polos: 4, desc: 'Tomadas de uso geral e da cozinha/banheiros', f: (c) => c.tipo === 'tug' },
    { id: 'DR-3', polos: 4, desc: 'Ar-condicionado, micro-ondas, máquina e portão', f: (c) => c.tipo === 'tue' && c.eq !== 'chuveiro' },
  ];
  DRS.forEach((d) => {
    d.circ = CIRC.filter(d.f).map((c) => c.n);
    const ia = ['A', 'B', 'C'].map((ph) => CIRC.filter(d.f).filter((c) => c.fases.includes(ph)).reduce((s, c) => s + (c.v === VFF ? c.va / VFF : c.va / VFN), 0));
    d.in = [25, 40, 63, 80, 100].find((x) => x >= Math.max(...ia)) || 100; // corrente nominal ≥ maior corrente de fase do grupo
  });
  CIRC.filter((c) => c.eq === 'chuveiro').forEach((c) => DRS.push({ id: 'DR-' + (DRS.length + 1), polos: 2, desc: c.desc, circ: [c.n], in: c.disj <= 40 ? 40 : 63 }));
  CIRC.forEach((c) => (c.dr = (DRS.find((d) => d.circ.includes(c.n)) || {}).id));

  // ------------------------------------------------------------------ demanda e alimentador
  function demanda() {
    const ilW = CIRC.filter((c) => c.tipo === 'il').reduce((s, c) => s + c.va, 0) * 1.0;
    const tugW = CIRC.filter((c) => c.tipo === 'tug').reduce((s, c) => s + c.va, 0) * 0.8;
    const it = (ilW + tugW) / 1000;
    // fator por faixa, aplicado de forma acumulada (cada kW na sua faixa)
    let rest = it, prev = 0, dIT = 0;
    FD_IT.forEach(([lim, f]) => { const part = Math.max(0, Math.min(rest, lim - prev)); dIT += part * f; rest -= part; prev = lim; });
    const tues = CIRC.filter((c) => c.tipo === 'tue');
    const pfTue = (c) => (c.eq === 'ac' ? 0.9 : c.eq === 'portao' ? 0.75 : 1);
    const tueW = tues.reduce((s, c) => s + c.va * pfTue(c), 0) / 1000;
    const fTue = FD_TUE[Math.min(tues.length, FD_TUE.length - 1)];
    const D = dIT + tueW * fTue; // kW
    const inst = (ilW + tugW) / 1000 + tueW;
    const I = (D * 1000) / (Math.sqrt(3) * VFF * 0.92);
    const L = man(PBY.PE || { x: 7400, y: 19850 }, QDC_XY) + 400 + 1500 + 1000; // vala (−0,40 m) + subida no muro e no quadro
    const disj = DISJ.find((d) => d >= I);
    let s = SECOES.find((x) => x >= 6 && IZ3[x] * FCT >= disj);
    const dv = (sec) => (100 * Math.sqrt(3) * RHO * (L / 1000) * I) / (sec * VFF);
    while (dv(s) > DV_ALIM && s < 50) s = SECOES[SECOES.indexOf(s) + 1];
    return { ilW, tugW, it, dIT, tueW, fTue, nTue: tues.length, D, inst, I, L, disj, secao: s, dv: dv(s), neutro: s, pe: s <= 16 ? s : 16 };
  }
  const ALIM = demanda();

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
    it('Eletrodutos', 'Eletroduto corrugado Ø 32 mm — prumada do quadro', 'm', Math.ceil((rise('2') / 1000) * 3), '3 prumadas do QDC (sob a escada) até as lajes do 1º e do 2º');
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
    // quadro
    const disj = {};
    CIRC.forEach((c) => { const k = (c.v === VFF ? '2P ' : '1P ') + c.disj + ' A'; disj[k] = (disj[k] || 0) + 1; });
    Object.keys(disj).sort().forEach((k) => it('Quadro', 'Disjuntor termomagnético DIN curva C ' + k, 'un', disj[k], 'circuitos terminais'));
    it('Quadro', 'Disjuntor geral DIN curva C 3P ' + ALIM.disj + ' A', 'un', 1, 'no QDC (o do padrão é definido pela Enel)');
    DRS.forEach((d) => it('Quadro', `Interruptor diferencial (DR) ${d.polos}P ${d.in} A 30 mA`, 'un', 1, d.id + ': ' + d.desc));
    it('Quadro', 'DPS classe II 275 V 20 kA', 'un', 4, '3 fases + neutro, no QDC (NBR 5410 6.3.5)');
    const mod = CIRC.reduce((s, c) => s + (c.v === VFF ? 2 : 1), 0) + 3 + DRS.reduce((s, d) => s + d.polos, 0) + 4;
    const qdc = [24, 36, 48, 56, 72].find((m) => m >= mod * 1.2) || 72;
    it('Quadro', `Quadro de distribuição de embutir ${qdc} módulos DIN, com barramentos trifásico, neutro e terra`, 'un', 1, mod + ' módulos ocupados + reserva (NBR 5410 6.5.4.7)');
    it('Aterramento', 'Haste de aterramento cobreada 5/8" × 2,40 m com conector', 'un', 3, 'no padrão de entrada, interligadas (medir ≤ 10 Ω)');
    it('Aterramento', 'Caixa de inspeção do aterramento 30×30', 'un', 1, '');
    it('Acessórios', 'Fita isolante, terminais, abraçadeiras, buchas e arruelas', 'vb', 1, '');
    return { cabos, items, modulos: mod, qdc };
  }
  const QT = quantities();

  // ================================================================================================ camada do estúdio
  const COLOR = { il: '#d39b00', tug: '#e0572f', tue: '#b4235a', qdc: '#2b2b2b', medidor: '#2b2b2b', int: '#d39b00', int3: '#d39b00' };
  const TIPO_NAME = { il: 'Iluminação', tug: 'Tomadas (TUG)', tue: 'Uso específico (TUE)' };
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
  /** Símbolo de um ponto na planta, em mm (contexto do mundo); s = tamanho base em mm. */
  function symbol(ctx, p, s, lw) {
    const col = p.k === 'tue' ? COLOR.tue : p.k === 'tug' ? COLOR.tug : p.k === 'qdc' || p.k === 'medidor' ? COLOR.qdc : COLOR.il;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
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
    const items = [['il', 'Iluminação'], ['tug', 'Tomadas'], ['tue', 'Uso específico']];
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
    // prumada do quadro
    if (fl === 'T' || CIRC.some((c) => c.trees[fl])) tube([QDC_XY.x, QDC_XY.y, fl === 'T' ? 1500 : lv - 160], [QDC_XY.x, QDC_XY.y, zc], 0.02, mat('#555555', 0.9));
    ptsOf(fl).forEach((p) => {
      const col = p.k === 'tue' ? COLOR.tue : p.k === 'tug' ? COLOR.tug : p.k === 'qdc' || p.k === 'medidor' ? COLOR.qdc : COLOR.il;
      const sz = p.k === 'qdc' ? [0.5, 0.6, 0.12] : p.k === 'il' ? [0.12, 0.05, 0.12] : [0.07, 0.1, 0.07];
      const m = new THREE.Mesh(new THREE.BoxGeometry(sz[0], sz[1], sz[2]), mat(col, 1));
      m.position.set(p.x * MM, (lv + p.z) * MM, p.y * MM);
      put(m);
    });
    return g;
  }

  DD.eletrica = {
    LEVEL, TETO, VFN, VFF, RHO, DV_MAX, DV_ALIM, FCA, FCT, QDC_XY, PONTOS, PBY, IZ2, IZ3, CIRC, FASES, DRS, ALIM, QT, CAP,
    COLOR, TIPO_NAME, fmtm, fmtn, planKey, conduits: conduitsOf, symbol, draw2dWorld, draw2dScreen, build3d,
  };
})();
