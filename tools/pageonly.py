# Lists the colour photos that should appear on the product page but NOT in the card carousel.
#
#   python tools/pageonly.py        rewrites data/pageonly.json
#
# A card crossfades between a product's colour photos. That only reads as one product turning
# around if every frame is the same shape: when a shop shoots the Tab A11+ in landscape and its
# main shot is portrait, the card lurches between the two. The photo is still the right photo,
# so it keeps its place on the product page and loses only its turn in the carousel.
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CUT = ROOT / 'images' / 'cut'
LIMIT = 1.25            # a quarter off the main shot's proportions is visible as a jump


def aspect(path):
    box = Image.open(path).convert('RGBA').split()[3].getbbox()
    return (box[2] - box[0]) / (box[3] - box[1]) if box else None


def main():
    shots = {}
    for f in CUT.glob('*__*.webp'):
        pid, rest = f.stem.split('__', 1)
        a = aspect(f)
        if a:
            shots.setdefault(pid, {})[rest] = a

    out = {}
    for pid, d in sorted(shots.items()):
        main_a = d.get('main')
        if not main_a:
            continue
        odd = sorted(r for r, a in d.items()
                     if r != 'main' and max(a / main_a, main_a / a) > LIMIT)
        if odd:
            out[pid] = odd

    (ROOT / 'data' / 'pageonly.json').write_text(json.dumps(out, indent=1) + '\n', encoding='utf8')
    print(f'{sum(len(v) for v in out.values())} photo(s) kept off the carousel, {len(out)} product(s)')
    for pid, odd in out.items():
        print(f'  {pid}: {", ".join(odd)}')


if __name__ == '__main__':
    main()
