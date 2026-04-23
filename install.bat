@echo off
title Bonsai.js Installer
color 0A

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║           BONSAI.JS INSTALLER            ║
echo   ║     Reverse Engineered Bonsai CLI        ║
echo   ╚══════════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [!] Node.js not found. Please install Node.js first.
    echo       https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo   [OK] Node.js %NODE_VER% found

:: Set install directory
set INSTALL_DIR=%USERPROFILE%\.bonsai-oss
set BIN_DIR=%INSTALL_DIR%\bin

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

:: Download bonsai.js
echo.
echo   Downloading bonsai.js ...
curl -sL "https://raw.githubusercontent.com/DexCodeSX/Secret/main/bonsai.js" -o "%INSTALL_DIR%\bonsai.js"
if %ERRORLEVEL% neq 0 (
    echo   [!] Download failed. Check your internet connection.
    pause
    exit /b 1
)
echo   [OK] Downloaded to %INSTALL_DIR%\bonsai.js

:: Download api.js
echo   Downloading api.js ...
curl -sL "https://raw.githubusercontent.com/DexCodeSX/Secret/main/api.js" -o "%INSTALL_DIR%\api.js"
if %ERRORLEVEL% neq 0 (
    echo   [!] api.js download failed (non-critical^)
) else (
    echo   [OK] Downloaded to %INSTALL_DIR%\api.js
)

:: Create bon.cmd wrapper
echo @echo off > "%BIN_DIR%\bon.cmd"
echo node "%INSTALL_DIR%\bonsai.js" %%* >> "%BIN_DIR%\bon.cmd"

echo   [OK] Created bon command

:: Add to PATH
echo %PATH% | findstr /I "%BIN_DIR%" >nul
if %ERRORLEVEL% neq 0 (
    setx PATH "%PATH%;%BIN_DIR%" >nul 2>nul
    set "PATH=%PATH%;%BIN_DIR%"
    echo   [OK] Added to PATH
    echo.
    echo   NOTE: Restart your terminal for PATH changes to take effect.
) else (
    echo   [OK] Already in PATH
)

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║         INSTALLATION COMPLETE!           ║
echo   ╠══════════════════════════════════════════╣
echo   ║                                          ║
echo   ║   Usage:  bon --help                     ║
echo   ║           bon login                      ║
echo   ║           bon start                      ║
echo   ║           bon start --resume             ║
echo   ║                                          ║
echo   ║   Location: %INSTALL_DIR%                ║
echo   ║   GitHub: github.com/DexCodeSX/Secret    ║
echo   ║                                          ║
echo   ╚══════════════════════════════════════════╝
echo.
pause
