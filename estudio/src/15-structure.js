// ===== 15-structure.js — projeto estrutural (pilares, vigas, sapatas) e compatibilização =====
// Dados do projeto estrutural lidos das pranchas (formas nos níveis 0/2880/5760/8640, pilares, sapatas).
// Revisão de obra (out/2026): a laje do 2º passa para o nível 6340 e a cobertura para 9220 (REVISOES).
// Os dados NÃO ficam no repositório público (a prancha proíbe disponibilizá-los a terceiros): entram
//   a) embutidos no build privado  → window.DD_STRUCT (python tools/build.py out.html --estrutura private/estrutura.json)
//   b) importados pelo usuário      → arquivo .json guardado no navegador (DD.structure.importData)
//   c) da nuvem da obra (Supabase)  → tabela projeto_estrutural, lida só por membros da obra depois do login
//      (window.projetoAuth, de auth/sessao.js); dono e editores gravam com DD.structure.cloud.save()
// Sem dados, o estúdio segue com a estrutura inferida da planta (paredes estruturais × vedação).
// Coordenadas no mesmo sistema do documento: mm, origem no canto fundo-esquerdo do lote, +y para a rua.
// Níveis: o 0,00 da estrutura é o piso do térreo (floor.level) — iguais aos da arquitetura.
(function () {
  const DD = window.DD;
  const LS_KEY = 'dd.decor.casa.estrutura.v1';
  const FORMAT = 'estrutura-casa/1';
  const COL = {
    column: '#A0452D', columnInk: '#5C2415', beam: '#1F8A8A', beamFill: 'rgba(31,138,138,0.16)',
    footing: 'rgba(122,79,160,0.75)', footingFill: 'rgba(122,79,160,0.07)', erro: '#C0392B', alerta: '#D9822B',
  };
  const S = { data: null, raw: null, source: null, version: 0, cache: null, highlight: -1, auth: null };

  // ------------------------------------------------------------------ dados
  const num = (v) => typeof v === 'number' && isFinite(v);
  const rectOK = (r) => r && num(r.x0) && num(r.x1) && num(r.y0) && num(r.y1) && r.x1 > r.x0 && r.y1 > r.y0;

  // Revisões de nível decididas na obra depois da rev. 00 das pranchas (só cotas; armaduras e posições iguais).
  // Aplicadas na leitura, para os dados guardados (nuvem, arquivo) continuarem idênticos às pranchas originais.
  const REVISOES = [
    // out/2026: pé-direito do 1º — fundo da laje do 2º a 3,30 m do piso (no osso): nível 5,76 → 6,34 (+58 cm);
    // tudo o que está desse nível para cima (vigas, topo dos pilares, cobertura) sobe junto
    { desde: 5760, delta: 580, nota: 'Laje do 2º no nível 6,34 (pé-direito do 1º maior, +58 cm)' },
  ];
  /** Aplica as revisões de nível (uma vez: dados já revisados trazem a cota nova e não mudam). */
  function revisar(raw) {
    let out = raw;
    REVISOES.forEach((rv) => {
      const niveis = out.niveis || Object.keys(out.vigas || {}).map(Number);
      if (niveis.indexOf(rv.desde) < 0) return;
      const up = (z) => (num(z) && z >= rv.desde ? z + rv.delta : z);
      const vigas = {};
      Object.keys(out.vigas || {}).forEach((k) => (vigas[String(up(Number(k)))] = out.vigas[k]));
      out = Object.assign({}, out, {
        niveis: niveis.map(up),
        vigas,
        pilares: (out.pilares || []).map((c) => Object.assign({}, c, { topo: up(c.topo) })),
        revisoes: (out.revisoes || []).concat(rv.nota),
      });
    });
    return out;
  }

  /** Valida o JSON do projeto estrutural. → { data, error } */
  function validate(input) {
    if (!input || typeof input !== 'object') return { error: 'Arquivo vazio ou inválido.' };
    if (input.formato !== FORMAT) return { error: 'Formato não reconhecido (esperado "' + FORMAT + '").' };
    const raw = revisar(input);
    const cols = (raw.pilares || []).filter((c) => rectOK(c) && typeof c.n === 'string' && num(c.topo));
    const beams = {};
    Object.keys(raw.vigas || {}).forEach((k) => {
      const L = Number(k);
      if (num(L)) beams[L] = (raw.vigas[k] || []).filter((b) => rectOK(b) && num(b.h) && b.h > 0);
    });
    if (!cols.length || !Object.keys(beams).length) return { error: 'O arquivo não tem pilares ou vigas.' };
    return {
      data: {
        fonte: String(raw.fonte || ''),
        revisoes: raw.revisoes || [],
        levels: (raw.niveis || Object.keys(beams).map(Number)).slice().sort((a, b) => a - b),
        slab: raw.laje && num(raw.laje.h) ? raw.laje.h : 160,
        slabType: (raw.laje && raw.laje.tipo) || '',
        cols,
        beams,
        footings: (raw.sapatas || []).filter(rectOK),
        tieBeams: (raw.vigasEquilibrio || []).filter(rectOK),
      },
    };
  }
  function setData(data, source) {
    S.data = data;
    S.source = data ? source : null;
    S.version++;
    S.cache = null;
    S.highlight = -1;
    if (DD.events) DD.events.emit('structure:changed', { source: S.source });
  }
  function load() {
    if (window.DD_STRUCT) {
      const r = validate(window.DD_STRUCT);
      if (r.data) return (S.raw = window.DD_STRUCT), setData(r.data, 'embutido');
      console.warn('[structure] dados embutidos inválidos:', r.error);
    }
    try {
      const txt = window.localStorage && window.localStorage.getItem(LS_KEY);
      if (!txt) return;
      const raw = JSON.parse(txt), r = validate(raw);
      if (r.data) (S.raw = raw), setData(r.data, 'importado');
    } catch (e) {
      console.warn('[structure] não foi possível ler os dados salvos', e);
    }
  }
  /** Importa um objeto JSON (já lido do arquivo). → mensagem de erro ou null */
  function importData(raw) {
    const r = validate(raw);
    if (r.error) return r.error;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(raw));
    } catch (e) {
      console.warn('[structure] não foi possível guardar no navegador', e);
    }
    S.raw = raw;
    setData(r.data, 'importado');
    return null;
  }

  // ------------------------------------------------------------------ nuvem da obra (login do site)
  const TABLE = 'projeto_estrutural';
  /** Depois do login, lê o projeto estrutural da obra (se não houver dados embutidos ou importados). */
  function loadCloud(auth) {
    const a = auth || window.projetoAuth;
    if (!a || !a.ready) return Promise.resolve(false);
    return a.ready
      .then((ctx) => {
        S.auth = ctx;
        if (!ctx || !ctx.client || !ctx.obraId) return false;
        if (DD.events) DD.events.emit('structure:changed', { source: S.source }); // atualiza "Guardar na nuvem"
        if (S.data) return false;
        return ctx.client
          .from(TABLE)
          .select('dados')
          .eq('obra_id', ctx.obraId)
          .maybeSingle()
          .then((res) => {
            if (res.error) throw res.error;
            if (!res.data || S.data) return false;
            const r = validate(res.data.dados);
            if (r.error) {
              console.warn('[structure] dados da nuvem inválidos:', r.error);
              return false;
            }
            S.raw = res.data.dados;
            setData(r.data, 'nuvem');
            return true;
          });
      })
      .catch((e) => {
        console.warn('[structure] não foi possível ler o projeto estrutural da nuvem', e);
        return false;
      });
  }
  const canSaveCloud = () => !!(S.auth && S.auth.client && S.auth.obraId && (S.auth.papel === 'dono' || S.auth.papel === 'editor') && S.raw && S.source !== 'nuvem');
  /** Grava os dados atuais (importados) na nuvem da obra. → Promise<null | mensagem de erro> */
  function saveCloud() {
    if (!canSaveCloud()) return Promise.resolve('Só o dono ou editores da obra podem guardar, depois de importar o arquivo.');
    return S.auth.client
      .from(TABLE)
      .upsert({ obra_id: S.auth.obraId, dados: S.raw, atualizado_em: new Date().toISOString() })
      .then((res) => {
        if (res.error) return res.error.message || 'Não foi possível guardar.';
        try {
          window.localStorage.removeItem(LS_KEY); // a cópia local não é mais necessária
        } catch (e) {
          /* sem armazenamento */
        }
        S.source = 'nuvem';
        if (DD.events) DD.events.emit('structure:changed', { source: S.source });
        return null;
      });
  }
  function clearImported() {
    try {
      window.localStorage.removeItem(LS_KEY);
    } catch (e) {
      /* sem armazenamento */
    }
    if (window.DD_STRUCT) load();
    else {
      S.raw = null;
      setData(null, null);
      loadCloud();
    }
  }

  const floorIndex = (doc, floorId) => Math.max(0, doc.floors.findIndex((f) => f.id === floorId));
  const beamsAt = (level) => (S.data && S.data.beams[level]) || [];
  /** Pilares que atravessam o pavimento (do piso ao teto dele). */
  const columnsOn = (floor) => (S.data ? S.data.cols.filter((c) => c.topo > floor.level) : []);
  /** Vigas do teto do pavimento (nível do piso de cima). */
  const ceilingBeams = (floor) => beamsAt(floor.level + floor.height);

  // ------------------------------------------------------------------ geometria auxiliar
  const ovl = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const rectOv = (A, B) => ovl(A.x0, A.x1, B.x0, B.x1) * ovl(A.y0, A.y1, B.y0, B.y1);
  const area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);
  const centre = (r) => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
  const isAxis = (w) => Math.abs(w.a.x - w.b.x) < 1 || Math.abs(w.a.y - w.b.y) < 1;
  function wallRect(w) {
    const h = w.thick / 2;
    if (Math.abs(w.a.y - w.b.y) < 1) return { x0: Math.min(w.a.x, w.b.x), x1: Math.max(w.a.x, w.b.x), y0: w.a.y - h, y1: w.a.y + h, horiz: true };
    return { x0: w.a.x - h, x1: w.a.x + h, y0: Math.min(w.a.y, w.b.y), y1: Math.max(w.a.y, w.b.y), horiz: false };
  }
  function openingRect(w, op) {
    const f = DD.geom.openingFrame(w, op), h = w.thick / 2;
    const xs = [f.start.x, f.end.x], ys = [f.start.y, f.end.y];
    const horiz = Math.abs(w.a.y - w.b.y) < 1;
    return {
      x0: Math.min.apply(null, xs) - (horiz ? 0 : h), x1: Math.max.apply(null, xs) + (horiz ? 0 : h),
      y0: Math.min.apply(null, ys) - (horiz ? h : 0), y1: Math.max.apply(null, ys) + (horiz ? h : 0), horiz,
    };
  }
  const BODY = { structural: true, partition: true };
  function roomName(doc, floorId, x, y) {
    const tries = [[0, 0], [250, 0], [-250, 0], [0, 250], [0, -250], [450, 450], [-450, -450], [450, -450], [-450, 450]];
    for (const [dx, dy] of tries) {
      let r = null;
      try {
        r = DD.rooms.at(doc, floorId, x + dx, y + dy);
      } catch (e) {
        r = null;
      }
      if (r) return r.name;
    }
    return 'área externa';
  }
  const fmtM = (mm) => DD.util.fmtM(mm);
  const fmtMM = (mm) => Math.round(mm).toLocaleString('pt-BR') + ' mm';

  // ------------------------------------------------------------------ compatibilização
  /**
   * Conflitos entre a estrutura e a planta atual (recalcula quando paredes/aberturas mudam).
   * → [{ sev:'erro'|'alerta'|'nota', floor|null, x, y, z (mm acima do piso) | null, title, detail }]
   */
  function compat(doc) {
    if (!S.data || !doc) return [];
    const key = [doc.walls, doc.openings, doc.floors, doc.roomSeeds, S.version];
    if (S.cache && S.cache.key.every((v, i) => v === key[i])) return S.cache.list;
    const out = [];
    const add = (sev, floor, x, y, title, detail, z) => out.push({ sev, floor: floor ? floor.id : null, x, y, z: z == null ? null : z, title, detail });
    const levelsTxt = doc.floors.map((f) => fmtM(f.level)).join(' / ');
    const same = doc.floors.every((f) => S.data.levels.indexOf(f.level) >= 0 && S.data.levels.indexOf(f.level + f.height) >= 0);
    add('nota', null, null, null, same ? 'Níveis conferem' : 'Níveis diferentes',
      same ? `Estrutura e arquitetura usam os mesmos níveis de piso (${levelsTxt} m).`
        : `Os níveis da estrutura (${S.data.levels.map(fmtM).join(' / ')} m) não batem com os pisos (${levelsTxt} m).`);
    const f0 = doc.floors[0];
    const archSlab = f0 ? f0.height - f0.ceiling : 100;
    if (S.data.slab > archSlab)
      add('alerta', null, null, null, 'Laje mais grossa que a do projeto arquitetônico',
        `A estrutura usa laje ${S.data.slabType || ''} de ${S.data.slab / 10} cm; a arquitetura considera ${archSlab / 10} cm. ` +
          `O pé-direito livre cai de ${fmtM(f0.height - archSlab)} m para ${fmtM(f0.height - S.data.slab)} m (antes do forro e do reboco).`);

    doc.floors.forEach((floor) => {
      const walls = doc.walls.filter((w) => w.floor === floor.id && isAxis(w));
      const body = walls.filter((w) => BODY[w.kind]).map(wallRect);
      const wallById = new Map(walls.map((w) => [w.id, w]));
      const ops = doc.openings.filter((o) => wallById.has(o.wall)).map((o) => ({ o, w: wallById.get(o.wall), r: openingRect(wallById.get(o.wall), o) }));
      const kindOf = (o) => (o.type === 'window' ? 'janela' : 'porta');
      const protr = [];
      // pilares × aberturas e pilares aparentes
      columnsOn(floor).forEach((c) => {
        const p = centre(c);
        ops.forEach(({ o, w, r }) => {
          if (rectOv(c, r) > 0) {
            const ov = r.horiz ? ovl(c.x0, c.x1, r.x0, r.x1) : ovl(c.y0, c.y1, r.y0, r.y1);
            add(ov >= 100 ? 'erro' : 'alerta', floor, p.x, p.y, `Pilar ${c.n} invade a ${kindOf(o)} ${o.code} em ${fmtMM(ov)}`,
              `O pilar (${Math.round(c.x1 - c.x0)} × ${Math.round(c.y1 - c.y0)} mm) avança ${fmtMM(ov)} sobre o vão de ${fmtMM(o.width)} (${roomName(doc, floor.id, p.x, p.y)}). ` +
                (ov < 100 ? 'Pode ser só a precisão da posição do vão: conferir na obra.' : 'Mudar o vão de lugar ou rever o pilar.'));
            return;
          }
          const wr = wallRect(w);
          const lat = r.horiz ? ovl(c.y0, c.y1, wr.y0, wr.y1) : ovl(c.x0, c.x1, wr.x0, wr.x1);
          if (lat <= 0) return;
          const [a, b] = r.horiz ? [r.x0, r.x1] : [r.y0, r.y1];
          const [pa, pb] = r.horiz ? [c.x0, c.x1] : [c.y0, c.y1];
          const gap = pb <= a ? a - pb : pa >= b ? pa - b : -1;
          if (gap >= 0 && gap < 100)
            add('alerta', floor, p.x, p.y, `Pilar ${c.n} a ${fmtMM(gap)} da ${kindOf(o)} ${o.code}`,
              `Sobra pouco espaço para o batente ou requadro (o ideal é pelo menos 100 mm), em ${roomName(doc, floor.id, p.x, p.y)}.`);
        });
        const inWall = Math.min(1, body.reduce((s, W) => s + rectOv(c, W), 0) / area(c));
        if (inWall < 0.6)
          add('alerta', floor, p.x, p.y, `Pilar ${c.n} fica aparente`,
            `Só ${Math.round(inWall * 100)}% da seção está dentro de parede (${roomName(doc, floor.id, p.x, p.y)}): vai aparecer como coluna no ambiente.`);
        else if (inWall < 0.97) protr.push(c.n);
      });
      if (protr.length)
        add('nota', floor, null, null, `${protr.length} pilares saem da parede`,
          `${protr.join(', ')}: pilares mais largos que a parede ficam alguns centímetros para fora. Resolver com reboco mais grosso ou requadro.`);

      // vigas do teto × aberturas e vigas aparentes
      const beams = ceilingBeams(floor), seen = new Set();
      beams.forEach((b) => {
        const bottom = floor.height - b.h;
        ops.forEach(({ o, r }) => {
          if (seen.has(o.id) || rectOv(b, r) <= 0) return;
          const top = (o.sill || 0) + o.height;
          if (top <= bottom) return;
          seen.add(o.id);
          const p = centre(r);
          add('erro', floor, p.x, p.y, `${o.type === 'window' ? 'Janela' : 'Porta'} ${o.code} bate na viga 15/${b.h / 10}`,
            `O topo do vão fica a ${fmtM(top)} m do piso e o fundo da viga a ${fmtM(bottom)} m: faltam ${fmtMM(top - bottom)} (${roomName(doc, floor.id, p.x, p.y)}). ` +
              'Opções: baixar o vão, usar a viga como verga ou rever a altura da viga.', bottom);
        });
        const inWall = Math.min(1, body.reduce((s, W) => s + rectOv(b, W), 0) / area(b));
        if (inWall < 0.5) {
          const p = centre(b);
          add('alerta', floor, p.x, p.y, `Viga 15/${b.h / 10} aparente no teto`,
            `Passa por ${roomName(doc, floor.id, p.x, p.y)} sem parede embaixo em ${Math.round((1 - inWall) * 100)}% do trecho (${fmtMM(Math.max(b.x1 - b.x0, b.y1 - b.y0))}). O fundo fica a ${fmtM(bottom)} m do piso.`, bottom);
        }
      });

      // paredes sem viga (ou baldrame) embaixo
      const below = beamsAt(floor.level).map((b) => ({ x0: b.x0 - 30, x1: b.x1 + 30, y0: b.y0 - 30, y1: b.y1 + 30 }));
      if (below.length)
        walls.forEach((w) => {
          if (!BODY[w.kind] || (w.height || 0) < 1500) return;
          const W = wallRect(w), len = Math.max(W.x1 - W.x0, W.y1 - W.y0);
          const sup = Math.min(1, below.reduce((s, B) => s + rectOv(W, B), 0) / area(W));
          if (sup >= 0.5 || len < 600) return;
          const p = centre(W), ground = floor.level === 0;
          add('alerta', floor, p.x, p.y, ground ? 'Parede sem baldrame embaixo' : 'Parede sem viga embaixo',
            `Parede ${w.kind === 'structural' ? 'estrutural' : 'de vedação'} de ${fmtMM(len)} em ${roomName(doc, floor.id, p.x, p.y)}: só ${Math.round(sup * 100)}% dela está sobre ${ground ? 'baldrame' : 'viga'}. ` +
              (ground ? 'Confirmar a fundação dessa parede.' : 'Ela apoia direto na laje: confirmar com o engenheiro se a laje foi calculada para essa carga.'));
        });

      // contorno da estrutura × contorno das paredes
      const bb = beamsAt(floor.level), built = walls.filter((w) => BODY[w.kind] || w.kind === 'railing').map(wallRect);
      if (bb.length && built.length) {
        const ext = (rs) => [Math.min(...rs.map((r) => r.x0)), Math.max(...rs.map((r) => r.x1)), Math.min(...rs.map((r) => r.y0)), Math.max(...rs.map((r) => r.y1))];
        const sx = ext(bb), ax = ext(built), side = ['esquerda', 'direita', 'fundo', 'frente'];
        for (let i = 0; i < 4; i++) {
          const d = Math.abs(sx[i] - ax[i]);
          if (d < 50) continue;
          const x = i < 2 ? sx[i] : (sx[0] + sx[1]) / 2, y = i >= 2 ? sx[i] : (sx[2] + sx[3]) / 2;
          add('alerta', floor, x, y, `Borda da ${floor.level === 0 ? 'fundação' : 'laje'} diferente (${side[i]})`,
            `A viga de borda do nível ${fmtM(floor.level)} está ${fmtMM(d)} ${(i % 2 === 0 ? sx[i] < ax[i] : sx[i] > ax[i]) ? 'para fora' : 'para dentro'} da parede da arquitetura.`);
        }
      }
    });
    const order = { erro: 0, alerta: 1, nota: 2 };
    const fIdx = (id) => (id == null ? -1 : floorIndex(doc, id));
    out.sort((a, b) => order[a.sev] - order[b.sev] || fIdx(a.floor) - fIdx(b.floor));
    S.cache = { key, list: out };
    return out;
  }
  function summary(doc) {
    const list = compat(doc), c = { erro: 0, alerta: 0, nota: 0 };
    list.forEach((i) => c[i.sev]++);
    return c;
  }

  // ------------------------------------------------------------------ 2D (chamado pelo plan2d.drawScene)
  /** Camada em coordenadas do mundo (mm): sapatas no térreo, vigas do teto (tracejadas) e pilares. */
  function draw2dWorld(rc) {
    if (!S.data || !rc.floor) return;
    const { ctx, px } = rc, floor = rc.floor;
    if (floor.level === 0) {
      ctx.setLineDash([5 * px, 4 * px]);
      ctx.lineWidth = px;
      ctx.strokeStyle = COL.footing;
      ctx.fillStyle = COL.footingFill;
      S.data.footings.concat(S.data.tieBeams).forEach((f) => {
        ctx.fillRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
        ctx.strokeRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
      });
    }
    ctx.setLineDash([7 * px, 4 * px]);
    ctx.lineWidth = 1.3 * px;
    ctx.strokeStyle = COL.beam;
    ctx.fillStyle = COL.beamFill;
    ceilingBeams(floor).forEach((b) => {
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    });
    ctx.setLineDash([]);
    ctx.lineWidth = px;
    columnsOn(floor).forEach((c) => {
      ctx.fillStyle = COL.column;
      ctx.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
      ctx.strokeStyle = COL.columnInk;
      ctx.strokeRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
    });
  }
  /** Camada em pixels de tela: nomes dos pilares, rótulos das vigas e marcadores numerados dos conflitos. */
  function draw2dScreen(rc) {
    if (!S.data || !rc.floor) return;
    const { ctx, v } = rc, floor = rc.floor;
    const w2s = (x, y) => ({ x: v.width / 2 + (x - v.cx) * v.scale, y: v.height / 2 + (y - v.cy) * v.scale });
    const mono = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
    if (v.scale > 0.045) {
      ctx.font = '600 10px ' + mono;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = COL.beam;
      ceilingBeams(floor).forEach((b) => {
        const vert = b.y1 - b.y0 > b.x1 - b.x0, len = Math.max(b.x1 - b.x0, b.y1 - b.y0) * v.scale;
        if (len < 70) return;
        const p = w2s((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
        ctx.save();
        ctx.translate(p.x, p.y);
        if (vert) ctx.rotate(-Math.PI / 2);
        ctx.fillText('V 15/' + b.h / 10, 0, -(150 * v.scale) / 2 - 1);
        ctx.restore();
      });
    }
    if (v.scale > 0.028) {
      ctx.font = '600 ' + Math.max(9, Math.min(11, 280 * v.scale)) + 'px ' + mono;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = COL.column;
      columnsOn(floor).forEach((c) => {
        const p = w2s(c.x1, c.y0);
        ctx.fillText(c.n, p.x + 2, p.y);
      });
    }
    if (rc.exporting) return;
    compat(rc.doc).forEach((it, i) => {
      if (it.floor !== floor.id || it.x == null || it.sev === 'nota') return;
      const p = w2s(it.x, it.y), hl = i === S.highlight, minor = it.sev === 'alerta' && !hl;
      const r = hl ? 13 : minor ? 7 : 9.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = COL[it.sev];
      ctx.globalAlpha = hl ? 1 : 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = hl ? 3 : 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      if (minor && v.scale < 0.07) return; // atenção: número só com zoom
      ctx.fillStyle = '#fff';
      ctx.font = '700 ' + (hl ? 11.5 : minor ? 8.5 : 10) + 'px ' + mono;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), p.x, p.y + 0.5);
    });
  }

  // ------------------------------------------------------------------ 3D (chamado pelo view3d)
  const MATS = new Map();
  function mat(THREE, key, color, extra) {
    if (!MATS.has(key)) MATS.set(key, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75 }, extra || {})));
    return MATS.get(key);
  }
  /**
   * Estrutura de um pavimento em metros: pilares do trecho, vigas do teto e, no térreo, baldrames, sapatas e
   * vigas de equilíbrio (profundidade das sapatas ilustrativa). Elementos recuados 3 mm para sumir dentro das
   * paredes onde coincidem — fica visível só o que de fato aparece (vigas aparentes, pilares mais largos).
   */
  function build3d(THREE, doc, floor) {
    const g = new THREE.Group();
    g.name = 'structure:' + floor.id;
    if (!S.data) return g;
    const MM = 0.001, inset = 3;
    const box = (r, z0, z1, m) => {
      const w = Math.max(1, r.x1 - r.x0 - 2 * inset), d = Math.max(1, r.y1 - r.y0 - 2 * inset), h = Math.max(1, z1 - z0);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * MM, h * MM, d * MM), m);
      mesh.position.set(((r.x0 + r.x1) / 2) * MM, ((z0 + z1) / 2) * MM, ((r.y0 + r.y1) / 2) * MM);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.structure = true;
      g.add(mesh);
    };
    const mCol = mat(THREE, 'col', COL.column), mBeam = mat(THREE, 'beam', COL.beam), mFoot = mat(THREE, 'foot', '#7A4FA0');
    const top = floor.level + floor.height;
    columnsOn(floor).forEach((c) => box(c, floor.level === 0 ? -1100 : floor.level, top, mCol));
    ceilingBeams(floor).forEach((b) => box(b, top - b.h, top - 5, mBeam));
    if (floor.level === 0) {
      beamsAt(0).forEach((b) => box(b, -b.h, -5, mBeam));
      S.data.footings.forEach((f) => box(f, -1500, -1100, mFoot));
      S.data.tieBeams.forEach((f) => box(f, -1100, -1100 + (f.h || 600), mFoot));
    }
    return g;
  }
  /** Marcadores 3D dos conflitos do pavimento (esfera + anel). */
  function markers3d(THREE, doc, floor) {
    const g = new THREE.Group();
    g.name = 'structure-markers:' + floor.id;
    if (!S.data) return g;
    compat(doc).forEach((it, i) => {
      if (it.floor !== floor.id || it.x == null || it.sev === 'nota') return;
      const m = mat(THREE, 'mk-' + it.sev, COL[it.sev], { roughness: 0.4, emissive: COL[it.sev], emissiveIntensity: 0.35 });
      const r = i === S.highlight ? 0.24 : 0.15;
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), m);
      s.position.set(it.x * 0.001, (floor.level + (it.z == null ? 1200 : it.z)) * 0.001, it.y * 0.001);
      g.add(s);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.6, 0.02, 8, 32), m);
      ring.position.copy(s.position);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    });
    return g;
  }

  /** Destaca um item da lista (índice) e leva a planta até ele. */
  function focus(doc, index) {
    const it = compat(doc)[index];
    S.highlight = index;
    if (DD.events) DD.events.emit('structure:focus', { index, issue: it || null });
    if (!it || !DD.store) return;
    try {
      if (it.floor && DD.store.ui.floor !== it.floor) DD.store.setUI({ floor: it.floor });
      if (it.x != null && DD.plan2d && DD.plan2d.getViewport) {
        const vp = DD.plan2d.getViewport();
        DD.plan2d.setViewport({ cx: it.x, cy: it.y, scale: Math.max(vp.scale, 0.12) });
      }
      if (DD.plan2d) DD.plan2d.redraw();
    } catch (e) {
      console.warn('[structure] focus failed', e);
    }
  }

  DD.structure = {
    FORMAT,
    load,
    validate,
    revisar,
    REVISOES,
    importData,
    clearImported,
    hasData: () => !!S.data,
    source: () => S.source,
    cloud: { load: loadCloud, save: saveCloud, canSave: canSaveCloud, signedIn: () => !!(S.auth && S.auth.obraId) },
    version: () => S.version,
    info: () =>
      S.data
        ? {
            fonte: S.data.fonte, columns: S.data.cols.length, toRoof: S.data.cols.filter((c) => c.topo >= Math.max(...S.data.levels)).length,
            beamsPerLevel: S.data.levels.map((L) => (S.data.beams[L] || []).length), footings: S.data.footings.length,
            tieBeams: S.data.tieBeams.length, slab: S.data.slab, slabType: S.data.slabType, levels: S.data.levels.slice(),
          }
        : null,
    columnsOn,
    ceilingBeams,
    beamsAt,
    compat,
    summary,
    focus,
    highlight: () => S.highlight,
    draw2dWorld,
    draw2dScreen,
    build3d,
    markers3d,
  };
  load();
  loadCloud();
})();
