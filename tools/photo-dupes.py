# Finds colours of one product whose photos are the same picture.
#
#   python tools/photo-dupes.py      writes data/photo-dupes.json
#
# A shop that has one photo serves it for every colour, so the Galaxy S25+ "Mint" and "Navy" were
# one image and the AirPods Max 2 "Orange" and "Midnight" another. On a card that meant a colour dot
# that changed nothing, or showed the wrong colour. Which of the two is right cannot be told from
# the files, so every colour in a look-alike group is listed; build.mjs leaves those out of the
# colour photos (the product keeps its main shot) until a real photo per colour is supplied.
#
# "The same" is measured on a 32x32 copy: identical files score 0, two genuinely similar finishes
# (Natural and Desert Titanium) about 4. Anything under 2 is one photo.
import itertools
import json
import re
from collections import defaultdict
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CUT = ROOT / 'images' / 'cut'
SAME = 2.0
ALIASES = json.loads((ROOT / 'data' / 'color-aliases.json').read_text(encoding='utf8'))

def canonical(pid, slug):
    mapping = ALIASES.get(pid, {})
    for label in mapping:
        if re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-') != slug:
            continue
        seen = set()
        while label in mapping and label not in seen:
            seen.add(label)
            label = mapping[label]
        return re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-')
    return slug

def look(p):
    return Image.open(p).convert('RGBA').resize((32, 32)).tobytes()

def dist(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)

by = defaultdict(dict)
for f in sorted(CUT.glob('*__*.webp')):
    pid, col = f.stem.split('__', 1)
    if col != 'main':
        by[pid][col] = look(f)

out = {}
for pid, cols in by.items():
    bad = set()
    for a, b in itertools.combinations(sorted(cols), 2):
        if canonical(pid, a) == canonical(pid, b):
            continue  # Two names for the same finish are expected to share a photograph.
        if dist(cols[a], cols[b]) < SAME:
            bad.update((a, b))
    if bad:
        out[pid] = sorted(bad)

(ROOT / 'data' / 'photo-dupes.json').write_text(json.dumps(out, indent=1, sort_keys=True) + '\n', encoding='utf8')
print(f'{len(out)} product(s) with colours sharing one photo -> data/photo-dupes.json')
for pid, cols in out.items():
    print(f'  {pid:48} {", ".join(cols)}')
