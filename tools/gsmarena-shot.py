# Turns a GSMArena official render into a catalogue source photo.
#
#   python tools/gsmarena-shot.py <product-id> <gsmarena-slug> [<brand-folder>]
#
# Their renders are exactly the house style - front, back and side profiles straight on, on white -
# and every one carries "www.GSMArena.com" in light grey near the bottom right. This does three
# things: keeps only the front and back panels (the side, top and bottom strips are dropped), finds
# the watermark, and rebuilds the strip it covers out of the pixels either side of it.
#
# The watermark is found rather than passed in, because it sits at a different place in every
# render - 81px from the right edge in one, 195px in another. It is the only thing in a product
# shot that is flat, light, unsaturated text lying over a smooth surface in the bottom corner.
import sys, io, urllib.request
import numpy as np
from PIL import Image
from scipy import ndimage
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.gsmarena.com/'}


def runs(mask, minlen):
    """Contiguous True stretches of a 1-D boolean, as (start, end) pairs."""
    out, start = [], None
    for i, on in enumerate([*mask, False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if i - start >= minlen:
                out.append((start, i - 1))
            start = None
    return out


def fetch(slug, brand):
    url = f'https://fdn2.gsmarena.com/vv/pics/{brand}/{slug}.jpg'
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')


def panels(a):
    """The two widest columns of content are the front and the back; the thin ones are edges."""
    nz = a.mean(axis=2) < 242
    cols = runs(nz.sum(axis=0) > 20, 1)
    rows = runs(nz.sum(axis=1) > 20, 1)
    if not cols or not rows:
        raise SystemExit('no content found')
    wide = [c for c in cols if c[1] - c[0] >= max(w[1] - w[0] for w in cols) * 0.6]
    tall = max(rows, key=lambda r: r[1] - r[0])
    return wide[0][0], tall[0], wide[-1][1] + 1, tall[1] + 1


def unmark(a):
    """Erase GSMArena's mark: flat, light, unsaturated text over a smooth surface, bottom-right."""
    h, w, _ = a.shape
    v, sat = a.mean(axis=2), a.max(axis=2) - a.min(axis=2)
    zone = np.zeros((h, w), bool)
    zone[int(h * 0.70):, :] = True          # the whole bottom band: the mark is not always on the right
    # Grey rather than coloured, and standing out from whatever it lies on - in EITHER direction.
    # It reads lighter than a dark phone back and darker than the white backdrop, and testing only
    # for "lighter" missed it on every product photographed against white.
    local = ndimage.uniform_filter(v, size=41)
    cand = zone & (sat < 26) & (np.abs(v - local) > 11)
    lab, n = ndimage.label(ndimage.binary_closing(cand, np.ones((3, 15))))
    if not n:
        return a, None
    # Shape is what separates the mark from the product. "www.GSMArena.com" is a WIDE, SHORT strip
    # - roughly ten times longer than it is tall. Taking the largest blob instead picked a highlight
    # running down the Galaxy Watch's strap and smeared a pale rectangle across it.
    best = None
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        if bh > 22 or bw < 55 or bw < bh * 4:
            continue
        if best is None or bw > best[0]:
            best = (bw, xs.min(), xs.max(), ys.min(), ys.max())
    if best is None:
        return a, None
    _, xmin, xmax, ymin, ymax = best
    xs, ys = np.array([xmin, xmax]), np.array([ymin, ymax])
    x0, x1, y0, y1 = xs.min() - 3, xs.max() + 3, ys.min() - 3, ys.max() + 3
    x0, x1 = max(1, x0), min(w - 2, x1)
    y0, y1 = max(0, y0), min(h - 1, y1)
    t = np.linspace(0, 1, x1 - x0 + 1)[:, None]
    out = a.astype(np.float32)
    for y in range(y0, y1 + 1):
        left, right = out[y, max(0, x0 - 3):x0].mean(axis=0), out[y, x1 + 1:x1 + 4].mean(axis=0)
        out[y, x0:x1 + 1] = left * (1 - t) + right * t
    return np.clip(out, 0, 255).astype('uint8'), (x0, y0, x1, y1)


def main():
    pid, slug = sys.argv[1], sys.argv[2]
    brand = sys.argv[3] if len(sys.argv) > 3 else slug.split('-')[0]
    a = np.array(fetch(slug, brand))
    x0, y0, x1, y1 = panels(a)
    a = a[y0:y1, x0:x1]
    a, box = unmark(a)
    out = ROOT / 'images' / '_src' / f'{pid}__main.png'
    Image.fromarray(a).save(out)
    print(f'{pid}: {a.shape[1]}x{a.shape[0]}' + (f', watermark erased at {box}' if box else ', no watermark found'))


if __name__ == '__main__':
    main()
