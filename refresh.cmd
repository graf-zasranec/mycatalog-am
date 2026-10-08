@echo off
setlocal
cd /d "%~dp0"
REM Same refresh pipeline as GitHub Actions. Optional: set BETTER_ROW_LIMIT=400
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js or open a terminal where node is available.
  if not defined CI if not defined BETTER_NO_PAUSE pause
  exit /b 1
)
node tools\refresh.mjs %*
set "BETTER_REFRESH_EXIT=%errorlevel%"
if "%BETTER_REFRESH_EXIT%"=="2" echo A refresh is already running. This window has not started a second one.
if not "%BETTER_REFRESH_EXIT%"=="0" if not "%BETTER_REFRESH_EXIT%"=="2" echo Refresh stopped with error %BETTER_REFRESH_EXIT%. Review the output above.
if "%BETTER_REFRESH_EXIT%"=="0" echo Refresh completed.
REM Keep double-click launches readable. Automation can set BETTER_NO_PAUSE=1.
if not defined CI if not defined BETTER_NO_PAUSE pause
exit /b %BETTER_REFRESH_EXIT%
