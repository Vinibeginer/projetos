/* ══ VERSÕES ══════════════════════════════════════════════════ */
function buildVersoes() {
  const el = document.getElementById('versao-atual-label');
  if (el) el.textContent = 'v' + APP_VERSION + ' · ' + VERSOES[VERSOES.length-1].data;

  const badge = document.getElementById('app-version-badge');
  if (badge) badge.textContent = 'v' + APP_VERSION;

  const tb = document.getElementById('versoes-tbody');
  if (!tb) return;
  tb.innerHTML = '';
  VERSOES.slice().reverse().forEach((v, i) => {
    const isLatest = i === 0;
    const tr = document.createElement('tr');
    tr.style.background = isLatest ? 'var(--color-background-info)' : '';
    tr.innerHTML = `
      <td style="font-weight:600;color:${isLatest?'var(--color-text-info)':'var(--color-text-primary)'}">
        v${v.v}${isLatest?' <span style="font-size:10px;background:var(--color-background-info);color:var(--color-text-info);padding:1px 6px;border-radius:8px;font-weight:600;border:1px solid var(--color-border-info)">atual</span>':''}
      </td>
      <td style="font-size:12px;color:var(--color-text-secondary);white-space:nowrap">${v.data}</td>
      <td style="font-size:13px">${v.desc}</td>
      <td class="center" style="font-size:12px;color:var(--color-text-secondary)">${v.autor}</td>
    `;
    tb.appendChild(tr);
  });
}

/* ══ INIT PATCH ═══════════════════════════════════════════════ */


(function init() {
  aplicarTema(temaAtual());
  const cc = document.getElementById('cons-cod');
  if (cc) cc.addEventListener('keydown', function (e) { if (e.key === 'Enter') consultarObra(); });
  const se = document.getElementById('au-senha');
  if (se) se.addEventListener('keydown', function (e) { if (e.key === 'Enter') autenticar(); });
  const c = sbClient();
  if (!c) { erroLogin('Não foi possível carregar a conexão com o servidor. Recarregue a página.'); return; }
  // quando o usuário volta pelo link do e-mail, o Supabase dispara este evento
  c.auth.onAuthStateChange(function (evento) {
    if (evento === 'PASSWORD_RECOVERY') {
      document.getElementById('ov-senha').classList.add('visible');
    }
  });
  const querRecuperar = new URLSearchParams(location.search).get('recuperar');
  c.auth.getSession().then(function (r) {
    if (querRecuperar) return;            // aguarda o evento de recuperação, não entra no app
    if (r && r.data && r.data.session) { aposLogin(); }
  });
})();

function iniciarAppMO() {
  carregarMO();
  carregarMat();
  carregarMedicoes();
  buildMOSelectItens();
  buildAllMO();
  buildAllMat();
  buildMedicoesConfirmadas();
  document.getElementById('mo-inp-data').value  = new Date().toISOString().split('T')[0];
  document.getElementById('mat-inp-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('med-inp-data').value = new Date().toISOString().split('T')[0];
}
