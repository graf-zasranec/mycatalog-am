# Reads Eldorado's category listings into data/eldorado.json for scrape.mjs to match and price.
#
# Why this is a separate Python step and not another adapter in scrape.mjs: eldorado.am sits
# behind a WAF that answers 403 to plain fetch(), including for robots.txt. Their robots.txt,
# read through a browser-grade client, allows product pages - it only disallows checkout, search
# and Magento's internal paths, and names no crawler it refuses. So this uses scrapling, which
# speaks a browser's TLS, and keeps to the 7-second crawl delay their robots asks of Googlebot.
#
#   pip install "scrapling[fetchers]"
#   python tools/eldorado-fetch.py
import json
import re
import sys
import time
from pathlib import Path

from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'eldorado.json'
DELAY = 7            # what their robots.txt asks of Googlebot
# A ceiling, not a target: each category stops the moment a page adds no product it has not
# already seen. Magento clamps an out-of-range page to the last real one, so an overrun page
# repeats and dedupes to nothing, which is the same signal. Six cut every deep aisle short -
# TVs alone run past page 12.
PAGES = 25           # per category; they show 16 a page

CATEGORIES = [
    'phones/tablets-and-smartphones/smartphones',
    'phones/tablets-and-smartphones/tablets',
    'phones/smart-watches',
    # earbuds live under phones, not under audio-video: a Redmi Buds is filed with the phone it
    # pairs to, and audio-video/players-headsets never lists one
    'phones/headsets',
    'audio-video/tv',
    'audio-video/players-headsets/audio-headset',
    'audio-video/players-headsets/soudbar',
    'computer-equipments/computers/notebooks',
    'computer-equipments/computers/all-in-one',
    'computer-equipments/computer-devices/monitors',
    'computer-equipments/accessories-for-computer-equipments/speakers',
    'games-and-entertainment/game-consoles',
    'dyson-products-eldorado/dyson-hair-care-armenia-eldorado',
    'dyson-products-eldorado/dyson-vacuum-cleaners-eldorado',
]

# <a class="product_name combo_link" href="...">TITLE</a> ... data-price-amount="89900"
#
# Take the finalPrice and nothing else. A discounted card prints TWO prices, oldPrice first and
# finalPrice after it, so matching the first data-price-amount reads the struck-through price the
# shop is no longer asking - which is how 26 catalogue entries came to sit above what Eldorado
# actually charges. Every card carries a finalPrice, discounted or not (checked across the
# headset, smartphone and notebook listings: 0 cards without one), so keying on it drops nothing.
#
# The card also carries the product's photograph, and 80 products in this catalogue are sold by
# eldorado ALONE and have no picture at all - so it is picked up here, where the page is already
# open, rather than by a second pass that would have to ask the shop all over again. Two traps:
# a brand logo <img> sits on the same card, which is how a shop's own logo became a product photo
# twice before, so the path must be /media/catalog/product/; and the src on the card points at
# Magento's resized copy under /cache/<32 hex>/, where the original beside it is larger - 800x800
# against the card's thumbnail.
CARD = re.compile(
    r'<img[^>]+src="(https://eldorado\.am/media/catalog/product/[^"]+)"[^>]*>'
    r'.{0,4000}?'
    r'class="product_name combo_link"\s+href="([^"]+)"\s*>\s*(.*?)\s*</a>'
    r'(.{0,2000}?)data-price-amount="([\d.]+)"\s+data-price-type="finalPrice"',
    re.S)
UNCACHE = re.compile(r'/cache/[0-9a-f]{32}/')


def get(url):
    try:
        p = Fetcher.get(url, impersonate='chrome', timeout=40)
        return p.html_content if p.status == 200 else ''
    except Exception as e:
        print(f'  ! {url}: {e}', file=sys.stderr)
        return ''


rows, seen = [], set()
for cat in CATEGORIES:
    for page in range(1, PAGES + 1):
        url = f'https://eldorado.am/en/{cat}' + (f'?p={page}' if page > 1 else '')
        html = get(url)
        time.sleep(DELAY)
        if not html or len(html) < 20000:
            break
        found = 0
        for img, href, title, between, price in CARD.findall(html):
            if href in seen:
                continue
            seen.add(href)
            rows.append({
                'url': href,
                'title': re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', title)).strip(),
                'price': round(float(price)),
                # Magento prints class="stock unavailable" on a sold-out card
                'inStock': 'stock unavailable' not in between,
                'image': UNCACHE.sub('/', img),
            })
            found += 1
        print(f'{cat} p{page}: {found}', flush=True)
        if not found:
            break

OUT.write_text(json.dumps(rows, ensure_ascii=False), encoding='utf-8')
print(f'done: {len(rows)} listings -> {OUT.relative_to(ROOT)}')
