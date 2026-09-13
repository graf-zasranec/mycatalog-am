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

    # A near-white patch ringed by product that is NOT near-white is backdrop the model kept.
    # The ring test is what keeps a white phone or a white watch face from being flagged.
    white = body & (rgb.min(axis=2) > 228)
    lab, _ = ndimage.label(white)
    specks = 0
    for i, sz in enumerate(np.bincount(lab.ravel())):
        if i == 0 or sz < 25:
            continue
        m = lab == i
        if m[0].any() or m[-1].any() or m[:, 0].any() or m[:, -1].any():
            continue
        ring = ndimage.binary_dilation(m, iterations=2) & ~m
        if ring.any() and body[ring].mean() > 0.9 and (rgb[ring].min(axis=1) > 228).mean() < 0.4:
            specks += sz
    if specks > 400:
        bad.append(f'{specks}px of white backdrop left inside the product')

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


def main():
    want = sys.argv[1:]
    files = sorted(f for f in os.listdir(CUT) if f.endswith('.webp'))
    if want:
        files = [f for f in files if any(f.startswith(x) for x in want)]
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
