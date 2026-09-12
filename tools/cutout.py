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

# bria-rmbg, after measuring four of them on the same eight photos. isnet ate thin dark parts
# (a chunk out of the Smart Band's strap, a notch off the Buds Core case) and on the white
# iPhone 17e it kept 9.9% of the frame - outlines and nothing else. birefnet-general deleted the
# second phone from a two-shot render and exhausted memory on this machine. birefnet-general-lite
# was good everywhere except white-on-white, where it bit a piece out of the 17e's back. bria-rmbg
# is right on all eight: both phones in a two-shot render, the headband hole and the strap loop
# left open, the white phone whole. It costs about 100s a photo here, which is the price.
SESSION = new_session('bria-rmbg')


def model_alpha(img):
    return np.array(remove(img, session=SESSION, post_process_mask=True, only_mask=True))


def cut(path: Path, solid_cat: bool = False) -> Image.Image:
    src = Image.open(path).convert('RGBA')
    # A press PNG that already has alpha is its own answer; running the model on it can only
    # lose detail at the edges it already has.
    pre = src.getchannel('A').getextrema()[0] < 250
    if pre:
        img = src
    else:
        # colour always comes from the photo, only the alpha comes from the models - remove()
        # zeroes the RGB of everything it drops, which used to paint any filled hole black
        img = src.copy()
        img.putalpha(Image.fromarray(model_alpha(src)))

    # The model sometimes punches holes through a reflective screen - the Z Fold's folded display
    # came out with white tears in it. A hole that is ENCLOSED by the product and small is always
    # a mistake; a large one is real, like the gap inside a headphone headband, so it is left.
    a = np.array(img.getchannel('A'))
    holes, n = ndimage.label(a <= 24)
    if n:
        edge = set(np.unique(np.concatenate([holes[0], holes[-1], holes[:, 0], holes[:, -1]])))
        area = a.size
        rgb = np.array(src.convert('RGB')).astype(int)
        # The studio backdrop, read off the four corners. A "hole" whose photo underneath is that
        # colour is not a hole in the product at all - it is backdrop trapped by a concave
        # silhouette, and filling it printed a white blob under the Galaxy S26.
        back = np.median(np.concatenate([rgb[:8, :8].reshape(-1, 3), rgb[:8, -8:].reshape(-1, 3),
                                         rgb[-8:, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3)]), axis=0)
        prod = rgb[a > 200].mean(axis=0) if (a > 200).any() else back
        filled = np.zeros_like(a, dtype=bool)
        for lab, size in zip(*np.unique(holes, return_counts=True)):
            if lab == 0 or lab in edge:
                continue
            if not solid_cat and size > area * 0.02:
                continue
            m = holes == lab
            hue = rgb[m].mean(axis=0)
            # A gap the colour of the studio is the studio showing through. For a phone that can
            # still be a tear the model made in a white back - the iPhone 17e is the colour of the
            # room it stands in - so there the product's own colour gets a say. For a watch or a
            # headphone it never does: a perforation in a strap IS a hole, and filling it printed
            # white dots down the band.
            if np.abs(hue - back).max() < 24 and (not solid_cat or np.abs(hue - prod).max() > 40):
                continue
            filled |= m
        if filled.any():
            a[filled] = 255
        img.putalpha(Image.fromarray(a))

    # A press PNG often ships its drop shadow in the alpha channel - the Xbox console stood on a
    # grey pool. A shadow is a wide, faint region; an anti-aliased edge is a faint pixel right
    # beside an opaque one. Keep what is within a few pixels of the solid product, drop the rest.
    a = np.array(img.getchannel('A'))
    if pre and ((a > 8) & (a < 200)).sum() > a.size * 0.01:
        near = ndimage.binary_dilation(a >= 200, iterations=1)
        a[(a < 200) & ~near] = 0
        img.putalpha(Image.fromarray(a))

    # The photo was shot on a white backdrop, so every half-transparent edge pixel is already a
    # blend of product and studio. Laid over a dark page that blend reads as a white halo. Undo
    # the blend - C = (observed - (1-a)*backdrop) / a - and the edge keeps the product's own
    # colour at the alpha it earned. A press PNG is exempt: its edges were separated by whoever
    # made it, against no backdrop at all, so there is nothing to undo.
    al = np.array(img.getchannel('A')).astype(np.float32) / 255.0
    soft = (al > 0.06) & (al < 0.96)
    if not pre and soft.any():
        rgb0 = np.array(src.convert('RGB')).astype(np.float32)
        bk = np.median(np.concatenate([rgb0[:8, :8].reshape(-1, 3), rgb0[:8, -8:].reshape(-1, 3),
                                       rgb0[-8:, :8].reshape(-1, 3), rgb0[-8:, -8:].reshape(-1, 3)]), axis=0)
        px = np.array(img.convert('RGB')).astype(np.float32)
        f = al[soft][:, None]
        px[soft] = np.clip((px[soft] - (1 - f) * bk) / f, 0, 255)
        img = Image.fromarray(np.dstack([px.astype(np.uint8), (al * 255).astype(np.uint8)]), 'RGBA')

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
