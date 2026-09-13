# Places an ALREADY-TRANSPARENT source straight into images/cut/, skipping rembg.
#
#   python tools/place-cut.py <product-id> <file.png> [--white|--flood]
#
# Some shops publish the cutout the catalogue wants: 3dplanet serves 1500px RGBA renders, ucom
# serves the Yandex lamp as transparent PNG. Running a matting model over those is worse than
# useless - rembg deleted the Dyson Airwrap's styler wand twice (pale pink AND dark plum, so it
# is not contrast: it reads a long thin object as not-the-subject) and left the kit without the
# product in it.
#
# --white is ONLY for a DARK product on a WHITE backdrop. It has no idea what the object is, so a
# WHITE product (JBL Tune 680NC, Audio-Technica ATH-S220BT) comes out half transparent, and a
# source shot on BLACK (Sony WF-C710N) keeps the whole backdrop as a solid rectangle. Both of
# those want tools/cutout.py and its matting model instead.
#
# --white cuts a product-on-pure-white source by luminance instead, which is what
# the Airwrap needed.
import sys
import numpy as np
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SIDE = 1200          # same canvas cap as tools/cutout.py


def alpha_from_white(a):
    """Distance from white, with a soft ramp so edges stay anti-aliased, then undo the white the
    edge pixels are blended with: C = (observed - (1-a)*white) / a."""
    d = 255.0 - a.min(axis=2)
    al = np.clip((d - 16) / 12.0, 0, 1)          # 16, not 0: these sources carry a drop shadow
    al3 = al[..., None]
    rgb = np.where(al3 > 0.02, (a - (1 - al3) * 255.0) / np.maximum(al3, 0.02), a)
    return np.dstack([np.clip(rgb, 0, 255), al * 255]).astype(np.uint8)


def alpha_by_flood(a, tol=18):
    """Background is whatever is connected to the frame edge and the same colour as it.

    Needed because the other two modes each fail on the Galaxy S26 Ultra press shot: --white
    assumes the product is DARKER than the backdrop and this is a white phone on light grey, so
    it erased the phone; and rembg finds the phone but deletes the S Pen leaning against it,
    because a matting model keeps 'the subject' and the stylus is not it. A flood from the edge
    has no opinion about what the product is, so everything in frame survives.
    """
    from scipy import ndimage
    h, w, _ = a.shape
    corners = np.array([a[0, 0], a[0, w - 1], a[h - 1, 0], a[h - 1, w - 1]], dtype=np.float32)
    bg = corners.mean(axis=0)
    flat = np.abs(a.astype(np.float32) - bg).max(axis=2) <= tol
    lab, _ = ndimage.label(flat)
    edge = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    edge.discard(0)
    outside = np.isin(lab, list(edge))
    al = (~outside).astype(np.float32)
    al = ndimage.binary_closing(al > 0.5, np.ones((3, 3))).astype(np.float32)
    al = ndimage.gaussian_filter(al, 0.7)                 # soften the stair-step edge
    al3 = al[..., None]
    rgb = np.where(al3 > 0.02, (a - (1 - al3) * bg) / np.maximum(al3, 0.02), a)
    return np.dstack([np.clip(rgb, 0, 255), np.clip(al, 0, 1) * 255]).astype(np.uint8)


def main():
    pid, src = sys.argv[1], sys.argv[2]
    im = Image.open(src)
    if '--flood' in sys.argv:
        im = Image.fromarray(alpha_by_flood(np.array(im.convert('RGB')).astype(np.float32)), 'RGBA')
    elif '--white' in sys.argv:
        im = Image.fromarray(alpha_from_white(np.array(im.convert('RGB')).astype(np.float32)), 'RGBA')
    else:
        im = im.convert('RGBA')
    bb = im.split()[3].getbbox()
    if not bb:
        raise SystemExit(f'{pid}: source is fully transparent')
    c = im.crop(bb)
    side = min(SIDE, int(max(c.size) * 1.06))
    if max(c.size) > side * 0.94:
        c.thumbnail((int(side * 0.94), int(side * 0.94)), Image.LANCZOS)
    out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    out.alpha_composite(c, ((side - c.width) // 2, (side - c.height) // 2))
    dst = ROOT / 'images' / 'cut' / f'{pid}__main.webp'
    out.save(dst, 'WEBP', quality=90)
    print(f'{pid}: {out.size[0]}x{out.size[1]}  (ink {bb[2]-bb[0]}x{bb[3]-bb[1]}) -> {dst.name}')


if __name__ == '__main__':
    main()
