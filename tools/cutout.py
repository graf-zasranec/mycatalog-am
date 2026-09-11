# Turns the photos in images/_src/ into transparent, trimmed WebP cutouts in images/cut/.
#
#   pip install "rembg[cpu]" onnxruntime pillow
#   python tools/cutout.py                 all of them
#   python tools/cutout.py id1 id2 ...     just these (matches the start of the filename)
#
# Why a model and not a flood fill: the hand-rolled version could only ask "is this pixel near
# the backdrop colour", which cannot tell a grey shadow plinth from a grey product, or a white
# strap from a white backdrop. It ate watch straps and left podiums. isnet-general-use is a
# segmentation model trained on exactly this - object against studio backdrop - and it answers
# the question the thresholds could not.
import sys, os, io
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage
from rembg import remove, new_session

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'images' / '_src', ROOT / 'images' / 'cut'
OUT.mkdir(parents=True, exist_ok=True)

# A phone, a tablet, a laptop, a console has no hole through it: any enclosed transparent
# region inside one is the model tearing at a reflective screen, and gets filled whatever its
# size. A headphone's headband gap, a watch strap's loop and a speaker's carry handle are real
# holes, so for those only small ones are filled. The category decides, because size cannot:
# the Smart Band's real loop is 26% of its box and the iPhone 17e's tear is 49%.
SOLID_CATS = {'phone', 'tablet', 'laptop', 'desktop', 'console'}
_cat = {}
try:
    import json
    for _p in json.loads((ROOT / 'data' / 'phones.json').read_text(encoding='utf-8')):
        _cat[_p['id']] = _p.get('category', 'phone')
except Exception:
    pass
def solid_product(filename):
    return _cat.get(filename.split('__')[0], '') in SOLID_CATS

SIDE = 1200        # canvas the product is centred on
FILL = 0.92        # how much of that canvas the product's longest side takes
MAXUP = 1.15       # never upscale a small source by more than this, it only adds blur

session = new_session('isnet-general-use')


def cut(path: Path, solid_cat: bool = False) -> Image.Image:
    src = Image.open(path).convert('RGBA')
    # A press PNG that already has alpha is its own answer; running the model on it can only
    # lose detail at the edges it already has.
    pre = src.getchannel('A').getextrema()[0] < 250
    img = src if pre else remove(src, session=session, post_process_mask=True)

    # The model sometimes punches holes through a reflective screen - the Z Fold's folded display
    # came out with white tears in it. A hole that is ENCLOSED by the product and small is always
    # a mistake; a large one is real, like the gap inside a headphone headband, so it is left.
    a = np.array(img.getchannel('A'))
    holes, n = ndimage.label(a <= 24)
    if n:
        edge = set(np.unique(np.concatenate([holes[0], holes[-1], holes[:, 0], holes[:, -1]])))
        area = a.size
        for lab, size in zip(*np.unique(holes, return_counts=True)):
            if lab == 0 or lab in edge:
                continue
            if not solid_cat and size > area * 0.02:
                continue
            a[holes == lab] = 255
        img.putalpha(Image.fromarray(a))

    solid = img.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    bbox = solid.getbbox()
    if bbox:
        img = img.crop(bbox)
        solid = solid.crop(bbox)

    # The model keeps everything that IS an object, which is right - and includes the S Pen lying
    # beside a Galaxy Ultra. Split the mask into runs of occupied columns and keep only the wide
    # ones: a stylus or a thin side profile is a narrow run, the front and back of a real two-shot
    # render are comparable in width and both survive.
    w, h = solid.size
    px = solid.load()
    minrun = max(2, round(h * 0.04))
    full = [sum(1 for y in range(h) if px[x, y]) >= minrun for x in range(w)]
    runs, start = [], None
    for x in range(w + 1):
        on = x < w and full[x]
        if on and start is None:
            start = x
        elif not on and start is not None:
            runs.append((start, x - 1)); start = None
    if len(runs) >= 2:
        widest = max(b - a + 1 for a, b in runs)
        keep = [r for r in runs if (r[1] - r[0] + 1) >= widest * 0.45]
        if keep and (keep[0][0] > 0 or keep[-1][1] < w - 1):
            img = img.crop((keep[0][0], 0, keep[-1][1] + 1, h))

    w, h = img.size
    side = min(SIDE, round(max(w, h) * MAXUP / FILL))
    scale = (side * FILL) / max(w, h)
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)

    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    return canvas


def main():
    want = sys.argv[1:]
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')))
    if want:
        files = [f for f in files if any(f.startswith(w) for w in want)]
    done = 0
    for f in files:
        try:
            out = OUT / (os.path.splitext(f)[0] + '.webp')
            cut(SRC / f, solid_product(f)).save(out, 'WEBP', quality=90, method=6)
            done += 1
            print(f'{done}/{len(files)} {f}', flush=True)
        except Exception as e:
            print(f'  ! {f}: {e}', flush=True)
    print(f'done {done}/{len(files)}')


if __name__ == '__main__':
    main()
