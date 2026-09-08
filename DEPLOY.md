# Putting MyCatalog online

The site is plain static files. There is no server, no database, no build step at request
time — so it can be hosted free, almost anywhere.

## What you actually have

| File | What it is | Use it when |
|---|---|---|
| `index.html` + `images/` | the site, images loaded from disk | normal hosting (recommended) |
| `index.embedded.html` | the **entire site in one file**, images inlined (2.3 MB) | you want zero moving parts |

Both are self-contained. The only thing they fetch from the internet is the Google Fonts
stylesheet; everything else is local.

---

## Option A — GitHub Pages (recommended)

Free, gets a public URL, and **the prices refresh themselves** — `.github/workflows/deploy.yml`
re-scrapes the shops every night at 07:00 Yerevan, rebuilds, commits the new prices and price
history, and redeploys. Your PC does not need to be on.

1. Create a GitHub account (you have to do this yourself — I can't create accounts).
2. Create an empty repository, e.g. `mycatalog`.
3. From this folder:

```bash
git init
git add -A
git commit -m "MyCatalog"
git branch -M main
git remote add origin https://github.com/<your-user>/mycatalog.git
git push -u origin main
```

4. In the repo: **Settings → Pages → Source → GitHub Actions**.
5. Done. Your URL is `https://<your-user>.github.io/mycatalog/`.

The workflow also runs the scraper self-test first, and a shop being down will not block a
deploy — it keeps the previous prices instead of publishing an empty catalogue.

## Option B — drag and drop (fastest, no git)

Go to <https://app.netlify.com/drop> and drag this whole folder onto the page. You get a URL in
about ten seconds. Prices will **not** refresh on their own; re-drag the folder after running
`refresh.cmd` when you want to update.

Cloudflare Pages and Vercel both work the same way.

## Option C — one file

Rename `index.embedded.html` to `index.html` and put it on any web host, however basic.
Nothing else needs to go with it.

---

## A custom domain

A `.am` domain has to be bought — typically around 25 000–40 000 ֏ a year from an Armenian
registrar (abcdomain.am, internet.am). **You have to buy it yourself**; I can't make purchases.

Once you own it, point it at your host:

- **GitHub Pages** — add a `CNAME` file containing your domain, then set an `ALIAS`/`CNAME`
  DNS record to `<your-user>.github.io`.
- **Netlify / Cloudflare** — add the domain in the dashboard and follow its DNS instructions.

A free `*.github.io` or `*.netlify.app` subdomain works perfectly well until you decide.

---

## Before you show it publicly

Two things are still demo-grade and you should decide about them deliberately:

1. **Product photos** come from shop and manufacturer press renders — see
   `images/SOURCES.txt`. Fine for a prototype or a client pitch; they need licensing, or
   replacing with your own photography, before a public commercial launch.
2. **Six of 22 models have no live offers** and show an estimated price, labelled as an
   estimate in the UI. The other 16 are real, scraped prices.

Prices themselves are real and sourced from the shops' own pages, with the shop named and
linked on every offer.
