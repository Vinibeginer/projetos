// Gera os pontos do projeto elétrico (NBR 5410) a partir dos ambientes da planta as built de referência e
// grava a lista em src/18-eletrica.js (entre os marcadores PONTOS). Rode de novo se a planta de referência mudar:
//   node tools/gera-eletrica.js
// Regras (NBR 5410:2004, 9.5.2):
//   iluminação — ao menos 1 ponto no teto por cômodo; carga: 100 VA nos primeiros 6 m² + 60 VA a cada 4 m² inteiros;
//   TUG — banheiro: 1 junto ao lavatório (600 VA); cozinha/serviço: 1 a cada 3,5 m de perímetro (3 primeiras 600 VA,
//         demais 100 VA); varanda, garagem, circulação, cômodos ≤ 2,25 m²: ao menos 1; demais: 1 a cada 5 m de perímetro;
//   TUE — aparelhos com mais de 10 A ou fixos (chuveiros, ar-condicionado, micro-ondas, máquina de lavar, portão).
// Ajustes manuais (posições escolhidas no projeto) ficam em FIXOS e EXTRA, abaixo.
const fs = require('fs'), path = require('path');
global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
require('../src/00-data.js');
require('../src/01-core.js');
require('../src/17-hidro.js');
const DD = global.DD, doc = DD.data.initialState(), H = DD.hidro;
const FL = { f0: 'T', f1: '1', f2: '2' };
const TETO = 2780; // forro / face inferior da laje (pé-direito do estúdio)

// ------------------------------------------------------------------ geometria
const wallsOf = (fid) => doc.walls.filter((w) => w.floor === fid && w.kind !== 'railing');
function distSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
const onWall = (fid, p, muro) => wallsOf(fid).some((w) => (muro || w.kind !== 'muro') && distSeg(p, w.a, w.b) <= w.thick / 2 + 60);
/** Vão (porta/janela) junto do ponto, com folga. */
function openingAt(fid, p, kinds, margin) {
  return doc.openings.find((o) => {
    const w = doc.walls.find((x) => x.id === o.wall);
    if (!w || w.floor !== fid || (kinds && !kinds.test(o.type || o.id))) return false;
    const f = DD.geom.openingFrame(w, o);
    return distSeg(p, f.start, f.end) <= w.thick / 2 + 80 + 0 && Math.min(Math.hypot(p.x - f.c.x, p.y - f.c.y)) <= o.width / 2 + (margin || 200);
  });
}
const isDoor = (o) => /^P/i.test(o.type || '') || /_p\d/.test(o.id);
function doorNear(fid, p, margin) {
  return doc.openings.find((o) => {
    const w = doc.walls.find((x) => x.id === o.wall);
    if (!w || w.floor !== fid || !isDoor(o)) return false;
    const f = DD.geom.openingFrame(w, o);
    const along = (p.x - f.c.x) * f.d.x + (p.y - f.c.y) * f.d.y, across = (p.x - f.c.x) * f.n.x + (p.y - f.c.y) * f.n.y;
    return Math.abs(across) <= w.thick / 2 + 100 && Math.abs(along) <= o.width / 2 + (margin || 200);
  });
}
function windowNear(fid, p, margin) {
  return doc.openings.find((o) => {
    const w = doc.walls.find((x) => x.id === o.wall);
    if (!w || w.floor !== fid || isDoor(o)) return false;
    const f = DD.geom.openingFrame(w, o);
    const along = (p.x - f.c.x) * f.d.x + (p.y - f.c.y) * f.d.y, across = (p.x - f.c.x) * f.n.x + (p.y - f.c.y) * f.n.y;
    return Math.abs(across) <= w.thick / 2 + 100 && Math.abs(along) <= o.width / 2 + (margin || 150);
  });
}
/** Perímetro do cômodo como lista de trechos (faces das paredes). */
function edges(room) {
  const P = room.outer, E = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L > 1) E.push({ a, b, L, d: { x: (b.x - a.x) / L, y: (b.y - a.y) / L } });
  }
  return E;
}
function atPerimeter(E, s) {
  const tot = E.reduce((t, e) => t + e.L, 0);
  s = ((s % tot) + tot) % tot;
  for (const e of E) {
    if (s <= e.L) return { x: Math.round(e.a.x + e.d.x * s), y: Math.round(e.a.y + e.d.y * s), e };
    s -= e.L;
  }
  return null;
}
const inside = (room, p) => DD.util.pointInPolygon(p, room.outer) && !room.holes.some((h) => DD.util.pointInPolygon(p, h));
const nearStair = (fid, p) => (doc.stairs || []).some((s) => (s.floor === fid || (fid === 'f2' && s.floor === 'f1')) && p.x > s.x - 50 && p.x < s.x + s.length + 50 && p.y > s.y - 50 && p.y < s.y + s.width + 50);
/** N pontos distribuídos no perímetro, fora de portas, sobre parede e longe dos pontos já usados. */
function spread(room, n, opts) {
  const E = edges(room), tot = E.reduce((t, e) => t + e.L, 0), out = [];
  const o = opts || {};
  for (let i = 0; i < n; i++) {
    let s0 = ((i + 0.5) * tot) / n + (o.phase || 0), got = null;
    for (let k = 0; k < 60 && !got; k++) {
      const s = s0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 150;
      const p = atPerimeter(E, s);
      if (!p || doorNear(room.fid, p, 250) || !onWall(room.fid, p, o.muro) || (o.noWindow && windowNear(room.fid, p))) continue;
      if (!o.allowStair && nearStair(room.fid, p)) continue;
      if ((o.avoid || []).concat(out).some((q) => Math.hypot(q.x - p.x, q.y - p.y) < (o.gap || 600))) continue;
      // longe de quinas (20 cm)
      const dEnd = Math.min(Math.hypot(p.x - p.e.a.x, p.y - p.e.a.y), Math.hypot(p.x - p.e.b.x, p.y - p.e.b.y));
      if (dEnd < 200) continue;
      got = p;
    }
    if (got) out.push({ x: got.x, y: got.y });
  }
  return out;
}
/** Ponto da parede do cômodo mais próximo de (x, y), deslocado `shift` mm ao longo da parede, longe de `away`. */
function wallPointNear(room, x, y, shift, away, minAway) {
  const E = edges(room);
  let best = null, bs = 0, tot = 0;
  E.forEach((e) => {
    const t = Math.max(0, Math.min(e.L, (x - e.a.x) * e.d.x + (y - e.a.y) * e.d.y));
    const p = { x: e.a.x + e.d.x * t, y: e.a.y + e.d.y * t }, dd = Math.hypot(p.x - x, p.y - y);
    if (!best || dd < best.dd) (best = { dd }), (bs = tot + t);
    tot += e.L;
  });
  for (const sh of [shift, -shift, shift * 1.6, -shift * 1.6, shift * 2.2, -shift * 2.2]) {
    const p = atPerimeter(E, bs + sh);
    if (!p || doorNear(room.fid, p, 200) || !onWall(room.fid, p)) continue;
    if (away && away.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < (minAway || 600))) continue;
    return { x: p.x, y: p.y };
  }
  return null;
}
/** Interruptor ao lado da porta, por dentro do cômodo: 15 cm do batente, a 1,10 m. */
function switchFor(room, prefer) {
  const doors = doc.openings.filter((o) => {
    const w = doc.walls.find((x) => x.id === o.wall);
    if (!w || w.floor !== room.fid || !isDoor(o) || w.kind === 'muro') return false;
    const f = DD.geom.openingFrame(w, o), k = w.thick / 2 + 150;
    return inside(room, { x: f.c.x + f.n.x * k, y: f.c.y + f.n.y * k }) || inside(room, { x: f.c.x - f.n.x * k, y: f.c.y - f.n.y * k });
  });
  doors.sort((a, b) => (prefer && prefer.test(a.id) ? -1 : 0) - (prefer && prefer.test(b.id) ? -1 : 0) || b.width - a.width);
  for (const o of doors) {
    const w = doc.walls.find((x) => x.id === o.wall), f = DD.geom.openingFrame(w, o);
    const side = inside(room, { x: f.c.x + f.n.x * (w.thick / 2 + 150), y: f.c.y + f.n.y * (w.thick / 2 + 150) }) ? 1 : -1;
    const off = (w.thick / 2) * side;
    for (const end of [f.end, f.start]) {
      const dir = end === f.end ? 1 : -1;
      const p = { x: Math.round(end.x + f.d.x * dir * 200 + f.n.x * off), y: Math.round(end.y + f.d.y * dir * 200 + f.n.y * off) };
      const probe = { x: p.x + f.n.x * side * 100, y: p.y + f.n.y * side * 100 };
      if (!inside(room, probe) || doorNear(room.fid, { x: p.x + f.d.x * dir * 100, y: p.y + f.d.y * dir * 100 }, 50)) continue;
      return { x: p.x, y: p.y, porta: o.id };
    }
  }
  return null;
}

// ------------------------------------------------------------------ regras por cômodo
const KIND = (r) => {
  const n = r.name;
  if (/^(Lav\.|Banh|Suíte$)/.test(n) && r.area < 5) return 'banho';
  if (/Cozinha/.test(n)) return 'cozinha';
  if (/Varanda coberta/.test(n)) return 'gourmet';
  if (/Desp/.test(n)) return 'pequeno';
  if (/Varanda descoberta/.test(n)) return 'terraco';
  if (/Varanda|Garagem|Circula/.test(n)) return 'passagem';
  return 'seco';
};
const ilumVA = (a) => 100 + 60 * Math.max(0, Math.floor((a - 6) / 4));
const pts = [];
const add = (p) => (pts.push(p), p);
let seq = {};
const nextId = (fl, k) => {
  const key = fl + k;
  seq[key] = (seq[key] || 0) + 1;
  return fl + '-' + k + seq[key];
};
const roomList = [];
doc.floors.forEach((f) => {
  DD.rooms.compute(doc, f.id).filter((r) => !r.open).forEach((r) => roomList.push(Object.assign(r, { fid: f.id, fl: FL[f.id], kind: KIND(r) })));
});

roomList.forEach((r) => {
  const fl = r.fl, amb = r.name, z = (h) => h;
  // ---- iluminação
  const va = ilumVA(r.area);
  let nl = r.area <= 16 ? 1 : r.area <= 32 ? 2 : 4;
  const luzes = [];
  if (r.kind === 'terraco') {
    spread(r, 3, { gap: 2000, noWindow: true, allowStair: false, muro: true }).forEach((p) => luzes.push(Object.assign(p, { z: 2200, tipo: 'arandela' })));
  } else {
    const b = r.bbox, wx = b.maxX - b.minX, wy = b.maxY - b.minY;
    const grid = nl === 4 ? [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]] : nl === 2 ? (wx > wy ? [[0.27, 0.5], [0.73, 0.5]] : [[0.5, 0.3], [0.5, 0.7]]) : [[0.5, 0.5]];
    grid.forEach(([u, v]) => {
      let p = { x: Math.round(b.minX + wx * u), y: Math.round(b.minY + wy * v) };
      if (!inside(r, p) || nearStair(r.fid, p)) p = { x: Math.round(r.labelX), y: Math.round(r.labelY) - (nl === 1 ? 0 : 0) };
      if (!luzes.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 500)) luzes.push(Object.assign(p, { z: TETO, tipo: 'teto' }));
    });
  }
  const vaEach = Math.max(100, Math.ceil(va / luzes.length / 10) * 10);
  const ilIds = luzes.map((p) => add({ id: nextId(fl, 'IL'), fl, k: 'il', tipo: p.tipo, amb, x: p.x, y: p.y, z: p.z, va: vaEach, desc: (p.tipo === 'arandela' ? 'Arandela' : 'Ponto de luz no teto') + ' — ' + amb }).id);
  // ---- interruptor
  if (r.kind !== 'terraco' || true) {
    const s = switchFor(r, /terraco|entrada|garagem/);
    if (s) add({ id: nextId(fl, 'S'), fl, k: 'int', amb, x: s.x, y: s.y, z: 1100, liga: ilIds, desc: 'Interruptor simples — ' + amb });
  }
  // ---- TUG
  const P = r.perimeter / 1000;
  const used = pts.filter((p) => p.fl === fl && p.k !== 'il').map((p) => ({ x: p.x, y: p.y }));
  if (r.kind === 'banho') {
    const lav = H.FX.find((x) => x.fl === fl && x.t === 'lav' && inside(r, { x: x.x, y: x.y }));
    const ch = H.FX.filter((x) => x.fl === fl && x.t === 'ch' && inside(r, { x: x.x, y: x.y }));
    const away = ch.map((c) => ({ x: c.x, y: c.y }));
    const p = lav ? wallPointNear(r, lav.x, lav.y, 450, away, 600) : spread(r, 1)[0];
    if (p) add({ id: nextId(fl, 'T'), fl, k: 'tug', amb, x: p.x, y: p.y, z: 1100, va: 600, molhada: true, desc: 'TUG junto ao lavatório (≥ 0,60 m do box) — ' + amb });
  } else if (r.kind === 'cozinha' || r.kind === 'gourmet') {
    const n = r.kind === 'cozinha' ? Math.ceil(P / 3.5) : Math.ceil(P / 5);
    const pia = H.FX.find((x) => x.fl === fl && x.t === 'pia' && inside(r, { x: x.x, y: x.y }));
    const near = [];
    if (pia) {
      [700, -700, 1500].forEach((sh) => {
        const p = wallPointNear(r, pia.x, pia.y, Math.abs(sh), near.concat(used), 600);
        if (p) near.push(p);
      });
    }
    near.slice(0, 3).forEach((p) => add({ id: nextId(fl, 'T'), fl, k: 'tug', amb, x: p.x, y: p.y, z: 1100, va: 600, molhada: true, desc: 'TUG da bancada (600 VA) — ' + amb }));
    spread(r, Math.max(0, n - near.slice(0, 3).length), { avoid: near.concat(used), gap: 900 }).forEach((p) =>
      add({ id: nextId(fl, 'T'), fl, k: 'tug', amb, x: p.x, y: p.y, z: 300, va: 100, molhada: true, desc: 'TUG — ' + amb })
    );
  } else {
    const n = r.kind === 'pequeno' ? 1 : r.kind === 'passagem' || r.kind === 'terraco' ? Math.max(1, Math.ceil(P / 10)) : Math.ceil(P / 5);
    spread(r, n, { avoid: used, gap: 900, allowStair: false }).forEach((p) =>
      add({ id: nextId(fl, 'T'), fl, k: 'tug', amb, x: p.x, y: p.y, z: r.kind === 'terraco' ? 600 : 300, va: 100, molhada: r.kind === 'terraco' || r.kind === 'passagem', externa: r.kind === 'terraco' || r.outdoor, desc: 'TUG' + (r.kind === 'terraco' ? ' externa (IP44)' : '') + ' — ' + amb })
    );
  }
  // ---- ar-condicionado nos quartos
  if (/Quarto/.test(amb)) {
    const E = edges(r).filter((e) => e.L >= 1400).sort((a, b) => b.L - a.L);
    let got = null;
    for (const e of E) {
      for (const u of [0.5, 0.3, 0.7]) {
        const p = { x: Math.round(e.a.x + (e.b.x - e.a.x) * u), y: Math.round(e.a.y + (e.b.y - e.a.y) * u) };
        if (onWall(r.fid, p) && !windowNear(r.fid, p, 500) && !doorNear(r.fid, p, 500)) { got = p; break; }
      }
      if (got) break;
    }
    if (got) add({ id: nextId(fl, 'AC'), fl, k: 'tue', eq: 'ac', amb, x: got.x, y: got.y, z: 2200, va: 1500, v: 220, desc: 'Ar-condicionado split 12.000 BTU/h (1.500 VA, 220 V) — ' + amb });
  }
});

// ------------------------------------------------------------------ TUEs ligados ao hidrossanitário
H.FX.filter((f) => f.t === 'ch').forEach((f) => {
  const r = roomList.find((r) => r.fl === f.fl && inside(r, { x: f.x, y: f.y }));
  const n = H.AFN[f.af] || [f.x, f.y]; // na parede do chuveiro, junto ao ponto de água
  add({ id: nextId(f.fl, 'CH'), fl: f.fl, k: 'tue', eq: 'chuveiro', amb: r ? r.name : 'Banheiro', x: n[0], y: n[1], z: 2200, va: 6500, v: 220, desc: 'Chuveiro elétrico 6.500 W (220 V) — ponto ' + f.id });
});
H.FX.filter((f) => f.t === 'mlr').forEach((f) => {
  const n = H.AFN[f.af] || [f.x, f.y]; // na mesma parede do ponto de água, 30 cm ao lado
  add({ id: nextId(f.fl, 'ML'), fl: f.fl, k: 'tue', eq: 'mlr', amb: 'Área de serviço', x: n[0] + 300, y: n[1], z: 1100, va: 1200, v: 127, molhada: true, desc: 'Máquina de lavar roupa (1.200 VA, 127 V)' });
});

// ------------------------------------------------------------------ pontos escolhidos no projeto
const EXTRA = [
  // quadro de distribuição: debaixo da escada, na parede do quarto do térreo (face do lado da escada)
  // quadro de distribuição: na parede do quarto do térreo, do lado direito da porta (vista da sala), junto ao pé da escada
  { id: 'QDC', fl: 'T', k: 'qdc', amb: 'Sala (pé da escada)', x: 5925, y: 8750, z: 1500, desc: 'Quadro de distribuição (QDC) — à direita da porta do quarto, parede do quarto (lado da sala)' },
  // quadros trifásicos de andar, alimentados pelo QDC: QD-1 logo acima do QDC (mesma parede); QD-2 na parede da escada,
  // voltado para a varanda coberta (na prumada do QDC o 2º não tem parede)
  { id: 'QD1', fl: '1', k: 'qdc', amb: 'Circulação (chegada da escada)', x: 5925, y: 8750, z: 1500, desc: 'Quadro de distribuição do 1º (QD-1) — acima do QDC, parede do quarto master (lado da circulação)' },
  { id: 'QD2', fl: '2', k: 'qdc', amb: 'Varanda coberta (parede da escada)', x: 7100, y: 8600, z: 1500, desc: 'Quadro de distribuição do 2º (QD-2) — parede da escada, lado da varanda coberta' },
  // padrão da Enel: quina do muro esquerdo com o muro da frente (olhando a casa com a rua nas costas)
  { id: 'PE', fl: 'T', k: 'medidor', amb: 'Muro da frente (quina esquerda)', x: 400, y: 19850, z: 1500, desc: 'Padrão de entrada / medição (Enel) com haste de aterramento — quina do muro esquerdo com o da frente' },
  { id: 'T-MO1', fl: 'T', k: 'tue', eq: 'microondas', amb: 'Cozinha', x: 4150, y: 6900, z: 1600, va: 1500, v: 127, molhada: true, desc: 'Micro-ondas / forno (1.500 VA, 127 V)' },
  { id: 'T-PT1', fl: 'T', k: 'tue', eq: 'portao', amb: 'Garagem (portão)', x: 4400, y: 19850, z: 400, va: 600, v: 127, externa: true, desc: 'Motor do portão eletrônico ½ cv (600 VA)' },
  // iluminação externa
  { id: 'T-IL-E1', fl: 'T', k: 'il', tipo: 'arandela', amb: 'Fachada', x: 4650, y: 15000, z: 2200, va: 100, externa: true, desc: 'Arandela externa — fachada, ao lado da porta' },
  { id: 'T-IL-E2', fl: 'T', k: 'il', tipo: 'arandela', amb: 'Fachada', x: 6450, y: 15000, z: 2200, va: 100, externa: true, desc: 'Arandela externa — fachada' },
  { id: 'T-IL-E3', fl: 'T', k: 'il', tipo: 'arandela', amb: 'Quintal', x: 4300, y: 2850, z: 2200, va: 100, externa: true, desc: 'Arandela externa — quintal (fundos)' },
  { id: 'T-IL-E4', fl: 'T', k: 'il', tipo: 'arandela', amb: 'Corredor lateral', x: 1500, y: 6000, z: 2200, va: 100, externa: true, desc: 'Arandela externa — corredor lateral' },
  { id: 'T-S-E', fl: 'T', k: 'int', amb: 'Sala', x: 4700, y: 14850, z: 1100, liga: ['T-IL-E1', 'T-IL-E2'], desc: 'Interruptor das arandelas da fachada (junto à porta de entrada)' },
  { id: 'T-S-Q', fl: 'T', k: 'int', amb: 'Cozinha', x: 3150, y: 3000, z: 1100, liga: ['T-IL-E3', 'T-IL-E4'], desc: 'Interruptor das arandelas do quintal e do corredor (junto à porta dos fundos)' },
  { id: 'T-T-E1', fl: 'T', k: 'tug', amb: 'Quintal', x: 2600, y: 2850, z: 600, va: 100, molhada: true, externa: true, desc: 'TUG externa IP44 — quintal' },
  // escada: arandela no patamar e interruptores paralelos (three-way) embaixo e em cima
  { id: 'T-IL-ESC', fl: 'T', k: 'il', tipo: 'arandela', amb: 'Escada', x: 8850, y: 9550, z: 2400, va: 100, desc: 'Arandela da escada (térreo → 1º)' },
  { id: 'T-S3a', fl: 'T', k: 'int3', amb: 'Escada', x: 5560, y: 8750, z: 1100, liga: ['T-IL-ESC'], desc: 'Interruptor paralelo — pé da escada (térreo)' },
  { id: '1-S3b', fl: '1', k: 'int3', amb: 'Circulação', x: 5560, y: 8750, z: 1100, liga: ['T-IL-ESC'], desc: 'Interruptor paralelo — chegada da escada (1º)' },
  { id: '1-IL-ESC', fl: '1', k: 'il', tipo: 'arandela', amb: 'Escada', x: 8850, y: 9550, z: 2400, va: 100, desc: 'Arandela da escada (1º → 2º)' },
  { id: '1-S3a', fl: '1', k: 'int3', amb: 'Circulação', x: 5900, y: 10350, z: 1100, liga: ['1-IL-ESC'], desc: 'Interruptor paralelo — pé da escada (1º)' },
  { id: '2-S3b', fl: '2', k: 'int3', amb: 'Varanda coberta', x: 6300, y: 8600, z: 1100, liga: ['1-IL-ESC'], desc: 'Interruptor paralelo — chegada da escada (2º)' },
  // parede da TV (sala/garagem, entre as janelas, atrás do rack): 3 tomadas a 0,30 m
  { id: 'T-TV1', fl: 'T', k: 'tug', amb: 'Sala', x: 4300, y: 12500, z: 300, va: 100, desc: 'TUG da TV (1/3) — parede da TV, atrás do rack' },
  { id: 'T-TV2', fl: 'T', k: 'tug', amb: 'Sala', x: 4300, y: 12700, z: 300, va: 100, desc: 'TUG da TV (2/3) — parede da TV, atrás do rack' },
  { id: 'T-TV3', fl: 'T', k: 'tug', amb: 'Sala', x: 4300, y: 12900, z: 300, va: 100, desc: 'TUG da TV (3/3) — parede da TV, atrás do rack' },
  // tomada no teto para o roteador
  { id: 'T-T-RT', fl: 'T', k: 'tug', amb: 'Sala', x: 4600, y: 14550, z: TETO, va: 100, desc: 'Tomada no teto para o roteador Wi-Fi (junto ao ponto de rede)' },
  // tomada do roteador/ONT, ao lado do quadro de telecom (QDT)
  { id: 'T-T-QDT', fl: 'T', k: 'tug', amb: 'Sala (pé da escada)', x: 7000, y: 8750, z: 1500, va: 100, desc: 'TUG do roteador / ONT da fibra (ao lado do QDT)' },
];
EXTRA.forEach(add);

// ------------------------------------------------------------------ infraestrutura de rede (fibra + cabeamento Cat6)
// Eletrodutos só de telecom (nunca no mesmo eletroduto da elétrica), com arame-guia, curvas suaves e caixas de passagem.
const TEL = [
  { id: 'CXT', fl: 'T', k: 'tel', tel: 'entrada', amb: 'Muro esquerdo (frente)', x: 150, y: 19300, z: 1500, desc: 'Caixa de entrada da fibra (operadora) — muro esquerdo, ao lado do padrão' },
  { id: 'CPT', fl: 'T', k: 'tel', tel: 'passagem', amb: 'Garagem', x: 2600, y: 10500, z: 300, desc: 'Caixa de passagem 4×4 da fibra — parede do lavabo, lado da garagem' },
  { id: 'QDT', fl: 'T', k: 'tel', tel: 'qdt', amb: 'Sala (sob a escada)', x: 6650, y: 8750, z: 1500, desc: 'Quadro de telecom (QDT) 40×40 — ONT da fibra, roteador e distribuição Cat6' },
  { id: 'T-RJ1', fl: 'T', k: 'tel', tel: 'rj', amb: 'Sala', x: 4300, y: 13100, z: 300, desc: 'Ponto de rede RJ45 (TV) — Sala, ao lado das tomadas da TV' },
  { id: 'T-RJ2', fl: 'T', k: 'tel', tel: 'rj', amb: 'Quarto', x: 4300, y: 6450, z: 300, desc: 'Ponto de rede RJ45 — Quarto' },
  // roteador no teto da sala, depois da 2ª janela da parede sala/garagem (lado da rua), a 30 cm da parede
  { id: 'T-RT1', fl: 'T', k: 'tel', tel: 'roteador', amb: 'Sala', x: 4600, y: 14550, z: TETO, desc: 'Ponto no teto para o roteador Wi-Fi (Cat6 do QDT + tomada no teto) — Sala, depois da 2ª janela da parede da garagem' },
  { id: '1-RJ1', fl: '1', k: 'tel', tel: 'rj', amb: 'Quarto Master', x: 3150, y: 7063, z: 300, desc: 'Ponto de rede RJ45 — Quarto Master' },
  { id: '1-RJ2', fl: '1', k: 'tel', tel: 'rj', amb: 'Quarto 1', x: 4150, y: 13063, z: 300, desc: 'Ponto de rede RJ45 — Quarto 1' },
  { id: '1-RJ3', fl: '1', k: 'tel', tel: 'rj', amb: 'Quarto 2', x: 4300, y: 11975, z: 300, desc: 'Ponto de rede RJ45 — Quarto 2' },
  { id: '1-AP1', fl: '1', k: 'tel', tel: 'ap', amb: 'Circulação', x: 4700, y: 9550, z: TETO, desc: 'Ponto de Wi-Fi no teto (access point) — Circulação do 1º' },
  { id: '2-RJ1', fl: '2', k: 'tel', tel: 'rj', amb: 'Varanda coberta', x: 7350, y: 7800, z: 300, desc: 'Ponto de rede RJ45 (TV) — Varanda coberta' },
  { id: '2-AP1', fl: '2', k: 'tel', tel: 'ap', amb: 'Varanda coberta', x: 5250, y: 6700, z: TETO, desc: 'Ponto de Wi-Fi no teto (access point) — Varanda coberta' },
];
TEL.forEach(add);

// ------------------------------------------------------------------ ajustes do projeto
// Ar-condicionado: evaporadora em parede de fachada (condensadora fora, sem invadir o vizinho)
const FIXOS = {
  'Quarto Master': { x: 7350, y: 7750, z: 2200, nota: 'parede lateral, depois da janela' },
  'Quarto 1': { x: 1700, y: 14850, z: 2450, nota: 'acima da janela (fachada)' },
  'Quarto 2': { x: 8000, y: 14850, z: 2200, nota: 'fachada, à direita da janela' },
};
pts.filter((p) => p.eq === 'ac' && FIXOS[p.amb]).forEach((p) => {
  const f = FIXOS[p.amb];
  Object.assign(p, { x: f.x, y: f.y, z: f.z, desc: p.desc + ' — ' + f.nota });
});
// interruptores do mesmo cômodo a menos de 25 cm um do outro ficam na mesma caixa (interruptor de 2 ou 3 teclas)
pts.filter((p) => p.k === 'int' || p.k === 'int3').forEach((p, i, all) => {
  const q = all.slice(0, i).find((o) => o.fl === p.fl && o.amb === p.amb && Math.hypot(o.x - p.x, o.y - p.y) < 250);
  if (q) Object.assign(p, { x: q.x, y: q.y, caixa: q.caixa || q.id, desc: p.desc + ' (mesma caixa do ' + (q.caixa || q.id) + ')' });
});

// ------------------------------------------------------------------ compatibilização: pilares e vãos
// Os eletrodutos descem da laje pela parede até a caixa. Um ponto não pode ficar:
//   • sobre um pilar — o corte para a caixa e para o eletroduto enfraqueceria o pilar;
//   • na prumada de uma janela ou porta — a descida passaria pelo vão (sem parede para embutir).
// Pontos nessas posições escorregam ao longo da mesma parede até a posição livre mais próxima, sem sair do cômodo.
// Os pilares vêm do projeto estrutural, que é privado (private/estrutura.json, fora do repositório): sem ele, só os
// vãos são conferidos.
const STF = path.join(__dirname, '..', 'private', 'estrutura.json');
const PILARES = fs.existsSync(STF) ? JSON.parse(fs.readFileSync(STF, 'utf8')).pilares : null;
if (!PILARES) console.warn('aviso: private/estrutura.json ausente — pontos não conferidos contra os pilares');
const LVL = { T: 0, 1: 2880, 2: 5760 }, FID = { T: 'f0', 1: 'f1', 2: 'f2' };
const desceDoTeto = (p) => !(p.fl === 'T' && p.id === 'T-PT1') && !/^2-IL[78]$/.test(p.id); // os de baixo vêm do piso
function wallOf(p) {
  let best = null;
  wallsOf(FID[p.fl]).forEach((w) => {
    const d = distSeg(p, w.a, w.b);
    if (d <= w.thick / 2 + 90 && (!best || d < best.d)) best = { w, d };
  });
  return best && best.w;
}
function conflito(p, q) {
  const fid = FID[p.fl], lv = LVL[p.fl];
  if (PILARES && PILARES.some((c) => c.topo > lv + 100 && q.x > c.x0 - 60 && q.x < c.x1 + 60 && q.y > c.y0 - 60 && q.y < c.y1 + 60)) return 'pilar';
  const vao = doc.openings.find((o) => {
    const w = doc.walls.find((x) => x.id === o.wall);
    if (!w || w.floor !== fid) return false;
    const f = DD.geom.openingFrame(w, o);
    const along = (q.x - f.c.x) * f.d.x + (q.y - f.c.y) * f.d.y, across = (q.x - f.c.x) * f.n.x + (q.y - f.c.y) * f.n.y;
    if (Math.abs(across) > w.thick / 2 + 90 || Math.abs(along) > o.width / 2 + 150) return false;
    const sill = o.sill || 0, top = sill + o.height;
    return desceDoTeto(p) ? top > p.z - 100 : sill < p.z + 100;
  });
  return vao ? 'vao' : null;
}
const relocados = [];
pts.forEach((p) => {
  if (/qdc|medidor/.test(p.k) || p.z >= TETO || (p.k === 'tel' && p.tel !== 'rj')) return;
  if (!conflito(p, p)) return;
  const w = wallOf(p);
  if (!w) return;
  const L = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y), d = { x: (w.b.x - w.a.x) / L, y: (w.b.y - w.a.y) / L }, n = { x: -d.y, y: d.x };
  const side = Math.sign((p.x - w.a.x) * n.x + (p.y - w.a.y) * n.y) || 1;
  const room = roomList.find((r) => r.fl === p.fl && r.name === p.amb && inside(r, { x: p.x + n.x * side * 120, y: p.y + n.y * side * 120 }));
  const outros = pts.filter((o) => o !== p && o.fl === p.fl && o.z < TETO && !(p.caixa && (o.id === p.caixa || o.caixa === p.caixa)) && o.caixa !== p.id);
  for (let k = 1; k <= 60; k++) {
    for (const sg of [1, -1]) {
      const q = { x: Math.round(p.x + d.x * sg * k * 50), y: Math.round(p.y + d.y * sg * k * 50) };
      const t = (q.x - w.a.x) * d.x + (q.y - w.a.y) * d.y;
      if (t < 150 || t > L - 150) continue;
      if (conflito(p, q)) continue;
      if (room && !inside(room, { x: q.x + n.x * side * 120, y: q.y + n.y * side * 120 })) continue;
      if (outros.some((o) => Math.hypot(o.x - q.x, o.y - q.y) < (o.k === 'qdc' || o.tel === 'qdt' ? 450 : 180))) continue;
      relocados.push(p.id + ' ' + (k * 50) + ' mm');
      p.x = q.x; p.y = q.y;
      k = 99;
      break;
    }
  }
  // interruptores na mesma caixa acompanham
  pts.filter((o) => o.caixa === p.id).forEach((o) => ((o.x = p.x), (o.y = p.y)));
});
const restam = pts.filter((p) => !/qdc|medidor/.test(p.k) && p.z < TETO && !(p.k === 'tel' && p.tel !== 'rj') && conflito(p, p));
if (restam.length) console.warn('ATENÇÃO — pontos ainda em conflito: ' + restam.map((p) => p.id + ' (' + conflito(p, p) + ')').join(', '));
console.log('compatibilização: ' + relocados.length + ' pontos deslocados ao longo da parede');

// ------------------------------------------------------------------ saída
const fmt = (p) => '    ' + JSON.stringify(p).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w+: )/g, ', ');
const block = '  // <PONTOS> gerado por tools/gera-eletrica.js — não editar à mão\n  const PONTOS = [\n' + pts.map(fmt).join(',\n') + ',\n  ];\n  // </PONTOS>';
const file = path.join(__dirname, '..', 'src', '18-eletrica.js');
if (process.argv.includes('--print') || !fs.existsSync(file)) {
  console.log(block);
} else {
  const s = fs.readFileSync(file, 'utf8');
  const a = s.indexOf('  // <PONTOS>'), b = s.indexOf('// </PONTOS>');
  if (a < 0 || b < 0) throw new Error('marcadores PONTOS não encontrados em 18-eletrica.js');
  fs.writeFileSync(file, s.slice(0, a) + block + s.slice(b + '// </PONTOS>'.length));
  console.log('18-eletrica.js: ' + pts.length + ' pontos');
}
