# Otimizador The Witcher 3 (RX 7800 XT + Ryzen 7 5700X + 32 GB)

Script para Windows que edita **direto os arquivos de configuração do jogo** e deixa o
The Witcher 3 com o melhor visual possível sem engasgos nesse hardware.

| Arquivo | O que é |
|---|---|
| `Otimizar-Witcher3.bat` | Menu: dê dois cliques e escolha o perfil |
| `Otimizar-Witcher3.ps1` | O script (PowerShell, já vem no Windows 10/11) |

## Como usar

1. **Feche o jogo** (ele regrava as configurações quando fecha).
2. Se nunca abriu o jogo nesse PC, abra uma vez até o menu principal e feche.
3. Dê dois cliques em `Otimizar-Witcher3.bat` e escolha a opção (1 = Qualidade é o recomendado).
4. Abra o jogo, carregue um save e confira em *Opções › Vídeo*.

O script detecta sozinho:

- a pasta `Documentos\The Witcher 3` (inclusive se Documentos estiver no OneDrive);
- a versão do jogo: **Remastered 5.x** (atualização gratuita de set/2026, só DirectX 12),
  Next-Gen 4.x ou Clássico 1.32;
- a resolução e a taxa de atualização (Hz) do monitor.

Antes de gravar ele mostra cada valor que muda (antes → depois) e guarda um backup em
`Documentos\The Witcher 3\backup-otimizador`. Linhas que ele não conhece ficam intactas.

## Perfis

| | **Qualidade** (padrão) | **Fluido** | **Ray Tracing** |
|---|---|---|---|
| Anti-aliasing em 1080p | FSR nativo (Native AA) | FSR nativo | FSR nativo |
| Anti-aliasing em 1440p | FSR nativo (Native AA) | FSR Qualidade | FSR Qualidade |
| Anti-aliasing em 4K | FSR Qualidade | FSR Equilibrado | FSR Desempenho |
| Ray tracing | desligado | desligado | RTGI (Desempenho) + reflexos + AO |
| Path tracing | desligado | desligado | desligado |
| Frame Generation (FSR) | desligado | desligado | ligado |
| AMD Anti-Lag 2 | ligado | ligado | ligado |
| HairWorks | só Geralt | desligado | só Geralt |
| VSync / limite de FPS | FreeSync + limite em Hz − 3 | FreeSync + limite em Hz − 3 | VSync + FreeSync |

Comum a todos: motion blur, blur e aberração cromática desligados; bloom, raios de luz e
profundidade de campo ligados; nitidez baixa; filtragem anisotrópica 16x; resolução dinâmica
desligada. Grama, vegetação, sombras e texturas ficam **no mínimo em Ultra**: o script só sobe
esses valores, nunca rebaixa o Ultra+ do jogo.

Por que assim:

- **Path tracing** fica desligado: é feito para placas NVIDIA topo de linha; na 7800 XT derruba o FPS.
- **Ray tracing** custa caro em placas AMD; no perfil Ray Tracing ele usa só o que mais muda a
  imagem (iluminação global, reflexos e AO) e compensa com FSR + Frame Generation.
- **Limite em Hz − 3** com FreeSync: o FPS nunca bate no teto do monitor, então não há tearing nem o
  atraso do VSync, e o tempo entre quadros fica estável (é isso que tira a sensação de "travadinha").
- **Orçamento de textura maior** (16 GB de VRAM e 32 GB de RAM sobram): menos pop-in e menos
  engasgo de streaming ao cavalgar.

## Opções avançadas (PowerShell)

```powershell
.\Otimizar-Witcher3.ps1 -Perfil Qualidade              # padrão
.\Otimizar-Witcher3.ps1 -Perfil RayTracing
.\Otimizar-Witcher3.ps1 -Resolucao 3440x1440 -Hz 165    # se a detecção errar
.\Otimizar-Witcher3.ps1 -Upscaler FSRQualidade          # FSRNativo, FSRQualidade, FSREquilibrado, FSRDesempenho, XeSSNativo, FXAA
.\Otimizar-Witcher3.ps1 -FrameGen Sim                   # Auto, Sim, Nao
.\Otimizar-Witcher3.ps1 -HairWorks 2                    # 0 desligado, 1 só Geralt, 2 todos
.\Otimizar-Witcher3.ps1 -VSync                          # monitor sem FreeSync
.\Otimizar-Witcher3.ps1 -LimiteFPS 0                    # sem limite de FPS
.\Otimizar-Witcher3.ps1 -Simular                        # mostra o que mudaria, sem gravar
.\Otimizar-Witcher3.ps1 -SomenteLeitura                 # impede o jogo de sobrescrever
.\Otimizar-Witcher3.ps1 -Restaurar                      # desfaz a última execução
.\Otimizar-Witcher3.ps1 -RestaurarOriginal              # volta ao que era antes do 1º uso
```

Se o Windows bloquear o `.ps1`, use o `.bat` (ele roda com `-ExecutionPolicy Bypass`) ou execute
`Unblock-File .\Otimizar-Witcher3.ps1` uma vez.

## Avisos

- **FSR "Nativo (AA)"** depende do FSR 4. Se o menu não aceitar essa opção na sua placa, escolha
  FSR *Qualidade* (ou rode com `-Upscaler FSRQualidade`).
- **Frame Generation da AMD na versão 5.01**: há relatos de que ele aparece ligado mas só funciona
  depois de desligar e ligar de novo no menu após carregar o save. O mod
  [witcher3-amd-fsr-framegen-fix](https://github.com/AlphaBoom/witcher3-amd-fsr-framegen-fix) faz isso sozinho.
- Na primeira vez (e depois de atualizar o driver) o jogo compila shaders: engasgos nos primeiros
  minutos são normais.
- Se depois de uma atualização do jogo algo ficar estranho, rode `-Restaurar` ou apague o
  `dx12user.settings` (o jogo recria com o padrão) e rode o script de novo.

## Fora do jogo (o script não mexe nisso)

- **BIOS**: ligue o perfil **XMP/DOCP** da memória (Ryzen com RAM sem XMP engasga muito) e o
  **Resizable BAR / Smart Access Memory**.
- **AMD Software (Adrenalin)**, perfil do jogo: FreeSync ligado; Radeon Chill, Radeon Boost e RSR
  desligados; Anti-Lag ligado; "Aguardar atualização vertical" em *Desligado, a menos que o
  aplicativo especifique*.
- Instale o jogo num **SSD**.
