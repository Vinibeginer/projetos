// Testes do módulo 18-eletrica.js (projeto elétrico, NBR 5410).
//   node tools/test-eletrica.js
global.window = global;
require('../src/00-data.js');
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
check('QDC sob a escada, na parede do quarto do térreo (y = 8,75 m, x entre 6,15 e 8,85 m)', qdc && qdc.fl === 'T' && qdc.y === 8750 && qdc.x > 6150 && qdc.x < 8850);
check('todo ponto de luz, tomada e TUE está num circuito', P.filter((p) => /il|tug|tue/.test(p.k)).every((p) => p.circ));
check('todo interruptor comanda um ponto de luz existente', P.filter((p) => /int/.test(p.k)).every((p) => (p.liga || []).every((id) => E.PBY[id] && E.PBY[id].k === 'il')));
check('circuitos: Ib ≤ In ≤ Iz e ΔV ≤ 4 %', E.CIRC.every((c) => c.ok), E.CIRC.filter((c) => !c.ok).map((c) => 'C' + c.n).join(','));
check('seções mínimas (1,5 iluminação / 2,5 força)', E.CIRC.every((c) => c.secao >= (c.tipo === 'il' ? 1.5 : 2.5)));
check('iluminação separada das tomadas', E.CIRC.every((c) => c.pts.every((id) => (c.tipo === 'il') === /il|int/.test(E.PBY[id].k))));
check('TUE em circuito exclusivo', E.CIRC.filter((c) => c.tipo === 'tue').every((c) => c.pts.length === 1));
check('chuveiros 7.500 W em 220 V com 6 mm² ou mais e DR próprio', E.CIRC.filter((c) => c.eq === 'chuveiro').every((c) => c.v === 220 && c.secao >= 6 && E.DRS.find((d) => d.id === c.dr).circ.length === 1));
check('todos os circuitos com DR 30 mA', E.CIRC.every((c) => !!c.dr));
const f = E.FASES, mx = Math.max(f.A, f.B, f.C), mn = Math.min(f.A, f.B, f.C);
check('fases equilibradas (desequilíbrio ≤ 10 %)', (mx - mn) / mx <= 0.1, JSON.stringify(f));
check('banheiro: tomada a 0,60 m ou mais do chuveiro', P.filter((p) => p.k === 'tug' && /Lav|Banh|Suíte/.test(p.amb)).every((t) => P.filter((c) => c.eq === 'chuveiro' && c.fl === t.fl).every((c) => Math.hypot(c.x - t.x, c.y - t.y) >= 600)));
check('ramal principal de 16 mm² com disjuntor geral ≤ capacidade', E.ALIM.secao === 16 && E.ALIM.okIz, E.ALIM.secao + ' mm², ' + E.ALIM.disj + ' A, Iz ' + E.ALIM.iz + ' A');
check('queda de tensão total (alimentador + circuito) ≤ 5 %', E.CIRC.every((c) => c.dvTot <= 5), 'alim ' + E.ALIM.dv.toFixed(2) + ' %, máx ' + Math.max(...E.CIRC.map((c) => c.dvTot)).toFixed(2) + ' %');
check('lista de materiais com cabos, quadro e dispositivos', ['Cabos', 'Quadro', 'Dispositivos', 'Eletrodutos'].every((g) => E.QT.items.some((i) => i.grupo === g)));
['T', '1', '2'].forEach((fl) => check('pavimento ' + fl + ': eletrodutos desenhados', E.conduits(fl).length > 5));
console.log(bad ? 'test-eletrica: ' + bad + ' falha(s)' : 'test-eletrica: todos os testes ok');
process.exit(bad ? 1 : 0);
