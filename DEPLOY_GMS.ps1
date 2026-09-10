$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "GMS CSHS - Firebase Database + Hosting Deploy" -ForegroundColor Cyan
Write-Host "Project: cshs-gmsm" -ForegroundColor Gray
Write-Host ""

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "Firebase CLI is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Install with: npm install -g firebase-tools" -ForegroundColor Yellow
    Write-Host "Then authenticate with: firebase login" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/4] Selecting Firebase project..." -ForegroundColor Yellow
firebase use cshs-gmsm
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[2/4] Deploying Realtime Database rules..." -ForegroundColor Yellow
firebase deploy --only database --project cshs-gmsm
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[3/4] Publishing Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting --project cshs-gmsm
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[4/4] Deployment complete." -ForegroundColor Green
Write-Host "Hosting: https://cshs-gmsm.web.app" -ForegroundColor Cyan
Write-Host "Database: https://cshs-gmsm-default-rtdb.firebaseio.com" -ForegroundColor Cyan
Write-Host ""
Write-Host "Open Firebase Console with: firebase open hosting:site" -ForegroundColor Gray
