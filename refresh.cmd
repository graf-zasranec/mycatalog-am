@echo off
setlocal
cd /d "%~dp0"
REM Same refresh pipeline as GitHub Actions. Optional: set BETTER_ROW_LIMIT=400
node tools\refresh.mjs %*
exit /b %errorlevel%
