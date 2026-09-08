# MyCatalog

Trilingual (hy / ru / en) smartphone catalogue for the Armenian market.
22 handsets, prices in AMD, filters, product pages and side-by-side comparison.

## Put it online

See **DEPLOY.md**. Short version: GitHub Pages gives you a public URL and refreshes the
prices nightly by itself; Netlify Drop gives you one in ten seconds with no account setup.

## Open it

- `index.html` — double-click it. Reads photos from `images/`.
- `index.embedded.html` — same site as ONE file (photos inlined). Email it, put it anywhere.
- `artifact.html` — head-less fragment used for the published Claude artifact.

## Edit it

| File | What it holds |
|---|---|
| `_shell.html` | all the CSS + page chrome |
| `_app.js` | all the logic (filters, compare, i18n, routing) |
| `data/phones.json` | the 22 phones and their specs |
| `data/strings.json` | every UI label in hy / ru / en |
| `data/verdicts.json` | per-phone summary + pros/cons in hy / ru |
| `images/<id>.jpg` | original product photo, filename = the phone's `id` |
| `images/_src/` | photos pulled per colour from the shops (input to the cutout) |
| `images/cut/` | transparent WebP cutouts — `<id>__main.webp` and `<id>__<colour>.webp` |

After changing anything, run:

    node build.mjs

That regenerates all three html files. Swapping a product photo needs no code change —
just overwrite `images/<id>.jpg`.

## Design

- Colours taken from kimovil.com: ground `#F3F5FA`, indigo `#4535E4`, green `#01C778`, magenta `#F11382`
- Type: Onest (latin + cyrillic) with Noto Sans Armenian falling through for Armenian glyphs
- Light + dark themes, both hand-tuned. Theme button cycles auto -> light -> dark.

## Product photos

The product page shows a transparent cutout on a coloured panel, and swaps the photo when you
pick a colour. Two steps produce those:

    node tools/colors.mjs    # one photo per (phone, colour) from the shop that sells that colour
    node tools/cutout.mjs    # then open http://127.0.0.1:8791/ and let it finish

`cutout.mjs` serves a page that removes the white background on a canvas and POSTs the results
back as transparent WebP. It uses the browser only because decoding JPEG in Node needs a
dependency — nothing leaves the machine. The cutout is a **flood fill from the image border**,
not a global "white to transparent" threshold, so white and silver phone bodies survive intact.

Colour photos come from the shops themselves (Vega, then iSpace) — the photo shown for a colour
comes from a shop that actually sells it. The **main** photo is shop-sourced too for the 13 phones
a shop stocks with a picture; the other 9 fall back to `images/_gsmarena_fallback/`.

GSMArena's robots.txt disallows ClaudeBot, so nothing new is fetched from them — the fallback
files are ones downloaded earlier in the project. Replace them with your own or a distributor's
photography before launch.

## Keeping prices fresh

`refresh.cmd` re-scrapes every shop and rebuilds the site. A Windows scheduled task named
**"MyCatalog refresh"** runs it daily at 06:00.

    refresh.cmd                          # run it now

    # inspect / remove the schedule
    Get-ScheduledTask -TaskName 'MyCatalog refresh'
    Unregister-ScheduledTask -TaskName 'MyCatalog refresh' -Confirm:$false

If a scrape fails, refresh.cmd stops and keeps the previous `data/prices.json` rather than
publishing an empty catalogue. Photos are not refreshed by it — `tools/cutout.mjs` needs a
browser, so re-run `tools/colors.mjs` + `tools/cutout.mjs` by hand when a shop adds colours.

## Real prices

`node scrape.mjs` collects live prices from Armenian shops into `data/prices.json`,
then `node build.mjs` bakes them into the site. Re-run both whenever you want fresh prices.

    node scrape.mjs --selftest   # offline check of the phone/storage matcher
    node scrape.mjs              # fetch prices from all enabled shops
    node scrape.mjs ispace       # just one shop
    node build.mjs               # rebuild the html

Shops currently wired: **iSpace**, **Vega**, **Mobile Centre**, **Pixel**.

Each shop also carries a `warranty` URL where it genuinely publishes warranty terms; the product
page links those and names the shops that publish none rather than implying cover they don't offer.

Running one shop (`node scrape.mjs vega`) MERGES into the existing data — it re-fetches only that
shop and keeps the rest. It used to overwrite the file with a single shop's results.

A phone with no scraped offer keeps its estimated price and is labelled as an estimate
(`~` on the variant chips, "no online offers found" on the product page). Nothing is invented.

### Sites deliberately NOT scraped

| Site | Why |
|---|---|
| list.am | robots.txt: `User-agent: ClaudeBot` / `Disallow: /` |
| yerevanmobile.am | robots.txt: `User-agent: ClaudeBot` / `Disallow: /` |
| gsmarena.com | robots.txt disallows `ClaudeBot`, `Claude-SearchBot` and `anthropic-ai` |
| zigzag.am | WAF returns 403 to identified crawlers; faking a browser UA would be evasion |

Also checked and unusable: allcell.am and ibolit.am do not resolve, mobilecenter.am is a parked
domain for sale (the real shop is mobile**centre**.am), ultra.am is parked, onex.am is a delivery
service, 4u.am carries none of these models, xiaomi.am is a blog and honor.am publishes no prices.

Adding a shop = one adapter in `scrape.mjs`. Check its robots.txt first.

## Before this goes live

- Prices for 16 of 22 models are REAL, scraped from the shops' own sites. The other 6 are
  still estimates and are labelled as such in the UI. Re-run `scrape.mjs` regularly — prices go stale.
- Product photos are manufacturer press renders — see `images/SOURCES.txt`. They need
  licensing, or replace them with your own / the distributor's.
