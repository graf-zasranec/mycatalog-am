# Makes the small copy of every main product shot, for the places that show one small.
#
#   python tools/thumbs.py            new or newer photos
#   python tools/thumbs.py --check    also any thumbnail that no longer matches its photo
#
# A card on a phone draws the photo into a box about 155 px wide and was being handed the same
# 1200 px cutout the product page uses: 829 KB of images to fill thirteen thumbnails. 600 px is
# the catalogue's floor, so a copy at 600 is the smallest one that can never be the reason a
# picture looks soft - and it is a quarter of the weight.
#
# Every cut shot is copied, not only __main: a card cycles through a product's colours, and
# those were arriving at full size into the same 123 px box.
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'images' / 'cut'
OUT = ROOT / 'images' / 'thumb'
EDGE = 600

# --check: a file's date is not proof it is current. A checkout gives every file the same date,
# so a thumbnail cut from an OLD photo looked newer than the photo that replaced it - the iPhone 18
# Pro's Burgundy and Glacier cards were showing the Silver shot. This compares the pictures.
CHECK = '--check' in sys.argv

def looks(path):
    im = Image.open(path).convert('RGBA').resize((32, 32))
    return im.tobytes()

def differs(a, b):
    x, y = looks(a), looks(b)
    return sum(abs(p - q) for p, q in zip(x, y)) / len(x) > 3

OUT.mkdir(parents=True, exist_ok=True)
made = skipped = same = 0
for f in sorted(SRC.glob('*.webp')):
    dest = OUT / f.name
    fresh = dest.exists() and dest.stat().st_mtime >= f.stat().st_mtime
    if fresh and not (CHECK and differs(f, dest)):
        skipped += 1
        continue
    im = Image.open(f)
    im.load()
    if max(im.size) <= EDGE:
        # already at or under the floor: a copy would be the same bytes, so the build falls
        # back to the original rather than this directory holding a duplicate
        same += 1
        if dest.exists():
            dest.unlink()
        continue
    im.thumbnail((EDGE, EDGE), Image.LANCZOS)
    im.save(dest, 'WEBP', quality=86, method=6)
    made += 1

src_kb = sum(f.stat().st_size for f in SRC.glob('*.webp')) / 1024
out_kb = sum(f.stat().st_size for f in OUT.glob('*.webp')) / 1024
print(f'{made} written, {skipped} already current, {same} already small enough')
print(f'{src_kb / 1024:.1f} MB of full-size shots -> {out_kb / 1024:.1f} MB of thumbnails')
