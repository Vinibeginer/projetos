#Requires -Version 5.1
<#
.SYNOPSIS
    Otimiza o The Witcher 3 para Radeon RX 7800 XT + Ryzen 7 5700X + 32 GB, sem passos manuais.

.DESCRIPTION
    Faz tudo sozinho:
      - acha o jogo (Steam, GOG ou Epic) e a pasta Documentos\The Witcher 3;
      - se o jogo estiver aberto, espera você fechar;
      - detecta a versão do jogo, a resolução e o Hz do monitor;
      - grava o perfil direto no dx12user.settings (com backup de cada alteração);
      - instala (e remove quando deixa de servir) a correção do Frame Generation da AMD,
        só quando os arquivos do jogo batem com a versão para a qual ela foi feita;
      - liga a taxa de atualização variável e o Modo de Jogo do Windows e desliga a gravação em
        segundo plano da Xbox Game Bar;
      - confere memória (XMP), Resizable BAR, disco e driver e avisa se algo atrapalha;
      - cria o atalho "The Witcher 3 (Otimizado)" na área de trabalho. Ele reaplica as
        configurações, abre o jogo e, quando você fecha, confere o que o jogo aceitou: se o jogo
        recusar alguma opção nesta placa (ex.: FSR nativo), o script passa a usar a alternativa.

.PARAMETER Perfil
    Qualidade  (padrão) gráficos no máximo sem ray tracing, FSR em resolução nativa (1080p/1440p).
    Fluido     mais FPS: FSR Qualidade e HairWorks desligado.
    RayTracing RTGI + reflexos + AO por ray tracing, FSR Qualidade e Frame Generation.
    Sem -Perfil, usa o último perfil escolhido.

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

.PARAMETER PastaJogo
    Pasta de instalação do jogo, se o script não achar sozinho.

.PARAMETER Jogar
    Modo do atalho: aplica as configurações, abre o jogo, espera fechar e confere o resultado.

.PARAMETER SemAtalho
    Não cria o atalho na área de trabalho.

.PARAMETER SemWindows
    Não mexe nas configurações do Windows.

.PARAMETER SemMod
    Não instala a correção do Frame Generation da AMD.

.PARAMETER Simular
    Mostra o que mudaria sem gravar nada.

.PARAMETER SomenteLeitura
    Marca o arquivo de configuração como somente leitura depois de gravar.

.PARAMETER Restaurar
    Desfaz a última alteração nos arquivos de configuração do jogo.

.PARAMETER RestaurarOriginal
    Desinstala tudo: volta as configurações do jogo e do Windows ao que eram antes do primeiro
    uso, remove a correção do Frame Generation e o atalho.

.PARAMETER SemPausa
    Não espera ENTER no final.

.EXAMPLE
    .\Otimizar-Witcher3.ps1
.EXAMPLE
    .\Otimizar-Witcher3.ps1 -Perfil RayTracing
.EXAMPLE
    .\Otimizar-Witcher3.ps1 -Perfil Fluido -Resolucao 2560x1440 -Hz 165
.EXAMPLE
    .\Otimizar-Witcher3.ps1 -RestaurarOriginal
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

    [string]$PastaJogo = '',

    [switch]$Jogar,

    [switch]$SemAtalho,

    [switch]$SemWindows,

    [switch]$SemMod,

    [switch]$Simular,

    [switch]$SomenteLeitura,

    [switch]$Restaurar,

    [switch]$RestaurarOriginal,

    [switch]$SemPausa
)

$ParametrosInformados = $PSBoundParameters
$CaminhoScript = $MyInvocation.MyCommand.Path
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Invariante = [System.Globalization.CultureInfo]::InvariantCulture
$EstiloNumero = [System.Globalization.NumberStyles]::Float
$NomesArquivos = @('dx12user.settings', 'user.settings')
$NomesPerfis = @('Qualidade', 'Fluido', 'RayTracing')
$NomesOpcoes = @('Resolucao', 'Hz', 'LimiteFPS', 'Upscaler', 'FrameGen', 'HairWorks', 'VSync')
$PastaInstalacao = Join-Path $env:LOCALAPPDATA 'OtimizadorWitcher3'
$ArquivoEstado = Join-Path $PastaInstalacao 'estado.json'
$ArquivoLog = Join-Path $PastaInstalacao 'ultimo-log.txt'
$ScriptInstalado = Join-Path $PastaInstalacao 'Otimizar-Witcher3.ps1'
$NomeAtalho = 'The Witcher 3 (Otimizado).lnk'
$SteamAppId = '292030'
$SemPausaEfetivo = ($SemPausa.IsPresent -or $Jogar.IsPresent)
$Pendencias = New-Object System.Collections.Generic.List[string]

# Correção do Frame Generation da AMD (github.com/AlphaBoom/witcher3-amd-fsr-framegen-fix, MIT).
# Na 5.01c o FSR Frame Generation aparece ligado mas só funciona depois de desligar e ligar no
# menu; o mod faz isso sozinho ao carregar o save. Ele substitui dois scripts do jogo, por isso só
# é instalado quando os originais do jogo têm exatamente os hashes da versão para a qual foi feito,
# e é removido sozinho quando o jogo atualiza. O download também é conferido por SHA-256.
$ModFG = @{
    Nome        = 'modFSRStartupReinit'
    Url         = 'https://github.com/AlphaBoom/witcher3-amd-fsr-framegen-fix/releases/download/v1.0.0/witcher3-amd-fsr-framegen-fix-v1.0.0.zip'
    ZipSha256   = '36BD899D2C1AE2FFCABF59C0E7A202CEF64DB37BF6270D23D66AD70E33406D99'
    ScriptsJogo = @{
        'content\content0\scripts\game\player\player.ws' = 'EB5B88EDEA7EDD5C90AEF2DC75B7B4123DF46126A82F65F386F6E924EDDFCA36'
        'content\content0\scripts\game\r4game.ws'        = '045CDDDFF8FFF73A68B2C3EA37E8BF6BF2DA47C40B2A09DFE82D4FA97548EC9B'
    }
    ScriptsMod  = @{
        'content\scripts\game\player\player.ws' = '549303300BF9126556380E5201693507680B72077B8FB7E1EFAEA3D860EBD9DC'
        'content\scripts\game\r4game.ws'        = '350B88D57ECC1E9D0F4A37308BADE80467A044E9F9CD6B42C2F21E6AB709F863'
    }
}

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

function Write-Cabecalho {
    Write-Host ''
    Write-Host '  Otimizador The Witcher 3  |  Radeon RX 7800 XT + Ryzen 7 5700X + 32 GB' -ForegroundColor Cyan
    Write-Host '  ----------------------------------------------------------------------' -ForegroundColor Cyan
}

function Wait-Saida {
    if (-not $SemPausaEfetivo) {
        Write-Host ''
        [void](Read-Host '  Pressione ENTER para fechar')
    }
}

function ConvertTo-TextoBool([bool]$Valor) {
    if ($Valor) { return 'true' }
    return 'false'
}

# true/1, false/0 e 16/16.000000 contam como o mesmo valor
function Get-ValorNormalizado([string]$Valor) {
    $v = $Valor.Trim().Trim('"').ToLowerInvariant()
    if ($v -eq 'true') { return '1' }
    if ($v -eq 'false') { return '0' }
    $numero = 0.0
    if ([double]::TryParse($v, $EstiloNumero, $Invariante, [ref]$numero)) { return $numero.ToString($Invariante) }
    return $v
}

# ---------------------------------------------------------------------------------------------
# Estado salvo entre execuções (%LOCALAPPDATA%\OtimizadorWitcher3\estado.json)
# ---------------------------------------------------------------------------------------------

function New-Estado {
    return @{
        Perfil          = 'Qualidade'
        Opcoes          = @{}
        Aplicado        = @{}
        Rejeitados      = @()
        VersaoJogo      = ''
        ModFGInstalado  = $false
        WindowsOriginal = @{}
    }
}

function Read-Estado {
    $estado = New-Estado
    if (-not (Test-Path -LiteralPath $ArquivoEstado)) { return $estado }
    try {
        $json = [System.IO.File]::ReadAllText($ArquivoEstado) | ConvertFrom-Json
        foreach ($p in $json.PSObject.Properties) {
            if ($p.Value -is [System.Management.Automation.PSCustomObject]) {
                $h = @{}
                foreach ($q in $p.Value.PSObject.Properties) { $h[$q.Name] = $q.Value }
                $estado[$p.Name] = $h
            } else {
                $estado[$p.Name] = $p.Value
            }
        }
    } catch {
        Write-Aviso 'O estado salvo estava ilegível; começando do zero.'
    }
    if ($null -eq $estado.Rejeitados) { $estado.Rejeitados = @() }
    $estado.Rejeitados = @($estado.Rejeitados | Where-Object { $_ })
    return $estado
}

function Save-Estado($Estado) {
    if (-not (Test-Path -LiteralPath $PastaInstalacao)) {
        [void](New-Item -ItemType Directory -Path $PastaInstalacao -Force)
    }
    $json = $Estado | ConvertTo-Json -Depth 6
    [System.IO.File]::WriteAllText($ArquivoEstado, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-Opcao($Opcoes, [string]$Nome, $Padrao) {
    if ($Opcoes.ContainsKey($Nome) -and $null -ne $Opcoes[$Nome] -and [string]$Opcoes[$Nome] -ne '') {
        return $Opcoes[$Nome]
    }
    return $Padrao
}

function Get-OpcoesEfetivas($Estado) {
    $opcoes = @{}
    if ($Jogar -and $Estado.Opcoes) {
        foreach ($k in @($Estado.Opcoes.Keys)) { $opcoes[$k] = $Estado.Opcoes[$k] }
    }
    foreach ($nome in $NomesOpcoes) {
        if ($ParametrosInformados.ContainsKey($nome)) {
            $valor = $ParametrosInformados[$nome]
            if ($valor -is [System.Management.Automation.SwitchParameter]) { $valor = $valor.IsPresent }
            $opcoes[$nome] = $valor
        }
    }
    return $opcoes
}

function Get-PerfilEfetivo($Estado) {
    if ($ParametrosInformados.ContainsKey('Perfil')) { return $Perfil }
    $salvo = [string]$Estado.Perfil
    if ($NomesPerfis -contains $salvo) { return $salvo }
    return 'Qualidade'
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
# Detecção: jogo, pasta de configuração, versão e hardware
# ---------------------------------------------------------------------------------------------

function Get-ExeJogo([string]$Raiz) {
    if (-not $Raiz) { return $null }
    foreach ($relativo in @('bin\x64_dx12\witcher3.exe', 'bin\x64\witcher3.exe')) {
        $candidato = Join-Path $Raiz $relativo
        if (Test-Path -LiteralPath $candidato) { return $candidato }
    }
    return $null
}

function Get-VersaoExe([string]$Exe) {
    if (-not $Exe) { return '' }
    try {
        $versao = (Get-Item -LiteralPath $Exe).VersionInfo.FileVersion
        if ($versao) { return ([string]$versao).Trim() }
    } catch { }
    return ''
}

function Test-JogoAberto {
    return [bool](Get-Process -Name 'witcher3' -ErrorAction SilentlyContinue)
}

function Find-Jogo {
    $candidatas = New-Object System.Collections.Generic.List[object]
    if ($PastaJogo) { $candidatas.Add(@{ Pasta = $PastaJogo; Uri = $null }) }

    foreach ($processo in @(Get-Process -Name 'witcher3' -ErrorAction SilentlyContinue)) {
        try {
            if ($processo.Path) {
                $raiz = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $processo.Path))
                $candidatas.Add(@{ Pasta = $raiz; Uri = $null })
            }
        } catch { }
    }

    try {
        $steam = (Get-ItemProperty -Path 'HKCU:\Software\Valve\Steam' -ErrorAction Stop).SteamPath
        if ($steam) {
            $steam = $steam -replace '/', '\'
            $bibliotecas = New-Object System.Collections.Generic.List[string]
            $bibliotecas.Add($steam)
            $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
            if (Test-Path -LiteralPath $vdf) {
                foreach ($m in [regex]::Matches([System.IO.File]::ReadAllText($vdf), '"path"\s+"([^"]+)"')) {
                    $bibliotecas.Add(($m.Groups[1].Value -replace '\\\\', '\'))
                }
            }
            foreach ($biblioteca in $bibliotecas) {
                $acf = Join-Path $biblioteca ('steamapps\appmanifest_' + $SteamAppId + '.acf')
                if (-not (Test-Path -LiteralPath $acf)) { continue }
                $instalacao = 'The Witcher 3'
                $m = [regex]::Match([System.IO.File]::ReadAllText($acf), '"installdir"\s+"([^"]+)"')
                if ($m.Success) { $instalacao = $m.Groups[1].Value }
                $candidatas.Add(@{ Pasta = (Join-Path $biblioteca ('steamapps\common\' + $instalacao)); Uri = $null })
            }
        }
    } catch { }

    foreach ($raizRegistro in @('HKLM:\SOFTWARE\WOW6432Node\GOG.com\Games', 'HKLM:\SOFTWARE\GOG.com\Games')) {
        if (-not (Test-Path -Path $raizRegistro)) { continue }
        foreach ($chave in @(Get-ChildItem -Path $raizRegistro -ErrorAction SilentlyContinue)) {
            $v = Get-ItemProperty -Path $chave.PSPath -ErrorAction SilentlyContinue
            if ($v -and [string]$v.gameName -match 'Witcher 3' -and $v.path) {
                $candidatas.Add(@{ Pasta = [string]$v.path; Uri = $null })
            }
        }
    }

    try {
        $manifestos = Join-Path $env:ProgramData 'Epic\EpicGamesLauncher\Data\Manifests'
        if (Test-Path -LiteralPath $manifestos) {
            foreach ($arquivo in @(Get-ChildItem -LiteralPath $manifestos -Filter '*.item' -ErrorAction SilentlyContinue)) {
                try {
                    $j = [System.IO.File]::ReadAllText($arquivo.FullName) | ConvertFrom-Json
                    if ([string]$j.DisplayName -match 'Witcher 3' -and $j.InstallLocation) {
                        $uri = 'com.epicgames.launcher://apps/{0}%3A{1}%3A{2}?action=launch&silent=true' -f $j.CatalogNamespace, $j.CatalogItemId, $j.AppName
                        $candidatas.Add(@{ Pasta = [string]$j.InstallLocation; Uri = $uri })
                    }
                } catch { }
            }
        }
    } catch { }

    foreach ($raizRegistro in @(
            'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
            'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
            'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall')) {
        if (-not (Test-Path -Path $raizRegistro)) { continue }
        foreach ($chave in @(Get-ChildItem -Path $raizRegistro -ErrorAction SilentlyContinue)) {
            $v = Get-ItemProperty -Path $chave.PSPath -ErrorAction SilentlyContinue
            if ($v -and [string]$v.DisplayName -match 'Witcher 3' -and $v.InstallLocation) {
                $candidatas.Add(@{ Pasta = [string]$v.InstallLocation; Uri = $null })
            }
        }
    }

    foreach ($c in $candidatas) {
        if (Get-ExeJogo $c.Pasta) { return [pscustomobject]$c }
    }
    return $null
}

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
    foreach ($candidata in $candidatas) {
        foreach ($nome in $NomesArquivos) {
            if (Test-Path -LiteralPath (Join-Path $candidata $nome)) { return $candidata }
        }
    }
    return $null
}

function Get-VersaoJogo($Doc, [string]$VersaoExe) {
    if ($VersaoExe -match '^\s*(\d+)') {
        $principal = [int]$Matches[1]
        if ($principal -ge 5) { return 'Remastered' }
        if ($principal -eq 4) { return 'NextGen' }
    }
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
    $placa = ''; $pnp = ''; $dataDriver = $null; $largura = 0; $altura = 0; $taxa = 0; $cpu = ''; $ram = 0
    try {
        $controladoras = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop)
        $ativas = @($controladoras | Where-Object { $_.CurrentHorizontalResolution -gt 0 })
        $amd = @($controladoras | Where-Object { $_.Name -match 'AMD|Radeon' })
        $amdAtivas = @($ativas | Where-Object { $_.Name -match 'AMD|Radeon' })
        $escolhida = $null
        if ($amdAtivas.Count -gt 0) { $escolhida = $amdAtivas[0] }
        elseif ($amd.Count -gt 0) { $escolhida = $amd[0] }
        elseif ($ativas.Count -gt 0) { $escolhida = $ativas[0] }
        elseif ($controladoras.Count -gt 0) { $escolhida = $controladoras[0] }
        if ($escolhida) {
            $placa = [string]$escolhida.Name
            $pnp = [string]$escolhida.PNPDeviceID
            $dataDriver = $escolhida.DriverDate
            if ($escolhida.CurrentHorizontalResolution -gt 0) {
                $largura = [int]$escolhida.CurrentHorizontalResolution
                $altura = [int]$escolhida.CurrentVerticalResolution
            }
            if ($escolhida.CurrentRefreshRate -gt 1) { $taxa = [int]$escolhida.CurrentRefreshRate }
        }
        if ($largura -eq 0 -and $ativas.Count -gt 0) {
            $largura = [int]$ativas[0].CurrentHorizontalResolution
            $altura = [int]$ativas[0].CurrentVerticalResolution
            if ($ativas[0].CurrentRefreshRate -gt 1) { $taxa = [int]$ativas[0].CurrentRefreshRate }
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
    return [pscustomobject]@{
        Placa = $placa; Pnp = $pnp; DataDriver = $dataDriver
        Largura = $largura; Altura = $altura; Taxa = $taxa; Cpu = $cpu; RamGB = $ram
    }
}

# ---------------------------------------------------------------------------------------------
# Verificações do que fica fora do jogo. O script só mede e avisa: BIOS e driver não podem ser
# alterados com segurança por um script do Windows.
# ---------------------------------------------------------------------------------------------

function Test-Memoria {
    try {
        $modulos = @(Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction Stop)
        if ($modulos.Count -eq 0) { return }
        $atual = 0
        $nominal = 0
        foreach ($m in $modulos) {
            if ($m.ConfiguredClockSpeed -gt $atual) { $atual = [int]$m.ConfiguredClockSpeed }
            if ($m.Speed -gt $nominal) { $nominal = [int]$m.Speed }
            $codigo = ([string]$m.PartNumber).Trim()
            if ($codigo -match '(?<!\d)(2933|3000|3200|3466|3600|3733|3800|4000|4133|4266|4400)(?!\d)') {
                $nominal = [math]::Max($nominal, [int]$Matches[1])
            } elseif ($codigo -match '^(?:KF|HX)4(\d{2})C') {
                $nominal = [math]::Max($nominal, [int]$Matches[1] * 100)
            } elseif ($codigo -match '^BL\w*?G(\d{2})C') {
                $nominal = [math]::Max($nominal, [int]$Matches[1] * 100)
            }
        }
        if ($atual -le 0) { return }
        if ($nominal -gt $atual + 100) {
            Write-Aviso ('Memória a {0} MHz, mas o kit é de {1} MHz: o perfil XMP/DOCP está desligado.' -f $atual, $nominal)
            $Pendencias.Add(('Ligar o XMP/DOCP na BIOS (memória a {0} MHz, o kit é de {1} MHz). No Ryzen isso reduz bastante os engasgos.' -f $atual, $nominal))
        } elseif ($atual -le 2666) {
            Write-Aviso ('Memória a {0} MHz, lenta para Ryzen. Se o kit for de 3200/3600 MHz, o XMP/DOCP está desligado.' -f $atual)
            $Pendencias.Add(('Conferir o XMP/DOCP na BIOS (memória a {0} MHz).' -f $atual))
        } else {
            Write-Ok ('Memória a {0} MHz.' -f $atual)
        }
    } catch { }
}

function Test-ReBar([string]$Pnp) {
    if (-not $Pnp) { return }
    try {
        $filtro = "DeviceID='{0}'" -f ($Pnp -replace '\\', '\\')
        $dispositivo = Get-CimInstance -ClassName Win32_PnPEntity -Filter $filtro -ErrorAction Stop | Select-Object -First 1
        if (-not $dispositivo) { return }
        $faixas = @(Get-CimAssociatedInstance -InputObject $dispositivo -ResultClassName Win32_DeviceMemoryAddress -ErrorAction Stop)
        $maior = [double]0
        foreach ($f in $faixas) {
            $tamanho = [double]$f.EndingAddress - [double]$f.StartingAddress + 1
            if ($tamanho -gt $maior) { $maior = $tamanho }
        }
        if ($maior -ge 2147483648) {
            Write-Ok 'Resizable BAR (Smart Access Memory) ativo.'
        } elseif ([math]::Abs($maior - 268435456) -lt 1048576) {
            Write-Aviso 'O Resizable BAR (Smart Access Memory) parece desligado.'
            $Pendencias.Add('Ligar na BIOS "Above 4G Decoding" e "Re-Size BAR Support" (Smart Access Memory).')
        }
    } catch { }
}

function Test-Disco([string]$Raiz) {
    if (-not $Raiz -or $Raiz -notmatch '^([A-Za-z]):') { return }
    try {
        $particao = Get-Partition -DriveLetter $Matches[1] -ErrorAction Stop
        $fisico = Get-PhysicalDisk -ErrorAction Stop | Where-Object { [string]$_.DeviceId -eq [string]$particao.DiskNumber } | Select-Object -First 1
        if ($fisico -and [string]$fisico.MediaType -eq 'HDD') {
            Write-Aviso 'O jogo está num HD mecânico: isso causa travadas ao cavalgar e ao entrar em cidades.'
            $Pendencias.Add('Mover o jogo para um SSD (na Steam: Propriedades > Arquivos instalados > Mover pasta de instalação).')
        } elseif ($fisico -and [string]$fisico.MediaType -eq 'SSD') {
            Write-Ok 'Jogo instalado em SSD.'
        }
    } catch { }
}

function Test-Driver($Data) {
    if (-not ($Data -is [datetime])) { return }
    $dias = ((Get-Date) - $Data).Days
    if ($dias -gt 200) {
        Write-Aviso ('Driver de vídeo de {0:dd/MM/yyyy}. A versão Remastered precisa de driver recente (FSR 4, Anti-Lag 2).' -f $Data)
        $Pendencias.Add('Atualizar o driver da AMD (AMD Software: Adrenalin > Sistema > Verificar se há atualizações).')
    } else {
        Write-Ok ('Driver de vídeo de {0:dd/MM/yyyy}.' -f $Data)
    }
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

function Set-Ajustes($Doc, $Ajustes, $Estado) {
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
        } else {
            $recusado = '{0}|{1}={2}' -f $a.Secao, $a.Chave, $a.Valor
            if (@($Estado.Rejeitados) -contains $recusado) { continue }
            $Estado.Aplicado[('{0}|{1}|{2}' -f $Doc.Nome, $a.Secao, $a.Chave)] = $a.Valor
        }
        if ($null -ne $atual -and (Get-ValorNormalizado $atual) -eq (Get-ValorNormalizado $a.Valor)) { continue }
        Set-ValorIni $Doc $a.Secao $a.Chave $a.Valor
        $antes = '(novo)'
        if ($null -ne $atual) { $antes = $atual }
        $mudancas.Add([pscustomobject]@{ Secao = $a.Secao; Chave = $a.Chave; Antes = $antes; Depois = $a.Valor; Nota = $a.Nota })
    }
    return ,$mudancas
}

# ---------------------------------------------------------------------------------------------
# Backup e restauração dos arquivos do jogo
# ---------------------------------------------------------------------------------------------

function Backup-Arquivo([string]$Caminho, [string]$DirBackup) {
    if (-not (Test-Path -LiteralPath $DirBackup)) {
        [void](New-Item -ItemType Directory -Path $DirBackup)
    }
    $nome = Split-Path -Leaf $Caminho
    $original = Join-Path $DirBackup ($nome + '.original')
    if (-not (Test-Path -LiteralPath $original)) {
        Copy-Item -LiteralPath $Caminho -Destination $original
    }
    $carimbo = Get-Date -Format 'yyyyMMdd-HHmmss'
    $destino = Join-Path $DirBackup ('{0}.{1}.bak' -f $nome, $carimbo)
    Copy-Item -LiteralPath $Caminho -Destination $destino -Force
    # mantém só os 15 backups mais recentes de cada arquivo (o .original fica sempre)
    $antigos = @(Get-ChildItem -LiteralPath $DirBackup -Filter ($nome + '.*.bak') -File -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -Skip 15)
    foreach ($velho in $antigos) { Remove-Item -LiteralPath $velho.FullName -Force -ErrorAction SilentlyContinue }
    return $destino
}

function Restore-ArquivosJogo([string]$DirConfig, [bool]$Original) {
    $dirBackup = Join-Path $DirConfig 'backup-otimizador'
    if (-not (Test-Path -LiteralPath $dirBackup)) {
        Write-Aviso 'Nenhum backup das configurações do jogo encontrado.'
        return
    }
    $restaurou = $false
    foreach ($nome in $NomesArquivos) {
        $origem = $null
        if ($Original) {
            $candidato = Join-Path $dirBackup ($nome + '.original')
            if (Test-Path -LiteralPath $candidato) { $origem = $candidato }
        } else {
            $ultimo = Get-ChildItem -LiteralPath $dirBackup -Filter ($nome + '.*.bak') -File -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending | Select-Object -First 1
            if ($ultimo) { $origem = $ultimo.FullName }
        }
        if (-not $origem) { continue }
        $destino = Join-Path $DirConfig $nome
        if (Test-Path -LiteralPath $destino) {
            Copy-Item -LiteralPath $destino -Destination (Join-Path $dirBackup ($nome + '.antes-de-restaurar')) -Force
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
# Windows (só chaves do usuário atual, sem precisar de administrador; o valor original de cada uma
# fica guardado para a opção de desinstalar)
# ---------------------------------------------------------------------------------------------

function Set-ValorRegistro($Estado, [string]$Chave, [string]$Nome, $Valor, [string]$Tipo, [string]$Rotulo) {
    if (-not (Test-Path -Path $Chave)) { [void](New-Item -Path $Chave -Force) }
    $propriedade = Get-ItemProperty -Path $Chave -Name $Nome -ErrorAction SilentlyContinue
    $atual = $null
    if ($propriedade) { $atual = $propriedade.$Nome }
    $id = $Chave + '|' + $Nome
    if (-not $Estado.WindowsOriginal.ContainsKey($id)) {
        $Estado.WindowsOriginal[$id] = @{ Existia = ($null -ne $atual); Valor = $atual; Tipo = $Tipo }
    }
    if ($null -ne $atual -and [string]$atual -eq [string]$Valor) {
        Write-Ok ($Rotulo + ' (já estava)')
        return
    }
    [void](New-ItemProperty -Path $Chave -Name $Nome -Value $Valor -PropertyType $Tipo -Force)
    Write-Ok $Rotulo
}

function Set-ConfigWindows($Estado) {
    Write-Titulo 'Windows'
    $chaveDx = 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences'
    $nomeDx = 'DirectXUserGlobalSettings'
    $atual = ''
    $propriedade = Get-ItemProperty -Path $chaveDx -Name $nomeDx -ErrorAction SilentlyContinue
    if ($propriedade) { $atual = [string]$propriedade.$nomeDx }
    $pares = [ordered]@{}
    foreach ($parte in ($atual -split ';')) {
        if ($parte.Trim() -match '^([^=]+)=(.*)$') { $pares[$Matches[1].Trim()] = $Matches[2].Trim() }
    }
    $pares['SwapEffectUpgradeEnable'] = '1'
    $pares['VRROptimizeEnable'] = '1'
    $novo = ''
    foreach ($k in $pares.Keys) { $novo += ('{0}={1};' -f $k, $pares[$k]) }
    Set-ValorRegistro $Estado $chaveDx $nomeDx $novo 'String' 'Taxa de atualização variável e otimização para jogos em janela ligadas'
    Set-ValorRegistro $Estado 'HKCU:\Software\Microsoft\GameBar' 'AutoGameModeEnabled' 1 'DWord' 'Modo de Jogo ligado'
    Set-ValorRegistro $Estado 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' 'HistoricalCaptureEnabled' 0 'DWord' 'Gravação em segundo plano da Xbox Game Bar desligada (custa FPS)'
}

function Restore-ConfigWindows($Estado) {
    if (-not $Estado.WindowsOriginal -or $Estado.WindowsOriginal.Count -eq 0) { return }
    Write-Titulo 'Windows'
    foreach ($id in @($Estado.WindowsOriginal.Keys)) {
        $partes = $id.Split('|')
        if ($partes.Count -ne 2) { continue }
        $original = $Estado.WindowsOriginal[$id]
        try {
            if ($original.Existia) {
                [void](New-ItemProperty -Path $partes[0] -Name $partes[1] -Value $original.Valor -PropertyType $original.Tipo -Force)
            } else {
                Remove-ItemProperty -Path $partes[0] -Name $partes[1] -ErrorAction SilentlyContinue
            }
            Write-Ok ('{0} voltou ao valor original' -f $partes[1])
        } catch {
            Write-Aviso ('Não consegui restaurar {0}: {1}' -f $partes[1], $_.Exception.Message)
        }
    }
    $Estado.WindowsOriginal = @{}
}

# ---------------------------------------------------------------------------------------------
# Correção do Frame Generation da AMD
# ---------------------------------------------------------------------------------------------

function Invoke-ComoAdmin([string]$Comando) {
    $completo = "`$ErrorActionPreference = 'Stop'; " + $Comando
    $codificado = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($completo))
    $argumentos = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $codificado)
    $processo = Start-Process -FilePath 'powershell.exe' -ArgumentList $argumentos -Verb RunAs -Wait -PassThru -WindowStyle Hidden
    if ($processo.ExitCode -ne 0) { throw 'a operação como administrador falhou' }
}

function Test-ErroDeAcesso($Erro) {
    $excecao = $Erro.Exception
    while ($excecao) {
        if ($excecao -is [System.UnauthorizedAccessException] -or $excecao -is [System.Security.SecurityException]) { return $true }
        $excecao = $excecao.InnerException
    }
    return ([string]$Erro.FullyQualifiedErrorId -match 'UnauthorizedAccess|PermissionDenied')
}

function ConvertTo-Literal([string]$Texto) {
    return "'" + ($Texto -replace "'", "''") + "'"
}

function Test-ModFGCompativel([string]$Raiz) {
    foreach ($relativo in $ModFG.ScriptsJogo.Keys) {
        $arquivo = Join-Path $Raiz $relativo
        if (-not (Test-Path -LiteralPath $arquivo)) { return $false }
        if ((Get-FileHash -LiteralPath $arquivo -Algorithm SHA256).Hash -ne $ModFG.ScriptsJogo[$relativo]) { return $false }
    }
    return $true
}

function Install-ModFG([string]$Raiz) {
    $temporario = Join-Path ([System.IO.Path]::GetTempPath()) ('otimizador-w3-' + [guid]::NewGuid().ToString('N'))
    [void](New-Item -ItemType Directory -Path $temporario)
    try {
        $zip = Join-Path $temporario 'mod.zip'
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $ModFG.Url -OutFile $zip -UseBasicParsing
        if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $ModFG.ZipSha256) {
            throw 'o arquivo baixado não confere (SHA-256 diferente do esperado)'
        }
        $extraido = Join-Path $temporario 'x'
        Expand-Archive -LiteralPath $zip -DestinationPath $extraido
        $origem = Join-Path $extraido ('mods\' + $ModFG.Nome)
        foreach ($relativo in $ModFG.ScriptsMod.Keys) {
            $arquivo = Join-Path $origem $relativo
            if (-not (Test-Path -LiteralPath $arquivo) -or
                (Get-FileHash -LiteralPath $arquivo -Algorithm SHA256).Hash -ne $ModFG.ScriptsMod[$relativo]) {
                throw 'o conteúdo do mod não confere'
            }
        }
        $pastaMods = Join-Path $Raiz 'mods'
        try {
            if (-not (Test-Path -LiteralPath $pastaMods)) { [void](New-Item -ItemType Directory -Path $pastaMods) }
            Copy-Item -LiteralPath $origem -Destination $pastaMods -Recurse -Force
        } catch {
            if (-not (Test-ErroDeAcesso $_)) { throw }
            Write-Info 'A pasta do jogo exige permissão de administrador: confirme no aviso do Windows.'
            Invoke-ComoAdmin ('New-Item -ItemType Directory -Force -Path {0} | Out-Null; Copy-Item -LiteralPath {1} -Destination {0} -Recurse -Force' -f
                (ConvertTo-Literal $pastaMods), (ConvertTo-Literal $origem))
        }
    } finally {
        Remove-Item -LiteralPath $temporario -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Remove-ModFG([string]$PastaMod) {
    try {
        Remove-Item -LiteralPath $PastaMod -Recurse -Force
    } catch {
        if (-not (Test-ErroDeAcesso $_)) { throw }
        Invoke-ComoAdmin ('Remove-Item -LiteralPath {0} -Recurse -Force' -f (ConvertTo-Literal $PastaMod))
    }
}

function Update-ModFG($Jogo, [string]$Versao, [bool]$UsarFG, $Estado) {
    if (-not $Jogo -or $Versao -ne 'Remastered') { return }
    $pastaMod = Join-Path $Jogo.Pasta ('mods\' + $ModFG.Nome)
    $existe = Test-Path -LiteralPath $pastaMod
    $nosso = [bool]$Estado.ModFGInstalado
    if (-not $UsarFG -and -not $existe) { return }

    Write-Titulo 'Correção do Frame Generation da AMD'
    $compativel = Test-ModFGCompativel $Jogo.Pasta

    if ($UsarFG -and $compativel -and -not $SemMod) {
        if ($existe) {
            Write-Ok 'Já instalada (ao carregar o save ela religa o Frame Generation sozinha).'
            return
        }
        try {
            Install-ModFG $Jogo.Pasta
            $Estado.ModFGInstalado = $true
            Write-Ok 'Instalada: ao carregar o save ela religa o Frame Generation sozinha (bug da 5.01).'
        } catch {
            Write-Aviso ('Não consegui instalar: ' + $_.Exception.Message)
        }
        return
    }

    if ($existe -and $nosso) {
        $motivo = 'o Frame Generation está desligado neste perfil'
        if (-not $compativel) { $motivo = 'o jogo foi atualizado e ela não é mais compatível' }
        try {
            Remove-ModFG $pastaMod
            $Estado.ModFGInstalado = $false
            Write-Ok ('Removida porque ' + $motivo + '.')
        } catch {
            Write-Aviso ('Não consegui remover {0}: {1}' -f $pastaMod, $_.Exception.Message)
        }
        return
    }

    if ($UsarFG -and -not $compativel) {
        Write-Info 'Esta versão do jogo é diferente da 5.01c: a correção não se aplica e não foi instalada.'
    } elseif ($existe -and -not $compativel) {
        Write-Aviso ('Há uma cópia do mod {0} que não foi instalada por este script e não bate com esta versão do jogo.' -f $ModFG.Nome)
    }
}

# ---------------------------------------------------------------------------------------------
# Instalação do otimizador e atalho na área de trabalho
# ---------------------------------------------------------------------------------------------

function Install-Otimizador($Jogo) {
    if (-not (Test-Path -LiteralPath $PastaInstalacao)) { [void](New-Item -ItemType Directory -Path $PastaInstalacao -Force) }
    if ($CaminhoScript -and $CaminhoScript -ne $ScriptInstalado) {
        Copy-Item -LiteralPath $CaminhoScript -Destination $ScriptInstalado -Force
        try { Unblock-File -LiteralPath $ScriptInstalado } catch { }
    }
    if ($SemAtalho) { return }
    Write-Titulo 'Atalho'
    try {
        $areaDeTrabalho = [Environment]::GetFolderPath('Desktop')
        $caminhoAtalho = Join-Path $areaDeTrabalho $NomeAtalho
        $jaExistia = Test-Path -LiteralPath $caminhoAtalho
        $shell = New-Object -ComObject WScript.Shell
        $atalho = $shell.CreateShortcut($caminhoAtalho)
        $atalho.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $atalho.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "' + $ScriptInstalado + '" -Jogar'
        $atalho.WorkingDirectory = $PastaInstalacao
        $atalho.WindowStyle = 7
        $atalho.Description = 'Reaplica as configurações otimizadas e abre o The Witcher 3'
        if ($Jogo) {
            $exe = Get-ExeJogo $Jogo.Pasta
            if ($exe) { $atalho.IconLocation = $exe + ',0' }
        }
        $atalho.Save()
        if ($jaExistia) { Write-Ok '"The Witcher 3 (Otimizado)" atualizado na área de trabalho.' }
        else { Write-Ok '"The Witcher 3 (Otimizado)" criado na área de trabalho.' }
    } catch {
        Write-Aviso ('Não consegui criar o atalho: ' + $_.Exception.Message)
    }
}

function Remove-Instalacao {
    $caminhoAtalho = Join-Path ([Environment]::GetFolderPath('Desktop')) $NomeAtalho
    if (Test-Path -LiteralPath $caminhoAtalho) {
        Remove-Item -LiteralPath $caminhoAtalho -Force
        Write-Ok 'Atalho removido da área de trabalho.'
    }
    foreach ($arquivo in @($ArquivoEstado, $ScriptInstalado)) {
        if (Test-Path -LiteralPath $arquivo) { Remove-Item -LiteralPath $arquivo -Force -ErrorAction SilentlyContinue }
    }
}

# ---------------------------------------------------------------------------------------------
# Abrir o jogo e esperar
# ---------------------------------------------------------------------------------------------

function Start-Jogo($Jogo) {
    if ($Jogo -and $Jogo.Pasta -match '\\steamapps\\common\\') {
        Write-Info 'Abrindo o jogo pela Steam...'
        Start-Process ('steam://rungameid/' + $SteamAppId)
        return $true
    }
    if ($Jogo -and $Jogo.Uri) {
        Write-Info 'Abrindo o jogo pela Epic...'
        Start-Process $Jogo.Uri
        return $true
    }
    if ($Jogo) {
        $exe = Get-ExeJogo $Jogo.Pasta
        if ($exe) {
            Write-Info 'Abrindo o jogo...'
            Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe)
            return $true
        }
    }
    if (Test-Path -Path 'HKCU:\Software\Valve\Steam') {
        Write-Info 'Abrindo o jogo pela Steam...'
        Start-Process ('steam://rungameid/' + $SteamAppId)
        return $true
    }
    return $false
}

function Wait-JogoFechar {
    if (-not (Test-JogoAberto)) { return }
    Write-Info 'O jogo está aberto: assim que você fechar, eu continuo (ele regrava as configurações ao sair).'
    while (Test-JogoAberto) { Start-Sleep -Seconds 3 }
    Start-Sleep -Seconds 3
}

function Wait-Sessao {
    $limite = (Get-Date).AddMinutes(5)
    while (-not (Test-JogoAberto) -and (Get-Date) -lt $limite) { Start-Sleep -Seconds 2 }
    if (-not (Test-JogoAberto)) { return $false }
    Write-Info 'Jogo aberto. Bom jogo! Quando você fechar, eu confiro as configurações.'
    while (Test-JogoAberto) { Start-Sleep -Seconds 3 }
    Start-Sleep -Seconds 3
    return $true
}

function Test-PosSessao($Estado, [string]$DirConfig) {
    if (-not $DirConfig -or $Estado.Aplicado.Count -eq 0) { return }
    Write-Titulo 'Conferindo o que o jogo gravou'
    $novos = 0
    foreach ($nome in $NomesArquivos) {
        $arquivo = Join-Path $DirConfig $nome
        if (-not (Test-Path -LiteralPath $arquivo)) { continue }
        $doc = Read-ArquivoSettings $arquivo
        foreach ($id in @($Estado.Aplicado.Keys)) {
            $partes = $id.Split('|')
            if ($partes.Count -ne 3 -or $partes[0] -ne $nome) { continue }
            $atual = Get-ValorIni $doc $partes[1] $partes[2]
            $esperado = [string]$Estado.Aplicado[$id]
            if ($null -eq $atual -or (Get-ValorNormalizado $atual) -eq (Get-ValorNormalizado $esperado)) { continue }
            $recusado = '{0}|{1}={2}' -f $partes[1], $partes[2], $esperado
            if (@($Estado.Rejeitados) -notcontains $recusado) {
                $Estado.Rejeitados = @($Estado.Rejeitados) + $recusado
                $novos++
            }
            Write-Aviso ('O jogo trocou [{0}] {1} de {2} para {3}; daqui pra frente o script usa a alternativa.' -f $partes[1], $partes[2], $esperado, $atual)
        }
    }
    if ($novos -eq 0) { Write-Ok 'O jogo manteve todas as configurações.' }
}

# ---------------------------------------------------------------------------------------------
# Otimização (usada pelos dois modos)
# ---------------------------------------------------------------------------------------------

function Invoke-Otimizacao($Estado, [string]$PerfilEscolhido, $Opcoes, $Ctx) {
    $Pendencias.Clear()

    Write-Titulo 'Jogo'
    $jogo = Find-Jogo
    $versaoExe = ''
    if ($jogo) {
        $exe = Get-ExeJogo $jogo.Pasta
        $versaoExe = Get-VersaoExe $exe
        Write-Info ('Instalado em:   ' + $jogo.Pasta)
        if ($versaoExe) { Write-Info ('Versão:         ' + $versaoExe) }
        if ($versaoExe -and $versaoExe -ne [string]$Estado.VersaoJogo) {
            if (@($Estado.Rejeitados).Count -gt 0) {
                Write-Info 'O jogo foi atualizado: as opções que ele recusava antes serão testadas de novo.'
            }
            $Estado.Rejeitados = @()
            $Estado.VersaoJogo = $versaoExe
        }
    } else {
        Write-Aviso 'Não achei a instalação do jogo (Steam, GOG ou Epic); sigo só com o arquivo de configuração.'
    }
    $Ctx.Jogo = $jogo

    $dirConfig = Find-PastaConfig
    if (-not $dirConfig) {
        $Ctx.SemConfig = $true
        return
    }
    $Ctx.SemConfig = $false
    $Ctx.DirConfig = $dirConfig
    Write-Info ('Configurações:  ' + $dirConfig)

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
    $resolucaoOpc = [string](Get-Opcao $Opcoes 'Resolucao' '')
    if ($resolucaoOpc) {
        if ($resolucaoOpc -match '^\s*(\d{3,5})\s*[xX*]\s*(\d{3,5})\s*$') {
            $largura = [int]$Matches[1]
            $altura = [int]$Matches[2]
        } else {
            throw ('Resolução inválida: "' + $resolucaoOpc + '". Use o formato 2560x1440.')
        }
    }
    $taxa = $maquina.Taxa
    $hzOpc = [int](Get-Opcao $Opcoes 'Hz' 0)
    if ($hzOpc -gt 0) { $taxa = $hzOpc }

    if ($largura -gt 0) { Write-Info ('Resolução:      {0}x{1}' -f $largura, $altura) }
    else { Write-Aviso 'Não consegui detectar a resolução; a do jogo fica como está.' }
    if ($taxa -gt 0) { Write-Info ('Monitor:        {0} Hz' -f $taxa) }
    else { Write-Aviso 'Não consegui detectar a taxa do monitor; VSync e limite de FPS ficam como estão.' }

    Test-Memoria
    Test-ReBar $maquina.Pnp
    Test-Driver $maquina.DataDriver
    if ($jogo) { Test-Disco $jogo.Pasta }

    # --- Decisões do perfil --------------------------------------------------------------------
    $classe = '1440p'
    if ($altura -gt 0 -and $altura -le 1200) { $classe = '1080p' }
    elseif ($altura -gt 1600) { $classe = '4K' }

    $tabelaUpscaler = @{
        'Qualidade'  = @{ '1080p' = 'FSRNativo'; '1440p' = 'FSRNativo';    '4K' = 'FSRQualidade' }
        'Fluido'     = @{ '1080p' = 'FSRNativo'; '1440p' = 'FSRQualidade'; '4K' = 'FSREquilibrado' }
        'RayTracing' = @{ '1080p' = 'FSRNativo'; '1440p' = 'FSRQualidade'; '4K' = 'FSRDesempenho' }
    }
    $modoUpscaler = [string](Get-Opcao $Opcoes 'Upscaler' 'Auto')
    if ($modoUpscaler -eq 'Auto') { $modoUpscaler = $tabelaUpscaler[$PerfilEscolhido][$classe] }
    $avisoNativo = $false
    if ($modoUpscaler -eq 'FSRNativo' -and @($Estado.Rejeitados) -contains 'PostProcess|FSR2Quality=1') {
        $modoUpscaler = 'FSRQualidade'
        $avisoNativo = $true
    }

    $frameGenOpc = [string](Get-Opcao $Opcoes 'FrameGen' 'Auto')
    $usarFG = ($PerfilEscolhido -eq 'RayTracing')
    if ($frameGenOpc -eq 'Sim') { $usarFG = $true }
    if ($frameGenOpc -eq 'Nao') { $usarFG = $false }
    $avisoFG = $false
    if ($usarFG -and @($Estado.Rejeitados) -contains 'PostProcess|FSRFramegen=1') {
        $usarFG = $false
        $avisoFG = $true
    }

    # Com Frame Generation: VSync + FreeSync seguram o FPS na taxa do monitor sem tearing.
    # Sem Frame Generation: FreeSync + limite um pouco abaixo da taxa (menor atraso e frametime estável).
    $usarVSync = $null
    $limite = $null
    if ($usarFG) { $usarVSync = $true; $limite = 0 }
    elseif ($taxa -ge 90) { $usarVSync = $false; $limite = $taxa - 3 }
    elseif ($taxa -gt 0) { $usarVSync = $true; $limite = 0 }
    if ([bool](Get-Opcao $Opcoes 'VSync' $false)) { $usarVSync = $true }
    $limiteOpc = [int](Get-Opcao $Opcoes 'LimiteFPS' (-1))
    if ($limiteOpc -ge 0) { $limite = $limiteOpc }

    $nivelHair = 1
    if ($PerfilEscolhido -eq 'Fluido') { $nivelHair = 0 }
    $hairOpc = [int](Get-Opcao $Opcoes 'HairWorks' (-1))
    if ($hairOpc -ge 0 -and $hairOpc -le 2) { $nivelHair = $hairOpc }

    $cfg = @{
        Largura   = $largura
        Altura    = $altura
        Up        = $modoUpscaler
        FG        = $usarFG
        VSync     = $usarVSync
        Limite    = $limite
        HairWorks = $nivelHair
        RT        = ($PerfilEscolhido -eq 'RayTracing')
    }

    $nomesUpscaler = @{
        'FSRNativo' = 'AMD FSR em resolução nativa (Native AA)'; 'FSRQualidade' = 'AMD FSR Qualidade'
        'FSREquilibrado' = 'AMD FSR Equilibrado'; 'FSRDesempenho' = 'AMD FSR Desempenho'
        'XeSSNativo' = 'Intel XeSS em resolução nativa'; 'FXAA' = 'FXAA'
    }
    Write-Titulo ('Perfil: ' + $PerfilEscolhido)
    Write-Info ('Anti-aliasing:    ' + $nomesUpscaler[$modoUpscaler])
    if ($avisoNativo) { Write-Info '                  (o jogo recusou o FSR nativo nesta placa; usando FSR Qualidade)' }
    if ($cfg.RT) { Write-Info 'Ray tracing:      RTGI (Desempenho) + reflexos + AO; path tracing desligado' }
    else { Write-Info 'Ray tracing:      desligado' }
    if ($usarFG) { Write-Info 'Frame Generation: ligado (AMD FSR) + Anti-Lag 2' }
    else { Write-Info 'Frame Generation: desligado; Anti-Lag 2 ligado' }
    if ($avisoFG) { Write-Info '                  (o jogo recusou o Frame Generation nesta placa)' }
    if ($null -ne $usarVSync) {
        $textoLimite = 'sem limite'
        if ($limite -gt 0) { $textoLimite = ('{0} FPS' -f $limite) }
        Write-Info ('VSync / limite:   {0} / {1}' -f (ConvertTo-TextoBool $usarVSync), $textoLimite)
    }
    $nomesHair = @('desligado', 'só no Geralt', 'em todos')
    Write-Info ('HairWorks:        ' + $nomesHair[$nivelHair])

    # --- Arquivos a ajustar --------------------------------------------------------------------
    $alvos = New-Object System.Collections.Generic.List[object]
    $arquivoDx12 = Join-Path $dirConfig 'dx12user.settings'
    $arquivoDx11 = Join-Path $dirConfig 'user.settings'
    if (Test-Path -LiteralPath $arquivoDx12) {
        $docDx12 = Read-ArquivoSettings $arquivoDx12
        $versaoDx12 = Get-VersaoJogo $docDx12 $versaoExe
        $alvos.Add([pscustomobject]@{ Doc = $docDx12; Versao = $versaoDx12 })
        if ($versaoDx12 -eq 'NextGen' -and (Test-Path -LiteralPath $arquivoDx11)) {
            $alvos.Add([pscustomobject]@{ Doc = (Read-ArquivoSettings $arquivoDx11); Versao = 'NextGenDX11' })
        }
    } elseif (Test-Path -LiteralPath $arquivoDx11) {
        $docDx11 = Read-ArquivoSettings $arquivoDx11
        $versaoDx11 = Get-VersaoJogo $docDx11 $versaoExe
        if ($versaoDx11 -eq 'NextGen') { $versaoDx11 = 'NextGenDX11' }
        $alvos.Add([pscustomobject]@{ Doc = $docDx11; Versao = $versaoDx11 })
    }

    $dirBackup = Join-Path $dirConfig 'backup-otimizador'
    $Estado.Aplicado = @{}
    $versaoPrincipal = ''
    $total = 0
    foreach ($alvo in $alvos) {
        if (-not $versaoPrincipal) { $versaoPrincipal = $alvo.Versao }
        Write-Titulo ('{0}  -  {1}' -f $alvo.Doc.Nome, (Get-NomeVersao $alvo.Versao))
        $ajustes = Get-Ajustes $alvo.Versao $cfg
        $mudancas = Set-Ajustes $alvo.Doc $ajustes $Estado
        if ($mudancas.Count -eq 0) {
            Write-Ok 'Nada a mudar: o arquivo já está com essas configurações.'
            continue
        }
        foreach ($m in $mudancas) {
            Write-Host ('    [{0}] {1}: {2} -> {3}' -f $m.Secao, $m.Chave, $m.Antes, $m.Depois) -NoNewline
            Write-Host ('   ' + $m.Nota) -ForegroundColor DarkGray
        }
        $total += $mudancas.Count
        if ($Simular) { continue }
        $backup = Backup-Arquivo $alvo.Doc.Caminho $dirBackup
        Save-ArquivoSettings $alvo.Doc
        if ($SomenteLeitura) { (Get-Item -LiteralPath $alvo.Doc.Caminho).IsReadOnly = $true }
        Write-Ok ('{0} alterações gravadas. Backup: {1}' -f $mudancas.Count, $backup)
    }
    if ($versaoPrincipal -eq 'Remastered' -and (Test-Path -LiteralPath $arquivoDx11)) {
        Write-Info 'user.settings ignorado: a versão Remastered só usa o dx12user.settings.'
    }
    $Ctx.Total = $total

    if ($Simular) {
        Write-Titulo 'Simulação'
        Write-Info ('{0} valores seriam alterados. Nada foi gravado (nem no jogo, nem no Windows).' -f $total)
        return
    }

    Update-ModFG $jogo $versaoPrincipal $usarFG $Estado
    if (-not $SemWindows) { Set-ConfigWindows $Estado }
}

function New-Contexto {
    return @{ Jogo = $null; DirConfig = $null; SemConfig = $false; Total = 0 }
}

function Write-Pendencias {
    if ($Pendencias.Count -eq 0) { return }
    Write-Titulo 'Fora do alcance de qualquer script'
    Write-Info 'Estes itens ficam na BIOS ou no driver e não dá para mudar pelo Windows com segurança:'
    foreach ($p in $Pendencias) { Write-Aviso $p }
}

# ---------------------------------------------------------------------------------------------
# Modos
# ---------------------------------------------------------------------------------------------

function Invoke-ModoNormal {
    Write-Cabecalho
    $estado = Read-Estado

    if ($Restaurar -or $RestaurarOriginal) {
        Wait-JogoFechar
        $dirConfig = Find-PastaConfig
        if ($RestaurarOriginal) { Write-Titulo 'Desinstalar e voltar ao original' } else { Write-Titulo 'Desfazer a última alteração' }
        if ($dirConfig) { Restore-ArquivosJogo $dirConfig $RestaurarOriginal.IsPresent }
        else { Write-Aviso 'Não achei a pasta Documentos\The Witcher 3.' }
        if ($RestaurarOriginal) {
            Restore-ConfigWindows $estado
            $jogo = Find-Jogo
            if ($jogo -and [bool]$estado.ModFGInstalado) {
                $pastaMod = Join-Path $jogo.Pasta ('mods\' + $ModFG.Nome)
                if (Test-Path -LiteralPath $pastaMod) {
                    try {
                        Remove-ModFG $pastaMod
                        Write-Ok 'Correção do Frame Generation removida.'
                    } catch {
                        Write-Aviso ('Não consegui remover {0}: {1}' -f $pastaMod, $_.Exception.Message)
                    }
                }
            }
            Remove-Instalacao
        } else {
            Save-Estado $estado
        }
        Wait-Saida
        return
    }

    Wait-JogoFechar
    $perfilEscolhido = Get-PerfilEfetivo $estado
    $opcoes = Get-OpcoesEfetivas $estado
    $ctx = New-Contexto
    Invoke-Otimizacao $estado $perfilEscolhido $opcoes $ctx

    if ($ctx.SemConfig) {
        if ($Simular) { throw 'O jogo ainda não criou o arquivo de configuração (abra o jogo uma vez).' }
        Write-Titulo 'Primeira vez'
        Write-Info 'O jogo ainda não criou o arquivo de configuração. Vou abri-lo agora:'
        Write-Info 'jogue normalmente e, quando fechar, eu aplico tudo sozinho.'
        if (-not (Start-Jogo $ctx.Jogo)) {
            throw 'Não achei o jogo nem a pasta Documentos\The Witcher 3. Informe -PastaJogo "C:\...\The Witcher 3".'
        }
        [void](Wait-Sessao)
        $ctx = New-Contexto
        Invoke-Otimizacao $estado $perfilEscolhido $opcoes $ctx
        if ($ctx.SemConfig) { throw 'O jogo não criou o arquivo de configuração em Documentos\The Witcher 3.' }
    }

    if ($Simular) {
        Wait-Saida
        return
    }

    $estado.Perfil = $perfilEscolhido
    $estado.Opcoes = $opcoes
    Install-Otimizador $ctx.Jogo
    Save-Estado $estado

    Write-Pendencias
    Write-Titulo 'Pronto'
    Write-Ok 'Tudo aplicado. Pode jogar.'
    if (-not $SemAtalho) {
        Write-Info 'Jogue pelo atalho "The Witcher 3 (Otimizado)": antes de abrir ele reaplica tudo (inclusive'
        Write-Info 'depois de atualizações do jogo) e, quando você fecha, confere se o jogo aceitou cada opção.'
    }
    Write-Info ('Registro desta execução: ' + $ArquivoLog)
    Wait-Saida
}

function Invoke-ModoJogar {
    Write-Cabecalho
    $estado = Read-Estado
    if (Test-JogoAberto) {
        Write-Info 'O jogo já está aberto.'
        return
    }
    $perfilEscolhido = Get-PerfilEfetivo $estado
    $opcoes = Get-OpcoesEfetivas $estado
    $ctx = New-Contexto
    try {
        Invoke-Otimizacao $estado $perfilEscolhido $opcoes $ctx
        Save-Estado $estado
    } catch {
        Write-Aviso ('Não consegui aplicar as configurações: ' + $_.Exception.Message + ' (o jogo abre assim mesmo)')
    }

    Write-Titulo 'Jogo'
    if (-not (Start-Jogo $ctx.Jogo)) { throw 'Não achei o jogo para abrir. Rode o Otimizar-Witcher3.bat de novo.' }
    if (-not (Wait-Sessao)) {
        Write-Aviso 'O jogo não abriu em 5 minutos.'
        return
    }

    if ($ctx.SemConfig) {
        $ctx = New-Contexto
        Invoke-Otimizacao $estado $perfilEscolhido $opcoes $ctx
    } else {
        Test-PosSessao $estado $ctx.DirConfig
    }
    Save-Estado $estado
}

# ---------------------------------------------------------------------------------------------
# Programa principal
# ---------------------------------------------------------------------------------------------

$codigoSaida = 0
$transcrevendo = $false
try {
    if (-not (Test-Path -LiteralPath $PastaInstalacao)) { [void](New-Item -ItemType Directory -Path $PastaInstalacao -Force) }
    [void](Start-Transcript -LiteralPath $ArquivoLog -Force)
    $transcrevendo = $true
} catch { }

try {
    if ($Jogar) { Invoke-ModoJogar } else { Invoke-ModoNormal }
} catch {
    Write-Host ''
    Write-Host ('  [ERRO] ' + $_.Exception.Message) -ForegroundColor Red
    $codigoSaida = 1
    Wait-Saida
} finally {
    if ($transcrevendo) { try { [void](Stop-Transcript) } catch { } }
}
exit $codigoSaida
