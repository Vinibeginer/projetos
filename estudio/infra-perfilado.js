// ===== infra-perfilado.js — anteprojeto SEPARADO da infraestrutura elétrica em perfilado 38×38 (não altera o projeto) =====
// Traçado dos perfilados no forro do 1º e do 2º pavimento, derivações em eletroduto até cada ponto, verificação de
// agrupamento (NBR 5410 Tabela 42) e ocupação, e o levantamento completo de materiais (perfilado, acessórios, suspensão,
// parafusaria, derivações, caixas, aterramento). Usado por infra-perfilado.html (planta, 3D e lista) e pelos scripts de
// conferência; lê os pontos e circuitos de DD.eletrica (18-eletrica.js) e as paredes de DD.data (00-data.js).
// Térreo: as vigas do teto do térreo descem abaixo do forro e fecham o vão em quadros; o perfilado corre em cada quadro
// na altura das passagens deixadas nas vigas e é interrompido em cada viga — os cabos atravessam pela passagem dentro
// de um trecho de eletroduto. No 1º e no 2º o forro fica abaixo das vigas e o perfilado passa por baixo delas.
// Sem dados do projeto estrutural: as posições das vigas ficam fora deste arquivo (folha privada do dono da obra); aqui
// só entra quantas passagens cada trecho do térreo atravessa (PASSAGENS), para a lista de materiais.
(function () {
  const DD = (window.DD = window.DD || {});
  const E = DD.eletrica, D = DD.data;
  if (!E || !D) return;

  // ------------------------------------------------------------------ alturas (mm sobre o piso do andar)
  const FG = D.FORRO_GESSO;
  const FL = { T: 'f0', 1: 'f1', 2: 'f2' };
  const LEVEL = { T: 0, 1: 2880, 2: 6340 };
  // fundo da laje: 2,72 m no térreo (laje de 16 cm no nível 2,88) e 3,30 m no 1º e no 2º (laje do 2º no 6,34, cobertura no 9,80)
  // térreo: eixo do perfilado a 2,64 m do piso, na altura das passagens das vigas (ajustar à altura real delas)
  const H = { T: { forro: FG.f0, laje: 2720, eixo: 2640 }, 1: { forro: FG.f1, laje: 3300 }, 2: { forro: FG.f2, laje: 3300 } };
  // perfilado liso 38×38 chapa 18 com tampa: face de baixo 4,5 cm acima do gesso (livre da estrutura do forro), aba
  // para cima, tampa por cima; passa por baixo das vigas (folga a conferir na obra: ≥ 6 cm entre o forro e a viga)
  const PERF = { lado: 38, chapa: 1.25, barra: 3000, tampa: 3000, folga: 45, area: Math.round((38 - 2 * 1.25) ** 2) };
  const base = (fl) => (H[fl].eixo ? H[fl].eixo - PERF.lado / 2 : H[fl].forro + PERF.folga);
  const eixo = (fl) => base(fl) + PERF.lado / 2;
  const LIM = { susp: 1500, pontaSusp: 300, ocup: 0.4, deriv: 3500, fixDeriv: 1000 };

  // ------------------------------------------------------------------ traçado (nós e trechos; o nó R é a saída do quadro)
  // térreo: do QDC (sala, pé da escada) a ligação corre em y = 9,40 m pela sala até o lavabo; de lá um ramal sobe pela
  //     cozinha até os fundos (x = 2,65 m) e outro desce para a garagem; do cruzamento em x = 5,25 m saem o ramal do quarto,
  //     do depósito e da suíte (para os fundos) e o da sala (para a frente), com um braço para a parede da TV.
  // 1º: tronco no eixo x = 4,90 m (do closet ao quarto 2, ao lado da divisória dos quartos), braço dos closets em
  //     y = 3,55 m, braço dos quartos em y = 13,35 m e a ligação do QD-1 pela circulação (y = 9,10 m).
  // 2º: do QD-2 o tronco corre em y = 8,15 m pela varanda coberta e sobe pelos dois lados (x = 2,40 e x = 6,80 m).
  const REDE = {
    T: {
      nos: { R: [5925, 8950], C: [5925, 9400], X: [5250, 9400], W: [2650, 9400], CZ: [2650, 3600], GA: [2650, 13650], SU: [5250, 3700], J: [5250, 12700], FR: [5250, 14500], TV: [8400, 12700] },
      trechos: [
        ['R', 'C', 'PT-1', 'Saída do QDC'], ['C', 'X', 'PT-2', 'Sala — pé da escada'], ['X', 'W', 'PT-3', 'Sala → lavabo'], ['W', 'CZ', 'PT-4', 'Lavabo → cozinha → fundos'],
        ['W', 'GA', 'PT-5', 'Lavabo → garagem'], ['X', 'SU', 'PT-6', 'Quarto → depósito e suíte'], ['X', 'J', 'PT-7', 'Sala'], ['J', 'FR', 'PT-8', 'Sala → fachada'], ['J', 'TV', 'PT-9', 'Sala → parede da TV'],
      ],
    },
    1: {
      nos: { R: [5925, 8850], C: [5925, 9100], J1: [4900, 9100], A: [4900, 3550], CE: [2600, 3550], CD: [6200, 3550], J2: [4900, 13350], Q1: [1000, 13350], Q2: [7900, 13350] },
      trechos: [
        ['R', 'C', 'P1-1', 'Saída do QD-1'], ['C', 'J1', 'P1-2', 'Circulação'], ['J1', 'A', 'P1-3', 'Tronco — quarto master'], ['A', 'CE', 'P1-4', 'Closets (esquerda)'],
        ['A', 'CD', 'P1-5', 'Closets (direita)'], ['J1', 'J2', 'P1-6', 'Tronco — quarto 2'], ['J2', 'Q1', 'P1-7', 'Quartos (quarto 1)'], ['J2', 'Q2', 'P1-8', 'Quartos (quarto 2)'],
      ],
    },
    2: {
      nos: { R: [7250, 8450], C: [7250, 8150], J: [6800, 8150], K: [2400, 8150], E: [2400, 3800], D: [6800, 4400] },
      trechos: [['R', 'C', 'P2-1', 'Saída do QD-2'], ['C', 'J', 'P2-2', 'Tronco'], ['J', 'K', 'P2-3', 'Tronco — varanda coberta'], ['K', 'E', 'P2-4', 'Lado esquerdo'], ['J', 'D', 'P2-5', 'Lado direito']],
    },
  };

  // passagens nas vigas do térreo atravessadas por cada trecho e por derivações (contagem, sem posição: as posições
  // estão na folha privada; conferir com as passagens deixadas na obra)
  const PASSAGENS = { T: { trechos: { 'PT-4': 2, 'PT-5': 1, 'PT-6': 2, 'PT-7': 1 }, deriv: ['T-T13'] } };

  // ------------------------------------------------------------------ geometria
  const hyp = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function proj(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    return { t, q: [a[0] + t * dx, a[1] + t * dy] };
  }
  /** Interseção do segmento p–q com o retângulo de uma parede (centro ± espessura/2). */
  function cruza(p, q, w) {
    const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, h = w.thick / 2;
    // no sistema da parede: s ao longo, n na espessura
    const loc = (r) => [(r[0] - w.a.x) * ux + (r[1] - w.a.y) * uy, -(r[0] - w.a.x) * uy + (r[1] - w.a.y) * ux];
    const A = loc(p), B = loc(q);
    let t0 = 0, t1 = 1;
    const clip = (d, lo, hi, v) => {
      if (Math.abs(d) < 1e-9) return v >= lo && v <= hi;
      let a = (lo - v) / d, b = (hi - v) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      return t0 <= t1;
    };
    if (!clip(B[0] - A[0], 0, L, A[0]) || !clip(B[1] - A[1], -h, h, A[1])) return null;
    return { t0, t1, pt: [p[0] + ((t0 + t1) / 2) * (q[0] - p[0]), p[1] + ((t0 + t1) / 2) * (q[1] - p[1])] };
  }
  const distParede = (p, w) => {
    const r = proj(p, [w.a.x, w.a.y], [w.b.x, w.b.y]);
    return hyp(p, r.q);
  };

  const DOC = D.initialState();
  const paredes = (fl) => DOC.walls.filter((w) => w.floor === FL[fl] && w.kind !== 'railing' && w.kind !== 'muro');
  const vaos = (w) => DOC.openings.filter((o) => o.wall === w.id);

  // ------------------------------------------------------------------ quais circuitos vão no perfilado
  // NBR 5410 Tabela 42 (feixe, em conduto fechado): fator de agrupamento pelo número de circuitos
  const FCA_T = [[1, 1], [2, 0.8], [3, 0.7], [4, 0.65], [5, 0.6], [6, 0.57], [7, 0.54], [8, 0.52], [11, 0.5], [15, 0.45], [19, 0.41], [1e9, 0.38]];
  const fca = (n) => FCA_T.find((r) => n <= r[0])[1];
  const IZ = { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57 }; // B1, 2 condutores carregados (Tabela 36)
  const SECOES = [1.5, 2.5, 4, 6, 10];
  const OD = { 1.5: 3.0, 2.5: 3.6, 4: 4.2, 6: 4.9, 10: 6.4 }; // diâmetro externo do cabo flexível 750 V (mm)
  const aCabo = (s) => (Math.PI / 4) * OD[s] ** 2;
  // fora do perfilado (eletroduto próprio, como no projeto): disjuntor acima de 10 A — chuveiros (32 A) e ar-condicionado
  // de 16 A. No feixe do perfilado (até 15 circuitos, fator 0,45) um cabo de 2,5 mm² aguenta 24 × 0,45 = 10,8 A ≥ 10 A.
  const noPerfilado = (c) => c.disj <= 10;
  // pontos que ficam como no projeto: escada (sem forro), varanda descoberta (por baixo, no contrapiso), rede
  const ESCADA = new Set(['T-IL-ESC', 'T-S3a', '1-IL-ESC', '1-S3b', '2-S3b']);

  const CIRC = E.CIRC;
  const PBY = E.PBY;

  /** Trecho p–q × retângulo [x0, x1, y0, y1] (viga, só no estudo privado): ponto médio da travessia. */
  function cruzaRet(p, q, v) {
    let t0 = 0, t1 = 1;
    const ok = [[q[0] - p[0], p[0], v[0], v[1]], [q[1] - p[1], p[1], v[2], v[3]]].every(([d, a, lo, hi]) => {
      if (Math.abs(d) < 1e-9) return a > lo && a < hi;
      let u = (lo - a) / d, w = (hi - a) / d;
      if (u > w) [u, w] = [w, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, w);
      return t0 < t1;
    });
    return ok ? { t0, t1, pt: [p[0] + ((t0 + t1) / 2) * (q[0] - p[0]), p[1] + ((t0 + t1) / 2) * (q[1] - p[1])] } : null;
  }
  const GAP_PASSAGEM = 250; // viga (15 cm) + 5 cm de cada lado: o perfilado para antes da viga e recomeça depois

  function calcula(fl, opts) {
    const R = REDE[fl], nos = R.nos;
    const W = paredes(fl);
    const vigas = (opts && opts.vigas) || null; // [x0, x1, y0, y1] — só no estudo privado
    // árvore a partir do quadro
    const adj = {};
    R.trechos.forEach(([a, b], i) => { (adj[a] = adj[a] || []).push([b, i]); (adj[b] = adj[b] || []).push([a, i]); });
    const pai = { R: null }, paiT = {}, ordem = ['R'];
    for (let k = 0; k < ordem.length; k++) (adj[ordem[k]] || []).forEach(([n, i]) => { if (!(n in pai)) { pai[n] = ordem[k]; paiT[n] = i; ordem.push(n); } });
    // trecho i: de "a" (mais perto do quadro) para "b"
    const T = R.trechos.map(([a, b, id, nome], i) => {
      const [p, f] = pai[b] === a ? [a, b] : [b, a];
      const A = nos[p], B = nos[f], L = hyp(A, B);
      // térreo: vigas atravessadas (privado: com posição; público: só a contagem de PASSAGENS)
      const pas = fl === 'T' && vigas ? vigas.map((v) => cruzaRet(A, B, v)).filter(Boolean).map((c) => ({ x: Math.round(c.pt[0]), y: Math.round(c.pt[1]), s: ((c.t0 + c.t1) / 2) * L })) : [];
      const nPas = fl === 'T' ? (vigas ? pas.length : (PASSAGENS.T.trechos[id] || 0)) : 0;
      const naViga = (pt) => pas.some((q) => hyp(pt, [q.x, q.y]) < 200);
      const travessias = W.map((w) => ({ w, c: cruza(A, B, w) })).filter((x) => x.c && !naViga(x.c.pt)).map((x) => ({ parede: x.w.id, x: Math.round(x.c.pt[0]), y: Math.round(x.c.pt[1]), esp: x.w.thick }));
      const Lperf = L - nPas * GAP_PASSAGEM, pecas = Array(nPas + 1).fill(Lperf / (nPas + 1)); // no térreo o perfilado é cortado em cada viga
      const emendas = pecas.reduce((s, x) => s + Math.max(0, Math.ceil(x / PERF.barra - 1e-6) - 1), 0);
      return { i, id, nome, a: p, b: f, A, B, L, Lperf, pecas, emendas, passagens: pas, nPas, travessias, circ: new Set(), ret: 0 };
    });
    const caminho = (no) => { const L = []; for (let n = no; pai[n]; n = pai[n]) L.push(paiT[n]); return L; }; // trechos do quadro até o nó

    // ---------------------------------------------------------------- derivações (uma por caixa)
    const pts = E.PONTOS.filter((p) => p.fl === String(fl) && /il|int|tug|tue/.test(p.k) && p.circ);
    const grupos = [];
    pts.forEach((p) => {
      const g = grupos.find((x) => Math.abs(x.x - p.x) <= 60 && Math.abs(x.y - p.y) <= 60 && Math.abs(x.z - p.z) <= 60);
      if (g) g.pts.push(p); else grupos.push({ x: p.x, y: p.y, z: p.z, pts: [p] });
    });
    const deriv = [], fora = [];
    grupos.forEach((g) => {
      const p0 = g.pts[0], circs = [...new Set(g.pts.map((p) => p.circ))];
      const motivo = g.pts.some((p) => ESCADA.has(p.id)) ? 'escada' : !E.coberto(p0) ? 'baixo' : circs.some((c) => !noPerfilado(c)) ? 'potencia' : null;
      const tipo = p0.k === 'il' ? (p0.tipo === 'teto' ? 'luz' : 'arandela') : /int/.test(p0.k) ? 'int' : p0.k === 'tue' ? 'tue' : 'tug';
      const d = { id: g.pts.map((p) => p.id).join('+'), pts: g.pts.map((p) => p.id), x: g.x, y: g.y, z: g.z, tipo, circs: circs.map((c) => c.n), amb: p0.amb };
      if (motivo) return fora.push(Object.assign(d, { motivo }));
      // ponto do perfilado mais perto (fora do vão da viga, no térreo)
      let best = null;
      T.forEach((t) => {
        const r = proj([g.x, g.y], t.A, t.B);
        const dd = hyp([g.x, g.y], r.q);
        if (!best || dd < best.d - 1) best = { d: dd, t, q: r.q, u: r.t };
      });
      const naParede = tipo !== 'luz';
      const alvo = [g.x, g.y];
      const furos = W.filter((w) => !(naParede && distParede(alvo, w) <= w.thick / 2 + 80)).filter((w) => cruza(best.q, alvo, w)).map((w) => w.id);
      const vigasD = fl === 'T' && vigas ? vigas.filter((v) => cruzaRet(best.q, alvo, v) && !(naParede && alvo[0] >= v[0] - 80 && alvo[0] <= v[1] + 80 && alvo[1] >= v[2] - 80 && alvo[1] <= v[3] + 80)).length : 0;
      const Lh = best.d, Lv = naParede ? Math.max(0, eixo(fl) - g.z) : 150;
      const passa = fl === 'T' && (vigas ? vigasD > 0 : PASSAGENS.T.deriv.includes(d.id));
      deriv.push(Object.assign(d, { ax: Math.round(best.q[0]), ay: Math.round(best.q[1]), trecho: best.t.i, u: best.u, Lh, Lv, L: 1.1 * Lh + Lv + 300, furos, passa, fix: Math.max(0, Math.ceil(Lh / LIM.fixDeriv) - 1) }));
    });

    // ---------------------------------------------------------------- circuitos por trecho (F + N/F2 + PE e retornos)
    const porCirc = {};
    deriv.forEach((d) => d.circs.forEach((n) => (porCirc[n] = porCirc[n] || []).push(d)));
    Object.keys(porCirc).forEach((n) => {
      const set = new Set();
      porCirc[n].forEach((d) => caminho(T[d.trecho].b).forEach((i) => set.add(i)));
      set.forEach((i) => T[i].circ.add(+n));
    });
    // retornos: do trecho do interruptor ao trecho da luz (caminho na árvore)
    deriv.filter((d) => d.tipo === 'int').forEach((s) => {
      s.pts.forEach((id) => (PBY[id].liga || []).forEach((lid) => {
        const l = deriv.find((d) => d.pts.includes(lid));
        if (!l) return;
        const a = new Set(caminho(T[s.trecho].b)), b = new Set(caminho(T[l.trecho].b));
        [...a].filter((i) => !b.has(i)).concat([...b].filter((i) => !a.has(i))).forEach((i) => (T[i].ret += 1));
      }));
    });
    // seção no perfilado: a do projeto, ou a menor que aguenta o disjuntor no fator de agrupamento do pior trecho
    const SEC = {};
    Object.keys(porCirc).forEach((n) => {
      const c = CIRC.find((x) => x.n === +n);
      const nMax = Math.max(...T.filter((t) => t.circ.has(+n)).map((t) => t.circ.size));
      let s = c.secao;
      while (IZ[s] * fca(nMax) < c.disj) s = SECOES[SECOES.indexOf(s) + 1];
      SEC[n] = { n: +n, desc: c.desc, tipo: c.tipo, disj: c.disj, ib: c.ib, projeto: c.secao, nMax, fca: fca(nMax), secao: s, iz: IZ[s] * fca(nMax), muda: s !== c.secao };
    });
    T.forEach((t) => {
      const area = [...t.circ].reduce((s2, n) => s2 + 3 * aCabo(SEC[n].secao), 0) + t.ret * aCabo(2.5);
      t.nCond = 3 * t.circ.size + t.ret;
      t.area = area;
      t.ocup = area / PERF.area;
      t.fca = fca(t.circ.size);
      // na passagem da viga: eletrodutos DN 32 de até 6 circuitos (40 % de ocupação)
      t.dnPas = t.nPas ? Math.max(Math.ceil(t.circ.size / 6), Math.ceil(area / (0.4 * (Math.PI / 4) * 24.5 ** 2))) : 0;
    });

    // ---------------------------------------------------------------- suspensões (tirantes) em cada trecho
    T.forEach((t) => {
      const L = t.L, pos = [];
      if (L <= 2 * LIM.pontaSusp) pos.push(L / 2);
      else {
        const n = Math.ceil((L - 2 * LIM.pontaSusp) / LIM.susp);
        for (let k = 0; k <= n; k++) pos.push(LIM.pontaSusp + ((L - 2 * LIM.pontaSusp) * k) / n);
      }
      const ux = (t.B[0] - t.A[0]) / L, uy = (t.B[1] - t.A[1]) / L;
      const ponto = (s) => [t.A[0] + ux * s, t.A[1] + uy * s];
      // fora das travessias de parede (a 15 cm da face) e — no estudo privado — fora das vigas (desloca até 40 cm)
      const livre = (s) => {
        const p = ponto(s);
        return !t.travessias.some((x) => hyp(p, [x.x, x.y]) < x.esp / 2 + 150) && !(vigas || []).some((v) => p[0] > v[0] - 60 && p[0] < v[1] + 60 && p[1] > v[2] - 60 && p[1] < v[3] + 60);
      };
      t.susp = pos.map((s0) => {
        let s = s0;
        for (let k = 0; k <= 32 && !livre(s); k++) s = s0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 25;
        s = Math.max(60, Math.min(L - 60, s));
        return { s, p: ponto(s), desvio: Math.round(s - s0), ok: livre(s) };
      });
      // térreo: o perfilado é interrompido em cada viga — mais um tirante de cada lado, a até 30 cm da face da viga
      t.suspPas = 2 * t.nPas;
      t.passagens.forEach((q) => [-1, 1].forEach((sg) => { const s = q.s + sg * 300; t.susp.push({ s, p: ponto(s), desvio: 0, ok: true, passagem: true }); }));
      // e um tirante a até 30 cm de cada emenda (a junção das barras de 3 m não pode ficar no meio do vão)
      t.nSusp = t.susp.filter((x) => !x.passagem).length + t.suspPas + t.emendas;
    });

    // ---------------------------------------------------------------- conexões nos nós
    const grau = {};
    T.forEach((t) => { grau[t.a] = (grau[t.a] || 0) + 1; grau[t.b] = (grau[t.b] || 0) + 1; });
    const conex = Object.keys(nos).map((k) => {
      const g = grau[k] || 0;
      const tipo = k === 'R' ? 'inicio' : g === 1 ? 'ponta' : g === 2 ? 'L' : g === 3 ? 'T' : 'X';
      return { no: k, x: nos[k][0], y: nos[k][1], tipo };
    });

    // ---------------------------------------------------------------- saída do quadro (subidas em eletroduto DN 32)
    const raiz = T.filter((t) => t.a === 'R');
    const condRaiz = raiz.reduce((s2, t) => s2 + [...t.circ].reduce((a, n) => a + 3 * aCabo(SEC[n].secao), 0), 0);
    const cap32 = 0.4 * (Math.PI / 4) * 24.5 ** 2;
    const nCircRaiz = new Set(raiz.flatMap((t) => [...t.circ])).size;
    const subidas = Math.max(1, Math.ceil(condRaiz / cap32), Math.ceil(nCircRaiz / 6)); // até 6 circuitos por eletroduto (fator 0,57 ≥ 10/24)
    const board = E.BOARDS[String(fl)];
    const Lsub = eixo(fl) - (1500 + 350) + 300 + (fl === 'T' ? 200 : 0); // do topo do quadro (centro a 1,50 m) até o perfilado, com a curva

    return { fl, nos, T, deriv, fora, SEC, conex, subidas, reserva: 1, Lsub, board, paredes: W, base: base(fl), eixo: eixo(fl), H: H[fl], LEVEL: LEVEL[fl], privado: !!vigas };
  }

  // ------------------------------------------------------------------ corte das barras (first fit decreasing)
  function cortes(pecas, barra) {
    const bins = [];
    pecas.slice().sort((a, b) => b - a).forEach((L) => {
      let resto = L;
      while (resto > barra) { bins.push([barra]); resto -= barra; }
      const b = bins.find((x) => barra - x.reduce((s, v) => s + v, 0) >= resto + 5);
      if (b) b.push(resto); else bins.push([resto]);
    });
    return bins;
  }

  // ------------------------------------------------------------------ materiais
  const ceil10 = (q) => Math.ceil(q / 10) * 10;
  const fmt = (mm, d) => (mm / 1000).toFixed(d == null ? 1 : d).replace('.', ',');
  const NOME = { T: 'térreo', 1: '1º', 2: '2º' };
  function materiais(andares) {
    const items = [];
    const it = (grupo, desc, un, q, obs, compra) => (q > 0 || un === '—') && items.push({ grupo, desc, un, q, compra: compra == null ? q : compra, obs: obs || '' });
    const soma = (f) => andares.reduce((s, R) => s + f(R), 0);
    const porAndar = (f) => andares.map((R) => NOME[R.fl] + ': ' + f(R)).join(' · ');
    // --- perfilado e tampa (no térreo, sem o vão de cada viga)
    const pecas = andares.flatMap((R) => R.T.flatMap((t) => t.pecas));
    const Ltot = pecas.reduce((s, v) => s + v, 0);
    const barras = cortes(pecas, PERF.barra);
    const emendas = andares.reduce((s, R) => s + R.T.reduce((a, t) => a + t.emendas, 0), 0);
    const tampas = cortes(pecas, PERF.tampa);
    const conTipo = (tp) => soma((R) => R.conex.filter((c) => c.tipo === tp).length);
    const nPas = soma((R) => R.T.reduce((s, t) => s + t.nPas, 0));
    const nT = conTipo('T'), nL = conTipo('L'), nX = conTipo('X'), nPonta = conTipo('ponta') + conTipo('inicio') + 2 * nPas;
    it('Perfilado e acessórios', 'Perfilado (eletrocalha perfil) 38×38 mm liso, chapa 18, pré-zincado — barra de 3 m', 'barra', barras.length, `${fmt(Ltot)} m em ${pecas.length} peças${andares.length > 1 ? ' (' + porAndar((R) => fmt(R.T.reduce((s, t) => s + t.Lperf, 0)) + ' m') + ')' : ''}; corte: ${barras.map((b) => b.map((v) => fmt(v, 2)).join(' + ')).join(' | ')}`);
    it('Perfilado e acessórios', 'Tampa de encaixe para perfilado 38 mm, pré-zincada — barra de 3 m', 'barra', tampas.length, 'em todo o comprimento: cabo flexível 750 V (sem capa) só em perfilado liso e fechado');
    it('Perfilado e acessórios', 'Junção "T" para perfilado 38×38', 'un', nT, 'derivação do tronco para os ramais');
    it('Perfilado e acessórios', 'Junção "L" (curva horizontal 90°) para perfilado 38×38', 'un', nL, 'mudança de direção');
    if (nX) it('Perfilado e acessórios', 'Junção "X" (cruzeta) para perfilado 38×38', 'un', nX, 'cruzamento da sala do térreo (4 ramais)');
    const resE = andares.length; // uma emenda de reserva por andar (corte errado)
    it('Perfilado e acessórios', 'Emenda interna "I" (tala) para perfilado 38×38', 'un', emendas + resE, emendas ? `${emendas} para unir as barras de 3 m nos trechos mais longos (cada uma com um tirante a até 30 cm) + ${resE} de reserva` : `nenhum trecho passa de 3 m; ${resE} de reserva para corte errado`);
    it('Perfilado e acessórios', 'Tampa terminal (fechamento de ponta) para perfilado 38×38', 'un', nPonta, `pontas, início de cada rede (em cima do quadro) e ${2 * nPas} nas ${nPas} passagens das vigas do térreo (furadas para o eletroduto)`);
    // --- suspensão
    const nSusp = soma((R) => R.T.reduce((s, t) => s + t.nSusp, 0));
    const derivs = andares.flatMap((R) => R.deriv.map((d) => Object.assign({ R }, d)));
    const luzes = derivs.filter((d) => d.tipo === 'luz');
    const fixD = derivs.reduce((s, d) => s + d.fix, 0);
    const tir = (R, extra) => R.H.laje - R.base + (extra || 40);
    const pecasTir = andares.flatMap((R) => Array(R.T.reduce((s, t) => s + t.nSusp, 0)).fill(tir(R))).concat(luzes.map((d) => tir(d.R, 120))).concat(derivs.flatMap((d) => Array(d.fix).fill(tir(d.R, 80))));
    const barrasTir = cortes(pecasTir, 1000);
    const nTir = pecasTir.length;
    it('Suspensão e fixação', 'Barra roscada (vergalhão) ¼" zincada — barra de 1 m', 'barra', barrasTir.length, `${nTir} tirantes: ${nSusp} do perfilado (${porAndar((R) => '~' + fmt(tir(R), 2) + ' m')}), ${luzes.length} das caixas de luz e ${fixD} das derivações`);
    it('Suspensão e fixação', 'Chumbador PBI ¼" (drop-in, rosca interna) para concreto', 'un', nTir, 'um por tirante, só na nervura (vigota) da laje treliçada — nunca no EPS/lajota', ceil10(nTir * 1.1));
    it('Suspensão e fixação', 'Gancho curto (suporte de suspensão) para perfilado 38×38, preso no vergalhão ¼"', 'un', nSusp, `a cada 1,50 m no máximo e a até 30 cm de cada junção, curva, ponta e viga (${porAndar((R) => R.T.reduce((s, t) => s + t.nSusp, 0))})`, Math.ceil(nSusp * 1.05));
    it('Suspensão e fixação', 'Abraçadeira tipo "D" ¾" com cunha/parafuso para tirante', 'un', fixD, 'apoio das derivações mais longas, a cada 1,0 m (o eletroduto nunca fica apoiado no forro)', ceil10(fixD * 1.1));
    // --- parafusaria
    const nSub = soma((R) => R.subidas + R.reserva);
    const paraf = nT * 6 + nL * 4 + nX * 8 + (emendas + resE) * 4 + nPonta * 2 + derivs.length + nSub;
    const porcasTir = nTir * 2;
    it('Parafusaria', 'Parafuso cabeça lentilha (francês) ¼" × ½" zincado', 'un', paraf, 'junções T (6), X (8), L (4), emendas (4), tampas terminais (2) e saídas (1) — cabeça lisa para dentro do perfilado, sem ferir os cabos', ceil10(paraf * 1.1));
    it('Parafusaria', 'Porca sextavada ¼" zincada', 'un', paraf + porcasTir, `${paraf} dos parafusos + ${porcasTir} dos tirantes (uma acima e uma abaixo do suporte, da abraçadeira ou da caixa)`, ceil10((paraf + porcasTir) * 1.1));
    it('Parafusaria', 'Arruela lisa ¼" zincada', 'un', paraf + porcasTir, 'uma em cada porca', ceil10((paraf + porcasTir) * 1.1));
    const dent = nT * 3 + nL * 2 + nX * 4 + (emendas + resE) * 2 + andares.length;
    it('Parafusaria', 'Arruela dentada (de contato) ¼"', 'un', dent, 'continuidade elétrica: em um parafuso de cada lado de cada junção e emenda, e no terminal de terra', ceil10(dent * 1.2));
    // --- passagens das vigas do térreo
    const tPas = andares.flatMap((R) => R.T.filter((t) => t.nPas));
    if (tPas.length) {
      const nDN = tPas.reduce((s, t) => s + t.nPas * t.dnPas, 0);
      it('Passagens nas vigas (térreo)', 'Eletroduto corrugado reforçado DN 32 (1") — dentro da passagem da viga', 'm', Math.ceil(nDN * 0.5), `${nPas} passagens; em cada uma, ${tPas.map((t) => t.id + ': ' + t.dnPas + '×').join(' · ')} DN 32 (até 6 circuitos cada) de 0,50 m, de uma ponta do perfilado à outra`, Math.ceil(nDN * 0.5) + 1);
      it('Passagens nas vigas (térreo)', 'Bucha e arruela de alumínio 1" — passagens', 'cj', 2 * nDN, 'prende o eletroduto nas tampas terminais furadas dos dois lados', 2 * nDN + 2);
      const dMin = Math.max(...tPas.map((t) => Math.ceil(Math.sqrt((4 * t.area) / (0.4 * Math.PI)))));
      it('Passagens nas vigas (térreo)', 'Conferência: diâmetro das passagens', '—', 0, `cada passagem precisa de Ø ≥ ${Math.max(40, Math.ceil(dMin / 5) * 5)} mm livre (ou uma passagem por eletroduto DN 32); onde for menor, os cabos seguem direto pela passagem com bucha nas bordas`, 0);
      const dp = derivs.filter((d) => d.passa);
      if (dp.length) it('Passagens nas vigas (térreo)', 'Conferência: derivação que atravessa viga', '—', 0, dp.map((d) => d.id).join(', ') + ': o eletroduto DN 25 da derivação passa por uma passagem de Ø ≥ 30 mm (ou desce embutido na parede a partir da caixa vizinha)', 0);
    }
    // --- derivações e saídas
    const Lder = derivs.reduce((s, d) => s + d.L, 0) / 1000;
    it('Derivações e saídas', 'Saída lateral/inferior para eletroduto ¾" (perfilado 38×38)', 'un', derivs.length, `uma por caixa ligada (${porAndar((R) => R.deriv.length)})`, Math.ceil(derivs.length * 1.05));
    it('Derivações e saídas', 'Eletroduto corrugado reforçado DN 25 (¾"), não propagante de chama (laranja)', 'm', Math.ceil(Lder), `do perfilado até cada caixa: no forro (+10 %) e descendo na parede até a caixa; ${derivs.length} derivações, ${(Lder / derivs.length).toFixed(1).replace('.', ',')} m em média; em rolos de 25 m`, Math.ceil(Lder / 25) * 25);
    it('Derivações e saídas', 'Bucha e arruela de alumínio ¾"', 'cj', derivs.length * 2, 'na saída do perfilado e na entrada da caixa', ceil10(derivs.length * 2 * 1.1));
    it('Derivações e saídas', 'Conector (luva/adaptador) para eletroduto corrugado ¾" com rosca', 'un', derivs.length * 2, 'prende o corrugado na saída do perfilado e na caixa', ceil10(derivs.length * 2 * 1.1));
    const furosDer = derivs.reduce((s, d) => s + d.furos.length, 0);
    const travPerf = soma((R) => R.T.reduce((s, t) => s + t.travessias.length, 0));
    // --- ligação dos quadros
    it('Ligação dos quadros', 'Eletroduto corrugado reforçado DN 32 (1"), não propagante de chama', 'm', Math.ceil(soma((R) => (R.subidas + R.reserva) * R.Lsub) / 1000 + 1), `do topo de cada quadro até o perfilado, embutido na parede: ${andares.map((R) => R.board.id + ' ' + R.subidas + ' + 1 reserva').join(' · ')} (até 6 circuitos por eletroduto)`);
    it('Ligação dos quadros', 'Saída inferior para eletroduto 1" (perfilado 38×38)', 'un', nSub, 'no início da rede, em cima de cada quadro');
    it('Ligação dos quadros', 'Bucha e arruela de alumínio 1"', 'cj', nSub * 2, 'na saída do perfilado e no quadro');
    // --- caixas
    const cxParede = derivs.filter((d) => d.tipo !== 'luz').length;
    it('Caixas', 'Caixa octogonal 4×4" com fundo móvel', 'un', luzes.length, 'acima de cada luminária, presa no tirante à altura do perfilado; da caixa desce o rabicho (cabo PP) até a luminária no gesso');
    it('Caixas', 'Caixa 4×2" de embutir (parede)', 'un', cxParede, 'tomadas, interruptores, arandelas e ar-condicionado ligados pelo perfilado');
    // --- aterramento
    it('Aterramento', 'Cabo flexível 750 V 6 mm² verde-amarelo — terra do perfilado', 'm', 3 * andares.length, 'do barramento de terra (PE) de cada quadro até o início do perfilado, 3 m por andar');
    it('Aterramento', 'Terminal de compressão (olhal) 6 mm² furo ¼"', 'un', 2 * andares.length, 'nas duas pontas do cabo de terra, em cada andar');
    it('Aterramento', 'Cordoalha/jumper de cobre 6 mm² com terminais — continuidade nas passagens', 'un', nPas, 'liga as duas pontas do perfilado em cada viga do térreo (o perfilado é interrompido ali)');
    // --- miscelânea
    const ns = andares.flatMap((R) => Object.keys(R.SEC).map(Number));
    it('Miscelânea', 'Abraçadeira de nylon 200 × 4,8 mm (pacote de 100)', 'pct', andares.length, 'amarrar o feixe de cada circuito dentro do perfilado, a cada 1,5 m e em cada saída');
    it('Miscelânea', 'Anilha/etiqueta de identificação de cabos', 'cj', 1, `circuitos C${Math.min(...ns)} a C${Math.max(...ns)}: identificar em cada saída do perfilado, nas pontas e nas passagens`);
    it('Miscelânea', 'Argamassa pronta para arremate (saco 20 kg)', 'sc', andares.filter((R) => R.T.some((t) => t.travessias.length) || R.deriv.some((d) => d.furos.length)).length, `${travPerf} travessias do perfilado em alvenaria (furo 6×6 cm) e ${furosDer} furos Ø 3 cm de derivações`);
    it('Miscelânea', 'Spray de galvanização a frio (zinco)', 'un', 1, 'retocar os cortes e furos do perfilado e das barras roscadas');
    const muda = andares.flatMap((R) => Object.values(R.SEC).filter((s) => s.muda).map((s) => Object.assign({ fl: R.fl }, s)));
    return { items, Ltot, barras, tampas, emendas, nT, nL, nX, nPonta, nSusp, nTir, barrasTir, derivs: derivs.length, Lder, travPerf, furosDer, nPas, muda };
  }

  // ------------------------------------------------------------------ fora do perfilado (eletrodutos próprios, como no projeto)
  const polyLen = (P) => P.slice(1).reduce((s, q, i) => s + Math.abs(q[0] - P[i][0]) + Math.abs(q[1] - P[i][1]) + Math.abs(q[2] - P[i][2]), 0);
  function foraDoPerfilado(fls) {
    const items = [];
    const it = (grupo, desc, un, q, obs, compra) => q > 0 && items.push({ grupo, desc, un, q, compra: compra == null ? q : compra, obs: obs || '' });
    const G = 'Fora do perfilado (eletroduto próprio)';
    const pot = CIRC.filter((c) => !noPerfilado(c) && fls.includes(c.board));
    const Lpot = (pot.reduce((s, c) => s + c.conduite, 0) * 1.1) / 1000;
    if (pot.length) it(G, 'Eletroduto corrugado reforçado DN 25 (¾") — circuitos de potência', 'm', Math.ceil(Lpot), pot.map((c) => 'C' + c.n + ' ' + c.desc.replace(/ \(.*\)$/, '').replace(/^Tomadas — /, 'tomadas ')).join(' · ') + ' — do quadro ao ponto, um eletroduto por circuito, preso nos tirantes do perfilado; em rolos de 25 m', Math.ceil(Lpot / 25) * 25);
    const fx = Math.ceil(pot.reduce((s, c) => s + c.horiz, 0) / 800);
    it(G, 'Abraçadeira tipo "D" ¾" com parafuso ¼" (no tirante do perfilado ou em tirante próprio)', 'un', fx, 'a cada 0,80 m; onde correm junto do perfilado, prendem no mesmo tirante, abaixo do suporte', ceil10(fx * 1.1));
    const ptsPot = pot.flatMap((c) => c.pts.map((id) => PBY[id]));
    const ch = ptsPot.filter((p) => p.eq === 'chuveiro').length;
    it(G, 'Caixa 4×4" de embutir (parede) — chuveiros', 'un', ch, 'conector do chuveiro');
    it(G, 'Caixa 4×2" de embutir (parede) — circuitos de potência', 'un', new Set(ptsPot.filter((p) => p.eq !== 'chuveiro').map((p) => p.caixa || p.id)).size, 'cozinha (16 A), micro-ondas e ar-condicionado de 16 A');
    const baixoT = fls.includes('T') ? CIRC.flatMap((c) => c.baixo.filter((b) => b.fl === 'T')) : [], baixoS = CIRC.flatMap((c) => c.baixo.filter((b) => b.fl !== 'T' && fls.includes(b.fl)));
    if (baixoT.length) it(G, 'Eletroduto PEAD corrugado Ø 32 mm enterrado — motor do portão', 'm', Math.ceil(baixoT.reduce((s, b) => s + polyLen(b.path), 0) * 1.1 / 1000), 'por baixo do piso até o muro da frente, a −0,40 m, com fita de aviso (como no projeto)');
    if (baixoS.length) it(G, 'Eletroduto corrugado reforçado DN 25 (¾") no contrapiso — varanda descoberta', 'm', Math.ceil(baixoS.reduce((s, b) => s + polyLen(b.path), 0) * 1.1 / 1000), 'arandelas dos muros da varanda descoberta (por baixo, como no projeto)');
    it(G, 'Escada (paralelos e arandelas)', 'vb', 1, 'embutidos nas paredes da escada, sem forro — iguais ao projeto elétrico' + (fls.length === 1 ? ' (a parte deste andar)' : ''));
    return items;
  }

  const FERRAMENTAS = [
    ['Furadeira/martelete SDS com broca 3/8" (9,5 mm)', 'furo do chumbador PBI ¼" (27 mm de fundo)'],
    ['Batedor (assentador) do chumbador PBI ¼"', 'obrigatório: é ele que expande o chumbador dentro do furo'],
    ['Serra-copo 7/8" e 1⅜" (ou punção)', 'furos das saídas ¾" e 1" no perfilado e nas tampas terminais das passagens'],
    ['Serra de fita/arco ou esmerilhadeira com disco de corte fino', 'corte do perfilado e das barras roscadas (rebarbar e passar zinco)'],
    ['Detector de vigotas (ou furo-piloto)', 'achar a nervura de concreto da laje treliçada antes de chumbar'],
    ['Nível a laser ou mangueira de nível', 'marcar a altura do perfilado nas paredes'],
  ];

  function tudo(opts) {
    const R = { T: calcula('T', opts && opts.T), 1: calcula('1', opts && opts[1]), 2: calcula('2', opts && opts[2]) };
    const M = materiais([R.T, R[1], R[2]]);
    const F = foraDoPerfilado(['T', '1', '2']);
    // por andar, para comprar e orçar em etapas: cada lista com o seu corte de barras e a sua margem de perda
    const porAndar = {};
    ['T', '1', '2'].forEach((k) => { const Mk = materiais([R[k]]); porAndar[k] = { M: Mk, items: Mk.items.concat(foraDoPerfilado([k])) }; });
    return { R, M, F, items: M.items.concat(F), porAndar, FERRAMENTAS, PERF, H, LIM, LEVEL, PASSAGENS, fca, IZ };
  }

  DD.perfilado = { REDE, PERF, H, LIM, LEVEL, PASSAGENS, calcula, tudo, cortes, fca, base, eixo, NOME };
})();
