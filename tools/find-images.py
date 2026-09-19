# Fills the Image_Link column of data/wanted-images.csv with the product's photo URL.
#
# An image is first taken from data/prices.json when a scraped offer already named one for that
# page - 391 of 526 links need no network. The rest are read off the product page's og:image tag,
# which is what the tag is for. Re-runnable: progress is kept in .wanted-images.json.
#
#   python tools/find-images.py            fetch what's missing, write wanted-images.csv
import csv
import json
import re
import time
import urllib.parse
from pathlib import Path

from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / 'data' / 'wanted-images.csv'
PRICES = ROOT / 'data' / 'prices.json'
STATE = ROOT / '.wanted-images.json'

# Shops this project will not fetch — same list as check-links.py, same reason.
NOFETCH = {'yerevanmobile', 'notebookcentre', 'listam', 'zigzag'}

OG = re.compile(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']'
    r'|<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', re.I)


def main():
    rows = list(csv.reader(CSV.read_text(encoding='utf8').splitlines()))
    head, rows = rows[0], rows[1:]

    img_by_url = {}
    data = json.loads(PRICES.read_text(encoding='utf8'))
    for lst in data['offers'].values():
        for o in lst:
            if o.get('url', '').startswith('http') and o.get('image'):
                img_by_url.setdefault(o['url'], o['image'])

    # Stale entries that found no image are worth retrying with each fix to this tool, so only a
    # url that already produced an image counts as done.
    done = {k: v for k, v in (json.loads(STATE.read_text(encoding='utf8')) if STATE.exists() else {}).items() if v}
    urls = sorted({r[5] for r in rows if len(r) > 8 and r[5].startswith('http') and not r[8].startswith('http')})
    todo = [u for u in urls if u not in done]
    print(f'{len(urls)} product link(s) without an image; {len(urls) - len(todo)} already known, {len(todo)} to look up')

    for i, u in enumerate(todo, 1):
        img = img_by_url.get(u)
        if not img:
            shop = u.split('/')[2].replace('www.', '').split('.')[0]
            if shop in NOFETCH:
                img = ''
            else:
                try:
                    r = Fetcher.get(u, impersonate='chrome', timeout=25)
                    m = OG.search(r.html_content or '')
                    if m:
                        img = m.group(1) or m.group(2)
                        img = re.sub(r'&amp;', '&', img)
                        img = urllib.parse.urljoin(u, img)
                except Exception:
                    img = ''
            time.sleep(0.4)
        done[u] = img or ''
        if not img:
            print(f'  no og:image  {u}')
        if i % 25 == 0 or i == len(todo):
            STATE.write_text(json.dumps(done), encoding='utf8')
            print(f'  {i}/{len(todo)}', flush=True)

    found = sum(1 for v in done.values() if str(v).startswith('http'))
    print(f'\n{found} image link(s) found of {len(urls)}')

    for r in rows:
        if len(r) > 8 and r[5] in done:
            r[8] = done[r[5]]
    with CSV.open('w', encoding='utf8', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerows([head] + rows)
    print(f'=> {CSV}')


if __name__ == '__main__':
    main()