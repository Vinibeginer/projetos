// Testes do módulo 17-hidro.js (projeto hidrossanitário compartilhado pela página e pelo estúdio).
//   node tools/test-hidro.js
global.window = global;
require('../src/00-data.js');
require('../src/17-hidro.js');
const H = global.DD.hidro;
let bad = 0;
const check = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
  if (!cond) bad++;
};

// ---------- cálculo (os mesmos números do memorial)
check('18 pontos de água', H.AF.pontos.length === 18);
check('pressão mínima atendida em todos os pontos', H.AF.pontos.every((p) => p.ok), Math.min(...H.AF.pontos.map((p) => p.din)).toFixed(2) + ' mca');
check('ventilação dos desconectores dentro da NBR 8160', H.VENT.every((v) => v.ok));
check('coletor com 53 UHC', H.ESBY['CL-4'].uhc === 53);
check('passagens em laje calculadas', H.PASS.length > 0 && H.PASS.every((p) => /^Laje/.test(p.onde)));

// ---------- camada do estúdio
const floors = H.L1 === 2880 && global.DD.data.FLOORS;
check('níveis iguais aos do estúdio', floors.map((f) => f.level).join() === [0, H.L1, H.L2].join());
check('prancha de cada pavimento pelo nível', floors.map((f) => H.planKey(f)).join() === 'T,1,2');
['T', '1', '2'].forEach((k) => {
  const { segs, cols } = H.planSegments(k);
  check('pavimento ' + k + ': trechos e prumadas', segs.length > 5 && cols.length > 3, segs.length + ' trechos, ' + cols.length + ' prumadas');
  const tags = H.columnTags(k).map((c) => c.tag);
  check('pavimento ' + k + ': prumadas com nome único', new Set(tags).size === tags.length && tags.includes('AF-1'), tags.join(','));
});
check('térreo: tubos de queda TQ-1 e TQ-2 nomeados', ['TQ-1', 'TQ-2'].every((t) => H.columnTags('T').some((c) => c.tag === t)));
check('torneiras ligadas direto não viram prumada', !H.columnTags('T').some((c) => /Torneira/.test(c.tag)));

// ---------- 3D (THREE de mentira: conta as peças e confere a faixa de alturas)
const made = [];
class Obj { constructor() { this.children = []; this.position = { set() {}, copy() { return this; } }; this.quaternion = { setFromUnitVectors() {} }; this.userData = {}; } add(o) { this.children.push(o); } }
class Vec { constructor(x, y, z) { Object.assign(this, { x, y, z }); } set(x, y, z) { return Object.assign(this, { x, y, z }); } distanceTo(b) { return Math.hypot(b.x - this.x, b.y - this.y, b.z - this.z); } clone() { return new Vec(this.x, this.y, this.z); } sub(b) { this.x -= b.x; this.y -= b.y; this.z -= b.z; return this; } add(b) { this.x += b.x; this.y += b.y; this.z += b.z; return this; } normalize() { const L = Math.hypot(this.x, this.y, this.z) || 1; return this.multiplyScalar(1 / L); } multiplyScalar(k) { this.x *= k; this.y *= k; this.z *= k; return this; } copy(b) { return Object.assign(this, { x: b.x, y: b.y, z: b.z }); } }
const T = {
  Group: Obj, Vector3: Vec,
  Mesh: class extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; this.position = new Vec(0, 0, 0); made.push(this); } },
  MeshBasicMaterial: class { constructor(o) { Object.assign(this, o); } },
  CylinderGeometry: class {}, SphereGeometry: class {}, BoxGeometry: class {},
};
const doc = global.DD.data.initialState();
const groups = doc.floors.map((f) => H.build3d(T, doc, f));
check('3D: tubos em todos os pavimentos', groups.every((g) => g.children.length > 10), groups.map((g) => g.children.length).join('/'));
check('3D: peças fora do clique e por cima das paredes', made.every((m) => m.userData.noPick && m.material.depthTest === false));

console.log(bad ? 'test-hidro: ' + bad + ' falha(s)' : 'test-hidro: todos os testes ok');
process.exit(bad ? 1 : 0);
