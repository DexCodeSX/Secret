# Bonsai.js Installer — PowerShell
# github.com/DexCodeSX/Secret

$ErrorActionPreference = "Stop"
$repo = "DexCodeSX/Secret"
$raw  = "https://raw.githubusercontent.com/$repo/main"

Write-Host ""
Write-Host "  =======================================" -ForegroundColor Green
Write-Host "         BONSAI.JS INSTALLER" -ForegroundColor White
Write-Host "    Reverse Engineered Bonsai CLI" -ForegroundColor DarkGray
Write-Host "  =======================================" -ForegroundColor Green
Write-Host ""

# check node
try {
    $nodeVer = & node -v 2>$null
    Write-Host "  [OK] Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  [!] Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# dirs
$installDir = "$env:USERPROFILE\.bonsai-oss"
$binDir     = "$installDir\bin"

if (!(Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir -Force | Out-Null }
if (!(Test-Path $binDir))     { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }

# download bonsai.js
Write-Host ""
Write-Host "  Downloading bonsai.js ..." -ForegroundColor DarkGray
try {
    Invoke-RestMethod "$raw/bonsai.js" -OutFile "$installDir\bonsai.js"
    Write-Host "  [OK] Downloaded to $installDir\bonsai.js" -ForegroundColor Green
} catch {
    Write-Host "  [!] Download failed: $_" -ForegroundColor Red
    exit 1
}

# download api.js
Write-Host "  Downloading api.js ..." -ForegroundColor DarkGray
try {
    Invoke-RestMethod "$raw/api.js" -OutFile "$installDir\api.js"
    Write-Host "  [OK] Downloaded to $installDir\api.js" -ForegroundColor Green
} catch {
    Write-Host "  [!] api.js download failed (non-critical)" -ForegroundColor Yellow
}

# create bon.cmd
$wrapper = "@echo off`nnode `"$installDir\bonsai.js`" %*"
Set-Content -Path "$binDir\bon.cmd" -Value $wrapper -Encoding ASCII
Write-Host "  [OK] Created bon command" -ForegroundColor Green

# add to PATH
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$userPath;$binDir", "User")
    Write-Host "  [OK] Added to PATH (permanent)" -ForegroundColor Green
}

# update current session so bon works immediately
if ($env:PATH -notlike "*$binDir*") {
    $env:PATH = "$env:PATH;$binDir"
    Write-Host "  [OK] PATH updated (current session)" -ForegroundColor Green
}

Write-Host ""
Write-Host "  =======================================" -ForegroundColor Green
Write-Host "       INSTALLATION COMPLETE!" -ForegroundColor White
Write-Host "  =======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Usage:  " -NoNewline; Write-Host "bon --help" -ForegroundColor Cyan
Write-Host "          " -NoNewline; Write-Host "bon login" -ForegroundColor Cyan
Write-Host "          " -NoNewline; Write-Host "bon start" -ForegroundColor Cyan
Write-Host "          " -NoNewline; Write-Host "bon start --resume" -ForegroundColor Cyan
Write-Host ""
Write-Host "  GitHub: github.com/$repo" -ForegroundColor DarkGray
Write-Host ""
