/* ══ PROJEÇÃO DE CUSTOS ══════════════════════════════════════════
   Cada linha é uma etapa futura ou um aporte de recursos próprios:
     tipo 'etapa'  → mês, custos (material, mão de obra, outros) e, se
                     ligada a uma etapa da PCI (item + pavimento), até
                     qual % ela avança — o tracker calcula a liberação
                     da CAIXA que esse avanço gera
     tipo 'aporte' → entrada de recursos próprios no mês
   O fluxo de caixa mensal parte do caixa atual (liberado − gasto). */

let projecoes = [];
let projEditando = null;   // índice da linha em edição (null = nova)

const FRENTE_DO_ANDAR = { T:'p1', P1:'p2', P2:'p3', CX:'p3', G:'outros' };
const PAV_DA_FRENTE   = { p1:'térreo', p2:'1º pavimento', p3:'2º pavimento' };   // a aba Mão de obra conta o térreo como 1º andar
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const nomeMes = m => { const [a, b] = String(m || '').split('-'); return a && b ? MESES[+b - 1] + '/' + a : '—'; };
const somaMes = (m, n) => { const [a, b] = m.split('-').map(Number); const d = new Date(a, b - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const mesAtual = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const custoDe = p => (p.material || 0) + (p.mo || 0) + (p.outros || 0);

function defasagemLiberacao() {
  try { const v = localStorage.getItem('proj_defasagem'); return v === null ? 1 : +v; } catch (e) { return 1; }
}
function mudarDefasagem(sel) { try { localStorage.setItem('proj_defasagem', sel.value); } catch (e) {} buildProjecao(); }

function etapaDe(p) {
  const item = itens.find(i => i.id === p.item);
  const x = item && (item.andares || []).find(y => y.a === p.andar);
  return { item, x };
}

/* liberação da CAIXA de cada linha: avanço acima do já medido (ou de linha anterior da mesma etapa) */
function liberacoesProjetadas() {
  const nivel = {};
  const ordem = projecoes.map((p, k) => k).sort((a, b) => (projecoes[a].mes || '').localeCompare(projecoes[b].mes || '') || a - b);
  const res = projecoes.map(() => ({ avanco: 0, lib: 0 }));
  ordem.forEach(k => {
    const p = projecoes[k];
    if (p.tipo !== 'etapa' || p.ate == null) return;
    const { item, x } = etapaDe(p); if (!item || !x) return;
    const chave = p.item + '|' + p.andar;
    const base = nivel[chave] != null ? nivel[chave] : x.m;
    const d = Math.max(0, p.ate - base);
    nivel[chave] = Math.max(base, p.ate);
    res[k].avanco = item.pciPct * x.p * d / 10000;
    res[k].lib = res[k].avanco / 100 * BASE_OBRA;
  });
  return res;
}

function caixaAtual() {
  const liberado = medicoesConfirmadas.reduce((s, m) => s + (+m.valor || 0), 0);
  const gasto = totalMat() + totalMaterial() + totalMOPago();
  return { liberado, gasto, saldo: liberado - gasto };
}

/* ── formulário ───────────────────────────────────────────────── */
function preencherSelectEtapas() {
  const sel = document.getElementById('proj-etapa');
  if (!sel) return;
  const atual = sel.value;
  let h = '<option value="">— sem etapa da PCI (não gera liberação) —</option>';
  PAVIMENTOS.forEach(pv => {
    const ets = etapasDaAba(pv.id);
    if (!ets.length) return;
    h += `<optgroup label="${esc(pv.nome)}">` + ets.map(({ item, x }) =>
      `<option value="${item.id}|${x.a}">${esc(nomeEtapa(item, x.a))} (medido ${x.m}%)</option>`).join('') + '</optgroup>';
  });
  sel.innerHTML = h;
  sel.value = atual;
}

function alternarTipoProj() {
  const aporte = document.getElementById('proj-tipo').value === 'aporte';
  document.querySelectorAll('.proj-so-etapa').forEach(e => e.style.display = aporte ? 'none' : '');
  document.querySelectorAll('.proj-so-aporte').forEach(e => e.style.display = aporte ? '' : 'none');
  previaProj();
}

function escolherEtapaProj() {
  const v = document.getElementById('proj-etapa').value;
  const desc = document.getElementById('proj-desc');
  if (v) {
    const [it, a] = v.split('|'); const item = itens.find(i => i.id === +it);
    if (item && (!desc.value || desc.dataset.auto === '1')) { desc.value = nomeEtapa(item, a); desc.dataset.auto = '1'; }
    const x = item && item.andares.find(y => y.a === a);
    const ate = document.getElementById('proj-ate');
    if (x && !ate.value) ate.value = 100;
  }
  previaProj();
}

function lerFormProj() {
  const tipo = document.getElementById('proj-tipo').value;
  const v = document.getElementById('proj-etapa').value;
  const [it, a] = v ? v.split('|') : [null, null];
  const ate = parseFloat(String(document.getElementById('proj-ate').value).replace(',', '.'));
  return {
    tipo, mes: document.getElementById('proj-mes').value,
    desc: document.getElementById('proj-desc').value.trim(),
    item: tipo === 'etapa' && it ? +it : null, andar: tipo === 'etapa' && a ? a : null,
    ate: tipo === 'etapa' && it && !isNaN(ate) ? Math.min(100, Math.max(0, ate)) : null,
    material: tipo === 'etapa' ? numBR(document.getElementById('proj-mat').value) : 0,
    mo:       tipo === 'etapa' ? numBR(document.getElementById('proj-mo').value) : 0,
    outros:   tipo === 'etapa' ? numBR(document.getElementById('proj-out').value) : 0,
    aporte:   tipo === 'aporte' ? numBR(document.getElementById('proj-aporte').value) : 0,
    obs: document.getElementById('proj-obs').value.trim(),
  };
}

function previaProj() {
  const el = document.getElementById('proj-previa'); if (!el) return;
  const p = lerFormProj();
  if (p.tipo === 'aporte') { el.innerHTML = p.aporte ? `Entrada de <strong>${fmt(p.aporte)}</strong> em ${nomeMes(p.mes)}.` : ''; el.style.display = p.aporte ? '' : 'none'; return; }
  let h = '';
  const { item, x } = etapaDe(p);
  if (item && x) {
    h += `<strong>${esc(nomeEtapa(item, x.a))}</strong>: medido ${x.m}%` + (x.e > x.m ? ` · estimado ${x.e}%` : '');
    if (p.ate != null) {
      if (p.ate <= x.m) h += ` · <span style="color:var(--amber)">até ${p.ate}% não passa do já medido — não gera liberação</span>`;
      else {
        const av = item.pciPct * x.p * (p.ate - x.m) / 10000;
        h += ` · até ${p.ate}% = <strong>+${pct2(av)}</strong> da obra → liberação CAIXA ≈ <strong>${fmt(av / 100 * BASE_OBRA)}</strong>`;
      }
    }
  }
  const c = custoDe(p);
  const partes = [p.material && 'material ' + fmt(p.material), p.mo && 'MO ' + fmt(p.mo), p.outros && 'outros ' + fmt(p.outros)].filter(Boolean);
  if (c) h += (h ? '<br>' : '') + `Custo previsto: <strong>${fmt(c)}</strong>` + (partes.length > 1 ? ` (${partes.join(' · ')})` : '');
  el.innerHTML = h; el.style.display = h ? '' : 'none';
}

function salvarProjecao() {
  if (!podeEditar) return;
  const p = lerFormProj(), msg = document.getElementById('proj-msg');
  if (!p.mes) { msg.textContent = 'Informe o mês previsto.'; msg.className = 'msg error'; return; }
  if (p.tipo === 'etapa' && !p.desc && !p.item) { msg.textContent = 'Escolha a etapa ou descreva o serviço.'; msg.className = 'msg error'; return; }
  if (p.tipo === 'etapa' && !custoDe(p) && p.ate == null) { msg.textContent = 'Informe algum custo ou o % de avanço.'; msg.className = 'msg error'; return; }
  if (p.tipo === 'aporte' && !(p.aporte > 0)) { msg.textContent = 'Informe o valor do aporte.'; msg.className = 'msg error'; return; }
  if (!p.desc) p.desc = p.tipo === 'aporte' ? 'Aporte de recursos próprios' : '';
  if (projEditando != null && projecoes[projEditando]) projecoes[projEditando] = p; else projecoes.push(p);
  msg.textContent = projEditando != null ? '✓ Projeção atualizada.' : '✓ Projeção incluída.'; msg.className = 'msg';
  setTimeout(() => { msg.textContent = ''; }, 3000);
  limparFormProj();
  salvar(); buildProjecao();
}

function limparFormProj() {
  projEditando = null;
  ['proj-desc', 'proj-ate', 'proj-mat', 'proj-mo', 'proj-out', 'proj-aporte', 'proj-obs'].forEach(id => { const e = document.getElementById(id); if (e) { e.value = ''; e.dataset.auto = ''; } });
  const et = document.getElementById('proj-etapa'); if (et) et.value = '';
  const bt = document.getElementById('proj-btn'); if (bt) bt.textContent = 'Incluir na projeção';
  const cc = document.getElementById('proj-cancelar'); if (cc) cc.style.display = 'none';
  previaProj();
}

function editarProjecao(k) {
  const p = projecoes[k]; if (!p) return;
  projEditando = k;
  document.getElementById('proj-tipo').value = p.tipo;
  alternarTipoProj();
  document.getElementById('proj-mes').value = p.mes;
  document.getElementById('proj-etapa').value = p.item ? p.item + '|' + p.andar : '';
  document.getElementById('proj-ate').value = p.ate != null ? p.ate : '';
  const d = document.getElementById('proj-desc'); d.value = p.desc; d.dataset.auto = '';
  const f = v => v ? String(v).replace('.', ',') : '';
  document.getElementById('proj-mat').value = f(p.material);
  document.getElementById('proj-mo').value = f(p.mo);
  document.getElementById('proj-out').value = f(p.outros);
  document.getElementById('proj-aporte').value = f(p.aporte);
  document.getElementById('proj-obs').value = p.obs || '';
  document.getElementById('proj-btn').textContent = 'Salvar alteração';
  document.getElementById('proj-cancelar').style.display = '';
  previaProj();
  document.getElementById('proj-mes').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function excluirProjecao(k) {
  const p = projecoes[k]; if (!p) return;
  if (!confirm(`Excluir "${p.desc || 'linha'}" (${nomeMes(p.mes)}) da projeção?`)) return;
  projecoes.splice(k, 1);
  if (projEditando === k) limparFormProj();
  salvar(); buildProjecao();
}

/* ── tela ─────────────────────────────────────────────────────── */
function buildProjecao() {
  const tb = document.getElementById('proj-tbody');
  if (!tb) return;
  preencherSelectEtapas();
  const libs = liberacoesProjetadas();
  const cx = caixaAtual();
  const defas = defasagemLiberacao();
  const sd = document.getElementById('proj-defasagem'); if (sd) sd.value = String(defas);

  // linhas em ordem de mês
  const ordem = projecoes.map((p, k) => k).sort((a, b) => (projecoes[a].mes || '').localeCompare(projecoes[b].mes || '') || a - b);
  tb.innerHTML = ordem.length ? '' : '<tr><td colspan="9" class="empty">Nenhuma projeção. Inclua as próximas etapas acima.</td></tr>';
  const tot = { mat:0, mo:0, out:0, lib:0, aporte:0, av:0 };
  ordem.forEach(k => {
    const p = projecoes[k], l = libs[k];
    tot.mat += p.material || 0; tot.mo += p.mo || 0; tot.out += p.outros || 0; tot.lib += l.lib; tot.aporte += p.aporte || 0; tot.av += l.avanco;
    const tr = document.createElement('tr');
    if (p.tipo === 'aporte') tr.style.background = 'var(--green-bg)';
    const det = p.tipo === 'aporte' ? 'aporte de recursos próprios'
      : (p.item ? `até ${p.ate}% · +${pct2(l.avanco)} da obra` : 'sem etapa da PCI');
    tr.innerHTML = `
      <td style="white-space:nowrap">${nomeMes(p.mes)}</td>
      <td>${esc(p.desc)}<div style="font-size:11px;color:var(--text3)">${det}${p.obs ? ' · ' + esc(p.obs) : ''}</div></td>
      <td class="right">${p.material ? fmt(p.material) : '—'}</td>
      <td class="right">${p.mo ? fmt(p.mo) : '—'}</td>
      <td class="right">${p.outros ? fmt(p.outros) : '—'}</td>
      <td class="right" style="font-weight:600">${p.tipo === 'aporte' ? '—' : fmt(custoDe(p))}</td>
      <td class="right" style="color:var(--green);font-weight:600">${p.tipo === 'aporte' ? '+' + fmt(p.aporte) : (l.lib ? '+' + fmt(l.lib) : '—')}</td>
      <td class="right" style="color:${(l.lib + (p.aporte || 0) - custoDe(p)) < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(l.lib + (p.aporte || 0) - custoDe(p))}</td>
      <td class="center" style="white-space:nowrap">${podeEditar ? `
        <button class="btn btn-ghost btn-sm" onclick="editarProjecao(${k})">Editar</button>
        <button class="btn btn-ghost btn-sm" onclick="excluirProjecao(${k})" style="color:var(--red);border-color:var(--red);">✕</button>` : ''}</td>`;
    tb.appendChild(tr);
  });
  const custoTot = tot.mat + tot.mo + tot.out;
  const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
  set('proj-t-mat', fmt(tot.mat)); set('proj-t-mo', fmt(tot.mo)); set('proj-t-out', fmt(tot.out));
  set('proj-t-custo', fmt(custoTot)); set('proj-t-lib', '+' + fmt(tot.lib + tot.aporte)); set('proj-t-saldo', fmt(tot.lib + tot.aporte - custoTot));

  // fluxo de caixa mensal
  const fluxo = {};
  const mes0 = mesAtual();
  const garante = m => (fluxo[m] = fluxo[m] || { saida:0, lib:0, aporte:0 });
  projecoes.forEach((p, k) => {
    if (!p.mes) return;
    garante(p.mes).saida += custoDe(p);
    fluxo[p.mes].aporte += p.aporte || 0;
    if (libs[k].lib) garante(somaMes(p.mes, defas)).lib += libs[k].lib;
  });
  const meses = Object.keys(fluxo).sort();
  const tf = document.getElementById('proj-fluxo-tbody');
  tf.innerHTML = '';
  let acum = cx.saldo, menor = { v: cx.saldo, m: null };
  if (meses.length) {
    // preenche meses vazios entre o primeiro e o último
    const todos = []; for (let m = meses[0] < mes0 ? meses[0] : mes0; m <= meses[meses.length - 1]; m = somaMes(m, 1)) todos.push(m);
    todos.forEach(m => {
      const f = fluxo[m] || { saida:0, lib:0, aporte:0 };
      const saldoMes = f.lib + f.aporte - f.saida;
      acum += saldoMes;
      if (acum < menor.v) menor = { v: acum, m };
      if (!fluxo[m] && m !== mes0) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="white-space:nowrap;font-weight:500">${nomeMes(m)}</td>
        <td class="right" style="color:var(--red)">${f.saida ? '−' + fmt(f.saida) : '—'}</td>
        <td class="right" style="color:var(--green)">${f.lib ? '+' + fmt(f.lib) : '—'}</td>
        <td class="right" style="color:var(--green)">${f.aporte ? '+' + fmt(f.aporte) : '—'}</td>
        <td class="right">${fmt(saldoMes)}</td>
        <td class="right" style="font-weight:600;color:${acum < 0 ? 'var(--red)' : 'var(--green)'}">${fmt(acum)}</td>`;
      tf.appendChild(tr);
    });
  } else {
    tf.innerHTML = '<tr><td colspan="6" class="empty">O fluxo aparece quando houver projeções.</td></tr>';
  }

  // cartões
  const aLiberar = BASE_OBRA - cx.liberado;
  const card = (lbl, val, sub, cls) => `<div class="card ${cls || ''}"><div class="card-label">${lbl}</div><div class="card-value">${val}</div><div class="card-sub">${sub}</div></div>`;
  document.getElementById('proj-cards').innerHTML =
    card('Caixa hoje', fmt(cx.saldo), `liberado ${fmt(cx.liberado)} − gasto ${fmt(cx.gasto)}`, cx.saldo < 0 ? 'warn' : 'ok') +
    card('Custo projetado', fmt(custoTot), `material ${fmt(tot.mat)} · MO ${fmt(tot.mo)}${tot.out ? ' · outros ' + fmt(tot.out) : ''}`) +
    card('Liberação CAIXA prevista', '+' + fmt(tot.lib), `+${pct2(tot.av)} da obra · resta liberar ${fmt(Math.max(0, aLiberar - tot.lib))}`, 'info') +
    card(menor.v < 0 ? 'Recurso próprio necessário' : 'Menor caixa projetado', fmt(Math.abs(menor.v)),
      menor.v < 0 ? `caixa mais negativo${menor.m ? ' em ' + nomeMes(menor.m) : ' (hoje)'}${tot.aporte ? ' · já considerando aportes de ' + fmt(tot.aporte) : ''}` : (menor.m ? 'em ' + nomeMes(menor.m) : 'hoje'),
      menor.v < 0 ? 'warn' : 'ok');

  // mão de obra prevista × teto de cada frente
  const tm = document.getElementById('proj-mo-tbody');
  tm.innerHTML = '';
  MO_FRENTES.forEach(fr => {
    const prev = projecoes.filter(p => p.tipo === 'etapa' && (FRENTE_DO_ANDAR[p.andar] || 'outros') === fr.id).reduce((s, p) => s + (p.mo || 0), 0);
    const pago = fr.teto ? pagoDa(fr.id) : pagamentosDa(fr.id).filter(p => p.tipo !== 'material').reduce((s, p) => s + p.valor, 0);
    const teto = fr.teto ? tetoDa(fr.id) : 0;
    if (!prev && !pago && !teto) return;
    const sobra = teto - pago - prev;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500">${esc(fr.nome)}${PAV_DA_FRENTE[fr.id] ? ` <span style="font-size:11px;color:var(--text3)">(${PAV_DA_FRENTE[fr.id]})</span>` : ''}</td>
      <td class="right">${fr.teto ? fmt(teto) : 'sem teto'}</td>
      <td class="right">${fmt(pago)}</td>
      <td class="right">${prev ? fmt(prev) : '—'}</td>
      <td class="right" style="font-weight:600;color:${fr.teto && sobra < 0 ? 'var(--red)' : 'inherit'}">${fr.teto ? fmt(sobra) : '—'}${fr.teto && sobra < 0 ? ' ⚠️' : ''}</td>`;
    tm.appendChild(tr);
  });
}
