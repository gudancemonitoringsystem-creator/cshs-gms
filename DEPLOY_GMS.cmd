@echo off
setlocal
cd /d "%~dp0"

echo.
echo ===============================================
echo GMS CSHS - Firebase Database + Hosting Deploy
echo ===============================================
echo.

where firebase >nul 2>nul
if errorlevel 1 (
  echo ERROR: Firebase CLI is not installed or not in PATH.
  echo Install it with: npm install -g firebase-tools
  echo Then run: firebase login
  echo.
  pause
  exit /b 1
)

echo [1/4] Selecting Firebase project...
firebase use cshs-gmsm
if errorlevel 1 goto :error

echo.
echo [2/4] Validating Realtime Database rules...
firebase deploy --only database --project cshs-gmsm
if errorlevel 1 goto :error

echo.
echo [3/4] Publishing Firebase Hosting...
firebase deploy --only hosting --project cshs-gmsm
if errorlevel 1 goto :error

echo.
echo [4/4] Opening Firebase Hosting...
firebase open hosting:site --project cshs-gmsm

echo.
echo DEPLOYMENT COMPLETE
pause
exit /b 0

:error
echo.
echo DEPLOYMENT FAILED.
echo Read the Firebase CLI error above and fix that item first.
pause
exit /b 1
