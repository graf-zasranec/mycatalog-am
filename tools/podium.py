# Finds - and removes - the studio backdrop a matting pass kept as product.
#
#   python tools/podium.py                report every cutout holding backdrop
#   python tools/podium.py --fix          and erase it
#   python tools/podium.py <id> ...       just these
#
# bria-rmbg sometimes reaches a little past the product and keeps a piece of the white studio:
# the Kindle Paperwhite came out standing on two pale slabs (its drop shadow), and the burgundy
# iPhone 18 Pro had a white wedge stuck on the corner of its camera plateau. Both are the same
# thing - backdrop-coloured pixels, left opaque, hanging off the edge of the silhouette.
#
# The size test is what keeps a white PRODUCT safe: a white phone's body or an e-reader's page
# is a quarter of the frame, while a kept sliver is a fraction of a percent. The edge test keeps
# interior detail safe: a camera flash is backdrop-white too, but it does not touch the outside.
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

os.chdir(Path(__file__).resolve().parent.parent)
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
FIX = '--fix' in sys.argv
WANT = [a for a in sys.argv[1:] if not a.startswith('-')]
CUT, SRC = Path('images/cut'), Path('images/_src')
TOL = 45          # how close to the studio colour counts as the studio; the Kindle's kept
                  # shadow came back at 219 on a 255 backdrop, so the window has to be this wide
MAX_SHARE = 0.015  # a piece bigger than this much of the frame is the product, not a sliver


def backdrop(stem):
    """The studio colour, read off the four corners of the photo this cutout was made from."""
    for ext in ('.png', '.jpg', '.jpeg', '.webp'):
        p = SRC / (stem + ext)
        if p.exists():
            r = np.array(Image.open(p).convert('RGB')).astype(int)
            return np.median(np.concatenate([r[:8, :8].reshape(-1, 3), r[:8, -8:].reshape(-1, 3),
                                             r[-8:, :8].reshape(-1, 3), r[-8:, -8:].reshape(-1, 3)]), axis=0)
    return np.array([255, 255, 255])


def kept_backdrop(a, back):
    opaque, rgb = a[..., 3] > 200, a[..., :3].astype(int)
    outside = a[..., 3] <= 24
    studio = opaque & (np.abs(rgb - back).max(axis=2) < TOL)
    # A pale product has a pale rim: the anti-aliased edge of a pistachio Galaxy sits inside the
    # studio's window all the way round the phone, and it is one connected ring, so testing the
    # ring as a whole keeps it. Open the selection first - that erases anything thinner than a
    # few pixels wherever it is thin, and leaves the slabs that are actually kept studio.
    studio = ndimage.binary_opening(studio, structure=np.ones((3, 3), bool), iterations=2)
    lab, n = ndimage.label(studio)
    out = []
    for i in range(1, n + 1):
        m = lab == i
        size = int(m.sum())
        if size >= a[..., 0].size * MAX_SHARE:
            continue                                   # big enough to be the product itself
        if not (ndimage.binary_dilation(m, iterations=2) & outside).any():
            continue                                   # interior detail, not a piece of studio
        out.append((m, size))
    return out


files = sorted(f for f in CUT.glob('*.webp') if not WANT or any(f.stem.startswith(w) for w in WANT))
hits = px = 0
for f in files:
    a = np.array(Image.open(f).convert('RGBA'))
    found = kept_backdrop(a, backdrop(f.stem))
    if not found:
        continue
    hits += 1
    px += sum(s for _, s in found)
    print('%-46s %s' % (f.stem, ' + '.join('%d px' % s for _, s in sorted(found, key=lambda t: -t[1])[:4])))
    if FIX:
        for m, _ in found:
            a[m] = 0
        Image.fromarray(a, 'RGBA').save(f, quality=92, method=6)

print('\n%d of %d cutouts hold a piece of the studio (%d px)%s'
      % (hits, len(files), px, ' - erased' if FIX else ''))
