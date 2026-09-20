@echo off
REM Refresh Impulse.am prices and rebuild the site.
REM Run by hand, or on a schedule (see README).
REM
REM Photos are NOT refreshed here: tools/cutout.py needs a browser to decode images,
REM so re-run tools/colors.mjs + tools/cutout.py by hand when a shop adds new colours.
REM
REM Nothing in here deletes anything. A shop that was down on crawl day leaves its products with
REM no offers and its pages looking dead, and that is a bad day rather than a product gone:
REM   node tools/prune.mjs --write                remove products nothing sells
REM   python tools/check-links.py --all --prune   remove pages that answer 404
REM are both run by a person, after a clean crawl, having read what they are about to remove.

cd /d "%~dp0"
setlocal

echo [%date% %time%] refreshing prices...
node scrape.mjs
if errorlevel 1 (
  echo scrape failed - keeping the previous data/prices.json and NOT rebuilding
  exit /b 1
)

REM Every product needs its Armenian and Russian line or the build refuses: a page with neither
REM falls back to the English one, and those two views may not carry an English sentence.
node tools/verdicts.mjs --write
if errorlevel 1 (
  echo verdicts failed
  exit /b 1
)

REM The recheck table: our name for each thing beside the shop's own words for it. This is what
REM makes a wrong match visible, and what pins the correction once somebody makes one.
node tools/links.mjs
if errorlevel 1 (
  echo links failed
  exit /b 1
)

node build.mjs
if errorlevel 1 (
  echo build failed
  exit /b 1
)

REM Not a gate, a reading. Rows that disagree with themselves are printed so the run says what it
REM is unsure about, instead of leaving it to be found on the site.
echo.
echo [%date% %time%] rows that disagree with themselves:
node tools/recheck.mjs

echo.
echo [%date% %time%] done.
endlocal
