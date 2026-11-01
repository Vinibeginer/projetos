@echo off
setlocal
title Otimizador The Witcher 3
cd /d "%~dp0"

:menu
cls
echo.
echo  ===========================================================
echo    Otimizador The Witcher 3 - RX 7800 XT / Ryzen 7 5700X
echo  ===========================================================
echo.
echo    Feche o jogo antes de continuar.
echo.
echo    1 - Qualidade   [recomendado] maximo sem ray tracing, FSR nativo
echo    2 - Fluido      mais FPS: FSR Qualidade, HairWorks desligado
echo    3 - Ray Tracing RTGI + reflexos RT + Frame Generation
echo    4 - Simular o perfil Qualidade (mostra o que muda, sem gravar)
echo    5 - Desfazer a ultima alteracao
echo    6 - Voltar a configuracao original (antes do primeiro uso)
echo    0 - Sair
echo.
set "OPCAO="
set /p "OPCAO=  Escolha uma opcao e tecle ENTER: "

set "ARGS="
if "%OPCAO%"=="1" set "ARGS=-Perfil Qualidade"
if "%OPCAO%"=="2" set "ARGS=-Perfil Fluido"
if "%OPCAO%"=="3" set "ARGS=-Perfil RayTracing"
if "%OPCAO%"=="4" set "ARGS=-Perfil Qualidade -Simular"
if "%OPCAO%"=="5" set "ARGS=-Restaurar"
if "%OPCAO%"=="6" set "ARGS=-RestaurarOriginal"
if "%OPCAO%"=="0" goto fim
if not defined ARGS goto menu

:executar
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Otimizar-Witcher3.ps1" %ARGS%
goto menu

:fim
endlocal
