# Downloads the per-colour photo a shop already serves for an offer, at the biggest size
# that shop will hand over.
#
#   node -e "..."  writes .harvest.json    then    python tools/harvest-colors.py
#
# Every shop publishes a thumbnail and keeps the original one URL transform away, and the
# transform differs per shop. Rather than a table that goes stale, each rule is tried against
# every URL and the biggest image that actually decodes wins - a rule that does not apply
# simply returns the URL unchanged and loses on size.
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image
from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'images' / '_src'
MIN = 600                     # the catalogue's floor; below it we would rather show nothing

RULES = [
    lambda u: u,
    lambda u: re.sub(r'/cache/[0-9a-f]{16,}/', '/', u),                 # Magento: allsell, eldorado, zigzag
    lambda u: re.sub(r'/img/prodpic/small/', '/img/prodpic/', u),       # mobilecentre
    lambda u: re.sub(r'/(\d{3})_(?=[^/]+$)', '/', u),                   # storech/pixel: a 300_ or 800_ prefix
    lambda u: re.sub(r'-\d+x\d+(?=\.[a-z]+$)', '', u.replace('/image/cache/webp/', '/image/').replace('/image/cache/', '/image/')),
    lambda u: re.sub(r'-\d+x\d+(?=\.[a-z]+$)', '-1500x1500', u),        # OpenCart pre-generated sizes
    lambda u: re.sub(r'-\d+x\d+(?=\.[a-z]+$)', '-800x800', u),
    lambda u: re.sub(r'-\d{2,4}x\d{2,4}(?=\.[a-z]+$)', '', u),          # WordPress: ibolit
]


def biggest(url):
    """Fetch every variant of this URL and return the largest image that decodes."""
    best = None
    for rule in RULES:
        try:
            u = rule(url)
        except Exception:
            continue
        if best and u == best[2]:
            continue
        try:
            r = Fetcher.get(u, impersonate='chrome', timeout=30)
            im = Image.open(io.BytesIO(r.body))
            im.load()
        except Exception:
            continue
        if not best or min(im.size) > min(best[0].size):
            best = (im, min(im.size), u)
    return best


def main():
    rows = json.loads((ROOT / '.harvest.json').read_text(encoding='utf8'))
    only = sys.argv[1:]
    slug = lambda s: re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', str(s).lower()))
    got = small = miss = 0
    for pid, color, shop, url in rows:
        if only and pid not in only:
            continue
        dest = OUT / f'{pid}__{slug(color)}.png'
        if dest.exists():
            continue
        b = biggest(url)
        if not b:
            miss += 1
            print(f'{pid} {color:22} {shop:12} nothing fetched')
            continue
        im, edge, u = b
        if edge < MIN:
            small += 1
            print(f'{pid} {color:22} {shop:12} {im.size[0]}x{im.size[1]} under {MIN}px - skipped')
            continue
        im.convert('RGB').save(dest)
        got += 1
        print(f'{pid} {color:22} {shop:12} {im.size[0]}x{im.size[1]} -> {dest.name}', flush=True)
    print(f'\n{got} downloaded, {small} too small, {miss} unreachable')


if __name__ == '__main__':
    main()
