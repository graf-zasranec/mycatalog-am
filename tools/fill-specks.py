# Fills the pinholes a matting model punches through a product.
#
#   python tools/fill-specks.py            every photo
#   python tools/fill-specks.py <id> ...   just these
#
# rembg treats the brightest thing in frame as background, so the camera flash on an iPhone 18
# Pro came out as a magenta-jagged hole in the middle of the phone. Anything fully enclosed by
# the product IS the product - but only up to a point: a watch strap loop, the Clip 5's
# carabiner and the Major's headband are enclosed holes too, and they are real. Those run from
# 1% to 66% of the product's area; the punched ones are under 0.05%, three orders of magnitude
# apart, so the cut is not a close call.
import sys
import numpy as np
from scipy import ndimage
from PIL import Image
from pathlib import Path

CUT = Path(__file__).resolve().parent.parent / 'images' / 'cut'
LIMIT = 0.0005          # 0.05% of the product's own area


def fix(path):
    im = Image.open(path).convert('RGBA')
    arr = np.array(im)
    a = arr[..., 3]
    # 200, not 128: the punched hole leaves a ring of PARTIAL alpha around it, and at 128 that
    # ring counts as product, so the hole is sealed but still shows a dotted outline of the
    # background through it.
    solid = a > 200
    holes = ndimage.binary_fill_holes(solid) & ~solid
    if not holes.any():
        a0 = a.copy()
        harden(arr)
        # A lossy WebP save nudges the very alpha it was just handed: a pixel written as 255
        # reads back 253. harden is idempotent on exact values, so it "repairs" that on the next
        # run and saves again, and the same file is re-encoded on every pass for ever - 128
        # cutouts churned that way in one afternoon, each losing a little RGB to the
        # re-compression while looking identical. Only a change a viewer could see is worth a
        # rewrite, and five units of alpha on an already-opaque pixel is not one.
        if int((np.abs(arr[..., 3].astype(np.int16) - a0.astype(np.int16)) > 8).sum()):
            Image.fromarray(arr, 'RGBA').save(path, 'WEBP', quality=90)
            return -1                       # hardened only, no hole to close
        return 0
    lab, n = ndimage.label(holes)
    area = solid.sum()
    fill = np.zeros_like(solid)
    filled = 0
    for k in range(1, n + 1):
        m = lab == k
        if m.sum() / area < LIMIT:
            fill |= m
            filled += int(m.sum())
    if not filled:
        return 0
    # opaque, and coloured from the product around the hole rather than left as whatever RGB the
    # transparent pixels happened to carry
    a[fill] = 255
    for c in range(3):
        ch = arr[..., c].astype(np.float32)
        ch[fill] = ndimage.median_filter(ch, size=9)[fill]
        arr[..., c] = np.clip(ch, 0, 255).astype(np.uint8)
    arr[..., 3] = a
    harden(arr)
    Image.fromarray(arr, 'RGBA').save(path, 'WEBP', quality=90)
    return filled


def harden(arr):
    """A pixel ringed by solid product is solid product.

    Sealing the hole still left a hairline of partial alpha around it, because the cut had
    feathered the flash's rim. This looks only INSIDE the silhouette - a pixel whose 5x5
    neighbourhood is almost entirely opaque - so the product's own outline keeps its feather."""
    a = arr[..., 3]
    solid = (a > 200).astype(np.float32)
    inside = ndimage.uniform_filter(solid, size=5) > 0.92
    a[inside] = 255
    arr[..., 3] = a


def main():
    ids = sys.argv[1:]
    files = [CUT / f'{i}__main.webp' for i in ids] if ids else sorted(CUT.glob('*__main.webp'))
    total = hit = 0
    for f in files:
        if not f.exists():
            print(f'{f.name}: missing'); continue
        px = fix(f)
        if px == -1:
            hit += 1
            print(f'{f.name.replace("__main.webp", ""):36} edge hardened')
        elif px:
            hit += 1; total += px
            print(f'{f.name.replace("__main.webp", ""):36} filled {px} px')
    print(f'\n{hit} photo(s) repaired, {total} px of pinholes closed')


if __name__ == '__main__':
    main()
