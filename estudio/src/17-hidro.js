// ===== 17-hidro.js — projeto hidrossanitário: dados, cálculo e camada "Hidráulica" do estúdio =====
// Fonte única do anteprojeto de água fria, esgoto e ventilação:
//   • hidrossanitario.html (plantas, 3D, memorial, materiais e pranchas em PDF) carrega este arquivo;
//   • o estúdio desenha os tubos por cima da casa na planta 2D e no 3D quando a camada "Hidráulica" está ligada
//     (ui.show.hidro) — draw2dWorld/draw2dScreen (20-plan2d.js) e build3d (30-view3d.js).
// O módulo não tem dados do projeto estrutural.
(function () {
  const DD = (window.DD = window.DD || {});

  // =====================================================================================================
  //  ANTEPROJETO HIDROSSANITÁRIO — Obra Mariára (as built)
  //  Coordenadas em mm no mesmo sistema do estúdio: x → direita (da divisa esquerda), y → rua (do fundo do lote),
  //  z = altura em relação ao piso acabado do térreo. Calçada externa a −0,36 m.
  //  Normas de referência: ABNT NBR 5626:2020 (água fria), NBR 8160:1999 (esgoto e ventilação),
  //  NBR 7229/13969 (só se não houver rede coletora). Pesos relativos: NBR 5626:1998 (método usual).
  // =====================================================================================================
  const L1 = 2880, L2 = 5760, LR = 8640; // pisos do 1º, 2º e laje de cobertura
  const ZG = -360;                       // calçada externa
  const VT = LR + 300;                   // topo dos terminais de ventilação (30 cm acima da cobertura não utilizável)
  const PLATAFORMA = 1000;               // altura da plataforma da caixa d'água sobre a laje
  const CX_BASE = LR + PLATAFORMA;       // fundo da caixa
  const NA_MIN = CX_BASE + 160;          // nível mínimo operacional (logo acima da saída)
  const PESSOAS = 8, PER_CAPITA = 150;   // 4 dormitórios × 2 pessoas; L/pessoa·dia (residência padrão médio)

  // ---------------------------------------------------------------------------------------------- aparelhos
  const TIPOS = {
    vaso:   { nome: 'Bacia sanitária c/ caixa acoplada', P: 0.3, q: 0.15, uhc: 6, dn: 100, sifao: true },
    lav:    { nome: 'Lavatório', P: 0.3, q: 0.15, uhc: 1, dn: 40, sifao: true },
    ch:     { nome: 'Chuveiro elétrico', P: 0.1, q: 0.10, uhc: 2, dn: 40, sifao: false },
    pia:    { nome: 'Pia de cozinha', P: 0.7, q: 0.25, uhc: 3, dn: 50, sifao: true },
    tanque: { nome: 'Tanque', P: 0.7, q: 0.25, uhc: 3, dn: 40, sifao: true },
    mlr:    { nome: 'Máquina de lavar roupa', P: 1.0, q: 0.30, uhc: 3, dn: 50, sifao: true, pmin: 20 },
    tj:     { nome: 'Torneira de jardim / lavagem', P: 0.4, q: 0.20, uhc: 0, sifao: false },
  };
  // fl: T | 1 | 2 · x,y: posição do aparelho (símbolo) · rot: costas para a parede (0 fundo, 90 dir, 180 frente, 270 esq)
  // cs: caixa sifonada que recebe o aparelho (lavatório/chuveiro) · es: ramal de descarga · af: nó de água fria
  const FX = [
    { id: 'T-PIA', fl: 'T', t: 'pia', amb: 'Cozinha', x: 1950, y: 5850, rot: 270, af: 'fTPIA', es: 'ETP' },
    { id: 'T-LAV1', fl: 'T', t: 'lav', amb: 'Lavabo', x: 1880, y: 9150, rot: 270, af: 'fTLAV1', es: 'ETL1', cs: 'CS-T1' },
    { id: 'T-VS1', fl: 'T', t: 'vaso', amb: 'Lavabo', x: 2500, y: 10025, rot: 180, af: 'fTVS1', es: 'ETV1' },
    { id: 'T-VS2', fl: 'T', t: 'vaso', amb: 'Suíte (térreo)', x: 6200, y: 3325, rot: 0, af: 'fTVS2', es: 'ETV2' },
    { id: 'T-CH2', fl: 'T', t: 'ch', amb: 'Suíte (térreo)', x: 6950, y: 3400, rot: 0, af: 'fTCH2', es: 'ETCh2', cs: 'CS-T2' },
    { id: 'T-LAV2', fl: 'T', t: 'lav', amb: 'Suíte (térreo)', x: 5280, y: 4230, rot: 270, af: 'fTLAV2', es: 'ETL2', cs: 'CS-T2' },
    { id: 'T-TJQ', fl: 'T', t: 'tj', amb: 'Quintal (fundos)', x: 6450, y: 2700, rot: 0, af: 'fTJQ' },
    { id: 'T-TJG', fl: 'T', t: 'tj', amb: 'Garagem', x: 4000, y: 12500, rot: 90, af: 'fTJG', direto: true },
    { id: 'T-TJF', fl: 'T', t: 'tj', amb: 'Jardim da frente', x: 7100, y: 19700, rot: 180, af: 'fTJF', direto: true },
    { id: '1-LAV-S', fl: '1', t: 'lav', amb: 'Banheiro da suíte (1º)', x: 1880, y: 5200, rot: 270, af: 'f1LAVS', es: 'E1SL', cs: 'CS-1S' },
    { id: '1-VS-S', fl: '1', t: 'vaso', amb: 'Banheiro da suíte (1º)', x: 1975, y: 6150, rot: 270, af: 'f1VSS', es: 'E1SV' },
    { id: '1-CH-S', fl: '1', t: 'ch', amb: 'Banheiro da suíte (1º)', x: 2325, y: 7050, rot: 180, af: 'f1CHS', es: 'E1SCh', cs: 'CS-1S' },
    { id: '1-CH-B', fl: '1', t: 'ch', amb: 'Banheiro (1º)', x: 2325, y: 8125, rot: 0, af: 'f1CHB', es: 'E1BCh', cs: 'CS-1B' },
    { id: '1-VS-B', fl: '1', t: 'vaso', amb: 'Banheiro (1º)', x: 1975, y: 8980, rot: 270, af: 'f1VSB', es: 'E1BV' },
    { id: '1-LAV-B', fl: '1', t: 'lav', amb: 'Banheiro (1º)', x: 1880, y: 9670, rot: 270, af: 'f1LAVB', es: 'E1BL', cs: 'CS-1B' },
    { id: '2-PIA', fl: '2', t: 'pia', amb: 'Varanda gourmet (2º)', x: 1950, y: 5850, rot: 270, af: 'f2PIA', es: 'E2P' },
    { id: '2-MLR', fl: '2', t: 'mlr', amb: 'Área de serviço (2º)', x: 1950, y: 8275, rot: 180, af: 'f2MLR', es: 'E2M' },
    { id: '2-TQ', fl: '2', t: 'tanque', amb: 'Área de serviço (2º)', x: 2700, y: 8325, rot: 180, af: 'f2TQ', es: 'E2T' },
    { id: '2-LAV', fl: '2', t: 'lav', amb: 'Lavabo (2º)', x: 1880, y: 9300, rot: 270, af: 'f2LAV', es: 'E2L1', cs: 'CS-2L' },
    { id: '2-VS', fl: '2', t: 'vaso', amb: 'Lavabo (2º)', x: 2575, y: 10025, rot: 180, af: 'f2VS', es: 'E2V' },
  ];
  const FXBY = Object.fromEntries(FX.map((f) => [f.id, f]));

  // ---------------------------------------------------------------------------------------------- ÁGUA FRIA
  // Nós (x, y, z). Trechos ligam nó a nó (a = montante, b = jusante); "via" são as curvas no caminho.
  const AFN = {
    CX: [1725, 7900, CX_BASE + 60], BR: [1650, 7900, LR + 100],
    // AF-1 — prumada do shaft interno SH-1 (lavabo térreo / banheiro 1º / lavabo 2º)
    A1T: [2130, 10300, LR + 100], A1_2: [2130, 10300, L2 + 1200], A1_1: [2130, 10300, L1 + 1200], A1_0: [2130, 10300, 1200],
    R2: [1900, 10360, L2 + 1200], K2: [1720, 10360, L2 + 1200], L2n: [1640, 9300, L2 + 1200], S2n: [1640, 8610, L2 + 1200], M2n: [1800, 8610, L2 + 1200],
    f2VS: [2725, 10360, L2 + 200], f2LAV: [1640, 9300, L2 + 600], f2MLR: [1800, 8610, L2 + 1100], f2TQ: [2700, 8610, L2 + 1100],
    R1: [1900, 10360, L1 + 1200], K1: [1720, 10360, L1 + 1200], B1L: [1640, 9670, L1 + 1200], B1V: [1640, 9130, L1 + 1200], SW2: [2325, 7575, L1 + 1200],
    f1LAVB: [1640, 9670, L1 + 600], f1VSB: [1640, 9130, L1 + 200], f1CHB: [2325, 7620, L1 + 2100], f1CHS: [2325, 7530, L1 + 2100],
    SR: [2450, 7575, L1 + 1800], SUc: [1700, 5650, L2 - 580], f1VSS: [1640, 6000, L1 + 200], f1LAVS: [1640, 5200, L1 + 600],
    R0: [1900, 10360, 1200], f0VS: [2650, 10360, 200], fTLAV1: [1640, 9150, 600],
    // AF-2 — shaft externo SH-2 (pias do térreo e do 2º)
    A2T: [1300, 6850, LR + 100], A2_2: [1300, 6850, L2 + 600], G2: [1300, 6500, L2 + 600], f2PIA: [1650, 5850, L2 + 600],
    A2_0: [1300, 6850, 600], G0: [1300, 6500, 600], fTPIA: [1650, 5850, 600],
    // AF-3 — shaft externo dos fundos SH-3 (suíte do térreo e torneira do quintal)
    A3T: [6450, 2780, LR + 100], A3_0: [6450, 2780, 1200], fTJQ: [6450, 2780, 600], R3: [6450, 2990, 1200], V3: [6350, 2990, 1200],
    fTVS2: [6350, 2990, 200], fTCH2: [6950, 2990, 2100], fTLAV2: [5040, 4230, 600],
  };
  AFN.fTVS1 = AFN.f0VS;
  const AFE = [
    { id: 'BAR', a: 'CX', b: 'BR', via: [[1650, 7900, CX_BASE + 60]], fl: 'C', tag: 'Barrilete', rg: 'Registro geral da caixa' },
    { id: 'AF1-c', a: 'BR', b: 'A1T', via: [[1650, 10300, LR + 100]], fl: 'C', tag: 'AF-1', rg: 'Registro da coluna AF-1' },
    { id: 'AF1-2', a: 'A1T', b: 'A1_2', fl: 'v', tag: 'AF-1' },
    { id: 'AF1-1', a: 'A1_2', b: 'A1_1', fl: 'v', tag: 'AF-1' },
    { id: 'AF1-0', a: 'A1_1', b: 'A1_0', fl: 'v', tag: 'AF-1' },
    { id: '2-r', a: 'A1_2', b: 'R2', fl: '2', rg: 'Registro do lavabo e serviço (2º)' },
    { id: '2-vs', a: 'R2', b: 'f2VS', via: [[2725, 10360, L2 + 1200]], fl: '2' },
    { id: '2-k', a: 'R2', b: 'K2', fl: '2' },
    { id: '2-l', a: 'K2', b: 'L2n', via: [[1720, 9980, L2 + 1200], [1640, 9980, L2 + 1200]], fl: '2' }, // contorna o pilar do canto pela boneca
    { id: '2-lav', a: 'L2n', b: 'f2LAV', fl: '2' },
    { id: '2-s', a: 'L2n', b: 'S2n', fl: '2' },
    { id: '2-m', a: 'S2n', b: 'M2n', fl: '2' },
    { id: '2-mlr', a: 'M2n', b: 'f2MLR', fl: '2' },
    { id: '2-tq', a: 'M2n', b: 'f2TQ', via: [[2700, 8610, L2 + 1200]], fl: '2' },
    { id: '1-r', a: 'A1_1', b: 'R1', fl: '1', rg: 'Registro do banheiro (1º)' },
    { id: '1-k', a: 'R1', b: 'K1', fl: '1' },
    { id: '1-bl', a: 'K1', b: 'B1L', via: [[1720, 9980, L1 + 1200], [1640, 9980, L1 + 1200]], fl: '1' }, // contorna o pilar do canto pela boneca
    { id: '1-lavb', a: 'B1L', b: 'f1LAVB', fl: '1' },
    { id: '1-bv', a: 'B1L', b: 'B1V', fl: '1' },
    { id: '1-vsb', a: 'B1V', b: 'f1VSB', fl: '1' },
    { id: '1-sw', a: 'B1V', b: 'SW2', via: [[1640, 7575, L1 + 1200]], fl: '1' },
    { id: '1-chb', a: 'SW2', b: 'f1CHB', via: [[2325, 7620, L1 + 1200]], fl: '1', rp: true },
    { id: '1-chs', a: 'SW2', b: 'f1CHS', via: [[2325, 7530, L1 + 1200]], fl: '1', rp: true },
    { id: '1-sr', a: 'SW2', b: 'SR', via: [[2450, 7575, L1 + 1200]], fl: '1', rg: 'Registro da suíte (1º)' },
    { id: '1-su', a: 'SR', b: 'SUc', via: [[2450, 7575, L2 - 580], [2450, 7450, L2 - 580], [1700, 7450, L2 - 580]], fl: '1' },
    { id: '1-vss', a: 'SUc', b: 'f1VSS', via: [[1640, 5650, L2 - 580], [1640, 5650, L1 + 200]], fl: '1' },
    { id: '1-lavs', a: 'SUc', b: 'f1LAVS', via: [[1700, 5200, L2 - 580], [1640, 5200, L2 - 580]], fl: '1' },
    { id: 'T-r', a: 'A1_0', b: 'R0', fl: 'T', rg: 'Registro do lavabo (térreo)' },
    { id: 'T-vs1', a: 'R0', b: 'fTVS1', via: [[2650, 10360, 1200]], fl: 'T' },
    { id: 'T-lav1', a: 'R0', b: 'fTLAV1', via: [[1720, 10360, 1200], [1720, 9980, 1200], [1640, 9980, 1200], [1640, 9150, 1200]], fl: 'T' }, // contorna o pilar do canto pela boneca
    { id: 'AF2-c', a: 'BR', b: 'A2T', via: [[1650, 6850, LR + 100]], fl: 'C', tag: 'AF-2', rg: 'Registro da coluna AF-2' },
    { id: 'AF2-2', a: 'A2T', b: 'A2_2', fl: 'v', tag: 'AF-2' },
    { id: '2-g', a: 'A2_2', b: 'G2', fl: '2', rg: 'Registro da pia gourmet (2º)' },
    { id: '2-pia', a: 'G2', b: 'f2PIA', via: [[1300, 5850, L2 + 600]], fl: '2' },
    { id: 'AF2-0', a: 'A2_2', b: 'A2_0', fl: 'v', tag: 'AF-2' },
    { id: 'T-g', a: 'A2_0', b: 'G0', fl: 'T', rg: 'Registro da cozinha (térreo)' },
    { id: 'T-pia', a: 'G0', b: 'fTPIA', via: [[1300, 5850, 600]], fl: 'T' },
    { id: 'AF3-c', a: 'BR', b: 'A3T', via: [[1650, 3100, LR + 100], [6450, 3100, LR + 100]], fl: 'C', tag: 'AF-3', rg: 'Registro da coluna AF-3' },
    { id: 'AF3-0', a: 'A3T', b: 'A3_0', fl: 'v', tag: 'AF-3' },
    { id: 'T-tjq', a: 'A3_0', b: 'fTJQ', fl: 'T' },
    { id: 'T-r3', a: 'A3_0', b: 'R3', fl: 'T', rg: 'Registro da suíte (térreo)' },
    { id: 'T-ch2', a: 'R3', b: 'fTCH2', via: [[6950, 2990, 1200]], fl: 'T', rp: true },
    { id: 'T-v3', a: 'R3', b: 'V3', fl: 'T' },
    { id: 'T-vs2', a: 'V3', b: 'fTVS2', fl: 'T' },
    { id: 'T-lav2', a: 'V3', b: 'fTLAV2', via: [[5040, 2990, 1200], [5040, 4230, 1200]], fl: 'T' },
  ];
  // Alimentador predial (rede pública → hidrômetro → caixa d'água) e saídas diretas da rede (torneiras externas)
  const ALN = { HD: [6750, 19800, 400], AL2: [6750, 19500, -760], AL4: [3850, 12500, -760], CXE: [2500, 8700, CX_BASE + 1000], fTJG: [4100, 12500, 600], fTJF: [7100, 19850, 600] };
  const ALE = [
    { id: 'AL-a', a: 'HD', b: 'AL2', via: [[6750, 19800, -760]], fl: 'T', tag: 'Alimentador' },
    { id: 'AL-b', a: 'AL2', b: 'AL4', via: [[3850, 19500, -760]], fl: 'T', tag: 'Alimentador' },
    { id: 'AL-c', a: 'AL4', b: 'CXE', via: [[3850, 10600, -760], [2200, 10600, -760], [2200, 10300, -760], [2200, 10300, LR + 100], [2500, 10300, LR + 100], [2500, 8700, LR + 100]], fl: 'T', tag: 'Alimentador' },
    { id: 'AL-g', a: 'AL4', b: 'fTJG', via: [[4100, 12500, -760]], fl: 'T', tag: 'Torneira da garagem (direto da rede)' },
    { id: 'AL-f', a: 'AL2', b: 'fTJF', via: [[7100, 19500, -760], [7100, 19850, -760]], fl: 'T', tag: 'Torneira da frente (direto da rede)' },
    { id: 'LADRAO', a: null, b: null, pts: [[3275, 7900, CX_BASE + 900], [3650, 7900, CX_BASE + 900], [3650, 7900, LR + 50]], fl: 'C', tag: 'Extravasor (ladrão)', dn: 32 },
    { id: 'LIMPEZA', a: null, b: null, pts: [[3275, 8000, CX_BASE + 40], [3550, 8000, CX_BASE + 40], [3550, 8000, LR + 50]], fl: 'C', tag: 'Limpeza da caixa', dn: 32 },
  ];

  // ---------------------------------------------------------------------------------------------- ESGOTO E VENTILAÇÃO
  // Construtor de caminhos: v(z) desce/sobe na vertical; h(x,y) anda na horizontal com a declividade do trecho.
  function pb(x, y, z, s) {
    const p = [[x, y, z]];
    const api = {
      v(zz) { const l = p[p.length - 1]; p.push([l[0], l[1], zz]); return api; },
      h(xx, yy) { const l = p[p.length - 1]; const d = Math.hypot(xx - l[0], yy - l[1]); p.push([xx, yy, l[2] - (s || 0) * d]); return api; },
      pt(xx, yy, zz) { p.push([xx, yy, zz]); return api; },
      get: () => p,
    };
    return api;
  }
  // kind: ramal | tq (prumada) | base (pé do tubo de queda) | col (subcoletor/coletor) | ve (ventilação)
  const ES = [
    // 2º pavimento
    { id: 'E2V', dn: 100, s: 0.01, pts: pb(2575, 10050, L2, 0.01).v(L2 - 260).h(2000, 10280).get(), to: 'TQ-1', fx: ['2-VS'], fl: '2', kind: 'ramal' },
    { id: 'E2L1', dn: 40, s: 0.02, pts: pb(1700, 9300, L2 + 450, 0.02).v(L2 - 60).h(2050, 9750).get(), to: 'CS-2L', fx: ['2-LAV'], fl: '2', kind: 'ramal' },
    { id: 'E2L2', dn: 75, s: 0.02, pts: pb(2050, 9750, L2 - 170, 0.02).v(L2 - 240).h(2000, 10280).get(), to: 'TQ-1', from: 'CS-2L', fl: '2', kind: 'ramal' },
    { id: 'E2P', dn: 50, s: 0.02, pts: pb(1700, 5850, L2 + 450, 0.02).h(1380, 5850).h(1380, 6650).get(), to: 'TG-1', fx: ['2-PIA'], fl: '2', kind: 'ramal' },
    { id: 'E2T', dn: 75, s: 0.02, pts: pb(2700, 8560, L2 + 450, 0.02).v(L2 + 330).h(1950, 8560).get(), to: 'E2M', fx: ['2-TQ'], fl: '2', kind: 'ramal' },
    { id: 'E2M', dn: 75, s: 0.02, pts: pb(1950, 8560, L2 + 315, 0.02).h(1650, 8560).h(1420, 8565).get(), to: 'TS-1', fx: ['2-MLR'], fl: '2', kind: 'ramal' },
    // 1º pavimento
    { id: 'E1BV', dn: 100, s: 0.01, pts: pb(1950, 8980, L1, 0.01).v(L1 - 260).h(1950, 10150).h(2000, 10280).get(), to: 'TQ-1', fx: ['1-VS-B'], fl: '1', kind: 'ramal' },
    { id: 'E1BL', dn: 40, s: 0.02, pts: pb(1700, 9670, L1 + 450, 0.02).v(L1 - 50).h(2550, 9300).get(), to: 'CS-1B', fx: ['1-LAV-B'], fl: '1', kind: 'ramal' },
    { id: 'E1BCh', dn: 40, s: 0.02, pts: pb(2325, 8125, L1 - 20, 0.02).h(2550, 9300).get(), to: 'CS-1B', fx: ['1-CH-B'], fl: '1', kind: 'ramal' },
    { id: 'E1BC', dn: 75, s: 0.02, pts: pb(2550, 9300, L1 - 120, 0.02).v(L1 - 230).h(2550, 10050).h(2060, 10280).get(), to: 'TQ-1', from: 'CS-1B', fl: '1', kind: 'ramal' },
    { id: 'E1SV', dn: 100, s: 0.01, pts: pb(1975, 6150, L1, 0.01).v(L1 - 260).h(1975, 7000).h(1745, 7225).get(), to: 'TQ-2', fx: ['1-VS-S'], fl: '1', kind: 'ramal' },
    { id: 'E1SL', dn: 40, s: 0.02, pts: pb(1700, 5200, L1 + 450, 0.02).v(L1 - 50).h(2250, 6500).get(), to: 'CS-1S', fx: ['1-LAV-S'], fl: '1', kind: 'ramal' },
    { id: 'E1SCh', dn: 40, s: 0.02, pts: pb(2325, 7050, L1 - 20, 0.02).h(2250, 6500).get(), to: 'CS-1S', fx: ['1-CH-S'], fl: '1', kind: 'ramal' },
    { id: 'E1SC', dn: 75, s: 0.02, pts: pb(2250, 6500, L1 - 120, 0.02).v(L1 - 220).h(2250, 6900).h(1975, 6900).get(), to: 'E1SV', from: 'CS-1S', fl: '1', kind: 'ramal' },
    // térreo (ramais enterrados)
    { id: 'ETP', dn: 75, s: 0.02, pts: pb(1700, 5850, 450, 0.02).v(150).h(1380, 5850).h(1380, 6650).get(), to: 'TG-1', fx: ['T-PIA'], fl: 'T', kind: 'ramal' },
    { id: 'ETV1', dn: 100, s: 0.01, pts: pb(2500, 10050, 0, 0.01).v(-640).h(2500, 9850).h(650, 9850).h(650, 9650).get(), to: 'CI-3', fx: ['T-VS1'], fl: 'T', kind: 'ramal' },
    { id: 'ETL1', dn: 40, s: 0.02, pts: pb(1700, 9150, 450, 0.02).v(-100).h(2050, 9600).get(), to: 'CS-T1', fx: ['T-LAV1'], fl: 'T', kind: 'ramal' },
    { id: 'ETC1', dn: 75, s: 0.02, pts: pb(2050, 9600, -150, 0.02).h(2050, 9790).pt(2050, 9850, -600).get(), to: 'ETV1', from: 'CS-T1', fl: 'T', kind: 'ramal' },
    { id: 'ETV2', dn: 100, s: 0.01, pts: pb(6200, 3300, 0, 0.01).v(-640).h(6200, 2450).h(850, 2450).get(), to: 'CI-1', fx: ['T-VS2'], fl: 'T', kind: 'ramal' },
    { id: 'ETCh2', dn: 40, s: 0.02, pts: pb(6950, 3400, 0, 0.02).v(-100).h(6450, 3400).h(6450, 3900).get(), to: 'CS-T2', fx: ['T-CH2'], fl: 'T', kind: 'ramal' },
    { id: 'ETL2', dn: 40, s: 0.02, pts: pb(5280, 4230, 450, 0.02).v(-100).h(6450, 4230).h(6450, 3900).get(), to: 'CS-T2', fx: ['T-LAV2'], fl: 'T', kind: 'ramal' },
    { id: 'ETC2', dn: 75, s: 0.02, pts: pb(6450, 3900, -150, 0.02).h(6450, 3150).pt(6450, 3150, -560).pt(6200, 3000, -600).get(), to: 'ETV2', from: 'CS-T2', fl: 'T', kind: 'ramal' },
    // prumadas (tubos de queda) e prolongamentos (ventilação primária)
    { id: 'TQ-1', dn: 100, pts: [[2000, 10280, -800], [2000, 10280, L2 - 240]], to: 'BTQ1', fl: 'v', kind: 'tq', nome: 'Tubo de queda TQ-1 (shaft SH-1)' },
    { id: 'VP-1', dn: 100, pts: [[2000, 10280, L2 - 240], [2000, 10280, VT]], fl: 'v', kind: 've', sys: 'VE', nome: 'Ventilação primária do TQ-1' },
    { id: 'TQ-2', dn: 100, pts: [[1745, 7225, -750], [1745, 7225, L1 - 220]], to: 'BTQ2', fl: 'v', kind: 'tq', nome: 'Tubo de queda TQ-2 (canto do pilar P6)' },
    { id: 'VP-2', dn: 100, pts: [[1745, 7225, L1 - 220], [1745, 7225, L1 + 1020], [1380, 7225, L1 + 1030], [1380, 7225, VT]], fl: 'v', kind: 've', sys: 'VE', nome: 'Ventilação primária do TQ-2 (sai para o SH-2)' },
    { id: 'TG-1', dn: 75, pts: [[1380, 6650, -620], [1380, 6650, L2 + 430]], to: 'BTG1', fl: 'v', kind: 'tq', nome: 'Tubo de gordura TG-1 (shaft SH-2)' },
    { id: 'VP-TG', dn: 75, pts: [[1380, 6650, L2 + 430], [1380, 6650, VT]], fl: 'v', kind: 've', sys: 'VE', nome: 'Ventilação primária do TG-1' },
    { id: 'TS-1', dn: 75, pts: [[1420, 8565, -700], [1420, 8565, L2 + 300]], to: 'BTS1', fl: 'v', kind: 'tq', nome: 'Tubo de queda de serviço TS-1' },
    { id: 'VP-TS', dn: 75, pts: [[1420, 8565, L2 + 300], [1420, 8565, VT]], fl: 'v', kind: 've', sys: 'VE', nome: 'Ventilação primária do TS-1' },
    // pés dos tubos de queda (enterrados)
    { id: 'BTQ1', dn: 100, s: 0.01, pts: pb(2000, 10280, -800, 0.01).h(2000, 9350).h(850, 9350).get(), to: 'CI-3', fl: 'T', kind: 'base' },
    { id: 'BTQ2', dn: 100, s: 0.01, pts: pb(1745, 7225, -750, 0.01).h(1745, 7300).h(850, 7300).get(), to: 'CI-2', fl: 'T', kind: 'base' },
    { id: 'BTG1', dn: 75, s: 0.02, pts: pb(1380, 6650, -620, 0.02).h(1380, 6150).h(1100, 5850).get(), to: 'CGS', fl: 'T', kind: 'base' },
    { id: 'BTS1', dn: 75, s: 0.02, pts: pb(1420, 8565, -700, 0.02).h(850, 9150).get(), to: 'CI-3', fl: 'T', kind: 'base' },
    { id: 'ECG', dn: 75, s: 0.02, pts: pb(1000, 5800, -700, 0.02).h(700, 6100).h(700, 7000).get(), to: 'CI-2', from: 'CGS', fl: 'T', kind: 'base' },
    // coletor predial (enterrado, i = 2 %)
    { id: 'CL-1', dn: 100, s: 0.02, pts: pb(550, 2450, -820, 0.02).h(550, 7300).get(), to: 'CI-2', from: 'CI-1', fl: 'T', kind: 'col' },
    { id: 'CL-2', dn: 100, s: 0.02, pts: pb(550, 7300, -917, 0.02).h(550, 9350).get(), to: 'CI-3', from: 'CI-2', fl: 'T', kind: 'col' },
    { id: 'CL-3', dn: 100, s: 0.02, pts: pb(550, 9350, -958, 0.02).h(550, 17000).get(), to: 'CI-4', from: 'CI-3', fl: 'T', kind: 'col' },
    { id: 'CL-4', dn: 100, s: 0.02, pts: pb(550, 17000, -1111, 0.02).h(550, 20000).get(), to: 'REDE', from: 'CI-4', fl: 'T', kind: 'col' },
    // colunas de ventilação
    { id: 'CV-1', dn: 50, pts: [[1800, 9850, -646], [1800, 10300, -450], [1800, 10300, L2 + 1040], [2000, 10280, L2 + 1100]], attach: { edge: 'ETV1', pt: [1800, 9850] }, fl: 'v', kind: 've', sys: 'VE', nome: 'Coluna de ventilação CV-1 (lavabo do térreo → VP-1)' },
    { id: 'CV-3', dn: 50, pts: [[6200, 2780, -645], [6330, 2780, -500], [6330, 2780, VT]], attach: { edge: 'ETV2', pt: [6200, 2780] }, fl: 'v', kind: 've', sys: 'VE', nome: 'Coluna de ventilação CV-3 (suíte do térreo, shaft SH-3)' },
  ];
  ES.forEach((e) => (e.sys = e.sys || 'ES'));
  const ESBY = Object.fromEntries(ES.map((e) => [e.id, e]));
  // caixas: CS (sifonada), CI (inspeção), CGS (gordura simples)
  const BOX = [
    { id: 'CS-2L', k: 'CS', fl: '2', x: 2050, y: 9750, z: L2 - 120, out: 'E2L2' },
    { id: 'CS-1B', k: 'CS', fl: '1', x: 2550, y: 9300, z: L1 - 120, out: 'E1BC' },
    { id: 'CS-1S', k: 'CS', fl: '1', x: 2250, y: 6500, z: L1 - 120, out: 'E1SC' },
    { id: 'CS-T1', k: 'CS', fl: 'T', x: 2050, y: 9600, z: -120, out: 'ETC1' },
    { id: 'CS-T2', k: 'CS', fl: 'T', x: 6450, y: 3900, z: -120, out: 'ETC2' },
    { id: 'CGS', k: 'CG', fl: 'T', x: 1000, y: 5800, z: -700, out: 'ECG' },
    { id: 'CI-1', k: 'CI', fl: 'T', x: 550, y: 2450, z: -820, out: 'CL-1' },
    { id: 'CI-2', k: 'CI', fl: 'T', x: 550, y: 7300, z: -917, out: 'CL-2' },
    { id: 'CI-3', k: 'CI', fl: 'T', x: 550, y: 9350, z: -958, out: 'CL-3' },
    { id: 'CI-4', k: 'CI', fl: 'T', x: 550, y: 17000, z: -1111, out: 'CL-4' },
  ];
  const BOXBY = Object.fromEntries(BOX.map((b) => [b.id, b]));
  // shafts (para desenho)
  const SHAFTS = [
    { id: 'SH-1', nome: 'Shaft interno (canto do pilar P11)', x0: 1650, x1: 2260, y0: 10230, y1: 10350, ext: false },
    { id: 'SH-1b', nome: 'Boneca junto ao pilar do canto do lavabo (ramal dos lavatórios contorna o pilar)', x0: 1670, x1: 1770, y0: 9950, y1: 10230, ext: false },
    { id: 'SH-2', nome: 'Shaft externo lateral (em frente ao pilar P6)', x0: 1240, x1: 1500, y0: 6560, y1: 7290, ext: true },
    { id: 'SH-2b', nome: 'Caixa do TQ-2 na cozinha / suíte (junto ao pilar P6)', x0: 1650, x1: 1820, y0: 7160, y1: 7300, ext: false },
    { id: 'SH-3', nome: 'Shaft externo dos fundos', x0: 6280, x1: 6520, y0: 2700, y1: 2850, ext: true },
  ];

  // =====================================================================================================
  //  CÁLCULOS
  // =====================================================================================================
  const DI = { 20: 17.0, 25: 21.6, 32: 27.8, 40: 35.2, 50: 44.0 }; // PVC soldável — diâmetro interno (mm)
  const vmax = (dn) => Math.min(3, 14 * Math.sqrt(DI[dn] / 1000)); // NBR 5626:1998
  const jFWH = (q, dn) => (8.69e6 * Math.pow(q, 1.75) * Math.pow(DI[dn], -4.75)) / 9.81; // m.c.a./m (Fair-Whipple-Hsiao, plástico)
  const dist3 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const polyLen = (p) => p.slice(1).reduce((s, q, i) => s + dist3(p[i], q), 0);
  const fmtm = (mm, d = 2) => (mm / 1000).toFixed(d).replace('.', ',');
  const fmtn = (v, d = 2) => (+v).toFixed(d).replace('.', ',');

  function afPts(e, N) {
    return e.pts || [N[e.a], ...(e.via || []), N[e.b]];
  }
  function solveAF() {
    const N = AFN;
    const fxAt = {};
    FX.filter((f) => !f.direto).forEach((f) => (fxAt[f.af] = f));
    const children = {};
    AFE.forEach((e) => (children[e.a] = children[e.a] || []).push(e));
    const parentOf = {};
    AFE.forEach((e) => (parentOf[e.b] = e));
    // ΣP e vazão por trecho
    const down = (node) => {
      const own = fxAt[node] ? [fxAt[node]] : [];
      return own.concat(...(children[node] || []).map((e) => down(e.b)));
    };
    AFE.forEach((e) => {
      e.fx = down(e.b);
      e.P = e.fx.reduce((s, f) => s + TIPOS[f.t].P, 0);
      const qmax = Math.max(...e.fx.map((f) => TIPOS[f.t].q));
      e.Q = e.fx.length === 1 ? TIPOS[e.fx[0].t].q : Math.max(0.3 * Math.sqrt(e.P), qmax);
      e.pts = afPts(e, N);
      e.L = polyLen(e.pts);
      e.dn = [20, 25, 32, 40, 50].find((d) => (e.Q / 1000) / (Math.PI * Math.pow(DI[d] / 1000, 2) / 4) <= vmax(d));
    });
    const order = []; // percurso do reservatório para baixo
    const walk = (node) => (children[node] || []).forEach((e) => { order.push(e); walk(e.b); });
    walk('CX');
    const press = {};
    const compute = () => {
      press.CX = (NA_MIN - N.CX[2]) / 1000;
      order.forEach((e) => {
        e.v = (e.Q / 1000) / (Math.PI * Math.pow(DI[e.dn] / 1000, 2) / 4);
        e.J = jFWH(e.Q, e.dn);
        e.Leq = e.L / 1000 * 1.3 + (e.rp ? 5 : 0);
        e.hf = e.J * e.Leq;
        press[e.b] = press[e.a] + (N[e.a][2] - N[e.b][2]) / 1000 - e.hf;
        e.pIn = press[e.a]; e.pOut = press[e.b];
      });
    };
    const pathTo = (node) => { const p = []; let e = parentOf[node]; while (e) { p.unshift(e); e = parentOf[e.a]; } return p; };
    const pmin = (f) => (TIPOS[f.t].pmin || 10) / 9.81;
    compute();
    // otimização: aumenta o diâmetro do trecho que mais perde carga no caminho dos pontos com pressão abaixo do mínimo
    for (let it = 0; it < 30; it++) {
      const low = FX.filter((f) => !f.direto && press[f.af] < pmin(f));
      if (!low.length) break;
      const f = low[0];
      const cand = pathTo(f.af).filter((e) => e.dn < 50).sort((a, b) => b.hf - a.hf)[0];
      if (!cand) break;
      cand.dn = [20, 25, 32, 40, 50].find((d) => d > cand.dn);
      cand.up = true;
      compute();
    }
    const pontos = FX.filter((f) => !f.direto).map((f) => {
      const z = N[f.af][2];
      return { f, z, est: (NA_MIN - z) / 1000, din: press[f.af], min: pmin(f), ok: press[f.af] >= pmin(f) };
    });
    return { order, pontos, press };
  }

  function solveES() {
    // UHC acumulados (aparelhos → caixas → ramais → tubos de queda → coletor)
    const into = {};
    ES.forEach((e) => { if (e.to) (into[e.to] = into[e.to] || []).push(e.id); });
    BOX.forEach((b) => { (into[b.out] = into[b.out] || []).push(b.id); });
    const memo = {};
    // trecho: aparelhos ligados nele + tudo que chega (trechos e caixas) · caixa: soma do que chega nela
    const uhcOf = (id) => {
      if (memo[id] != null) return memo[id];
      let u = 0;
      const e = ESBY[id];
      if (e && e.fx) u += e.fx.reduce((s, fid) => s + TIPOS[FXBY[fid].t].uhc, 0);
      (into[id] || []).forEach((src) => (u += uhcOf(src)));
      return (memo[id] = u);
    };
    // CS são caixas: UHC da caixa = soma do que entra nela
    BOX.forEach((b) => uhcOf(b.id));
    ES.forEach((e) => {
      e.L = polyLen(e.pts);
      e.uhc = e.sys === 'VE' ? 0 : uhcOf(e.id);
      // declividade da parte horizontal
      let lh = 0, dz = 0;
      for (let i = 1; i < e.pts.length; i++) {
        const a = e.pts[i - 1], b = e.pts[i];
        const h = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (h > 50 && Math.abs(b[2] - a[2]) < h * 0.2) { lh += h; dz += a[2] - b[2]; }
      }
      e.lh = lh; e.i = lh > 0 ? dz / lh : null;
    });
    return { uhcOf };
  }

  // distância do desconector até a ventilação (NBR 8160, Tabela 10: DN40 1,00 · DN50 1,20 · DN75 1,80 · DN100 2,40 m)
  const LIM_VENT = { 40: 1000, 50: 1200, 75: 1800, 100: 2400 };
  function projOn(pts, pt) {
    let best = { d: Infinity, i: 0, t: 0 };
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b[0] - a[0], dy = b[1] - a[1], L2v = dx * dx + dy * dy;
      let t = L2v ? ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2v : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(a[0] + dx * t - pt[0], a[1] + dy * t - pt[1]);
      if (d < best.d) best = { d, i, t };
    }
    return best;
  }
  function lenFrom(pts, from) {
    // comprimento do ponto (projeção) até o fim da polilinha
    const pr = projOn(pts, from);
    const a = pts[pr.i - 1], b = pts[pr.i];
    let L = dist3(a, b) * (1 - pr.t);
    for (let i = pr.i + 1; i < pts.length; i++) L += dist3(pts[i - 1], pts[i]);
    return L;
  }
  function lenUpTo(pts, from, to) {
    // comprimento entre duas projeções na mesma polilinha (from antes de to)
    return lenFrom(pts, from) - lenFrom(pts, to);
  }
  function ventDistances() {
    const vents = ES.filter((e) => e.attach);
    const stacks = new Set(ES.filter((e) => e.kind === 'tq').map((e) => e.id));
    const out = [];
    const starters = [];
    FX.forEach((f) => { if (f.es && !f.cs && TIPOS[f.t].sifao) starters.push({ label: f.id + ' — ' + TIPOS[f.t].nome, edge: f.es, from: ESBY[f.es].pts[0], dn: ESBY[f.es].dn }); });
    BOX.filter((b) => b.k === 'CS').forEach((b) => starters.push({ label: b.id + ' — caixa sifonada', edge: b.out, from: ESBY[b.out].pts[0], dn: ESBY[b.out].dn }));
    starters.forEach((s) => {
      let e = ESBY[s.edge], from = s.from, L = 0, where = null, guard = 0;
      while (e && guard++ < 10) {
        const v = vents.find((x) => x.attach.edge === e.id);
        if (v) { const vp = [v.attach.pt[0], v.attach.pt[1]]; const pr = projOn(e.pts, vp); const prf = projOn(e.pts, from); if (pr.i > prf.i || (pr.i === prf.i && pr.t >= prf.t)) { L += lenUpTo(e.pts, from, vp); where = v.id; break; } }
        L += lenFrom(e.pts, from);
        if (stacks.has(e.to)) { where = e.to; break; }
        const nxt = ESBY[e.to];
        if (!nxt) { where = null; break; }
        from = e.pts[e.pts.length - 1];
        e = nxt;
      }
      out.push({ label: s.label, dn: s.dn, L, lim: LIM_VENT[s.dn], via: where, ok: where && L <= LIM_VENT[s.dn] });
    });
    return out;
  }

  // ---------------------------------------------------------------------------------------------- quantitativos
  function angleAt(a, b, c) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    const nu = Math.hypot(...u), nv = Math.hypot(...v);
    if (!nu || !nv) return 0;
    const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (nu * nv);
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  }
  function quantities(af) {
    const items = new Map();
    const add = (grupo, desc, un, q) => {
      const k = grupo + '|' + desc + '|' + un;
      const it = items.get(k) || { grupo, desc, un, q: 0 };
      it.q += q;
      items.set(k, it);
    };
    const tubos = {};
    const tubo = (grupo, label, dn, L) => { const k = grupo + '|' + label + '|' + dn; tubos[k] = tubos[k] || { grupo, label, dn, L: 0 }; tubos[k].L += L; };
    const conexoesPorVertice = (pts, grupo, kind, dn, isES) => {
      for (let i = 1; i < pts.length - 1; i++) {
        const ang = angleAt(pts[i - 1], pts[i], pts[i + 1]);
        if (ang < 15) continue;
        if (isES) add(grupo, (ang > 60 ? 'Joelho 90°' : 'Joelho 45°') + ' esgoto DN' + dn, 'un', 1);
        else add(grupo, (ang > 60 ? 'Joelho 90° soldável' : 'Joelho 45° soldável') + ' ' + dn + ' mm', 'un', 1);
      }
    };
    // água fria (tubos, curvas, tês, reduções, pontos, registros)
    const childrenAF = {};
    AFE.forEach((e) => (childrenAF[e.a] = childrenAF[e.a] || []).push(e));
    AFE.forEach((e) => {
      tubo('Água fria', 'Tubo PVC soldável marrom', e.dn, e.L);
      conexoesPorVertice(e.pts, 'Água fria', 'af', e.dn, false);
      if (e.rg) add('Registros e válvulas', 'Registro de gaveta bruto ' + e.dn + ' mm (c/ acabamento)', 'un', 1);
      if (e.rp) add('Registros e válvulas', 'Registro de pressão 20 mm (c/ acabamento) — chuveiro', 'un', 1);
    });
    const parentAF = {};
    AFE.forEach((e) => (parentAF[e.b] = e));
    Object.keys(childrenAF).forEach((n) => {
      const ch = childrenAF[n];
      const par = parentAF[n];
      const deg = ch.length + (par ? 1 : 0);
      const main = par ? par.dn : Math.max(...ch.map((c) => c.dn));
      if (deg >= 3) add('Água fria', 'Tê soldável ' + main + ' mm', 'un', deg - 2);
      else if (deg === 2 && par) {
        const a = par.pts[par.pts.length - 2], b = AFN[n], c = ch[0].pts[1];
        const ang = angleAt(a, b, c);
        if (ang > 15) add('Água fria', (ang > 60 ? 'Joelho 90° soldável ' : 'Joelho 45° soldável ') + main + ' mm', 'un', 1);
      }
      ch.forEach((c) => { if (c.dn < main) add('Água fria', 'Bucha de redução soldável ' + main + '×' + c.dn + ' mm', 'un', 1); });
    });
    FX.filter((f) => !f.direto).forEach(() => add('Água fria', 'Joelho 90° soldável c/ bucha de latão 20 mm × ½" (ponto de utilização)', 'un', 1));
    // alimentador, torneiras diretas e extravasor/limpeza
    ALE.forEach((e) => {
      const pts = e.pts || afPts(e, ALN);
      const dn = e.dn || (e.id === 'AL-g' || e.id === 'AL-f' ? 20 : 25);
      tubo(e.id === 'LADRAO' || e.id === 'LIMPEZA' ? 'Reservatório' : 'Alimentador predial', 'Tubo PVC soldável marrom', dn, polyLen(pts));
      conexoesPorVertice(pts, e.id === 'LADRAO' || e.id === 'LIMPEZA' ? 'Reservatório' : 'Alimentador predial', 'af', dn, false);
    });
    add('Alimentador predial', 'Tê soldável 25 mm (derivação das torneiras diretas)', 'un', 2);
    add('Alimentador predial', 'Bucha de redução soldável 25×20 mm', 'un', 2);
    add('Alimentador predial', 'Joelho 90° soldável c/ bucha de latão 20 mm × ½" + torneira de jardim', 'un', 2);
    add('Alimentador predial', 'Registro de gaveta 25 mm após o hidrômetro (se o cavalete não tiver)', 'un', 1);
    add('Alimentador predial', 'Hidrômetro e cavalete — padrão da concessionária', 'cj', 1);
    add('Reservatório', "Caixa d'água de polietileno 1.500 L com tampa", 'un', 1);
    add('Reservatório', 'Torneira de boia 25 mm (¾")', 'un', 1);
    add('Reservatório', 'Adaptador soldável com flange 32 mm (saída, extravasor e limpeza)', 'un', 3);
    add('Reservatório', 'Adaptador soldável com flange 25 mm (entrada)', 'un', 1);
    add('Reservatório', 'Registro de gaveta 32 mm (limpeza)', 'un', 1);
    add('Reservatório', 'Plataforma de 1,00 m para a caixa (alvenaria/concreto sobre vigas) — orçar com a obra civil', 'cj', 1);
    add('Água fria', 'Torneira de jardim (quintal)', 'un', 1);
    // esgoto e ventilação
    const grupoES = (e) => (e.sys === 'VE' ? 'Ventilação' : 'Esgoto');
    ES.forEach((e) => {
      tubo(grupoES(e), e.sys === 'VE' ? 'Tubo PVC esgoto série normal (ventilação)' : 'Tubo PVC esgoto série normal', e.dn, e.L);
      conexoesPorVertice(e.pts, grupoES(e), 'es', e.dn, true);
      if (e.to && ESBY[e.to] && e.kind !== 'tq') {
        const tgt = ESBY[e.to];
        add(grupoES(e), 'Junção simples 45° esgoto DN' + (tgt ? tgt.dn : 100) + '×' + e.dn, 'un', 1);
      }
      if (e.attach) add('Ventilação', 'Junção simples 45° esgoto DN' + ESBY[e.attach.edge].dn + '×' + e.dn + ' (pé da coluna de ventilação)', 'un', 1);
      if (e.kind === 'tq') add('Esgoto', 'Curva 90° raio longo DN' + e.dn + ' (pé do tubo de queda)', 'un', 1);
      if (e.sys === 'VE' && Math.abs(e.pts[e.pts.length - 1][2] - VT) < 1) add('Ventilação', 'Terminal de ventilação (chapéu) DN' + e.dn, 'un', 1);
    });
    add('Ventilação', 'Junção simples 45° esgoto DN100×50 (CV-1 no VP-1)', 'un', 1);
    const nCS = BOX.filter((b) => b.k === 'CS').length;
    add('Esgoto', 'Caixa sifonada 150×150×50 com grelha (saída DN75)', 'un', nCS);
    add('Caixas enterradas', 'Caixa de inspeção 60×60 cm com tampa de concreto (alvenaria ou pré-moldada)', 'un', BOX.filter((b) => b.k === 'CI').length);
    add('Caixas enterradas', 'Caixa de gordura simples Ø40 cm, 31 L (NBR 8160) com tampa', 'un', 1);
    add('Caixas enterradas', 'Tampa reforçada para a CI-4 (passagem de veículos na rampa)', 'un', 1);
    // aparelhos (acessórios de ligação)
    const n = (t) => FX.filter((f) => f.t === t).length;
    add('Acessórios dos aparelhos', 'Anel de vedação para bacia DN100', 'un', n('vaso'));
    add('Acessórios dos aparelhos', 'Engate flexível ½" (bacias e lavatórios)', 'un', n('vaso') + n('lav'));
    add('Acessórios dos aparelhos', 'Sifão para pia DN50 (cozinha / gourmet)', 'un', n('pia'));
    add('Acessórios dos aparelhos', 'Sifão para tanque DN40', 'un', n('tanque'));
    add('Acessórios dos aparelhos', 'Válvula + tubo de ligação para lavatório (descarga na caixa sifonada)', 'un', n('lav'));
    add('Acessórios dos aparelhos', 'Ralo/sifão para máquina de lavar DN50 (com tubo de espera a 0,90 m)', 'un', n('mlr'));
    // fixação e insumos
    let ext = 0;
    ES.filter((e) => e.kind === 'tq' || e.kind === 've').forEach((e) => {
      for (let i = 1; i < e.pts.length; i++) if (e.pts[i][0] < 1500 || e.pts[i][1] < 2850) ext += Math.abs(e.pts[i][2] - e.pts[i - 1][2]);
    });
    AFE.filter((e) => e.tag === 'AF-2' || e.tag === 'AF-3').forEach((e) => (ext += e.fl === 'v' ? e.L : 0));
    add('Fixação e insumos', 'Abraçadeira tipo D para tubos aparentes nos shafts (a cada 1,5 m)', 'un', Math.ceil(ext / 1500));
    const juntasAF = [...items.values()].filter((i) => i.grupo !== 'Esgoto' && i.grupo !== 'Ventilação' && /soldável/.test(i.desc)).reduce((s, i) => s + i.q * 2, 0);
    add('Fixação e insumos', 'Adesivo para PVC (frasco 175 g)', 'un', Math.max(2, Math.ceil(juntasAF / 60) + 1));
    add('Fixação e insumos', 'Solução limpadora para PVC (frasco 200 mL)', 'un', Math.max(1, Math.ceil(juntasAF / 120)));
    add('Fixação e insumos', 'Fita veda-rosca 18 mm × 25 m', 'un', Math.max(2, Math.ceil(FX.length / 8)));
    add('Fixação e insumos', 'Pasta lubrificante para juntas elásticas (pote 400 g)', 'un', 2);
    add('Fixação e insumos', 'Lixa d’água nº 100', 'un', 6);
    // tubos → barras de 6 m (+10 % de perdas)
    const tub = Object.values(tubos).sort((a, b) => a.grupo.localeCompare(b.grupo) || a.dn - b.dn);
    tub.forEach((t) => {
      const m = (t.L / 1000) * 1.1;
      t.m = m; t.barras = Math.ceil(m / 6);
    });
    return { tubos: tub, items: [...items.values()].sort((a, b) => a.grupo.localeCompare(b.grupo) || a.desc.localeCompare(b.desc)) };
  }

  // furos e passagens (para deixar esperas antes de concretar / levantar paredes)
  function passagens() {
    const out = [];
    const slabs = [{ z: L1 - 80, nome: 'Laje do 1º pavimento' }, { z: L2 - 80, nome: 'Laje do 2º pavimento' }, { z: LR - 80, nome: 'Laje de cobertura' }];
    const all = [];
    AFE.forEach((e) => all.push({ id: e.tag || e.id, sys: 'Água fria', dn: e.dn, pts: e.pts }));
    ALE.forEach((e) => all.push({ id: e.tag, sys: 'Alimentador', dn: e.dn || 25, pts: e.pts || afPts(e, ALN) }));
    ES.forEach((e) => all.push({ id: e.nome || e.id, sys: e.sys === 'VE' ? 'Ventilação' : 'Esgoto', dn: e.dn, pts: e.pts }));
    const inside = (x, y) => x > 1500 && x < 7500 && y > 2850 && y < 10500;
    all.forEach((p) => {
      for (let i = 1; i < p.pts.length; i++) {
        const a = p.pts[i - 1], b = p.pts[i];
        slabs.forEach((s) => {
          const lo = Math.min(a[2], b[2]), hi = Math.max(a[2], b[2]);
          if (lo < s.z && hi > s.z && inside(a[0], a[1])) {
            const k = s.nome + p.id + a[0] + a[1];
            if (!out.some((o) => o.k === k)) out.push({ k, onde: s.nome, x: a[0], y: a[1], dn: p.dn, oque: p.id, sys: p.sys, furo: p.dn + 50 });
          }
        });
      }
    });
    BOX.filter((b) => b.k === 'CS' && b.fl !== 'T').forEach((b) => out.push({ k: b.id, onde: b.fl === '1' ? 'Laje do 1º pavimento' : 'Laje do 2º pavimento', x: b.x, y: b.y, dn: 150, oque: b.id + ' (caixa sifonada no rebaixo)', sys: 'Esgoto', furo: '25×25 cm' }));
    return out.sort((a, b) => a.onde.localeCompare(b.onde) || a.x - b.x);
  }

  const AF = solveAF();
  solveES();
  const VENT = ventDistances();
  const QT = quantities(AF);
  const PASS = passagens();

  // prancha de cada trecho pela altura: ramais logo abaixo da laje (até 45 cm) pertencem ao pavimento de cima
  const floorOf = (z) => (z < L1 - 450 ? 'T' : z < L2 - 450 ? '1' : z < LR - 450 ? '2' : 'C');
  function pipeList() {
    // tudo que pode ser desenhado: {id, sys, dn, pts, fl, kind, info}
    const L = [];
    AFE.forEach((e) => L.push({ id: e.id, sys: 'AF', dn: e.dn, pts: e.pts, fl: e.fl, kind: e.fl === 'v' ? 'col' : 'h', info: `${e.tag || 'Ramal'} · ${e.id}\nDN ${e.dn} mm · ${fmtm(e.L)} m\nΣP ${fmtn(e.P, 1)} · Q ${fmtn(e.Q, 2)} L/s · v ${fmtn(e.v, 2)} m/s` }));
    ALE.forEach((e) => { const pts = e.pts || afPts(e, ALN); L.push({ id: e.id, sys: e.id === 'LADRAO' || e.id === 'LIMPEZA' ? 'AF' : 'AL', dn: e.dn || 25, pts, fl: e.fl, kind: 'h', info: `${e.tag}\nDN ${e.dn || 25} mm · ${fmtm(polyLen(pts))} m` }); });
    ES.forEach((e) => L.push({ id: e.id, sys: e.sys, dn: e.dn, pts: e.pts, fl: e.fl, kind: e.fl === 'v' ? 'col' : 'h', info: `${e.nome || e.id}\nDN ${e.dn} · ${fmtm(e.L)} m${e.uhc ? ' · ' + e.uhc + ' UHC' : ''}${e.i != null && e.kind !== 'tq' ? ' · i = ' + fmtn(e.i * 100, 1) + ' %' : ''}` }));
    return L;
  }
  const PIPES = pipeList();

  // ================================================================================================ camada do estúdio
  const SYS_COLOR = { AF: '#2f80d8', ES: '#9a5b2c', VE: '#2f9e5f', AL: '#7a4fc2' };
  const SYS_NAME = { AF: 'Água fria', AL: 'Alimentador', ES: 'Esgoto', VE: 'Ventilação' };
  const SYS_ORDER = ['ES', 'VE', 'AL', 'AF'];
  // faixa de alturas de cada prancha (prumadas que atravessam a faixa aparecem como círculo)
  const FL_RANGE = { T: [-2000, L1], 1: [L1, L2], 2: [L2, LR], C: [LR, 20000] };
  // limites de altura de cada pavimento do estúdio no 3D (o pavimento de cima leva os ramais sob a laje dele)
  const Z_CUT = [L1 - 450, L2 - 450];
  /** Prancha do pavimento do estúdio ('T', '1', '2'), pelo nível do piso. */
  const planKey = (floor) => floorOf((floor && floor.level ? floor.level : 0) + 100);
  const isVert = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) < 1;

  /** Trechos horizontais e prumadas de uma prancha. → { segs: [{p,a,b,buried}], cols: [{p,x,y,lo,hi}] } */
  function planSegments(key) {
    const segs = [], cols = [];
    PIPES.forEach((p) => {
      for (let i = 1; i < p.pts.length; i++) {
        const a = p.pts[i - 1], b = p.pts[i];
        if (isVert(a, b)) {
          const lo = Math.min(a[2], b[2]), hi = Math.max(a[2], b[2]);
          const [f0, f1] = FL_RANGE[key];
          if (Math.min(hi, f1) - Math.max(lo, f0) > 300) cols.push({ p, x: a[0], y: a[1], lo, hi });
        } else if (floorOf((a[2] + b[2]) / 2) === key) segs.push({ p, a, b, buried: (a[2] + b[2]) / 2 < -150 });
      }
    });
    return { segs, cols };
  }
  const cache2d = {};
  const segsOf = (key) => cache2d[key] || (cache2d[key] = planSegments(key));
  /** Prumadas com nome, uma por posição (tubo de queda antes da ventilação que o prolonga). */
  function columnTags(key) {
    const out = [];
    const rank = (p) => (p.sys === 'ES' ? 0 : p.sys === 'VE' ? 1 : 2);
    segsOf(key).cols.slice().sort((a, b) => rank(a.p) - rank(b.p)).forEach((c) => {
      const src = (c.p.sys === 'AF' ? AFE : c.p.sys === 'AL' ? ALE : ES).find((e) => e.id === c.p.id) || {};
      const tag = src.tag || (/^(TQ|TG|TS|CV|VP)/.test(c.p.id) ? c.p.id : null);
      if (!tag || !/^(AF|TQ|TG|TS|CV|VP)-|^Alimentador$/.test(tag) || out.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 60 && o.sys === c.p.sys)) return;
      if (out.some((o) => o.tag === tag)) return;
      out.push({ tag, x: c.x, y: c.y, sys: c.p.sys });
    });
    return out;
  }

  /** Planta 2D do estúdio, em mm (contexto já na escala do mundo). */
  function draw2dWorld(rc) {
    if (!rc.floor) return;
    const { ctx, px } = rc, key = planKey(rc.floor), { segs, cols } = segsOf(key);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    SYS_ORDER.forEach((sys) => {
      segs.filter((s) => s.p.sys === sys).forEach((s) => {
        ctx.strokeStyle = SYS_COLOR[sys];
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = (sys === 'ES' ? (s.p.dn >= 75 ? 3.2 : 2.6) : sys === 'VE' ? 1.8 : 2.2) * px;
        ctx.setLineDash(sys === 'VE' || s.buried ? [6 * px, 3.5 * px] : []);
        ctx.beginPath();
        ctx.moveTo(s.a[0], s.a[1]);
        ctx.lineTo(s.b[0], s.b[1]);
        ctx.stroke();
      });
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // caixas: sifonadas no piso; de inspeção e de gordura no térreo
    BOX.filter((b) => b.fl === key).forEach((b) => {
      const s = b.k === 'CS' ? Math.max(150, 7 * px) : b.k === 'CI' ? 600 : 400;
      ctx.fillStyle = 'rgba(154,91,44,0.14)';
      ctx.strokeStyle = SYS_COLOR.ES;
      ctx.lineWidth = 1.4 * px;
      ctx.beginPath();
      if (b.k === 'CG') ctx.arc(b.x, b.y, s / 2, 0, Math.PI * 2);
      else ctx.rect(b.x - s / 2, b.y - s / 2, s, s);
      ctx.fill();
      ctx.stroke();
    });
    // prumadas
    cols.forEach((c) => {
      const r = Math.max(c.p.dn / 2 + 15, 4.5 * px);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();
      ctx.lineWidth = 2 * px;
      ctx.strokeStyle = SYS_COLOR[c.p.sys];
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(r * 0.35, 1.4 * px), 0, Math.PI * 2);
      ctx.fillStyle = SYS_COLOR[c.p.sys];
      ctx.fill();
    });
    // pontos de consumo (água) e de coleta (esgoto) dos aparelhos
    FX.filter((f) => f.fl === key).forEach((f) => {
      const n = AFN[f.af];
      if (n) {
        ctx.beginPath();
        ctx.arc(n[0], n[1], Math.max(30, 3 * px), 0, Math.PI * 2);
        ctx.fillStyle = SYS_COLOR.AF;
        ctx.fill();
      }
      const e = f.es && ESBY[f.es];
      if (e) {
        ctx.beginPath();
        ctx.arc(e.pts[0][0], e.pts[0][1], Math.max(45, 3.6 * px), 0, Math.PI * 2);
        ctx.lineWidth = 1.6 * px;
        ctx.strokeStyle = SYS_COLOR.ES;
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.stroke();
      }
    });
  }
  /** Planta 2D do estúdio, em pixels: nomes das prumadas e caixas, legenda. */
  function draw2dScreen(rc) {
    if (!rc.floor) return;
    const { ctx, v } = rc, key = planKey(rc.floor);
    const w2s = (x, y) => ({ x: v.width / 2 + (x - v.cx) * v.scale, y: v.height / 2 + (y - v.cy) * v.scale });
    const mono = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
    const pill = (txt, x, y, color) => {
      ctx.font = '600 9.5px ' + mono;
      const w = ctx.measureText(txt).width + 8;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(x, y - 7, w, 14);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y - 6.5, w - 1, 13);
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, x + 4, y + 0.5);
    };
    if (v.scale > 0.03) {
      const placed = [];
      columnTags(key).forEach((c) => {
        const p = w2s(c.x, c.y);
        let y = p.y - 10;
        while (placed.some((q) => Math.abs(q.y - y) < 14 && Math.abs(q.x - p.x) < 70)) y -= 14;
        placed.push({ x: p.x, y });
        pill(c.tag, p.x + 8, y, SYS_COLOR[c.sys]);
      });
    }
    if (v.scale > 0.05)
      BOX.filter((b) => b.fl === key).forEach((b) => {
        const p = w2s(b.x, b.y);
        pill(b.id, p.x + (b.k === 'CS' ? 8 : 300 * v.scale + 4), p.y + 12, SYS_COLOR.ES);
      });
    // legenda
    const items = SYS_ORDER.slice().reverse().filter((sys) => segsOf(key).segs.some((s) => s.p.sys === sys) || segsOf(key).cols.some((c) => c.p.sys === sys));
    if (!items.length) return;
    ctx.font = '500 10px ' + mono;
    const widths = items.map((sys) => ctx.measureText(SYS_NAME[sys]).width + 30);
    const total = widths.reduce((a, b) => a + b, 0) + 10;
    const x0 = Math.max(210, 18), y0 = v.height - (rc.footer || 0) - 32;
    ctx.fillStyle = rc.exporting ? 'rgba(255,255,255,0.9)' : 'rgba(243,239,230,0.88)';
    ctx.fillRect(x0, y0, total, 22);
    let x = x0 + 8;
    items.forEach((sys, i) => {
      ctx.strokeStyle = SYS_COLOR[sys];
      ctx.lineWidth = 2.4;
      ctx.setLineDash(sys === 'VE' ? [5, 3] : []);
      ctx.beginPath();
      ctx.moveTo(x, y0 + 11);
      ctx.lineTo(x + 16, y0 + 11);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#3a3631';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(SYS_NAME[sys], x + 21, y0 + 11.5);
      x += widths[i];
    });
  }

  /** Trecho a→b recortado à faixa de alturas [lo, hi). → [a', b'] ou null */
  function clipZ(a, b, lo, hi) {
    const za = a[2], zb = b[2];
    if (Math.abs(zb - za) < 1e-6) return za >= lo && za < hi ? [a, b] : null;
    let t0 = (lo - za) / (zb - za), t1 = (hi - za) / (zb - za);
    if (t0 > t1) [t0, t1] = [t1, t0];
    t0 = Math.max(0, t0);
    t1 = Math.min(1, t1);
    if (t1 - t0 < 1e-6) return null;
    const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, za + (zb - za) * t];
    return [at(t0), at(t1)];
  }
  /**
   * Tubos de um pavimento do estúdio no 3D (metros; y = altura). Desenhados por cima das paredes e lajes
   * ("raio X"), para ver o caminho dentro da alvenaria; não são selecionáveis.
   */
  function build3d(THREE, doc, floor) {
    const g = new THREE.Group();
    g.name = 'hidro:' + floor.id;
    const MM = 0.001, levels = doc.floors.map((f) => f.level).sort((a, b) => a - b);
    const idx = levels.indexOf(floor.level), last = idx === levels.length - 1;
    const lo = idx <= 0 ? -1e9 : Z_CUT[idx - 1] != null ? Z_CUT[idx - 1] : floor.level - 450;
    const hi = last ? 1e9 : Z_CUT[idx] != null ? Z_CUT[idx] : levels[idx + 1] - 450;
    const mats = {};
    const mat = (color, op) =>
      mats[color + op] ||
      (mats[color + op] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthTest: false, depthWrite: false }));
    const up = new THREE.Vector3(0, 1, 0);
    const put = (mesh) => {
      mesh.renderOrder = 20;
      mesh.userData.noPick = true;
      mesh.userData.hidro = true;
      g.add(mesh);
    };
    const v3 = (p) => new THREE.Vector3(p[0] * MM, p[2] * MM, p[1] * MM);
    PIPES.forEach((p) => {
      const r = Math.max(p.dn * 0.5, p.sys === 'ES' ? 40 : 28) * MM, m = mat(SYS_COLOR[p.sys], p.sys === 'VE' ? 0.75 : 0.92);
      for (let i = 1; i < p.pts.length; i++) {
        const c = clipZ(p.pts[i - 1], p.pts[i], lo, hi);
        if (!c) continue;
        const a = v3(c[0]), b = v3(c[1]), len = a.distanceTo(b);
        if (len < 0.005) continue;
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), m);
        cyl.position.copy(a).add(b).multiplyScalar(0.5);
        cyl.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
        put(cyl);
        const j = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m);
        j.position.copy(b);
        put(j);
      }
    });
    const inBand = (z) => z >= lo && z < hi;
    BOX.forEach((b) => {
      if (!inBand(b.z)) return;
      const s = b.k === 'CS' ? 150 : b.k === 'CI' ? 600 : 500, top = b.k === 'CS' ? b.z + 120 : ZG, h = top - b.z + 100;
      const mesh = b.k === 'CG'
        ? new THREE.Mesh(new THREE.CylinderGeometry((s / 2) * MM, (s / 2) * MM, h * MM, 20), mat(SYS_COLOR.ES, 0.45))
        : new THREE.Mesh(new THREE.BoxGeometry(s * MM, h * MM, s * MM), mat(SYS_COLOR.ES, 0.45));
      mesh.position.set(b.x * MM, ((top + b.z - 100) / 2) * MM, b.y * MM);
      put(mesh);
    });
    FX.forEach((f) => {
      const n = AFN[f.af];
      if (!n || !inBand(n[2])) return;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), mat(SYS_COLOR.AF, 1));
      s.position.copy(v3(n));
      put(s);
    });
    if (inBand(CX_BASE)) {
      // caixa d'água de 1.500 L (centro em x 2,50 / y 7,90 m) sobre a plataforma
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.775, 0.7, 1.05, 28), mat(SYS_COLOR.AF, 0.3));
      tank.position.set(2.5, CX_BASE * MM + 0.525, 7.9);
      put(tank);
    }
    return g;
  }

  DD.hidro = {
    L1, L2, LR, ZG, VT, PLATAFORMA, CX_BASE, NA_MIN, PESSOAS, PER_CAPITA, TIPOS, FX, FXBY, AFN, AFE, ALN, ALE, pb, ES, ESBY,
    BOX, BOXBY, SHAFTS, DI, vmax, jFWH, dist3, polyLen, fmtm, fmtn, afPts, solveAF, solveES, LIM_VENT, projOn, lenFrom,
    lenUpTo, ventDistances, angleAt, quantities, passagens, AF, VENT, QT, PASS, floorOf, pipeList, PIPES,
    SYS_COLOR, SYS_NAME, planKey, planSegments, columnTags, draw2dWorld, draw2dScreen, build3d,
  };
})();
