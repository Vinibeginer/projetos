/* ══ MATERIAIS ════════════════════════════════════════════════ */
const MAT_CORES = {
  'Estrutura':           '#378ADD',
  'Alvenaria':           '#1D9E75',
  'Cobertura':           '#854F0B',
  'Hidráulico':          '#185FA5',
  'Elétrico':            '#EF9F27',
  'Revestimento':        '#D85A30',
  'Piso':                '#639922',
  'Esquadrias':          '#7F77DD',
  'Impermeabilização':   '#0F6E56',
  'Fôrmas e madeira':    '#BA7517',
  'Ferragem':            '#888780',
  'Concreto e argamassa':'#5F5E5A',
  'Acabamento':          '#D4537E',
  'EPI e ferramentas':   '#993C1D',
  'Outros':              '#B4B2A9',
};

const MAT_DEF = [
  { id:1,  data:'24/09/2025', desc:'Madeira para fôrma/escoramento',    cat:'Fôrmas e madeira', forn:'L M de Lucas Rocha Madeira Ltda', ref:'Pix 06346526000104 — realocado da aba MO (v1.49)', valor:1500,    pago:'sim' },
  { id:2,  data:'30/11/2024', desc:'Ferragem + radie',                   cat:'Estrutura',        forn:'Pai de Felipe Versada',          ref:'',                  valor:6780,    pago:'sim' },
  { id:3,  data:'05/06/2025', desc:'7m de brita 1',                      cat:'Estrutura',        forn:'Felipe Total Solar',             ref:'',                  valor:850,     pago:'sim' },
  { id:4,  data:'23/06/2025', desc:'Sondagem',                           cat:'Outros',           forn:'MS GEO',                         ref:'',                  valor:1850,    pago:'sim' },
  { id:5,  data:'29/10/2024', desc:'Caixa d\'agua',                      cat:'Outros',           forn:'Goytacazes',                     ref:'',                  valor:370,     pago:'sim' },
  { id:6,  data:'27/08/2025', desc:'Atualização + Projeto',              cat:'Outros',           forn:'Zé Carlos Eng.',                 ref:'',                  valor:1400,    pago:'sim' },
  { id:7,  data:'27/08/2025', desc:'Areia',                              cat:'Outros',           forn:'Felipe Total',                   ref:'',                  valor:235,     pago:'sim' },
  { id:8,  data:'20/08/2025', desc:'Cimento',                            cat:'Outros',           forn:'JMR',                            ref:'',                  valor:980,     pago:'sim' },
  { id:9,  data:'30/08/2025', desc:'Cimento',                            cat:'Estrutura',        forn:'JMR',                            ref:'',                  valor:1120,    pago:'sim' },
  { id:10, data:'30/08/2025', desc:'Cimento',                            cat:'Estrutura',        forn:'JMR',                            ref:'',                  valor:1050,    pago:'sim' },
  { id:11, data:'30/08/2025', desc:'Ferragem',                           cat:'Estrutura',        forn:'JMR',                            ref:'',                  valor:118,     pago:'sim' },
  { id:12, data:'08/09/2025', desc:'Ferragem',                           cat:'Estrutura',        forn:'JMR',                            ref:'',                  valor:400,     pago:'sim' },
  { id:13, data:'17/09/2025', desc:'Cimento',                            cat:'Estrutura',        forn:'JMR',                            ref:'',                  valor:900,     pago:'sim' },
  { id:14, data:'17/10/2025', desc:'Cimento + impermeabilizante',        cat:'Estrutura',        forn:'JMR',                            ref:'',                  valor:1320,    pago:'sim' },
  { id:15, data:'15/06/2026', desc:'Cimento + lona',                     cat:'Estrutura',        forn:'JMR',                            ref:'',                  valor:1122,    pago:'sim' },
  { id:16, data:'16/06/2026', desc:'Tijolo alvenaria + amarração',       cat:'Alvenaria',        forn:'Pai de Felipe Ver',              ref:'',                  valor:10000,   pago:'sim' },
  { id:17, data:'24/09/2025', desc:'Madeira baldrame',                   cat:'Fôrmas e madeira', forn:'L M Madeiras',                   ref:'',                  valor:1500,    pago:'sim' },
  { id:18, data:'24/09/2025', desc:'Brita 1',                            cat:'Estrutura',        forn:'Felipe Total',                   ref:'',                  valor:850,     pago:'sim' },
  { id:19, data:'27/10/2025', desc:'Piso',                               cat:'Piso',             forn:'Tigrão',                         ref:'',                  valor:588.08,  pago:'sim' },
  { id:20, data:'27/10/2025', desc:'Piso',                               cat:'Piso',             forn:'Tigrão',                         ref:'',                  valor:1334,    pago:'sim' },
  { id:21, data:'27/10/2025', desc:'Piso',                               cat:'Piso',             forn:'Tigrão',                         ref:'',                  valor:1856.68, pago:'sim' },
  { id:25, data:'27/10/2025', desc:'Pisos e revestimentos térreo (complemento s/ comprovante)', cat:'Piso', forn:'A identificar', ref:'Aporte próprio à vista', valor:3221.24, pago:'sim' },
  { id:22, data:'27/10/2025', desc:'Material esgoto',                    cat:'Hidráulico',       forn:'ICS Azevedo',                    ref:'',                  valor:871.64,  pago:'sim' },
  { id:23, data:'09/06/2026', desc:'Poste padrão',                       cat:'Elétrico',         forn:'Monica Santos',                  ref:'',                  valor:700,     pago:'sim' },
  { id:24, data:'09/06/2026', desc:'Instalação padrão elétrica',         cat:'Elétrico',         forn:'Charles',                        ref:'',                  valor:550,     pago:'sim' },
];

let materiais = [];

function salvarMat() {
  espelharLocal(); atualizarTimestamp(); sincronizarNuvem();
}
function carregarMat() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try { const e = JSON.parse(raw); if (e.materiais) materiais = e.materiais; } catch(e){}
}

function totalMat() { return materiais.reduce((s,m)=>s+m.valor,0); }

function buildMatCards() {
  const total = totalMat();
  const maior = materiais.reduce((a,m) => m.valor > (a?.valor||0) ? m : a, null);
  const ultimo = materiais.length ? materiais[materiais.length-1] : null;

  document.getElementById('mat-total').textContent    = fmt(total);
  document.getElementById('mat-total-sub').textContent = materiais.length + ' compra(s) registrada(s)';
  document.getElementById('mat-pagas').textContent    = materiais.filter(m=>m.pago==='sim').length;
  document.getElementById('mat-maior').textContent    = maior ? fmt(maior.valor) : '—';
  document.getElementById('mat-maior-desc').textContent = maior ? maior.desc.substring(0,30) : '—';
  document.getElementById('mat-ultimo').textContent   = ultimo ? ultimo.data : '—';
  document.getElementById('mat-ultimo-desc').textContent = ultimo ? ultimo.desc.substring(0,25) : '—';
}

function buildMatLista() {
  const tb = document.getElementById('mat-lista-tbody');
  tb.innerHTML = '';
  if (!materiais.length) {
    tb.innerHTML = '<tr><td colspan="8" class="empty">Nenhuma compra registrada.</td></tr>';
    document.getElementById('mat-tfoot-total').textContent = fmt(0);
    return;
  }
  materiais.slice().reverse().forEach((m, ri) => {
    const idx = materiais.length - 1 - ri;
    const cor = MAT_CORES[m.cat] || '#888';
    const pagoBadge = m.pago === 'sim'
      ? '<span class="badge b-quitado">Pago</span>'
      : '<span class="badge b-adiant">Pendente</span>';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--text3);font-size:12px">${idx+1}</td>
      <td style="white-space:nowrap;font-size:12px">${esc(m.data)}</td>
      <td>${esc(m.desc)}</td>
      <td><span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${cor};flex-shrink:0;"></span>${esc(m.cat)}
      </span></td>
      <td style="color:var(--text2);font-size:12px">${esc(m.forn || '—')}</td>
      <td class="right" style="font-weight:600;color:var(--blue)">${fmt(m.valor)}</td>
      <td class="center">${pagoBadge}</td>
      <td class="center">
        <button class="btn btn-ghost btn-sm" onclick="removerMat(${idx})" style="color:var(--red);border-color:var(--red);">✕</button>
      </td>
    `;
    tb.appendChild(tr);
  });
  document.getElementById('mat-tfoot-total').textContent = fmt(totalMat());
}

function buildMatCategoria() {
  const tb    = document.getElementById('mat-cat-tbody');
  tb.innerHTML = '';
  const total = totalMat();
  if (!total) { tb.innerHTML='<tr><td colspan="5" class="empty">Nenhuma compra registrada.</td></tr>'; return; }

  const cats = {};
  materiais.forEach(m => {
    if (!cats[m.cat]) cats[m.cat] = { total:0, qtd:0 };
    cats[m.cat].total += m.valor;
    cats[m.cat].qtd++;
  });

  Object.entries(cats)
    .sort((a,b) => b[1].total - a[1].total)
    .forEach(([cat, val]) => {
      const pct = Math.round(val.total / total * 100);
      const cor = MAT_CORES[cat] || '#888';
      const tr  = document.createElement('tr');
      tr.innerHTML = `
        <td style="display:flex;align-items:center;gap:8px;">
          <span style="width:10px;height:10px;border-radius:3px;background:${cor};flex-shrink:0;"></span>${esc(cat)}
        </td>
        <td class="right" style="color:var(--text2)">${val.qtd}</td>
        <td class="right" style="font-weight:600">${fmt(val.total)}</td>
        <td class="right" style="color:var(--text2)">${pct}%</td>
        <td><div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${cor}"></div></div></td>
      `;
      tb.appendChild(tr);
    });
}

function buildAllMat() {
  buildMatCards();
  buildMatLista();
  buildMatCategoria();
  buildDesembolso();
}

function showMatTab(t, el) {
  document.querySelectorAll('[id^="mat-panel-"]').forEach(p => p.style.display='none');
  document.querySelectorAll('[id^="mat-tab-btn-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('mat-panel-'+t).style.display = 'block';
  el.classList.add('active');
  if (t==='categoria') buildMatCategoria();
  if (t==='lista')     buildMatLista();
}

function registrarMaterial() {
  const data  = document.getElementById('mat-inp-data').value;
  const desc  = document.getElementById('mat-inp-desc').value.trim();
  const cat   = document.getElementById('mat-inp-cat').value;
  const valor = parseFloat(document.getElementById('mat-inp-valor').value.replace(',','.'));
  const forn  = document.getElementById('mat-inp-forn').value.trim();
  const ref   = document.getElementById('mat-inp-ref').value.trim();
  const pago  = document.getElementById('mat-inp-pago').value;
  const msg   = document.getElementById('mat-msg');
  if (!data || !desc || isNaN(valor) || valor <= 0) { msg.textContent='Preencha data, descrição e valor.'; msg.className='msg error'; return; }
  const dateStr = new Date(data+'T12:00:00').toLocaleDateString('pt-BR');
  materiais.push({ id: materiais.length+1, data:dateStr, desc, cat, forn, ref, valor, pago });
  document.getElementById('mat-inp-desc').value=''; document.getElementById('mat-inp-valor').value='';
  document.getElementById('mat-inp-forn').value=''; document.getElementById('mat-inp-ref').value='';
  salvarMat(); buildAllMat();
  msg.textContent = `✓ ${desc} — ${fmt(valor)} salvo.`; msg.className='msg';
}
function removerMat(idx) {
  if (!confirm('Remover esta compra?')) return;
  const desc = materiais[idx].desc;
  materiais.splice(idx,1);
  salvarMat(); buildAllMat();
}
