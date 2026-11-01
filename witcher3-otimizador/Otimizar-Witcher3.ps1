#Requires -Version 5.1
<#
.SYNOPSIS
    Ajusta as configurações gráficas do The Witcher 3 para Radeon RX 7800 XT + Ryzen 7 5700X + 32 GB.

.DESCRIPTION
    Edita diretamente os arquivos de configuração do jogo (pasta Documentos\The Witcher 3):
      - dx12user.settings  (Remastered 5.x e Next-Gen 4.x em DirectX 12)
      - user.settings      (Next-Gen 4.x em DirectX 11 e Clássico 1.32)

    O script detecta a versão do jogo e a resolução/taxa de atualização do monitor, aplica o
    perfil escolhido, mostra cada valor alterado e guarda um backup antes de gravar.
    Feche o jogo antes de rodar: ele regrava esses arquivos ao sair.

.PARAMETER Perfil
    Qualidade  (padrão) gráficos no máximo sem ray tracing, FSR em resolução nativa (1080p/1440p).
    Fluido     mais FPS: FSR Qualidade e HairWorks desligado.
    RayTracing RTGI + reflexos + AO por ray tracing, FSR Qualidade e Frame Generation.

.PARAMETER Resolucao
    Resolução do jogo, ex.: 2560x1440. Padrão: a resolução atual do monitor.

.PARAMETER Hz
    Taxa de atualização do monitor. Padrão: detectada automaticamente.

.PARAMETER LimiteFPS
    Limite de FPS do jogo. -1 = automático (Hz - 3, para o FreeSync), 0 = sem limite.

.PARAMETER Upscaler
    Auto, FSRNativo, FSRQualidade, FSREquilibrado, FSRDesempenho, XeSSNativo ou FXAA.

.PARAMETER FrameGen
    Auto (liga só no perfil RayTracing), Sim ou Nao. Só existe na versão Remastered 5.x.

.PARAMETER HairWorks
    -1 = o do perfil, 0 = desligado, 1 = só no Geralt, 2 = em todos.

.PARAMETER VSync
    Força o VSync ligado (use se o monitor não tiver FreeSync).

.PARAMETER PastaConfig
    Pasta dos arquivos .settings, se não for a padrão (Documentos\The Witcher 3).

.PARAMETER Simular
    Mostra o que mudaria sem gravar nada.

.PARAMETER SomenteLeitura
    Marca o arquivo como somente leitura depois de gravar. O jogo deixa de conseguir
    sobrescrever (e também deixa de salvar o que você mudar no menu).

.PARAMETER Restaurar
    Desfaz a última execução (volta o backup mais recente).

.PARAMETER RestaurarOriginal
    Volta a configuração de antes do primeiro uso do script.

.PARAMETER SemPausa
    Não espera ENTER no final.

.EXAMPLE
    .\Otimizar-Witcher3.ps1
.EXAMPLE
    .\Otimizar-Witcher3.ps1 -Perfil RayTracing
.EXAMPLE
    .\Otimizar-Witcher3.ps1 -Perfil Fluido -Resolucao 2560x1440 -Hz 165
.EXAMPLE
    .\Otimizar-Witcher3.ps1 -Simular
.EXAMPLE
    .\Otimizar-Witcher3.ps1 -Restaurar
#>
[CmdletBinding()]
param(
    [ValidateSet('Qualidade', 'Fluido', 'RayTracing')]
    [string]$Perfil = 'Qualidade',

    [string]$Resolucao = '',

    [ValidateRange(0, 1000)]
    [int]$Hz = 0,

    [ValidateRange(-1, 1000)]
    [int]$LimiteFPS = -1,

    [ValidateSet('Auto', 'FSRNativo', 'FSRQualidade', 'FSREquilibrado', 'FSRDesempenho', 'XeSSNativo', 'FXAA')]
    [string]$Upscaler = 'Auto',

    [ValidateSet('Auto', 'Sim', 'Nao')]
    [string]$FrameGen = 'Auto',

    [ValidateRange(-1, 2)]
    [int]$HairWorks = -1,

    [switch]$VSync,

    [string]$PastaConfig = '',

    [switch]$Simular,

    [switch]$SomenteLeitura,

    [switch]$Restaurar,

    [switch]$RestaurarOriginal,

    [switch]$SemPausa
)

$ErrorActionPreference = 'Stop'
$Invariante = [System.Globalization.CultureInfo]::InvariantCulture
$EstiloNumero = [System.Globalization.NumberStyles]::Float
$NomesArquivos = @('dx12user.settings', 'user.settings')

# ---------------------------------------------------------------------------------------------
# Saída no console
# ---------------------------------------------------------------------------------------------

function Write-Titulo([string]$Texto) {
    Write-Host ''
    Write-Host ('== ' + $Texto + ' ==') -ForegroundColor Cyan
}

function Write-Info([string]$Texto) { Write-Host ('  ' + $Texto) }

function Write-Aviso([string]$Texto) { Write-Host ('  [!] ' + $Texto) -ForegroundColor Yellow }

function Write-Ok([string]$Texto) { Write-Host ('  [ok] ' + $Texto) -ForegroundColor Green }

function Wait-Saida {
    if (-not $SemPausa) {
        Write-Host ''
        [void](Read-Host '  Pressione ENTER para fechar')
    }
}

function Stop-ComErro([string]$Texto) {
    Write-Host ''
    Write-Host ('  [ERRO] ' + $Texto) -ForegroundColor Red
    Wait-Saida
    exit 1
}

function ConvertTo-TextoBool([bool]$Valor) {
    if ($Valor) { return 'true' }
    return 'false'
}

# ---------------------------------------------------------------------------------------------
# Leitura e gravação dos arquivos .settings (formato INI), preservando codificação, quebras de
# linha e todas as linhas que o script não altera.
# ---------------------------------------------------------------------------------------------

function Read-ArquivoSettings([string]$Caminho) {
    $bytes = [System.IO.File]::ReadAllBytes($Caminho)
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        $codificacao = 'utf16le'
        $texto = [System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2)
    } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        $codificacao = 'utf16be'
        $texto = [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, $bytes.Length - 2)
    } elseif ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $codificacao = 'utf8bom'
        $texto = $utf8.GetString($bytes, 3, $bytes.Length - 3)
    } else {
        $codificacao = 'utf8'
        $texto = $utf8.GetString($bytes)
    }

    $quebra = "`n"
    if ($texto.Contains("`r`n")) { $quebra = "`r`n" }

    $linhas = New-Object System.Collections.Generic.List[string]
    foreach ($linha in ($texto -split "`r?`n")) { $linhas.Add($linha) }
    while ($linhas.Count -gt 0 -and $linhas[$linhas.Count - 1] -eq '') { $linhas.RemoveAt($linhas.Count - 1) }

    return [pscustomobject]@{
        Caminho     = $Caminho
        Nome        = (Split-Path -Leaf $Caminho)
        Codificacao = $codificacao
        Quebra      = $quebra
        Linhas      = $linhas
    }
}

function Save-ArquivoSettings($Doc) {
    $texto = [string]::Join($Doc.Quebra, $Doc.Linhas.ToArray()) + $Doc.Quebra
    switch ($Doc.Codificacao) {
        'utf16le' { $enc = New-Object System.Text.UnicodeEncoding($false, $true) }
        'utf16be' { $enc = New-Object System.Text.UnicodeEncoding($true, $true) }
        'utf8bom' { $enc = New-Object System.Text.UTF8Encoding($true) }
        default   { $enc = New-Object System.Text.UTF8Encoding($false) }
    }
    $item = Get-Item -LiteralPath $Doc.Caminho
    if ($item.IsReadOnly) { $item.IsReadOnly = $false }
    [System.IO.File]::WriteAllText($Doc.Caminho, $texto, $enc)
}

function Find-Secao($Doc, [string]$Secao) {
    $procurado = '[' + $Secao + ']'
    for ($i = 0; $i -lt $Doc.Linhas.Count; $i++) {
        if ($Doc.Linhas[$i].Trim() -eq $procurado) { return $i }
    }
    return -1
}

function Get-FimSecao($Doc, [int]$Inicio) {
    for ($i = $Inicio + 1; $i -lt $Doc.Linhas.Count; $i++) {
        $t = $Doc.Linhas[$i].Trim()
        if ($t.StartsWith('[') -and $t.EndsWith(']')) { return $i }
    }
    return $Doc.Linhas.Count
}

function Find-Chave($Doc, [int]$Inicio, [int]$Fim, [string]$Chave) {
    for ($i = $Inicio + 1; $i -lt $Fim; $i++) {
        $linha = $Doc.Linhas[$i]
        $igual = $linha.IndexOf('=')
        if ($igual -gt 0 -and $linha.Substring(0, $igual).Trim() -eq $Chave) { return $i }
    }
    return -1
}

function Get-ValorIni($Doc, [string]$Secao, [string]$Chave) {
    $inicio = Find-Secao $Doc $Secao
    if ($inicio -lt 0) { return $null }
    $fim = Get-FimSecao $Doc $inicio
    $i = Find-Chave $Doc $inicio $fim $Chave
    if ($i -lt 0) { return $null }
    $linha = $Doc.Linhas[$i]
    return $linha.Substring($linha.IndexOf('=') + 1).Trim()
}

function Set-ValorIni($Doc, [string]$Secao, [string]$Chave, [string]$Valor) {
    $inicio = Find-Secao $Doc $Secao
    if ($inicio -lt 0) {
        $Doc.Linhas.Add('[' + $Secao + ']')
        $Doc.Linhas.Add($Chave + '=' + $Valor)
        return
    }
    $fim = Get-FimSecao $Doc $inicio
    $i = Find-Chave $Doc $inicio $fim $Chave
    if ($i -ge 0) {
        $linha = $Doc.Linhas[$i]
        $Doc.Linhas[$i] = $linha.Substring(0, $linha.IndexOf('=') + 1) + $Valor
        return
    }
    $posicao = $fim
    while ($posicao -gt $inicio + 1 -and $Doc.Linhas[$posicao - 1].Trim() -eq '') { $posicao-- }
    $Doc.Linhas.Insert($posicao, $Chave + '=' + $Valor)
}

# ---------------------------------------------------------------------------------------------
# Detecção: pasta de configuração, versão do jogo e hardware
# ---------------------------------------------------------------------------------------------

function Find-PastaConfig {
    $candidatas = New-Object System.Collections.Generic.List[string]
    if ($PastaConfig) { $candidatas.Add($PastaConfig) }
    $documentos = [Environment]::GetFolderPath('MyDocuments')
    if ($documentos) { $candidatas.Add((Join-Path $documentos 'The Witcher 3')) }
    foreach ($raiz in @($env:OneDrive, $env:USERPROFILE)) {
        if (-not $raiz) { continue }
        foreach ($nome in @('Documents', 'Documentos')) {
            $candidatas.Add((Join-Path (Join-Path $raiz $nome) 'The Witcher 3'))
        }
    }
    foreach ($pastaCandidata in $candidatas) {
        foreach ($nome in $NomesArquivos) {
            if (Test-Path -LiteralPath (Join-Path $pastaCandidata $nome)) { return $pastaCandidata }
        }
    }
    return $null
}

function Get-VersaoJogo($Doc) {
    $versao = Get-ValorIni $Doc 'StartupFlow' 'LastGameVersion'
    $numero = 0
    if ($versao -and [int]::TryParse($versao, [ref]$numero)) {
        if ($numero -ge 500) { return 'Remastered' }
        if ($numero -ge 400) { return 'NextGen' }
    }
    if ((Find-Secao $Doc 'Rendering/RT/PathTracer') -ge 0) { return 'Remastered' }
    if ($null -ne (Get-ValorIni $Doc 'PostProcess' 'FSRFramegen')) { return 'Remastered' }
    if ($null -ne (Get-ValorIni $Doc 'Viewport' 'AMDAntiLag')) { return 'Remastered' }
    if ($Doc.Nome -eq 'dx12user.settings') { return 'NextGen' }
    if ($null -ne (Get-ValorIni $Doc 'PostProcess' 'AAMode')) { return 'NextGen' }
    if ((Find-Secao $Doc 'Rendering/RT') -ge 0) { return 'NextGen' }
    return 'Classico'
}

function Get-NomeVersao([string]$Versao) {
    switch ($Versao) {
        'Remastered'  { return 'Remastered 5.x (DirectX 12)' }
        'NextGen'     { return 'Next-Gen 4.x (DirectX 12)' }
        'NextGenDX11' { return 'Next-Gen 4.x (DirectX 11)' }
        default       { return 'Clássico 1.32' }
    }
}

function Get-Hardware {
    $placa = ''; $largura = 0; $altura = 0; $taxa = 0; $cpu = ''; $ram = 0
    try {
        $controladoras = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop)
        $ativas = @($controladoras | Where-Object { $_.CurrentHorizontalResolution -gt 0 })
        $amd = @($ativas | Where-Object { $_.Name -match 'AMD|Radeon' })
        $escolhida = $null
        if ($amd.Count -gt 0) { $escolhida = $amd[0] }
        elseif ($ativas.Count -gt 0) { $escolhida = $ativas[0] }
        elseif ($controladoras.Count -gt 0) { $escolhida = $controladoras[0] }
        if ($escolhida) {
            $placa = [string]$escolhida.Name
            if ($escolhida.CurrentHorizontalResolution -gt 0) {
                $largura = [int]$escolhida.CurrentHorizontalResolution
                $altura = [int]$escolhida.CurrentVerticalResolution
            }
            if ($escolhida.CurrentRefreshRate -gt 1) { $taxa = [int]$escolhida.CurrentRefreshRate }
        }
    } catch { }
    try {
        $processador = Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop | Select-Object -First 1
        if ($processador -and $processador.Name) { $cpu = ([string]$processador.Name).Trim() }
    } catch { }
    try {
        $sistema = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop
        $ram = [int]([math]::Round([double]$sistema.TotalPhysicalMemory / 1073741824))
    } catch { }
    return [pscustomobject]@{ Placa = $placa; Largura = $largura; Altura = $altura; Taxa = $taxa; Cpu = $cpu; RamGB = $ram }
}

# ---------------------------------------------------------------------------------------------
# Ajustes. Modo 'Definir' grava o valor; modo 'Piso' só sobe um valor numérico que já existe no
# arquivo e está abaixo do mínimo (nunca rebaixa o preset Ultra+ nem cria a chave, porque na
# versão Remastered uma chave ausente significa "usar o padrão do jogo").
# ---------------------------------------------------------------------------------------------

function New-Ajuste([string]$Secao, [string]$Chave, [string]$Valor, [string]$Nota, [string]$Modo = 'Definir') {
    return @{ Secao = $Secao; Chave = $Chave; Valor = $Valor; Nota = $Nota; Modo = $Modo }
}

function Get-Ajustes([string]$Versao, $Cfg) {
    $L = New-Object System.Collections.Generic.List[object]

    # --- Tela ---------------------------------------------------------------------------------
    if ($Cfg.Largura -gt 0 -and $Cfg.Altura -gt 0) {
        $L.Add((New-Ajuste 'Viewport' 'Resolution' ('"{0}x{1}"' -f $Cfg.Largura, $Cfg.Altura) 'resolução nativa do monitor'))
    }
    if ($null -ne $Cfg.VSync) {
        $notaVSync = 'VSync desligado (o FreeSync cuida do tearing)'
        if ($Cfg.VSync) { $notaVSync = 'VSync ligado' }
        $L.Add((New-Ajuste 'Viewport' 'VSync' (ConvertTo-TextoBool $Cfg.VSync) $notaVSync))
    }
    if ($null -ne $Cfg.Limite) {
        $notaLimite = 'sem limite de FPS'
        if ($Cfg.Limite -gt 0) { $notaLimite = 'limite de FPS logo abaixo da taxa do monitor (frametime estável)' }
        $L.Add((New-Ajuste 'Engine' 'LimitFPS' ([string]$Cfg.Limite) $notaLimite))
    }

    # --- Pós-processamento (nitidez e clareza) ---------------------------------------------------
    $L.Add((New-Ajuste 'PostProcess' 'AllowMotionBlur' 'false' 'motion blur desligado (imagem mais nítida em movimento)'))
    $L.Add((New-Ajuste 'PostProcess' 'AllowBlur' 'false' 'blur de efeitos desligado'))
    $L.Add((New-Ajuste 'PostProcess' 'AllowChromaticAberration' 'false' 'aberração cromática desligada'))
    $L.Add((New-Ajuste 'PostProcess' 'AllowBloom' 'true' 'bloom ligado'))
    $L.Add((New-Ajuste 'PostProcess' 'AllowShafts' 'true' 'raios de luz ligados'))
    $L.Add((New-Ajuste 'PostProcess' 'AllowDOF' 'true' 'profundidade de campo ligada'))
    $L.Add((New-Ajuste 'PostProcess' 'SharpenAmount' '1' 'nitidez baixa (compensa o TAA/FSR sem serrilhar)'))

    # --- Texturas, filtragem e distâncias --------------------------------------------------------
    $L.Add((New-Ajuste 'Rendering' 'MaxTextureAnizotropy' '16' 'filtragem anisotrópica 16x'))
    $L.Add((New-Ajuste 'Rendering' 'MaxTextureAnisotropy' '16' 'filtragem anisotrópica 16x' 'Piso'))
    $L.Add((New-Ajuste 'Rendering' 'TextureMemoryBudget' '4000' 'orçamento de textura maior (16 GB de VRAM): menos pop-in e engasgos de streaming' 'Piso'))
    $L.Add((New-Ajuste 'Rendering' 'MaxTextureSize' '4096' 'texturas em resolução máxima' 'Piso'))
    $L.Add((New-Ajuste 'Rendering' 'CascadeShadowmapSize' '3072' 'sombras no mínimo em Ultra' 'Piso'))
    $L.Add((New-Ajuste 'Rendering' 'GrassDensity' '2400' 'densidade de grama no mínimo em Ultra' 'Piso'))
    $L.Add((New-Ajuste 'Rendering/SpeedTree' 'FoliageDistanceScale' '1' 'distância da vegetação no mínimo em Ultra' 'Piso'))
    $L.Add((New-Ajuste 'Rendering/SpeedTree' 'GrassDistanceScale' '1' 'distância da grama no mínimo em Ultra' 'Piso'))

    $notasHair = @('HairWorks desligado (mais FPS em lutas com monstros peludos)', 'HairWorks só no Geralt', 'HairWorks em todos')
    $L.Add((New-Ajuste 'Rendering' 'HairWorksLevel' ([string]$Cfg.HairWorks) $notasHair[$Cfg.HairWorks]))

    # --- Remastered 5.x ------------------------------------------------------------------------
    if ($Versao -eq 'Remastered') {
        switch ($Cfg.Up) {
            'FSRNativo' {
                $L.Add((New-Ajuste 'PostProcess' 'AAMode' '5' 'anti-aliasing: AMD FSR'))
                $L.Add((New-Ajuste 'PostProcess' 'FSR2Quality' '1' 'FSR em resolução nativa (Native AA)'))
            }
            'FSRQualidade' {
                $L.Add((New-Ajuste 'PostProcess' 'AAMode' '5' 'anti-aliasing: AMD FSR'))
                $L.Add((New-Ajuste 'PostProcess' 'FSR2Quality' '2' 'FSR Qualidade'))
            }
            'FSREquilibrado' {
                $L.Add((New-Ajuste 'PostProcess' 'AAMode' '5' 'anti-aliasing: AMD FSR'))
                $L.Add((New-Ajuste 'PostProcess' 'FSR2Quality' '3' 'FSR Equilibrado'))
            }
            'FSRDesempenho' {
                $L.Add((New-Ajuste 'PostProcess' 'AAMode' '5' 'anti-aliasing: AMD FSR'))
                $L.Add((New-Ajuste 'PostProcess' 'FSR2Quality' '4' 'FSR Desempenho'))
            }
            'XeSSNativo' {
                $L.Add((New-Ajuste 'PostProcess' 'AAMode' '7' 'anti-aliasing: Intel XeSS'))
                $L.Add((New-Ajuste 'PostProcess' 'XESSQuality' '1' 'XeSS em resolução nativa (Native AA)'))
            }
            'FXAA' {
                $L.Add((New-Ajuste 'PostProcess' 'AAMode' '1' 'anti-aliasing: FXAA'))
            }
        }
        $notaFG = 'Frame Generation desligado'
        if ($Cfg.FG) { $notaFG = 'AMD FSR Frame Generation ligado' }
        $L.Add((New-Ajuste 'PostProcess' 'FSRFramegen' ([string][int]$Cfg.FG) $notaFG))
        $L.Add((New-Ajuste 'PostProcess' 'XessFrameGeneration' 'false' 'frame generation da Intel desligado'))
        $L.Add((New-Ajuste 'PostProcess' 'DLSSGMode' '0' 'frame generation da NVIDIA desligado'))
        $L.Add((New-Ajuste 'Viewport' 'AMDAntiLag' '1' 'AMD Anti-Lag 2 ligado (menos atraso de entrada)'))
        $L.Add((New-Ajuste 'Rendering/DRS' 'Enable' 'false' 'resolução dinâmica desligada (imagem estável)'))
        $L.Add((New-Ajuste 'Rendering' 'SSREnabled' 'true' 'reflexos em espaço de tela ligados'))
        $L.Add((New-Ajuste 'Rendering/RT/PathTracer' 'PTEnable' 'false' 'path tracing desligado (pesado demais para a 7800 XT)'))
        if ($Cfg.RT) {
            $L.Add((New-Ajuste 'Rendering/RT' 'EnableRT' 'true' 'ray tracing ligado'))
            $L.Add((New-Ajuste 'Rendering/RT' 'RTGIPreset' 'false' 'iluminação global por RT no modo Desempenho'))
            $L.Add((New-Ajuste 'Rendering/RT' 'EnableRtRadiance' 'true' 'reflexos por RT ligados'))
            $L.Add((New-Ajuste 'Rendering/RT' 'RTAOEnabled' 'true' 'oclusão de ambiente por RT ligada'))
            $L.Add((New-Ajuste 'Rendering/RT' 'Shadows' '0' 'sombras por RT desligadas (custo alto, ganho pequeno)'))
        } else {
            $L.Add((New-Ajuste 'Rendering/RT' 'EnableRT' 'false' 'ray tracing desligado'))
        }
    }

    # --- Next-Gen 4.x --------------------------------------------------------------------------
    if ($Versao -eq 'NextGen') {
        if ($Cfg.Up -eq 'FSRNativo') {
            $L.Add((New-Ajuste 'PostProcess' 'AAMode' '3' 'anti-aliasing: TAAU em resolução nativa'))
        }
        if ($Cfg.RT) {
            $L.Add((New-Ajuste 'Rendering/RT' 'EnableRT' 'true' 'ray tracing ligado'))
            $L.Add((New-Ajuste 'Rendering/RT' 'RTGIPreset' 'false' 'iluminação global por RT no modo Desempenho'))
            $L.Add((New-Ajuste 'Rendering/RT' 'EnableRtRadiance' 'true' 'reflexos por RT ligados'))
            $L.Add((New-Ajuste 'Rendering/RT' 'RTAOEnabled' 'true' 'oclusão de ambiente por RT ligada'))
            $L.Add((New-Ajuste 'Rendering/RT' 'Shadows' 'false' 'sombras por RT desligadas'))
        } else {
            $L.Add((New-Ajuste 'Rendering/RT' 'EnableRT' 'false' 'ray tracing desligado'))
        }
    }

    # --- Clássico 1.32 -------------------------------------------------------------------------
    if ($Versao -eq 'Classico') {
        $L.Add((New-Ajuste 'PostProcess' 'AllowAntialias' 'true' 'anti-aliasing ligado'))
        $L.Add((New-Ajuste 'PostProcess' 'SSAOSolution' '2' 'oclusão de ambiente HBAO+'))
    }

    return ,$L
}

function Set-Ajustes($Doc, $Ajustes) {
    $mudancas = New-Object System.Collections.Generic.List[object]
    foreach ($a in $Ajustes) {
        $atual = Get-ValorIni $Doc $a.Secao $a.Chave
        if ($a.Modo -eq 'Piso') {
            if ($null -eq $atual) { continue }
            $valorAtual = 0.0
            $valorMinimo = 0.0
            if (-not [double]::TryParse($atual.Trim('"'), $EstiloNumero, $Invariante, [ref]$valorAtual)) { continue }
            if (-not [double]::TryParse($a.Valor, $EstiloNumero, $Invariante, [ref]$valorMinimo)) { continue }
            if ($valorAtual -ge $valorMinimo) { continue }
        }
        if ($null -ne $atual -and $atual -eq $a.Valor) { continue }
        Set-ValorIni $Doc $a.Secao $a.Chave $a.Valor
        $antes = '(novo)'
        if ($null -ne $atual) { $antes = $atual }
        $mudancas.Add([pscustomobject]@{ Secao = $a.Secao; Chave = $a.Chave; Antes = $antes; Depois = $a.Valor; Nota = $a.Nota })
    }
    return ,$mudancas
}

# ---------------------------------------------------------------------------------------------
# Backup e restauração
# ---------------------------------------------------------------------------------------------

function Backup-Arquivo([string]$Caminho, [string]$PastaBackup) {
    if (-not (Test-Path -LiteralPath $PastaBackup)) {
        [void](New-Item -ItemType Directory -Path $PastaBackup)
    }
    $nome = Split-Path -Leaf $Caminho
    $original = Join-Path $PastaBackup ($nome + '.original')
    if (-not (Test-Path -LiteralPath $original)) {
        Copy-Item -LiteralPath $Caminho -Destination $original
    }
    $carimbo = Get-Date -Format 'yyyyMMdd-HHmmss'
    $destino = Join-Path $PastaBackup ('{0}.{1}.bak' -f $nome, $carimbo)
    Copy-Item -LiteralPath $Caminho -Destination $destino -Force
    return $destino
}

function Restore-Configuracao([string]$Pasta, [string]$PastaBackup, [bool]$Original) {
    if ($Original) { Write-Titulo 'Restaurar a configuração original' } else { Write-Titulo 'Desfazer a última alteração' }
    if (-not (Test-Path -LiteralPath $PastaBackup)) {
        Stop-ComErro 'Nenhum backup encontrado (a pasta backup-otimizador ainda não existe).'
    }
    $restaurou = $false
    foreach ($nome in $NomesArquivos) {
        $origem = $null
        if ($Original) {
            $candidato = Join-Path $PastaBackup ($nome + '.original')
            if (Test-Path -LiteralPath $candidato) { $origem = $candidato }
        } else {
            $ultimo = Get-ChildItem -LiteralPath $PastaBackup -Filter ($nome + '.*.bak') -File -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending | Select-Object -First 1
            if ($ultimo) { $origem = $ultimo.FullName }
        }
        if (-not $origem) { continue }
        $destino = Join-Path $Pasta $nome
        if (Test-Path -LiteralPath $destino) {
            Copy-Item -LiteralPath $destino -Destination (Join-Path $PastaBackup ($nome + '.antes-de-restaurar')) -Force
        }
        Copy-Item -LiteralPath $origem -Destination $destino -Force
        $item = Get-Item -LiteralPath $destino
        if ($item.IsReadOnly) { $item.IsReadOnly = $false }
        Write-Ok ('{0} restaurado a partir de {1}' -f $nome, (Split-Path -Leaf $origem))
        $restaurou = $true
    }
    if (-not $restaurou) { Write-Aviso 'Não achei backup para restaurar.' }
}

# ---------------------------------------------------------------------------------------------
# Programa principal
# ---------------------------------------------------------------------------------------------

try {
    Write-Host ''
    Write-Host '  Otimizador The Witcher 3  |  Radeon RX 7800 XT + Ryzen 7 5700X + 32 GB' -ForegroundColor Cyan
    Write-Host '  ----------------------------------------------------------------------' -ForegroundColor Cyan

    if (Get-Process -Name 'witcher3' -ErrorAction SilentlyContinue) {
        Stop-ComErro 'O jogo está aberto. Feche o The Witcher 3 (ele regrava as configurações ao sair) e rode de novo.'
    }

    $pasta = Find-PastaConfig
    if (-not $pasta) {
        Stop-ComErro ('Não encontrei dx12user.settings nem user.settings em Documentos\The Witcher 3. ' +
            'Abra o jogo uma vez até o menu principal, feche e rode de novo ' +
            '(ou informe a pasta com -PastaConfig "C:\caminho\The Witcher 3").')
    }
    $pastaBackup = Join-Path $pasta 'backup-otimizador'
    Write-Info ('Pasta de configuração: ' + $pasta)

    if ($Restaurar -or $RestaurarOriginal) {
        Restore-Configuracao $pasta $pastaBackup $RestaurarOriginal.IsPresent
        Wait-Saida
        exit 0
    }

    # --- Hardware e monitor ---------------------------------------------------------------------
    Write-Titulo 'Hardware'
    $maquina = Get-Hardware
    $nomePlaca = $maquina.Placa
    if (-not $nomePlaca) { $nomePlaca = '(não detectada)' }
    $nomeCpu = $maquina.Cpu
    if (-not $nomeCpu) { $nomeCpu = '(não detectado)' }
    Write-Info ('Placa de vídeo: ' + $nomePlaca)
    Write-Info ('Processador:    ' + $nomeCpu)
    if ($maquina.RamGB -gt 0) { Write-Info ('Memória:        {0} GB' -f $maquina.RamGB) }
    if ($maquina.Placa -and $maquina.Placa -notmatch '7800') {
        Write-Aviso 'Os perfis foram pensados para a RX 7800 XT; em outra placa funcionam, mas o FPS muda.'
    }

    $largura = $maquina.Largura
    $altura = $maquina.Altura
    if ($Resolucao) {
        if ($Resolucao -match '^\s*(\d{3,5})\s*[xX*]\s*(\d{3,5})\s*$') {
            $largura = [int]$Matches[1]
            $altura = [int]$Matches[2]
        } else {
            Stop-ComErro ('Resolução inválida: "' + $Resolucao + '". Use o formato 2560x1440.')
        }
    }
    $taxa = $maquina.Taxa
    if ($Hz -gt 0) { $taxa = $Hz }

    if ($largura -gt 0) { Write-Info ('Resolução:      {0}x{1}' -f $largura, $altura) }
    else { Write-Aviso 'Não consegui detectar a resolução; a do jogo fica como está (use -Resolucao 2560x1440).' }
    if ($taxa -gt 0) { Write-Info ('Monitor:        {0} Hz' -f $taxa) }
    else { Write-Aviso 'Não consegui detectar a taxa do monitor; VSync e limite de FPS ficam como estão (use -Hz 144).' }

    # --- Decisões do perfil --------------------------------------------------------------------
    $classe = '1440p'
    if ($altura -gt 0 -and $altura -le 1200) { $classe = '1080p' }
    elseif ($altura -gt 1600) { $classe = '4K' }

    $tabelaUpscaler = @{
        'Qualidade'  = @{ '1080p' = 'FSRNativo'; '1440p' = 'FSRNativo';    '4K' = 'FSRQualidade' }
        'Fluido'     = @{ '1080p' = 'FSRNativo'; '1440p' = 'FSRQualidade'; '4K' = 'FSREquilibrado' }
        'RayTracing' = @{ '1080p' = 'FSRNativo'; '1440p' = 'FSRQualidade'; '4K' = 'FSRDesempenho' }
    }
    $modoUpscaler = $Upscaler
    if ($modoUpscaler -eq 'Auto') { $modoUpscaler = $tabelaUpscaler[$Perfil][$classe] }

    $usarFG = ($Perfil -eq 'RayTracing')
    if ($FrameGen -eq 'Sim') { $usarFG = $true }
    if ($FrameGen -eq 'Nao') { $usarFG = $false }

    # Com Frame Generation: VSync + FreeSync seguram o FPS na taxa do monitor sem tearing.
    # Sem Frame Generation: FreeSync + limite um pouco abaixo da taxa (menor atraso e frametime estável).
    $usarVSync = $null
    $limite = $null
    if ($usarFG) { $usarVSync = $true; $limite = 0 }
    elseif ($taxa -ge 90) { $usarVSync = $false; $limite = $taxa - 3 }
    elseif ($taxa -gt 0) { $usarVSync = $true; $limite = 0 }
    if ($VSync) { $usarVSync = $true }
    if ($LimiteFPS -ge 0) { $limite = $LimiteFPS }

    $nivelHair = 1
    if ($Perfil -eq 'Fluido') { $nivelHair = 0 }
    if ($HairWorks -ge 0) { $nivelHair = $HairWorks }

    $cfg = @{
        Largura   = $largura
        Altura    = $altura
        Up        = $modoUpscaler
        FG        = $usarFG
        VSync     = $usarVSync
        Limite    = $limite
        HairWorks = $nivelHair
        RT        = ($Perfil -eq 'RayTracing')
    }

    $nomesUpscaler = @{
        'FSRNativo' = 'AMD FSR em resolução nativa (Native AA)'; 'FSRQualidade' = 'AMD FSR Qualidade'
        'FSREquilibrado' = 'AMD FSR Equilibrado'; 'FSRDesempenho' = 'AMD FSR Desempenho'
        'XeSSNativo' = 'Intel XeSS em resolução nativa'; 'FXAA' = 'FXAA'
    }
    Write-Titulo ('Perfil: ' + $Perfil)
    Write-Info ('Anti-aliasing:    ' + $nomesUpscaler[$modoUpscaler])
    if ($cfg.RT) { Write-Info 'Ray tracing:      RTGI (Desempenho) + reflexos + AO; path tracing desligado' }
    else { Write-Info 'Ray tracing:      desligado' }
    if ($usarFG) { Write-Info 'Frame Generation: ligado (AMD FSR) + Anti-Lag 2' }
    else { Write-Info 'Frame Generation: desligado; Anti-Lag 2 ligado' }
    if ($null -ne $usarVSync) {
        $textoLimite = 'sem limite'
        if ($limite -gt 0) { $textoLimite = ('{0} FPS' -f $limite) }
        Write-Info ('VSync / limite:   {0} / {1}' -f (ConvertTo-TextoBool $usarVSync), $textoLimite)
    }
    $nomesHair = @('desligado', 'só no Geralt', 'em todos')
    Write-Info ('HairWorks:        ' + $nomesHair[$nivelHair])

    # --- Arquivos a ajustar --------------------------------------------------------------------
    $alvos = New-Object System.Collections.Generic.List[object]
    $arquivoDx12 = Join-Path $pasta 'dx12user.settings'
    $arquivoDx11 = Join-Path $pasta 'user.settings'
    if (Test-Path -LiteralPath $arquivoDx12) {
        $docDx12 = Read-ArquivoSettings $arquivoDx12
        $versaoDx12 = Get-VersaoJogo $docDx12
        $alvos.Add([pscustomobject]@{ Doc = $docDx12; Versao = $versaoDx12 })
        if ($versaoDx12 -eq 'NextGen' -and (Test-Path -LiteralPath $arquivoDx11)) {
            $alvos.Add([pscustomobject]@{ Doc = (Read-ArquivoSettings $arquivoDx11); Versao = 'NextGenDX11' })
        }
    } elseif (Test-Path -LiteralPath $arquivoDx11) {
        $docDx11 = Read-ArquivoSettings $arquivoDx11
        $versaoDx11 = Get-VersaoJogo $docDx11
        if ($versaoDx11 -eq 'NextGen') { $versaoDx11 = 'NextGenDX11' }
        $alvos.Add([pscustomobject]@{ Doc = $docDx11; Versao = $versaoDx11 })
    }

    $versoes = New-Object System.Collections.Generic.List[string]
    $totalMudancas = 0
    foreach ($alvo in $alvos) {
        $versoes.Add($alvo.Versao)
        Write-Titulo ('{0}  -  {1}' -f $alvo.Doc.Nome, (Get-NomeVersao $alvo.Versao))
        $ajustes = Get-Ajustes $alvo.Versao $cfg
        $mudancas = Set-Ajustes $alvo.Doc $ajustes
        if ($mudancas.Count -eq 0) {
            Write-Ok 'Nada a mudar: o arquivo já está com essas configurações.'
            continue
        }
        foreach ($m in $mudancas) {
            Write-Host ('    [{0}] {1}: {2} -> {3}' -f $m.Secao, $m.Chave, $m.Antes, $m.Depois) -NoNewline
            Write-Host ('   ' + $m.Nota) -ForegroundColor DarkGray
        }
        $totalMudancas += $mudancas.Count
        if ($Simular) { continue }
        $backup = Backup-Arquivo $alvo.Doc.Caminho $pastaBackup
        Save-ArquivoSettings $alvo.Doc
        if ($SomenteLeitura) { (Get-Item -LiteralPath $alvo.Doc.Caminho).IsReadOnly = $true }
        Write-Ok ('{0} alterações gravadas. Backup: {1}' -f $mudancas.Count, $backup)
    }

    if ($versoes.Contains('Remastered') -and (Test-Path -LiteralPath $arquivoDx11)) {
        Write-Info ''
        Write-Info 'user.settings foi ignorado: a versão Remastered só usa o dx12user.settings.'
    }

    if ($Simular) {
        Write-Titulo 'Simulação'
        Write-Info ('{0} valores seriam alterados. Nada foi gravado.' -f $totalMudancas)
        Wait-Saida
        exit 0
    }

    # --- Próximos passos -----------------------------------------------------------------------
    Write-Titulo 'Próximos passos'
    Write-Info '- Abra o jogo e carregue um save. Nos primeiros minutos (e após atualizar o driver) o jogo'
    Write-Info '  compila shaders: alguns engasgos no começo são normais e somem depois.'
    Write-Info '- Confira em Opções > Vídeo. O que você mudar no menu o jogo grava por cima, sem problema.'
    if ($versoes.Contains('Remastered')) {
        if ($modoUpscaler -eq 'FSRNativo') {
            Write-Info '- Se o FSR não aceitar "Nativo (AA)" no menu (a opção depende do FSR 4), escolha "Qualidade".'
        }
        if ($usarFG) {
            Write-Info '- Frame Generation da AMD na 5.01: se o FPS não subir, desligue e ligue o Frame Generation'
            Write-Info '  no menu depois de carregar o save (ou use o mod "witcher3-amd-fsr-framegen-fix").'
        }
    }
    if ($versoes.Contains('NextGen') -and $modoUpscaler -ne 'FSRNativo') {
        Write-Info '- Next-Gen 4.x: no menu, escolha Anti-aliasing = AMD FSR 2 em Qualidade.'
    }
    Write-Info '- No AMD Software (Adrenalin), para o jogo: FreeSync ligado; Radeon Chill, Boost e RSR'
    Write-Info '  desligados; Anti-Lag ligado. Na BIOS: Resizable BAR (Smart Access Memory) e XMP/DOCP.'
    Write-Info '- Para desfazer: rode de novo com -Restaurar (ou opção 5 do Otimizar-Witcher3.bat).'

    Wait-Saida
} catch {
    Stop-ComErro ($_.Exception.Message)
}
