// Testes do módulo 15-structure.js (projeto estrutural e compatibilização).
// Usa dados SINTÉTICOS: os dados reais do projeto estrutural não ficam no repositório.
//   node tools/test-structure.js
const store = {};
global.window = global;
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] };
require('../src/00-data.js');
require('../src/01-core.js');
require('../src/15-structure.js');
const fs = require('fs'), path = require('path');
const DD = global.DD;
const doc = DD.data.initialState();
const ST = DD.structure;
let bad = 0;
const check = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
  if (!cond) bad++;
};

// ---------- sem dados
check('começa sem dados', !ST.hasData() && ST.compat(doc).length === 0);
check('formato errado é recusado', /Formato/.test(ST.importData({ formato: 'outro' })));
check('arquivo sem vigas é recusado', !!ST.importData({ formato: ST.FORMAT, pilares: [{ n: 'P1', x0: 0, x1: 190, y0: 0, y1: 400, topo: 2880 }], vigas: {} }));

// ---------- fixture: vãos reais do documento, estrutura sintética posicionada sobre eles
const rectOf = (opId) => {
  const op = doc.openings.find((o) => o.id === opId), w = doc.walls.find((x) => x.id === op.wall);
  const f = DD.geom.openingFrame(w, op), h = w.thick / 2, horiz = Math.abs(w.a.y - w.b.y) < 1;
  const xs = [f.start.x, f.end.x], ys = [f.start.y, f.end.y];
  return { x0: Math.min(...xs) - (horiz ? 0 : h), x1: Math.max(...xs) + (horiz ? 0 : h), y0: Math.min(...ys) - (horiz ? h : 0), y1: Math.max(...ys) + (horiz ? h : 0), op };
};
const j2 = rectOf('o0_j2_coz'); // janela de 2,00 m, peitoril 1,10 → topo a 2,40 m
const j1 = rectOf('o0_j1_lav');
const cy = (j1.y0 + j1.y1) / 2;
const fixture = {
  formato: ST.FORMAT,
  fonte: 'Fixture de teste',
  niveis: [0, 2880, 5760, 8640],
  laje: { tipo: 'treliçada', h: 160 },
  pilares: [
    { n: 'PT1', x0: 1500, x1: 1690, y0: cy - 100, y1: cy + 100, topo: 5760 }, // dentro da janela J1 do lavabo (200 mm)
    { n: 'PT2', x0: 1500, x1: 1900, y0: 2850, y1: 3040, topo: 8640 }, // canto do fundo, dentro da parede
    { n: 'PT3', x0: 2000, x1: 2190, y0: 12500, y1: 12900, topo: 2880 }, // no meio da garagem → aparente
  ],
  vigas: {
    0: [{ x0: 1500, x1: 7500, y0: 2850, y1: 3000, h: 450 }],
    2880: [
      { x0: j2.x0, x1: j2.x1, y0: j2.y0 - 500, y1: j2.y1 + 500, h: 500 }, // sobre a J2 da cozinha: fundo a 2,38 m
      { x0: 150, x1: 4150, y0: 12700, y1: 12850, h: 500 }, // atravessa a garagem → aparente
    ],
    5760: [],
    8640: [],
  },
  sapatas: [{ n: 'PT1', x0: 1100, x1: 2100, y0: cy - 500, y1: cy + 500 }],
  vigasEquilibrio: [],
};
let changed = 0;
const off = DD.events.on('structure:changed', () => changed++);
check('importa a fixture', ST.importData(fixture) === null && ST.hasData() && changed === 1);
check('guarda no navegador', !!store['dd.decor.casa.estrutura.v1']);
const info = ST.info();
check('resumo', info.columns === 3 && info.toRoof === 1 && info.beamsPerLevel.join() === '1,2,0,0', JSON.stringify(info.beamsPerLevel));

const list = ST.compat(doc);
const find = (re, floor) => list.find((i) => re.test(i.title) && (floor === undefined || i.floor === floor));
check('níveis conferem', !!find(/Níveis conferem/));
check('laje mais grossa (16 × 10 cm)', !!find(/Laje mais grossa/));
const pil = find(/Pilar PT1 invade a janela J1/, 'f0');
check('pilar dentro de janela é conflito', pil && pil.sev === 'erro', pil && pil.title);
const names = (i) => ST.columnsOn(doc.floors[i]).map((c) => c.n).join();
check('pilar só existe nos pavimentos que atravessa', names(0) === 'PT1,PT2,PT3' && names(1) === 'PT1,PT2' && names(2) === 'PT2', [0, 1, 2].map(names).join(' | '));
check('sem conflito do PT3 fora do térreo', !list.some((i) => /PT3/.test(i.title) && i.floor !== 'f0'));
const jan = find(/Janela J2 bate na viga 15\/50/, 'f0');
check('janela acima do fundo da viga', jan && jan.sev === 'erro' && /faltam 20 mm/.test(jan.detail), jan && jan.detail);
check('viga aparente na garagem', !!list.find((i) => /Viga 15\/50 aparente/.test(i.title) && /Garagem/.test(i.detail)));
check('pilar aparente na garagem', !!find(/Pilar PT3 fica aparente/, 'f0'));
check('cache por identidade', ST.compat(doc) === list);
check('ordem: conflitos primeiro', list[0].sev === 'erro' && list[list.length - 1].sev !== 'erro');

// viga mais baixa resolve o conflito; mover a janela também
const fix2 = JSON.parse(JSON.stringify(fixture));
fix2.vigas[2880][0].h = 300;
ST.importData(fix2);
check('viga de 30 cm não bate na janela', !ST.compat(doc).some((i) => /Janela J2 bate/.test(i.title)));
ST.importData(fixture);
const moved = DD.ops.update(doc, 'openings', 'o0_j1_lav', { t: j1.op.t - 900 });
check('mover a janela tira o conflito do pilar (recalcula com o documento)', !ST.compat(moved).some((i) => /Pilar PT1 invade/.test(i.title) && i.floor === 'f0'));

// 2D sem erro com um contexto falso
const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => ((t[k] = v), true) });
const rc = { ctx, px: 1, v: { width: 800, height: 600, cx: 4500, cy: 10000, scale: 0.1 }, floor: doc.floors[0], doc, exporting: false };
let ok2d = true;
try {
  ST.draw2dWorld(rc);
  ST.draw2dScreen(rc);
} catch (e) {
  ok2d = false;
  console.error(e);
}
check('desenho 2D não quebra', ok2d);

// foco: destaca o item
const idx = ST.compat(doc).indexOf(ST.compat(doc).find((i) => i.x != null));
let focused = null;
DD.events.on('structure:focus', (e) => (focused = e));
ST.focus(doc, idx);
check('foco destaca o item', ST.highlight() === idx && focused && focused.index === idx);

// remover dados importados
ST.clearImported();
check('remover dados importados', !ST.hasData() && !store['dd.decor.casa.estrutura.v1']);
off();

// o index.html público não pode ter os dados do projeto estrutural embutidos
const pub = path.join(__dirname, '..', 'index.html');
if (fs.existsSync(pub)) check('index.html público sem dados estruturais', !/window\.DD_STRUCT\s*=/.test(fs.readFileSync(pub, 'utf8')));

console.log(bad ? `test-structure: ${bad} falha(s)` : 'test-structure: todos os testes ok');
process.exit(bad ? 1 : 0);
