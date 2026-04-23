# bonsai.js — npm migration shim (v2.5.8+)
# legacy users on <= v2.5.7 hit this when they run `bon update`.
# we just forward to npm. new users: npm i -g @dexcodesxs/bon

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ◆  bonsai.js installer" -ForegroundColor Green -NoNewline
Write-Host "  (v2.5.8+ → npm)" -ForegroundColor DarkGray
Write-Host ""

# need node + npm
$nodeVer = $null
$npmVer = $null
try {
  $nodeVer = & node -v 2>$null
  $npmVer = & npm -v 2>$null
} catch { }

if (-not $npmVer) {
  Write-Host "  ✗  npm not found. install Node.js first:" -ForegroundColor Red
  Write-Host ""
  Write-Host "    https://nodejs.org" -ForegroundColor Cyan
  Write-Host "    (or: winget install OpenJS.NodeJS)" -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "  then re-run this installer." -ForegroundColor DarkGray
  exit 1
}

Write-Host "  ●  node $nodeVer · npm $npmVer" -ForegroundColor Green
Write-Host ""

Write-Host "  running: " -ForegroundColor DarkGray -NoNewline
Write-Host "npm i -g @dexcodesxs/bon" -ForegroundColor Cyan
Write-Host ""

try {
  & npm i -g @dexcodesxs/bon
  if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" }
} catch {
  Write-Host ""
  Write-Host "  ✗  install failed: $_" -ForegroundColor Red
  Write-Host "      try running PowerShell as administrator" -ForegroundColor DarkGray
  exit 1
}

Write-Host ""
Write-Host "  ✓  installed!" -ForegroundColor Green
Write-Host ""
Write-Host "  verify:     " -ForegroundColor DarkGray -NoNewline
Write-Host "bon --version" -ForegroundColor Cyan
Write-Host "  quickstart: " -ForegroundColor DarkGray -NoNewline
Write-Host "bon login && bon ui" -ForegroundColor Cyan
Write-Host ""

# legacy wrapper cleanup hint
$oldDir = "$env:USERPROFILE\.bonsai-oss"
if (Test-Path "$oldDir\bonsai.js") {
  Write-Host "  migration tip: remove the old wrapper to avoid PATH conflicts:" -ForegroundColor DarkGray
  Write-Host "    Remove-Item -Recurse -Force $oldDir\bin" -ForegroundColor Cyan
  Write-Host "    Remove-Item $oldDir\bonsai.js, $oldDir\api.js" -ForegroundColor Cyan
  Write-Host ""
}
