// ===== 99-boot.js — wires the modules together =====
(function () {
  const DD = window.DD;

  function start() {
    let doc = null;
    let restored = null;
    const saved = DD.persist.load();
    let asBuiltUpdated = false;
    if (saved) {
      doc = saved.doc;
      restored = saved.savedAt;
      try {
        const m = DD.data.migrateAsBuilt(doc);
        doc = m.doc;
        asBuiltUpdated = m.changed;
      } catch (e) {
        console.error('as built migration failed', e);
      }
    } else {
      doc = DD.data.initialState();
      try {
        doc.furniture = DD.catalog.defaultLayout(doc);
      } catch (e) {
        console.error('defaultLayout failed', e);
        doc.furniture = [];
      }
    }
    DD.store = DD.createStore(doc, DD.defaultUI());

    // autosave (debounced) after every committed change
    const autosave = DD.util.debounce(() => {
      if (DD.persist.save(DD.store.doc)) DD.events.emit('saved', { auto: true, at: new Date() });
    }, 800);
    DD.events.on('doc:committed', autosave);

    const step = (name, fn) => {
      try {
        fn();
      } catch (e) {
        console.error('[boot] ' + name + ' failed', e);
        DD.toast('Falha ao iniciar ' + name + ': ' + (e && e.message ? e.message : e), 'error');
      }
    };
    step('interface', () => DD.ui.init());
    step('planta 2D', () => DD.plan2d.init(document.getElementById('plan-canvas')));
    step('vista 3D', () => DD.view3d.init(document.getElementById('view3d'))); // async: lazy-loads three.js
    step('interface', () => DD.ui.ready && DD.ui.ready());

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => DD.plan2d.redraw());
    if (restored) {
      const when = new Date(restored);
      DD.toast('Projeto restaurado do salvamento local (' + when.toLocaleString('pt-BR') + ').', 'info');
    }
    if (asBuiltUpdated) {
      DD.persist.save(DD.store.doc);
      DD.toast('Planta atualizada com as alterações de obra (as built).', 'ok');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
