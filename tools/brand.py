# Builds the brand kit in brand/ from the Fraunces outlines, so no file depends on a font being installed.
#
#   python tools/brand.py FONT.woff2      (Fraunces variable, latin "full" axes - @fontsource-variable/fraunces)
#   node tools/brand-png.mjs              then renders the PNG sizes from these SVGs
#
# The logo is lowercase "better." in Fraunces at optical size 144, weight 800, tracked -0.03em - the
# same setting the site's header uses - with the full stop in brick. The mark is "b." on its own.
import json, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'brand'
C = {  # the site's own tokens
    'ink': '#161C28', 'brick': '#9E2B25', 'ivory': '#F7F3EC', 'night': '#12151D',
    'cream': '#F2EEE7', 'coral': '#E4574F', 'white': '#FFFFFF', 'black': '#000000',
}

font = instantiateVariableFont(TTFont(sys.argv[1]), {'opsz': 144, 'wght': 800}, inplace=False)
gs, cmap, hm = font.getGlyphSet(), font.getBestCmap(), font['hmtx']
UPM = font['head'].unitsPerEm
TRACK = -0.03 * UPM


def glyph(ch):
    g = cmap[ord(ch)]
    pen, bp = SVGPathPen(gs), BoundsPen(gs)
    gs[g].draw(pen); gs[g].draw(bp)
    return pen.getCommands(), hm[g][0], bp.bounds


def setline(text):
    """[(path, x)] for each glyph plus the ink box (x0, y0, x1, y1) in font units, y up."""
    x, parts, box = 0, [], [1e9, 1e9, -1e9, -1e9]
    for ch in text:
        d, adv, b = glyph(ch)
        parts.append((ch, d, x))
        box = [min(box[0], x + b[0]), min(box[1], b[1]), max(box[2], x + b[2]), max(box[3], b[3])]
        x += adv + TRACK
    return parts, box


def logo_svg(text, fg, dot, bg=None, pad=0.12, square=False, radius=0.22):
    parts, (x0, y0, x1, y1) = setline(text)
    w, h = x1 - x0, y1 - y0
    p = pad * (max(w, h) if square else h)
    W, H = (max(w, h) + 2 * p,) * 2 if square else (w + 2 * p, h + 2 * p)
    ox, oy = (W - w) / 2 - x0, (H - h) / 2 + y1       # font y-up -> svg y-down
    body = ''.join(f'<path fill="{dot if ch == "." else fg}" transform="translate({ox + x:.1f} {oy:.1f}) scale(1 -1)" d="{d}"/>'
                   for ch, d, x in parts)
    rect = f'<rect width="{W:.0f}" height="{H:.0f}" rx="{W * radius if square else 0:.0f}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" role="img" aria-label="Better.am">'
            f'<title>Better.am</title>{rect}{body}</svg>\n')


def write(rel, s):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s)
    print('wrote', rel)


# the wordmark in every colourway it may appear in
write('logo/better-wordmark.svg', logo_svg('better.', C['ink'], C['brick']))                     # on light
write('logo/better-wordmark-on-dark.svg', logo_svg('better.', C['cream'], C['coral']))          # on dark
write('logo/better-wordmark-on-brick.svg', logo_svg('better.', C['white'], C['ink']))           # on brick
write('logo/better-wordmark-black.svg', logo_svg('better.', C['black'], C['black']))            # one colour
write('logo/better-wordmark-white.svg', logo_svg('better.', C['white'], C['white']))            # one colour, reversed
write('logo/better-wordmark-ivory-bg.svg', logo_svg('better.', C['ink'], C['brick'], bg=C['ivory'], pad=0.35))
# the mark: "b." alone, and the app icon (square, dark, rounded)
write('logo/better-mark.svg', logo_svg('b.', C['ink'], C['brick'], pad=0.02))
write('logo/better-mark-on-dark.svg', logo_svg('b.', C['cream'], C['coral'], pad=0.02))
write('icon/better-app-icon.svg', logo_svg('b.', C['ivory'], C['coral'], bg=C['ink'], pad=0.2, square=True))
write('icon/better-app-icon-brick.svg', logo_svg('b.', C['white'], C['ink'], bg=C['brick'], pad=0.2, square=True))
write('icon/better-app-icon-square.svg', logo_svg('b.', C['ivory'], C['coral'], bg=C['ink'], pad=0.2, square=True, radius=0))  # iOS / Android mask it themselves
write('icon/favicon.svg', logo_svg('b.', C['ivory'], C['coral'], bg=C['night'], pad=0.16, square=True, radius=0.25))


def social(W, H, bg, fg, dot, scale):
    """The wordmark centred on a flat ground, for share cards and profile banners."""
    parts, (x0, y0, x1, y1) = setline('better.')
    k = W * scale / (x1 - x0)
    ox, oy = (W - (x1 - x0) * k) / 2 - x0 * k, (H - (y1 - y0) * k) / 2 + y1 * k
    body = ''.join(f'<path fill="{dot if ch == "." else fg}" transform="translate({ox + x * k:.1f} {oy:.1f}) scale({k:.5f} {-k:.5f})" d="{d}"/>'
                   for ch, d, x in parts)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="Better.am">'
            f'<title>Better.am</title><rect width="{W}" height="{H}" fill="{bg}"/>{body}</svg>\n')


write('social/share-1200x630.svg', social(1200, 630, C['ivory'], C['ink'], C['brick'], 0.5))
write('social/share-1200x630-dark.svg', social(1200, 630, C['night'], C['cream'], C['coral'], 0.5))
write('social/cover-1500x500.svg', social(1500, 500, C['ivory'], C['ink'], C['brick'], 0.34))
write('social/cover-1500x500-dark.svg', social(1500, 500, C['night'], C['cream'], C['coral'], 0.34))

# colours and type, for anyone building with the brand
tokens = {
    'color': {
        'ink': {'value': C['ink'], 'use': 'text and the logo on light grounds'},
        'brick': {'value': C['brick'], 'use': 'the full stop, links, primary buttons'},
        'ivory': {'value': C['ivory'], 'use': 'page ground'},
        'night': {'value': C['night'], 'use': 'dark theme ground'},
        'cream': {'value': C['cream'], 'use': 'text and the logo on dark grounds'},
        'coral': {'value': C['coral'], 'use': 'brick on dark grounds'},
    },
    'type': {
        'logo': 'Fraunces 800, optical size 144, tracking -3% (outlined in these files)',
        'text': 'Manrope 400-800',
        'labels': 'IBM Plex Mono 400-600, uppercase, tracked',
        'armenian': 'Noto Sans Armenian 400-800',
    },
}
write('tokens.json', json.dumps(tokens, indent=2, ensure_ascii=False))
write('tokens.css', ':root {\n' + ''.join(f'  --better-{k}: {v["value"]};\n' for k, v in tokens['color'].items()) + '}\n')
