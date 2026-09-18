# Flattens Web Scraper .xlsx exports into one rows.json the rest of the tools can read.
#
#   python tools/xlsx.py <file-or-dir> [more...] -o rows.json
#
# Web Scraper names its columns after whatever the person clicked, so the same shop exports
# 'memory' one day and 'data9' the next, and every export has a different shape. Only the columns
# that mean something are kept, under the names the catalogue uses. The shop is read off the
# start url rather than the file name, because the file name is whatever the download was called.
#
# Prices come back as '149 900 ֏', '239,000 Դրամ', '72,900\xa0֏'. All of it is thrown away except
# the digits - no shop here prices anything in fractions of a dram.
import sys, os, re, json, glob, openpyxl

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SHOPS = {'istyle.am': 'istyle', 'pixel.am': 'pixel', 'eldorado.am': 'eldorado', 'zigzag.am': 'zigzag',
         'ibolit.mobi': 'ibolit', 'notebookcentre.am': 'notebookcentre', 'yerevanmobile.am': 'yerevanmobile',
         'mobilecentre.am': 'mobilecentre', 'redstore.am': 'redstore', 'allsell.am': 'allsell',
         'vlv.am': 'vlv', 'ispace.am': 'ispace', 'istore.am': 'istore', 'vega.am': 'vega',
         '3dplanet.am': 'planet3d', 'ucom.am': 'ucom', 'telecomarmenia.am': 'telecom'}
# the column name on the left is whatever the person clicked in Web Scraper that day
KEEP = {'name': 'name', 'data': 'name', 'title': 'name', 'item_page_title': 'name',
        # every shop's export calls the price something slightly different, and a row with no
        # price is dropped - so a column name missed here loses the whole file silently
        'price': 'price', 'price 1': 'price', 'price2': 'price', 'price_1': 'price',
        'price_2': 'price', 'price_5': 'price',
        'ram': 'ram', 'memory': 'storage', 'chip': 'chip', 'videocard': 'gpu',
        'screen size': 'screen', 'screen resolution': 'resolution', 'operating system': 'os',
        'brand': 'brand', 'weight': 'weight', 'image': 'image', 'item_page_link': 'url'}


def shop_of(url):
    # Ucom serves its catalogue from shop.ucom.am, so stripping only "www." left the whole
    # subdomain in the key and 174 rows arrived filed under a shop nothing else knows about.
    # Matched on the suffix instead: a host ends with the domain whatever sits in front of it.
    host = re.sub(r'^https?://', '', str(url or '')).split('/')[0].lower()
    host = re.sub(r'^www\.', '', host)
    for dom, name in SHOPS.items():
        if host == dom or host.endswith('.' + dom):
            return name
    return host or '?'


def amd(v):
    digits = re.sub(r'[^\d]', '', str(v or ''))
    return int(digits) if digits else None


def read(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    head = [str(c).strip() if c is not None else '' for c in next(rows, [])]
    # Pixel's export has no header at all, just a blank row and then the data. Web Scraper always
    # writes the same first three columns, so the shape is known even when the names are not.
    if not any(head):
        head = ['web_scraper_order', 'web_scraper_start_url', 'pagination', 'name', 'price'] \
               + ['soft'] * 20
    # iStyle's price sits under 'data' because that is what the column was called when it was
    # clicked. 'data' means the name in the exports that also have a price column, so which one
    # it is can only be decided per file, by whether a price column exists at all.
    local = dict(KEEP)
    if 'price' not in head and 'data' in head:
        local['data'] = 'price'
    out = []
    for r in rows:
        row = {}
        for h, c in zip(head, r):
            k = local.get(h)
            # first column wins: an export with both 'name' and 'item_page_title' has the fuller
            # text in whichever came first, and the later one is usually a truncated repeat
            if k and c is not None and str(c).strip() and k not in row:
                row[k] = str(c).strip()
        if not row.get('name') or not row.get('price'):
            continue
        row['price'] = amd(row['price'])
        start = dict(zip(head, r)).get('web_scraper_start_url')
        row['shop'] = shop_of(start)
        # The aisle the row was read from. VLV's product links are /en/Product/47554 and its
        # titles are "SAMSUNG UE85M80HAUXPY" - neither says what the thing is, while the listing
        # it came off says /category/filter/tv-1 and is the shop's own word for it.
        row['from'] = str(start or '')
        row['src'] = os.path.basename(path)
        if row['price']:
            out.append(row)
    wb.close()
    return out


args = sys.argv[1:]
dest = 'rows.json'
if '-o' in args:
    dest = args[args.index('-o') + 1]
    args = args[:args.index('-o')]

files = []
for a in args:
    files += sorted(glob.glob(os.path.join(a, '*.xlsx'))) if os.path.isdir(a) else [a]

rows, seen = [], set()
for f in files:
    got = read(f)
    print(f'{len(got):5d}  {os.path.basename(f)}')
    rows += got
# the same product appears on page 1 of one export and page 2 of the next; the cheaper reading of
# a duplicate is the one to keep, because a shop showing two prices is showing a sale
for r in sorted(rows, key=lambda r: r['price']):
    k = (r['shop'], r['name'].lower())
    if k not in seen:
        seen.add(k)
    else:
        r['dup'] = True
rows = [r for r in rows if not r.get('dup')]

json.dump(rows, open(dest, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
by_shop = {}
for r in rows:
    by_shop[r['shop']] = by_shop.get(r['shop'], 0) + 1
print(f'\n{len(rows)} distinct row(s) -> {dest}')
for s, n in sorted(by_shop.items(), key=lambda kv: -kv[1]):
    print(f'  {s:16} {n}')
