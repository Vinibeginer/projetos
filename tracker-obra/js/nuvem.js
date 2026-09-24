/* ══ NUVEM — SUPABASE ══════════════════════════════════════ */
const SB_URL  = 'https://qazbyotibhqrwbuvmdza.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhemJ5b3RpYmhxcndidXZtZHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjEzNjcsImV4cCI6MjEwMDM5NzM2N30.YzlSaoUz1G2Or0hIn_yYOghbqRGSj7t1oUcIWohBnps';

let obraVersao = null;     // obras.atualizado_em do último carregamento/gravação
let obraOriginal = false;  // obras.detalhes_fixos: mostra o conteúdo escrito para a obra original
let sb = null, usuario = null, obraAtual = null, minhasObras = [], podeEditar = false, modoCadastro = false;

function sbClient() {
  if (!sb && window.supabase) sb = window.supabase.createClient(SB_URL, SB_ANON);
  return sb;
}
function erroLogin(msg, alvo) {
  const e = document.getElementById(alvo || 'login-error');
  if (e) e.textContent = msg || '';
}
function traduzErro(err) {
  const m = (err && err.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been')) return 'Este e-mail já tem conta. Tente entrar.';
  if (m.includes('password') && m.includes('6'))  return 'A senha precisa ter ao menos 6 caracteres.';
  if (m.includes('email') && m.includes('confirm')) return 'Confirme o e-mail antes de entrar.';
  if (m.includes('rate limit')) return 'Muitas tentativas. Aguarde um minuto.';
  return (err && err.message) || 'Não foi possível concluir.';
}

/* ── datas: banco usa AAAA-MM-DD, o app usa DD/MM/AAAA ── */
/* escapa texto digitado pelo usuário antes de colocar em innerHTML */
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function isoData(br) {
  if (!br) return null;
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(br));
  return m ? m[3] + '-' + m[2] + '-' + m[1] : null;
}
function brData(iso) {
  if (!iso) return '';
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso);
}

/* ── recuperação de senha ── */
async function recuperarSenha() {
  const c = sbClient();
  if (!c) { erroLogin('Sem conexão com o servidor. Recarregue a página.'); return; }
  const email = (document.getElementById('au-email').value || '').trim();
  if (!email) { erroLogin('Digite seu e-mail no campo acima e clique novamente em "Recuperar por e-mail".'); return; }
  erroLogin('');
  const alvo = location.origin + location.pathname + '?recuperar=1';
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: alvo });
  if (error) { erroLogin(traduzErro(error)); return; }
  erroLogin('Enviamos um link para ' + email + '. Abra o e-mail e clique nele para definir a nova senha.');
}

async function salvarNovaSenha() {
  const c = sbClient();
  const s1 = document.getElementById('ns-senha1').value || '';
  const s2 = document.getElementById('ns-senha2').value || '';
  const err = document.getElementById('ns-erro');
  if (s1.length < 6) { err.textContent = 'A senha precisa ter ao menos 6 caracteres.'; return; }
  if (s1 !== s2) { err.textContent = 'As duas senhas não são iguais.'; return; }
  err.textContent = '';
  const { error } = await c.auth.updateUser({ password: s1 });
  if (error) { err.textContent = traduzErro(error); return; }
  document.getElementById('ov-senha').classList.remove('visible');
  // limpa o parâmetro da URL e segue para o app já logado
  history.replaceState(null, '', location.pathname);
  await aposLogin();
}

/* ── consulta pública por código (sem login) ── */
function mostrarConsulta() {
  const w = document.getElementById('cons-wrap');
  w.classList.add('visible');
  erroLogin('');
  document.getElementById('cons-cod').focus();
}
function consultarObra() {
  const c = (document.getElementById('cons-cod').value || '').trim().toUpperCase();
  if (!c) { erroLogin('Digite o código da obra.'); return; }
  location.href = '../acompanhar/?c=' + encodeURIComponent(c);
}

/* ── autenticação ── */
function alternarModoAuth() {
  modoCadastro = !modoCadastro;
  document.getElementById('au-nome').style.display = modoCadastro ? '' : 'none';
  document.getElementById('au-titulo').textContent = modoCadastro ? 'Criar conta' : 'Controle de obra';
  document.getElementById('au-sub').textContent    = modoCadastro ? 'Monte o controle de custos da sua obra' : 'Entre com sua conta para acessar suas obras';
  document.getElementById('au-btn').textContent    = modoCadastro ? 'Criar conta' : 'Entrar';
  document.getElementById('au-hint').innerHTML     = modoCadastro
    ? 'Já tem conta? <span class="link-acao" onclick="alternarModoAuth()">Entrar</span>'
    : 'Ainda não tem conta? <span class="link-acao" onclick="alternarModoAuth()">Criar agora</span>';
  erroLogin('');
}

async function autenticar() {
  const c = sbClient();
  if (!c) { erroLogin('Sem conexão com o servidor. Verifique a internet e recarregue.'); return; }
  const email = (document.getElementById('au-email').value || '').trim();
  const senha = document.getElementById('au-senha').value || '';
  const nome  = (document.getElementById('au-nome').value || '').trim();
  if (!email || !senha) { erroLogin('Informe e-mail e senha.'); return; }
  if (modoCadastro && !nome) { erroLogin('Informe seu nome.'); return; }

  const btn = document.getElementById('au-btn');
  btn.disabled = true; btn.textContent = 'Aguarde...'; erroLogin('');
  try {
    if (modoCadastro) {
      const { data, error } = await c.auth.signUp({ email, password: senha, options: { data: { nome } } });
      if (error) { erroLogin(traduzErro(error)); return; }
      if (!data.session) { erroLogin('Conta criada. Confirme o link enviado para o seu e-mail e depois entre.'); alternarModoAuth(); return; }
    } else {
      const { error } = await c.auth.signInWithPassword({ email, password: senha });
      if (error) { erroLogin(traduzErro(error)); return; }
    }
    await aposLogin();
  } catch (e) {
    erroLogin(traduzErro(e));
  } finally {
    btn.disabled = false;
    btn.textContent = modoCadastro ? 'Criar conta' : 'Entrar';
  }
}

async function aposLogin() {
  const c = sbClient();
  const { data } = await c.auth.getUser();
  usuario = data && data.user;
  await carregarMinhasObras();
}

async function carregarMinhasObras() {
  const c = sbClient();
  const { data, error } = await c.rpc('minhas_obras');
  if (error) { erroLogin('Erro ao carregar obras: ' + error.message); return; }
  minhasObras = data || [];
  if (!minhasObras.length) { mostrarNovaObra(true); return; }
  const ult = localStorage.getItem('obra_ultima');
  const alvo = minhasObras.find(o => o.id === ult) || minhasObras[0];
  await abrirObra(alvo.id);
}

/* ── criação de obra ── */
function mostrarNovaObra(primeira) {
  document.getElementById('ov-obra').classList.add('visible');
  document.getElementById('no-cancelar').style.display = primeira ? 'none' : '';
  document.getElementById('no-nome').focus();
}
function fecharNovaObra() {
  document.getElementById('ov-obra').classList.remove('visible');
  erroLogin('', 'no-erro');
}
async function criarObra() {
  const c = sbClient();
  const nome = (document.getElementById('no-nome').value || '').trim();
  const orc  = numBR(document.getElementById('no-orc').value);
  const base = numBR(document.getElementById('no-base').value) || orc;
  const moT  = numBR(document.getElementById('no-mo').value)   || Math.round(orc * 0.25);
  if (!nome) { erroLogin('Informe o nome da obra.', 'no-erro'); return; }
  if (orc <= 0) { erroLogin('Informe o orçamento total.', 'no-erro'); return; }
  erroLogin('', 'no-erro');

  const { data, error } = await c.from('obras')
    .insert({ dono: usuario.id, nome: nome, orcamento: orc, base_obra: base, mo_teto: moT })
    .select().single();
  if (error) { erroLogin('Erro ao criar: ' + error.message, 'no-erro'); return; }

  fecharNovaObra();
  ['no-nome','no-orc','no-base','no-mo'].forEach(id => document.getElementById(id).value = '');
  await carregarMinhasObrasEAbrir(data.id);
}
async function carregarMinhasObrasEAbrir(id) {
  const c = sbClient();
  const { data } = await c.rpc('minhas_obras');
  minhasObras = data || [];
  await abrirObra(id);
}

/* ── abrir obra e carregar dados ── */
async function abrirObra(id) {
  const alvo = minhasObras.find(o => o.id === id);
  if (!alvo) return;
  // grava o que estiver pendente na obra atual antes de trocar
  if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; await enviarTudo(); }
  while (_enviando) await new Promise(r => setTimeout(r, 100));
  obraAtual = alvo;
  podeEditar = (obraAtual.papel === 'dono' || obraAtual.papel === 'editor');
  isAdmin    = podeEditar;
  localStorage.setItem('obra_ultima', id);
  STORAGE_KEY = 'tracker_obra_' + id;
  BASE_OBRA   = Number(obraAtual.base_obra) || 0;
  ORCAMENTO   = Number(obraAtual.orcamento) || 0;
  MO_TETO     = Number(obraAtual.mo_teto)   || 0;
  marcarSync('baixando');
  await baixarDados();
  iniciarApp();
  ajustarCabecalhoObra();
  renderObraBar();
  // se a aba/sub-aba aberta não existe nesta obra, volta para a inicial
  const aberta = document.querySelector('.panel.active');
  if (aberta && aberta.classList.contains('obra-original')) showTab('tabela', document.querySelector('[onclick^="showTab(\'tabela\'"]'));
  if (!obraOriginal) showMoTab('pagos', document.getElementById('mo-tab-btn-pagos'));
  document.querySelectorAll('.js-base-obra').forEach(e => e.textContent = fmt(BASE_OBRA));
  marcarSync('ok');
}

async function baixarDados() {
  const c = sbClient(), oid = obraAtual.id;
  const [ob, it, mt, mo, md, hs] = await Promise.all([
    c.from('obras').select('*').eq('id', oid).single(),
    c.from('itens').select('*').eq('obra_id', oid).order('ordem'),
    c.from('materiais').select('*').eq('obra_id', oid).order('id'),
    c.from('mo_pagamentos').select('*').eq('obra_id', oid).order('id'),
    c.from('medicoes').select('*').eq('obra_id', oid).order('numero'),
    c.from('historico').select('*').eq('obra_id', oid).order('id')
  ]);
  obraVersao = (ob.data && ob.data.atualizado_em) || null;
  obraOriginal = !!(ob.data && ob.data.detalhes_fixos);
  document.body.classList.toggle('obra-original-on', obraOriginal);
  itens = (it.data || []).map(r => ({ id: r.ordem || r.id, desc: r.descricao, pciPct: +r.pci_pct,
    exec: +r.exec_pct, locked: !!r.travado, prevExec: +r.prev_pct, obs: r.obs || '' }));
  materiais = (mt.data || []).map(r => ({ id: r.id, data: brData(r.data), desc: r.descricao,
    cat: r.categoria, forn: r.fornecedor, ref: r.referencia, valor: +r.valor, pago: r.pago ? 'sim' : 'nao' }));
  moPagamentos = (mo.data || []).map(r => ({ id: r.id, data: brData(r.data), dest: r.destinatario,
    ref: r.referencia, valor: +r.valor, tipo: r.tipo, itemId: r.item_id }));
  medicoesConfirmadas = (md.data || []).map(r => ({ num: r.numero, data: brData(r.data),
    pctCaixa: +r.pct_caixa, valor: +r.valor, ref: r.referencia, itens: r.itens_desc, confirmada: !!r.confirmada }));
  historico = (hs.data || []).map(r => ({ data: r.data_txt || brData(r.data), desc: r.descricao,
    deltaPct: +r.delta_pct, deltaVal: +r.delta_valor, prev: !!r.previsao, obs: r.obs || '' }));

  if (!itens.length) itens = ITENS_DEFAULT.map(i => ({ id: i.id, desc: i.desc, pciPct: i.pciPct,
    exec: 0, locked: false, prevExec: 0, obs: '' }));

  const conf = medicoesConfirmadas.filter(m => m.confirmada);
  MED_PCT = conf.reduce((s, m) => s + (+m.pctCaixa || 0), 0);
  MED_VAL = conf.reduce((s, m) => s + (+m.valor || 0), 0);
  espelharLocal();
}

function espelharLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ itens: itens, historico: historico,
      moPagamentos: moPagamentos, materiais: materiais, medicoesConfirmadas: medicoesConfirmadas,
      savedAt: new Date().toISOString() }));
  } catch (e) {}
}

/* ── envio para a nuvem ── */
let _syncTimer = null;
function marcarSync(estado, detalhe) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  const txt = { salvando: 'salvando...', baixando: 'carregando...', ok: 'salvo na nuvem', erro: 'falha ao salvar' };
  el.textContent = txt[estado] || '';
  if (estado === 'erro' && detalhe) el.textContent += ': ' + detalhe;
  el.style.color = estado === 'erro' ? 'var(--red)' : 'var(--text3)';
  el.title = estado === 'erro' && detalhe ? detalhe : '';
}
function sincronizarNuvem() {
  if (!obraAtual || !podeEditar) return;
  clearTimeout(_syncTimer);
  marcarSync('salvando');
  _syncTimer = setTimeout(() => { _syncTimer = null; enviarTudo(); }, 900);
}
async function repor(tabela, oid, linhas) {
  const c = sbClient();
  const d = await c.from(tabela).delete().eq('obra_id', oid);
  if (d.error) throw d.error;
  if (linhas.length) {
    const i = await c.from(tabela).insert(linhas);
    if (i.error) throw i.error;
  }
}
function montarPayload(oid) {
  const semId = oid === undefined;
  const o = semId ? {} : { obra_id: oid };
  return {
    itens: itens.map(i => ({ ...o, ordem: i.id, descricao: i.desc,
      pci_pct: i.pciPct || 0, exec_pct: i.exec || 0, travado: !!i.locked, prev_pct: i.prevExec || 0, obs: i.obs || '' })),
    materiais: materiais.map(m => ({ ...o, data: isoData(m.data), descricao: m.desc,
      categoria: m.cat, fornecedor: m.forn, referencia: m.ref, valor: m.valor || 0, pago: (m.pago === 'sim' || m.pago === true) })),
    mo_pagamentos: moPagamentos.map(p => ({ ...o, data: isoData(p.data), destinatario: p.dest,
      referencia: p.ref, valor: p.valor || 0, tipo: p.tipo || 'mo', item_id: p.itemId || null })),
    medicoes: medicoesConfirmadas.map(m => ({ ...o, numero: m.num, data: isoData(m.data),
      pct_caixa: m.pctCaixa || 0, valor: m.valor || 0, referencia: m.ref, itens_desc: m.itens, confirmada: !!m.confirmada })),
    historico: historico.map(h => ({ ...o, data: isoData(h.data), data_txt: h.data,
      descricao: h.desc, delta_pct: h.deltaPct || 0, delta_valor: h.deltaVal || 0, previsao: !!h.prev, obs: h.obs || '' }))
  };
}
/* gravação antiga, tabela por tabela — só usada se a função salvar_obra ainda não existir no banco */
async function enviarLegado(oid) {
  const d = montarPayload(oid);
  for (const t of ['itens', 'materiais', 'mo_pagamentos', 'medicoes', 'historico']) await repor(t, oid, d[t]);
}
let _enviando = false, _reenviar = false;
async function enviarTudo() {
  if (!obraAtual || !podeEditar) return;
  if (_enviando) { _reenviar = true; return; }   // um envio por vez; o próximo sai logo depois
  _enviando = true;
  const oid = obraAtual.id;
  try {
    const { data, error } = await sbClient().rpc('salvar_obra',
      { p_obra: oid, p_dados: montarPayload(), p_versao: obraVersao });
    if (error && error.code === 'PGRST202') await enviarLegado(oid);
    else if (error) throw error;
    else if (obraAtual && obraAtual.id === oid) obraVersao = data;
    marcarSync('ok');
  } catch (e) {
    if (e && e.code === '40001') {
      marcarSync('erro', 'a obra foi alterada em outro lugar — recarregue a página antes de continuar');
      alert('Esta obra foi alterada em outra aba ou por outra pessoa.\n\nSuas últimas alterações NÃO foram salvas. Recarregue a página para ver a versão atual.');
    } else {
      marcarSync('erro', (e && (e.message || e.error_description || e.hint)) || String(e));
    }
    console.error('Falha ao sincronizar:', e);
  } finally {
    _enviando = false;
    if (_reenviar) { _reenviar = false; enviarTudo(); }
  }
}

/* ── abas de obra ── */
function semDados() { return (materiais.length + moPagamentos.length) === 0; }
function renderObraBar() {
  const el = document.getElementById('obra-bar');
  if (!el) return;
  let h = minhasObras.map(function (o) {
    const on = (obraAtual && o.id === obraAtual.id) ? ' on' : '';
    const papel = (o.papel !== 'dono') ? '<span class="obra-papel">somente leitura</span>' : '';
    return '<button class="obra-tab' + on + '" onclick="abrirObra(\'' + o.id + '\')">' +
      '<span class="obra-nome">' + esc(o.nome) + '</span>' +
      '<span class="obra-tag">' + esc(o.tag) + '</span>' + papel + '</button>';
  }).join('');
  h += '<button class="obra-tab novo" onclick="mostrarNovaObra(false)">+ Nova obra</button>';
  if (podeEditar && semDados() && localStorage.getItem('tracker_obra_vinicius_v2')) {
    h += '<button class="obra-tab novo" onclick="importarDadosLocais()">Importar dados desta página</button>';
  }
  h += '<span class="sync-badge" id="sync-badge"></span>';
  el.innerHTML = h;
}
function ajustarCabecalhoObra() {
  const h1 = document.querySelector('.header-left h1');
  const p  = document.querySelector('.header-left p');
  if (h1 && obraAtual) h1.textContent = 'Tracker de obra — ' + obraAtual.nome;
  if (p && obraAtual) {
    p.innerHTML = 'Código ' + esc(obraAtual.tag) + ' · ' + (podeEditar ? 'acesso de edição' : 'somente leitura') +
      ' · <span id="app-version-badge" style="font-weight:600;color:var(--blue)">v' + APP_VERSION + '</span>';
  }
  const badge = document.getElementById('badge-role');
  if (badge) {
    badge.textContent = podeEditar ? 'Editando' : 'Leitura';
    badge.className = 'badge-role ' + (podeEditar ? 'badge-admin' : 'badge-visitor');
  }
}

/* ── importar os dados que estão nesta página / no navegador ── */
async function importarDadosLocais() {
  if (!podeEditar) return;
  if (!confirm('Importar os dados desta página para a obra "' + obraAtual.nome + '"? O conteúdo atual da obra na nuvem será substituído.')) return;
  itens               = JSON.parse(JSON.stringify(ITENS_DEFAULT));
  historico           = JSON.parse(JSON.stringify(HISTORICO_DEFAULT));
  moPagamentos        = JSON.parse(JSON.stringify(MO_PAGAMENTOS_DEF));
  materiais           = JSON.parse(JSON.stringify(MAT_DEF));
  medicoesConfirmadas = JSON.parse(JSON.stringify(MEDICOES_DEF));
  try {
    const raw = localStorage.getItem('tracker_obra_vinicius_v2');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.itens)               itens = s.itens;
      if (s.historico)           historico = s.historico;
      if (s.moPagamentos)        moPagamentos = s.moPagamentos;
      if (s.materiais)           materiais = s.materiais;
      if (s.medicoesConfirmadas) medicoesConfirmadas = s.medicoesConfirmadas;
    }
  } catch (e) {}
  marcarSync('salvando');
  await enviarTudo();
  await baixarDados();
  iniciarApp();
  ajustarCabecalhoObra();
  renderObraBar();
}

async function sairConta() {
  const c = sbClient();
  if (c) { try { await c.auth.signOut(); } catch (e) {} }
  localStorage.removeItem('obra_ultima');
  location.reload();
}
