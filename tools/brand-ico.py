# Packs the favicon PNGs tools/brand-png.mjs rendered into brand/icon/favicon.ico (16, 32, 48).
from pathlib import Path
from PIL import Image

B = Path(__file__).resolve().parent.parent / 'brand'
ims = [Image.open(B / f'png/icon/favicon-{s}.png') for s in (16, 32, 48)]
ims[2].save(B / 'icon/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=ims[:2])
print('wrote icon/favicon.ico')
