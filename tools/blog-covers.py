# Builds the blog's pictures from the product cutouts the catalogue already has.
#
#   python tools/blog-covers.py
#
# Every picture is a composition of our own transparent product shots on the site's ground (ivory
# or ink) with a soft shadow - no stock photos, no press images, no text burnt into the pixels (the
# caption is in the page, in the reader's language). Per article it writes, under images/blog/:
#   <id>.webp        1600x900, the cover on the article page
#   <id>-card.webp    800x450, the same for the blog index card
#   <id>.jpg         1200x630, the share image (og:image) of the static page
# plus any figure an article places in its body.
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CUT = ROOT / 'images' / 'cut'
OUT = ROOT / 'images' / 'blog'
IVORY, SHOT, INK = (247, 243, 236), (239, 233, 223), (22, 28, 40)


def product(name, height):
    im = Image.open(CUT / f'{name}.webp').convert('RGBA')
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def place(canvas, name, height, cx, base, dark=False, maxw=None):
    """A product standing on a line: centred on cx, its bottom on base, with a contact shadow."""
    im = product(name, height)
    if maxw and im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    x, y = round(cx - im.width / 2), base - im.height
    # a soft drop shadow from the product's own outline, and a flatter one where it meets the ground
    a = im.split()[3]
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    sh.putalpha(a.point(lambda v: v * (0.42 if dark else 0.22) // 1))
    sh = sh.filter(ImageFilter.GaussianBlur(28))
    canvas.alpha_composite(sh, (x + 10, y + 26))
    # drawn with room around it: a blur clipped by its own box leaves a hard grey band
    g = Image.new('RGBA', (im.width + 240, 190), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse((60, 60, g.width - 60, 130), fill=(0, 0, 0, 110 if dark else 55))
    g = g.filter(ImageFilter.GaussianBlur(20))
    canvas.alpha_composite(g, (x - 120, base - 98))
    canvas.alpha_composite(im, (x, y))


def ground(size, color, dark=False):
    c = Image.new('RGBA', size, color + (255,))
    # a broad, faint pool of light behind the products - the studio look, not a gradient wash
    glow = Image.new('RGBA', size, (0, 0, 0, 0))
    w, h = size
    tint = (255, 255, 255, 18) if dark else (255, 255, 255, 110)
    ImageDraw.Draw(glow).ellipse((w * 0.14, h * 0.02, w * 0.86, h * 0.98), fill=tint)
    c.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
    return c


def save(c, slug):
    OUT.mkdir(parents=True, exist_ok=True)
    rgb = c.convert('RGB')
    rgb.save(OUT / f'{slug}.webp', 'WEBP', quality=84, method=6)
    rgb.resize((800, 450), Image.LANCZOS).save(OUT / f'{slug}-card.webp', 'WEBP', quality=82, method=6)
    og = rgb.resize((1200, 675), Image.LANCZOS).crop((0, 22, 1200, 652))
    og.save(OUT / f'{slug}.jpg', 'JPEG', quality=86, optimize=True)
    print('wrote', slug)


def main():
    W, H = 1600, 900
    # What Apple showed: the new Pro, the Watch and AirPods, on ink
    c = ground((W, H), INK, dark=True)
    place(c, 'apple-airpods-5__main', 230, 360, 790, dark=True)
    place(c, 'apple-iphone-18-pro__burgundy', 640, 800, 810, dark=True)
    place(c, 'apple-watch-series-12-gps-42mm__main', 380, 1250, 800, dark=True)
    save(c, 'apple-september-2026')

    # 17 Pro against 18 Pro, side by side on ivory
    c = ground((W, H), SHOT)
    place(c, 'apple-iphone-17-pro__cosmic-orange', 660, 520, 820)
    place(c, 'apple-iphone-18-pro__burgundy', 660, 1080, 820)
    save(c, 'iphone-17-pro-vs-18-pro')

    # the figure in that article: every colour of each, 17 Pro above, 18 Pro below
    F = ground((W, 1000), SHOT)
    for i, n in enumerate(['cosmic-orange', 'deep-blue', 'silver']):
        place(F, f'apple-iphone-17-pro__{n}', 380, 400 + i * 400, 450)
    for i, n in enumerate(['burgundy', 'glacier', 'silver', 'black']):
        place(F, f'apple-iphone-18-pro__{n}', 380, 260 + i * 360, 930)
    F.convert('RGB').save(OUT / 'iphone-17-18-pro-colours.webp', 'WEBP', quality=84, method=6)
    print('wrote iphone-17-18-pro-colours')

    # TV labels: an OLED in front, a Mini-LED and a Neo QLED behind
    c = ground((W, H), SHOT)
    place(c, 'tcl-75c7k__main', 330, 360, 640, maxw=560)
    place(c, 'samsung-qe65qn90fauxru__main', 330, 1240, 640, maxw=560)
    place(c, 'lg-oled65c5rla__main', 470, 800, 820, maxw=860)
    save(c, 'tv-resolution-and-panels')

    # eSIM or Nano-SIM: a Pro sold both ways, and the eSIM-only Air
    c = ground((W, H), INK, dark=True)
    place(c, 'apple-iphone-17-pro__deep-blue', 640, 600, 810, dark=True)
    place(c, 'apple-iphone-air__sky-blue', 640, 1060, 810, dark=True)
    save(c, 'esim-or-nano-sim')


if __name__ == '__main__':
    main()
