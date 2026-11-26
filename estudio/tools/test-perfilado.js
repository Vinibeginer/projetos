// Testes do anteprojeto separado em perfilado 38×38 (infra-perfilado.js).
//   node tools/test-perfilado.js
global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('../src/00-data.js');
require('../src/01-core.js');
require('../src/15-structure.js');
require('../src/17-hidro.js');
require('../src/18-eletrica.js');
require('../infra-perfilado.js');
const fs = require('fs');
const path = require('path');
const E = global.DD.eletrica, P = global.DD.perfilado;
let bad = 0;
const check = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
  if (!cond) bad++;
};
const RES = P.tudo();
const R = RES.R, FL = ['T', '1', '2'];
check('rede em perfilado nos três pavimentos', FL.every((k) => R[k].T.length > 0 && R[k].deriv.length > 0), FL.map((k) => k + ': ' + R[k].T.length + ' trechos').join(' · '));
// todo ponto de luz, tomada, interruptor e TUE do andar: no perfilado (derivação) ou fora com motivo
FL.forEach((k) => {
  const ids = new Set(R[k].deriv.concat(R[k].fora).flatMap((d) => d.pts));
  const falta = E.PONTOS.filter((p) => p.fl === k && /il|int|tug|tue/.test(p.k) && p.circ && !ids.has(p.id)).map((p) => p.id);
  check(`${k}: todo ponto ligado pelo perfilado ou com motivo para ficar fora`, !falta.length, falta.join(','));
});
check('no perfilado só circuitos de disjuntor até 10 A (chuveiros e 16 A em eletroduto próprio)', FL.every((k) => Object.values(R[k].SEC).every((s) => s.disj <= 10)));
check('cabo no feixe: Iz × fator de agrupamento ≥ disjuntor em todos os circuitos do perfilado', FL.every((k) => Object.values(R[k].SEC).every((s) => s.iz >= s.disj)));
check('iluminação no perfilado em 2,5 mm² (1,5 mm² não aguenta 10 A no feixe)', FL.every((k) => Object.values(R[k].SEC).filter((s) => s.tipo === 'il').every((s) => s.secao === 2.5)));
const ocup = Math.max(...FL.flatMap((k) => R[k].T.map((t) => t.ocup)));
check('ocupação do perfilado ≤ 40 % em todos os trechos', ocup <= 0.4, Math.round(ocup * 100) + ' % no pior trecho');
check('no máximo 15 circuitos por trecho (fator 0,45 ainda deixa 2,5 mm² ≥ 10 A)', FL.every((k) => R[k].T.every((t) => t.circ.size <= 15)));
const dmax = Math.max(...FL.flatMap((k) => R[k].deriv.map((d) => d.Lh)));
check('derivações até 3,5 m no forro', dmax <= P.LIM.deriv, (dmax / 1000).toFixed(2) + ' m na maior');
// tirantes: a cada 1,50 m no máximo e a até 30 cm das pontas de cada trecho
const vaoOk = FL.every((k) => R[k].T.every((t) => {
  const s = t.susp.filter((u) => !u.passagem).map((u) => u.s).sort((a, b) => a - b);
  return s.length && s[0] <= P.LIM.pontaSusp + 200 && t.L - s[s.length - 1] <= P.LIM.pontaSusp + 200 && s.slice(1).every((v, i) => v - s[i] <= P.LIM.susp + 200);
}));
check('tirantes a cada 1,50 m e perto das conexões (desvio de até 20 cm das paredes)', vaoOk);
// o perfilado não passa em cima das caixas de luz
const perto = FL.flatMap((k) => R[k].deriv.filter((d) => d.tipo === 'luz' && d.Lh < 150).map((d) => d.id));
check('caixas de luz a 15 cm ou mais do perfilado', !perto.length, perto.join(','));
// alturas: 1º e 2º com o perfilado acima do forro; térreo na altura das passagens, abaixo da laje
check('perfilado entre o forro e a laje em todos os andares', FL.every((k) => R[k].base > R[k].H.forro + 30 && R[k].base + P.PERF.lado < R[k].H.laje - 40));
check('quadro de cada andar ligado ao início da rede (subidas DN 32 + reserva)', FL.every((k) => R[k].subidas >= 1 && R[k].T.some((t) => t.a === 'R')));
// lista de materiais
const it = RES.items;
const q = (re) => (it.find((i) => re.test(i.desc)) || {}).q;
check('lista: perfilado, tampa, junções, tirantes, chumbadores, parafusos, porcas e arruelas', [/^Perfilado/, /^Tampa de encaixe/, /Junção "T"/, /Junção "L"/, /Barra roscada/, /Chumbador/, /Parafuso cabeça lentilha/, /Porca sextavada/, /Arruela lisa/, /Arruela dentada/, /Saída lateral/, /Caixa octogonal/].every((re) => q(re) > 0));
check('barras de perfilado cobrem o comprimento', q(/^Perfilado/) * 6000 >= RES.M.Ltot);
check('uma porca e uma arruela para cada parafuso e duas por tirante', q(/Porca sextavada/) === q(/Parafuso cabeça lentilha/) + 2 * RES.M.nTir && q(/Arruela lisa/) === q(/Porca sextavada/));
check('um chumbador por tirante', q(/Chumbador/) === RES.M.nTir);
check('comprar ≥ calculado em todos os itens', it.every((i) => i.compra >= i.q));
// listas por andar (compra em etapas): cada andar com a sua lista, somando o mesmo que a casa toda nos itens contados um a um
const PA = RES.porAndar;
check('lista separada por andar (térreo, 1º e 2º)', FL.every((k) => PA[k] && PA[k].items.length > 10));
const somaQ = (re) => FL.reduce((s, k) => s + ((PA[k].items.find((i) => re.test(i.desc)) || {}).q || 0), 0);
const unit = [/^Saída lateral/, /^Caixa octogonal/, /^Caixa 4×2" de embutir \(parede\)$/, /^Chumbador/, /^Suporte de suspensão/, /^Junção "T"/, /^Junção "L"/, /^Tampa terminal/];
check('por andar: saídas, caixas, chumbadores, suportes e junções somam a casa toda', unit.every((re) => somaQ(re) === q(re)), unit.map((re) => somaQ(re) + '/' + q(re)).join(' '));
check('por andar: barras compradas por andar cobrem o perfilado de cada andar', FL.every((k) => { const it2 = PA[k].items.find((i) => /^Perfilado/.test(i.desc)); return it2.q * 6000 >= PA[k].M.Ltot; }));
check('nomes de item únicos em cada lista (o resumo por andar casa linha a linha)', [RES.items].concat(FL.map((k) => PA[k].items)).every((L) => new Set(L.map((i) => i.desc)).size === L.length));
check('passagens das vigas só na lista do térreo', FL.every((k) => PA[k].items.some((i) => /passagem/.test(i.desc)) === (k === 'T')));
// projeto estrutural: nenhuma posição de viga no arquivo público — só a contagem de passagens por trecho
const pas = R.T.T.flatMap((t) => t.passagens);
check('público sem posições de viga (só contagem de passagens no térreo)', !pas.length && RES.M.nPas === Object.values(P.PASSAGENS.T.trechos).reduce((s, n) => s + n, 0));
const src = fs.readFileSync(path.join(__dirname, '..', 'infra-perfilado.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'infra-perfilado.html'), 'utf8');
check('página e cálculo sem dados do projeto estrutural embutidos', !/DD_STRUCT\s*=|vigasEquilibrio|"sapatas"|"pilares"\s*:/.test(src));
console.log(bad ? `test-perfilado: ${bad} falha(s)` : 'test-perfilado: todos os testes ok');
process.exit(bad ? 1 : 0);
