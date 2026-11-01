# Otimizador The Witcher 3 (RX 7800 XT + Ryzen 7 5700X + 32 GB)

Script para Windows que deixa o The Witcher 3 com o melhor visual possível sem engasgos nesse
hardware **sem você precisar abrir menu nenhum**: ele edita direto os arquivos do jogo, ajusta o
Windows e cria um atalho que mantém tudo certo sozinho.

| Arquivo | O que é |
|---|---|
| `Otimizar-Witcher3.bat` | Dê dois cliques. Em 15 s aplica o perfil recomendado sozinho |
| `Otimizar-Witcher3.ps1` | O script (PowerShell, já vem no Windows 10/11) |

## Como usar

1. Dê dois cliques em `Otimizar-Witcher3.bat` (se não escolher nada, ele aplica o perfil **Qualidade**).
2. Pronto. Para jogar, use o atalho **"The Witcher 3 (Otimizado)"** que aparece na área de trabalho.

Se o jogo estiver aberto, o script espera você fechar. Se o jogo nunca foi aberto nesse PC, o script
abre o jogo, espera você fechar e aplica tudo.

## O que o script faz sozinho

- **Acha o jogo** (Steam, GOG ou Epic) e a pasta `Documentos\The Witcher 3` (inclusive no OneDrive).
- **Detecta** a versão do jogo (Remastered 5.x, Next-Gen 4.x ou Clássico 1.32), a resolução e o Hz do monitor.
- **Grava as configurações gráficas** direto no `dx12user.settings`, mostrando cada valor antes → depois,
  com backup de cada alteração em `Documentos\The Witcher 3\backup-otimizador`.
- **Corrige o Frame Generation da AMD** (perfil Ray Tracing): na 5.01 ele aparece ligado mas só funciona
  depois de desligar e ligar no menu. O script instala o mod
  [witcher3-amd-fsr-framegen-fix](https://github.com/AlphaBoom/witcher3-amd-fsr-framegen-fix), que faz isso
  ao carregar o save. Por segurança:
  - só instala se os arquivos do seu jogo forem exatamente os da versão para a qual o mod foi feito
    (confere o SHA-256);
  - confere o SHA-256 do download;
  - remove o mod sozinho quando o jogo atualiza ou quando você troca para um perfil sem Frame Generation.
- **Windows** (só no seu usuário, sem precisar de administrador):
  - liga a taxa de atualização variável e a otimização para jogos em janela;
  - liga o Modo de Jogo;
  - desliga a gravação em segundo plano da Xbox Game Bar, que custa FPS.
- **Confere o que fica fora do jogo** e avisa só se algo atrapalha:
  - memória sem XMP/DOCP;
  - Resizable BAR desligado;
  - jogo em HD mecânico;
  - driver de vídeo antigo.
- **Atalho "The Witcher 3 (Otimizado)"**:
  - antes de abrir o jogo, reaplica as configurações (inclusive depois de uma atualização do jogo);
  - quando você fecha, confere o que o jogo gravou. Se o jogo recusar alguma opção nessa placa
    (por exemplo, o FSR "Nativo (AA)", que depende do FSR 4), o script passa a usar a alternativa
    (FSR Qualidade) e volta a testar quando o jogo atualizar.

### O que nenhum script consegue mudar

O **XMP/DOCP** da memória e o **Resizable BAR** só se ligam na BIOS, e o driver da AMD se atualiza pelo
AMD Software. O script mede esses itens e só mostra o aviso se algum deles estiver atrapalhando. As
configurações do AMD Software (Adrenalin) não são alteradas: os padrões dele já são os corretos para
este perfil (Radeon Chill, Boost e RSR desligados).

## Perfis

| | **Qualidade** (padrão) | **Fluido** | **Ray Tracing** |
|---|---|---|---|
| Anti-aliasing em 1080p | FSR nativo (Native AA) | FSR nativo | FSR nativo |
| Anti-aliasing em 1440p | FSR nativo (Native AA) | FSR Qualidade | FSR Qualidade |
| Anti-aliasing em 4K | FSR Qualidade | FSR Equilibrado | FSR Desempenho |
| Ray tracing | desligado | desligado | RTGI (Desempenho) + reflexos + AO |
| Path tracing | desligado | desligado | desligado |
| Frame Generation (FSR) | desligado | desligado | ligado (com a correção automática) |
| AMD Anti-Lag 2 | ligado | ligado | ligado |
| HairWorks | só Geralt | desligado | só Geralt |
| VSync / limite de FPS | FreeSync + limite em Hz − 3 | FreeSync + limite em Hz − 3 | VSync + FreeSync |

Comum a todos:

- motion blur, blur e aberração cromática desligados;
- bloom, raios de luz e profundidade de campo ligados;
- nitidez baixa e filtragem anisotrópica 16x;
- resolução dinâmica desligada;
- grama, vegetação, sombras e texturas **no mínimo em Ultra**: o script só sobe esses valores, nunca
  rebaixa o Ultra+ do jogo.

Por que assim:

- **Path tracing** fica desligado: é pesado demais para a 7800 XT.
- **Ray tracing** custa caro em placas AMD. Por isso o perfil Ray Tracing usa só o que mais muda a imagem
  e compensa com FSR + Frame Generation.
- **Limite em Hz − 3** com FreeSync: o FPS nunca bate no teto do monitor. Assim não há tearing nem o
  atraso do VSync, e o tempo entre quadros fica estável, que é o que tira a sensação de "travadinha".
- **Orçamento de textura maior** (16 GB de VRAM sobram): menos pop-in e menos engasgo de streaming.

## Desfazer

- Opção **4** do `.bat`: desfaz a última alteração nas configurações do jogo.
- Opção **5** do `.bat`: desinstala tudo. Volta as configurações do jogo e do Windows ao que eram antes do
  primeiro uso, remove o mod e o atalho.

## Arquivos que o script cria

- `%LOCALAPPDATA%\OtimizadorWitcher3\`: cópia do script usada pelo atalho, `estado.json`
  (perfil e o que o jogo aceitou) e `ultimo-log.txt` (registro da última execução).
- `Documentos\The Witcher 3\backup-otimizador\`: backups (`.original` + os 15 mais recentes).
- Área de trabalho: `The Witcher 3 (Otimizado).lnk`.
- Só no perfil Ray Tracing: `<pasta do jogo>\mods\modFSRStartupReinit`.

## Opções avançadas (PowerShell)

```powershell
.\Otimizar-Witcher3.ps1 -Perfil RayTracing
.\Otimizar-Witcher3.ps1 -Resolucao 3440x1440 -Hz 165    # se a detecção errar
.\Otimizar-Witcher3.ps1 -Upscaler FSRQualidade          # FSRNativo, FSRQualidade, FSREquilibrado, FSRDesempenho, XeSSNativo, FXAA
.\Otimizar-Witcher3.ps1 -FrameGen Sim                   # Auto, Sim, Nao
.\Otimizar-Witcher3.ps1 -HairWorks 2                    # 0 desligado, 1 só Geralt, 2 todos
.\Otimizar-Witcher3.ps1 -VSync                          # monitor sem FreeSync
.\Otimizar-Witcher3.ps1 -LimiteFPS 0                    # sem limite de FPS
.\Otimizar-Witcher3.ps1 -PastaJogo "D:\Jogos\The Witcher 3"
.\Otimizar-Witcher3.ps1 -Simular                        # mostra o que mudaria, sem gravar nada
.\Otimizar-Witcher3.ps1 -SemAtalho -SemWindows -SemMod  # desliga partes da automação
.\Otimizar-Witcher3.ps1 -Restaurar                      # desfaz a última alteração
.\Otimizar-Witcher3.ps1 -RestaurarOriginal              # desinstala tudo
```

As opções usadas ficam salvas e o atalho continua usando-as.
