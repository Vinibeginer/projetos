// Testes do módulo 17-hidro.js (projeto hidrossanitário compartilhado pela página e pelo estúdio).
//   node tools/test-hidro.js
global.window = global;
require('../src/00-data.js');
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('../src/01-core.js');
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

// nenhum tubo cruza janela ou porta (nem desce colado ao batente)
{
  const doc = global.DD.data.initialState(), LV = { f0: 0, f1: 2880, f2: 5760 }, hits = new Set();
  H.PIPES.forEach((p) => p.pts.slice(1).forEach((b, i) => {
    const a = p.pts[i], n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 20));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      doc.openings.forEach((o) => {
        const w = doc.walls.find((q) => q.id === o.wall);
        if (!w) return;
        const f = global.DD.geom.openingFrame(w, o), zr = z - LV[w.floor];
        const al = (x - f.c.x) * f.d.x + (y - f.c.y) * f.d.y, ac = (x - f.c.x) * f.n.x + (y - f.c.y) * f.n.y;
        if (Math.abs(ac) <= w.thick / 2 + 40 && Math.abs(al) <= o.width / 2 + 50 && zr > (o.sill || 0) - 50 && zr < (o.sill || 0) + o.height + 50) hits.add(p.id + '×' + o.id);
      });
    }
  }));
  check('nenhum tubo cruza janela ou porta', !hits.size, [...hits].join(','));
}
// compatibilização com a estrutura (só quando o projeto estrutural privado existe nesta máquina)
{
  const fs = require('fs'), stf = require('path').join(__dirname, '..', 'private', 'estrutura.json');
  if (fs.existsSync(stf)) {
    const pil = JSON.parse(fs.readFileSync(stf, 'utf8')).pilares, hits = [];
    H.PIPES.forEach((p) => {
      for (let i = 1; i < p.pts.length; i++) {
        const a = p.pts[i - 1], b = p.pts[i], n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 20));
        for (let k = 0; k <= n; k++) {
          const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
          if (pil.some((c) => x > c.x0 - 20 && x < c.x1 + 20 && y > c.y0 - 20 && y < c.y1 + 20 && z > -2000 && z < c.topo)) { hits.push(p.id); break; }
        }
      }
    });
    check('nenhum tubo atravessa pilar (projeto estrutural privado)', !hits.length, [...new Set(hits)].join(','));
    // vigas e baldrames: só a travessia aprovada do lavatório da suíte do térreo (camisa a meia altura do baldrame)
    const st = JSON.parse(fs.readFileSync(stf, 'utf8')), beamHits = new Set(), slabHits = new Set(), under = [];
    const OK_FURO = ['ETL2@0'];
    H.PIPES.forEach((p) => {
      const r = p.dn / 2;
      for (let i = 1; i < p.pts.length; i++) {
        const a = p.pts[i - 1], b = p.pts[i], hor = Math.hypot(b[0] - a[0], b[1] - a[1]) >= 1;
        if (hor) [H.L1, H.L2, H.LR].forEach((L) => { if (Math.max(a[2], b[2]) + r > L - 160 && Math.min(a[2], b[2]) - r < L + 40 && a[0] > 1500) slabHits.add(p.id + '@' + L); });
        const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 10));
        for (let k = 0; k <= n; k++) {
          const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
          Object.entries(st.vigas).forEach(([lv, vs]) => vs.forEach((v) => {
            if (x <= v.x0 - r || x >= v.x1 + r || y <= v.y0 - r || y >= v.y1 + r) return;
            if (z + r > +lv - v.h && z - r < +lv) beamHits.add(p.id + '@' + lv);
            else if (+lv === 0 && z < -v.h && z + r > -v.h - 50) under.push(p.id);
          }));
        }
      }
    });
    const bad1 = [...beamHits].filter((k) => !OK_FURO.includes(k));
    check('nenhum tubo atravessa viga ou baldrame fora da travessia aprovada', !bad1.length, bad1.join(','));
    check('nenhum ramal corre deitado dentro da laje treliçada', !slabHits.size, [...slabHits].join(','));
    check('tubos enterrados passam ≥ 5 cm abaixo dos baldrames', !under.length, [...new Set(under)].join(','));
  } else console.log('SKIP pilares: private/estrutura.json ausente');
}
console.log(bad ? 'test-hidro: ' + bad + ' falha(s)' : 'test-hidro: todos os testes ok');
process.exit(bad ? 1 : 0);
