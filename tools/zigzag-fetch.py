# Reads Zigzag's prices into data/zigzag.json for scrape.mjs to match and price.
#
# Why this is a separate Python step and not another adapter in scrape.mjs: zigzag.am answers 403
# to plain fetch(). Their robots.txt allows product pages - it disallows checkout, Magento's
# internals, and every URL carrying a query string - and names no crawler it refuses. So this uses
# scrapling, which speaks a browser's TLS, at a 3-second delay. Same arrangement as Eldorado.
#
# "Disallow: /*?" is the line that shapes this whole file. Their pagination is ?p=2 and their
# search is ?q=, and both are off limits, so there is no way to walk their catalogue page by page.
# Instead this re-reads the product pages the catalogue already points at, plus whatever the clean
# .html category pages happen to show, and never builds a URL with a question mark in it.
#
# Checked before writing this: a product page returns 200 with its price markup intact and no
# Cloudflare interstitial. The "Just a moment" challenge appears on CATEGORY pages, which is a
# second reason this walks products rather than categories.
#
#   pip install "scrapling[fetchers]"
#   python tools/zigzag-fetch.py
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from scrapling.fetchers import Fetcher
from zigzag_stock import stock_of, price_of

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'zigzag.json'
DELAY = 3

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Clean .html category pages - no query string, so within what robots.txt allows. Each shows only
# its first dozen products, which is all the discovery available without pagination.
CATEGORIES = [
    'phones-and-communication', 'computers-notebooks-tablets', 'tv-audio-video',
    'photo-video', 'games-soft-entertainment',
]

PRODUCT = re.compile(r'https://www\.zigzag\.am/am/[a-z0-9][a-z0-9\-]*\.html')
# The product's OWN price. A Zigzag page carries dozens of data-price-amount values because it
# recommends other products, so scope to the main product block before reading one.
TITLE = re.compile(r'<title>\s*(.*?)\s*(?:\s-\sZigzag)?\s*</title>', re.S | re.I)
OGIMG = re.compile(r'property="og:image"[^>]+content="([^"]+)"', re.I)
UNCACHE = re.compile(r'/cache/[0-9a-f]{32}/')


def get(url):
    if '?' in url:                       # robots.txt: Disallow: /*?
        return ''
    try:
        p = Fetcher.get(url, impersonate='chrome', timeout=40)
        return p.html_content if p.status == 200 else ''
    except Exception as e:
        print(f'  ! {url}: {e}', file=sys.stderr)
        return ''


def known_urls():
    """Every zigzag product page the catalogue already points at."""
    urls = set()
    for line in (ROOT / 'data' / 'listings.csv').read_text(encoding='utf-8').splitlines()[1:]:
        f = line.split(',')
        if len(f) > 4 and f[0] == 'zigzag' and f[4].startswith('http'):
            urls.add(f[4])
    # pages the category crawl cannot reach (pagination needs a query string) - data/zigzag-seed.txt
    # ...and every product page the sitemap names that matches the catalogue (tools/zigzag-sitemap.mjs)
    for name in ('zigzag-seed.txt', 'zigzag-sitemap.txt'):
        seed = ROOT / 'data' / name
        if seed.exists():
            urls |= {l.strip() for l in seed.read_text(encoding='utf-8').splitlines() if l.startswith('http')}
    prices = json.loads((ROOT / 'data' / 'prices.json').read_text(encoding='utf-8'))
    for offers in prices.get('offers', {}).values():
        for o in offers:
            if o.get('shop') == 'zigzag' and str(o.get('url', '')).startswith('http'):
                urls.add(o['url'])
    return urls


def main():
    urls = known_urls()
    print(f'{len(urls)} product page(s) the catalogue already links')
    for cat in CATEGORIES:
        html = get(f'https://www.zigzag.am/am/{cat}.html')
        time.sleep(DELAY)
        found = {u for u in PRODUCT.findall(html) if not u.endswith(f'/{cat}.html')}
        new = found - urls
        urls |= found
        print(f'  {cat}: +{len(new)}')

    urls = sorted(u for u in urls if '?' not in u)
    previous = []
    try:
        previous = json.loads(OUT.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        pass
    canonical = lambda u: re.sub(r'/(?:am|en|ru)/', '/', u, count=1)
    dates = {canonical(o['url']): o.get('seen') for offers in json.loads((ROOT/'data/prices.json').read_text(encoding='utf-8')).get('offers', {}).values() for o in offers if o.get('shop') == 'zigzag'}
    rows = {canonical(r['url']): dict(r, checked=r.get('checked') or dates.get(canonical(r['url']))) for r in previous if r.get('url')}
    gone, checked = 0, 0
    for i, u in enumerate(urls, 1):
        html = get(u)
        time.sleep(DELAY)
        price = price_of(html) if html else None
        if price is None:
            gone += 1
            continue
        stock = stock_of(html)
        if stock is None:
            gone += 1
            continue  # Unknown/blocked markup keeps its old date; never assumed available.
        title = TITLE.search(html)
        # The page is open anyway, and 48 products in this catalogue are sold by zigzag ALONE and have
        # no photograph at all. og:image is the shop's own main shot; the url it gives points at
        # Magento's resized copy under /cache/<32 hex>/, and the original sits beside it without that
        # segment. Taken from the meta tag rather than the page body on purpose - a listing page also
        # carries brand logos and neighbouring products, and one of those became a product photo twice.
        og = OGIMG.search(html)
        rows[canonical(u)] = {
            'url': u,
            'title': re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', title.group(1))).strip() if title else '',
            'price': price,
            # Zigzag uses out_stock / in_stock on its own availability element.
            # Related cards must not override the main product's stock status.
            'inStock': stock,
            'checked': datetime.now(timezone.utc).date().isoformat(),
            'checkedAt': datetime.now(timezone.utc).isoformat(),
            'image': UNCACHE.sub('/', og.group(1)) if og else None,
        }
        checked += 1
        if i % 25 == 0:
            print(f'  {i}/{len(urls)}', flush=True)

    temporary = OUT.with_suffix('.json.tmp')
    temporary.write_bytes((json.dumps(list(rows.values()), ensure_ascii=False) + '\n').encode('utf-8'))
    temporary.replace(OUT)
    print(f'done: {checked} confirmed, {gone} unresolved (previous dates retained), {len(rows)} cached -> {OUT.relative_to(ROOT)}')

if __name__ == '__main__':
    main()
