# Checks the cutouts in images/cut/ and reports the defects that have actually shipped here.
#
#   python tools/imgcheck.py                 every cutout
#   python tools/imgcheck.py apple-iphone    just the ones whose name starts with this
#
# Every rule below exists because that exact fault reached the site once:
#   - a white blob of studio backdrop left inside a dark watch strap's loop
#   - a white halo on a dark page, from edge pixels still blended with the studio
#   - a sliver of the neighbouring phone kept when a group shot was cropped per device
#   - a product touching the canvas edge, so it reads as cropped rather than photographed
#   - a source too small to fill the frame, upscaled into blur
import sys, os
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
CUT = ROOT / 'images' / 'cut'


def check(path: Path):
    a = np.array(Image.open(path).convert('RGBA'))
    al, rgb = a[..., 3], a[..., :3].astype(int)
    h, w = al.shape
    body = al > 128
    bad = []
    if not body.any():
        return ['nothing opaque - the cut removed the whole product']

    # Touching an edge means the product was cropped, not photographed against a backdrop.
    for name, line in (('top', al[0]), ('bottom', al[-1]), ('left', al[:, 0]), ('right', al[:, -1])):
        if (line > 24).sum() > 2:
            bad.append(f'product runs off the {name} edge')

    frac = body.mean()
    if frac < 0.06:
        bad.append(f'product fills only {frac*100:.1f}% of the frame')
    if max(w, h) < 600:
        bad.append(f'canvas only {w}x{h} - the source was too small to fill 1200px')

    # There is deliberately NO rule here for white specks left inside a product, though that is
    # the fault that started this file. Four rules were tried and all of them fail, because a
    # speck of studio backdrop and a real white part of a product are the same pixels: pure,
    # flat, enclosed by darker product. A white watch dial, the numerals on a black face, the
    # inside of an AirPods case and a blob of trapped backdrop score identically. The last
    # attempt flagged 200 of 335 cutouts, nearly all of them correct images.
    # Use --sheet instead: it lays the cutouts over magenta, where a leftover speck is instantly
    # obvious to the eye and a white product plainly is not. That is what caught the Galaxy Watch.

    # Half-transparent edge pixels should carry the product's colour. If they are far brighter,
    # they are still blended with the studio and will read as a halo on a dark page.
    soft = (al > 40) & (al < 215)
    if soft.sum() > 200:
        edge, prod = rgb[soft].mean(), rgb[body].mean()
        if edge > prod + 60 and edge > 170:
            bad.append(f'white halo on the edge (edge {edge:.0f} vs product {prod:.0f})')

    # A leftover neighbour is a second column of product with clear space beside it.
    cols = body.sum(axis=0) > h * 0.04
    runs, start = [], None
    for x in range(w + 1):
        on = x < w and cols[x]
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append(x - start); start = None
    if len(runs) > 1:
        wide = max(runs)
        small = [r for r in runs if r < wide * 0.45]
        if small:
            bad.append(f'{len(small)} narrow fragment(s) beside the product - {small} px wide')
    return bad


def sheet(files, out):
    """Lays the cutouts over magenta. Any studio backdrop still stuck to a product shows up as a
    white patch where magenta should be - the one test for that which does not cry wolf."""
    from PIL import Image as I
    S, cols = 300, min(6, len(files))
    rows = (len(files) + cols - 1) // cols
    sh = I.new('RGB', (S * cols, S * rows), (255, 0, 170))
    for n, f in enumerate(files):
        im = I.open(CUT / f).convert('RGBA').resize((S, S), I.LANCZOS)
        tile = I.new('RGBA', (S, S), (255, 0, 170, 255))
        tile.alpha_composite(im)
        sh.paste(tile.convert('RGB'), ((n % cols) * S, (n // cols) * S))
    sh.save(out)
    print(f'contact sheet: {out}  ({len(files)} cutouts over magenta - look for white)')


def main():
    want = [a for a in sys.argv[1:] if not a.startswith('-')]
    files = sorted(f for f in os.listdir(CUT) if f.endswith('.webp'))
    if want:
        files = [f for f in files if any(f.startswith(x) for x in want)]
    if '--sheet' in sys.argv:
        sheet(files[:36], ROOT / 'imgcheck-sheet.png')
        return 0
    flagged = 0
    for f in files:
        bad = check(CUT / f)
        if bad:
            flagged += 1
            print(f'  ! {f}')
            for b in bad:
                print(f'      {b}')
    print(f'{len(files)} checked, {flagged} with findings')
    return 1 if flagged else 0


if __name__ == '__main__':
    sys.exit(main())
