// tools/test-cloud.js — projeto do estúdio salvo na nuvem da obra (16-cloud.js), com um Supabase simulado.
// Run: node tools/test-cloud.js
'use strict';
global.window = global;
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => (store[k] = String(v)),
  removeItem: (k) => delete store[k],
};
Object.defineProperty(global, 'navigator', { value: { onLine: true }, configurable: true });

let fails = 0;
const check = (name, cond, info) => {
  if (!cond) fails++;
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || info === undefined ? '' : ' — ' + info));
};

// ---- "banco": uma linha por obra; salvar_planta com o mesmo controle de versão da migração 0009
function makeServer() {
  const srv = { row: null, clock: 1000, calls: 0, offline: false };
  srv.client = (papel) => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            srv.offline
              ? Promise.reject(new Error('Failed to fetch'))
              : Promise.resolve({ data: srv.row ? { doc: JSON.parse(JSON.stringify(srv.row.doc)), atualizado_em: srv.row.v } : null, error: null }),
        }),
      }),
    }),
    rpc: (name, a) => {
      srv.calls++;
      if (srv.offline) return Promise.reject(new Error('Failed to fetch'));
      if (papel !== 'dono' && papel !== 'editor') return Promise.resolve({ data: null, error: { code: '42501', message: 'sem permissão' } });
      if (srv.row && (a.p_versao == null || a.p_versao !== srv.row.v)) return Promise.resolve({ data: null, error: { code: '40001', message: 'conflito' } });
      srv.row = { doc: JSON.parse(JSON.stringify(a.p_doc)), v: 't' + ++srv.clock };
      return Promise.resolve({ data: srv.row.v, error: null });
    },
  });
  return srv;
}

// ---- um "aparelho": estúdio carregado do zero, com o localStorage que já tiver
function boot(srv, papel) {
  delete global.DD;
  for (const f of ['00-data', '01-core', '11-catalog', '16-cloud']) delete require.cache[require.resolve('../src/' + f + '.js')];
  require('../src/00-data.js');
  require('../src/01-core.js');
  require('../src/11-catalog.js');
  require('../src/16-cloud.js');
  const DD = global.DD;
  DD.toasts = [];
  DD.toast = (msg, kind) => DD.toasts.push([kind, msg]);
  const saved = DD.persist.load();
  let doc = saved ? saved.doc : DD.data.initialState();
  if (!saved) doc.furniture = DD.catalog.defaultLayout(doc);
  DD.store = DD.createStore(doc, DD.defaultUI());
  DD.events.on('doc:committed', () => DD.persist.save(DD.store.doc));
  const auth = { ready: Promise.resolve({ client: srv.client(papel), obraId: 'obra-1', papel }) };
  return DD.cloud.start(auth).then(() => DD);
}
const addPlant = (DD, x) =>
  DD.store.commit(DD.ops.add(DD.store.doc, 'furniture', { id: 'p' + x, floor: 'f0', type: 'plant', x, y: 12000, rot: 0, w: 400, d: 400, h: 900, elev: 0, color: null }), 'Planta');
const plants = (doc) => doc.furniture.filter((f) => /^p\d+$/.test(f.id)).map((f) => f.x).sort().join();

(async () => {
  const srv = makeServer();

  // 1. aparelho A, dono, nuvem vazia: o projeto dele vira o da nuvem
  let A = await boot(srv, 'dono');
  check('A: primeira gravação cria o projeto na nuvem', srv.row && srv.row.v === 't1001' && A.cloud.status().state === 'saved');
  addPlant(A, 5000);
  check('A: alteração fica pendente', A.cloud.status().state === 'pending');
  await A.cloud.push();
  check('A: alteração enviada', plants(srv.row.doc) === '5000' && srv.row.v === 't1002');
  const storeA = JSON.stringify(store);

  // 2. aparelho B (navegador vazio): abre a versão da nuvem
  for (const k of Object.keys(store)) delete store[k];
  let B = await boot(srv, 'editor');
  check('B: projeto carregado da nuvem', plants(B.store.doc) === '5000', plants(B.store.doc));
  check('B: avisa que carregou da nuvem', B.toasts.some(([k, m]) => k === 'ok' && /nuvem/.test(m)));
  addPlant(B, 6000);
  await B.cloud.push();
  check('B: gravou por cima da versão que leu', plants(srv.row.doc) === '5000,6000');
  const storeB = JSON.stringify(store);

  // 3. A volta (mesmo navegador, sem nada pendente): recebe a versão de B
  for (const k of Object.keys(store)) delete store[k];
  Object.assign(store, JSON.parse(storeA));
  A = await boot(srv, 'dono');
  check('A: ao abrir, atualiza com a versão da nuvem', plants(A.store.doc) === '5000,6000');

  // 4. conflito: A e B editam a mesma versão; B grava primeiro, A é recusado e recebe a de B
  addPlant(A, 7000);
  const storeA2 = JSON.stringify(store);
  for (const k of Object.keys(store)) delete store[k];
  Object.assign(store, JSON.parse(storeB));
  B = await boot(srv, 'editor');
  addPlant(B, 8000);
  await B.cloud.push();
  for (const k of Object.keys(store)) delete store[k];
  Object.assign(store, JSON.parse(storeA2));
  // A continua aberto (mesma sessão): o envio pendente dá conflito
  await A.cloud.push();
  check('A: conflito carrega a versão da nuvem', plants(A.store.doc) === '5000,6000,8000', plants(A.store.doc));
  check('A: avisa e guarda a versão dele como projeto anterior', A.toasts.some(([k]) => k === 'warn') && /7000/.test(store[A.persist.key + '.backup'] || ''));
  check('A: nuvem não perdeu a gravação de B', plants(srv.row.doc) === '5000,6000,8000');

  // 5. sem conexão: fica pendente e segue quando volta
  srv.offline = true;
  addPlant(A, 9000);
  await A.cloud.push();
  check('offline: estado "sem conexão"', A.cloud.status().state === 'offline');
  srv.offline = false;
  await A.cloud.push();
  check('conexão voltou: enviado', plants(srv.row.doc) === '5000,6000,8000,9000' && A.cloud.status().state === 'saved');

  // 6. pendente de uma sessão anterior e nuvem sem mudança: envia ao abrir
  srv.offline = true;
  addPlant(A, 9500);
  await A.cloud.push();
  srv.offline = false;
  A = await boot(srv, 'dono');
  check('pendência da sessão anterior enviada ao abrir', plants(srv.row.doc) === '5000,6000,8000,9000,9500');

  // 7. leitor: vê a nuvem, não grava
  for (const k of Object.keys(store)) delete store[k];
  const calls = srv.calls;
  const L = await boot(srv, 'leitor');
  check('leitor: vê o projeto da nuvem', plants(L.store.doc) === '5000,6000,8000,9000,9500');
  addPlant(L, 1234);
  await L.cloud.push();
  check('leitor: não grava', srv.calls === calls && L.cloud.status().state === 'readonly');

  // 8. sem login: módulo inativo, estúdio segue local
  delete global.DD;
  for (const f of ['00-data', '01-core', '16-cloud']) delete require.cache[require.resolve('../src/' + f + '.js')];
  require('../src/00-data.js');
  require('../src/01-core.js');
  require('../src/16-cloud.js');
  global.DD.store = global.DD.createStore(global.DD.data.initialState(), global.DD.defaultUI());
  const r = await global.DD.cloud.start(null);
  check('sem login: inativo, sem erro', r === false && !global.DD.cloud.active());

  console.log(fails ? `test-cloud: ${fails} falha(s)` : 'test-cloud: todos os testes ok');
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
