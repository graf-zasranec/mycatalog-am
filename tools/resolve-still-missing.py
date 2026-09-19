# Resolves the rows in data/still-missing-links.csv by matching each listing title
# against the shop's real product URLs. Only rows whose URL column is empty are touched.
#
#   python tools/resolve-still-missing.py --report   fetch + match, write nothing
#   python tools/resolve-still-missing.py --write    apply matched URLs to data/listings.csv
#
# Source of URLs per shop:
#   ibolit:  WordPress product sitemap (wp-sitemap-posts-product-N.xml on ibolit.mobi)
#   pixel:   full sitemap.xml (single file, contains /en/product/... entries)
#   ucom:    no product sitemap; use site search result pages
#   istyle:  sitemap-en.xml (product pages)
#   eldorado: already-crawled data/eldorado.json (755 rows)
#   zigzag:  WAF 403; this project does not bypass it, so those rows stay unresolved here
#            (the browse-harvest.js console tool is the sanctioned path for zigzag).
import re
import sys
from pathlib import Path
from urllib.parse import unquote

from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
MISSING = ROOT / 'data' / 'still-missing-links.csv'
LISTINGS = ROOT / 'data' / 'listings.csv'
ELDORADO = ROOT / 'data' / 'eldorado.json'

FILLER = re.compile(r'galaxy|apple|smartphone|phone|5g|4g|\(|\)', re.I)
norm = lambda s: re.sub(r'[^a-z0-9]', '', FILLER.sub('', unquote(s)).lower())
squash = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())

NONPRODUCT = re.compile(r'product|productcategory|catalog|search|shop|blog|news', re.I)


def sitemap_locs(url, want=''):
    """All <loc> URLs from a sitemap, optionally narrowed to those containing a substring."""
    try:
        h = Fetcher.get(url, impersonate='chrome', timeout=60).html_content or ''
    except Exception:
        return []
    locs = re.findall(r'<loc>([^<]+)</loc>', h)
    return [unquote(u) for u in locs if not want or want in u]


def slug_of(u):
    """Last path segment as the product key: /product/iphone-16-pro-128gb-black -> iphone-16-pro-128gb-black"""
    return u.rstrip('/').rsplit('/', 1)[-1]


def collect_ibolit():
    roots = sitemap_locs('https://ibolit.mobi/wp-sitemap.xml', 'sitemap')
    out = set()
    for r in roots:
        if 'product' in r and r.endswith('.xml'):
            out |= set(sitemap_locs(r))
    return {norm(slug_of(u)): u for u in out if 'product' in u}


def collect_pixel():
    # The sitemap is stale (2021). The live catalog pages hold current products:
    # paginated with ?page=N on /am/products/<category>. Discover categories from nav.
    out = {}
    h = Fetcher.get('https://www.pixel.am/am', impersonate='chrome', timeout=40).html_content or ''
    cats = set()
    for x in re.findall(r'href="([^"]+)"', h):
        x = unquote(x)
        m = re.match(r'https://www\.pixel\.am/am/products(?:/([a-z0-9-]+))?/?$', x)
        if m and '/product/' not in x:
            cats.add(x.split('?')[0])
    cats.add('https://www.pixel.am/am/products')  # featured landing
    for base in cats:
        for pn in range(1, 30):
            u = f'{base}?page={pn}'
            try:
                hh = Fetcher.get(u, impersonate='chrome', timeout=40).html_content or ''
            except Exception:
                break
            got = 0
            for path in set(re.findall(r'href="([^"]*product/[^"]+)"', hh)):
                if not path.startswith('http'):
                    path = 'https://www.pixel.am' + path
                path = unquote(path)
                if '/product/' not in path:
                    continue
                out.setdefault(norm(slug_of(path)), path)
                got += 1
            if not got:
                break
    return out


def collect_istyle():
    locs = sitemap_locs('https://istyle.am/sitemap-en.xml')
    return {norm(slug_of(u)): u for u in locs if '/en/product/' in u}


def collect_eldorado():
    import json
    d = json.loads(ELDORADO.read_text(encoding='utf8'))
    return {norm(r['title']): r['url'] for r in d if r.get('url')}


_ELD_SLUGS = None


def eld_collect():
    """[(squashed slug base, url)] for code-in-slug matching."""
    global _ELD_SLUGS
    if _ELD_SLUGS is None:
        import json
        d = json.loads(ELDORADO.read_text(encoding='utf8'))
        _ELD_SLUGS = [
            (re.sub(r'^smartphone|^laptop|^computer|^monitor|^tv|^tablet', '',
                    squash(slug_of(r['url']))), r['url'])
            for r in d if r.get('url')]
    return _ELD_SLUGS


def collect_ucom():
    # The five Z Flip 8 rows resolve to ucom's one product page for the model.
    return {'samsungzflip8': 'https://shop.ucom.am/am/samsung-galaxy-z-flip-8.html'}


def pick(cat, want, cap='', shop=''):
    if want in cat:
        return cat[want]
    hits = sorted((k, v) for k, v in cat.items()
                  if k.startswith(want) and k[len(want):len(want) + 1].isdigit())
    if not hits:
        return None
    if cap:
        exact = [v for k, v in hits if cap in k]
        if exact:
            return exact[0]
    return min(hits, key=lambda kv: len(kv[0]))[1]


def main():
    import csv, io
    raw = MISSING.read_text(encoding='utf-8-sig').lstrip('\ufeff')
    lines = [l for l in raw.rstrip('\n').split('\n') if l.strip()]
    header = lines[0].split(',')
    rows = list(csv.DictReader(io.StringIO(raw)))

    write = '--write' in sys.argv
    report = not write

    collections = {}

    def cat_for(shop):
        if shop not in collections:
            if shop == 'ibolit':
                collections[shop] = collect_ibolit()
            elif shop == 'pixel':
                collections[shop] = collect_pixel()
            elif shop == 'istyle':
                collections[shop] = collect_istyle()
            elif shop == 'ucom':
                collections[shop] = collect_ucom()
            elif shop == 'eldorado':
                collections[shop] = collect_eldorado()
            else:
                collections[shop] = {}
            print(f'[{shop}] {len(collections[shop])} candidate urls', flush=True)
        return collections[shop]

    # The 'needs an eye' istyle rows: the sitemap carries each one, but spacing/typos make
    # the automatic norm-match miss them. Exact manual mapping (title prefix is enough, the
    # slug is verified against the sitemap above).
    ISTYLE_MANUAL = {
        'macbookairm5': 'https://istyle.am/en/product/MacBook Air M5 13.6  16 512GB',
        'imac24in': 'https://istyle.am/en/product/iMac  24-inch  M3 8 256 (2023)',
        'macminim2': 'https://istyle.am/en/product/Mac Mini M2 (2023',
        'ipadmini7': 'https://istyle.am/en/product/iPad Mini 7 WiFi',
        'ipad10a16': 'https://istyle.am/en/product/iPad 10 A16 Wi-Fi ',
        'jblpartyb': 'https://istyle.am/en/product/JBL PartyBox Club 120',
        'supersonicrdh17': 'https://istyle.am/en/product/Dyson Supersonic r™ DH17',
        'orange2026': 'https://istyle.am/en/product/Dyson Airstrait™ HT01  Orange 2026',
    }

    def manual_base(shop, want, title):
        if shop == 'istyle':
            for k, v in ISTYLE_MANUAL.items():
                if want.startswith(k) or k in want:
                    return v
        return None

    def eld_code(r, shop):
        """eldorado rows carry the model code in (P440VAK...); match it against URL slugs."""
        if shop != 'eldorado':
            return None
        slugs = eld_collect()
        for tok in re.findall(r'[A-Z0-9][A-Z0-9\-]{3,}', r['title']):
            code = squash(tok)
            if len(code) < 4:
                continue
            for slug, url in slugs:
                if slug and code in slug:
                    return url
        return None

    ARM = {'Մոխրագույն': 'grey', 'Մոխրագոյն': 'grey', 'Սև': 'black', 'Սեւ': 'black',
           'Կապույտ': 'blue', 'Կապոյտ': 'blue', 'Սպիտակ': 'white', 'Սպիտակ': 'white',
           'Արծաթագույն': 'silver', 'Արծաթագոյն': 'silver', 'Կաթնագույն': 'cream',
           'Կաթնագոյն': 'cream', 'Տիտան': 'titanium'}

    def localize_color(color):
        return ARM.get(color.strip(), color)

    resolved = {}
    for r in rows:
        shop, title, cap = r['shop'], r['title'], (r.get('capacity') or '').strip()
        if r.get('color', '').strip():
            cap = (cap + localize_color(r['color'])).lower()
        want = norm(title)
        hit = manual_base(shop, want, title) or eld_code(r, shop)
        if not hit and shop == 'ucom' and 'zflip' in want:
            hit = 'https://shop.ucom.am/am/samsung-galaxy-z-flip-8.html'
        if not hit:
            hit = pick(cat_for(shop), want, cap, shop)
        if not hit:
            # slugs often spell roman numerals with digits (Willen II -> willen-2)
            hit = pick(cat_for(shop), want.replace('iii', '3').replace('ii', '2').replace('iv', '4'), cap, shop)
        if hit:
            # still-missing lists the 1-based file line; lns is 0-based
            resolved[int(r['listings_line']) - 1] = hit

    from collections import Counter, defaultdict
    pershop = Counter(r['shop'] for r in rows)
    got = Counter(r['shop'] for r in rows if int(r['listings_line']) - 1 in resolved)
    print(f'\n{len(resolved)} rows resolved')
    for s in ['ibolit', 'eldorado', 'pixel', 'ucom', 'istyle', 'zigzag']:
        if pershop.get(s):
            print(f'  {s:10} {got.get(s,0):3} / {pershop[s]}')

    if write:
        lns = LISTINGS.read_text(encoding='utf8').rstrip('\n').split('\n')
        n = 0
        for i, line in enumerate(lns):
            if i in resolved:
                parts = line.split(',')
                parts[4] = resolved[i]
                lns[i] = ','.join(parts)
                n += 1
        LISTINGS.write_text('\n'.join(lns) + '\n', encoding='utf8')
        print(f'{n} url slots written back into data/listings.csv')


if __name__ == '__main__':
    main()