@echo off
REM bonsai.js — npm migration shim (v2.5.8+)
REM legacy users on <=v2.5.7 hit this when they run `bon update`.
REM we just forward to npm. new users: npm i -g @dexcodesxs/bon

echo.
echo   ##  bonsai.js installer (v2.5.8+ uses npm)
echo.

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo   [!] npm not found. install Node.js first:
  echo       https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('npm -v 2^>nul') do set NPM_VER=%%v
echo   [OK] node %NODE_VER% / npm %NPM_VER%
echo.

echo   running: npm i -g @dexcodesxs/bon
echo.
call npm i -g @dexcodesxs/bon
if %ERRORLEVEL% neq 0 (
  echo.
  echo   [!] install failed. try running cmd as administrator
  pause
  exit /b 1
)

echo.
echo   [OK] installed! verify with: bon --version
echo   quickstart: bon login ^&^& bon ui
echo.

REM legacy wrapper cleanup hint
if exist "%USERPROFILE%\.bonsai-oss\bonsai.js" (
  echo   migration tip: remove the old wrapper to avoid PATH conflicts:
  echo     rmdir /s /q "%USERPROFILE%\.bonsai-oss\bin"
  echo     del "%USERPROFILE%\.bonsai-oss\bonsai.js"
  echo     del "%USERPROFILE%\.bonsai-oss\api.js"
  echo.
)

pause
