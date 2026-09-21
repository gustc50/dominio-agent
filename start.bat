@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo === Dominio Agent ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado nesta maquina.
  echo Instale o Node.js em https://nodejs.org/ e tente novamente.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Primeira execucao: instalando dependencias.
  echo O Electron tem cerca de 300 MB, entao isso pode levar alguns minutos...
  echo.
  call npm install --foreground-scripts
  echo.
)

call :verificar_electron
if not errorlevel 1 goto iniciar

echo O binario do Electron nao esta presente. Baixando...
echo.
if exist "node_modules\electron\install.js" call node node_modules\electron\install.js
echo.

call :verificar_electron
if not errorlevel 1 goto iniciar

echo Nao funcionou. Reinstalando o Electron do zero...
echo.
if exist "node_modules\electron" rmdir /s /q "node_modules\electron"
call npm install --foreground-scripts
echo.

call :verificar_electron
if not errorlevel 1 goto iniciar

echo.
echo [ERRO] O Electron foi instalado, mas o binario do aplicativo nao veio junto.
echo.
echo Diagnostico:
set IGNORAR=
for /f "delims=" %%i in ('npm config get ignore-scripts 2^>nul') do set IGNORAR=%%i
echo   npm ignore-scripts = !IGNORAR!
echo.
if /i "!IGNORAR!"=="true" (
  echo   Esta e a causa: o npm esta bloqueando o script que baixa o Electron.
  echo   Corrija com o comando:
  echo       npm config set ignore-scripts false
  echo   Depois apague a pasta node_modules e execute este arquivo de novo.
) else (
  echo   O download vem de github.com/electron/electron/releases.
  echo   Se a sua rede, firewall ou antivirus bloqueia esse endereco, ele falha.
  echo   Um download interrompido tambem deixa o cache corrompido.
  echo.
  echo   Tente limpar o cache e repetir ^(copie e cole no Prompt de Comando^):
  echo       rmdir /s /q "%LOCALAPPDATA%\electron\Cache"
  echo       rmdir /s /q "%~dp0node_modules"
  echo   E rode este arquivo novamente, se possivel em outra rede.
)
echo.
pause
exit /b 1

:iniciar
echo Iniciando o Dominio Agent...
echo.
call npm start
if errorlevel 1 (
  echo.
  echo [ERRO] O aplicativo foi encerrado com um erro. Veja as mensagens acima.
  pause
)
exit /b 0

:verificar_electron
if not exist "node_modules\electron\dist\electron.exe" exit /b 1
exit /b 0
