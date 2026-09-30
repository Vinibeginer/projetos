// Planta salva antes do as built → migrateAsBuilt leva as alterações sem perder o que o usuário fez.
// Run: node tools/test-asbuilt.js   (a planta "antiga" é montada aqui com os valores da planta aprovada)
'use strict';
global.window = global;
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
require('../src/00-data.js');
require('../src/01-core.js');
require('../src/11-catalog.js');
const DD = window.DD;
let fails = 0;
const check = (name, cond, info) => {
  if (!cond) fails++;
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || info === undefined ? '' : ' — ' + info));
};
// ---- planta como era antes (projeto aprovado)
const oldDoc = DD.data.initialState();
oldDoc.furniture = DD.catalog.defaultLayout(oldDoc);
delete oldDoc.meta.asBuilt;
oldDoc.meta.name = 'Casa — projeto aprovado';
const op = (id) => oldDoc.openings.find((o) => o.id === id);
const J2 = { code: 'J2', width: 2000, height: 1300, sill: 1100 };
oldDoc.walls.find((w) => w.id === 'w0_despSuiteDiv').a.x = 5475;
oldDoc.walls.find((w) => w.id === 'w0_despSuiteDiv').b.x = 5475;
op('o0_j1_desp').t = 3170;
Object.assign(op('o0_j2_coz'), J2);
Object.assign(op('o0_j2_quarto'), J2);
Object.assign(op('o0_p1_quarto'), { t: 2675, hinge: 'end' });
Object.assign(op('o0_p3_entrada'), { t: 1377, width: 800 });
oldDoc.openings = oldDoc.openings.filter((o) => o.id !== 'o0_j8_coz2');
const J7 = { wall: 'w0_salaFront', code: 'J7', type: 'window', width: 500, height: 2100, sill: 0, style: 'pivot', hinge: 'start', side: 1 };
oldDoc.openings.push(Object.assign({ id: 'o0_j7_a', t: 600 }, J7), Object.assign({ id: 'o0_j7_b', t: 2150 }, J7));
oldDoc.roomSeeds.find((r) => r.id === 'r0_desp').x = 4850;
DD.catalog.AS_BUILT_MOVES.forEach(([from, to], i) => {
  const p = from[4] || {}, t = DD.catalog.types[from[0]];
  const item = { id: 'old' + i, floor: 'f0', type: from[0], x: from[1], y: from[2], rot: from[3], w: p.w || t.w, d: p.d || t.d, h: t.h, elev: 0, color: null };
  const k = to ? oldDoc.furniture.findIndex((f) => f.type === to[0] && f.x === to[1] && f.y === to[2]) : -1;
  if (k >= 0) oldDoc.furniture[k] = item;
  else oldDoc.furniture.push(item);
});
oldDoc.furniture.push({ id: 'meu', floor: 'f0', type: 'plant', x: 5000, y: 12000, rot: 0, w: 400, d: 400, h: 900, elev: 0, color: null });
oldDoc.furniture.find((f) => f.type === 'desk').x += 10; // escrivaninha que o usuário mexeu: fica onde está

const saved = DD.persist.validate(JSON.parse(JSON.stringify(oldDoc)));
check('planta antiga sem marca de as built', !saved.meta.asBuilt);
const { doc, changed } = DD.data.migrateAsBuilt(saved);
check('migrou', changed && doc.meta.asBuilt === DD.data.AS_BUILT.version);
check('não altera o documento recebido', !saved.meta.asBuilt && saved.openings.some((o) => o.id === 'o0_j7_a'));
const fresh = DD.data.initialState();
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => ((o[k] = sortKeys(v[k])), o), {}) : v);
const byId = (a, b) => (a.id < b.id ? -1 : 1);
const pick = (d) => JSON.stringify(sortKeys({ w: d.walls.slice().sort(byId), o: d.openings.slice().sort(byId), r: d.roomSeeds.slice().sort(byId) }));
// planta nova passa pelo mesmo validate (mesmos campos normalizados)
const freshV = DD.persist.validate(fresh);
check('paredes, vãos e cômodos iguais aos de uma planta nova', pick(doc) === pick(freshV));
check('móvel do usuário mantido', doc.furniture.some((f) => f.id === 'meu'));
check('estante da despensa ajustada', doc.furniture.some((f) => f.type === 'shelves' && f.x === 4600 && f.w === 600));
check('segunda estante da despensa removida', !doc.furniture.some((f) => f.type === 'shelves' && f.x === 5200));
check('guarda-roupa saiu da frente da porta', doc.furniture.some((f) => f.type === 'wardrobe' && f.x === 6450 && f.y === 8300));
check('escrivaninha mexida pelo usuário fica onde está', doc.furniture.some((f) => f.type === 'desk' && f.x === 5960));
const again = DD.data.migrateAsBuilt(DD.persist.validate(JSON.parse(JSON.stringify(doc))));
check('segunda migração não muda nada (marca preservada pelo validate)', !again.changed);
check('áreas', DD.rooms.compute(doc, 'f0').filter((r) => /Desp|Suíte/.test(r.name)).map((r) => r.area.toFixed(2)).join() === '0.96,3.68');
console.log(fails ? `test-asbuilt: ${fails} falha(s)` : 'test-asbuilt: todos os testes ok');
process.exitCode = fails ? 1 : 0;
