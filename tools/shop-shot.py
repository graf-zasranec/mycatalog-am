# Pulls a product photo from an Armenian shop's own product page.
#
#   python tools/shop-shot.py <product-id> <search terms...>
#
# zigzag is Magento: og:image points at the real product shot (the page itself carries 25 more
# for related items), and dropping the /cache/<hash>/ segment returns the 1200px original.
# Searching rather than guessing slugs, because shop slugs are unguessable
# ("b-w-px8-flagship-headphone-black.html").
import io, re, sys, difflib
from pathlib import Path
from scrapling.fetchers import Fetcher
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OG = re.compile(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"')
LINK = re.compile(r'zigzag\.am/(?:am|en|ru)/([a-z0-9\-]+)\.html')
SKIP = ('catalogsearch', 'customer', 'checkout', 'contact', 'about')


def get(url):
    p = Fetcher.get(url, impersonate='chrome', timeout=40)
    return p.html_content if p.status == 200 else ''


def main():
    pid, terms = sys.argv[1], ' '.join(sys.argv[2:])
    html = get('https://www.zigzag.am/catalogsearch/result/?q=' + terms.replace(' ', '+'))
    slugs = [s for s in dict.fromkeys(LINK.findall(html)) if not any(k in s for k in SKIP)]
    if not slugs:
        print(f'{pid}: no zigzag result for "{terms}"'); return
    key = re.sub(r'[^a-z0-9]+', ' ', terms.lower()).strip()
    # Fuzzy ratio alone is not safe on model numbers: "audio technica ath s220bt" scored 0.92
    # against ath-m20xbt, a different pair of headphones. Any query token carrying a digit is
    # the model, and it has to be present in the slug verbatim.
    models = [t for t in key.split() if any(c.isdigit() for c in t)]
    slugs = [s for s in slugs if all(m in s.replace('-', '') for m in models)]
    if not slugs:
        print(f'{pid}: nothing on zigzag carries {models or terms!r}'); return
    # The brand has to be there too. Without it a 0.43 ratio put a Xiaomi AIR FRYER on the JBL
    # PartyBox, a Galaxy Fit band on the Buds FE and a category page on the Nothing Ear - every
    # one of which would have shipped as a confident-looking photo of the wrong thing.
    brand = key.split()[0]
    slugs = [s for s in slugs if brand in s.replace('-', '')]
    if not slugs:
        print(f'{pid}: nothing on zigzag is a {brand}'); return
    best = max(slugs, key=lambda s: difflib.SequenceMatcher(None, key, s.replace('-', ' ')).ratio())
    score = difflib.SequenceMatcher(None, key, best.replace('-', ' ')).ratio()
    # 0.62, not 0.42: below that the survivors were still the wrong model from the right brand
    # (Kilburn III for II, Major V for IV, Fly BT for Luna).
    if score < 0.62:
        print(f'{pid}: best zigzag match "{best}" scores {score:.2f} - too loose, skipped'); return
    m = OG.search(get(f'https://www.zigzag.am/am/{best}.html'))
    if not m:
        print(f'{pid}: {best} has no og:image'); return
    url = re.sub(r'/cache/[0-9a-f]+/', '/', m.group(1))            # Magento original
    r = Fetcher.get(url, impersonate='chrome', timeout=40)
    b = r.body if isinstance(r.body, (bytes, bytearray)) else b''
    im = Image.open(io.BytesIO(b))
    out = ROOT / 'images' / '_src' / f'{pid}__main.png'
    im.convert('RGB').save(out)
    print(f'{pid}: {im.size[0]}x{im.size[1]} from {best} (match {score:.2f}) -> {out.name}')


if __name__ == '__main__':
    main()
