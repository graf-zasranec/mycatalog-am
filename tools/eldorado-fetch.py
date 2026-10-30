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
import argparse
import csv
import re
import json
from datetime import datetime, timezone
from urllib.parse import urlparse
import sys
import time
from pathlib import Path

from eldorado_data import category_rows, product_row

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
    # appliances and personal care (2026-10-24): the catalogue carries these sections and
    # Eldorado stocks them, but none of its offers were read
    'small-appliances/personal-care-products/shavers',
    'small-appliances/personal-care-products/epilators',
    'small-appliances/personal-care-products/clippers',
    'small-appliances/personal-care-products/hair-dryers',
    'small-appliances/personal-care-products/electric-toothbrush',
    'small-appliances/household-devices/irons',
    'small-appliances/household-devices/kattles',
    'small-appliances/household-devices/blenders',
    'small-appliances/household-devices/mixers',
    'small-appliances/household-devices/juicers',
    'small-appliances/household-devices/food-processors',
    'small-appliances/food-preparation-devices/toasters',
    'small-appliances/food-preparation-devices/grill',
    'small-appliances/food-preparation-devices/airfryers',
    'small-appliances/coffee-machines-and-coffee-makers/coffee-machines',
    'small-appliances/coffee-machines-and-coffee-makers/filter-coffee-machines',
    'small-appliances/cleaning-equipments/vacuum-cleaners',
    'small-appliances/cleaning-equipments/cordless-vacuum-cleaners',
    'small-appliances/cleaning-equipments/robot-vacuum-cleaner',
    'climate/humidifiers',
    'climate/air-purifiers',
    # large appliances (2026-10-25): the catalogue's largeappliance section
    'climate/air-conditioners',
    'large-home-appliances/large-kitchen-appliences/refrigerators',
    'large-home-appliances/large-kitchen-appliences/freezers',
    'large-home-appliances/large-kitchen-appliences/dishwashers',
    'large-home-appliances/washing-machines-and-dryers/washing-machines',
    'large-home-appliances/washing-machines-and-dryers/dryers',
]

# <a class="product_name combo_link" href="...">TITLE</a> ... data-price-amount="89900"
#
# Legacy card markup reference: take the finalPrice and nothing else. A discounted card prints TWO prices, oldPrice first and
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


def get(url):
    try:
        from scrapling.fetchers import Fetcher
        from shop_access import headers_for   # tools/ is on sys.path: this script lives there
        p = Fetcher.get(url, impersonate='chrome', timeout=40, headers=headers_for(url))
        return p.html_content if p.status == 200 else ''
    except Exception as e:
        print(f'  ! {url}: {e}', file=sys.stderr)
        return ''


def read_json(path, fallback):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return fallback


def save(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_bytes((json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
    temporary.replace(path)


def known_offers():
    rows = {}
    for pid, offers in read_json(ROOT / 'data/prices.json', {}).get('offers', {}).items():
        for offer in offers:
            if offer.get('shop') == 'eldorado' and offer.get('url'):
                row = dict(offer, id=pid, title=offer.get('title', pid), checked=offer.get('seen'), detailVerified=False)
                rows[offer['url']] = row
    # Include hand-only URLs, not just whatever the last merge happened to retain.
    path = ROOT / 'data/listings.csv'
    if path.exists():
        for fields in csv.reader(path.open(encoding='utf-8', newline='')):
            if len(fields) < 6 or fields[0] != 'eldorado' or not fields[4].startswith('https://eldorado.am/'):
                continue
            if fields[4] not in rows:
                try:
                    rows[fields[4]] = dict(url=fields[4], title=fields[1], price=int(fields[5]),
                                          checked=fields[8] if len(fields) > 8 else None, detailVerified=False)
                except ValueError:
                    pass
    # A newly imported model can have only an exact merchant source URL: it
    # has not entered prices/listings yet and aisle discovery may miss it.
    # These are verification seeds, never offers or model identity pins.
    for product in read_json(ROOT / 'data/phones.json', []):
        for url in product.get('sources', []):
            if not isinstance(url, str):
                continue
            parsed = urlparse(url)
            parts = parsed.path.strip('/').split('/')
            if (parsed.scheme != 'https' or parsed.netloc != 'eldorado.am'
                    or parsed.query or parsed.fragment or len(parts) != 2
                    or parts[0] not in ['en', 'am', 'ru'] or '-' not in parts[1]):
                continue
            rows.setdefault(url, dict(url=url, title='', price=0, checked=None, detailVerified=False))
    # Previously unavailable pages can come back; confirm their own purchase control.
    for url in read_json(ROOT / 'data/soldout-owner.json', {}).get('urls', []):
        if url.startswith('https://eldorado.am/'):
            rows.setdefault(url, dict(url=url, title='', price=0, checked=None, detailVerified=False))
    return rows


def main():
    parser = argparse.ArgumentParser(description='Eldorado discovery plus direct verification of known offers')
    parser.add_argument('--offers-only', action='store_true', help='Skip discovery; verify existing product URLs')
    parser.add_argument('--recheck-hours', type=float, default=4, help='Age of direct verification before checking again; 0 forces all')
    parser.add_argument('--limit', type=int, default=0, help='Bound direct checks for diagnostics')
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    day = now.date().isoformat()
    cached = {r['url']: r for r in read_json(OUT, []) if r.get('url')}
    known = known_offers()
    products = {p['id']: p for p in read_json(ROOT / 'data/phones.json', [])}
    report = dict(started=now.isoformat(), checked=[], changed=[], unavailable=[], failed=[])
    for url, old in known.items():
        cached.setdefault(url, old)
    if not args.offers_only:
        for cat in CATEGORIES:
            seen = set()
            for page in range(1, PAGES + 1):
                url = f'https://eldorado.am/en/{cat}' + (f'?p={page}' if page > 1 else '')
                html = get(url)
                time.sleep(DELAY)
                if not html:
                    report['failed'].append(dict(url=url, reason='Category request failed; retained cache'))
                    break
                found = 0
                for row in category_rows(html):
                    if row['url'] in seen:
                        continue
                    seen.add(row['url'])
                    found += 1
                    # A card may discover a product, but cannot override a known product's
                    # current purchase availability or newer exact-page verification.
                    if row['url'] not in known:
                        cached[row['url']] = dict(row, checked=day, checkedAt=datetime.now(timezone.utc).isoformat())
                print(f'{cat} p{page}: {found}', flush=True)
                if not found:
                    break
            # checkpoint each aisle: a run cut short (the Mac sleeping, a closed session) keeps
            # what it has read instead of losing two hours of listings
            save(OUT, list(cached.values()))
    targets = []
    for url in known:
        parsed = urlparse(url)
        if parsed.hostname != 'eldorado.am' or parsed.query:
            continue
        old = cached[url]
        try:
            checked = datetime.fromisoformat(old.get('checkedAt', ''))
            age = (now - checked).total_seconds() / 3600
        except (ValueError, TypeError):
            age = float('inf')
        if not old.get('detailVerified') or age >= args.recheck_hours:
            targets.append(url)
    if args.limit:
        targets = targets[:args.limit]
    print(f'Direct product checks: {len(targets)}; delay {DELAY}s', flush=True)
    for index, url in enumerate(targets, 1):
        old = cached[url]
        try:
            html = get(url)
            if not html:
                raise ValueError('Request failed; previous price and verification date retained')
            current = product_row(html, url)
            category = products.get(known[url].get('id'), {}).get('category')
            memory_product = category in ['phone', 'tablet', 'laptop', 'desktop'] or (category is None and bool(re.search(r'\b(?:smartphone|iphone|tablet|notebook|laptop|macbook|desktop|computer)\b', current['title'], re.I)))
            if not memory_product:
                current.pop('ram', None)
                current.pop('storage', None)
            row = dict(old, **current)
            row['checked'] = day
            row['checkedAt'] = datetime.now(timezone.utc).isoformat()
            cached[url] = row
            report['checked'].append(url)
            if row['price'] != old.get('price') or row.get('ram') != old.get('ram') or row.get('storage') != old.get('storage'):
                report['changed'].append(dict(url=url, before={k: old.get(k) for k in ['price', 'ram', 'storage']},
                                              after={k: row.get(k) for k in ['price', 'ram', 'storage']}))
            if not row['inStock']:
                report['unavailable'].append(url)
        except (ValueError, TypeError) as exc:
            report['failed'].append(dict(url=url, reason=str(exc)))
        # Checkpoint each verified page. Interruption never loses earlier work, and a failed
        # page keeps its own checked timestamp even when the cache file is rewritten.
        save(OUT, list(cached.values()))
        save(ROOT / 'data/eldorado-refresh-report.json', report)
        print(f'Eldorado {index}/{len(targets)}: {len(report["changed"])} changed; {len(report["failed"])} unresolved', flush=True)
        time.sleep(DELAY)
    if not cached:
        print('No verified listings: retained previous cache', file=sys.stderr)
        return 1
    save(OUT, list(cached.values()))
    report['finished'] = datetime.now(timezone.utc).isoformat()
    save(ROOT / 'data/eldorado-refresh-report.json', report)
    print(f'Eldorado: {len(report["checked"])} exact pages checked, {len(report["changed"])} changes, '
          f'{len(report["unavailable"])} unavailable, {len(report["failed"])} unresolved', flush=True)
    return 1 if not report['checked'] and report['failed'] else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    raise SystemExit(main())
