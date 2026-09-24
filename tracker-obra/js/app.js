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
  buildSelect();
  buildTable();
  buildLog();
  atualizarTimestamp();
  document.getElementById('inp-data').value = new Date().toISOString().split('T')[0];
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
const ITENS_DEFAULT = [
  { id:1,   desc:'Serviços preliminares e gerais (barracão + ligações prov.)', pciPct:3.64,  exec:100, locked:true,  prevExec:0, obs:'100% concluído — medido na 1ª medição CAIXA.' },
  { id:2,   desc:'Infraestrutura (sapatas, baldrames)',                        pciPct:7.07,  exec:100, locked:true,  prevExec:0, obs:'100% concluído — medido na 1ª medição CAIXA.' },
  { id:3,   desc:'Supraestrutura — pilares, vigas e escada interna (3 pav.)', pciPct:14.56, exec:35,  locked:true,  prevExec:0, obs:'35% conforme PLS assinada pelo RT (03/07/2026) — medido e pago na 2ª medição CAIXA. PLS é a fonte oficial de avanço.' },
  { id:4,   desc:'Paredes e alvenaria — térreo, 1º e 2º pavimento',           pciPct:8.14,  exec:40,  locked:true,  prevExec:0, obs:'40% medido na 2ª medição CAIXA (PLS 03/07/2026) — pagamento efetuado.' },
  { id:5,   desc:'Esquadrias (22 portas + 18 janelas)',                        pciPct:4.71,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:6,   desc:'Vidros, plásticos e guarda-corpos',                         pciPct:1.07,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:7,   desc:'Cobertura (telhas, platibanda, laje 2ºpav)',                pciPct:2.57,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:8,   desc:'Impermeabilizações',                                        pciPct:2.57,  exec:60,  locked:true,  prevExec:0, obs:'60% medido na 2ª medição CAIXA (PLS 03/07/2026). Falta laje 2ºpav e varanda.' },
  { id:9,   desc:'Revestimentos internos (chapisco + reboco)',                 pciPct:8.14,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:10,  desc:'Forros',                                                     pciPct:1.28,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:11,  desc:'Revestimentos externos e fachada',                          pciPct:4.07,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:12,  desc:'Pinturas',                                                   pciPct:4.71,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:13,  desc:'Pisos e rodapés (~205m²)',                                  pciPct:10.28, exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:14,  desc:'Acabamentos (soleiras, peitoris)',                           pciPct:1.28,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:15,  desc:'Instalações elétricas (3 pavimentos)',                       pciPct:4.07,  exec:30,  locked:true,  prevExec:0, obs:'30% medido na 2ª medição CAIXA (PLS 03/07/2026) — padrão + infra início.' },
  { id:16,  desc:'Instalações hidráulicas (3 pavimentos)',                     pciPct:4.07,  exec:20,  locked:true,  prevExec:0, obs:'20% medido na 2ª medição CAIXA (PLS 03/07/2026) — ramais parciais térreo.' },
  { id:17,  desc:'Instalações de esgoto sanitário',                           pciPct:2.70,  exec:100, locked:true,  prevExec:0, obs:'Medido na 2ª medição CAIXA — esgoto térreo + caixa de gordura + ligação rua.' },
  { id:171, desc:'Rede de águas pluviais',                                     pciPct:1.37,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:18,  desc:'Louças e metais',                                            pciPct:4.71,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:19,  desc:'Complementos (limpeza, calafete)',                           pciPct:1.50,  exec:0,   locked:false, prevExec:0, obs:'Não iniciado.' },
  { id:20,  desc:'Concreto magro / contrapiso',                               pciPct:1.28,  exec:100, locked:true,  prevExec:0, obs:'Medido na 2ª medição CAIXA. Contrapiso definitivo após alvenaria.' },
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
      : `<div class="bar-bg"><div class="bar-fill" style="width:${item.exec}%;background:${color}"></div></div>`;
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
  if (item.locked && item.exec===100) return ['b-medido','Medido ✓'];
  if (item.novo   && item.exec > 0)   return ['b-novo','Novo '+item.exec+'%'];
  if (item.prevExec > 0 && item.exec===0) return ['b-previsao','Previsão '+item.prevExec+'%'];
  if (item.exec===100) return ['b-concluido','Concluído'];
  if (item.exec > 0)  return ['b-parcial','Parcial '+item.exec+'%'];
  return ['b-pendente','Pendente'];
}
function barColor(item) {
  if (item.locked)       return '#1D9E75';
  if (item.novo)         return '#EF9F27';
  if (item.exec===100)   return '#378ADD';
  if (item.exec > 0)     return '#BA7517';
  return 'transparent';
}

/* ══ RECALCULAR ══════════════════════════════════════════════ */
function recalcular() {
  // execAcum = só itens com exec > 0 (inclui locked já medidos)
  // execNovo = itens com exec > 0 mas NÃO locked (ainda não medidos pela CAIXA)
  // prevAcum = execNovo + previsões pendentes
  let execAcum = 0, execNovo = 0, prevAcum = 0;
  itens.forEach(i => {
    const execPct = i.pciPct * i.exec / 100;
    execAcum += execPct;
    if (!i.locked) {
      execNovo += execPct;
      prevAcum += i.pciPct * Math.min(i.exec + i.prevExec, 100) / 100;
    }
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
    document.getElementById('c-medido-sub').textContent = isAdmin
      ? `R$ 30.623 · 1ª med. 30/05/2026`
      : `1ª med. 30/05/2026`;
    document.getElementById('c-saldo').textContent         = fmt(saldoConfirmado);
    document.getElementById('c-total-lib').textContent     = fmt(MED_VAL);
    document.getElementById('c-total-lib-sub').textContent = fmtP(MED_VAL/BASE_OBRA*100) + '% confirmado · ' + fmt(saldoConfirmado) + ' a liberar';
  }

  document.getElementById('tfoot-exec').textContent = fmtP(execNovo);

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
}

function buildMedicao(execNovo, execNovoCaixa, novoVal) {
  const tb = document.getElementById('medicao-tbody');
  tb.innerHTML = '';
  itens.forEach(item => {
    if (item.locked) return; // já medido — não entra na estimativa
    if (item.exec === 0 && item.prevExec === 0) return;
    const execPct  = item.pciPct * item.exec / 100;
    const execCaixa= execPct;
    const prevPct  = item.prevExec > 0 && item.exec < 100 ? item.pciPct * item.prevExec / 100 : 0;
    const prevCaixa= prevPct;
    const isPrev   = item.exec === 0 && item.prevExec > 0;
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
  const prev = itens.filter(i => i.prevExec > 0 && i.exec < 100);
  if (!prev.length) { el.innerHTML = '<p class="empty">Nenhuma previsão registrada.</p>'; return; }
  el.innerHTML = prev.map(i => `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <span style="flex:1;color:var(--text2)">${esc(i.desc)} — previsão ${i.prevExec}%</span>
      <button class="btn btn-success btn-sm" onclick="confirmarPrevisao(${i.id})">Confirmar</button>
      <button class="btn btn-ghost btn-sm"   onclick="cancelarPrevisao(${i.id})">Cancelar</button>
    </div>`).join('');
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
  sel.innerHTML = '<option value="">Selecionar serviço...</option>';
  itens.forEach(item => {
    if (item.locked) return;
    const o = document.createElement('option');
    o.value = item.id;
    o.textContent = `${item.id}. ${item.desc}`;
    sel.appendChild(o);
  });
}

/* ══ AÇÕES ADMIN ════════════════════════════════════════════ */
function registrar() {
  const dataVal = document.getElementById('inp-data').value;
  const itemId  = parseInt(document.getElementById('inp-item').value);
  const pctVal  = parseInt(document.getElementById('inp-pct').value);
  const tipo    = document.getElementById('inp-tipo').value;
  const obs     = document.getElementById('inp-obs').value.trim();
  const msgEl   = document.getElementById('msg-reg');
  if (!dataVal || !itemId) { msgEl.textContent='Preencha data e serviço.'; msgEl.className='msg error'; return; }
  const item    = itens.find(i=>i.id===itemId);
  if (!item) return;
  const dateStr = new Date(dataVal+'T12:00:00').toLocaleDateString('pt-BR');
  if (tipo==='prev') {
    item.prevExec = pctVal;
    historico.push({ data:dateStr, desc:`[Previsão] ${item.desc} → ${pctVal}%`, deltaPct:item.pciPct*pctVal/100, deltaVal:0, prev:true, obs });
    msgEl.textContent = `Previsão salva: ${item.desc} → ${pctVal}%`;
  } else {
    const ant = item.exec;
    item.exec = Math.max(item.exec, pctVal);
    item.prevExec = 0; item.novo = false;
    if (obs) item.obs = obs;
    const deltaPci  = item.pciPct*(item.exec-ant)/100;
    const deltaCaixa= deltaPci;
    const deltaVal  = deltaCaixa/100*BASE_OBRA;
    historico.push({ data:dateStr, desc:`${item.desc} (${ant}% → ${item.exec}%)`, deltaPct:deltaPci, deltaVal, prev:false, obs });
    msgEl.textContent = `✓ ${item.desc} → ${item.exec}% · +${fmtP(deltaPci)} PCI · ~+${fmtP(deltaCaixa)} CAIXA · ~${fmt(deltaVal)}`;
  }
  msgEl.className = 'msg';
  document.getElementById('inp-obs').value = '';
  salvar(); buildTable(); buildLog();
}

function confirmarPrevisao(id) {
  const item = itens.find(i=>i.id===id); if(!item) return;
  const ant = item.exec;
  item.exec = Math.max(item.exec, item.prevExec);
  item.prevExec=0; item.novo=false;
  const delta = item.pciPct*(item.exec-ant)/100;
  historico.push({ data:new Date().toLocaleDateString('pt-BR'), desc:`${item.desc} confirmado (${ant}% → ${item.exec}%)`, deltaPct:delta, deltaVal:delta/100*BASE_OBRA, prev:false, obs:'Confirmado via ação rápida' });
  salvar(); buildTable(); buildLog();
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
