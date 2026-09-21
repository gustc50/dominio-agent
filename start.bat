@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERRO] Node.js nao encontrado nesta maquina.
  echo Instale o Node.js em https://nodejs.org/ e tente novamente.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Primeira execucao: instalando dependencias, isso pode levar alguns minutos...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao instalar as dependencias. Verifique sua conexao com a internet.
    echo.
    pause
    exit /b 1
  )
)

echo Iniciando o Dominio Agent...
call npm start

if errorlevel 1 (
  echo.
  echo [ERRO] O aplicativo foi encerrado com um erro. Veja as mensagens acima.
  pause
)
endlocal
