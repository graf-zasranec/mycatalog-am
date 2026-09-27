"""Find cut-out photos that show more than one device (two colours side by side, a 14"+16" pair).

A clean packshot is one blob in the alpha mask; a composite is two or more big ones. Phones and
watches also get an aspect check: a single phone is taller than wide, two side by side are not.
    python tools/multi-device.py            -> prints suspects, writes .unlazy/multi-device.txt
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

CUT = 'images/cut'
P = {p['id']: p for p in json.load(open('data/phones.json', encoding='utf-8'))}
out = []
for f in sorted(os.listdir(CUT)):
    if not f.endswith('.webp') or '__' not in f:
        continue
    pid = f.split('__')[0]
    cat = P.get(pid, {}).get('category')
    if not cat:
        continue
    a = np.asarray(Image.open(os.path.join(CUT, f)).convert('RGBA').resize((256, 256)))[..., 3] > 40
    lab, n = ndimage.label(ndimage.binary_opening(a, iterations=2))
    sizes = sorted(np.bincount(lab.ravel())[1:], reverse=True) if n else []
    big = [s for s in sizes if sizes and s >= 0.25 * sizes[0] and s > 300]
    ys, xs = np.nonzero(a)
    aspect = (np.ptp(xs) + 1) / (np.ptp(ys) + 1) if len(xs) else 0
    why = []
    if len(big) >= 2:
        why.append(f'{len(big)} blobs')
    if cat == 'phone' and aspect > 0.85:
        why.append(f'phone {aspect:.2f} wide')
    if why:
        out.append(f'{f}\t{cat}\t{", ".join(why)}')
open('.unlazy/multi-device.txt', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(len(out), 'suspects')
print('\n'.join(out[:80]))
