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


MARK = Path(__file__).resolve().parent / 'gsmarena-mark.png'


def hipass(v):
    """Strip the surface the mark lies on and keep only its strokes, so the same template matches
    whether it sits on a white backdrop, a dark phone back or a printed screen."""
    return v - ndimage.uniform_filter(v, size=9)


def unmark(a):
    """Find "www.GSMArena.com" by matching the letterforms themselves, and rebuild the strip it
    covers from the pixels either side.

    Earlier versions described the mark instead - flat, light, unsaturated, wide and short - and
    every description also fitted something on some product. One of them mistook a highlight on a
    Galaxy Watch strap for text and smeared a rectangle across it. The mark is always the same
    pixels in the same font, so matching the pattern is both stricter and simpler than any rule
    about what it looks like.
    """
    from scipy.signal import fftconvolve
    tpl = hipass(np.array(Image.open(MARK).convert('L')).astype(np.float32))
    th, tw = tpl.shape
    v = hipass(np.array(Image.fromarray(a).convert('L')).astype(np.float32))
    if v.shape[0] < th or v.shape[1] < tw:
        return a, None
    # normalised correlation: the template's energy is constant, so divide by the window's own
    tn = np.sqrt((tpl * tpl).sum())
    corr = fftconvolve(v, tpl[::-1, ::-1], mode='valid')
    energy = np.sqrt(np.maximum(fftconvolve(v * v, np.ones_like(tpl), mode='valid'), 0))
    # Absolute value, because the mark's polarity flips with what it lies on: light strokes on a
    # dark phone back, dark strokes on the white backdrop. The template was cut from a dark one, so
    # on a white background the correlation is strongly NEGATIVE and taking the raw peak found
    # nothing. This alone took the hit rate from three renders in ten to most of them.
    score = np.abs(corr) / (energy * tn + 1e-6)
    # A window with almost no detail divides a tiny correlation by a tinier norm and scores
    # near-perfectly on nothing at all - which is how the first run "found" the mark two pixels
    # from the top of the Galaxy Watch, in blank white. A window has to carry real contrast first.
    score[energy < tn * 0.35] = -1
    # The mark is always in the lower half of the render - lowest on a phone, around the middle on
    # a landscape watch shot, never at the top. Without this the Pixel 10a's best match was a strip
    # of its own top bezel, and the real mark at the bottom was left in place.
    score[:int(score.shape[0] * 0.40)] = -1
    y0, x0 = np.unravel_index(score.argmax(), score.shape)
    peak = float(score[y0, x0])
    # 0.72 sits in the gap measured across a dozen renders: real marks scored 0.87 and 0.79,
    # every false peak 0.69 and below. Below the line the answer is 'not located', never 'absent'.
    if peak < 0.72:
        return a, None
    h, w, _ = a.shape
    x0, x1 = max(1, x0 - 3), min(w - 2, x0 + tw + 2)
    y0, y1 = max(0, y0 - 3), min(h - 1, y0 + th + 2)
    t = np.linspace(0, 1, x1 - x0 + 1)[:, None]
    out = a.astype(np.float32)
    for y in range(y0, y1 + 1):
        left, right = out[y, max(0, x0 - 3):x0].mean(axis=0), out[y, x1 + 1:x1 + 4].mean(axis=0)
        out[y, x0:x1 + 1] = left * (1 - t) + right * t
    return np.clip(out, 0, 255).astype("uint8"), (x0, y0, x1, y1, round(peak, 2))


def main():
    pid, slug = sys.argv[1], sys.argv[2]
    brand = sys.argv[3] if len(sys.argv) > 3 else slug.split('-')[0]
    a = np.array(fetch(slug, brand))
    x0, y0, x1, y1 = panels(a)
    a = a[y0:y1, x0:x1]
    a, box = unmark(a)
    # Every GSMArena render carries the mark, so failing to find one means failing to find it -
    # not that it is absent. Either way the photo does not ship.
    if not box:
        raise SystemExit(f'{pid}: SKIPPED - watermark not located; needs a look')
    _, left = unmark(a)
    if left:
        raise SystemExit(f'{pid}: SKIPPED - a mark is still present after erasing (peak {left[4]})')
    # NOT A GUARANTEE. This gate has a false negative: on the Pixel 10a the matcher erased a strip
    # of the wrong phone, the re-search scored the untouched mark at 0.62 - under the threshold -
    # and the file it wrote still carried "www.GSMArena.com" across the coral back. Passing here
    # means "worth looking at", not "clean". Every result still gets an eye over magenta before it
    # is committed; that is what has caught every one of these.
    out = ROOT / 'images' / '_src' / f'{pid}__main.png'
    Image.fromarray(a).save(out)
    print(f'{pid}: {a.shape[1]}x{a.shape[0]}' + (f', watermark erased at {box[:4]} (peak {box[4]})' if box else ', no watermark found'))


if __name__ == '__main__':
    main()
