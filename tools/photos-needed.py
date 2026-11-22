# What still needs a photograph, and why.
#
#   python tools/photos-needed.py              print it
#   python tools/photos-needed.py --csv        ...and write data/photos-needed.csv
#
# Three different jobs, and they are not interchangeable:
#   MISSING   nothing at all -- the page shows a grey box
#   TOO SMALL visible long edge below 600 px. Find a larger original.
#   DEFECT    there is a photo and something is wrong with it -- see tools/imgcheck.py
import sys
import os
import json
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CUT = ROOT / 'images' / 'cut'
FLOOR = 600

def visible_long_edge(image):
    bounds = image.convert('RGBA').getchannel('A').point(lambda alpha: 255 if alpha > 128 else 0).getbbox()
    if bounds is None:
        return 0
    left, top, right, bottom = bounds
    return max(right - left, bottom - top)

if '--selftest' in sys.argv:
    tall = Image.new('RGBA', (367, 1237))
    tall.paste((1, 2, 3, 255), (20, 18, 345, 1218))
    assert visible_long_edge(tall) == 1200 >= FLOOR
    tall.paste((0, 0, 0, 128), (0, 0, 367, 1237))
    tall.paste((1, 2, 3, 255), (20, 18, 345, 617))
    assert visible_long_edge(tall) == 599 < FLOOR
    print('Photo long-edge checks passed')
    sys.exit(0)

phones = json.loads((ROOT / 'data' / 'phones.json').read_text(encoding='utf8'))
prices = json.loads((ROOT / 'data' / 'prices.json').read_text(encoding='utf8'))['offers']

main = {}
for f in os.listdir(CUT):
    pid, _, rest = f.partition('__')
    if rest.startswith('main'):
        main[pid] = CUT / f

rows = []
for p in phones:
    f = main.get(p['id'])
    # a product nothing sells has no page worth photographing; those are pruned separately
    shops = len({o['shop'] for o in prices.get(p['id'], [])})
    if not f:
        rows.append(('missing', p, 0, shops))
        continue
    try:
        with Image.open(f) as image:
            w = visible_long_edge(image)
    except Exception:
        rows.append(('unreadable', p, 0, shops))
        continue
    if w < FLOOR:
        rows.append(('too small', p, w, shops))

# the biggest sellers first: a missing photo costs more on a product people actually look at
rank = {'missing': 0, 'unreadable': 1, 'too small': 2}
rows.sort(key=lambda r: (rank[r[0]], -r[3], -(r[1].get('popularity') or 0), r[1]['id']))

by = {}
for kind, p, w, shops in rows:
    by.setdefault(kind, []).append((p, w, shops))

print(f'{len(phones)} products, {len(main)} with a photo\n')
for kind, v in by.items():
    print(f'== {kind} ({len(v)})')
    for p, w, shops in v[:15]:
        size = f'{w}px' if w else ''
        print(f'   {p["id"][:40]:42} {p["category"]:10} {shops} shop(s)  {size}')
    if len(v) > 15:
        print(f'   ... and {len(v) - 15} more')
    print()

cat = {}
for kind, p, w, shops in rows:
    cat[p['category']] = cat.get(p['category'], 0) + 1
print('by category: ' + '  '.join(f'{k}:{v}' for k, v in sorted(cat.items(), key=lambda kv: -kv[1])))

if '--csv' in sys.argv:
    out = ROOT / 'data' / 'photos-needed.csv'
    lines = ['what,id,brand,name,category,shops,visibleLongEdge']
    for kind, p, w, shops in rows:
        lines.append(','.join(str(c).replace(',', ' ') for c in
                              [kind, p['id'], p['brand'], p['name'], p['category'], shops, w or '']))
    out.write_text('\n'.join(lines) + '\n', encoding='utf8')
    print(f'\n  -> {out}')
