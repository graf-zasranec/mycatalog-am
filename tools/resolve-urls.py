# Replaces category-page urls in data/listings.csv with the shop's real product page.
#
#   python tools/resolve-urls.py           report only
#   python tools/resolve-urls.py --write   rewrite the rows it can resolve
#
# A hand-recorded row sometimes points at a listing page rather than a product: one Pixel url
# stood in for 22 different phones. The price then cannot be checked in one click, which is the
# only thing this site promises - worse than a dead link, because it looks like it worked.
import re
import sys
from pathlib import Path

from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / 'data' / 'listings.csv'

# a category url, the pages that list its products, and how a product link looks there
SOURCES = [
    ('pixel.am', ['https://www.pixel.am/en/products/phones?brand=samsung',
                  'https://www.pixel.am/en/products/phones?brand=apple',
                  'https://www.pixel.am/en/products/phones?brand=xiaomi',
                  'https://www.pixel.am/en/products/phones'],
     r'/en/product/[a-z0-9\-]+', 'https://www.pixel.am'),
    ('telecomarmenia.am', ['https://www.telecomarmenia.am/eshop/en/smartphones/'],
     r'/eshop/en/smartphones/[a-z0-9\-]+/\d+/', 'https://www.telecomarmenia.am'),
]

# Shops abbreviate: Telecom writes "samsung-a37-8-256gb-graygreen" for what we call the
# "Samsung Galaxy A37". Dropping the filler word makes the two comparable.
FILLER = re.compile(r'galaxy|apple|smartphone|phone|5g|4g', re.I)
norm = lambda s: re.sub(r'[^a-z0-9]', '', FILLER.sub('', s).lower())


def pick(cat, want, cap=''):
    """The shop's url for this exact product, or None. Exactness is the whole point here."""
    if want in cat:
        return cat[want]
    # A slug may carry the configuration after the model: "samsunga37" + "8256gbgraygreen".
    # Only a DIGIT may follow - that is a capacity, so the model is the same phone. A letter
    # following means a different model: "samsungs25" + "edge" is not the S25.
    hits = sorted((k, v) for k, v in cat.items()
                  if k.startswith(want) and k[len(want):len(want) + 1].isdigit())
    if not hits:
        return None
    if cap:
        exact = [v for k, v in hits if cap in k]
        if exact:
            return exact[0]
    return min(hits, key=lambda kv: len(kv[0]))[1]     # the plainest listing of that model


def catalogue(pages, pat, base):
    """Every product url the shop lists, keyed by its slug squashed to letters and digits."""
    out = {}
    for p in pages:
        try:
            h = Fetcher.get(p, impersonate='chrome', timeout=40).html_content or ''
        except Exception:
            continue
        for path in set(re.findall(pat, h)):
            slug = path.rstrip('/').split('/')[-1]
            slug = re.sub(r'^\d+$', '', slug) or path.rstrip('/').split('/')[-2]
            out[norm(slug)] = base + path
    return out


def main():
    lines = CSV.read_text(encoding='utf8').rstrip('\n').split('\n')
    head, rows = lines[0], lines[1:]

    # only rows whose url is shared by several different products are suspect
    from collections import defaultdict
    byurl = defaultdict(set)
    rowsof = defaultdict(list)
    for r in rows:
        parts = r.split(',')
        if len(parts) >= 5 and parts[4].startswith('http'):
            byurl[parts[4]].add(norm(parts[1]))     # distinct PRODUCTS, not rows
            rowsof[parts[4]].append(r)
    shared = {u for u, names in byurl.items() if len(names) > 3}
    print(f'{len(shared)} category url(s) covering {sum(len(rowsof[u]) for u in shared)} row(s)')

    fixed = 0
    out = []
    dropped = []
    for r in rows:
        parts = r.split(',')
        if len(parts) < 6 or parts[4] not in shared:
            out.append(r); continue
        host = re.sub(r'^https?://(?:www\.)?([^/]+).*', r'\1', parts[4])
        src = next((s for s in SOURCES if s[0] == host), None)
        if not src:
            out.append(r); continue
        cat = MAPS.setdefault(host, catalogue(src[1], src[2], src[3]))
        # the row's title, squashed, against every product slug the shop lists
        want = norm(parts[1])
        # EXACT only. A substring fallback matched "Galaxy S25 Edge" to the plain S25, and both
        # "Pixel 10" and "Pixel 10 Pro" to the 10 Pro XL. A link that opens the WRONG phone is
        # worse than one that opens a listing page, because the price then looks confirmed.
        hit = pick(cat, want, parts[2].strip())
        if not hit:
            # We just read this shop's whole catalogue and the product is not in it, so the row
            # claims a price at a shop that does not sell the thing. With --drop-unlisted it goes;
            # otherwise it stays and keeps pointing at the listing page.
            print(f'  unlisted    {parts[0]:14} {parts[1][:44]}')
            if '--drop-unlisted' in sys.argv:
                dropped.append(r); continue
            out.append(r); continue
        print(f'  resolved    {parts[0]:14} {parts[1][:38]:40} -> {hit[-56:]}')
        parts[4] = hit
        out.append(','.join(parts))
        fixed += 1

    print(f'\n{fixed} row(s) resolved to a product page')
    if (fixed or dropped) and '--write' in sys.argv:
        CSV.write_text('\n'.join([head] + out) + '\n', encoding='utf8')
        print('listings.csv rewritten')


MAPS = {}
if __name__ == '__main__':
    main()
