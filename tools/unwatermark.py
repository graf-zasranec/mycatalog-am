# Erases a watermark that sits on a smooth part of a product, by rebuilding the rectangle it
# covers out of the pixels on either side of it.
#
#   python tools/unwatermark.py photo.jpg 538 667 632 682
#
# It only works where the surface under the mark is smooth - a phone's flat back, a laptop lid,
# a studio backdrop. That is the usual place for one, because a watermark is put where it can be
# read. Over texture or detail it will smear, and the honest move there is a different photo:
# that is why the Pixel's front view was dropped rather than patched.
#
# Each row is rebuilt by interpolating between the pixel just outside the box on the left and the
# one just outside on the right, so a gradient across the surface survives instead of being
# flattened to one colour.
import sys
import numpy as np
from PIL import Image


def erase(path, x0, y0, x1, y1, feather=2):
    im = Image.open(path)
    mode = im.mode
    a = np.array(im.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    x0, x1 = max(1, x0), min(w - 2, x1)
    y0, y1 = max(0, y0), min(h - 1, y1)
    span = x1 - x0 + 1
    if span < 2:
        raise SystemExit('box too narrow')
    t = np.linspace(0, 1, span)[:, None]
    for y in range(y0, y1 + 1):
        left = a[y, max(0, x0 - 1 - feather):x0 - 1 + 1].mean(axis=0)
        right = a[y, x1 + 1:x1 + 2 + feather].mean(axis=0)
        a[y, x0:x1 + 1] = left * (1 - t) + right * t
    out = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
    if mode == 'RGBA':
        out.putalpha(im.getchannel('A'))
    out.save(path)
    print(f'{path}: rebuilt {span}x{y1 - y0 + 1}px from the surface either side of it')


if __name__ == '__main__':
    if len(sys.argv) != 6:
        raise SystemExit(__doc__ or 'usage: unwatermark.py IMAGE X0 Y0 X1 Y1')
    erase(sys.argv[1], *(int(v) for v in sys.argv[2:6]))
