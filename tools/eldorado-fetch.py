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
PAGES = 6            # per category; they show 24 a page

CATEGORIES = [
    'phones/tablets-and-smartphones/smartphones',
    'phones/tablets-and-smartphones/tablets',
    'phones/smart-watches',
    'audio-video/players-headsets/audio-headset',
    'audio-video/players-headsets/soudbar',
    'computer-equipments/computers/notebooks',
    'computer-equipments/accessories-for-computer-equipments/speakers',
    'games-and-entertainment/game-consoles',
    'dyson-products-eldorado/dyson-hair-care-armenia-eldorado',
    'dyson-products-eldorado/dyson-vacuum-cleaners-eldorado',
]

# <a class="product_name combo_link" href="...">TITLE</a> ... data-price-amount="89900"
CARD = re.compile(
    r'class="product_name combo_link"\s+href="([^"]+)"\s*>\s*(.*?)\s*</a>(.{0,2000}?)data-price-amount="([\d.]+)"',
    re.S)


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
        for href, title, between, price in CARD.findall(html):
            if href in seen:
                continue
            seen.add(href)
            rows.append({
                'url': href,
                'title': re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', title)).strip(),
                'price': round(float(price)),
                # Magento prints class="stock unavailable" on a sold-out card
                'inStock': 'stock unavailable' not in between,
            })
            found += 1
        print(f'{cat} p{page}: {found}', flush=True)
        if not found:
            break

OUT.write_text(json.dumps(rows, ensure_ascii=False), encoding='utf-8')
print(f'done: {len(rows)} listings -> {OUT.relative_to(ROOT)}')
