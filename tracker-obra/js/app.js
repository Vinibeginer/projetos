/* ══ TEMA CLARO / ESCURO ═══════════════════════════════════ */
function temaAtual() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}
function aplicarTema(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('tracker_tema', t); } catch(e) {}
  document.querySelectorAll('.btn-tema').forEach(b => {
    b.textContent = (t === 'dark') ? '☀️' : '🌙';
    b.title = (t === 'dark') ? 'Mudar para tema claro' : 'Mudar para tema escuro';
  });
}
function toggleTema() { aplicarTema(temaAtual() === 'dark' ? 'light' : 'dark'); }

function numBR(s) {
  const t = String(s || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const v = parseFloat(t);
  return isFinite(v) ? v : 0;
}
/* ══ AUTENTICAÇÃO ══════════════════════════════════════════ */
let isAdmin = false;

function iniciarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  aplicarPerfil();
  carregar();
  normalizarTodosAndares();
  buildSelect();
  buildTable();
  buildLog();
  atualizarTimestamp();
  iniciarAppMO();
  buildVersoes();
}

function aplicarPerfil() {
  const badge = document.getElementById('badge-role');
  if (isAdmin) {
    badge.textContent = 'Administrador';
    badge.className   = 'badge-role badge-admin';
  } else {
    badge.textContent = 'Visitante';
    badge.className   = 'badge-role badge-visitor';
  }
  // tabs admin
  document.querySelectorAll('.admin-tab').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  // cards/botões admin-only
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
}

/* ══ DADOS ══════════════════════════════════════════════════ */
// itens da PLS CAIXA (20 itens, somam 100%) — valores da obra original, usados só na importação do navegador antigo
const ITENS_DEFAULT = [
  { id:1 , desc:'Serviços preliminares e gerais (barracão + ligações prov.)', pciPct:3.64, exec:100, locked:true, prevExec:0, medido:100, obs:'100% medido na 1ª medição CAIXA.' },
  { id:2 , desc:'Infraestrutura (sapatas, baldrames)', pciPct:7.07, exec:100, locked:true, prevExec:0, medido:100, obs:'100% medido na 1ª medição CAIXA.' },
  { id:3 , desc:'Supraestrutura — pilares, vigas e escada interna (3 pav.)', pciPct:14.56, exec:35, locked:true, prevExec:0, medido:35, obs:'35% conforme PLS 2ª medição (03/07/2026).' },
  { id:4 , desc:'Paredes e alvenaria — térreo, 1º e 2º pavimento', pciPct:8.14, exec:40, locked:true, prevExec:0, medido:40, obs:'40% conforme PLS 2ª medição (03/07/2026).' },
  { id:5 , desc:'Esquadrias (22 portas + 18 janelas)', pciPct:4.71, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:6 , desc:'Vidros, plásticos e guarda-corpos', pciPct:1.07, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:7 , desc:'Cobertura (telhas, platibanda, laje 2ºpav)', pciPct:2.57, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:8 , desc:'Impermeabilizações', pciPct:2.57, exec:60, locked:true, prevExec:0, medido:60, obs:'60% conforme PLS 2ª medição (03/07/2026).' },
  { id:9 , desc:'Revestimentos internos (chapisco + reboco)', pciPct:8.14, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:10, desc:'Forros', pciPct:1.28, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:11, desc:'Revestimentos externos e fachada', pciPct:4.07, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:12, desc:'Pinturas', pciPct:4.71, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:13, desc:'Pisos e rodapés (~205m²)', pciPct:10.28, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:14, desc:'Acabamentos (soleiras, peitoris)', pciPct:1.28, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:15, desc:'Instalações elétricas (3 pavimentos)', pciPct:4.07, exec:30, locked:true, prevExec:0, medido:30, obs:'30% conforme PLS 2ª medição (03/07/2026).' },
  { id:16, desc:'Instalações hidráulicas (3 pavimentos)', pciPct:4.07, exec:20, locked:true, prevExec:0, medido:20, obs:'20% conforme PLS 2ª medição (03/07/2026).' },
  { id:17, desc:'Instalações de esgoto e águas pluviais', pciPct:4.07, exec:30, locked:true, prevExec:0, medido:30, obs:'30% conforme PLS 2ª medição (03/07/2026).' },
  { id:18, desc:'Louças e metais', pciPct:4.71, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:19, desc:'Complementos (limpeza, calafete)', pciPct:1.50, exec:0, locked:false, prevExec:0, medido:0, obs:'' },
  { id:20, desc:'Outros serviços (muro frontal, documentação)', pciPct:7.49, exec:20, locked:true, prevExec:0, medido:20, obs:'20% conforme PLS 2ª medição (03/07/2026).' },
];

const HISTORICO_DEFAULT = [
  { data:'30/05/2026', desc:'1ª Medição CAIXA — serviços preliminares + infraestrutura', deltaPct:8.23, deltaVal:30623, prev:false, obs:'Doc 662250 · Ag. 4437. PCI teórico desses itens: 10,71% — CAIXA mediu 8,23% pelo critério interno.' },
  { data:'12/06/2026', desc:'Esgoto: ramais PVC, caixas sifonadas, caixa de inspeção externa', deltaPct:0, deltaVal:0, prev:false, obs:'Relatório Barros Rezende. Andamento parcial.' },
  { data:'19/06/2026', desc:'Esgoto sanitário térreo 100% concluído (caixa de gordura + ligação rede pública)', deltaPct:2.70, deltaVal:10068, prev:false, obs:'~66% do item 17 (esgoto+pluviais). Esgoto 1ºpav aguarda laje. Pluviais pendentes.' },
  { data:'19/06/2026', desc:'Padrão de energia instalado (elétrica 10%)', deltaPct:0.41, deltaVal:1529, prev:false, obs:'Poste padrão + instalação elétrica. Falta infra interna 3 pavimentos.' },
  { data:'22/06/2026', desc:'Hidráulica zerada: nenhum ramal executado (correção de lançamento)', deltaPct:0, deltaVal:0, prev:false, obs:'Item 16 corrigido para 0% — ramais internos não executados.' },
  { data:'22/06–18/07/2026', desc:'[Previsão] Entijolamento (alvenaria) + enchimento de colunas (pilares)', deltaPct:6.08, deltaVal:22671, prev:true, obs:'Alvenaria 30% + supraestrutura 25% — distribuído ao longo de ~4 semanas. Não é avanço de uma semana única.' },
  { data:'03/07/2026', desc:'PLS 2ª medição entregue — acumulado 25,35% (17,12% nesta etapa)', deltaPct:17.12, deltaVal:63701.54, prev:false, obs:'PLS assinada pelo RT João Carlos e por Vinícius em 06/07/2026. Supra 35% + Alvenaria 40% + Impermeab. 60% + Elétrica 30% + Hidráulica 20% + Esgoto 30% + Outros 20%.' },
];

let itens     = [];
let historico = [];

function salvar() {
  espelharLocal(); atualizarTimestamp(); sincronizarNuvem();
}
function carregar() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try { const s = JSON.parse(raw); if (s.itens) itens = s.itens; if (s.historico) historico = s.historico; } catch(e) {}
}
function atualizarTimestamp() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const { savedAt } = JSON.parse(raw);
    if (savedAt) {
      const d = new Date(savedAt);
      document.getElementById('last-update').textContent = 'Salvo ' + d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    }
  } catch(e){}
}

/* ══ FORMATAÇÃO ══════════════════════════════════════════════ */
const fmt  = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const fmtP = v => (Math.round(v * 10) / 10).toFixed(1) + '%';

/* visitante vê só % */
function dispVal(v, unit='R$') {
  if (isAdmin) return unit === '%' ? fmtP(v) : fmt(v);
  return '<span class="blurred-val">' + (unit === '%' ? fmtP(v) : fmt(v)) + '</span>';
}

/* ══ MEDIDO × ESTIMADO ═══════════════════════════════════════ */
/* medido = % do item já medido e pago pela CAIXA; exec = % estimado atual (≥ medido) */
function medidoDe(i)  { return i.medido != null ? +i.medido : (i.locked ? +i.exec : 0); }
function avancoDe(i)  { return Math.max(0, (+i.exec || 0) - medidoDe(i)); }      // % do item a medir
function avancoObra(i){ return i.pciPct * avancoDe(i) / 100; }                    // % da obra a medir

/* ══ BUILD TABLE ═════════════════════════════════════════════ */
function buildTable() {
  // cabeçalho dinâmico
  const thead = document.getElementById('tabela-thead');
  if (isAdmin) {
    thead.innerHTML = `<tr>
      <th style="width:24px">#</th><th>Serviço (PCI CAIXA)</th>
      <th class="right" style="width:60px">% PCI</th>
      <th class="right" style="width:90px">Valor PCI</th>
      <th class="center" style="width:115px">Status</th>
      <th class="center" style="width:60px">Exec.</th>
      <th style="min-width:90px">Progresso</th>
    </tr>`;
    document.getElementById('tfoot-pci-col').textContent = '';
  } else {
    thead.innerHTML = `<tr>
      <th style="width:24px">#</th><th>Serviço</th>
      <th class="center" style="width:115px">Status</th>
      <th class="center" style="width:60px">Exec.</th>
      <th style="min-width:100px">Progresso</th>
    </tr>`;
  }

  const tb = document.getElementById('itens-tbody');
  tb.innerHTML = '';
  itens.forEach(item => {
    const [cls, lbl] = statusBadge(item);
    const isPrev = item.prevExec > 0 && item.exec === 0;
    const color  = barColor(item);
    const barHTML = isPrev
      ? `<div class="bar-bg"><div class="bar-stripe" style="width:${item.prevExec}%"></div></div>`
      : `<div class="bar-bg"><div class="bar-fill" style="width:100%;background:linear-gradient(90deg,#1D9E75 0 ${medidoDe(item)}%,${color} ${medidoDe(item)}% ${item.exec}%,transparent ${item.exec}%)"></div></div>`;
    const execLabel = isPrev
      ? `<em style="color:var(--text3)">${item.prevExec}%*</em>`
      : `<span style="color:${item.exec>0?'var(--blue)':'var(--text3)'}">${item.exec}%</span>`;
    const novoBadge = item.novo ? ' <span style="font-size:10px;background:var(--amber-bg);color:var(--amber);padding:1px 5px;border-radius:8px;font-weight:600;">novo</span>' : '';
    const obsAttr   = item.obs && isAdmin ? ` title="${esc(item.obs)}"` : '';
    const tr = document.createElement('tr');
    tr.style.opacity = item.exec === 0 && !isPrev ? '0.45' : '1';
    if (item.novo) tr.style.background = '#FAEEDA22';

    if (isAdmin) {
      tr.innerHTML = `
        <td style="color:var(--text3);font-size:12px">${item.id}</td>
        <td${obsAttr}>${esc(item.desc)}${novoBadge}${isPrev?' <span style="font-size:11px;color:var(--text3)">(prev.)</span>':''}</td>
        <td class="right" style="color:var(--text2)">${fmtP(item.pciPct)}</td>
        <td class="right" style="color:var(--text2)">${fmt(item.pciPct/100*ORCAMENTO)}</td>
        <td class="center"><span class="badge ${cls}">${lbl}</span></td>
        <td class="center">${execLabel}</td>
        <td>${barHTML}</td>`;
    } else {
      tr.innerHTML = `
        <td style="color:var(--text3);font-size:12px">${item.id}</td>
        <td>${esc(item.desc)}${isPrev?' <span style="font-size:11px;color:var(--text3)">(prev.)</span>':''}</td>
        <td class="center"><span class="badge ${cls}">${lbl}</span></td>
        <td class="center">${execLabel}</td>
        <td>${barHTML}</td>`;
    }
    tb.appendChild(tr);
  });
  recalcular();
}

function statusBadge(item) {
  const m = medidoDe(item);
  if (m >= 100) return ['b-medido','Medido ✓'];
  if (item.exec > m) return ['b-novo', 'Estimado ' + item.exec + '%'];
  if (item.prevExec > item.exec) return ['b-previsao','Previsão '+item.prevExec+'%'];
  if (m > 0) return ['b-medido','Medido ' + m + '%'];
  if (item.novo   && item.exec > 0)   return ['b-novo','Novo '+item.exec+'%'];
  if (item.prevExec > 0 && item.exec===0) return ['b-previsao','Previsão '+item.prevExec+'%'];
  if (item.exec===100) return ['b-concluido','Concluído'];
  if (item.exec > 0)  return ['b-parcial','Parcial '+item.exec+'%'];
  return ['b-pendente','Pendente'];
}
function barColor(item) {
  if (avancoDe(item) > 0) return '#EF9F27';
  if (medidoDe(item) > 0) return '#1D9E75';
  if (item.novo)         return '#EF9F27';
  if (item.exec===100)   return '#378ADD';
  if (item.exec > 0)     return '#BA7517';
  return 'transparent';
}

/* ══ RECALCULAR ══════════════════════════════════════════════ */
function recalcular() {
  // execAcum = % físico estimado da obra (medido + estimado)
  // prevAcum = execNovo + previsões pendentes
  // execNovo = avanço estimado ainda não medido (peso × (exec − medido))
  // prevAcum = execNovo + previsões acima do estimado
  let execAcum = 0, execNovo = 0, prevAcum = 0;
  itens.forEach(i => {
    execAcum += i.pciPct * i.exec / 100;
    execNovo += avancoObra(i);
    prevAcum += avancoObra(i) + i.pciPct * Math.max(0, Math.min(i.prevExec, 100) - Math.max(i.exec, medidoDe(i))) / 100;
  });

  // % CAIXA = % PCI (validado com Medição 1 e 2: valor liberado = % PCI da etapa × BASE_OBRA, sem fator de conversão)
  const execNovoCaixa = execNovo;                    // executado não medido → estimativa próx. medição
  const prevCaixa     = prevAcum;                    // com previsões incluídas
  const novoVal       = execNovoCaixa / 100 * BASE_OBRA;
  const prevAdic      = Math.max(0, (prevCaixa - execNovoCaixa) / 100 * BASE_OBRA);
  const execVal       = execNovo / 100 * BASE_OBRA;

  // cards
  document.getElementById('c-exec').textContent     = fmtP(execNovo);
  document.getElementById('c-exec-sub').textContent = isAdmin
    ? `~${fmt(execVal)} · → ${fmtP(execNovoCaixa)} CAIXA`
    : `→ ${fmtP(execNovoCaixa)} CAIXA estimado`;

  document.getElementById('c-novo').textContent    = '~' + fmtP(execNovoCaixa);
  document.getElementById('c-novo-sub').innerHTML  = isAdmin
    ? `~${fmt(novoVal)} · % PCI executado · só executados`
    : '% PCI executado · só itens executados';

  if (isAdmin) {
    const saldoConfirmado = BASE_OBRA - MED_VAL;
    document.getElementById('c-saldo').textContent         = fmt(saldoConfirmado);
    document.getElementById('c-total-lib').textContent     = fmt(MED_VAL);
    document.getElementById('c-total-lib-sub').textContent = fmtP(MED_VAL/BASE_OBRA*100) + '% confirmado · ' + fmt(saldoConfirmado) + ' a liberar';
  }

  document.getElementById('tfoot-exec').textContent = fmtP(execAcum);

  // barra — confirmado | executado não medido | previsão (só admin)
  const m = Math.min(window.MED_PCT_ATUAL ?? MED_PCT, 100);
  const e = Math.min(execNovoCaixa, 100 - m);
  const p = isAdmin ? Math.min(Math.max(0, prevCaixa - execNovoCaixa), 100 - m - e) : 0;
  document.getElementById('bar-medido').style.width = m + '%';
  document.getElementById('bar-medido').textContent = m > 5 ? fmtP(m) + ' ✓' : '';
  document.getElementById('bar-exec').style.left    = m + '%';
  document.getElementById('bar-exec').style.width   = e + '%';
  document.getElementById('bar-exec').textContent   = e > 4 ? '~' + fmtP(e) : '';
  document.getElementById('bar-prev').style.left    = (m+e) + '%';
  document.getElementById('bar-prev').style.width   = p + '%';

  // labels abaixo da barra (sempre visíveis, inclusive mobile)
  const lbMed  = document.getElementById('bar-label-med');
  const lbExec = document.getElementById('bar-label-exec');
  if (lbMed)  lbMed.textContent  = `✓ ${fmtP(m)} confirmado`;
  if (lbExec) lbExec.textContent = e > 0 ? `~${fmtP(e)} executado (CAIXA)` : '';

  // previsões rápidas só para admin
  const prevEl = document.getElementById('previsoes-rapidas');
  if (prevEl) prevEl.closest('.form-card') && (prevEl.closest('.form-card').style.display = isAdmin ? '' : 'none');

  if (isAdmin) buildMedicao(execNovo, execNovoCaixa, novoVal);
  buildPrevisaoRapida();
  buildEstimativas();
  buildAvancoAndares();
}

function buildMedicao(execNovo, execNovoCaixa, novoVal) {
  const tb = document.getElementById('medicao-tbody');
  tb.innerHTML = '';
  itens.forEach(item => {
    const base     = Math.max(item.exec, medidoDe(item));
    const isPrev   = avancoDe(item) === 0 && item.prevExec > base;
    if (avancoDe(item) === 0 && !isPrev) return;   // nada a medir neste item
    const execPct  = avancoObra(item);
    const execCaixa= execPct;
    const prevPct  = isPrev ? item.pciPct * (item.prevExec - base) / 100 : 0;
    const prevCaixa= prevPct;
    const [cls,lbl]= statusBadge(item);
    const tr = document.createElement('tr');
    tr.style.background = isPrev ? 'var(--surface2)' : '';
    tr.innerHTML = `
      <td style="color:var(--text3);font-size:12px">${item.id}</td>
      <td>${esc(item.desc)}${isPrev?' <em style="font-size:11px;color:var(--text3)">(previsão)</em>':''}</td>
      <td class="right" style="color:var(--text2)">${fmtP(item.pciPct)}</td>
      <td class="right" style="font-weight:500;color:${isPrev?'var(--text3)':'var(--blue)'}">
        ${isPrev ? fmtP(prevPct) : fmtP(execPct)}
      </td>
      <td class="right" style="font-weight:600;color:${isPrev?'var(--text3)':'var(--amber)'}">
        ~${fmtP(isPrev ? prevCaixa : execCaixa)}
      </td>
      <td class="right" style="font-weight:500;color:${isPrev?'var(--text3)':'inherit'}">
        ${isPrev ? '~'+fmt(prevCaixa/100*BASE_OBRA) : '~'+fmt(execCaixa/100*BASE_OBRA)}
      </td>
      <td><span class="badge ${cls}">${lbl}</span></td>`;
    tb.appendChild(tr);
  });
  document.getElementById('med-total-pct').textContent = fmtP(execNovo);
  document.getElementById('med-total-val').textContent  = fmt(execNovo/100*BASE_OBRA);
  document.getElementById('med-novo-pct').textContent  = '~' + fmtP(execNovoCaixa);
  document.getElementById('med-novo-val').textContent  = '~' + fmt(novoVal);
}

function buildPrevisaoRapida() {
  if (!isAdmin) return;
  const el = document.getElementById('previsoes-rapidas');
  const prev = itens.filter(i => i.prevExec > Math.max(i.exec, medidoDe(i)));
  if (!prev.length) { el.innerHTML = '<p class="empty">Nenhuma previsão registrada.</p>'; return; }
  el.innerHTML = prev.map(i => `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <span style="flex:1;color:var(--text2)">${esc(i.desc)} — previsão ${i.prevExec}%</span>
      <button class="btn btn-success btn-sm" onclick="confirmarPrevisao(${i.id})">Confirmar</button>
      <button class="btn btn-ghost btn-sm"   onclick="cancelarPrevisao(${i.id})">Cancelar</button>
    </div>`).join('');
}

function buildEstimativas() {
  const tb = document.getElementById('est-tbody');
  if (!tb) return;
  const lista = itens.filter(i => avancoDe(i) > 0);
  const vis = isAdmin ? '' : 'display:none';
  tb.innerHTML = lista.length ? '' :
    `<tr><td colspan="8" class="empty">Nenhuma estimativa de avanço. Digite o % executado de uma etapa nas abas de pavimento acima.</td></tr>`;
  let tPct = 0;
  lista.forEach(i => {
    const av = avancoObra(i); tPct += av;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--text3);font-size:12px">${i.id}</td>
      <td>${esc(i.desc)}${(i.andares || []).filter(x => x.e > x.m).map(x =>
        `<div style="font-size:11px;color:var(--text2)">${esc(nomeEtapa(i, x.a))}: ${x.m}% → ${x.e}%</div>`).join('')}</td>
      <td class="right" style="color:var(--text2)">${fmtP(i.pciPct)}</td>
      <td class="right" style="color:var(--green)">${medidoDe(i)}%</td>
      <td class="right" style="font-weight:600;color:var(--amber)">${i.exec}%</td>
      <td class="right">+${fmtP(av)}</td>
      <td class="right" style="font-weight:600;${vis}">~${fmt(av / 100 * BASE_OBRA)}</td>
      <td class="center" style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="editarEstimativa(${i.id})">Editar</button>
        <button class="btn btn-ghost btn-sm" onclick="excluirEstimativa(${i.id})" style="color:var(--red);border-color:var(--red);">Excluir</button>
      </td>`;
    tb.appendChild(tr);
  });
  document.getElementById('est-total-pct').textContent = '+' + fmtP(tPct);
  document.getElementById('est-total-val').textContent = '~' + fmt(tPct / 100 * BASE_OBRA);
  document.getElementById('est-excluir-todas').style.visibility = lista.length ? 'visible' : 'hidden';
}

/* abre o pavimento onde está o avanço estimado do item e põe o cursor no campo */
function editarEstimativa(id) {
  const item = itens.find(i => i.id === id); if (!item) return;
  const x = (item.andares || []).find(y => y.e > y.m) || (item.andares || [])[0];
  if (!x) return;
  selecionarAbaAvanco(ABA_DA_ETAPA[x.a]);
  const inp = document.querySelector(`#av-tbody tr[data-ordem="${id}"][data-a="${x.a}"] .av-inp`);
  if (inp) { inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); inp.focus(); inp.select(); }
}

function excluirEstimativa(id) {
  const item = itens.find(i => i.id === id); if (!item) return;
  const m = medidoDe(item), ant = item.exec;
  if (!confirm(`Excluir a estimativa de "${item.desc}"?\n\nO item volta para ${m}% (o que a CAIXA já mediu).`)) return;
  item.exec = m; item.novo = false;
  (item.andares || []).forEach(x => { x.e = x.m; });
  const delta = item.pciPct * (m - ant) / 100;
  historico.push({ data: new Date().toLocaleDateString('pt-BR'), desc: `Estimativa excluída: ${item.desc} (${ant}% → ${m}%)`,
    deltaPct: delta, deltaVal: delta / 100 * BASE_OBRA, prev: false, obs: '' });
  salvar(); buildSelect(); buildTable(); buildLog();
}

function excluirTodasEstimativas() {
  const lista = itens.filter(i => avancoDe(i) > 0);
  if (!lista.length) return;
  if (!confirm(`Excluir as ${lista.length} estimativas de avanço?\n\nCada item volta para o % já medido pela CAIXA.`)) return;
  const delta = -lista.reduce((s, i) => s + avancoObra(i), 0);
  lista.forEach(i => { i.exec = medidoDe(i); i.novo = false; (i.andares || []).forEach(x => { x.e = x.m; }); });
  historico.push({ data: new Date().toLocaleDateString('pt-BR'), desc: `Estimativas excluídas (${lista.length} itens)`,
    deltaPct: delta, deltaVal: delta / 100 * BASE_OBRA, prev: false, obs: lista.map(i => i.desc).join(' · ') });
  salvar(); buildSelect(); buildTable(); buildLog();
}

/* ao confirmar uma medição: o estimado de cada item passa a ser o medido */
function consolidarEstimativas() {
  itens.forEach(i => {
    i.medido = Math.max(medidoDe(i), +i.exec || 0); i.locked = i.medido > 0; i.novo = false;
    (i.andares || []).forEach(x => { x.m = Math.max(x.m, x.e); });
  });
}

function buildLog() {
  const el = document.getElementById('log-container');
  if (!historico.length) { el.innerHTML = '<p class="empty">Nenhum registro.</p>'; return; }
  el.innerHTML = '';
  historico.slice().reverse().forEach(h => {
    const d = document.createElement('div');
    d.className = 'log-entry';
    const obsHtml = h.obs && isAdmin ? `<br><span style="font-size:11px;color:var(--text3)">${esc(h.obs)}</span>` : '';
    const valHtml = isAdmin && h.deltaVal > 0 ? `<span class="log-val">${fmt(h.deltaVal)}</span>` : '';
    d.innerHTML = `
      <span class="log-date">${esc(h.data)}</span>
      <span class="log-desc">${esc(h.desc)}${obsHtml}</span>
      ${h.deltaPct > 0 ? `<span class="${h.prev?'log-prev':'log-pct'}">${h.prev?'(prev.) ':''}+${fmtP(h.deltaPct)}</span>` : ''}
      ${valHtml}`;
    el.appendChild(d);
  });
}

function buildSelect() {
  const sel = document.getElementById('inp-item');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecionar serviço...</option>';
  itens.forEach(item => {
    const o = document.createElement('option');
    o.value = item.id;
    const m = medidoDe(item);
    o.textContent = `${item.id}. ${item.desc}` + (m > 0 ? ` (medido ${m}%)` : '') + (item.exec > m ? ` · estimado ${item.exec}%` : '');
    sel.appendChild(o);
  });
}

/* ══ AÇÕES ADMIN ════════════════════════════════════════════ */
function confirmarPrevisao(id) {
  const item = itens.find(i=>i.id===id); if(!item) return;
  const ant = item.exec;
  item.exec = Math.max(item.exec, medidoDe(item), item.prevExec);
  item.prevExec=0; item.novo=false;
  const delta = item.pciPct*(item.exec-ant)/100;
  historico.push({ data:new Date().toLocaleDateString('pt-BR'), desc:`${item.desc} confirmado (${ant}% → ${item.exec}%)`, deltaPct:delta, deltaVal:delta/100*BASE_OBRA, prev:false, obs:'Confirmado via ação rápida' });
  salvar(); buildSelect(); buildTable(); buildLog();
}
function cancelarPrevisao(id) {
  const item = itens.find(i=>i.id===id); if(item){item.prevExec=0;} salvar(); buildTable();
}
function limparPrevisoes() {
  itens.forEach(i=>{i.prevExec=0;}); historico=historico.filter(h=>!h.prev);
  salvar(); buildTable(); buildLog();
}
function confirmarLimparHistorico() {
  if(confirm('Apagar TODO o histórico desta obra? Esta ação não pode ser desfeita.')) {
    historico=[]; salvar(); buildLog();
  }
}
function exportarDados() {
  const blob = new Blob([JSON.stringify({itens,historico,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
  const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'tracker_obra_vinicius_'+new Date().toISOString().slice(0,10)+'.json'});
  a.click(); URL.revokeObjectURL(a.href);
}
function importarDados() {
  const input = Object.assign(document.createElement('input'),{type:'file',accept:'.json'});
  input.onchange = e => {
    const r = new FileReader();
    r.onload = ev => {
      try { const s=JSON.parse(ev.target.result); if(s.itens)itens=s.itens; if(s.historico)historico=s.historico; salvar();buildTable();buildLog();buildSelect();alert('Importado!'); } catch(err){alert('Arquivo inválido.');}
    };
    r.readAsText(e.target.files[0]);
  };
  input.click();
}

/* ══ TABS ════════════════════════════════════════════════════ */
function showTab(t, el) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  el.classList.add('active');
  if(t==='historico') buildLog();
  if(t==='versoes')   buildVersoes();
  if(t==='medicao')   buildMedicoesConfirmadas();
}
