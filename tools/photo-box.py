# Where the product sits inside its square cutout: [top, bottom] in thousandths of the canvas,
# taken over every colour of it so any colour's photo fits the same box.
#
# A cutout is a square with the product centred: 4% of air above a phone, a fifth of the canvas
# above a laptop or a TV. The product page draws the box this tight instead of the whole square,
# so the top of the product is level with the first option beside it (owner, 2026-09-26: "pic
# and text should be same level"). Re-run after tools/cutout.py, then node build.mjs.
#
#   python tools/photo-box.py
import glob
import json
import os

from PIL import Image

out = {}
for f in sorted(glob.glob('images/cut/*.webp')):
    pid = os.path.basename(f).split('__')[0]
    im = Image.open(f)
    if im.mode != 'RGBA':
        continue
    bb = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    if not bb:
        continue
    t, b = bb[1] * 1000 // im.height, -(-bb[3] * 1000 // im.height)
    had = out.get(pid)
    out[pid] = [min(had[0], t), max(had[1], b)] if had else [t, b]

with open('data/photo-box.json', 'w') as fh:
    json.dump(out, fh, separators=(',', ':'), sort_keys=True)
print(len(out), 'products')
