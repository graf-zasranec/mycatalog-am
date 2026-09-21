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

REM Eldorado answers 403 to any non-browser user agent. Their robots.txt allows product pages and
REM names no crawler it refuses, so tools/eldorado-fetch.py reads them with scrapling at the delay
REM their robots asks of Googlebot, and leaves the result in data/eldorado.json for scrape.mjs.
REM
REM This step used to be missing, which meant eldorado's prices only moved when somebody ran the
REM fetcher by hand - the nightly job was re-publishing the same figures for that shop every day.
REM
REM It is deliberately NOT a gate. No Python, no scrapling, shop down: the adapter reads the last
REM fetch instead, and a stale eldorado is better than no run at all.
echo [%date% %time%] reading eldorado...
python tools\eldorado-fetch.py
if errorlevel 1 echo   eldorado fetch failed - carrying on with the previous data\eldorado.json

REM Zigzag, on the same arrangement and for the same reason: 403 to plain fetch, robots.txt that
REM allows product pages and names no crawler it refuses. Added on the owner's explicit
REM instruction after checking it worked - a product page returns 200 with its prices intact.
REM
REM Their robots forbids every URL with a query string, so that fetcher cannot walk the catalogue
REM at all: pagination is ?p=2 and search is ?q=. It re-reads the product pages we already link
REM plus whatever the clean .html category pages show, which is why Zigzag gains prices for what
REM it already has rather than discovering much that is new.
echo [%date% %time%] reading zigzag...
python tools\zigzag-fetch.py
if errorlevel 1 echo   zigzag fetch failed - carrying on with the previous data\zigzag.json

REM The hand rows in data\listings.csv are the other half of the catalogue, and scrape.mjs only
REM ever READS them - it never re-prices them. So a row entered by hand kept its original figure
REM for as long as it existed, and "update the prices" quietly meant "update the crawled ones".
REM This opens each row's own link, finds the build that row describes and writes today's price.
REM
REM It is safe to run unattended because it refuses far more than it accepts: a move of more than
REM half is reported and NOT applied, a price under 10,000 dram is reported and not applied, a
REM page that no longer names the product is reported as a bad link, and several rows sharing one
REM url that disagree about the price are left alone entirely. Everything it declines is printed.
REM
REM It runs after the two fetches above because eldorado and zigzag rows are answered from those
REM caches, and before the crawl below because the crawl reads listings.csv.
REM
REM Not a gate: an unreachable shop leaves the old figure, which is what it did before anyway.
REM --recheck 1 means "anything not looked at today", which is every hand row. --limit 400 keeps
REM one night's work to roughly ten minutes on this machine: the oldest 400 are taken, they come
REM back carrying today's date, and tomorrow's run picks up the next 400. About 1,800 rows are in
REM the rotation, so everything is re-priced within a week and nothing is ever left behind.
REM Raise the limit to cover more per night; drop --limit entirely to do all of them in one go.
echo [%date% %time%] re-pricing the hand-entered rows...
node tools\confirm-hand.mjs --recheck 1 --limit 400
if errorlevel 1 echo   hand-row pass failed - carrying on with the figures already in listings.csv

REM --fresh: the nightly job wants today's prices from every shop, not yesterday's checkpoint.
REM Without it a run started again the same day skips the shops the last one already read, which
REM is what somebody re-running by hand after a crash wants and the opposite of what this wants.
echo [%date% %time%] refreshing prices...
node scrape.mjs --fresh
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

REM A shop rewrites its image urls, so a product with no photograph today often has one the
REM morning after a fresh crawl - which is exactly now. --missing asks only about the products
REM that have none, because measuring all 1,318 to improve 200 is an hour of somebody else's
REM bandwidth. It writes to images/_src only; turning those into cutouts is tools/cutout.py,
REM which is run by a person because every new cutout is looked at before it goes on the site.
REM
REM Not a gate: no photograph is a worse page, not a wrong price.
echo.
echo [%date% %time%] looking for photographs of the products that have none...
node tools/photos.mjs --missing
if errorlevel 1 echo   photo pass failed - prices are published regardless

REM Not a gate, a reading. Rows that disagree with themselves are printed so the run says what it
REM is unsure about, instead of leaving it to be found on the site.
echo.
echo [%date% %time%] rows that disagree with themselves:
node tools/recheck.mjs

REM The other three readings: links that go nowhere, offers nobody has confirmed, and titles on
REM the shelves this catalogue has no entry for. All three drift quietly between runs and all
REM three used to be discovered on the live site instead of here.
echo.
echo [%date% %time%] state of the catalogue:
node tools/health.mjs

REM What this run CANNOT do, so it is not mistaken for having done it. notebookcentre.am names
REM anthropic-ai and Claude-Web in its robots.txt with Disallow: / , so nothing here reads it -
REM its prices and its links are confirmed by a person opening the shop, and the seen column in
REM data/listings.csv carries the date that happened. If those dates are old, that is the job.
echo.
echo   notebookcentre is not crawled - its robots.txt refuses this kind of client.
echo   Its rows are confirmed by hand; check the seen column in data\listings.csv.

echo.
echo [%date% %time%] done.
endlocal
