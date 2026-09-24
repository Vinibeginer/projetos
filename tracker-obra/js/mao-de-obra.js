/* ══ MÃO DE OBRA ══════════════════════════════════════════════ */
let MO_TETO = 0;

const MO_ITENS_DEF = [
  { id:1,  desc:'Serviços preliminares / barracão',         orcado:1358  },
  { id:2,  desc:'Sapatas, baldrame, alicerce',              orcado:12729 },
  { id:3,  desc:'Impermeabilização do alicerce',            orcado:1608  },
  { id:4,  desc:'Alvenaria + pilares + vigas superiores',   orcado:23271 },
  { id:5,  desc:'Laje (90,94 m²)',                          orcado:17352 },
  { id:6,  desc:'Esgoto + instalação hidráulica',           orcado:3108  },
  { id:7,  desc:'Infra elétrica (chumbação + quadro)',      orcado:2487  },
  { id:8,  desc:'Engradamento + caixonetes',                orcado:870   },
  { id:9,  desc:'Janelas, básculas e portas',               orcado:3791  },
  { id:10, desc:'Chapisco e reboco (505,62 m²)',            orcado:23252 },
  { id:11, desc:'Contrapiso + concretagem + regularização', orcado:7913  },
  { id:12, desc:'Piso (80,14 m²) e rodapé',                orcado:6425  },
  { id:13, desc:'Revestimento (80,90 m²)',                  orcado:6034  },
  { id:14, desc:'Soleiras',                                 orcado:542   },
  { id:15, desc:'Bancadas (cozinha, lavabo, suíte)',        orcado:1430  },
  { id:16, desc:'Concretagem varanda / regularização',      orcado:2859  },
];

// Pagamentos já realizados com base nos comprovantes
const MO_PAGAMENTOS_DEF = [
  { id:1, data:'12/08/2025', dest:'Fábio de Barros da Silva', ref:'Pix etapa inicial — sapatas e baldrame',       valor:7000,   tipo:'mo',         itemId:2  },
  { id:2, data:'30/08/2025', dest:'Fábio de Barros da Silva', ref:'Pix complemento infraestrutura',               valor:3500,   tipo:'mo',         itemId:2  },
  { id:3, data:'13/09/2025', dest:'Fábio de Barros da Silva', ref:'Pix impermeabilização + serviços preliminares',valor:2000,   tipo:'mo',         itemId:3  },
  { id:4, data:'21/09/2025', dest:'Fábio de Barros da Silva', ref:'Pix regularização e aterro',                   valor:6325,   tipo:'mo',         itemId:11 },
  { id:6, data:'12/06/2026', dest:'Barros Rezende Construtora', ref:'Recibo 1ª etapa — esgoto + infraestrutura', valor:4700,   tipo:'mo',         itemId:6  },
  { id:7, data:'19/06/2026', dest:'Barros Rezende Construtora', ref:'Recibo saldo — esgoto + contrapiso',        valor:3965.30,tipo:'mo',         itemId:6  },
];

// projeção próximas etapas com base no avanço físico
const MO_PROJECAO_DEF = [
  { id:4,  desc:'Alvenaria + pilares + vigas',  orcado:23271, prevPct:30,  quando:'Semana 22–26/06/2026 (em andamento)' },
  { id:5,  desc:'Laje (90,94 m²)',              orcado:17352, prevPct:100, quando:'Após conclusão da alvenaria' },
  { id:7,  desc:'Infra elétrica interna',       orcado:2487,  prevPct:90,  quando:'Concomitante à alvenaria (falta 90% da elétrica interna)' },
  { id:8,  desc:'Engradamento + caixonetes',    orcado:870,   prevPct:100, quando:'Cobertura' },
  { id:9,  desc:'Janelas, básculas e portas',   orcado:3791,  prevPct:100, quando:'Após laje' },
  { id:10, desc:'Chapisco e reboco',            orcado:23252, prevPct:100, quando:'Após esquadrias' },
  { id:11, desc:'Rede de águas pluviais',       orcado:1300,  prevPct:100, quando:'Após cobertura' },
  { id:12, desc:'Piso e rodapé',               orcado:6425,  prevPct:100, quando:'Acabamento' },
  { id:13, desc:'Revestimento',                orcado:6034,  prevPct:100, quando:'Acabamento' },
  { id:14, desc:'Soleiras',                    orcado:542,   prevPct:100, quando:'Final' },
  { id:15, desc:'Bancadas',                    orcado:1430,  prevPct:100, quando:'Final' },
  { id:16, desc:'Concretagem varanda',          orcado:2859,  prevPct:100, quando:'Final' },
];

let moPagamentos = [];

function salvarMO() {
  espelharLocal(); atualizarTimestamp(); sincronizarNuvem();
}

function carregarMO() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try { const e = JSON.parse(raw); if (e.moPagamentos) moPagamentos = e.moPagamentos; } catch(e){}
}

function totalMOPago() {
  return moPagamentos.filter(p => p.tipo === 'mo' || p.tipo === 'adiantamento')
    .reduce((s, p) => s + p.valor, 0);
}
function totalMaterial() {
  return moPagamentos.filter(p => p.tipo === 'material').reduce((s,p)=>s+p.valor,0);
}

function buildMOCards() {
  const pago   = totalMOPago();
  const saldo  = MO_TETO - pago;
  const pct    = Math.round(pago / MO_TETO * 100);
  const proxVal = obraOriginal ? (MO_ITENS_DEF.find(i=>i.id===4)?.orcado || 0) : 0;

  document.getElementById('mo-total-pago').textContent     = fmt(pago);
  document.getElementById('mo-total-pago-pct').textContent  = pct + '% do teto';
  document.getElementById('mo-saldo').textContent          = fmt(saldo);
  document.getElementById('mo-proximo').textContent        = fmt(proxVal);
  document.getElementById('mo-consumo-pct').textContent    = pct + '%';
  document.getElementById('mo-consumo-bar').style.width    = Math.min(pct,100) + '%';
  document.getElementById('mo-consumo-bar').style.background = pct > 80 ? 'var(--red-mid)' : pct > 60 ? 'var(--amber-mid)' : 'var(--green-mid)';
  document.getElementById('mo-n-pagamentos').textContent   = moPagamentos.length;

  const barPct  = Math.min(pago / MO_TETO * 100, 100);
  const projPct = Math.min(proxVal / MO_TETO * 100, 100 - barPct);
  document.getElementById('mo-bar-pago').style.width = barPct + '%';
  document.getElementById('mo-bar-pago').textContent  = barPct > 6 ? fmt(pago) : '';
  document.getElementById('mo-bar-prev').style.left   = barPct + '%';
  document.getElementById('mo-bar-prev').style.width  = projPct + '%';
}

function buildMOPagamentos() {
  const tb = document.getElementById('mo-pagamentos-tbody');
  tb.innerHTML = '';
  moPagamentos.forEach((p, idx) => {
    const [cls, lbl] = p.tipo === 'mo' ? ['b-quitado','MO'] :
                       p.tipo === 'adiantamento' ? ['b-adiant','Adiantamento'] :
                       ['b-material','Material'];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--text3);font-size:12px">${idx+1}</td>
      <td style="white-space:nowrap">${esc(p.data)}</td>
      <td style="color:var(--text2)">${esc(p.dest)}</td>
      <td style="color:var(--text2);font-size:12px">${esc(p.ref)}</td>
      <td class="right" style="font-weight:600;color:var(--green)">${fmt(p.valor)}</td>
      <td class="center"><span class="badge ${cls}">${lbl}</span></td>
      <td class="center"><button class="btn btn-ghost btn-sm" onclick="removerPagMO(${idx})" style="color:var(--red);border-color:var(--red);">✕</button></td>
    `;
    tb.appendChild(tr);
  });
  const total = totalMOPago();
  document.getElementById('mo-tfoot-total').textContent = fmt(total);
}

function buildMOItens() {
  const tb = document.getElementById('mo-itens-tbody');
  tb.innerHTML = '';
  let totalPago = 0;

  MO_ITENS_DEF.forEach(item => {
    const pagos = moPagamentos.filter(p => p.itemId === item.id && p.tipo !== 'material');
    const pago  = pagos.reduce((s,p)=>s+p.valor,0);
    const saldo = Math.max(0, item.orcado - pago);
    const pct   = Math.min(Math.round(pago / item.orcado * 100), 100);
    totalPago  += pago;

    const [cls, lbl] = pago >= item.orcado ? ['b-quitado','Quitado'] :
                       pago > 0            ? ['b-adiant', 'Parcial']  :
                                             ['b-pendente','Pendente'];
    const barColor = pago >= item.orcado ? 'var(--green-mid)' : pago > 0 ? 'var(--amber-mid)' : 'transparent';

    const tr = document.createElement('tr');
    tr.style.opacity = pago === 0 ? '0.5' : '1';
    tr.innerHTML = `
      <td style="color:var(--text3);font-size:12px">${item.id}</td>
      <td>${esc(item.desc)}</td>
      <td class="right" style="color:var(--text2)">${fmt(item.orcado)}</td>
      <td class="right" style="font-weight:600;color:var(--green)">${pago > 0 ? fmt(pago) : '—'}</td>
      <td class="right" style="color:${saldo>0?'var(--amber)':'var(--green)'}">${saldo > 0 ? fmt(saldo) : '—'}</td>
      <td class="center"><span class="badge ${cls}">${lbl}</span></td>
      <td><div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${barColor}"></div></div></td>
    `;
    tb.appendChild(tr);
  });

  document.getElementById('mo-itens-pago').textContent  = fmt(totalPago);
  document.getElementById('mo-itens-saldo').textContent = fmt(MO_TETO - totalPago);
}

function buildMOProjecao() {
  const tb = document.getElementById('mo-projecao-tbody');
  tb.innerHTML = '';
  let totalProj = 0;
  const pago = totalMOPago();

  MO_PROJECAO_DEF.forEach(item => {
    const jaFoi = moPagamentos.filter(p=>p.itemId===item.id && p.tipo!=='material').reduce((s,p)=>s+p.valor,0);
    const estimado = Math.max(0, (item.orcado * item.prevPct / 100) - jaFoi);
    totalProj += estimado;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--text3);font-size:12px">${item.id}</td>
      <td>${esc(item.desc)}</td>
      <td class="right" style="color:var(--text2)">${fmt(item.orcado)}</td>
      <td class="right">${item.prevPct}%</td>
      <td class="right" style="font-weight:600;color:var(--blue)">${fmt(estimado)}</td>
      <td style="font-size:12px;color:var(--text2)">${item.quando}</td>
    `;
    tb.appendChild(tr);
  });

  document.getElementById('mo-proj-total').textContent = fmt(totalProj);
  const totalFuturo = pago + totalProj;
  const alerta = document.getElementById('mo-proj-alerta');
  if (totalFuturo > MO_TETO) {
    alerta.className = 'alert alert-warn';
    alerta.textContent = `⚠️ Projeção total (pago R$ ${Math.round(pago).toLocaleString('pt-BR')} + estimado R$ ${Math.round(totalProj).toLocaleString('pt-BR')}) = R$ ${Math.round(totalFuturo).toLocaleString('pt-BR')} — ultrapassa o teto de ${fmt(MO_TETO)} em R$ ${Math.round(totalFuturo-MO_TETO).toLocaleString('pt-BR')}.`;
  } else {
    alerta.className = 'alert alert-ok';
    alerta.textContent = `✅ Projeção total dentro do teto: R$ ${Math.round(totalFuturo).toLocaleString('pt-BR')} de ${fmt(MO_TETO)} (sobra R$ ${Math.round(MO_TETO-totalFuturo).toLocaleString('pt-BR')}).`;
  }
}

function buildMOSelectItens() {
  const sel = document.getElementById('mo-inp-item');
  sel.innerHTML = '<option value="">Selecionar item...</option>';
  (obraOriginal ? MO_ITENS_DEF : itens).forEach(i => {
    const o = document.createElement('option');
    o.value = i.id; o.textContent = `${i.id}. ${i.desc}`;
    sel.appendChild(o);
  });
}

/* ══ DESEMBOLSO CONSOLIDADO — MATERIAL + MÃO DE OBRA ═══════════ */
/* Base = saldo do financiamento destinado à obra (dinâmica) */

function buildDesembolso() {
  const mat   = totalMat() + totalMaterial();  // aba Materiais + eventuais lançamentos tipo 'material' na aba MO
  const mo    = totalMOPago();
  const total = mat + mo;

  const pctMat   = mat   / BASE_OBRA * 100;
  const pctMO    = mo    / BASE_OBRA * 100;
  const pctTotal = total / BASE_OBRA * 100;
  const relMat   = total > 0 ? mat / total * 100 : 0;
  const relMO    = total > 0 ? mo  / total * 100 : 0;

  const liberado = MED_VAL;                       // acumulado pago pela CAIXA
  const pctLib   = liberado / BASE_OBRA * 100;
  const saldo    = liberado - total;               // dinheiro em caixa ainda não gasto
  const pctSaldo = saldo / BASE_OBRA * 100;

  const fisico   = MED_PCT;                        // % PLS acumulada
  const desvio   = fisico - pctTotal;              // + = obra adiantada em relação ao gasto

  const p1 = v => v.toFixed(1).replace('.', ',') + '%';
  const set = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };

  // rótulos da base
  const nota = document.getElementById('ds-nota-base');
  if (nota && !obraOriginal) nota.innerHTML = 'Percentuais calculados sobre o <strong>recurso disponível para a obra: ' + fmt(BASE_OBRA) + '</strong>.';
  set('ds-base-sub', 'de ' + fmt(BASE_OBRA));
  set('ds-base-th',  '(' + fmt(BASE_OBRA) + ')');

  // cards
  set('ds-mat',   fmt(mat));
  set('ds-mat-pct-big', p1(pctMat));
  set('ds-mat-sub', materiais.length + ' compra(s) · ' + p1(relMat) + ' do gasto');
  set('ds-mo',    fmt(mo));
  set('ds-mo-pct-big', p1(pctMO));
  set('ds-mo-sub', Math.round(mo / MO_TETO * 100) + '% do teto contratual');
  set('ds-total', fmt(total));
  set('ds-total-pct-big', p1(pctTotal));
  set('ds-pct',    p1(pctTotal));
  set('ds-fisico', p1(fisico));
  set('ds-desvio', (desvio >= 0 ? '+' : '') + p1(desvio));
  set('ds-desvio-sub', desvio >= 0
      ? 'obra medida acima do desembolso'
      : 'desembolso acima do medido');
  const cardDesvio = document.getElementById('ds-card-desvio');
  if (cardDesvio) cardDesvio.className = 'card ' + (desvio >= 0 ? 'ok' : 'warn');

  // barra empilhada
  const bMat = Math.min(pctMat, 100);
  const bMO  = Math.min(pctMO, Math.max(0, 100 - bMat));
  const barMat = document.getElementById('ds-bar-mat');
  const barMO  = document.getElementById('ds-bar-mo');
  if (barMat) { barMat.style.width = bMat + '%'; barMat.textContent = bMat > 7 ? 'Materiais ' + p1(pctMat) : ''; }
  if (barMO)  { barMO.style.left = bMat + '%'; barMO.style.width = bMO + '%'; barMO.textContent = bMO > 5 ? 'MO ' + p1(pctMO) : ''; }
  set('ds-leg-mat',   p1(pctMat));
  set('ds-leg-mo',    p1(pctMO));
  set('ds-leg-falta', p1(Math.max(0, 100 - pctTotal)));

  // tabela
  set('ds-t-mat',       fmt(mat));
  set('ds-t-mat-pci',   p1(pctMat));
  set('ds-t-mat-rel',   p1(relMat));
  set('ds-t-mo',        fmt(mo));
  set('ds-t-mo-pci',    p1(pctMO));
  set('ds-t-mo-rel',    p1(relMO));
  set('ds-t-total',     fmt(total));
  set('ds-t-total-pci', p1(pctTotal));
  set('ds-t-lib',       fmt(liberado));
  set('ds-t-lib-pci',   p1(pctLib));
  set('ds-t-lib-rel',   liberado > 0 ? p1(total / liberado * 100) + ' já aplicado' : '—');
  set('ds-t-saldo',     fmt(saldo));
  set('ds-t-saldo-pci', p1(pctSaldo));
  set('ds-t-saldo-obs', saldo >= 0
      ? 'recurso CAIXA ainda disponível para as próximas compras e pagamentos'
      : 'gasto acima do liberado — diferença coberta por recursos próprios');

  // alerta
  const al = document.getElementById('ds-alerta');
  if (al) {
    if (saldo >= 0) {
      al.className = 'alert alert-ok';
      al.innerHTML = 'Desembolsado <strong>' + p1(pctTotal) + '</strong> do saldo p/ obra (materiais ' + p1(pctMat) +
        ' + MO ' + p1(pctMO) + '). A CAIXA já liberou <strong>' + p1(pctLib) +
        '</strong> — sobra <strong>' + p1(pctSaldo) + '</strong> em caixa' +
        (isAdmin ? ' (' + fmt(saldo) + ').' : '.');
    } else {
      al.className = 'alert alert-warn';
      al.innerHTML = 'Desembolsado <strong>' + p1(pctTotal) + '</strong> do saldo p/ obra, acima dos <strong>' + p1(pctLib) +
        '</strong> liberados pela CAIXA. A diferença saiu de recursos próprios.';
    }
  }
}

function buildAllMO() {
  const dl = document.getElementById('mo-dest-lista');
  if (dl) dl.innerHTML = [...new Set(moPagamentos.map(p => p.dest).filter(Boolean))].map(d => '<option value="' + esc(d) + '">').join('');
  document.querySelectorAll('.js-mo-teto').forEach(e => e.textContent = fmt(MO_TETO));
  buildMOCards();
  buildMOPagamentos();
  buildMOItens();
  buildMOProjecao();
  buildDesembolso();
}

function showMoTab(t, el) {
  document.querySelectorAll('[id^="mo-panel-"]').forEach(p => p.style.display='none');
  document.querySelectorAll('[id^="mo-tab-btn-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('mo-panel-'+t).style.display = 'block';
  el.classList.add('active');
  if (t==='itens')    buildMOItens();
  if (t==='projecao') buildMOProjecao();
}

function registrarPagamentoMO() {
  const data  = document.getElementById('mo-inp-data').value;
  const dest  = document.getElementById('mo-inp-dest').value.trim();
  const valor = parseFloat(document.getElementById('mo-inp-valor').value.replace(',','.'));
  const tipo  = document.getElementById('mo-inp-tipo').value;
  const itemId= parseInt(document.getElementById('mo-inp-item').value) || null;
  const ref   = document.getElementById('mo-inp-ref').value.trim();
  const msg   = document.getElementById('mo-msg');

  if (!data || !dest || isNaN(valor) || valor <= 0) {
    msg.textContent='Preencha data, destinatário e valor.'; msg.className='msg error'; return;
  }
  const dateStr = new Date(data+'T12:00:00').toLocaleDateString('pt-BR');
  const destNome = dest;
  moPagamentos.push({
    id: moPagamentos.length + 1,
    data: dateStr, dest: destNome,
    ref: ref || (tipo==='adiantamento' ? 'Adiantamento' : tipo==='material' ? 'Material' : 'Pagamento MO'),
    valor, tipo, itemId
  });
  msg.textContent = `✓ Pagamento de ${fmt(valor)} registrado.`;
  msg.className = 'msg';
  setTimeout(()=>{msg.textContent='';},3000);
  document.getElementById('mo-inp-valor').value = '';
  document.getElementById('mo-inp-ref').value   = '';
  salvarMO(); buildAllMO();
}

function removerPagMO(idx) {
  if (!confirm('Remover este pagamento?')) return;
  const desc = moPagamentos[idx].dest;
  moPagamentos.splice(idx, 1);
  salvarMO(); buildAllMO();
}
