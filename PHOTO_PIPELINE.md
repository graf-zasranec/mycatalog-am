# Better.am photo pipeline

Shared starting point for Claude Code and Codex when tracing or changing product photos. Use the graph to locate likely handoffs, then verify those handoffs in source. Visual review remains part of quality control.

## Handoffs

| Stage | Input → output | Entry points |
|---|---|---|
| Source | Retailer offer/page image URL → `images/_src/<id>__<color>.<ext>` | `tools/colors.mjs` selects offer photos, including per-color images. `tools/shelf-photos.py` and `tools/shop-photos.py` download missing photos. `tools/find-images.py` fills URLs in `data/wanted-images.csv`; it does not download image files. |
| Background removal | `images/_src/` → transparent, trimmed `images/cut/<id>__<color>.webp` | `python tools/cutout.py [product-id]__`; `tools/place-cut.py` handles already-transparent sources or explicit white/flood matting. The selectors are filename prefixes; include `__` to avoid matching a longer product ID with the same prefix. |
| Quality review | `images/cut/*.webp` → findings and contact sheets | `python tools/imgcheck.py [product-id]__`; add `--sheet` for a contact sheet. `python tools/photo-audit.py` writes a report and visual sheets under `photo-audit/`. `python tools/defringe.py --halo` repairs cutouts flagged for halos. Findings need visual review. |
| Color selection | Cutout filename slug → product/color image map | `build.mjs` reads `images/cut/`, applies `data/color-aliases.json`, skips known duplicate-color photos, and chooses a matching color with fallbacks. |
| Derivatives and site | Cutouts → `images/thumb/` at 480/320/240px and `data/thumbnails.json` → generated pages/assets | Run `python tools/thumbnails.py`, then `npm run build` when publishing. `_app.js` uses the 240px and 320px files in responsive `srcset` values. |

These are script handoffs, not one automatic pipeline command. Choose a source route appropriate to the product and verify output filenames.

## Focused workflow

1. Identify the product ID and source URL/offer. Check for existing source and cutout files.
2. Save a replacement source under the expected `<id>__<color>` name in `images/_src/`.
3. Run `python tools/cutout.py [product-id]__`.
4. Run `python tools/imgcheck.py [product-id]__`; inspect the product in context or review `photo-audit/` findings. A clean heuristic report is not proof the photo is correct.
5. Confirm the color slug or alias and that `build.mjs` selects the intended cutout.
6. Run `python tools/thumbnails.py`, then `npm run build` when publishing updated image assets.

Replace `[product-id]` with the real ID. The scripts match filename prefixes, so `apple-iphone-18-pro__` selects that product without also matching `apple-iphone-18-pro-max`.

## Verified example

`apple-iphone-18-pro` has source files and matching `main`, `black`, `burgundy`, `glacier`, and `silver` cutouts. Its listed colors map to those cutouts; `data/color-aliases.json` maps “Sky Blue” to Glacier. `python tools/imgcheck.py apple-iphone-18-pro__` reported 5 checked, 0 findings. I visually inspected the Burgundy cutout. The existing English and Russian product pages select it and reference thumbnail variants. The page HTML already expects 320px thumbnails, so `tools/thumbnails.py` now creates that derivative along with 240px and 480px outputs.

## Graphify prompts

```text
graphify query "which scripts write product photos to images/_src and what names do they use?"
graphify path "cutout.py" "imgcheck.py"
graphify query "how does build.mjs map color slugs to cutouts and thumbnails?"
```

The graph has dangling edges; use it as a map and verify the source. After changing files under `tools/`, run `graphify update tools` so both assistants query the refreshed graph from this checkout.
