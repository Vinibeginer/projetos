# projetos — Obra Mariára
Ferramentas da obra de Vinícius Sampaio Ornellas. Página inicial: `index.html` (links para todos os apps).

| Pasta | O que é |
|---|---|
| `estudio/` | **Estúdio de Decoração** — planta 2D/3D, móveis, passeio, projeto estrutural e compatibilização (ver `estudio/README.md`) |
| `tracker-obra/` | Tracker financeiro e físico da obra |
| `acompanhar/` | Visão de leitura do andamento |
| `projeto-3d/` | Maquete, modelo 3D e o editor da planta anterior ao estúdio |
| `editor-projeto-eletrico/` | Projeto elétrico (NBR 5410) |
| `gastos-pessoais/` | Controle de gastos |

O estúdio segue o padrão do repositório [infosetecinco/estudio-decoracao-casa](https://github.com/infosetecinco/estudio-decoracao-casa):
código em `estudio/src/` (módulos numerados), página gerada com `python estudio/tools/build.py estudio/index.html`,
testes em `estudio/tools/test-*.js` e contrato entre módulos em `estudio/CONTRACT.md`. Os dados do projeto
estrutural não são publicados (ficam em `estudio/private/`, ignorado pelo Git).

## Acesso restrito (login)
A página inicial (`index.html`) é a tela de login: usa a mesma conta do Tracker (Supabase) e só libera quem é
dono ou membro da obra (função `acesso_projeto()`, migração `0008`). As páginas do estúdio, maquetes, projeto
elétrico e gastos incluem `auth/sessao.js` no `<head>`: sem sessão ou sem acesso, voltam para o login.
O dono convida e remove pessoas na seção **Acesso à obra** da página inicial (convite por e-mail; a pessoa cria a
conta em "Criar conta" ou, se já tiver, ganha o acesso no próximo login).

- O Tracker mantém o login próprio (é multi-obra) e o `acompanhar/` segue público pelo código da obra.
- O código das páginas continua num repositório público: o login controla quem usa o site e quem lê os
  **dados do banco** (Tracker, projeto estrutural na tabela `projeto_estrutural`). Para esconder também o código,
  o repositório precisaria ser privado (GitHub Pages em repositório privado exige plano pago).

## Tracker da obra
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
