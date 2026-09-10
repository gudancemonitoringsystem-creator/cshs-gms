$ErrorActionPreference = 'Stop'

Write-Host '=== GMS Firebase deployment check ===' -ForegroundColor Cyan
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
  Write-Host 'Firebase CLI is not installed or not on PATH.' -ForegroundColor Yellow
  Write-Host 'Install Node.js first, then run: npm install -g firebase-tools'
  exit 1
}

Write-Host 'Checking Firebase project...' -ForegroundColor Cyan
firebase use cshs-gmsm

Write-Host 'Deploying Realtime Database rules, Hosting, and Functions...' -ForegroundColor Cyan
firebase deploy --only database,hosting,functions

Write-Host ''
Write-Host 'Deployment completed.' -ForegroundColor Green
Write-Host 'Firebase Hosting URL normally follows the form:'
Write-Host 'https://cshs-gmsm.web.app'
