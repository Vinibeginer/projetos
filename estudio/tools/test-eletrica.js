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
check('TUE em circuito exclusivo', E.CIRC.filter((c) => c.tipo === 'tue').every((c) => c.pts.length === 1));
check('chuveiros 6.500 W em 220 V, cabo de 6 mm² e DR próprio', E.CIRC.filter((c) => c.eq === 'chuveiro').every((c) => c.v === 220 && c.va === 6500 && c.secao >= 6 && E.DRS.find((d) => d.id === c.dr).circ.length === 1));
check('todos os circuitos com DR 30 mA', E.CIRC.every((c) => !!c.dr));
check('um quadro trifásico por andar; cada circuito sai do quadro do seu andar', ['T', '1', '2'].every((b) => E.BOARDS[b] && P.some((p) => p.k === 'qdc' && p.fl === b)) && E.CIRC.every((c) => c.board === (c.eq === 'chuveiro' ? 'T' : c.fl)));
check('alimentadores dos quadros de andar: Ib ≤ In ≤ Iz', ['1', '2'].every((b) => { const d = E.SUB[b]; return d.I <= d.disj && d.ok; }));
check('fases equilibradas no uso real (sem chuveiro, ≤ 15 %)', (() => { const f = E.CENARIO.find((c) => c.id === 'semch').I, m = Math.max(f.A, f.B, f.C); return (m - Math.min(f.A, f.B, f.C)) / m <= 0.15; })());
check('seletividade: em toda a cadeia o mais próximo desarma primeiro (sobrecarga 1,45/1,13 e curto 10×/5×)', E.SELET.length > 20 && E.SELET.every((x) => x.okSobre && x.okCurto), E.SELET.filter((x) => !(x.okSobre && x.okCurto)).map((x) => x.de).join(','));
check('ramal protegido pelo disjuntor do padrão (Iz ≥ In) e geral do QDC sem disparo', E.ALIM.okIz && E.QT.items.some((i) => /Chave seccionadora 3P .*geral do QDC/.test(i.desc)) && !E.QT.items.some((i) => /Disjuntor geral/.test(i.desc)));
check('quadros de andar gastam menos cabo nos circuitos que um quadro só', E.COMPARA.cabosQuadros < E.COMPARA.cabosUnico);
const f = E.FASES, mx = Math.max(f.A, f.B, f.C), mn = Math.min(f.A, f.B, f.C);
check('fases equilibradas (desequilíbrio ≤ 10 %)', (mx - mn) / mx <= 0.1, JSON.stringify(f));
check('banheiro: tomada a 0,60 m ou mais do chuveiro', P.filter((p) => p.k === 'tug' && /Lav|Banh|Suíte/.test(p.amb)).every((t) => P.filter((c) => c.eq === 'chuveiro' && c.fl === t.fl).every((c) => Math.hypot(c.x - t.x, c.y - t.y) >= 600)));
check('chuveiros em pares de fases diferentes', new Set(E.CIRC.filter((c) => c.eq === 'chuveiro').map((c) => c.fases)).size === 3);
check('cenários com um chuveiro de cada vez dentro do geral', E.CENARIO.filter((c) => c.projeto).every((c) => c.max <= E.ALIM.disj) && E.CENARIO.filter((c) => c.projeto && c.chuveiros).every((c) => c.chuveiros === 1), E.ALIM.Iproj.toFixed(1) + ' A, geral ' + E.ALIM.disj + ' A');
check('ramal principal em 16 mm² (cabo 0,6/1 kV EPR) protegido pelo padrão', E.ALIM.secao === 16 && E.ALIM.okIz);
check('ramal principal com no mínimo 16 mm² e disjuntor geral ≤ capacidade', E.ALIM.secao >= 16 && E.ALIM.okIz, E.ALIM.secao + ' mm², ' + E.ALIM.disj + ' A, Iz ' + E.ALIM.iz + ' A');
check('queda de tensão total (alimentador + circuito) ≤ 5 %', E.CIRC.every((c) => c.dvTot <= 5), 'alim ' + E.ALIM.dv.toFixed(2) + ' %, máx ' + Math.max(...E.CIRC.map((c) => c.dvTot)).toFixed(2) + ' %');
check('lista de materiais com cabos, quadro e dispositivos', ['Cabos', 'Quadros', 'Dispositivos', 'Eletrodutos'].every((g) => E.QT.items.some((i) => i.grupo === g)));
check('nenhum eletroduto no ar: ponto fora da área coberta vai por baixo (enterrado no térreo, contrapiso no 2º)', P.filter((p) => /il|int|tug|tue/.test(p.k)).every((p) => { if (E.coberto(p)) return true; const b = p.circ.baixo.find((x) => x.id === p.id); return b && b.path.slice(1, -1).every((q) => q[2] <= 0) && !Object.values(p.circ.trees).some((t) => t.edges.some((e) => e.b === p)); }));
check('parede da TV com 3 tomadas e RJ45 entre as janelas (sala/garagem)', ['T-TV1', 'T-TV2', 'T-TV3'].every((id) => E.PBY[id] && E.PBY[id].x === 4300 && E.PBY[id].y > 12020 && E.PBY[id].y < 13720 && E.PBY[id].circ) && E.PBY['T-RJ1'].y > 12020 && E.PBY['T-RJ1'].y < 13720);
check('roteador no teto depois da 2ª janela da parede da garagem, com tomada', E.PBY['T-RT1'].y > 14220 && E.PBY['T-RT1'].z === E.TETO && E.PBY['T-T-RT'].circ && E.TEL.cabos.some((c) => c.id === 'T-RT1'));
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
}
console.log(bad ? 'test-eletrica: ' + bad + ' falha(s)' : 'test-eletrica: todos os testes ok');
process.exit(bad ? 1 : 0);
