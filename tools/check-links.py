# Checks the urls in data/listings.csv are still live AND still in stock.
#
#   python tools/check-links.py            report only
#   python tools/check-links.py --prune     drop the rows whose page is gone or sold out
#
# A crawled offer heals itself: next run the shop either serves the page or the offer disappears.
# A hand-recorded row has no such cycle - notebookcentre and yerevanmobile are not crawled at all,
# appzone barely - so a row here is the one kind that can rot silently while the site keeps
# linking people to a 404.
import re
import sys
from collections import OrderedDict
from pathlib import Path

from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / 'data' / 'listings.csv'
DEAD = {404, 410, 500}          # 403/429 is a shop refusing US, not a missing page
# A crawled offer is dropped when the shop says out of stock; a hand row never was, because
# data/listings.csv carries no stock column and nothing re-read the page. Zigzag's Galaxy A06
# sat on the site as "In stock" at 37 700 while the shop's own page said Out of stock, 35 900.
#
# Only machine-readable statements count. A plain-text search for "out of stock" reported
# REDstore's perfectly available iPhone 16 as sold out, because the page ships a translation
# dictionary containing "out_of_stock":"Out of stock" - a label, not a status.
SCHEMA = re.compile('availability\\"?\\s*:\\s*\\"?[^\\"]*?(InStock|OutOfStock|SoldOut)', re.I)
BLOCK = re.compile(r'class=\"[^\"]*status_block[^\"]*?(out_stock|in_stock)', re.I)


def stock_of(html):
    """True, False, or None when the page makes no machine-readable claim."""
    if not html:
        return None
    m = SCHEMA.search(html)
    if m:
        return m.group(1).lower() == 'instock'
    m = BLOCK.search(html)
    if m:
        return m.group(1).lower() == 'in_stock'
    return None


def main():
    lines = CSV.read_text(encoding='utf8').rstrip('\n').split('\n')
    head, rows = lines[0], lines[1:]
    urls = OrderedDict()
    for r in rows:
        parts = r.split(',')
        if len(parts) >= 5 and parts[4].startswith('http'):
            urls.setdefault(parts[4], []).append(r)

    print(f'{len(urls)} distinct url(s) across {len(rows)} row(s)')
    dead, sold = [], []
    for u in urls:
        try:
            r = Fetcher.get(u, impersonate='chrome', timeout=25)
            st, html = r.status, (r.html_content or '')
        except Exception:
            st, html = 'ERR', ''
        if st in DEAD:
            dead.append((st, u))
            print(f'  DEAD {st}  {u}   ({len(urls[u])} row(s))')
            continue
        if st == 200 and stock_of(html) is False:
            sold.append(u)
            print(f'  SOLD OUT  {u}   ({len(urls[u])} row(s))')

    print(f'\n{len(dead)} dead url(s), {len(sold)} sold out')
    dead += [(200, u) for u in sold]
    if dead and '--prune' in sys.argv:
        gone = {u for _, u in dead}
        kept = [r for r in rows if not any(p in gone for p in r.split(','))]
        CSV.write_text('\n'.join([head] + kept) + '\n', encoding='utf8')
        print(f'{len(rows) - len(kept)} row(s) removed from listings.csv')


if __name__ == '__main__':
    main()
