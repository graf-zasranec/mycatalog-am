# Turns a shop export into draft catalogue entries, using the shop's own product pages as the
# source for every spec.
#
#   python tools/shelf.py <rows.json> <category> [--limit N]
#
# rows.json is a flattened Web Scraper export: [{name, price, cat}]. The export gives a name and
# a price and nothing else, so each row is joined to REDstore's sitemap by slug and the product
# page is read for the rest: CPU, screen, RAM, storage, year, weight, battery, and the image.
#
# Nothing is invented. A field the shop does not publish is absent, and the entry says so.
import io, json, os, re, sys, time
os.chdir(r'C:\Users\hastv\Videos\MyCatalog')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from scrapling.fetchers import Fetcher

SCRATCH = os.environ.get('SHELF_OUT', '.shelf')
SITEMAP_CACHE = '.redstore-urls.json'
ATTR = re.compile(r'\{\\?"attribute\\?":\{\\?"id\\?":\d+,\\?"name\\?":\\?"(.*?)\\?"\},'
                  r'\\?"values\\?":\[\{\\?"id\\?":\d+,\\?"value\\?":\\?"(.*?)\\?"')
LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
norm = lambda s: re.sub(r'[^a-z0-9]+', '', str(s).lower())


def get(u, tries=3):
    for i in range(tries):
        try:
            return Fetcher.get(u, impersonate='chrome', timeout=30).html_content or ''
        except Exception:
            if i == tries - 1:
                return ''
            time.sleep(2)


def sitemap_urls():
    if os.path.exists(SITEMAP_CACHE):
        return json.load(io.open(SITEMAP_CACHE, encoding='utf-8'))
    idx = get('https://redstore.am/sitemap.xml')
    urls = []
    for m in re.findall(r'<loc>(https://redstore\.am/sitemaps/products/\d+\.xml)</loc>', idx):
        urls += re.findall(r'<loc>(https://redstore\.am/en/product/[^<]+)</loc>', get(m))
        time.sleep(0.25)
    json.dump(urls, io.open(SITEMAP_CACHE, 'w', encoding='utf-8'))
    return urls


def product(u):
    h = get(u)
    if not h:
        return None
    prod = None
    for blob in LD.findall(h):
        try:
            j = json.loads(blob)
        except Exception:
            continue
        for x in (j if isinstance(j, list) else [j]):
            if isinstance(x, dict) and x.get('@type') == 'Product':
                prod = x
    if not prod:
        return None
    offer = prod.get('offers')
    offer = offer[0] if isinstance(offer, list) else (offer or {})
    img = prod.get('image')
    attrs = {}
    for k, v in ATTR.findall(h):
        attrs.setdefault(k, v)
    return {'url': u, 'name': prod.get('name'), 'sku': prod.get('sku'),
            'price': int(float(offer.get('price') or 0)),
            'inStock': 'InStock' in str(offer.get('availability') or ''),
            'image': (img[0] if isinstance(img, list) else img), 'attrs': attrs}


def main():
    rows = json.load(io.open(sys.argv[1], encoding='utf-8'))
    want = sys.argv[2]
    rows = [r for r in rows if r['cat'] == want]
    limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else len(rows)

    urls = sitemap_urls()
    by_slug = {norm(u.rsplit('/', 1)[-1]): u for u in urls}
    print('%d row(s) in %s; %d product urls in the sitemap' % (len(rows), want, len(urls)))

    out, missing = [], []
    for i, r in enumerate(rows[:limit], 1):
        key = norm(r['name'])
        u = by_slug.get(key)
        if not u:                       # the slug usually carries the brand the title omits
            cand = [s for s in by_slug if key and (key in s or s.endswith(key))]
            u = by_slug[min(cand, key=len)] if cand else None
        if not u:
            missing.append(r['name']); continue
        p = product(u)
        if not p:
            missing.append(r['name'] + '  (page unreadable)'); continue
        p['export_price'] = r['price']
        out.append(p)
        print('  %3d/%d  %-8s %s' % (i, min(limit, len(rows)), p['price'], p['name'][:62]), flush=True)
        time.sleep(0.3)

    json.dump(out, io.open(SCRATCH + '-' + want + '.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('\n%d read, %d without a page' % (len(out), len(missing)))
    for m in missing[:20]:
        print('   no url:', m)


if __name__ == '__main__':
    main()
