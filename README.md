# Better

A price comparison for the Armenian market, in Armenian, Russian and English. 1206 products in
14 sections - phones, laptops, TVs, monitors, headphones, watches, tablets, speakers and more -
with prices from 21 Armenian shops, refreshed every night.

It is a static site: GitHub Pages serves the repository as it is, and a nightly GitHub Action
re-reads the shops, rebuilds and commits. There is no server and no database.

## Put it online

See **DEPLOY.md**. After buying a domain: add a `CNAME` file with it, set `SITE` in
`build.mjs` to the new address, rebuild, and point the domain's DNS at GitHub Pages.

## Edit it

| File | What it holds |
|---|---|
| `_shell.html` | all the CSS and the page chrome |
| `_app.js` | all the logic: routing, filters, compare, price chart, i18n |
| `build.mjs` | bakes everything into `index.html`, the product and section pages under `p/` and `c/`, `sitemap.xml` and `robots.txt` |
| `data/phones.json` | every product and its specs (the name is historical - it holds all sections) |
| `data/prices.json` | today's offers per product, written by `scrape.mjs` |
| `data/history.json` | cheapest price per day, and per storage size (`t`) from 24.09.2026 |
| `data/links.csv` | pins: which product a shop url belongs to (`-` = not something we carry) |
| `data/merged.json` | products folded into another; old links redirect to the survivor |
| `data/terms.json` | spec vocabulary in Armenian and Russian |
| `data/strings.json` | UI labels in all three languages |
| `images/cut/` | transparent product cutouts, `<id>__main.webp` and `<id>__<colour>.webp` |
| `images/thumb/` | 600 px copies of the cutouts for cards |

After changing anything:

    node build.mjs

The build runs the app's self-test (`tools/app-test.mjs`) and refuses to finish if it fails, or
if the stylesheet's braces do not balance.

## Keeping the catalogue clean

    node tools/merge.mjs plan.json [--write]   # fold duplicates, remove or rename products
    node tools/audio.mjs --write               # give new headphones a type for the filters
    node tools/prune.mjs [--write]             # drop products nothing in the country sells
    python tools/thumbs.py --check             # rebuild thumbnails that no longer match their photo
    python tools/photo-dupes.py                # list colours that share one photo (no dot for them)

A product sold in several screens (the iPad Air in 11 and 13 inches, a TV range) is ONE product with
the size as a variant, like capacity - never one product per size. Names carry no colour, memory,
screen size or year unless that is the only thing telling two generations apart (TV A 2025 / 2026).

A spec the maker's sheet did not settle is listed in the product's `unsure` array and shown as
"unconfirmed". `tools/resolve-unsure.mjs` records how the last batch was settled: confirmed,
corrected or deleted.

Names are followed by a small tag: the launch year for phones, tablets, watches and headphones
(`year`, or the year of `released`), the screen for TVs and monitors. `tools/years.mjs` holds the
years that are certain; a product without one shows no tag rather than a guess.

A merge moves the offers, price history and shop pins to the survivor and records the old id in
`data/merged.json`, so a link that was already shared still lands.

## Prices

    node scrape.mjs --selftest   # offline check of the product/storage matcher
    node scrape.mjs              # every shop
    node scrape.mjs vega         # one shop; merges into the existing data

The rules each shop is read under - what its robots.txt allows, which pages, how slowly - are
written at the top of `scrape.mjs`. A shop that is down keeps last night's prices rather than
publishing an empty catalogue.

Not read at all: **list.am** (robots.txt disallows ClaudeBot) and **gsmarena.com** (disallows
ClaudeBot, Claude-SearchBot and anthropic-ai).

## Photos

Product photos come from the shops' own pages and manufacturer press renders - see
`images/SOURCES.txt`. `tools/cutout.py` cuts the product out locally with a segmentation model;
nothing leaves the machine. They need licensing, or replacing with your own or a distributor's
photography, before a commercial launch.

## Crawlers

`robots.txt` lets search engines in (Google, Bing, Yandex, DuckDuckGo, Apple) along with link
previews (Telegram, Facebook), and asks AI crawlers and AI assistants' fetchers to stay out. The
list is `AI_BOTS` in `build.mjs`. A crawler only reads `robots.txt` at the root of a domain, so it
takes effect once the site has its own domain rather than a `github.io/mycatalog-am/` folder.

## Design

- Warm ivory ground `#F7F3EC`, ink `#161C28`, brick `#9E2B25`; a hand-tuned dark theme
- Manrope for text, IBM Plex Mono for labels, Noto Sans Armenian for Armenian
