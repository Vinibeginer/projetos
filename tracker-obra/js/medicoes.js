/* ══ MEDIÇÕES CONFIRMADAS ════════════════════════════════════ */
const MEDICOES_DEF = [
  { num:1, data:'30/05/2026', pctCaixa:8.23, valor:30623.00, ref:'Doc 662250 · Ag. 4437', itens:'Serviços preliminares + infraestrutura (sapatas, baldrames)', confirmada:true },
  { num:2, data:'03/07/2026', pctCaixa:17.12, valor:63701.54, ref:'PLS assinada RT João Carlos + Vinícius 06/07/2026 · pago pela CAIXA', itens:'Supra 35% + Alvenaria 40% + Impermeab 60% + Elétrica 30% + Hidráulica 20% + Esgoto 100% + Outros 20%', confirmada:true },
];

let medicoesConfirmadas = [];

function salvarMedicoes() {
  espelharLocal(); atualizarTimestamp(); sincronizarNuvem();
}

function carregarMedicoes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const e = JSON.parse(raw);
    if (e.medicoesConfirmadas) medicoesConfirmadas = e.medicoesConfirmadas;
  } catch(e) {}
}

function totalConfirmado() {
  return medicoesConfirmadas.reduce((s, m) => s + m.valor, 0);
}

function buildMedicoesConfirmadas() {
  const tb   = document.getElementById('med-confirmadas-tbody');
  if (!tb) return;
  tb.innerHTML = '';
  let acum = 0;

  medicoesConfirmadas.forEach((m, idx) => {
    acum += m.valor;
    const tr = document.createElement('tr');
    tr.style.background = '#E1F5EE';
    tr.innerHTML = `
      <td class="center"><span class="badge b-medido">${m.num}ª ✓</span></td>
      <td style="font-size:12px;white-space:nowrap">${esc(m.data)}</td>
      <td class="right" style="font-weight:600;color:var(--green)">${fmtP(m.pctCaixa)}</td>
      <td class="right" style="font-weight:600;color:var(--green)">${fmt(m.valor)}</td>
      <td class="right">${fmt(acum)}</td>
      <td class="center"><span class="badge b-medido">Confirmado ✓</span></td>
      <td class="center admin-only">
        ${podeEditar ? `<button class="btn btn-danger btn-sm" onclick="removerMedicao(${idx})">✕</button>` : ''}
      </td>
    `;
    tb.appendChild(tr);
  });

  const total     = totalConfirmado();
  const totalPct  = medicoesConfirmadas.reduce((s, m) => s + m.pctCaixa, 0);
  const saldo     = BASE_OBRA - total;

  const elPct  = document.getElementById('med-conf-pct-total');
  const elVal  = document.getElementById('med-conf-val-total');
  const elAcum = document.getElementById('med-conf-acum');
  const elSaldo= document.getElementById('med-conf-saldo');
  if (elPct)  elPct.textContent  = fmtP(totalPct);
  if (elVal)  elVal.textContent  = fmt(total);
  if (elAcum) elAcum.textContent = fmt(total);
  if (elSaldo)elSaldo.textContent= fmt(saldo);

  // atualizar card confirmado no topo
  const cMedido = document.getElementById('c-medido');
  const cMedSub = document.getElementById('c-medido-sub');
  if (cMedido) cMedido.textContent = fmtP(totalPct);
  if (cMedSub) {
    const ultima = medicoesConfirmadas[medicoesConfirmadas.length - 1];
    cMedSub.textContent = !ultima ? 'nenhuma medição confirmada'
      : isAdmin
      ? `${fmt(total)} · ${medicoesConfirmadas.length}ª med. ${ultima.data}`
      : `${medicoesConfirmadas.length}ª med. ${ultima.data}`;
  }

  // atualizar MED_PCT_ATUAL para recalcular
  window.MED_PCT_ATUAL = totalPct;
  window.MED_VAL_ATUAL = total;
}

function confirmarMedicao() {
  const dataVal = document.getElementById('med-inp-data').value;
  const valorStr= document.getElementById('med-inp-valor').value.replace(/\./g,'').replace(',','.');
  const ref     = document.getElementById('med-inp-ref').value.trim();
  const itens   = document.getElementById('med-inp-itens').value.trim();
  const msg     = document.getElementById('med-msg');
  const valor   = parseFloat(valorStr);

  if (!dataVal || isNaN(valor) || valor <= 0) {
    msg.textContent = 'Preencha data e valor.';
    msg.className = 'msg error'; return;
  }

  const dateStr  = new Date(dataVal + 'T12:00:00').toLocaleDateString('pt-BR');
  const pctCaixa = valor / BASE_OBRA * 100;
  const num      = medicoesConfirmadas.length + 1;

  medicoesConfirmadas.push({ num, data:dateStr, pctCaixa, valor, ref, itens, confirmada:true });

  // registrar no histórico
  historico.push({
    data: dateStr,
    desc: `${num}ª Medição CAIXA confirmada — ${itens || 'itens conforme PLS'}`,
    deltaPct: pctCaixa,
    deltaVal: valor,
    prev: false,
    obs: ref
  });

  msg.textContent = `✓ ${num}ª medição confirmada: ${fmt(valor)}`;
  msg.className = 'msg';
  setTimeout(() => { msg.textContent = ''; }, 4000);

  document.getElementById('med-inp-data').value   = new Date().toISOString().split('T')[0];
  document.getElementById('med-inp-valor').value  = '';
  document.getElementById('med-inp-ref').value    = '';
  document.getElementById('med-inp-itens').value  = '';

  salvarMedicoes(); salvar();
  buildMedicoesConfirmadas();
  buildLog();
  recalcular();
}

function removerMedicao(idx) {
  if (!confirm('Remover esta medição confirmada?')) return;
  medicoesConfirmadas.splice(idx, 1);
  salvarMedicoes();
  buildMedicoesConfirmadas();
  recalcular();
}
