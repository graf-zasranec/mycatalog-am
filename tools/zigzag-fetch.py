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
from pathlib import Path

from scrapling.fetchers import Fetcher

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
MAIN = re.compile(r'product-info-main(.*?)(?:</section>|<footer)', re.S | re.I)
FINAL = re.compile(r'data-price-amount="([\d.]+)"\s+data-price-type="finalPrice"', re.I)
TITLE = re.compile(r'<title>\s*(.*?)\s*(?:\s-\sZigzag)?\s*</title>', re.S | re.I)


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
    prices = json.loads((ROOT / 'data' / 'prices.json').read_text(encoding='utf-8'))
    for offers in prices.get('offers', {}).values():
        for o in offers:
            if o.get('shop') == 'zigzag' and str(o.get('url', '')).startswith('http'):
                urls.add(o['url'])
    return urls


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
rows, gone = [], 0
for i, u in enumerate(urls, 1):
    html = get(u)
    time.sleep(DELAY)
    block = MAIN.search(html) if html else None
    price = FINAL.search(block.group(1)) if block else None
    if not price:
        gone += 1
        continue
    title = TITLE.search(html)
    rows.append({
        'url': u,
        'title': re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', title.group(1))).strip() if title else '',
        'price': round(float(price.group(1))),
        # Magento prints this on a page you cannot buy from
        'inStock': 'out-of-stock' not in html.lower(),
    })
    if i % 25 == 0:
        print(f'  {i}/{len(urls)}', flush=True)

OUT.write_text(json.dumps(rows, ensure_ascii=False), encoding='utf-8')
print(f'done: {len(rows)} priced, {gone} with no price -> {OUT.relative_to(ROOT)}')
