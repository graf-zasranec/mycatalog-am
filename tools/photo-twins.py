# Finds main photos that are the same picture on products that are not the same device - a shop's
# "no image" drawing matted as if it were the product (the VivoBook X1504VA-NJ451 showed one), or
# one listing's photo carried onto another model.
#
#   python tools/photo-twins.py
#
# A 16x16 difference hash of each main shot, composited on grey; two shots within 10 bits of
# each other are one picture. Pairs from one model family (the same id up to its last part, e.g.
# the X1504VA configurations, which share a chassis) are expected and left out.
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CUT = ROOT / 'images' / 'cut'

def dhash(p, n=16):
    im = Image.open(p).convert('RGBA')
    bg = Image.new('RGBA', im.size, (128, 128, 128, 255))
    bg.alpha_composite(im)
    g = bg.convert('L').resize((n + 1, n), Image.LANCZOS)
    px = list(g.getdata())
    return sum(1 << i for i in range(n * n) if px[(i // n) * (n + 1) + i % n] > px[(i // n) * (n + 1) + i % n + 1])

def family(pid):
    parts = pid.split('-')
    return '-'.join(parts[:3])

files = sorted(CUT.glob('*__main.webp'))
hashes = []
for f in files:
    try:
        hashes.append((f.name.split('__')[0], dhash(f)))
    except Exception as e:
        print(f'  ! {f.name}: {e}', file=sys.stderr)
pairs = []
for i in range(len(hashes)):
    a, ha = hashes[i]
    for j in range(i + 1, len(hashes)):
        b, hb = hashes[j]
        if family(a) == family(b):
            continue
        d = bin(ha ^ hb).count('1')
        if d <= 10:
            pairs.append((d, a, b))
for d, a, b in sorted(pairs):
    print(f'{d:3}  {a}  {b}')
print(f'{len(hashes)} main photos, {len(pairs)} cross-model twin(s)')
