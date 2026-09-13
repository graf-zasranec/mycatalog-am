# Pulls a product photo from an Armenian shop's own product page.
#
#   python tools/shop-shot.py <product-id> <search terms...> [--shop zigzag|vega]
#
# The shop shows a thumbnail; each entry below says how to turn that into the original.
# zigzag is Magento (a /cache/<hash>/ segment to drop), vega is OpenCart (a cache/webp prefix
# and a -570x570 suffix, original always .jpg).
#
# Matching is the hard part, and every guard here was earned by a wrong answer this tool gave:
#   brand        a Xiaomi air fryer "Essential 6L" matched the JBL PartyBox Encore Essential
#   digit token  ATH-S220BT matched ATH-M20xBT, scoring 0.92
#   roman        Marshall Major IV matched Major V, which the catalogue already carries
#   tier word    Galaxy Tab S10 Ultra matched the Tab S10 FE - neither has a digit
#   product name Harman Kardon Luna matched the Fly BT, and "kardon" is the brand, not the name
# The fuzzy ratio is only a tie-breaker between whatever survives all of that.
import difflib
import io
import re
import sys
from pathlib import Path

from PIL import Image
from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
OG = re.compile(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"')
SKIP = ('catalogsearch', 'customer', 'checkout', 'contact', 'about', 'search', 'promo', 'gift')
ROMAN = ['ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']
TIERS = ['ultra', 'promax', 'pro', 'max', 'plus', 'mini', 'lite', 'fe', 'air']


def zigzag_orig(u):
    return re.sub(r'/cache/[0-9a-f]+/', '/', u)


def vega_orig(u):
    u = u.replace('/image/cache/webp/', '/image/').replace('/image/cache/', '/image/')
    u = re.sub(r'-\d+x\d+(?=\.[a-z]+$)', '', u)
    return u.rsplit('.', 1)[0] + '.jpg'


SHOPS = {
    'zigzag': dict(search='https://www.zigzag.am/catalogsearch/result/?q={q}',
                   link=re.compile(r'zigzag\.am/(?:am|en|ru)/([a-z0-9\-]+)\.html'),
                   page='https://www.zigzag.am/am/{slug}.html', orig=zigzag_orig),
    'vega': dict(search='https://vega.am/search/?search={q}',
                 link=re.compile(r'(https://vega\.am/[a-z0-9\-/]+\.html)'),
                 page=None, orig=vega_orig),
}


def get(url):
    p = Fetcher.get(url, impersonate='chrome', timeout=40)
    return p.html_content if p.status == 200 else ''


def pick(slugs, terms, pid):
    """Narrow to the one product asked for, or return None and say what is missing."""
    key = re.sub(r'[^a-z0-9]+', ' ', terms.lower()).strip()
    toks = key.split()
    flat = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())

    slugs = [s for s in slugs if toks[0] in flat(s)]
    if not slugs:
        return None, f'nothing there is a {toks[0]}'

    models = [t for t in toks if any(c.isdigit() for c in t)]
    want_tier = next((t for t in TIERS if t in key.replace(' ', '')), None)
    if want_tier:
        models.append(want_tier)
    slugs = [s for s in slugs if all(m in flat(s) for m in models)]
    if not slugs:
        return None, f'nothing there carries {models}'

    want_roman = next((t for t in toks if t in ROMAN), None)
    if want_roman:
        slugs = [s for s in slugs if next((w for w in s.split('-') if w in ROMAN), None) == want_roman]
        if not slugs:
            return None, f'nothing there is the {want_roman.upper()}'

    words = [t for t in toks[1:] if len(t) >= 4 and not any(c.isdigit() for c in t)]
    if words:
        name = words[-1]                       # the LAST long word names the product
        slugs = [s for s in slugs if name in flat(s)]
        if not slugs:
            return None, f'nothing there is named "{name}"'

    best = max(slugs, key=lambda s: difflib.SequenceMatcher(None, key, s.replace('-', ' ')).ratio())
    score = difflib.SequenceMatcher(None, key, best.replace('-', ' ')).ratio()
    if score < 0.45:
        return None, f'best match "{best}" scores {score:.2f} - too loose'
    return (best, score), None


def main():
    argv = sys.argv[1:]
    shop = 'zigzag'
    if '--shop' in argv:
        i = argv.index('--shop')
        shop = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    cfg = SHOPS[shop]
    pid, terms = argv[0], ' '.join(argv[1:])

    html = get(cfg['search'].format(q=terms.replace(' ', '+')))
    found = [s for s in dict.fromkeys(cfg['link'].findall(html)) if not any(k in s for k in SKIP)]
    if not found:
        print(f'{pid}: no {shop} result for "{terms}"'); return

    keyed = {(f.rsplit('/', 1)[-1][:-5] if f.startswith('http') else f): f for f in found}
    hit, why = pick(list(keyed), terms, pid)
    if not hit:
        print(f'{pid}: {why} ({shop})'); return
    slug, score = hit

    target = keyed[slug] if keyed[slug].startswith('http') else cfg['page'].format(slug=slug)
    m = OG.search(get(target))
    if not m:
        print(f'{pid}: {slug} has no og:image'); return
    url = cfg['orig'](m.group(1))
    r = Fetcher.get(url, impersonate='chrome', timeout=40)
    body = r.body if isinstance(r.body, (bytes, bytearray)) else b''
    try:
        im = Image.open(io.BytesIO(body))
    except Exception:
        r = Fetcher.get(m.group(1), impersonate='chrome', timeout=40)   # fall back to the thumbnail
        body = r.body if isinstance(r.body, (bytes, bytearray)) else b''
        im = Image.open(io.BytesIO(body))
    out = ROOT / 'images' / '_src' / f'{pid}__main.png'
    im.convert('RGB').save(out)
    print(f'{pid}: {im.size[0]}x{im.size[1]} from {slug} ({shop}, match {score:.2f}) -> {out.name}')


if __name__ == '__main__':
    main()
