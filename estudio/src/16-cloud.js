// ===== 16-cloud.js — projeto salvo na nuvem da obra (Supabase), como no Tracker =====
// O projeto inteiro (planta, móveis, pisos, medidas) fica numa linha da tabela projeto_planta, por obra.
// • Depois do login (window.projetoAuth, de auth/sessao.js) o estúdio lê a versão da nuvem;
// • cada alteração é salva no navegador (como antes) e, alguns segundos depois, enviada à nuvem;
// • a gravação leva a versão lida (p_versao): se outra pessoa/aparelho gravou antes, o banco recusa (conflito)
//   e o estúdio carrega a versão da nuvem, guardando a deste aparelho em "Mais opções › Recuperar projeto anterior";
// • sem conexão, as alterações ficam marcadas como pendentes e seguem quando a conexão volta.
// Leitores (membros sem edição) veem a versão da nuvem, mas não gravam.
// Sem login (arquivo aberto localmente, testes) o módulo fica inativo e o estúdio funciona só com o navegador.
(function () {
  const DD = window.DD;
  const TABLE = 'projeto_planta';
  const META_KEY = 'dd.decor.casa.nuvem.v1'; // { obraId, versao, pendente }
  const PUSH_DELAY_MS = 2500;
  const LABEL = 'Carregar da nuvem';

  const S = {
    ctx: null, // { client, obraId, papel }
    active: false,
    canEdit: false,
    versao: null,
    pendente: false,
    applying: false,
    dirtyEarly: false, // alterações feitas antes do login terminar
    sending: false,
    again: false,
    timer: 0,
    status: { state: 'off' },
  };

  // ------------------------------------------------------------------ estado local da sincronização
  function readMeta() {
    try {
      const m = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      return m && typeof m === 'object' ? m : null;
    } catch (e) {
      return null;
    }
  }
  function writeMeta() {
    try {
      localStorage.setItem(META_KEY, JSON.stringify({ obraId: S.ctx && S.ctx.obraId, versao: S.versao, pendente: S.pendente }));
    } catch (e) {
      /* sem localStorage: segue só em memória */
    }
  }
  function setStatus(state, extra) {
    S.status = Object.assign({ state, at: new Date() }, extra || {});
    DD.events.emit('cloud:status', S.status);
  }

  // ------------------------------------------------------------------ servidor
  function fetchRow() {
    return S.ctx.client
      .from(TABLE)
      .select('doc, atualizado_em')
      .eq('obra_id', S.ctx.obraId)
      .maybeSingle()
      .then((res) => {
        if (res.error) throw res.error;
        return res.data || null;
      });
  }
  /** Mesma versão? (o banco devolve o carimbo com microssegundos; compara o texto e, se preciso, o instante) */
  const sameVersion = (a, b) => !!a && !!b && (a === b || Date.parse(a) === Date.parse(b));
  const isConflict = (e) => e && (e.code === '40001' || e.code === '23505');
  const isOffline = (e) => !navigator.onLine || /fetch|network|Failed to/i.test((e && e.message) || '');

  /** Troca o projeto aberto pela versão da nuvem (a atual fica como "projeto anterior" quando havia algo diferente). */
  function adopt(row, why) {
    const valid = DD.persist.validate(row.doc);
    if (!valid) {
      console.warn('[cloud] projeto da nuvem inválido — mantido o deste aparelho');
      return false;
    }
    let next = valid;
    let migrated = false;
    if (DD.data.migrateAsBuilt) {
      const m = DD.data.migrateAsBuilt(valid);
      next = m.doc;
      migrated = m.changed;
    }
    const current = DD.store.doc;
    const same = JSON.stringify(current) === JSON.stringify(next);
    if (!same) {
      if (why === 'conflict' || why === 'first') keepBackup(current);
      S.applying = true;
      try {
        DD.store.replace(next, LABEL, { clearHistory: why !== 'conflict' });
      } finally {
        S.applying = false;
      }
      DD.persist.save(DD.store.doc);
    }
    S.versao = row.atualizado_em;
    S.pendente = migrated && S.canEdit; // a nuvem estava numa versão antiga do as built: atualiza
    writeMeta();
    if (S.pendente) schedulePush(0);
    return !same;
  }
  function keepBackup(doc) {
    try {
      localStorage.setItem(DD.persist.key + '.backup', JSON.stringify({ savedAt: new Date().toISOString(), doc }));
    } catch (e) {
      /* sem espaço: segue sem cópia */
    }
  }

  function push() {
    if (!S.active || !S.canEdit) return Promise.resolve(false);
    if (S.sending) {
      S.again = true;
      return Promise.resolve(false);
    }
    clearTimeout(S.timer);
    S.sending = true;
    setStatus('sending');
    const doc = DD.store.doc;
    return S.ctx.client
      .rpc('salvar_planta', { p_obra: S.ctx.obraId, p_doc: doc, p_versao: S.versao })
      .then((res) => {
        if (res.error) throw res.error;
        S.versao = res.data;
        S.pendente = DD.store.doc !== doc; // mudou durante o envio: manda de novo
        writeMeta();
        setStatus('saved');
        if (S.pendente) S.again = true;
        return true;
      })
      .catch((e) => {
        if (isConflict(e)) return onConflict();
        console.warn('[cloud] falha ao salvar', e);
        setStatus(isOffline(e) ? 'offline' : 'error', { message: (e && e.message) || String(e) });
        return false;
      })
      .finally(() => {
        S.sending = false;
        if (S.again) {
          S.again = false;
          schedulePush(PUSH_DELAY_MS);
        }
      });
  }
  function onConflict() {
    return fetchRow()
      .then((row) => {
        if (!row) {
          S.versao = null;
          S.again = true;
          return false;
        }
        S.pendente = false;
        adopt(row, 'conflict');
        setStatus('saved');
        DD.toast(
          'O projeto foi alterado em outro aparelho ou por outra pessoa. Carreguei a versão da nuvem; o que você tinha feito aqui ficou em “Mais opções › Recuperar projeto anterior”.',
          'warn'
        );
        return false;
      })
      .catch((e) => {
        setStatus('error', { message: (e && e.message) || String(e) });
        return false;
      });
  }
  function schedulePush(delay) {
    if (!S.active || !S.canEdit) return;
    clearTimeout(S.timer);
    S.timer = setTimeout(push, delay == null ? PUSH_DELAY_MS : delay);
  }
  function onCommitted() {
    if (S.applying) return;
    if (!S.ctx) {
      S.dirtyEarly = true;
      return;
    }
    S.pendente = true;
    writeMeta();
    if (!S.active) return;
    if (!S.canEdit) return setStatus('readonly');
    setStatus('pending');
    schedulePush();
  }

  /** Ao voltar para a aba: se a nuvem mudou e aqui não há nada pendente, carrega a versão nova. */
  function refresh() {
    if (!S.active || S.sending || S.pendente) return Promise.resolve(false);
    return fetchRow()
      .then((row) => {
        if (!row || sameVersion(row.atualizado_em, S.versao) || S.pendente) return false;
        const changed = adopt(row, 'remote');
        if (changed) DD.toast('Projeto atualizado com a versão da nuvem.', 'info');
        setStatus('saved');
        return changed;
      })
      .catch(() => false);
  }

  // ------------------------------------------------------------------ início (depois do boot do estúdio)
  function start(auth) {
    DD.events.on('doc:committed', onCommitted);
    const a = auth || window.projetoAuth;
    if (!a || !a.ready) return Promise.resolve(false);
    return Promise.resolve(a.ready)
      .then((ctx) => {
        if (!ctx || !ctx.client || !ctx.obraId || ctx.offline) {
          if (ctx && ctx.offline) setStatus('offline');
          return false;
        }
        S.ctx = ctx;
        S.canEdit = ctx.papel === 'dono' || ctx.papel === 'editor';
        const meta = readMeta();
        const mine = meta && meta.obraId === ctx.obraId ? meta : null;
        S.versao = mine ? mine.versao : null;
        S.pendente = !!(mine && mine.pendente) || S.dirtyEarly;
        setStatus('sending');
        return fetchRow().then((row) => {
          S.active = true;
          if (!row) {
            // primeira vez: o projeto deste aparelho vira o da nuvem
            S.versao = null;
            if (S.canEdit) return push();
            setStatus('readonly');
            return false;
          }
          if (mine && sameVersion(row.atualizado_em, mine.versao)) {
            // nuvem igual à última sincronização: só envia se há alteração pendente aqui
            if (S.pendente && S.canEdit) return push();
            setStatus(S.canEdit ? 'saved' : 'readonly');
            return false;
          }
          // a nuvem mudou desde a última vez (ou este aparelho nunca sincronizou)
          const conflict = S.pendente && (mine || S.dirtyEarly);
          const changed = adopt(row, conflict ? 'conflict' : mine ? 'remote' : 'first');
          setStatus(S.canEdit ? 'saved' : 'readonly');
          if (conflict && changed)
            DD.toast(
              'Havia alterações neste aparelho que não chegaram à nuvem, e o projeto mudou em outro lugar. Carreguei a versão da nuvem; as alterações daqui ficaram em “Mais opções › Recuperar projeto anterior”.',
              'warn'
            );
          else if (changed) DD.toast('Projeto carregado da nuvem da obra.', 'ok');
          return changed;
        });
      })
      .catch((e) => {
        console.warn('[cloud] não foi possível ler o projeto da nuvem', e);
        setStatus(isOffline(e) ? 'offline' : 'error', { message: (e && e.message) || String(e) });
        return false;
      });
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('online', () => {
      if (S.active && S.pendente) schedulePush(0);
    });
    if (typeof document !== 'undefined' && document.addEventListener)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (S.pendente) schedulePush(0);
        else refresh();
      });
  }

  DD.cloud = {
    start,
    push,
    refresh,
    status: () => S.status,
    active: () => S.active,
    canEdit: () => S.canEdit,
    /** Envia já o que estiver pendente (botão Salvar). */
    flush: () => (S.active && S.canEdit ? push() : Promise.resolve(false)),
  };
})();
