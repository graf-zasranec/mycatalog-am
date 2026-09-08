@echo off
REM Refresh MyCatalog prices and rebuild the site.
REM Run by hand, or on a schedule (see README).
REM
REM Photos are NOT refreshed here: tools/cutout.mjs needs a browser to decode images,
REM so re-run tools/colors.mjs + tools/cutout.mjs by hand when a shop adds new colours.

cd /d "%~dp0"
echo [%date% %time%] refreshing prices...
node scrape.mjs
if errorlevel 1 (
  echo scrape failed - keeping the previous data/prices.json and NOT rebuilding
  exit /b 1
)
node build.mjs
if errorlevel 1 (
  echo build failed
  exit /b 1
)
echo [%date% %time%] done.
