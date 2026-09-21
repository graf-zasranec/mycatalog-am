# Downloads the product photograph a shop's own listing carries, for the products that have none.
#
#   python tools/shop-photos.py            report only
#   python tools/shop-photos.py --save     write them into images/_src
#
# eldorado.am and zigzag.am answer 403 to any plain fetch, images included, so this goes through
# the same scrapling client their fetchers use - and reads only what those fetchers have already
# written down. 80 of the products with no picture are sold by eldorado alone and 48 by zigzag
# alone; their photographs were sitting on the very cards the price came off.
import json
import os
import re
import sys
from pathlib import Path

from PIL import Image
from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'images' / '_src'
CUT = ROOT / 'images' / 'cut'
FLOOR = 600          # the catalogue's floor; anything under it is not worth matting
save = '--save' in sys.argv

prices = json.loads((ROOT / 'data' / 'prices.json').read_text(encoding='utf-8'))
phones = json.loads((ROOT / 'data' / 'phones.json').read_text(encoding='utf-8'))
tidy = lambda u: (u or '').strip().rstrip('/').lower()

# every shop listing we hold, keyed by the url the offer points at
by_url = {}
for shop, f in (('eldorado', 'data/eldorado.json'), ('zigzag', 'data/zigzag.json')):
    p = ROOT / f
    if not p.exists():
        continue
    for c in json.loads(p.read_text(encoding='utf-8')):
        if c.get('url') and c.get('image'):
            by_url[tidy(c['url'])] = c

want = [p for p in phones if not (CUT / f"{p['id']}__main.webp").exists()
        and not any((SRC).glob(f"{p['id']}__main.*"))]
print(f'{len(want)} product(s) with neither a cutout nor a source; '
      f'{len(by_url)} shop listing(s) carry an image')

done = small = nohit = bad = 0
for p in want:
    hit = None
    for o in prices['offers'].get(p['id'], []):
        c = by_url.get(tidy(o.get('url')))
        if c:
            hit = c
            break
    if not hit:
        nohit += 1
        continue
    try:
        r = Fetcher.get(hit['image'], impersonate='chrome', timeout=40)
        body = getattr(r, 'body', None)
        if r.status != 200 or not isinstance(body, (bytes, bytearray)):
            bad += 1
            print(f"  {p['id']:44} {r.status} on its image")
            continue
        import io as _io
        im = Image.open(_io.BytesIO(bytes(body)))
        w, h = im.size
    except Exception as e:
        bad += 1
        print(f"  {p['id']:44} ! {e}")
        continue
    if max(w, h) < FLOOR:
        small += 1
        print(f"  {p['id']:44} only {w}x{h}")
        continue
    ext = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp'}.get(im.format, '.jpg')
    out = SRC / f"{p['id']}__main{ext}"
    print(f"  {p['id']:44} {w}x{h}  {hit['title'][:40]}")
    if save:
        tmp = out.with_suffix(out.suffix + '.part')
        tmp.write_bytes(bytes(body))
        os.replace(tmp, out)
        done += 1

print(f"\n{done if save else sum(1 for _ in ())} saved, "
      f"{small} under {FLOOR}px, {bad} would not answer, {nohit} not listed by either shop")
