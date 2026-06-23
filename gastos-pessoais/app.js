/* ========================================
   CONTROLE DE GASTOS PESSOAIS
   v1.0.0
======================================== */

const VERSION = '1.0.0';
const STORAGE_KEY = 'gastos_data';

// ─── STATE ────────────────────────────────
let state = {
  lancamentos: [],
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  editingId: null,
};

// ─── STORAGE ──────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: VERSION,
    lancamentos: state.lancamentos,
  }));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.lancamentos = data.lancamentos || [];
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
  }
}

// ─── UTILS ────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatMoney(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseMonthYear(m, y) {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function getLancamentosDoMes() {
  const prefix = parseMonthYear(state.currentMonth, state.currentYear);
  return state.lancamentos.filter(l => l.data && l.data.startsWith(prefix));
}

function monthName(m, y) {
  const d = new Date(y, m, 1);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

// ─── NAVEGAÇÃO ────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    render();
  });
});

// ─── MÊS ──────────────────────────────────
document.getElementById('prevMonth').onclick = () => {
  state.currentMonth--;
  if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
  updateMonthLabel();
  render();
};

document.getElementById('nextMonth').onclick = () => {
  state.currentMonth++;
  if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
  updateMonthLabel();
  render();
};

function updateMonthLabel() {
  document.getElementById('currentMonthLabel').textContent = monthName(state.currentMonth, state.currentYear);
}

// ─── MODAL ────────────────────────────────
function openModal(editId = null) {
  state.editingId = editId;
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('open');
  document.getElementById('modalTitle').textContent = editId ? 'Editar Lançamento' : 'Novo Gasto';

  if (editId) {
    const l = state.lancamentos.find(x => x.id === editId);
    if (l) {
      document.getElementById('inputData').value = l.data;
      document.getElementById('inputTipo').value = l.tipo;
      document.getElementById('inputDescricao').value = l.descricao;
      document.getElementById('inputCategoria').value = l.categoria;
      document.getElementById('inputOrigem').value = l.origem;
      document.getElementById('inputValor').value = l.valor;
      document.getElementById('inputEvitavel').checked = l.evitavel;
      document.getElementById('inputMotivo').value = l.motivo || '';
      document.getElementById('inputObs').value = l.obs || '';
      toggleMotivoGroup();
    }
  } else {
    document.getElementById('inputData').value = new Date().toISOString().slice(0, 10);
    document.getElementById('inputTipo').value = 'Despesa';
    document.getElementById('inputDescricao').value = '';
    document.getElementById('inputCategoria').value = 'Alimentação';
    document.getElementById('inputOrigem').value = 'Cartão de Crédito';
    document.getElementById('inputValor').value = '';
    document.getElementById('inputEvitavel').checked = false;
    document.getElementById('inputMotivo').value = '';
    document.getElementById('inputObs').value = '';
    document.getElementById('motivoEvitavelGroup').style.display = 'none';
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  state.editingId = null;
}

function toggleMotivoGroup() {
  const checked = document.getElementById('inputEvitavel').checked;
  document.getElementById('motivoEvitavelGroup').style.display = checked ? 'block' : 'none';
}

document.getElementById('inputEvitavel').addEventListener('change', toggleMotivoGroup);
document.getElementById('modalClose').onclick = closeModal;
document.getElementById('btnCancelar').onclick = closeModal;
document.getElementById('btnNovoGasto').onclick = () => openModal();
document.getElementById('btnNovoGasto2').onclick = () => openModal();

document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

document.getElementById('btnSalvar').onclick = () => {
  const data = document.getElementById('inputData').value;
  const descricao = document.getElementById('inputDescricao').value.trim();
  const valor = parseFloat(document.getElementById('inputValor').value);

  if (!data || !descricao || isNaN(valor) || valor <= 0) {
    alert('Preencha data, descrição e valor corretamente.');
    return;
  }

  const lancamento = {
    id: state.editingId || uid(),
    data,
    tipo: document.getElementById('inputTipo').value,
    descricao,
    categoria: document.getElementById('inputCategoria').value,
    origem: document.getElementById('inputOrigem').value,
    valor,
    evitavel: document.getElementById('inputEvitavel').checked,
    motivo: document.getElementById('inputMotivo').value.trim(),
    obs: document.getElementById('inputObs').value.trim(),
    criadoEm: new Date().toISOString(),
  };

  if (state.editingId) {
    const idx = state.lancamentos.findIndex(x => x.id === state.editingId);
    if (idx >= 0) state.lancamentos[idx] = lancamento;
  } else {
    state.lancamentos.push(lancamento);
  }

  save();
  closeModal();
  render();
};

// ─── DELETE ───────────────────────────────
function deleteLancamento(id) {
  if (!confirm('Remover este lançamento?')) return;
  state.lancamentos = state.lancamentos.filter(l => l.id !== id);
  save();
  render();
}

// ─── RENDER ROW ───────────────────────────
function renderRow(l) {
  const valClass = l.tipo === 'Receita' ? 'val-receita' : 'val-despesa';
  const sinal = l.tipo === 'Receita' ? '+' : '-';
  const evBadge = l.evitavel
    ? '<span class="badge badge-evitavel">Evitável</span>'
    : '<span class="badge badge-ok">Ok</span>';

  return `<tr>
    <td>${new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
    <td style="color:var(--text)">${l.descricao}</td>
    <td><span class="badge-cat">${l.categoria}</span></td>
    <td style="color:${l.tipo === 'Receita' ? 'var(--green)' : 'var(--text2)'}">${l.tipo}</td>
    <td>${l.origem || '-'}</td>
    <td>${evBadge}</td>
    <td class="${valClass}">${sinal}${formatMoney(l.valor)}</td>
    <td>
      <button class="btn-del" onclick="openModal('${l.id}')" title="Editar">✏️</button>
      <button class="btn-del" onclick="deleteLancamento('${l.id}')" title="Excluir">🗑️</button>
    </td>
  </tr>`;
}

// ─── RENDER ───────────────────────────────
function render() {
  const mes = getLancamentosDoMes();

  // TOTAIS
  const receita = mes.filter(l => l.tipo === 'Receita').reduce((s, l) => s + l.valor, 0);
  const gasto = mes.filter(l => l.tipo === 'Despesa').reduce((s, l) => s + l.valor, 0);
  const evitavel = mes.filter(l => l.tipo === 'Despesa' && l.evitavel).reduce((s, l) => s + l.valor, 0);

  document.getElementById('totalReceita').textContent = formatMoney(receita);
  document.getElementById('totalGasto').textContent = formatMoney(gasto);
  document.getElementById('totalSaldo').textContent = formatMoney(receita - gasto);
  document.getElementById('totalEvitavel').textContent = formatMoney(evitavel);

  // COR DO SALDO
  const saldoEl = document.getElementById('totalSaldo');
  saldoEl.style.color = (receita - gasto) >= 0 ? 'var(--green)' : 'var(--red)';

  // ÚLTIMOS LANÇAMENTOS (dashboard)
  const recentes = [...mes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
  const bodyRec = document.getElementById('tabelaRecentesBody');
  bodyRec.innerHTML = recentes.map(l => renderRow(l)).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:24px">Nenhum lançamento neste mês.</td></tr>';

  // TABELA COMPLETA (lançamentos)
  renderLancamentos();

  // CATEGORIAS CHART
  renderCategoriasChart(mes);

  // ALERTAS
  renderAlertas(mes, evitavel, gasto);

  // ANÁLISE
  renderAnalise(mes);
}

// ─── LANÇAMENTOS FILTRADOS ────────────────
function renderLancamentos() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filterCat = document.getElementById('filterCategoria')?.value || '';
  const filterTipo = document.getElementById('filterTipo')?.value || '';
  const filterEv = document.getElementById('filterEvitavel')?.value || '';

  // Preencher select de categorias
  const cats = [...new Set(state.lancamentos.map(l => l.categoria))].sort();
  const selCat = document.getElementById('filterCategoria');
  const current = selCat.value;
  selCat.innerHTML = '<option value="">Todas as categorias</option>' +
    cats.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');

  const mes = getLancamentosDoMes().filter(l => {
    if (search && !l.descricao.toLowerCase().includes(search)) return false;
    if (filterCat && l.categoria !== filterCat) return false;
    if (filterTipo && l.tipo !== filterTipo) return false;
    if (filterEv === 'sim' && !l.evitavel) return false;
    if (filterEv === 'nao' && l.evitavel) return false;
    return true;
  }).sort((a, b) => b.data.localeCompare(a.data));

  const body = document.getElementById('tabelaCompletaBody');
  const empty = document.getElementById('emptyLancamentos');
  if (mes.length === 0) {
    body.innerHTML = '';
    empty.style.display = 'block';
  } else {
    body.innerHTML = mes.map(l => renderRow(l)).join('');
    empty.style.display = 'none';
  }
}

['searchInput', 'filterCategoria', 'filterTipo', 'filterEvitavel'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', renderLancamentos);
  document.getElementById(id)?.addEventListener('change', renderLancamentos);
});

// ─── CATEGORIAS CHART ─────────────────────
const CAT_COLORS = {
  'Alimentação': '#22c97e',
  'Transporte': '#5b7fff',
  'Moradia': '#a78bfa',
  'Saúde': '#f4566b',
  'Lazer': '#f4cc3a',
  'Vestuário': '#f4933a',
  'Educação': '#38bdf8',
  'Assinaturas': '#fb7185',
  'Pets': '#4ade80',
  'Restaurantes': '#fbbf24',
  'Compras': '#c084fc',
  'Outros': '#64748b',
};

function renderCategoriasChart(mes) {
  const despesas = mes.filter(l => l.tipo === 'Despesa');
  const byCat = {};
  despesas.forEach(l => {
    byCat[l.categoria] = (byCat[l.categoria] || 0) + l.valor;
  });

  const total = Object.values(byCat).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const container = document.getElementById('categoriasChart');
  if (sorted.length === 0) {
    container.innerHTML = '<p style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Sem despesas neste mês.</p>';
    return;
  }

  container.innerHTML = sorted.map(([cat, val]) => {
    const pct = total > 0 ? (val / total * 100).toFixed(0) : 0;
    const color = CAT_COLORS[cat] || '#5b7fff';
    return `<div class="cat-bar-row">
      <span class="cat-bar-label">${cat}</span>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="cat-bar-value">${formatMoney(val)}</span>
    </div>`;
  }).join('');
}

// ─── ALERTAS ──────────────────────────────
function renderAlertas(mes, evitavel, gasto) {
  const container = document.getElementById('alertasLista');
  const alertas = [];

  if (evitavel > 0) {
    const pct = gasto > 0 ? (evitavel / gasto * 100).toFixed(0) : 0;
    alertas.push({
      icon: '⚠️',
      titulo: `${formatMoney(evitavel)} em gastos evitáveis`,
      desc: `${pct}% do total de despesas pode ser reduzido`,
    });
  }

  const assinaturas = mes.filter(l => l.categoria === 'Assinaturas' && l.tipo === 'Despesa');
  if (assinaturas.length > 3) {
    alertas.push({
      icon: '📺',
      titulo: `${assinaturas.length} assinaturas ativas`,
      desc: 'Verifique se todas estão sendo usadas',
    });
  }

  const restaurantes = mes.filter(l => l.categoria === 'Restaurantes' && l.tipo === 'Despesa');
  const totRest = restaurantes.reduce((s, l) => s + l.valor, 0);
  if (totRest > 500) {
    alertas.push({
      icon: '🍽️',
      titulo: `${formatMoney(totRest)} em restaurantes`,
      desc: 'Alto gasto com alimentação fora de casa',
    });
  }

  if (alertas.length === 0) {
    container.innerHTML = '<p style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Nenhum alerta neste mês.</p>';
    return;
  }

  container.innerHTML = alertas.map(a => `
    <div class="alerta">
      <span class="alerta-icon">${a.icon}</span>
      <div class="alerta-text">
        <p>${a.titulo}</p>
        <p>${a.desc}</p>
      </div>
    </div>
  `).join('');
}

// ─── ANÁLISE ──────────────────────────────
function renderAnalise(mes) {
  // Gastos evitáveis
  const evitaveis = mes.filter(l => l.tipo === 'Despesa' && l.evitavel)
    .sort((a, b) => b.valor - a.valor);
  const listaEv = document.getElementById('listaEvitaveis');
  if (evitaveis.length === 0) {
    listaEv.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:12px 0">Nenhum gasto marcado como evitável neste mês. 🎉</p>';
  } else {
    listaEv.innerHTML = evitaveis.map(l => `
      <div class="evitavel-item">
        <div class="evitavel-info">
          <p>${l.descricao}</p>
          <p>${new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')} · ${l.categoria}${l.motivo ? ' · ' + l.motivo : ''}</p>
        </div>
        <span class="evitavel-val">${formatMoney(l.valor)}</span>
      </div>
    `).join('');
  }

  // Barras por categoria (análise)
  const despesas = mes.filter(l => l.tipo === 'Despesa');
  const byCat = {};
  despesas.forEach(l => {
    byCat[l.categoria] = (byCat[l.categoria] || 0) + l.valor;
  });
  const total = Object.values(byCat).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const barras = document.getElementById('barrasCategoria');
  barras.innerHTML = sorted.map(([cat, val]) => {
    const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
    const color = CAT_COLORS[cat] || '#5b7fff';
    return `<div class="cat-bar-row">
      <span class="cat-bar-label">${cat}</span>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="cat-bar-value">${formatMoney(val)} <span style="font-size:11px;color:var(--text3)">(${pct}%)</span></span>
    </div>`;
  }).join('') || '<p style="color:var(--text3);font-size:13px;padding:12px 0">Sem dados neste mês.</p>';

  // Recomendações
  const recs = [];
  const totalEv = evitaveis.reduce((s, l) => s + l.valor, 0);
  if (totalEv > 0) {
    recs.push({
      icon: '💰',
      titulo: `Economia potencial: ${formatMoney(totalEv)}/mês`,
      desc: 'Se você evitar todos os gastos marcados, essa é a economia mensal.',
    });
  }

  const cats5k = sorted.filter(([, v]) => v > 5000);
  cats5k.forEach(([cat, val]) => {
    recs.push({
      icon: '🔍',
      titulo: `Alto gasto em "${cat}": ${formatMoney(val)}`,
      desc: 'Analise os itens desta categoria e veja o que pode ser reduzido.',
    });
  });

  const assinaturas = mes.filter(l => l.categoria === 'Assinaturas' && l.tipo === 'Despesa');
  if (assinaturas.length > 0) {
    const totAs = assinaturas.reduce((s, l) => s + l.valor, 0);
    recs.push({
      icon: '📋',
      titulo: `${assinaturas.length} assinaturas somam ${formatMoney(totAs)}`,
      desc: 'Revise cada assinatura e cancele o que não usa com frequência.',
    });
  }

  if (recs.length === 0) {
    recs.push({
      icon: '✅',
      titulo: 'Gastos bem controlados!',
      desc: 'Continue acompanhando seus lançamentos para manter o controle.',
    });
  }

  document.getElementById('recomendacoes').innerHTML = recs.map(r => `
    <div class="recomendacao">
      <span class="recomendacao-icon">${r.icon}</span>
      <div class="recomendacao-text">
        <p>${r.titulo}</p>
        <p>${r.desc}</p>
      </div>
    </div>
  `).join('');
}

// ─── IMPORTAR CSV ─────────────────────────
let pendingImport = [];

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});

function processFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    parseCSV(text, file.name);
  };
  reader.readAsText(file, 'utf-8');
}

function parseCSV(text, filename) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    alert('Arquivo inválido ou vazio.');
    return;
  }

  // Detectar formato
  const header = lines[0].toLowerCase();
  pendingImport = [];

  if (header.includes('nubank') || header.includes('date,title,amount')) {
    // Nubank CSV: Date,Title,Amount
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSV(lines[i]);
      if (cols.length < 3) continue;
      const [date, title, amount] = cols;
      const val = parseFloat(amount.replace(/[^0-9,.-]/g, '').replace(',', '.'));
      if (isNaN(val)) continue;
      pendingImport.push({
        data: normalizeDate(date),
        descricao: title,
        valor: Math.abs(val),
        tipo: val < 0 ? 'Despesa' : 'Receita',
        categoria: inferCategoria(title),
        origem: 'Cartão de Crédito',
        evitavel: false,
      });
    }
  } else {
    // Genérico: tenta colunas data, descrição, valor
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSV(lines[i]);
      if (cols.length < 3) continue;
      const dateStr = cols[0];
      const desc = cols[1] || cols[2] || 'Importado';
      const valStr = cols[cols.length - 1];
      const val = parseFloat(valStr.replace(/[^0-9,.-]/g, '').replace(',', '.'));
      if (isNaN(val)) continue;
      pendingImport.push({
        data: normalizeDate(dateStr),
        descricao: desc,
        valor: Math.abs(val),
        tipo: val < 0 ? 'Despesa' : 'Receita',
        categoria: inferCategoria(desc),
        origem: 'Importado',
        evitavel: false,
      });
    }
  }

  renderPreviewImport();
}

function splitCSV(line) {
  const result = [];
  let inQuote = false, cur = '';
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function normalizeDate(str) {
  // Tenta yyyy-mm-dd, dd/mm/yyyy, mm/dd/yyyy
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function inferCategoria(desc) {
  const d = desc.toLowerCase();
  if (/mercado|superm|hortifrut|açougue|padaria|feira/.test(d)) return 'Alimentação';
  if (/uber|99|taxi|ônibus|metrô|gasolina|posto|combustível|estacionamento/.test(d)) return 'Transporte';
  if (/netflix|spotify|amazon|prime|globoplay|hbo|disney|youtube/.test(d)) return 'Assinaturas';
  if (/restaurante|lanche|pizza|hamburger|sushi|ifood|rappi|delivery/.test(d)) return 'Restaurantes';
  if (/farmácia|remédio|médico|consulta|plano de saúde|dentista/.test(d)) return 'Saúde';
  if (/aluguel|condomínio|luz|água|internet|energia|gás/.test(d)) return 'Moradia';
  if (/roupa|calçado|sapato|tênis|camisa|vestido|riachuelo|renner/.test(d)) return 'Vestuário';
  if (/salário|renda|pagamento recebido/.test(d)) return 'Salário';
  if (/escola|faculdade|curso|livro|material/.test(d)) return 'Educação';
  return 'Outros';
}

function renderPreviewImport() {
  const preview = document.getElementById('previewImport');
  if (pendingImport.length === 0) {
    preview.innerHTML = '<p style="color:var(--text3);font-size:13px">Nenhum item reconhecido.</p>';
    return;
  }

  const show = pendingImport.slice(0, 10);
  preview.innerHTML = `
    <p style="font-size:13px;color:var(--text2);margin-bottom:12px">
      <strong style="color:var(--text)">${pendingImport.length} transações</strong> encontradas no arquivo:
    </p>
    ${show.map(l => `
      <div class="import-preview-item">
        <span>${new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')} · ${l.descricao}</span>
        <span class="${l.tipo === 'Receita' ? 'val-pos' : 'val-neg'}">${formatMoney(l.valor)}</span>
      </div>
    `).join('')}
    ${pendingImport.length > 10 ? `<p style="font-size:12px;color:var(--text3);margin-top:8px">... e mais ${pendingImport.length - 10} transações.</p>` : ''}
    <div class="import-actions">
      <button class="btn-ghost" onclick="cancelarImport()">Cancelar</button>
      <button class="btn-primary" onclick="confirmarImport()">Importar ${pendingImport.length} transações</button>
    </div>
  `;
}

window.confirmarImport = function () {
  pendingImport.forEach(l => {
    state.lancamentos.push({ ...l, id: uid(), evitavel: false, obs: '', motivo: '', criadoEm: new Date().toISOString() });
  });
  save();
  pendingImport = [];
  document.getElementById('previewImport').innerHTML =
    '<p style="color:var(--green);font-weight:600;padding:12px 0">✅ Importação concluída!</p>';
  render();
};

window.cancelarImport = function () {
  pendingImport = [];
  document.getElementById('previewImport').innerHTML = '';
};

// ─── INIT ─────────────────────────────────
load();
updateMonthLabel();
render();

console.log(`💸 Controle de Gastos v${VERSION} — carregado com ${state.lancamentos.length} lançamentos.`);
