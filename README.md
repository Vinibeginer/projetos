# tracker-obra
Tracker financeiro da obra — Vinícius Sampaio Ornellas

## Estrutura do tracker (`tracker-obra/`)

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Telas: login, abas e formulários |
| `css/app.css` | Estilos (tema claro/escuro, responsivo) |
| `js/config.js` | Versão, histórico de versões e variáveis da obra aberta |
| `js/nuvem.js` | Supabase: login, obras, carregar e gravar (`salvar_obra`) |
| `js/app.js` | Tema, itens da PCI, tabela, cálculos e registro de avanço |
| `js/mao-de-obra.js` | Mão de obra e desembolso consolidado |
| `js/materiais.js` | Compras de materiais |
| `js/medicoes.js` | Medições confirmadas pela CAIXA |
| `js/init.js` | Aba de versões e inicialização da página |

Os scripts são carregados em ordem e compartilham variáveis globais (sem build).
Ao publicar uma versão nova, atualize o `?v=` das tags em `index.html` para
evitar cache antigo no navegador.

O banco fica em `supabase/migrations/`, aplicado automaticamente pelo GitHub
Actions a cada push na `main`.
