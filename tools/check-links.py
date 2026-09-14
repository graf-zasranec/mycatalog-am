# Checks the urls in data/listings.csv are still live.
#
#   python tools/check-links.py            report only
#   python tools/check-links.py --prune     drop the rows whose page is gone
#
# A crawled offer heals itself: next run the shop either serves the page or the offer disappears.
# A hand-recorded row has no such cycle - notebookcentre and yerevanmobile are not crawled at all,
# appzone barely - so a row here is the one kind that can rot silently while the site keeps
# linking people to a 404.
import sys
from collections import OrderedDict
from pathlib import Path

from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / 'data' / 'listings.csv'
DEAD = {404, 410, 500}          # 403/429 is a shop refusing US, not a missing page


def main():
    lines = CSV.read_text(encoding='utf8').rstrip('\n').split('\n')
    head, rows = lines[0], lines[1:]
    urls = OrderedDict()
    for r in rows:
        parts = r.split(',')
        if len(parts) >= 5 and parts[4].startswith('http'):
            urls.setdefault(parts[4], []).append(r)

    print(f'{len(urls)} distinct url(s) across {len(rows)} row(s)')
    dead = []
    for i, u in enumerate(urls, 1):
        try:
            st = Fetcher.get(u, impersonate='chrome', timeout=25).status
        except Exception:
            st = 'ERR'
        if st in DEAD:
            dead.append((st, u))
            print(f'  DEAD {st}  {u}   ({len(urls[u])} row(s))')

    print(f'\n{len(dead)} dead url(s)')
    if dead and '--prune' in sys.argv:
        gone = {u for _, u in dead}
        kept = [r for r in rows if not any(p in gone for p in r.split(','))]
        CSV.write_text('\n'.join([head] + kept) + '\n', encoding='utf8')
        print(f'{len(rows) - len(kept)} row(s) removed from listings.csv')


if __name__ == '__main__':
    main()
