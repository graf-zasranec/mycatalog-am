# Builds a blog article's cover from the catalogue's own cutouts, in the style of the existing
# covers: products side by side on the site's warm paper colour, no text (one picture serves
# all three languages).
#
#   python3 tools/blog-cover.py <article-id> <product-id> [<product-id> ...]   (1-5 products)
#
# Writes images/blog/<article-id>.webp (1600x900, the page), -card.webp (800x450, the blog grid)
# and .jpg (1200x630, the social card). Set the article's "cover" to images/blog/<id>.webp.
import sys, glob, os
from PIL import Image, ImageFilter

BG = (245, 242, 236)


def cutout(pid):
    main = f'images/cut/{pid}__main.webp'
    files = [main] if os.path.exists(main) else sorted(glob.glob(f'images/cut/{pid}__*.webp'))
    if not files:
        sys.exit(f'no cutout for {pid}')
    im = Image.open(files[0]).convert('RGBA')
    return im.crop(im.getbbox())


def compose(ids, W, H):
    ims = [cutout(p) for p in ids]
    n = len(ims)
    pad, gap = W * 0.06, W * 0.035
    box_w = (W - 2 * pad - gap * (n - 1)) / n
    box_h = H * (0.72 if n > 1 else 0.8)
    canvas = Image.new('RGBA', (W, H), BG + (255,))
    x = pad
    for im in ims:
        s = min(box_w / im.width, box_h / im.height)  # each fills its own slot: a phone is not lost beside a TV
        w, h = int(im.width * s), int(im.height * s)
        im2 = im.resize((w, h), Image.LANCZOS)
        cx = int(x + (box_w - w) / 2)
        cy = int((H - h) / 2 + H * 0.02)
        sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        sh.putalpha(im2.getchannel('A').point(lambda a: int(a * 0.18)))
        sh = sh.filter(ImageFilter.GaussianBlur(max(6, W // 120)))
        canvas.alpha_composite(sh, (cx + W // 160, cy + H // 60))
        canvas.alpha_composite(im2, (cx, cy))
        x += box_w + gap
    return canvas.convert('RGB')


if __name__ == '__main__':
    aid, ids = sys.argv[1], sys.argv[2:6]
    if not ids:
        sys.exit('usage: blog-cover.py <article-id> <product-id> ...')
    os.makedirs('images/blog', exist_ok=True)
    compose(ids, 1600, 900).save(f'images/blog/{aid}.webp', quality=86, method=6)
    compose(ids, 800, 450).save(f'images/blog/{aid}-card.webp', quality=82, method=6)
    compose(ids, 1200, 630).save(f'images/blog/{aid}.jpg', quality=86, optimize=True, progressive=True)
    print(f'images/blog/{aid}.webp')
