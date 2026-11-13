/* ══ MEDIÇÕES CONFIRMADAS ════════════════════════════════════ */
const MEDICOES_DEF = [
  { num:1, data:'30/05/2026', pctCaixa:8.23, valor:30622.88, ref:'Doc 662250 · Ag. 4437', itens:'Serviços preliminares + infraestrutura (sapatas, baldrames)', confirmada:true },
  { num:2, data:'03/07/2026', pctCaixa:17.12, valor:63701.54, ref:'PLS assinada RT João Carlos + Vinícius 06/07/2026 · pago pela CAIXA', itens:'Supra 35% + Alvenaria 40% + Impermeab 60% + Elétrica 30% + Hidráulica 20% + Esgoto 30% + Outros 20%', confirmada:true,
    pls:{1:100,2:100,3:35,4:40,8:60,15:30,16:20,17:30,20:20} },
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

/* ── PLS: % de cada item no documento oficial da medição ───────── */
const plsAcumulado = pls => itens.reduce((s, i) => s + i.pciPct * (+(pls || {})[i.id] || 0) / 100, 0);
const pagoAcumulado = () => medicoesConfirmadas.reduce((s, m) => s + (+m.pctCaixa || 0), 0);
const pct2 = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + '%';

function lerGradePLS() {
  const pls = {};
  document.querySelectorAll('#pls-tbody .pls-inp').forEach(inp => {
    const v = parseFloat(String(inp.value).replace(',', '.'));
    pls[inp.dataset.ordem] = isNaN(v) ? 0 : Math.min(100, Math.max(0, Math.round(v * 100) / 100));
  });
  return pls;
}

/* grade da PLS no formulário — vem preenchida com as estimativas atuais */
function buildGradePLS() {
  const tb = document.getElementById('pls-tbody');
  if (!tb || !itens.length) return;
  tb.innerHTML = '';
  itens.forEach(i => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--text3);font-size:12px">${i.id}</td>
      <td>${esc(i.desc)}</td>
      <td class="right" style="color:var(--text2)">${pct2(i.pciPct)}</td>
      <td class="right" style="color:var(--green)">${medidoDe(i)}%</td>
      <td class="center"><input type="number" class="pls-inp" data-ordem="${i.id}" min="0" max="100" step="1" value="${i.exec}"
        style="width:72px;text-align:right;padding:4px 6px;font-size:13px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)"></td>
      <td class="right pls-obra"></td>
      <td class="right pls-delta" style="font-weight:600"></td>`;
    tr.querySelector('.pls-inp').addEventListener('input', conferirPLS);
    tb.appendChild(tr);
  });
  conferirPLS();
}

/* recalcula a grade e compara o valor esperado pela PLS com o valor pago */
function conferirPLS() {
  const pls = lerGradePLS();
  document.querySelectorAll('#pls-tbody tr').forEach(tr => {
    const inp = tr.querySelector('.pls-inp'), i = itens.find(x => x.id === +inp.dataset.ordem); if (!i) return;
    const v = pls[i.id], d = v - medidoDe(i);
    tr.querySelector('.pls-obra').textContent  = pct2(i.pciPct * v / 100);
    tr.querySelector('.pls-delta').textContent = d === 0 ? '—' : (d > 0 ? '+' : '') + pct2(i.pciPct * d / 100);
    tr.querySelector('.pls-delta').style.color = d < 0 ? 'var(--red)' : '';
    tr.style.background = d !== 0 ? 'var(--amber-bg)' : '';
  });
  let acum = Math.round(plsAcumulado(pls) * 100) / 100;
  // PLS lida do PDF: usa o acumulado oficial do documento (a CAIXA arredonda linha a linha)
  if (typeof plsLida !== 'undefined' && plsLida && plsLida.acumAtual != null && Math.abs(plsLida.acumAtual - acum) <= 0.05) acum = plsLida.acumAtual;
  const ant  = Math.round(pagoAcumulado() * 100) / 100;
  const etapa = Math.round((acum - ant) * 100) / 100;
  const esperado = etapa / 100 * BASE_OBRA;
  document.getElementById('pls-acum').textContent     = pct2(acum);
  document.getElementById('pls-ant').textContent      = pct2(ant);
  document.getElementById('pls-etapa').textContent    = pct2(etapa);
  document.getElementById('pls-esperado').textContent = isAdmin ? '≈ ' + fmt(esperado) : '';

  const box = document.getElementById('pls-conferencia');
  const valor = numBR(document.getElementById('med-inp-valor').value);
  const reduz = itens.filter(i => pls[i.id] < medidoDe(i));
  let html = '', cls = 'alert alert-info';
  if (reduz.length) {
    html += `⚠️ ${reduz.length} item(ns) com % menor que o já medido: ${reduz.map(i => esc(i.desc.split(' — ')[0]) + ' ' + medidoDe(i) + '% → ' + pls[i.id] + '%').join(' · ')}. A PLS não costuma reduzir item já pago — confira.<br>`;
    cls = 'alert alert-warn';
  }
  if (valor > 0) {
    const pago = valor / BASE_OBRA * 100, dif = pago - etapa;
    if (Math.abs(dif) <= 0.05) {
      html += `✓ O valor pago (${fmt(valor)} = ${pct2(pago)} da base) bate com a PLS (${pct2(etapa)}).`;
    } else {
      html += `⚠️ O valor pago (${fmt(valor)} = <strong>${pct2(pago)}</strong>) <strong>não bate</strong> com a PLS (${pct2(etapa)} ≈ ${fmt(esperado)}): diferença de ${pct2(dif)} ≈ ${fmt(dif / 100 * BASE_OBRA)}. ` +
              `Confira o % de cada item e o "mensurado acumulado no mês anterior" da PLS (deve ser ${pct2(ant)}, o total já pago).`;
      cls = 'alert alert-warn';
    }
  }
  box.className = cls;
  box.innerHTML = html;
  box.style.display = html ? '' : 'none';
}

function verPLS(idx) {
  const d = document.getElementById('pls-det-' + idx);
  if (d) d.style.display = d.style.display === 'none' ? '' : 'none';
}

/* aplica a PLS: o % medido de cada item passa a ser o do documento */
function aplicarPLS(pls) {
  itens.forEach(i => {
    if (!(String(i.id) in pls)) return;
    const novo = +pls[i.id] || 0;
    const et = i.andares || [];
    if (Math.abs((+i.exec || 0) - novo) <= 0.01 && et.length) {
      et.forEach(x => { x.m = x.e; });              // a estimativa por andar era exatamente a PLS
    } else {
      et.forEach(x => { x.m = novo; x.e = Math.max(x.e, novo); });   // proporcional: mesmo % em cada andar
    }
    i.medido = novo; i.locked = novo > 0; i.novo = false;
    const ex = et.length ? Math.round(et.reduce((s, x) => s + x.p * x.e / 100, 0) * 100) / 100 : novo;
    i.exec = Math.max(novo, ex);
    if (et.every(x => x.e === x.m)) i.exec = novo;
  });
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
      <td class="center"><span class="badge b-medido">Confirmado ✓</span>${m.pls
        ? `<div style="font-size:11px;margin-top:3px">PLS ${pct2(plsAcumulado(m.pls))} · <a href="#" onclick="verPLS(${idx});return false">ver itens</a></div>`
        : '<div style="font-size:11px;margin-top:3px;color:var(--text3)">sem PLS registrada</div>'}${m.plsArquivo
        ? `<div style="font-size:11px;margin-top:2px"><a href="#" onclick="abrirPLS(${idx});return false">📎 PDF da PLS</a></div>`
        : (podeEditar ? `<div style="font-size:11px;margin-top:2px"><a href="#" onclick="anexarPLSexistente(${idx});return false">📎 anexar PDF</a></div>` : '')}</td>
      <td class="center admin-only">
        ${podeEditar ? `<button class="btn btn-danger btn-sm" onclick="removerMedicao(${idx})">✕</button>` : ''}
      </td>
    `;
    tb.appendChild(tr);
    if (m.pls) {
      const det = document.createElement('tr');
      det.id = 'pls-det-' + idx; det.style.display = 'none';
      const ant = medicoesConfirmadas.slice(0, idx).reverse().find(x => x.pls);
      det.innerHTML = `<td colspan="7" style="background:var(--surface)"><div style="display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px">` +
        itens.map(i => {
          const v = +m.pls[i.id] || 0, a = ant ? (+ant.pls[i.id] || 0) : null;
          if (!v && !a) return '';
          return `<span>${esc(i.desc.split(' — ')[0].split(' (')[0])}: <strong>${v}%</strong>` +
            (a !== null && a !== v ? ` <span style="color:var(--amber)">(${a}% → ${v}%)</span>` : '') + '</span>';
        }).join('') + '</div></td>';
      tb.appendChild(det);
    }
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
  const itensTxt = document.getElementById('med-inp-itens').value.trim();
  const msg     = document.getElementById('med-msg');
  const valor   = parseFloat(valorStr);

  if (!dataVal || isNaN(valor) || valor <= 0) {
    msg.textContent = 'Preencha data e valor.';
    msg.className = 'msg error'; return;
  }

  const dateStr  = new Date(dataVal + 'T12:00:00').toLocaleDateString('pt-BR');
  const pctCaixa = valor / BASE_OBRA * 100;
  const num      = medicoesConfirmadas.length + 1;

  // PLS desta medição: vira o % medido de cada item
  const pls = lerGradePLS();
  const mudou = itens.filter(i => (pls[i.id] || 0) !== medidoDe(i));
  const resumo = itensTxt || mudou.map(i => `${i.desc.split(' — ')[0].split(' (')[0]} ${medidoDe(i)}→${pls[i.id]}%`).join(' + ');
  const acumPLS = plsAcumulado(pls), etapaPLS = acumPLS - pagoAcumulado();
  if (Math.abs(pctCaixa - etapaPLS) > 0.05 &&
      !confirm(`O valor pago (${pct2(pctCaixa)} da base) não bate com a PLS (${pct2(etapaPLS)}).\n\nConfirmar mesmo assim? O % medido dos itens será o da PLS informada.`)) return;
  const nova = { num, data:dateStr, pctCaixa, valor, ref, itens: resumo, confirmada:true, pls };
  medicoesConfirmadas.push(nova);
  aplicarPLS(pls);
  const arqPLS = plsArquivoPendente;

  // registrar no histórico
  historico.push({
    data: dateStr,
    desc: `${num}ª Medição CAIXA confirmada — ${resumo || 'itens conforme PLS'} (PLS acumulada ${pct2(acumPLS)})`,
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
  buildSelect();
  buildTable();
  buildGradePLS();
  limparPLSpendente();
  if (arqPLS) anexarPLSnaMedicao(nova, arqPLS);
}

function removerMedicao(idx) {
  if (!confirm('Remover esta medição confirmada?')) return;
  medicoesConfirmadas.splice(idx, 1);
  salvarMedicoes();
  buildMedicoesConfirmadas();
  recalcular();
}
