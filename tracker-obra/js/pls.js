/* ══ PLS EM PDF: anexar e ler automaticamente ═══════════════════
   O PDF gerado pela planilha da CAIXA tem texto: cada serviço vem numa
   linha com incidência, % do item e execução na obra. A leitura usa a
   posição dos textos na página (pdf.js). PDF digitalizado (só imagem)
   não tem texto: nesse caso o arquivo é anexado e a grade é preenchida
   à mão. O arquivo fica no Storage do Supabase (bucket privado "pls"). */

const PDFJS_URL    = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

/* serviços na ordem da PLS — a posição é o nº do item no tracker */
const PLS_SERVICOS = ['Serviços Preliminares e Gerais', 'Infraestrutura', 'Supra estrutura', 'Paredes e Painéis', 'Esquadrias',
  'Vidros e Plásticos', 'Coberturas', 'Impermeabilizações', 'Revestimentos Internos', 'Forros', 'Revestimentos Externos', 'Pintura',
  'Pisos', 'Acabamentos', 'Inst. Elétricas e Telefônicas', 'Instalações Hidráulicas', 'Inst. Esgoto e Águas Pluviais',
  'Louças e Metais', 'Complementos', 'Outros Serviços'];

let _pdfjs = null;
async function carregarPdfJs() {
  if (_pdfjs) return _pdfjs;
  _pdfjs = await import(PDFJS_URL);
  _pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return _pdfjs;
}

const numPLS  = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
const ehNum   = s => /^\d{1,3}(\.\d{3})*,\d{2}$/.test(s);
const ehData  = s => /^\d{2}\/\d{2}\/\d{4}$/.test(s);
const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* lê a 1ª página da PLS: % de cada item e os campos de controle */
async function lerPLS(arquivo) {
  const pdfjs = await carregarPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const pg = await doc.getPage(1), vp = pg.getViewport({ scale: 1 });
  const tc = await pg.getTextContent();
  const t = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: i.transform[4], y: vp.height - i.transform[5] }));
  const r = { temTexto: t.length > 20, itens: {}, achados: 0 };
  if (!r.temTexto) return r;

  const meio  = vp.width * 0.5;                       // tabela de serviços fica na metade esquerda
  const linha = it => t.filter(o => Math.abs(o.y - it.y) <= 3).sort((a, b) => a.x - b.x);
  const acha  = rot => t.find(o => semAcento(o.s).startsWith(semAcento(rot)));

  PLS_SERVICOS.forEach((nome, k) => {
    const rot = acha(nome);
    if (!rot) return;
    const l = linha(rot).filter(o => o.x > rot.x && o.x < meio);
    const nums = l.filter(o => ehNum(o.s)).map(o => numPLS(o.s));
    const pct  = l.find(o => /^\d+(,\d+)?\s*%$/.test(o.s));
    let v;
    if (pct) v = numPLS(pct.s.replace('%', ''));
    else if (nums.length >= 2 && nums[0] > 0) v = Math.round(nums[nums.length - 1] / nums[0] * 100);   // execução na obra ÷ incidência
    else v = 0;
    r.itens[k + 1] = Math.min(100, Math.max(0, v));
    r.achados++;
  });

  const numeroDaLinha = (rot, ultimo) => {
    const o = acha(rot); if (!o) return null;
    const ns = linha(o).filter(x => x.x > o.x && x.x < meio && ehNum(x.s));
    return ns.length ? numPLS((ultimo ? ns[ns.length - 1] : ns[0]).s) : null;
  };
  r.acumAtual    = numeroDaLinha('Mensurado Acumulado Atual', true);
  r.acumAnterior = numeroDaLinha('Mensurado acumulado no mês anterior', true);
  r.etapaPct     = numeroDaLinha('% Executado nessa etapa', true);
  const er = acha('Etapa de referência');
  if (er) { const n = linha(er).find(x => x.x > er.x && x.x < meio && /^\d+$/.test(x.s)); r.etapaRef = n ? +n.s : null; }
  const dl = acha('Data do Levantamento');
  if (dl) { const d = linha(dl).find(x => x.x > dl.x && ehData(x.s)); r.dataLevantamento = d ? d.s : null; }
  const al = acha('Data Emissão Alvará');
  if (al) { const ds = linha(al).filter(x => x.x > al.x && ehData(x.s)); r.alvaraEmissao = ds[0] ? ds[0].s : null; r.alvaraVigencia = ds[1] ? ds[1].s : null; }
  return r;
}

const dataBR = s => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ''); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };

/* ── no formulário de nova medição ─────────────────────────────── */
let plsArquivoPendente = null;   // PDF escolhido, enviado ao Storage quando a medição é confirmada
let plsLida = null;

async function escolherPLS(input) {
  const arq = input.files && input.files[0];
  const box = document.getElementById('pls-leitura');
  plsArquivoPendente = null; plsLida = null;
  buildGradePLS();                                  // volta a grade ao estado inicial antes de ler outro arquivo
  if (!arq) { box.style.display = 'none'; return; }
  if (!/\.pdf$/i.test(arq.name) && arq.type !== 'application/pdf') {
    box.className = 'alert alert-warn'; box.innerHTML = 'Envie o PDF da PLS.'; box.style.display = ''; input.value = ''; return;
  }
  plsArquivoPendente = arq;
  box.className = 'alert alert-info'; box.innerHTML = 'Lendo a PLS…'; box.style.display = '';
  let r;
  try { r = await lerPLS(arq); }
  catch (e) {
    console.error('PLS:', e);
    box.className = 'alert alert-warn';
    box.innerHTML = `Não foi possível ler o PDF (${esc(e.message || String(e))}). O arquivo será anexado à medição; preencha a grade abaixo.`;
    return;
  }
  plsLida = r;
  if (!r.temTexto || r.achados < 15) {
    box.className = 'alert alert-warn';
    box.innerHTML = `📎 <strong>${esc(arq.name)}</strong> anexado. ` + (r.temTexto
      ? `Só ${r.achados} de 20 serviços foram reconhecidos — confira e complete a grade abaixo.`
      : 'Este PDF é digitalizado (imagem), sem texto para ler: preencha a grade abaixo com a coluna "Execução do Item".');
  }
  // preenche a grade com os % do documento
  document.querySelectorAll('#pls-tbody .pls-inp').forEach(inp => {
    const v = r.itens[+inp.dataset.ordem];
    if (v !== undefined) inp.value = v;
  });
  conferirPLS();
  if (r.temTexto && r.achados >= 15) mostrarLeituraPLS(arq, r);
}

/* resumo da leitura + conferências do documento */
function mostrarLeituraPLS(arq, r) {
  const box = document.getElementById('pls-leitura');
  const pago = Math.round(pagoAcumulado() * 100) / 100;
  const calc = Math.round(plsAcumulado(r.itens) * 100) / 100;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const ok = [], alerta = [];
  ok.push(`${r.achados} serviços lidos · acumulado ${r.acumAtual != null ? pct2(r.acumAtual) : pct2(calc)}`);
  if (r.acumAtual != null && Math.abs(r.acumAtual - calc) > 0.05)
    alerta.push(`O "Mensurado Acumulado Atual" da PLS (${pct2(r.acumAtual)}) não bate com a soma dos itens (${pct2(calc)}).`);
  if (r.acumAnterior != null) {
    const d = r.acumAnterior - pago;
    if (Math.abs(d) > 0.05)
      alerta.push(`<strong>Acumulado anterior errado:</strong> a PLS informa ${pct2(r.acumAnterior)}, mas o total já pago é ${pct2(pago)}. ` +
        `Assim a etapa sai ${pct2((r.acumAtual ?? calc) - r.acumAnterior)} em vez de ${pct2((r.acumAtual ?? calc) - pago)} ` +
        `(${d > 0 ? 'a menos' : 'a mais'} ≈ ${fmt(Math.abs(d) / 100 * BASE_OBRA)}). Peça a correção da linha "Acumul. Aferido" ao RT.`);
    else ok.push(`acumulado anterior ${pct2(r.acumAnterior)} = total pago`);
  }
  if (r.etapaPct != null) ok.push(`% desta etapa na PLS: ${pct2(r.etapaPct)}`);
  if (r.alvaraVigencia) {
    const v = dataBR(r.alvaraVigencia);
    if (v && v < hoje) alerta.push(`<strong>Alvará vencido</strong> em ${r.alvaraVigencia} (a PLS declara válido).`);
    else ok.push(`alvará válido até ${r.alvaraVigencia}`);
  }
  if (r.dataLevantamento) {
    const d = dataBR(r.dataLevantamento);
    const ult = medicoesConfirmadas.length ? dataBR(medicoesConfirmadas[medicoesConfirmadas.length - 1].data) : null;
    if (d && ((ult && d <= ult) || (hoje - d) / 864e5 > 60))
      alerta.push(`<strong>Data do levantamento desatualizada:</strong> ${r.dataLevantamento}` + (ult ? ` (última medição em ${medicoesConfirmadas[medicoesConfirmadas.length - 1].data})` : '') + '.');
    else ok.push(`levantamento em ${r.dataLevantamento}`);
  }
  if (r.etapaRef != null) ok.push(`etapa de referência ${r.etapaRef}`);
  box.className = alerta.length ? 'alert alert-warn' : 'alert alert-ok';
  box.innerHTML = `📎 <strong>${esc(arq.name)}</strong> — grade preenchida com a PLS.<br>✓ ${ok.join(' · ')}` +
    (alerta.length ? '<br>' + alerta.map(a => '⚠️ ' + a).join('<br>') : '');
  box.style.display = '';
}

/* envia o PDF ao Storage e liga à medição */
async function anexarPLSnaMedicao(m, arq) {
  if (!obraAtual || !arq) return false;
  const caminho = `${obraAtual.id}/medicao-${m.num}-${Date.now()}.pdf`;
  const { error } = await sbClient().storage.from('pls').upload(caminho, arq, { contentType: 'application/pdf', upsert: false });
  if (error) { alert('A medição foi registrada, mas o PDF da PLS não foi anexado: ' + error.message); return false; }
  m.plsArquivo = caminho;
  salvarMedicoes(); buildMedicoesConfirmadas();
  return true;
}

function limparPLSpendente() {
  plsArquivoPendente = null; plsLida = null;
  const inp = document.getElementById('pls-arquivo'); if (inp) inp.value = '';
  const box = document.getElementById('pls-leitura'); if (box) box.style.display = 'none';
}

/* abre o PDF anexado (link temporário) */
async function abrirPLS(idx) {
  const m = medicoesConfirmadas[idx]; if (!m || !m.plsArquivo) return;
  const janela = window.open('', '_blank');
  const { data, error } = await sbClient().storage.from('pls').createSignedUrl(m.plsArquivo, 600);
  if (error || !data) { if (janela) janela.close(); alert('Não foi possível abrir o PDF: ' + (error ? error.message : '')); return; }
  if (janela) janela.location = data.signedUrl; else location.href = data.signedUrl;
}

/* anexar o PDF a uma medição já confirmada (e ler a PLS, se ela ainda não tiver) */
function anexarPLSexistente(idx) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/pdf,.pdf';
  inp.onchange = async () => {
    const arq = inp.files[0], m = medicoesConfirmadas[idx]; if (!arq || !m) return;
    if (!m.pls) {
      try { const r = await lerPLS(arq); if (r.temTexto && r.achados >= 15) m.pls = r.itens; } catch (e) { console.error('PLS:', e); }
    }
    await anexarPLSnaMedicao(m, arq);
  };
  inp.click();
}
