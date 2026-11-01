@echo off
setlocal
title Otimizador The Witcher 3
cd /d "%~dp0"

echo.
echo  ===========================================================
echo    Otimizador The Witcher 3 - RX 7800 XT / Ryzen 7 5700X
echo  ===========================================================
echo.
echo    1 - Qualidade   [recomendado] maximo sem ray tracing, FSR nativo
echo    2 - Fluido      mais FPS: FSR Qualidade, HairWorks desligado
echo    3 - Ray Tracing RTGI + reflexos RT + Frame Generation
echo    4 - Desfazer a ultima alteracao
echo    5 - Desinstalar tudo e voltar ao original
echo    0 - Sair
echo.
echo    Se nada for escolhido, a opcao 1 e aplicada em 15 segundos.
echo.
choice /c 123450 /n /t 15 /d 1 /m "  Opcao: "
set "N=%errorlevel%"

set "ARGS="
if "%N%"=="1" set "ARGS=-Perfil Qualidade"
if "%N%"=="2" set "ARGS=-Perfil Fluido"
if "%N%"=="3" set "ARGS=-Perfil RayTracing"
if "%N%"=="4" set "ARGS=-Restaurar"
if "%N%"=="5" set "ARGS=-RestaurarOriginal"
if not defined ARGS goto fim

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Otimizar-Witcher3.ps1" %ARGS%

:fim
endlocal
