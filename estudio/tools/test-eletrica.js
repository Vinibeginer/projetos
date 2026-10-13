// Testes do módulo 18-eletrica.js (projeto elétrico, NBR 5410).
//   node tools/test-eletrica.js
global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('../src/00-data.js');
require('../src/01-core.js');
require('../src/15-structure.js');
require('../src/17-hidro.js');
require('../src/18-eletrica.js');
const E = global.DD.eletrica;
let bad = 0;
const check = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
  if (!cond) bad++;
};
const P = E.PONTOS;
check('pontos gerados', P.length > 80, P.length + ' pontos');
check('ids únicos', new Set(P.map((p) => p.id)).size === P.length);
const qdc = P.find((p) => p.k === 'qdc');
const porta = global.DD.data.initialState().openings.find((o) => o.id === 'o0_p1_quarto'); // vão em t = 850 (x = 4,15 + 0,85 m)
check('QDC na parede do quarto do térreo, à direita da porta (vista da sala) e antes da escada', qdc && qdc.fl === 'T' && qdc.y === 8750 && qdc.x - 250 > 4150 + porta.t + porta.width / 2 && qdc.x + 250 <= 6200);
const pe = E.PBY.PE;
check('padrão na quina do muro esquerdo com o muro da frente', pe.x < 700 && pe.y >= 19800);
const R = E.ALIM_ROUTE;
check('alimentador enterrado até a parede do lavabo e subindo para o QDC', R.some((q) => q[2] < 0 && q[0] === 2800 && q[1] === 10425) && R[R.length - 1][0] === qdc.x && R[R.length - 1][1] === qdc.y);
check('rede: QDT, entrada da fibra, pontos RJ45 nos quartos e sala, Wi-Fi em cada pavimento', ['QDT', 'CXT', 'CPT'].every((id) => E.PBY[id]) && ['T', '1', '2'].every((fl) => P.some((p) => p.fl === fl && (p.tel === 'ap' || p.tel === 'roteador'))) && P.filter((p) => p.tel === 'rj').length >= 6);
check('rede: vala da fibra a 20 cm ou mais da do alimentador', (() => { const T = E.TEL_ROUTE; return Math.abs(T[4][0] - R[4][0]) >= 200 && Math.abs(T[3][1] - R[3][1]) >= 200; })());
check('rede: cabo Cat6 de cada ponto até o QDT com até 90 m', E.TEL.cabos.every((c) => c.L <= 90000));
check('todo ponto de luz, tomada e TUE está num circuito', P.filter((p) => /il|tug|tue/.test(p.k)).every((p) => p.circ));
check('todo interruptor comanda um ponto de luz existente', P.filter((p) => /int/.test(p.k)).every((p) => (p.liga || []).every((id) => E.PBY[id] && E.PBY[id].k === 'il')));
check('circuitos: Ib ≤ In ≤ Iz e ΔV ≤ 4 %', E.CIRC.every((c) => c.ok), E.CIRC.filter((c) => !c.ok).map((c) => 'C' + c.n).join(','));
check('seções mínimas (1,5 iluminação / 2,5 força)', E.CIRC.every((c) => c.secao >= (c.tipo === 'il' ? 1.5 : 2.5)));
check('iluminação separada das tomadas', E.CIRC.every((c) => c.pts.every((id) => (c.tipo === 'il') === /il|int/.test(E.PBY[id].k))));
check('aparelhos acima de 10 A em circuito exclusivo; ar-condicionados (< 10 A cada) agrupados até 16 A', E.CIRC.filter((c) => c.tipo === 'tue' && c.eq !== 'ac').every((c) => c.pts.length === 1) && E.CIRC.filter((c) => c.eq === 'ac').every((c) => c.v === 220 && c.disj <= 16 && c.pts.every((id) => E.PBY[id].va / 220 < 10)));
check('chuveiros 6.500 W em 220 V, cabo de 6 mm², circuito próprio e DR', E.CIRC.filter((c) => c.eq === 'chuveiro').every((c) => c.v === 220 && c.va === 6500 && c.secao >= 6 && c.pts.length === 1 && !!c.dr));
check('todos os circuitos com DR 30 mA', E.CIRC.every((c) => !!c.dr));
check('um quadro trifásico por andar; cada circuito sai do quadro do seu próprio andar (nenhum circuito em quadro de outro pavimento)', ['T', '1', '2'].every((b) => E.BOARDS[b] && P.some((p) => p.k === 'qdc' && p.fl === b)) && E.CIRC.every((c) => c.board === c.fl && c.pts.every((id) => E.PBY[id].fl === c.board || E.PBY[id].k === 'int3'))); // só o paralelo da chegada da escada comanda a luz do lance de baixo
check('disjuntor geral dos andares de 25 A (decisão da obra), seletivo com o padrão pela regra dos fabricantes (≥ 1,6 × In) e no curto; DR depois dele com In ≥ o disjuntor; padrão de 70 A e ramal de 16 mm² mantidos', ['1', '2'].every((b) => E.SUB[b].disj === E.DISJ_ANDAR && E.DISJ_ANDAR === 25 && E.DRS.filter((d) => d.board === b && d.secao === 'quadro').every((d) => d.in >= E.SUB[b].disj)) && E.SELET.filter((x) => x.razao).every((x) => x.razao >= E.RAZAO_SOBRE && x.okCurto && x.picoLim > 2 * x.uso) && E.ALIM.disj === 70 && E.ALIM.secao === 16, E.SELET.filter((x) => x.razao).map((x) => x.de + ' ' + x.In + ' A, pico a partir de ' + x.picoLim.toFixed(1) + ' A (uso ' + x.uso.toFixed(1) + ' A)').join(' · '));
check('alimentadores dos andares protegidos pelo padrão (Iz ≥ In do padrão) e disjuntor geral de cada andar no próprio quadro', ['1', '2'].every((b) => { const d = E.SUB[b]; return d.I <= E.ALIM.disj && d.ok && d.iz >= E.ALIM.disj && d.disj >= d.Iq && d.grupo.length > 0; }) && E.QT.items.some((i) => /Disjuntor DIN curva C 3P \d+ A — geral do QD-1 \(no próprio quadro\)/.test(i.desc)));
check('fases equilibradas no uso real (sem chuveiro, ≤ 15 %)', (() => { const f = E.CENARIO.find((c) => c.id === 'semch').I, m = Math.max(f.A, f.B, f.C); return (m - Math.min(f.A, f.B, f.C)) / m <= 0.15; })());
check('seletividade: circuito → disjuntor do quadro do andar → padrão (sobrecarga 1,45/1,13 nos circuitos, razão ≥ 1,6 nos andares; curto) em todos os pares', E.SELET.length === E.CIRC.length + 2 && E.SELET.every((x) => x.okSobre && x.okCurto) && E.CIRC.filter((c) => c.atras).every((c) => E.SELET.find((x) => x.de === 'C' + c.n).para === E.SUB[c.board].board.id) && ['QD-1', 'QD-2'].every((q) => E.SELET.find((x) => x.de === q).para === 'Padrão'), E.SELET.filter((x) => !(x.okSobre && x.okCurto)).map((x) => x.de).join(','));
check('cada andar se desliga pelo térreo: chave seccionadora própria no QDC (≥ In do padrão), na 1ª fileira, sem chave de entrada no quadro do andar', ['1', '2'].every((b) => { const d = E.SUB[b]; return d.chaveNo === 'QDC' && d.chave >= E.ALIM.disj && E.QT.items.some((i) => i.desc === 'Chave seccionadora 3P ' + d.chave + ' A (sem disparo, não é disjuntor) — no QDC, saída para o ' + d.board.id) && E.QT.MOD.T.fileiras[0].some((x) => x.txt === 'Secc. ' + d.board.id) && !E.QT.MOD[b].fileiras.flat().some((x) => x.t === 'chave'); }));
check('ramal protegido pelo disjuntor do padrão (Iz ≥ In) e geral do QDC sem disparo', E.ALIM.okIz && E.QT.items.some((i) => /Chave seccionadora 3P .*geral do QDC/.test(i.desc)) && !E.QT.items.some((i) => /Disjuntor geral/.test(i.desc)));
check('quadros de andar gastam menos cabo nos circuitos que um quadro só', E.COMPARA.cabosQuadros < E.COMPARA.cabosUnico);
const f = E.FASES, mx = Math.max(f.A, f.B, f.C), mn = Math.min(f.A, f.B, f.C);
check('fases equilibradas na carga nominal (desequilíbrio ≤ 15 %)', (mx - mn) / mx <= 0.15, JSON.stringify(f));
check('banheiro: tomada a 0,60 m ou mais do chuveiro', P.filter((p) => p.k === 'tug' && /Lav|Banh|Suíte/.test(p.amb)).every((t) => P.filter((c) => c.eq === 'chuveiro' && c.fl === t.fl).every((c) => Math.hypot(c.x - t.x, c.y - t.y) >= 600)));
check('chuveiros em pares de fases diferentes', new Set(E.CIRC.filter((c) => c.eq === 'chuveiro').map((c) => c.fases)).size === 3);
check('cenários com um chuveiro de cada vez dentro do geral', E.CENARIO.filter((c) => c.projeto).every((c) => c.max <= E.ALIM.disj) && E.CENARIO.filter((c) => c.projeto && c.chuveiros).every((c) => c.chuveiros === 1), E.ALIM.Iproj.toFixed(1) + ' A, geral ' + E.ALIM.disj + ' A');
check('ramal principal em 16 mm² (cabo 0,6/1 kV EPR) protegido pelo padrão', E.ALIM.secao === 16 && E.ALIM.okIz);
check('ramal principal com no mínimo 16 mm² e disjuntor geral ≤ capacidade', E.ALIM.secao >= 16 && E.ALIM.okIz, E.ALIM.secao + ' mm², ' + E.ALIM.disj + ' A, Iz ' + E.ALIM.iz + ' A');
check('queda de tensão total (alimentador + circuito) ≤ 5 %', E.CIRC.every((c) => c.dvTot <= 5), 'alim ' + E.ALIM.dv.toFixed(2) + ' %, máx ' + Math.max(...E.CIRC.map((c) => c.dvTot)).toFixed(2) + ' %');
check('lista de materiais com cabos, quadro e dispositivos', ['Cabos', 'Quadros', 'Dispositivos', 'Eletrodutos'].every((g) => E.QT.items.some((i) => i.grupo === g)));
check('nenhum eletroduto no ar: ponto fora da área coberta vai por baixo (enterrado no térreo, contrapiso no 2º)', P.filter((p) => /il|int|tug|tue/.test(p.k)).every((p) => { if (E.coberto(p)) return true; const b = p.circ.baixo.find((x) => x.id === p.id); return b && b.path.slice(1, -1).every((q) => q[2] <= 0) && !Object.values(p.circ.trees).some((t) => t.edges.some((e) => e.b === p)); }));
check('parede da TV (divisa da direita da sala) com 3 tomadas e RJ45 a 1,80 m', ['T-TV1', 'T-TV2', 'T-TV3', 'T-RJ1'].every((id) => E.PBY[id] && E.PBY[id].x === 8850 && E.PBY[id].z === 1800 && E.PBY[id].y > 11700 && E.PBY[id].y < 13600) && ['T-TV1', 'T-TV2', 'T-TV3'].every((id) => E.PBY[id].circ));
check('tomada alta de ar-condicionado em cada quarto e na sala, em circuito de ar-condicionado (220 V)', ['Quarto', 'Quarto Master', 'Quarto 1', 'Quarto 2', 'Sala'].every((amb) => E.PONTOS.some((p) => p.eq === 'ac' && p.amb === amb && p.z >= 2200 && p.circ.eq === 'ac' && p.circ.v === 220 && !p.circ.atras)));
check('quadro de 24 módulos comprado pela obra usado onde cabe (com a reserva da NBR 5410); os demais com módulos para todos os circuitos do andar + reserva', (() => { const M = E.QT.MOD, b = E.COMPRADO.board; return M[b].comprado && M[b].tam === 24 && M[b].mod + M[b].res <= 24 && ['T', '1', '2'].every((k) => M[k].mod + M[k].res <= M[k].tam && M[k].circ === E.CIRC.filter((c) => c.fl === k).length); })(), ['T', '1', '2'].map((k) => E.BOARDS[k].id + ' ' + E.QT.MOD[k].mod + '+' + E.QT.MOD[k].res + '/' + E.QT.MOD[k].tam).join(' · '));
check('montagem sugerida: cada quadro cabe nas suas fileiras de 12 módulos, com todos os circuitos, DRs e reservas', ['T', '1', '2'].every((b) => { const M = E.QT.MOD[b], F = M.fileiras, it = F.flat(); return F.length <= M.tam / 12 && F.every((f) => f.reduce((s2, x) => s2 + x.mod, 0) <= 12) && E.CIRC.filter((c) => c.board === b).every((c) => it.some((x) => x.txt === 'C' + c.n)) && it.filter((x) => x.t === 'res').length === M.res && it.reduce((s2, x) => s2 + x.mod, 0) === M.mod + M.res; }));
// NBR 5410 9.5.2: quantidade mínima de tomadas e carga mínima de iluminação em cada cômodo
{
  const doc = global.DD.data.initialState(), FLID = { f0: 'T', f1: '1', f2: '2' }, falta = [];
  doc.floors.forEach((f) => global.DD.rooms.compute(doc, f.id).filter((r) => !r.open).forEach((r) => {
    const fl = FLID[f.id], A = r.area, Pm = r.perimeter / 1000, n = r.name;
    const doCom = (p) => p.fl === fl && p.amb.replace(/\s*\(.*\)\s*$/, '') === n;
    const tug = P.filter((p) => doCom(p) && p.k === 'tug').length, il = P.filter((p) => doCom(p) && p.k === 'il').reduce((s2, p) => s2 + p.va, 0);
    const min = /^(Lav\.|Banh|Suíte$)/.test(n) && A < 5 ? 1 // banheiro: junto ao lavatório
      : /Cozinha|Serviço|Varanda coberta/.test(n) ? Math.ceil(Pm / 3.5) // cozinha, área de serviço e análogos (varanda gourmet)
      : /Varanda/.test(n) ? 1
      : /Sala|Quarto/.test(n) ? Math.ceil(Pm / 5)
      : A <= 6 ? 1 : Math.ceil(Pm / 5); // demais cômodos
    const ilMin = 100 + 60 * Math.max(0, Math.floor((A - 6) / 4));
    if (tug < min || il < ilMin) falta.push(`${fl} ${n}: TUG ${tug}/${min}, luz ${il}/${ilMin} VA`);
  }));
  check('NBR 5410 9.5.2: tomadas mínimas por cômodo (perímetro) e carga mínima de iluminação (área)', !falta.length, falta.join(' · '));
}
// NBR 5410 6.2.11.1.6: entre caixas, até 15 m (internas) ou 30 m (externas), menos 3 m por curva de 90°, e no máximo
// 3 curvas; rede: no máximo 2 curvas. Cada percurso é cortado nas caixas de passagem do projeto e conferido trecho a trecho.
{
  const fora = [];
  /** Corta o percurso P nas caixas (pontos sobre ele, até 16 cm de folga) e devolve os trechos entre caixas. */
  const cortar = (P, boxes) => {
    const pts = P.map((q) => q.slice(0, 3)), cortes = [];
    boxes.forEach((b) => {
      const q = [b.x, b.y, b.z + E.LEVEL[b.fl] - (P.lv || 0)];
      let best = null;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], c = pts[i], d = [0, 1, 2].map((k) => c[k] - a[k]), L2 = d.reduce((s2, v) => s2 + v * v, 0) || 1;
        const t = Math.max(0, Math.min(1, [0, 1, 2].reduce((s2, k) => s2 + (q[k] - a[k]) * d[k], 0) / L2));
        const pr = [0, 1, 2].map((k) => a[k] + d[k] * t), dd = Math.hypot(...[0, 1, 2].map((k) => pr[k] - q[k]));
        if (!best || dd < best.dd) best = { dd, i, t, pr };
      }
      if (best && best.dd <= 160) cortes.push(best);
    });
    cortes.sort((u, v) => u.i - v.i || u.t - v.t);
    const runs = [];
    let cur = [pts[0]], k = 0;
    for (let i = 1; i < pts.length; i++) {
      while (k < cortes.length && cortes[k].i === i) { cur.push(cortes[k].pr); runs.push(cur); cur = [cortes[k].pr]; k++; }
      cur.push(pts[i]);
    }
    runs.push(cur);
    return runs;
  };
  const conf = (nome, P, boxes, ext, maxC) => cortar(P, boxes).forEach((R, i) => {
    const x = typeof ext === 'function' ? ext(R) : ext;
    if (!E.cabe(R, x, maxC)) fora.push(`${nome} trecho ${i + 1}: ${(E.len3(R) / 1000).toFixed(1)} m, ${E.curvasDe(R)} curvas`);
  });
  E.CIRC.forEach((c) => {
    Object.entries(c.trees).forEach(([fl, t]) => t.edges.forEach((e) => { const P = E.trechoArv(e, fl); P.lv = E.LEVEL[fl]; conf('C' + c.n + ' ' + e.a.id + '→' + e.b.id, P, e.caixas, false); }));
    c.baixo.forEach((b) => { const P = b.path.slice(); P.lv = E.LEVEL[b.fl]; conf('C' + c.n + ' (por baixo)', P, b.caixas, (R) => E.externo(R, b.fl)); });
  });
  conf('ramal', E.ALIM_ROUTE, E.ALIM_CAIXAS, (R) => E.externo(R, 'T'));
  Object.entries(E.SUB_ROUTE).forEach(([b, R]) => conf('alimentador QD-' + b, R, E.CAIXAS.filter((x) => x.uso === 'alimentador' && x.quem.includes('alimentador do QD-' + b)), false));
  conf('fibra', E.TEL_ROUTE, E.CAIXAS.filter((x) => x.uso === 'rede' && x.quem.includes('fibra')).concat([Object.assign({ fl: 'T' }, E.PBY.CPT)]), (R) => E.externo(R, 'T'), 2);
  Object.entries(E.TEL.trees).forEach(([fl, t]) => t.edges.forEach((e) => { const P = E.trechoArv(e, fl); P.lv = E.LEVEL[fl]; conf('rede ' + e.b.id, P, e.caixas, false, 2); }));
  check('NBR 5410 6.2.11.1.6: trechos entre caixas ≤ 15 m (30 m externos) − 3 m por curva, ≤ 3 curvas (rede ≤ 2), com as caixas de passagem do projeto', !fora.length, fora.slice(0, 8).join(' · ') || E.CAIXAS.length + ' caixas de passagem');
  check('caixas de passagem: nenhuma enterrada dentro de casa (tampa no piso da sala/garagem)', E.CAIXAS.every((b) => b.onde !== 'enterrada' || !E.coberto(b)), E.CAIXAS.filter((b) => b.onde === 'enterrada' && E.coberto(b)).map((b) => b.id).join(','));
}
check('NBR 5410 6.2.11.1.6: taxa de ocupação dos eletrodutos (≤ 40 % com 3 ou mais condutores) em todos os casos do projeto', E.OCUPACAO.filter((o) => !o.comparar).every((o) => o.ok), E.OCUPACAO.map((o) => o.dn + ':' + Math.round(o.taxa * 100) + '%').join(' '));
check('tomada nunca menor que o disjuntor do circuito (20 A nos circuitos de 16 A)', E.QT.items.some((i) => /Tomada 2P\+T 20 A/.test(i.desc) && i.q >= E.PONTOS.filter((p) => p.k === 'tug' && !p.externa && p.circ && p.circ.disj > 10).length));
check('quadros com etiqueta de advertência e identificação dos circuitos; DPS ligado com ≥ 4 mm²', ['Etiqueta de advertência', 'Identificação dos circuitos', '4 mm² .* ligação dos DPS'].every((r) => E.QT.items.some((i) => new RegExp(r).test(i.desc))));
// forro de gesso: infra sob a laje, acima do forro; o forro fica abaixo dos esgotos que correm sob a laje e acima das tomadas altas
{
  const HH = global.DD.hidro, ruim = [];
  ['T', '1', '2'].forEach((fl) => {
    if (!(E.TT[fl] >= E.FORRO[fl] + 40 && E.TT[fl] < E.LAJE[fl])) ruim.push(fl + ': eletroduto não fica entre o forro e a laje');
    const topo = E.LEVEL[fl] + E.LAJE[fl];
    HH.PIPES.forEach((pp) => pp.pts.slice(1).forEach((q, i) => {
      const a = pp.pts[i];
      if (Math.hypot(q[0] - a[0], q[1] - a[1]) < 200) return; // só os trechos horizontais
      const fundo = Math.min(a[2], q[2]) - pp.dn / 2;
      if (fundo > topo - 700 && fundo <= topo && fundo < E.LEVEL[fl] + E.FORRO[fl] + 20) ruim.push(fl + ': ' + pp.id + ' abaixo do forro');
    }));
  });
  const luzes = P.filter((p) => p.k === 'il' && p.tipo === 'teto');
  check('forro de gesso: eletrodutos sob a laje acima do forro, luzes no forro, forro abaixo dos esgotos sob a laje e acima de tudo o que fica na parede', !ruim.length && luzes.every((p) => p.z === E.FORRO[p.fl]) && P.filter((p) => p.z < E.FORRO[p.fl] - 10 && !/qdc|medidor/.test(p.k) && p.amb !== 'Escada').every((p) => p.z <= E.FORRO[p.fl] - 150), ruim.join(' · ') + ' forro ' + ['T', '1', '2'].map((f) => E.FORRO[f]).join('/'));
}
check('dois DRs por quadro de andar e no QDC: iluminação e tomadas separadas dos chuveiros e aparelhos', ['T', '1'].every((b) => { const D = E.DRS.filter((d) => d.board === b); return D.length === 2 && D.every((d) => { const L = d.circ.map((n) => E.CIRC.find((c) => c.n === n)); return L.every((c) => c.tipo === 'tue' && c.eq !== 'mlr') || L.every((c) => c.tipo !== 'tue' || c.eq === 'mlr'); }); }));
check('iluminação e tomadas dos andares atrás do disjuntor do andar (até 10 A, curva B); chuveiros e ar ligados antes dele', E.CIRC.filter((c) => c.board !== 'T' && c.fl === c.board && (c.tipo === 'il' || c.tipo === 'tug')).every((c) => c.atras && c.disj <= 10 && c.curva === 'B') && E.CIRC.filter((c) => c.eq === 'chuveiro' || c.eq === 'ac').every((c) => !c.atras));
{
  const comodo = (id) => E.PBY[id].amb.replace(/\s*\(.*\)\s*$/, '');
  const ambs = (c) => [...new Set(c.pts.filter((id) => !/int/.test(E.PBY[id].k)).map(comodo))];
  check('tomadas: um circuito por cômodo (nenhum circuito de tomadas junta dois cômodos)', E.CIRC.filter((c) => c.tipo === 'tug').every((c) => ambs(c).length === 1));
  check('iluminação: um circuito a cada dois cômodos (as luzes externas juntas)', E.CIRC.filter((c) => c.tipo === 'il').every((c) => ambs(c).length <= 2 || ambs(c).every((a) => /Fachada|Quintal|Corredor/.test(a))), E.CIRC.filter((c) => c.tipo === 'il').map((c) => ambs(c).join('+')).join(' | '));
}
check('seletividade circuito → quadro → padrão em todos os pares (sobrecarga e curto)', E.SELET.every((x) => x.okSobre && x.okCurto));
check('roteador no forro depois da 2ª janela da parede da garagem, com tomada', E.PBY['T-RT1'].y > 14220 && E.PBY['T-RT1'].z === E.FORRO.T && E.PBY['T-T-RT'].circ && E.TEL.cabos.some((c) => c.id === 'T-RT1'));
check('motor do portão enterrado a −0,40 m até o muro', E.PBY['T-PT1'].circ.baixo.some((b) => b.id === 'T-PT1' && b.path.some((q) => q[2] === -400)));
['T', '1', '2'].forEach((fl) => check('pavimento ' + fl + ': eletrodutos desenhados', E.conduits(fl).length > 5));
// compatibilização: nenhuma descida/subida de eletroduto passa por janela ou porta; nenhum ponto sobre pilar
{
  const doc = global.DD.data.initialState(), FID = { T: 'f0', 1: 'f1', 2: 'f2' };
  const vao = P.filter((p) => !/qdc|medidor/.test(p.k) && p.z < E.TETO && !(p.k === 'tel' && p.tel !== 'rj')).filter((p) => {
    const debaixo = p.circ && p.circ.baixo && p.circ.baixo.some((b) => b.id === p.id);
    return doc.openings.some((o) => {
      const w = doc.walls.find((x) => x.id === o.wall);
      if (!w || w.floor !== FID[p.fl]) return false;
      const f = global.DD.geom.openingFrame(w, o);
      const al = (p.x - f.c.x) * f.d.x + (p.y - f.c.y) * f.d.y, ac = (p.x - f.c.x) * f.n.x + (p.y - f.c.y) * f.n.y;
      if (Math.abs(ac) > w.thick / 2 + 90 || Math.abs(al) > o.width / 2 + 100) return false;
      return debaixo ? (o.sill || 0) < p.z : (o.sill || 0) + o.height > p.z;
    });
  });
  check('nenhuma descida de eletroduto passa por janela ou porta', !vao.length, vao.map((p) => p.id).join(','));
  const fs = require('fs'), stf = require('path').join(__dirname, '..', 'private', 'estrutura.json');
  if (fs.existsSync(stf)) {
    const pil = global.DD.structure.revisar(JSON.parse(fs.readFileSync(stf, 'utf8'))).pilares, LV = E.LEVEL;
    const emPilar = P.filter((p) => !/qdc|medidor/.test(p.k) && p.z < E.TETO).filter((p) => pil.some((c) => c.topo > LV[p.fl] + 100 && p.x > c.x0 - 50 && p.x < c.x1 + 50 && p.y > c.y0 - 50 && p.y < c.y1 + 50));
    check('nenhum ponto sobre pilar (projeto estrutural privado)', !emPilar.length, emPilar.length + ' em pilar');
  } else console.log('SKIP pilares: private/estrutura.json ausente');
}
// caixas elétricas fora da trajetória dos tubos do hidrossanitário (15 cm)
{
  const HH = global.DD.hidro, LV = E.LEVEL;
  const perto = P.filter((p) => p.z < E.TETO && !/medidor/.test(p.k)).filter((p) => HH.PIPES.some((pp) => pp.pts.slice(1).some((b, i) => {
    const a = pp.pts[i], n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 25));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      if (Math.abs(z - LV[p.fl] - p.z) < 80 && Math.hypot(x - p.x, y - p.y) < 120) return true;
    }
    return false;
  })));
  check('nenhuma caixa elétrica na trajetória de tubo do hidrossanitário', !perto.length, perto.map((p) => p.id).join(','));
  // caixas de passagem (laje, parede, enterradas) também fora dos tubos (20 cm)
  const pertoCx = E.CAIXAS.filter((b) => HH.PIPES.some((pp) => pp.pts.slice(1).some((q, i) => {
    const a = pp.pts[i], n = Math.max(2, Math.ceil(Math.hypot(q[0] - a[0], q[1] - a[1], q[2] - a[2]) / 25));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a[0] + (q[0] - a[0]) * t, y = a[1] + (q[1] - a[1]) * t, z = a[2] + (q[2] - a[2]) * t;
      if (Math.abs(z - LV[b.fl] - b.z) < 150 && Math.hypot(x - b.x, y - b.y) < 200) return true;
    }
    return false;
  })));
  check('nenhuma caixa de passagem na trajetória de tubo do hidrossanitário', !pertoCx.length, pertoCx.map((b) => b.id).join(','));
}
console.log(bad ? 'test-eletrica: ' + bad + ' falha(s)' : 'test-eletrica: todos os testes ok');
process.exit(bad ? 1 : 0);
