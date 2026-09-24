# Better.am brand kit

The name is **Better.am**. The logo is the word **better.** in lowercase with a brick full stop. It never shows ".am".

Every file here is made from the Fraunces letter shapes, turned into outlines. Nothing depends on a font being installed. To rebuild the kit:

```
python tools/brand.py fraunces-latin-full-normal.woff2   # the SVGs, tokens
node tools/brand-png.mjs                                  # every PNG size
python tools/brand-ico.py                                 # favicon.ico
```

(The font file comes from `npm pack @fontsource-variable/fraunces`.)

## Which file to use

| Where | File |
|---|---|
| Website, documents, print on a light background | `logo/better-wordmark.svg` |
| On a dark background | `logo/better-wordmark-on-dark.svg` |
| On a brick background | `logo/better-wordmark-on-brick.svg` |
| One colour only (stamp, engraving, fax) | `logo/better-wordmark-black.svg`, `-white.svg` |
| Needs its own background (Word, email signature) | `logo/better-wordmark-ivory-bg.svg` or its PNG |
| Small spaces, avatars, watermarks | `logo/better-mark.svg` ("b."), `better-mark-on-dark.svg` |
| App icon, profile picture (Instagram, Facebook, Telegram) | `icon/better-app-icon-square.svg` / `png/icon/better-app-icon-square-1024.png` |
| Rounded icon for slides and mockups | `icon/better-app-icon.svg`, `better-app-icon-brick.svg` |
| Browser tab | `icon/favicon.svg`, `icon/favicon.ico` |
| iPhone home screen | `icon/apple-touch-icon.png` (180) |
| Android / PWA | `icon/android-chrome-192.png`, `-512.png` |
| Link preview (Facebook, Telegram, X, LinkedIn) | `png/social/share-1200x630-1200.png` (`-dark` version too) |
| Profile banner (X, LinkedIn, YouTube) | `png/social/cover-1500x500-1500.png` (`-dark` version too) |

Use the SVG wherever it is accepted. Every wordmark and mark also comes as a PNG with a transparent background, at 512, 1024 and 2048 px wide (marks at 256, 512 and 1024 px), under `png/`.

## Colours

| Name | Hex | Use |
|---|---|---|
| Ink | `#161C28` | text and the logo on light backgrounds |
| Brick | `#9E2B25` | the full stop, links, main buttons |
| Ivory | `#F7F3EC` | page background |
| Night | `#12151D` | dark theme background |
| Cream | `#F2EEE7` | text and the logo on dark backgrounds |
| Coral | `#E4574F` | replaces brick on dark backgrounds |

The same values are in `tokens.css` (as `--better-*` variables) and `tokens.json`.

## Type

- **Logo:** Fraunces ExtraBold (800), optical size 144, tracking −3%. It is only for the logo. Headings and text never use it.
- **Text and headings:** Manrope, 400–800.
- **Armenian:** Noto Sans Armenian, 400–800.
- **Labels and prices:** IBM Plex Mono, 400–600. Labels are uppercase with a little tracking.

All four are free on Google Fonts.

## Rules

- **Clear space:** leave at least the height of the "e" on every side of the logo.
- **Minimum size:**
  - The wordmark should be at least 72 px (20 mm) wide.
  - Below that size, use the "b." mark.
  - The mark should be at least 16 px wide.
- **The full stop:** it is always brick (coral on dark backgrounds). The only exceptions are the one-colour versions and the version on brick, where it is ink.
- **Don't:**
  - add ".am" or capitalise it;
  - retype the logo in another font;
  - stretch, outline, shadow or rotate it;
  - put it on a busy photo;
  - recolour it outside the colours above.
- **In sentences:** write the name as "Better.am", and in Armenian and Russian text too. It is not translated.
