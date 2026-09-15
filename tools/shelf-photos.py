# Fetches the shop's own photograph for each product a shelf read added, at the biggest size the
# shop will hand over, and drops it into images/_src for the matting pass.
#
#   python tools/shelf-photos.py .shelf-monitors-added.json
#
# The catalogue's 600px floor applies here like everywhere else: a picture under it is not taken,
# and the product goes without one rather than with a blurred one.
import importlib.util as iu
import io
import json
import os
import sys
import time
from pathlib import Path

os.chdir(r'C:\Users\hastv\Videos\MyCatalog')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from PIL import Image
from scrapling.fetchers import Fetcher

# the same url-enlargement rules the colour harvester uses, so a shop's thumbnail is asked for
# its original before it is judged too small
spec = iu.spec_from_file_location('hc', 'tools/harvest-colors.py')
hc = iu.module_from_spec(spec)
spec.loader.exec_module(hc)

MIN = 600
OUT = Path('images/_src')
OUT.mkdir(parents=True, exist_ok=True)

rows = json.load(io.open(sys.argv[1], encoding='utf-8'))
got = small = miss = skip = 0
for r in rows:
    dest = OUT / ('%s__main.png' % r['id'])
    if dest.exists():
        skip += 1
        continue
    if not r.get('image'):
        miss += 1
        print('  %-34s no image on the page' % r['id'])
        continue
    best = None
    for rule in hc.RULES:
        try:
            u = rule(r['image'])
        except Exception:
            continue
        try:
            im = Image.open(io.BytesIO(Fetcher.get(u, impersonate='chrome', timeout=30).body))
            im.load()
        except Exception:
            continue
        if not best or min(im.size) > min(best.size):
            best = im
    if not best:
        miss += 1
        print('  %-34s nothing fetched' % r['id'])
        continue
    if min(best.size) < MIN:
        small += 1
        print('  %-34s %dx%d under %dpx - left without one' % (r['id'], best.size[0], best.size[1], MIN))
        continue
    best.convert('RGB').save(dest)
    got += 1
    print('  %-34s %dx%d' % (r['id'], best.size[0], best.size[1]), flush=True)
    time.sleep(0.25)

print('\n%d fetched, %d too small, %d with no image, %d already had one' % (got, small, miss, skip))
