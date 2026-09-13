# Pulls a product photo from an Armenian shop's own product page.
#
#   python tools/shop-shot.py <product-id> <search terms...>
#
# zigzag is Magento: og:image points at the real product shot (the page itself carries 25 more
# for related items), and dropping the /cache/<hash>/ segment returns the 1200px original.
# Searching rather than guessing slugs, because shop slugs are unguessable
# ("b-w-px8-flagship-headphone-black.html").
import io, re, sys, difflib
from pathlib import Path
from scrapling.fetchers import Fetcher
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OG = re.compile(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"')
LINK = re.compile(r'zigzag\.am/(?:am|en|ru)/([a-z0-9\-]+)\.html')
SKIP = ('catalogsearch', 'customer', 'checkout', 'contact', 'about')


def get(url):
    p = Fetcher.get(url, impersonate='chrome', timeout=40)
    return p.html_content if p.status == 200 else ''


def main():
    pid, terms = sys.argv[1], ' '.join(sys.argv[2:])
    html = get('https://www.zigzag.am/catalogsearch/result/?q=' + terms.replace(' ', '+'))
    slugs = [s for s in dict.fromkeys(LINK.findall(html)) if not any(k in s for k in SKIP)]
    if not slugs:
        print(f'{pid}: no zigzag result for "{terms}"'); return
    key = re.sub(r'[^a-z0-9]+', ' ', terms.lower()).strip()
    # Fuzzy ratio alone is not safe on model numbers: "audio technica ath s220bt" scored 0.92
    # against ath-m20xbt, a different pair of headphones. Any query token carrying a digit is
    # the model, and it has to be present in the slug verbatim.
    models = [t for t in key.split() if any(c.isdigit() for c in t)]
    # The variant word matters as much as the model number: "s10 ultra" matched the Tab S10 FE,
    # because both carry s10 and neither "ultra" nor "fe" contains a digit. If the query names a
    # tier, the slug has to carry the same one - and must not carry a DIFFERENT one.
    # Roman numerals are the other trap: "marshall major iv" scored 0.68 against major-V, which
    # the catalogue already carries as a separate product. A numeral asked for must be the
    # numeral found - never a different one.
    ROMAN = ['ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']
    toks = key.split()
    want_roman = next((t for t in toks if t in ROMAN), None)
    if want_roman:
        def roman_of(slug):
            return next((w for w in slug.split('-') if w in ROMAN), None)
        slugs = [s for s in slugs if roman_of(s) == want_roman]
        if not slugs:
            print(f'{pid}: nothing on zigzag is the {want_roman.upper()}'); return
    TIERS = ['ultra', 'promax', 'pro', 'max', 'plus', 'mini', 'lite', 'fe', 'air']
    asked = [t for t in TIERS if t in key.replace(' ', '')]
    models += asked[:1]
    slugs = [s for s in slugs if all(m in s.replace('-', '') for m in models)]
    if asked:
        wrong = [t for t in TIERS if t not in asked and t != 'pro' or (t == 'pro' and 'pro' not in asked)]
        slugs = [s for s in slugs if not any(w in s.replace('-', '') for w in ('fe', 'lite', 'mini') if w not in asked)]
    if not slugs:
        print(f'{pid}: nothing on zigzag carries {models or terms!r}'); return
    # The brand has to be there too. Without it a 0.43 ratio put a Xiaomi AIR FRYER on the JBL
    # PartyBox, a Galaxy Fit band on the Buds FE and a category page on the Nothing Ear - every
    # one of which would have shipped as a confident-looking photo of the wrong thing.
    brand = key.split()[0]
    slugs = [s for s in slugs if brand in s.replace('-', '')]
    if not slugs:
        print(f'{pid}: nothing on zigzag is a {brand}'); return
    # Every distinctive WORD asked for has to be there too. "harman kardon luna" scored 0.68
    # against harman-kardon-hkflybtblk - the Fly BT - because no digit, numeral or tier word
    # separates a Luna from a Fly. Brand aside, a word of four letters or more is the product's
    # name, and a slug that carries none of it is a different product.
    # It is the LAST such word that names the product - "harman kardon luna" against
    # harman-kardon-hkflybtblk passed an any() test on "kardon" alone, which is the brand.
    words = [t for t in toks[1:] if len(t) >= 4 and not any(c.isdigit() for c in t)]
    if words:
        name = words[-1]
        slugs = [s for s in slugs if name in s.replace('-', '')]
        if not slugs:
            print(f'{pid}: nothing on zigzag is named "{name}"'); return
    best = max(slugs, key=lambda s: difflib.SequenceMatcher(None, key, s.replace('-', ' ')).ratio())
    score = difflib.SequenceMatcher(None, key, best.replace('-', ' ')).ratio()
    # The guards above - brand, digit tokens, roman numeral, tier word, product name - are what
    # make the match correct. This ratio is only a tie-breaker between survivors now, so it is
    # back at 0.45: at 0.62 it was rejecting the right answer (ATH-S220BT scores 0.57 against
    # its own long slug) while the guards had already thrown out every wrong one.
    if score < 0.45:
        print(f'{pid}: best zigzag match "{best}" scores {score:.2f} - too loose, skipped'); return
    m = OG.search(get(f'https://www.zigzag.am/am/{best}.html'))
    if not m:
        print(f'{pid}: {best} has no og:image'); return
    url = re.sub(r'/cache/[0-9a-f]+/', '/', m.group(1))            # Magento original
    r = Fetcher.get(url, impersonate='chrome', timeout=40)
    b = r.body if isinstance(r.body, (bytes, bytearray)) else b''
    im = Image.open(io.BytesIO(b))
    out = ROOT / 'images' / '_src' / f'{pid}__main.png'
    im.convert('RGB').save(out)
    print(f'{pid}: {im.size[0]}x{im.size[1]} from {best} (match {score:.2f}) -> {out.name}')


if __name__ == '__main__':
    main()
