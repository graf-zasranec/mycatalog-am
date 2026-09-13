# Places an ALREADY-TRANSPARENT source straight into images/cut/, skipping rembg.
#
#   python tools/place-cut.py <product-id> <file.png> [--white]
#
# Some shops publish the cutout the catalogue wants: 3dplanet serves 1500px RGBA renders, ucom
# serves the Yandex lamp as transparent PNG. Running a matting model over those is worse than
# useless - rembg deleted the Dyson Airwrap's styler wand twice (pale pink AND dark plum, so it
# is not contrast: it reads a long thin object as not-the-subject) and left the kit without the
# product in it. --white cuts a product-on-pure-white source by luminance instead, which is what
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


def main():
    pid, src = sys.argv[1], sys.argv[2]
    im = Image.open(src)
    if '--white' in sys.argv:
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
