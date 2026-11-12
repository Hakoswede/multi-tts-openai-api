@echo off
title GenAi Discord TTS Voice Bot
echo ====================================================
echo   GenAi Discord TTS Voice Bot (Multi-idioma / Loquendo)
echo ====================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor descarga e instala Node.js desde https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [INFO] Instalando dependencias de Node.js...
    call npm install
    echo.
)

findstr /C:"TU_TOKEN_DE_DISCORD_AQUI" .env >nul 2>&1
if %errorlevel% equ 0 (
    echo ==========================================================
    echo [AVISO IMPORTANTE]
    echo Abre el archivo .env con el bloc de notas y pega tu
    echo DISCORD_TOKEN antes de iniciar el bot.
    echo ==========================================================
    echo.
    pause
    exit /b 1
)

echo [INFO] Iniciando el bot de Discord...
node index.js
pause
