# 📋 RESUMO DO PROJETO — Editor de Projeto Elétrico NBR 5410
**Para retomar em nova conversa com Claude**

---

## 🔗 Links principais

| Item | URL |
|------|-----|
| **Editor (ao vivo)** | https://vinibeginer.github.io/projetos/editor-projeto-eletrico/ |
| **Repositório GitHub** | https://github.com/Vinibeginer/projetos |
| **Pasta do editor** | https://github.com/Vinibeginer/projetos/tree/main/editor-projeto-eletrico |
| **Landing page** | https://vinibeginer.github.io/projetos/ |
| **Tracker de Obra** | https://vinibeginer.github.io/projetos/tracker-obra/ |
| **Gastos Pessoais** | https://vinibeginer.github.io/projetos/gastos-pessoais/ |

---

## 🏗️ Estrutura do repositório `Vinibeginer/projetos`

```
projetos/
├── index.html                    ← Landing page com links para todos os sistemas
├── README.md
├── tracker-obra/                 ← Tracker de obra (sistema separado)
├── gastos-pessoais/              ← Controle de gastos pessoais
└── editor-projeto-eletrico/
    └── index.html                ← Editor elétrico (arquivo único, autocontido)
```

---

## ⚡ Estado atual do Editor Elétrico (v1.4.0)

### O que é
Aplicação HTML/JS 100% autocontida (sem dependências externas) para elaboração
de projetos elétricos sobre plantas baixas, seguindo a NBR 5410:2023.

### Funcionalidades implementadas
- **3 pavimentos** separados por abas: Térreo, 1° Pavimento, 2° Pavimento
- **Plantas baixas** redesenhadas vetorialmente (SVG → JPEG embutido) com fidelidade
  às cotas do projeto arquitetônico aprovado (processo nº 45594/2024, planta nº 934)
- **Simbologia NBR 5410** completa na barra lateral:
  - Luminária de teto, Arandela/parede
  - Interruptor S1, Interruptor S2 (paralelo)
  - Tomada TUG h=0,30m, Tomada TUE h=1,10m, Tomada AC h=1,80m
  - Quadro de distribuição, Medidor trifásico 3F
  - Exaustor, Sensor de presença
- **Traçado de condutores** com 5 cores (iluminação, TUG, TUE/AC, ramal, especial)
- **Ferramentas**: Selecionar (mover arrastando), Apagar, Traçar condutor
- **Zoom** (scroll + botões), **Pan** (botão central do mouse)
- **Undo** (até 40 níveis)
- **Exportar PDF** (abre janela de impressão com cabeçalho técnico)
- **Painel de controle de versão** (canto inferior direito, botão ⚡ Versão)

### O que AINDA PRECISA ser feito (pendências apontadas)
1. **Ajustes nas plantas bases** — as plantas estão melhores mas podem precisar
   de refinamentos pontuais de posicionamento de portas/janelas após revisão visual
2. **Melhorias no editor em si** — o usuário disse "vou analisar e pedir ajustes"
   após ver a v1.4.0
3. **Projeto elétrico do 2° Pavimento** ainda não foi elaborado no editor
   (só térreo e 1° pav foram trabalhados nos PDFs gerados anteriormente)

---

## 🏠 Projeto arquitetônico de referência

**Proprietária:** Vinícia Sampaio Ornellas
**Endereço:** Av. Amaro Ribeiro Gomes, 236 – Quadra R, Lote 38, Bairro Residencial Village, Campos dos Goytacazes/RJ
**Processo:** nº 45594/2024 | **Planta nº:** 934
**Aprovação:** 05/12/2024 — Secretaria Municipal de Planejamento Urbano
**Responsável técnico:** Raquel Souza Nunes — Arquiteta e Urbanista CAU A277275-2

### Dimensões por pavimento

| Pavimento | Largura | Profundidade | Observação |
|-----------|---------|--------------|------------|
| Térreo | 9,00m | 8,60m | + área grama externa |
| 1° Pavimento | 9,00m | 10,75m | incl. varanda 1,20m |
| 2° Pavimento | 9,00m | 9,50m | varanda coberta + descoberta |

### Cômodos e áreas (do projeto aprovado)

**Térreo:**
- Garagem: A=18,00m² (x=0,15→4,15 / y=4,65→8,45)
- Sala: A=29,60m² (x=4,30→8,85 / y=4,65→8,45)
- Cozinha: A=14,00m² (x=0,15→4,15 / y=0,15→4,50)
- Lavanderia: A=2,16m² (x=0,15→1,65 / y=0,15→1,45)
- Quarto: A=11,74m² (x=4,30→6,10 / y=0,15→4,50)
- Despensa: A=1,76m² (x=6,25→7,15 / y=0,15→1,75)
- Suíte (banh): A=2,88m² (x=6,25→7,15 / y=1,90→4,50)
- Corredor: (x=7,30→8,85 / y=0,15→4,50)
- Escada: x=4,55→5,55 / y=3,85→4,50 (sobe)
- Padrão trifásico: inferior direito (frente do terreno, lado direito)

**1° Pavimento:**
- Closet 1: A=4,00m² (x=0,15→1,65 / y=0,15→3,00)
- Closet 2: A=4,88m² (x=1,80→3,15 / y=0,15→3,00)
- Quarto Master: A=16,17m² (x=3,30→8,85 / y=0,15→4,75)
- Banheiro: A=3,65m² (x=0,15→1,65 / y=3,15→4,75)
- Suíte cômodo: A=3,71m² (x=1,80→3,15 / y=3,15→4,75)
- Circulação: A=9,12m² (x=3,30→8,85 / y=3,15→4,75)
- Quarto 1: A=17,40m² (x=0,15→4,15 / y=4,90→9,25)
- Quarto 2: A=19,79m² (x=4,30→8,85 / y=4,90→9,25)
- Varanda: A=9,14m² (y=9,40→10,60)
- Escada: x=3,30→4,60 / y=3,30→4,90 (desce)

**2° Pavimento:**
- Lavabo: A=2,16m² (x=0,15→1,65 / y=0,15→1,59)
- Varanda coberta: (x=0,15→3,50 / y=0,15→5,00)
- Varanda descoberta: A=37,85m² (x=3,65→8,85 / y=0,15→9,35)
- Alçapão acesso laje: (x=1,75→2,40 / y=1,70→2,35)
- Escada: x=3,65→4,95 / y=3,60→5,35 (desce)

---

## 📁 Arquivos gerados nesta sessão (em /mnt/user-data/outputs)

| Arquivo | Descrição |
|---------|-----------|
| `PE_01_Terreo.pdf` | Projeto elétrico térreo (versão anterior, para referência) |
| `PE_02_1Pavimento.pdf` | Projeto elétrico 1° pav (versão anterior, para referência) |
| `ProjetoEletrico_Editor.jsx` | Componente React do editor (versão inicial) |

---

## 🔑 Token GitHub (para publicar mudanças)

O usuário fornecerá o token na nova conversa. O token tem permissão de escrita
no repositório `Vinibeginer/projetos`.

**Como publicar uma atualização:**
```python
import base64, json, urllib.request

TOKEN = "TOKEN_AQUI"
REPO  = "Vinibeginer/projetos"
PATH  = "editor-projeto-eletrico/index.html"

with open('arquivo.html','rb') as f:
    content_b64 = base64.b64encode(f.read()).decode()

url = f"https://api.github.com/repos/{REPO}/contents/{PATH}"
headers = {"Authorization":f"token {TOKEN}","Content-Type":"application/json",
           "Accept":"application/vnd.github.v3+json","User-Agent":"Claude"}

# Pegar SHA atual
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as r:
    sha = json.loads(r.read())["sha"]

payload = {"message":"descrição da mudança","content":content_b64,"sha":sha,"branch":"main"}
req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="PUT")
with urllib.request.urlopen(req) as r:
    print("✅ Publicado:", json.loads(r.read())["content"]["html_url"])
```

---

## 📌 Histórico de versões do editor

| Versão | SHA | Data | O que mudou |
|--------|-----|------|-------------|
| **v1.4.0** | `393f814` | 23/06/2026 | Painel de controle de versão adicionado |
| v1.3.0 | `8359ca0` | 23/06/2026 | Plantas redesenhadas cota a cota com fidelidade ao projeto aprovado |
| v1.2.0 | `e4dd93d` | 23/06/2026 | Plantas com cotas precisas, sanitários, móveis e portas |
| v1.1.0 | `d0fd17a` | 23/06/2026 | Planta limpa — apenas paredes, portas, janelas e escada |
| v1.0.0 | `900f0df` | 23/06/2026 | Versão inicial — editor com simbologia NBR 5410 |

---

## 💬 Como retomar na nova conversa

Cole este texto como primeira mensagem:

> "Olá! Estou continuando o desenvolvimento do Editor de Projeto Elétrico NBR 5410
> hospedado em https://vinibeginer.github.io/projetos/editor-projeto-eletrico/
> O repositório é Vinibeginer/projetos no GitHub. O resumo completo está no arquivo
> RESUMO_PROJETO_ELETRICO.md que tenho em mãos. Preciso [descreva o ajuste aqui]."

---
*Documento gerado em 23/06/2026 — Sessão de desenvolvimento com Claude*
