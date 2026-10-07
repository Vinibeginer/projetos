# Regras do projeto (Obra Mariára)

- Responder sempre em português.
- **Toda mudança de projeto (hidrossanitário, elétrica, estrutura, arquitetura) tem que aparecer também no 3D**: no estúdio (`estudio/src/*` → `build3d` de cada módulo, camada do `30-view3d.js`) e no 3D da página do projeto (`estudio/hidrossanitario.html`, `estudio/eletrica.html`). Geometria compartilhada fica no módulo (`DD.hidro`, `DD.eletrica`) e as duas vistas usam a mesma função. Conferir com captura de tela antes de publicar.
- Fluxo: `python3 estudio/tools/build.py estudio/index.html` (de dentro de `estudio/`: `python3 tools/build.py index.html`), testes `node estudio/tools/test-*.js`, commit, push, PR e merge; mandar os PDFs atualizados.
- **Projeto estrutural é privado** (propriedade do calculista, vedado repassar): `estudio/private/` nunca vai para o git; páginas públicas não embutem dados de vigas, pilares ou sapatas; relatórios com esses dados ficam só para o dono da obra.
