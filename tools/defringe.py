# Halo fix: half-transparent edge pixels still carry the studio white. Give each one the colour of
# the nearest solid product pixel a little inside the edge, so the rim reads as product on a dark page.
# Alpha is untouched, so the shape and the anti-aliasing stay as cut.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

def defringe(src, dst):
    a = np.array(Image.open(src).convert('RGBA'))
    al = a[..., 3]
    core = ndimage.binary_erosion(al >= 230, iterations=2)
    if core.sum() < 500:
        return False
    rim = (al > 0) & ~core & ndimage.binary_dilation(al < 230, iterations=2)
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    a[..., :3][rim] = a[..., :3][iy[rim], ix[rim]]
    Image.fromarray(a).save(dst, 'WEBP', quality=94, method=6)
    return True

if __name__ == '__main__':
    for f in sys.argv[1:]:
        print(f, defringe(f, f))
