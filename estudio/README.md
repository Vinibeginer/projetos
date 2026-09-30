# Estúdio de Decoração — Casa (projeto aprovado)

Ferramenta de decoração e compatibilização em **um único arquivo HTML** sobre a planta aprovada da casa de
3 pavimentos (lote 9 × 20 m).

**Acesse:** https://vinibeginer.github.io/projetos/estudio/

## O que faz
- **Planta 2D** reproduzida das cotas do projeto (mm): paredes estruturais e de vedação desenhadas de forma diferente, portas e janelas conforme o quadro de esquadrias, cotas automáticas ao redor e **área de cada ambiente calculada automaticamente** (confere com as áreas impressas na planta).
- **Móveis em escala real** com um arranjo padrão para os 3 pavimentos: arrastar, girar, redimensionar e **encostar automaticamente na parede** ao se aproximar.
- **Ferramentas:** medição, demolição/alteração de paredes não estruturais (os ambientes se unem e as áreas se recalculam), troca de piso, desfazer/refazer, salvamento local (navegador) e exportação de imagem (PNG) e do projeto (JSON).
- **3D (three.js)** da mesma solução, com vista aérea e **passeio em primeira pessoa** (WASD, sobe a escada).
- **2D ⇄ 3D na mesma página** com transição animada e sincronização em tempo real (inclui modo dividido).
- **Projeto estrutural e compatibilização** (`src/15-structure.js`): pilares, vigas dos níveis 0 / 2,88 / 5,76 / 8,64 m, sapatas e vigas de equilíbrio no 2D e no 3D (com o modo *Só estrutura*), e a lista de conflitos com a arquitetura — pilar em porta ou janela, janela acima do fundo da viga, viga aparente, parede sem viga embaixo, borda da laje — que recalcula quando a planta muda.

### Dados do projeto estrutural
A prancha do projeto estrutural proíbe disponibilizá-lo a terceiros, então **os dados não ficam neste repositório
público**. Para ver a estrutura:
- abra a página e use **Mais opções › Importar projeto** com o arquivo `estrutura.json` (fica guardado só no seu navegador); ou
- gere uma versão privada com os dados embutidos: `python tools/build.py private/estudio-privado.html --estrutura private/estrutura.json` (a pasta `private/` é ignorada pelo Git).

Sem os dados, o estúdio segue com a estrutura inferida da planta (fachadas, divisas e paredes que se repetem no pavimento de cima).

## Desenvolvimento
O código-fonte fica em `src/` (módulos concatenados na ordem do nome). Para gerar a página pública:

```bash
python tools/build.py index.html
```

Testes (Node): `node tools/test-core.js`, `node tools/test-structure.js`, `node tools/test-layout.js`,
`node tools/test-plan2d.js`, `node tools/test-ui.js`, `node tools/test-view3d.js`, `node tools/test-catalog.js`.
O contrato entre os módulos está em `CONTRACT.md`.

## Origem
Base do estúdio: repositório [infosetecinco/estudio-decoracao-casa](https://github.com/infosetecinco/estudio-decoracao-casa)
(commit `1424977`). Integração do projeto estrutural e da compatibilização feita neste repositório.
