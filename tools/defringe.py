# Removes the white halo a cutout keeps along its edge.
#
#   python tools/defringe.py FILE...          fix these files in images/cut/ (names or paths)
#   python tools/defringe.py --halo           fix every cutout imgcheck.py reports a halo on
#   python tools/defringe.py --list F.txt     fix the cutouts named in a file, one per line
#
# A product cut from a white studio shot keeps, in its half-transparent edge pixels, some of the
# white it was blended with. On the light page that is invisible; on the dark theme it draws a
# thin white outline round a black watch or a pair of headphones. The fix is the usual colour
# decontamination: every edge pixel takes the colour of the nearest solid pixel of the product,
# and keeps its own transparency - so the outline is exactly as soft as before, only the colour of
# the backdrop is gone. Nothing is moved, grown or shrunk.
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
CUT = ROOT / 'images' / 'cut'


def defringe(path: Path) -> None:
    a = np.array(Image.open(path).convert('RGBA'))
    al = a[..., 3]
    solid = al >= 250
    if not solid.any():
        return
    # for every pixel, the coordinates of the nearest solid one
    _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    edge = (al > 0) & ~solid
    a[..., :3][edge] = a[iy[edge], ix[edge], :3]
    # fully transparent pixels carry no colour a browser shows, but a resampler blends them in when
    # the picture is scaled down: give them the product's colour too, or the halo comes back small
    clear = al == 0
    a[..., :3][clear] = a[iy[clear], ix[clear], :3]
    # Some shots carry the white INTO the solid edge: a one-pixel rim, fully opaque, much brighter
    # than the product two pixels in. That rim takes the colour from further in. A genuinely bright
    # edge - an iPhone's polished frame - is just as bright two pixels in, so it is left alone.
    inner = ndimage.binary_erosion(solid, iterations=2)
    if inner.any():
        rim = solid & ~ndimage.binary_erosion(solid)
        _, (jy, jx) = ndimage.distance_transform_edt(~inner, return_indices=True)
        lum = lambda px: px[..., 0] * 0.299 + px[..., 1] * 0.587 + px[..., 2] * 0.114
        ref = a[jy, jx, :3].astype(float)
        bright = rim & (lum(a[..., :3].astype(float)) > lum(ref) + 60)
        a[..., :3][bright] = a[jy[bright], jx[bright], :3]
    Image.fromarray(a).save(path, 'WEBP', quality=90, method=6)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    files = [CUT / Path(a).name for a in args]
    if '--list' in sys.argv:
        files = [CUT / l.strip() for l in open(args[0]) if l.strip()]
    if '--halo' in sys.argv:
        sys.path.insert(0, str(ROOT / 'tools'))
        from imgcheck import check
        files += [f for f in sorted(CUT.glob('*.webp')) if any('halo' in b for b in check(f))]
    for f in files:
        defringe(f)
        print('defringed', f.name)
    print(f'{len(files)} file(s)')


if __name__ == '__main__':
    main()
