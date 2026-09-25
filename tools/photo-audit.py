# Looks for photo faults across the whole catalogue and writes contact sheets to look at.
#
#   python tools/photo-audit.py [out_dir]          report + sheets (default: photo-audit/)
#
# What imgcheck.py already catches (halo, a neighbour's sliver, cropped at the edge, a source too
# small) is included, plus what it does not:
#   - background never removed: the frame's border is still opaque
#   - stray specks: small opaque blobs well away from the product
#   - ghost mask: a large share of half-transparent pixels, the mark of a model that was unsure
#   - blur: little fine detail for the size, an upscale or a bad source
#   - the same photo on two different products
#   - colour photos whose file name matches none of the product's colours, so its swatch can
#     never switch to it (and a colour with no photo while such an orphan exists)
# Every finding is a thing to LOOK at: the sheets put each flagged cutout over magenta, where
# leftover backdrop, specks and haze are obvious to the eye.
import json, os, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from imgcheck import check as base_check  # noqa: E402

CUT = ROOT / 'images' / 'cut'
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'photo-audit'
slug = lambda s: re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', str(s).lower()))


def extra(a):
    al, h, w = a[..., 3], a.shape[0], a.shape[1]
    body = al > 128
    out, m = [], {}
    ring = np.concatenate([al[:3].ravel(), al[-3:].ravel(), al[:, :3].ravel(), al[:, -3:].ravel()])
    if (ring > 200).mean() > 0.5:
        out.append('background not removed (border opaque)')
    lab, n = ndimage.label(body, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndimage.sum(body, lab, range(1, n + 1))
        big = sizes.max()
        mains = [i + 1 for i, s in enumerate(sizes) if s >= big * 0.03]
        ys, xs = np.where(np.isin(lab, mains))
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        py, px = (y1 - y0) * 0.04, (x1 - x0) * 0.04
        specks = 0
        for i, s in enumerate(sizes):
            if 25 <= s < big * 0.03:
                cy, cx = ndimage.center_of_mass(body, lab, i + 1)
                if cy < y0 - py or cy > y1 + py or cx < x0 - px or cx > x1 + px:
                    specks += 1
        if specks:
            out.append(f'{specks} stray speck(s) outside the product')
            m['specks'] = specks
    soft = ((al > 15) & (al < 200)).sum()
    if body.sum() and soft / body.sum() > 0.30:
        out.append(f'ghost mask: {soft / body.sum() * 100:.0f}% of the product half-transparent')
    g = a[..., :3].astype(float) @ [0.299, 0.587, 0.114]
    lap = np.abs(4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:])
    inner = ndimage.binary_erosion(body, iterations=4)[1:-1, 1:-1]
    m['sharp'] = float(lap[inner].mean()) if inner.sum() > 500 else None
    return out, m


def dhash(a, n=16):
    rgb = a[..., :3].astype(float) * (a[..., 3:4] / 255.0) + 128 * (1 - a[..., 3:4] / 255.0)
    im = Image.fromarray(rgb.astype(np.uint8)).convert('L').resize((n + 1, n), Image.LANCZOS)
    v = np.asarray(im, dtype=float)
    return (v[:, 1:] > v[:, :-1]).ravel()


def sheet(items, path, title):
    """items: [(file, caption)] - each cutout over magenta with its caption under it."""
    if not items:
        return
    S, cols, cap = 240, 6, 34
    rows = (len(items) + cols - 1) // cols
    sh = Image.new('RGB', (S * cols, (S + cap) * rows + 30), (250, 250, 250))
    d = ImageDraw.Draw(sh)
    d.text((8, 8), title, fill=(0, 0, 0))
    for n, (f, c) in enumerate(items):
        im = Image.open(CUT / f).convert('RGBA')
        im.thumbnail((S, S), Image.LANCZOS)
        tile = Image.new('RGBA', (S, S), (255, 0, 170, 255))
        tile.alpha_composite(im, ((S - im.width) // 2, (S - im.height) // 2))
        x, y = (n % cols) * S, (n // cols) * (S + cap) + 30
        sh.paste(tile.convert('RGB'), (x, y))
        d.text((x + 4, y + S + 2), f[:38], fill=(0, 0, 0))
        d.text((x + 4, y + S + 16), c[:38], fill=(160, 0, 0))
    sh.save(path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    phones = json.load(open(ROOT / 'data' / 'phones.json', encoding='utf-8'))
    by = {p['id']: p for p in phones}
    dupes = json.load(open(ROOT / 'data' / 'photo-dupes.json', encoding='utf-8')) if (ROOT / 'data' / 'photo-dupes.json').exists() else {}
    files = sorted(f for f in os.listdir(CUT) if f.endswith('.webp'))
    rep, hashes, sharp = {}, {}, []
    for k, f in enumerate(files):
        a = np.array(Image.open(CUT / f).convert('RGBA'))
        issues = base_check(CUT / f)
        more, m = extra(a)
        issues += more
        if issues:
            rep[f] = issues
        if f.endswith('__main.webp'):
            hashes[f] = dhash(a)
            if m.get('sharp') is not None:
                sharp.append((m['sharp'], f, max(a.shape[:2])))
        if k % 200 == 0:
            print(f'  {k}/{len(files)}', flush=True)
    # blur: the dullest tenth of main photos, measured against the rest
    sharp.sort()
    cut_at = sharp[len(sharp) // 12][0] if sharp else 0
    for s, f, size in sharp:
        if s <= cut_at:
            rep.setdefault(f, []).append(f'soft / blurry (detail {s:.1f})')
    # the same photo on two products
    same = []
    keys = list(hashes)
    H = np.array([hashes[k] for k in keys])
    for i in range(len(keys)):
        d = (H[i + 1:] != H[i]).sum(axis=1)
        for j in np.where(d <= 6)[0]:
            a_, b_ = keys[i], keys[i + 1 + j]
            same.append((a_, b_, int(d[j])))
    # colour photos nobody can reach
    orphan, nophoto = [], []
    for f in files:
        mm = re.match(r'(.+?)__(.+)\.webp$', f)
        if not mm or mm.group(2) == 'main' or mm.group(1) not in by:
            continue
        pid, key = mm.group(1), mm.group(2)
        cols = {slug(c) for c in by[pid].get('colors') or []}
        if key not in cols and key not in (dupes.get(pid) or []):
            orphan.append((pid, key))
    for p in phones:
        have = {re.match(r'.+?__(.+)\.webp$', f).group(1) for f in files if f.startswith(p['id'] + '__')}
        miss = [c for c in p.get('colors') or [] if slug(c) not in have]
        if miss and any(k for (pid, k) in orphan if pid == p['id']):
            nophoto.append((p['id'], miss))
    stale = [f for f in files if re.match(r'(.+?)__', f).group(1) not in by]
    json.dump({'issues': rep, 'samePhoto': same, 'orphanColour': orphan, 'colourNoPhoto': nophoto, 'notInCatalogue': stale},
              open(OUT / 'report.json', 'w', encoding='utf-8'), indent=1)
    kinds = {}
    for f, iss in rep.items():
        for i in iss:
            k = re.sub(r'[\d.]+', 'N', i.split(':')[0].split('(')[0]).strip()
            kinds.setdefault(k, []).append((f, i))
    for k, items in kinds.items():
        name = re.sub(r'[^a-z]+', '-', k.lower()).strip('-')[:40]
        for part in range(0, len(items), 36):
            sheet([(f, i) for f, i in items[part:part + 36]], OUT / f'{name}-{part // 36 + 1}.png', f'{k}  ({len(items)})')
    sheet([(a_, 'same as ' + b_.split('__')[0]) for a_, b_, _ in same[:36]], OUT / 'same-photo-1.png', f'same photo on two products ({len(same)})')
    print(f'{len(files)} cutouts: {len(rep)} with findings')
    for k, items in sorted(kinds.items(), key=lambda x: -len(x[1])):
        print(f'  {len(items):4}  {k}')
    print(f'  {len(same):4}  same photo on two products')
    print(f'  {len(orphan):4}  colour photos matching no colour name; {len(nophoto)} products with a colour lacking its photo')
    print(f'  {len(stale):4}  files for products no longer in the catalogue')


if __name__ == '__main__':
    main()
