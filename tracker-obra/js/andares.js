/* ══ AVANÇO POR PAVIMENTO ═══════════════════════════════════════
   Cada item da PCI é dividido em etapas por pavimento. A etapa tem:
     a = pavimento (T, P1, P2, CX = castelo da caixa d'água, G = geral)
     p = peso da etapa dentro do item (as etapas do item somam 100)
     e = % executado estimado da etapa
     m = % da etapa já medido pela CAIXA
   O % do item continua sendo o que vale para a medição:
     % do item = Σ p × e / 100
   e a etapa representa na obra: peso do item na PCI × p × e / 10000. */

const PAVIMENTOS = [
  { id:'T',  nome:'Térreo' },
  { id:'P1', nome:'1º pavimento' },
  { id:'P2', nome:'2º pavimento' },
  { id:'G',  nome:'Geral (obra toda)' },
];
const NOME_ETAPA = { T:'Térreo', P1:'1º pavimento', P2:'2º pavimento', CX:"Castelo da caixa d'água", G:'Obra toda' };
const ABA_DA_ETAPA = { T:'T', P1:'P1', P2:'P2', CX:'P2', G:'G' };   // o castelo aparece na aba do 2º pavimento
const ORDEM_ETAPAS = ['T', 'P1', 'P2', 'CX', 'G'];                   // obra sobe do térreo para o topo

/* divisão padrão dos itens da PLS CAIXA (mesma numeração em toda obra) */
const TRES = { T:33.34, P1:33.33, P2:33.33 };
const DIVISAO_PADRAO = {
  1:  { G:100 },                              // serviços preliminares
  2:  { T:100 },                              // infraestrutura — sapatas e baldrames
  3:  { T:32, P1:32, P2:28, CX:8 },           // supraestrutura + castelo da caixa d'água
  7:  { P2:100 },                             // cobertura — telhado
  19: { G:100 },                              // complementos
  20: { G:100 },                              // outros serviços (muro, documentação)
};
function divisaoPadrao(item) { return DIVISAO_PADRAO[item.id] || (item.id >= 1 && item.id <= 18 ? TRES : { G:100 }); }

const r2 = v => Math.round(v * 100) / 100;
const fmtP2 = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + '%';   // 2 casas: valores pequenos da obra

/* espalha um % do item pelas etapas, de baixo para cima (térreo primeiro) */
function distribuir(etapas, pctItem, campo) {
  let resta = Math.max(0, Math.min(100, +pctItem || 0));
  etapas.forEach(x => {
    const usa = Math.min(x.p, resta);
    x[campo] = x.p > 0 ? r2(usa / x.p * 100) : 0;
    resta = r2(resta - usa);
  });
}
const pctItemDe = (etapas, campo) => r2(etapas.reduce((s, x) => s + x.p * (+x[campo] || 0) / 100, 0));

/* garante que o item tenha etapas coerentes com o % gravado do item */
function normalizarAndares(item) {
  // normaliza no lugar (a tela guarda referência aos objetos das etapas)
  let et = Array.isArray(item.andares) ? item.andares : null;
  if (et) et.forEach(x => { x.p = +x.p || 0; x.e = +x.e || 0; x.m = +x.m || 0; });
  if (!et || !et.length || Math.abs(et.reduce((s, x) => s + x.p, 0) - 100) > 0.05) {
    const d = divisaoPadrao(item);
    et = ORDEM_ETAPAS.filter(a => d[a]).map(a => ({ a, p:d[a], e:0, m:0 }));
    distribuir(et, medidoDe(item), 'm');
    distribuir(et, item.exec, 'e');
  } else {
    et.sort((x, y) => ORDEM_ETAPAS.indexOf(x.a) - ORDEM_ETAPAS.indexOf(y.a));
    // o % do item mudou por fora (versão antiga da página): redistribui
    if (Math.abs(pctItemDe(et, 'm') - medidoDe(item)) > 0.05) distribuir(et, medidoDe(item), 'm');
    if (Math.abs(pctItemDe(et, 'e') - item.exec) > 0.05)     distribuir(et, item.exec, 'e');
  }
  et.forEach(x => { if (x.e < x.m) x.e = x.m; });
  item.andares = et;
  item.exec = Math.max(medidoDe(item), pctItemDe(et, 'e'));
  if (et.every(x => x.e === x.m)) item.exec = medidoDe(item);
}
function normalizarTodosAndares() { itens.forEach(normalizarAndares); }

/* quanto uma etapa representa (em % da obra) */
const naObra    = (item, x, e) => item.pciPct * x.p * e / 10000;
const aMedirEt  = (item, x, e) => item.pciPct * x.p * Math.max(0, e - x.m) / 10000;

/* ── tela ─────────────────────────────────────────────────────── */
let abaAvanco = 'T';

function etapasDaAba(aba) {
  const lista = [];
  itens.forEach(item => (item.andares || []).forEach(x => { if (ABA_DA_ETAPA[x.a] === aba) lista.push({ item, x }); }));
  return lista;
}
function resumoAba(aba) {
  let peso = 0, exec = 0, med = 0, aMedir = 0;
  etapasDaAba(aba).forEach(({ item, x }) => {
    peso += naObra(item, x, 100); exec += naObra(item, x, x.e); med += naObra(item, x, x.m); aMedir += aMedirEt(item, x, x.e);
  });
  return { peso, exec, med, aMedir };
}

function selecionarAbaAvanco(aba) { abaAvanco = aba; buildAvancoAndares(); }

let _avParcial = false;   // true: só atualiza cartões e totais (mantém os campos e o foco)

function buildAvancoAndares() {
  const abas = document.getElementById('av-abas');
  if (!abas || !itens.length) return;
  normalizarTodosAndares();
  if (_avParcial && abaAvanco !== 'R') { buildCartoesAvanco(); return; }
  const botao = (id, nome, extra) =>
    '<button class="mo-frente-btn' + (abaAvanco === id ? ' active' : '') + '" onclick="selecionarAbaAvanco(\'' + id + '\')">' +
    esc(nome) + (extra ? '<span class="mo-frente-val">' + extra + '</span>' : '') + '</button>';
  abas.innerHTML = PAVIMENTOS.map(pv => {
    const r = resumoAba(pv.id);
    return r.peso > 0 ? botao(pv.id, pv.nome, fmtP2(r.exec / r.peso * 100)) : '';
  }).join('') + botao('R', 'Resumo e pesos');

  const ehResumo = abaAvanco === 'R';
  document.getElementById('av-andar').style.display  = ehResumo ? 'none' : '';
  document.getElementById('av-resumo').style.display = ehResumo ? '' : 'none';
  if (ehResumo) { buildResumoAndares(); return; }

  buildCartoesAvanco();
  buildAvancoTabela();
}

function buildCartoesAvanco() {
  const r = resumoAba(abaAvanco);
  const nomeAba = (PAVIMENTOS.find(p => p.id === abaAvanco) || {}).nome || '';
  const card = (lbl, val, sub, cls) => `<div class="card ${cls || ''}"><div class="card-label">${lbl}</div><div class="card-value">${val}</div><div class="card-sub">${sub}</div></div>`;
  document.getElementById('av-cards').innerHTML =
    card('Peso do ' + esc(nomeAba.toLowerCase()) + ' na obra', fmtP2(r.peso), 'parte do total da PCI') +
    card('Executado do andar', fmtP2(r.peso ? r.exec / r.peso * 100 : 0), '= ' + fmtP2(r.exec) + ' da obra', 'info') +
    card('Já medido do andar', fmtP2(r.peso ? r.med / r.peso * 100 : 0), '= ' + fmtP2(r.med) + ' da obra', 'ok') +
    card('A medir (este andar)', '+' + fmtP2(r.aMedir), isAdmin ? '≈ ' + fmt(r.aMedir / 100 * BASE_OBRA) : 'da obra', 'warn');
  document.getElementById('av-tot-obra').textContent  = fmtP2(r.exec);
  document.getElementById('av-tot-medir').textContent = '+' + fmtP2(r.aMedir) + (isAdmin ? ' ≈ ' + fmt(r.aMedir / 100 * BASE_OBRA) : '');
  // rótulos das abas (% executado de cada andar)
  document.querySelectorAll('#av-abas .mo-frente-btn').forEach(b => {
    const m = /selecionarAbaAvanco\('(\w+)'/.exec(b.getAttribute('onclick') || ''); if (!m || m[1] === 'R') return;
    const rr = resumoAba(m[1]), v = b.querySelector('.mo-frente-val'); if (v && rr.peso) v.textContent = fmtP2(rr.exec / rr.peso * 100);
  });
}

function buildAvancoTabela() {
  const tb = document.getElementById('av-tbody');
  tb.innerHTML = '';
  etapasDaAba(abaAvanco).forEach(({ item, x }) => {
    const tr = document.createElement('tr');
    tr.dataset.ordem = item.id; tr.dataset.a = x.a;
    const nome = x.a === 'CX' ? NOME_ETAPA.CX + ' <span style="font-size:11px;color:var(--text3)">(' + esc(item.desc.split(' — ')[0]) + ')</span>' : esc(item.desc);
    tr.innerHTML = `
      <td style="color:var(--text3);font-size:12px">${item.id}</td>
      <td>${nome}<div class="av-prev" style="font-size:11px;color:var(--text2);margin-top:2px"></div></td>
      <td class="right" style="color:var(--text2)" title="peso desta etapa dentro do item (${fmtP2(item.pciPct)} da obra)">${x.p}%</td>
      <td class="right" style="color:var(--green)">${x.m}%</td>
      <td class="center"><input type="number" class="av-inp" min="${x.m}" max="100" step="1" value="${x.e}" ${podeEditar ? '' : 'disabled'}
           style="width:72px;text-align:right;padding:5px 6px;font-size:13px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)"></td>
      <td class="right av-item"></td>
      <td class="right av-obra"></td>
      <td class="right av-medir" style="font-weight:600"></td>`;
    const inp = tr.querySelector('.av-inp');
    inp.addEventListener('input', () => atualizarLinhaAvanco(tr, item, x, inp.value));
    inp.addEventListener('change', () => gravarEtapa(item, x, inp.value, inp));
    tb.appendChild(tr);
    atualizarLinhaAvanco(tr, item, x, x.e);
  });
}

/* recalcula a linha enquanto o % é digitado (sem gravar) */
function atualizarLinhaAvanco(tr, item, x, valor) {
  const e = Math.min(100, Math.max(0, parseFloat(String(valor).replace(',', '.')) || 0));
  const doItem = x.p * e / 100, obra = naObra(item, x, e), medir = aMedirEt(item, x, e);
  tr.querySelector('.av-item').textContent  = fmtP2(doItem) + ' do item';
  tr.querySelector('.av-obra').textContent  = fmtP2(obra) + ' da obra';
  tr.querySelector('.av-medir').textContent = medir > 0 ? '+' + fmtP2(medir) + (isAdmin ? ' ≈ ' + fmt(medir / 100 * BASE_OBRA) : '') : '—';
  const prev = tr.querySelector('.av-prev');
  if (e < x.m) {
    prev.innerHTML = `⚠️ Não pode ser menor que o já medido pela CAIXA (${x.m}%).`;
  } else if (e !== x.e) {
    const nome = x.a === 'CX' ? NOME_ETAPA.CX : esc(item.desc.split(' — ')[0].split(' (')[0]) + ' no ' + NOME_ETAPA[x.a].toLowerCase();
    prev.innerHTML = `${e}% de ${nome} = <strong>${fmtP2(doItem)}</strong> do item = <strong>${fmtP2(obra)}</strong> da obra` +
      (medir > 0 ? ` · a medir <strong>+${fmtP2(medir)}</strong>` + (isAdmin ? ` ≈ <strong>${fmt(medir / 100 * BASE_OBRA)}</strong>` : '') : '') +
      ' <span style="color:var(--text3)">(salva ao sair do campo)</span>';
  } else {
    prev.innerHTML = '';
  }
}

function gravarEtapa(item, x, valor, inp) {
  if (!podeEditar) return;
  const e = r2(Math.min(100, Math.max(0, parseFloat(String(valor).replace(',', '.')) || 0)));
  const msg = document.getElementById('av-msg');
  if (e < x.m) { msg.textContent = `${item.desc}: o % não pode ser menor que o já medido (${x.m}%).`; msg.className = 'msg error'; inp.value = x.e; atualizarLinhaAvanco(inp.closest('tr'), item, x, x.e); return; }
  if (e === x.e) return;
  const ant = x.e, obraAntes = naObra(item, x, ant);
  x.e = e;
  const execAnt = item.exec;
  item.exec = Math.max(medidoDe(item), pctItemDe(item.andares, 'e'));
  if (item.andares.every(y => y.e === y.m)) item.exec = medidoDe(item);
  item.novo = false;
  const delta = naObra(item, x, e) - obraAntes;
  const nomeEt = x.a === 'CX' ? NOME_ETAPA.CX : NOME_ETAPA[x.a];
  historico.push({ data: new Date().toLocaleDateString('pt-BR'),
    desc: `${item.desc} — ${nomeEt}: ${ant}% → ${e}% (item ${execAnt}% → ${item.exec}%)`,
    deltaPct: delta, deltaVal: delta / 100 * BASE_OBRA, prev: false, obs: '' });
  msg.textContent = `✓ ${nomeEt} · ${item.desc.split(' — ')[0]}: ${e}% → ${delta >= 0 ? '+' : ''}${fmtP2(delta)} da obra` +
    (isAdmin ? ` (${delta >= 0 ? '+' : ''}${fmt(delta / 100 * BASE_OBRA)})` : '');
  msg.className = 'msg';
  atualizarLinhaAvanco(inp.closest('tr'), item, x, e);
  _avParcial = true;
  try { salvar(); buildTable(); buildLog(); } finally { _avParcial = false; }
}

/* ── resumo por pavimento + editor de pesos ─────────────────────── */
function buildResumoAndares() {
  const tb = document.getElementById('av-res-tbody');
  tb.innerHTML = '';
  const tot = { peso:0, exec:0, med:0, aMedir:0 };
  PAVIMENTOS.forEach(pv => {
    const r = resumoAba(pv.id);
    if (!r.peso) return;
    Object.keys(tot).forEach(k => tot[k] += r[k]);
    const tr = document.createElement('tr');
    tr.className = 'mo-resumo-linha';
    tr.onclick = () => selecionarAbaAvanco(pv.id);
    tr.innerHTML = `
      <td style="font-weight:500">${esc(pv.nome)}</td>
      <td class="right">${fmtP2(r.peso)}</td>
      <td class="right">${fmtP2(r.exec / r.peso * 100)} <span style="color:var(--text3);font-size:11px">(${fmtP2(r.exec)} da obra)</span></td>
      <td class="right" style="color:var(--green)">${fmtP2(r.med / r.peso * 100)} <span style="color:var(--text3);font-size:11px">(${fmtP2(r.med)})</span></td>
      <td class="right" style="font-weight:600">+${fmtP2(r.aMedir)}</td>
      <td class="right admin-only" style="font-weight:600">${fmt(r.aMedir / 100 * BASE_OBRA)}</td>`;
    tb.appendChild(tr);
  });
  document.getElementById('av-res-peso').textContent  = fmtP2(tot.peso);
  document.getElementById('av-res-exec').textContent  = fmtP2(tot.exec);
  document.getElementById('av-res-med').textContent   = fmtP2(tot.med);
  document.getElementById('av-res-medir').textContent = '+' + fmtP2(tot.aMedir);
  document.getElementById('av-res-val').textContent   = fmt(tot.aMedir / 100 * BASE_OBRA);

  // pesos de cada item entre os pavimentos (só itens divididos em mais de uma etapa)
  const cols = ['T', 'P1', 'P2', 'CX', 'G'];
  const tp = document.getElementById('av-pesos-tbody');
  tp.innerHTML = '';
  itens.forEach(item => {
    const tr = document.createElement('tr');
    tr.dataset.ordem = item.id;
    const pesoDe = a => (item.andares.find(x => x.a === a) || {}).p;
    tr.innerHTML = `<td style="color:var(--text3);font-size:12px">${item.id}</td><td>${esc(item.desc)}</td>` +
      cols.map(a => {
        const v = pesoDe(a);
        return `<td class="center"><input type="number" class="av-peso" data-a="${a}" min="0" max="100" step="0.01" value="${v == null ? '' : v}" placeholder="—" ${podeEditar ? '' : 'disabled'}
          style="width:64px;text-align:right;padding:4px 5px;font-size:12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)"></td>`;
      }).join('') + `<td class="right av-soma" style="font-size:12px"></td>`;
    const soma = () => {
      const t = r2([...tr.querySelectorAll('.av-peso')].reduce((s, i) => s + (parseFloat(i.value) || 0), 0));
      const c = tr.querySelector('.av-soma');
      c.textContent = t + '%'; c.style.color = Math.abs(t - 100) > 0.05 ? 'var(--red)' : 'var(--text3)';
    };
    tr.querySelectorAll('.av-peso').forEach(i => i.addEventListener('input', soma));
    tp.appendChild(tr); soma();
  });
}

function salvarPesosAndares() {
  if (!podeEditar) return;
  const msg = document.getElementById('av-pesos-msg');
  const novos = [];
  for (const tr of document.querySelectorAll('#av-pesos-tbody tr')) {
    const item = itens.find(i => i.id === +tr.dataset.ordem); if (!item) continue;
    const et = [...tr.querySelectorAll('.av-peso')].map(i => ({ a: i.dataset.a, p: r2(parseFloat(i.value) || 0) })).filter(x => x.p > 0);
    const soma = r2(et.reduce((s, x) => s + x.p, 0));
    if (Math.abs(soma - 100) > 0.05) { msg.textContent = `Item ${item.id} (${item.desc}): os pesos somam ${soma}%, precisam somar 100%.`; msg.className = 'msg error'; return; }
    novos.push({ item, et });
  }
  let mudou = 0;
  novos.forEach(({ item, et }) => {
    const igual = et.length === item.andares.length && et.every(x => { const y = item.andares.find(z => z.a === x.a); return y && y.p === x.p; });
    if (igual) return;
    mudou++;
    // mantém o % de cada pavimento que continua existindo; o medido é redistribuído para bater com a CAIXA
    const nova = et.map(x => { const y = item.andares.find(z => z.a === x.a) || {}; return { a:x.a, p:x.p, e:+y.e || 0, m:0 }; });
    distribuir(nova, medidoDe(item), 'm');
    nova.forEach(x => { if (x.e < x.m) x.e = x.m; });
    item.andares = nova;
    item.exec = Math.max(medidoDe(item), pctItemDe(nova, 'e'));
    if (nova.every(x => x.e === x.m)) item.exec = medidoDe(item);
  });
  if (!mudou) { msg.textContent = 'Nenhum peso alterado.'; msg.className = 'msg'; return; }
  historico.push({ data: new Date().toLocaleDateString('pt-BR'), desc: `Pesos por pavimento ajustados (${mudou} item${mudou > 1 ? 's' : ''})`,
    deltaPct: 0, deltaVal: 0, prev: false, obs: '' });
  msg.textContent = `✓ Pesos salvos (${mudou} item${mudou > 1 ? 's' : ''}).`; msg.className = 'msg';
  salvar(); buildTable(); buildLog();
}
