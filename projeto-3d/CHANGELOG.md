# Changelog — Maquete 3D (Obra Mariára)

Registro de versões da maquete 3D. Este histórico fica só neste arquivo,
não aparece na página de visualização (`index.html`).

Convenção: **X.0** = mudança maior (nova funcionalidade principal) ·
**X.Y** = ajuste menor (correção de dados, cálculo ou pequena melhoria).

| Versão | Data | Alterações | Por |
|---|---|---|---|
| 1.0 | 04/07/2026 | Criação da maquete 3D com base no projeto arquitetônico aprovado (térreo, 1º e 2º pavimento, cobertura e fachada). | Claude |
| 1.1 | 04/07/2026 | Publicação no GitHub Pages (pasta `projeto-3d`) e integração do card na home do repositório. | Claude |
| 1.2 | 04/07/2026 | Sincronização automática com o Tracker da Obra: leitura do PCI por item e progresso contínuo (paredes, cobertura, cor de acabamento). | Claude |
| 1.3 | 04/07/2026 | Ajuste manual de alvenaria por pavimento (pré-visualização independente do Tracker) — térreo em 44% (8 fiadas em todas as paredes). | Claude |
| 1.4 | 04/07/2026 | Correção do percentual total: passa a seguir a fórmula real do Tracker (medido CAIXA + executado não medido × escala 0,7533), com PCI teórico como referência. | Claude |
| 1.5 | 04/07/2026 | Implementação do histórico de versões (posteriormente removido da página e movido para este arquivo). | Claude |
| 1.6 | 04/07/2026 | Histórico de versões retirado da página de visualização para não poluir a interface; passa a ser mantido só aqui no `CHANGELOG.md`. Mantido apenas o badge com a versão atual no topo da página. | Claude |
| 1.7 | 04/07/2026 | Adicionadas meta tags de no-cache na página (mesmo problema já visto no Tracker: navegador/CDN servindo versão antiga em cache). Ajuda o navegador a sempre buscar a versão mais recente. | Claude |
| 1.8 | 04/07/2026 | Painel inferior passa a ficar recolhido por padrão (só uma alça visível), para não cobrir a maquete 3D. Toque na alça para abrir/fechar. | Claude |
| 1.9 | 04/07/2026 | Correção: "Medido/confirmado (CAIXA)" volta a mostrar só o que tem comprovante de medição (8,23%), sem somar a estimativa de executado-não-medido. Essa estimativa passa a aparecer separada, igual ao Tracker. | Claude |
| 2.0 | 04/07/2026 | Nova visão "Plantas por pavimento": tela separada da maquete 3D, com aba por andar (Térreo, 1º Pav, 2º Pav, Cobertura) mostrando os ambientes coloridos conforme o % de avanço. Plantas esquemáticas (áreas reais do Quadro de Áreas, disposição proporcional — não é o desenho CAD exato). | Claude |
| 2.1 | 04/07/2026 | Correção importante: 1º e 2º pavimento não puxam mais a % agregada de alvenaria do Tracker por padrão (ficam em 0% até terem avanço próprio real) — só o térreo usa esse valor, já que é o único com avanço confirmado. Adicionado seletor "Edifício completo / Térreo / 1º Pav / 2º Pav / Cobertura" na maquete 3D, para visualizar cada pavimento isoladamente com seu próprio % de avanço. | Claude |
