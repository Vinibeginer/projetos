/* ═══════════════════════════════════════════════════════════════
   auth/sessao.js — acesso restrito às páginas do projeto

   Incluir como PRIMEIRO script do <head> de cada página protegida:
     <script src="../auth/sessao.js"></script>

   O que faz:
   • esconde a página até confirmar o acesso;
   • usa a mesma conta/sessão do Tracker (Supabase, mesma chave no navegador);
   • libera só quem é dono ou membro da obra do projeto (função acesso_projeto no banco);
   • sem sessão → vai para a tela de login (página inicial) e volta para cá depois;
   • expõe window.projetoAuth = { ready: Promise<{client, user, obraId, papel}>, sair() }.

   Limite: o código destas páginas está num repositório público — o login controla
   quem usa o site e quem lê os dados guardados no banco (Tracker, projeto estrutural).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var SB_URL = 'https://qazbyotibhqrwbuvmdza.supabase.co';
  var SB_ANON =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhemJ5b3RpYmhxcndidXZtZHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjEzNjcsImV4cCI6MjEwMDM5NzM2N30.YzlSaoUz1G2Or0hIn_yYOghbqRGSj7t1oUcIWohBnps';
  var SB_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  var CACHE_KEY = 'projeto.acesso';
  var CACHE_MS = 15 * 60 * 1000;

  var me = document.currentScript;
  var ROOT = me && me.src ? new URL('../', me.src).href : location.origin + '/';
  var isLoginPage = !!(me && me.hasAttribute('data-login'));

  // ---------------------------------------------------------------- esconde a página até confirmar
  var cached = null;
  try {
    cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
  } catch (e) {
    cached = null;
  }
  var fresh = cached && cached.ate > Date.now();
  var veil = null;
  if (!isLoginPage && !fresh) {
    veil = document.createElement('style');
    veil.textContent = 'html{visibility:hidden!important}';
    document.head.appendChild(veil);
  }
  function reveal() {
    if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
    veil = null;
  }

  // ---------------------------------------------------------------- utilidades
  function loadSupabase() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SB_JS;
      s.onload = function () {
        window.supabase && window.supabase.createClient ? resolve(window.supabase) : reject(new Error('supabase-js incompleto'));
      };
      s.onerror = function () {
        reject(new Error('Não foi possível carregar o login.'));
      };
      document.head.appendChild(s);
    });
  }
  var clientPromise = null;
  function client() {
    if (!clientPromise)
      clientPromise = loadSupabase().then(function (lib) {
        return lib.createClient(SB_URL, SB_ANON); // chave de sessão padrão: a mesma do Tracker
      });
    return clientPromise;
  }
  function loginURL(extra) {
    var next = location.pathname + location.search + location.hash;
    return ROOT + '?' + (extra ? extra + '&' : '') + 'next=' + encodeURIComponent(next);
  }
  function remember(user, acc) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ user: user.id, obra: acc.obra_id, papel: acc.papel, ate: Date.now() + CACHE_MS }));
    } catch (e) {
      /* sem sessionStorage */
    }
  }
  function forget() {
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch (e) {
      /* sem sessionStorage */
    }
  }
  function blocked(msg) {
    reveal();
    var show = function () {
      document.body.innerHTML = '';
      var box = document.createElement('div');
      box.setAttribute('role', 'alert');
      box.style.cssText =
        'font:15px/1.5 system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:24px;border:1px solid #ccc;border-radius:12px;background:#fff;color:#222';
      box.innerHTML = '<strong>Não foi possível verificar o acesso.</strong><p style="margin:8px 0 16px"></p>';
      box.querySelector('p').textContent = msg;
      var again = document.createElement('button');
      again.textContent = 'Tentar de novo';
      again.onclick = function () {
        location.reload();
      };
      box.appendChild(again);
      document.body.appendChild(box);
    };
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show);
  }

  /** Confere sessão + acesso à obra. → { client, user, obraId, papel } ou null (sem sessão / sem acesso). */
  function verificar() {
    return client().then(function (c) {
      return c.auth.getSession().then(function (r) {
        var session = r && r.data && r.data.session;
        if (!session) return { c: c, user: null, acc: null };
        return c.rpc('acesso_projeto').then(function (res) {
          if (res.error) throw res.error;
          var acc = Array.isArray(res.data) ? res.data[0] : res.data;
          return { c: c, user: session.user, acc: acc || null };
        });
      });
    });
  }

  var ready;
  if (isLoginPage) {
    // A página de login decide o que fazer; aqui só oferecemos as funções.
    ready = verificar().then(function (v) {
      if (v.user && v.acc) remember(v.user, v.acc);
      else forget();
      return { client: v.c, user: v.user, obraId: v.acc ? v.acc.obra_id : null, papel: v.acc ? v.acc.papel : null };
    });
  } else {
    ready = verificar().then(
      function (v) {
        if (!v.user) {
          forget();
          location.replace(loginURL());
          return new Promise(function () {}); // a navegação segue
        }
        if (!v.acc) {
          forget();
          location.replace(loginURL('sem-acesso=1'));
          return new Promise(function () {});
        }
        remember(v.user, v.acc);
        reveal();
        return { client: v.c, user: v.user, obraId: v.acc.obra_id, papel: v.acc.papel };
      },
      function (err) {
        // Sem conexão com o servidor: com uma confirmação recente, a página continua aberta.
        if (fresh) {
          reveal();
          return client().then(function (c) {
            return { client: c, user: { id: cached.user }, obraId: cached.obra, papel: cached.papel, offline: true };
          });
        }
        blocked((err && err.message) || 'Sem conexão com o servidor.');
        throw err;
      }
    );
  }
  ready.catch(function () {
    /* tratado acima */
  });

  window.projetoAuth = {
    ROOT: ROOT,
    ready: ready,
    client: client,
    sair: function () {
      forget();
      return client()
        .then(function (c) {
          return c.auth.signOut();
        })
        .catch(function () {})
        .then(function () {
          location.href = ROOT;
        });
    },
  };
})();
