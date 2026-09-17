# The picture a chat app shows when somebody shares a product link.
#
#   python tools/social.py
#
# Two reasons this is not just the cutout. The cutouts are transparent, and a chat app composites
# them onto whatever its own theme happens to be - a black phone on Telegram's dark background is
# a black rectangle. And several scrapers still refuse WebP, so a link with a .webp og:image gets
# no preview at all. A JPEG on the catalogue's own cream, at the 1.91:1 every card reader wants.
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CUT = ROOT / 'images' / 'cut'
OUT = ROOT / 'images' / 'social'
W, H = 1200, 630
BG = (247, 243, 236)          # --bg, the catalogue's own light ground
PAD = 60                      # the product never touches the edge of the card

OUT.mkdir(parents=True, exist_ok=True)
phones = json.loads((ROOT / 'data' / 'phones.json').read_text(encoding='utf8'))
coming = json.loads((ROOT / 'data' / 'coming.json').read_text(encoding='utf8')).get('items', [])

made = skipped = missing = 0
for p in phones + coming:
    src = CUT / f"{p['id']}__main.webp"
    dest = OUT / f"{p['id']}.jpg"
    if not src.exists():
        missing += 1
        continue
    if dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime:
        skipped += 1
        continue
    im = Image.open(src).convert('RGBA')
    im.thumbnail((W - PAD * 2, H - PAD * 2), Image.LANCZOS)
    card = Image.new('RGB', (W, H), BG)
    # the alpha channel is the mask, so the transparent ground becomes the cream and not black
    card.paste(im, ((W - im.width) // 2, (H - im.height) // 2), im)
    card.save(dest, 'JPEG', quality=82, optimize=True, progressive=True)
    made += 1

kb = sum(f.stat().st_size for f in OUT.glob('*.jpg')) / 1024
print(f'{made} written, {skipped} already current, {missing} with no cutout')
print(f'{kb / 1024:.1f} MB of share cards, {kb / max(1, len(list(OUT.glob("*.jpg")))):.0f} KB each')
