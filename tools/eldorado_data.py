"""Read only the current product/card, never recommendations or the old price."""
import re
from bs4 import BeautifulSoup


def product_row(html, url):
    soup = BeautifulSoup(html, 'html.parser')
    heading = soup.find('h1')
    primary = soup.select_one('.product-info-main')
    form = soup.select_one('#product_addtocart_form')
    if not heading or not primary or not form:
        raise ValueError('No primary product and purchase form (blocked/changed page)')
    title = heading.get_text(' ', strip=True)
    button = form.select_one('#product-addtocart-button')
    if button:
        # Magento also enables this control for pre-orders. It must not make a
        # future delivery count as an immediately available shop offer.
        preorder = re.search(r'pre[\s-]*order|նախապատվ|предзаказ',
                             button.get_text(' ', strip=True), re.I)
        stock = not button.has_attr('disabled') and 'disabled' not in button.get('class', []) and not preorder
    elif re.search(r'notify|out of stock|unavailable|առկա չէ|ծանուց', primary.get_text(' ', strip=True), re.I):
        stock = False
    else:
        raise ValueError('Purchase control missing without explicit stock evidence')
    prices = [round(float(el['data-price-amount'])) for el in
              primary.select('[data-price-type="finalPrice"][data-price-amount]')]
    if not prices or len(set(prices)) != 1:
        raise ValueError('Missing or conflicting primary final price')
    if prices[0] <= 0 and stock:
        raise ValueError('In-stock product has no positive cash price')
    row = dict(url=url, title=title, price=prices[0], inStock=stock, detailVerified=True)
    # Keep each fixed SKU's configuration. The title can omit RAM and storage.
    detailed = soup.select_one('.product-info-detailed')
    text = detailed.get_text(' ', strip=True) if detailed else ''
    for key, pattern in [
        ('ram', r'(?:Operative memory\s*\(RAM\)|RAM)\s*[-:]?\s*(\d+)\s*GB'),
        ('storage', r'(?:Built-in memory|Storage|Internal memory\s*\(SSD\)|SSD Drive)\s*[-:]?\s*(\d+)\s*(GB|TB)'),
    ]:
        match = re.search(pattern, text, re.I)
        if match:
            value = int(match[1]) * (1024 if key == 'storage' and match[2].upper() == 'TB' else 1)
            # An 8GB "internal memory" label cannot create 8GB phone storage.
            if key != 'storage' or value >= 32:
                row[key] = value
    return row


def category_rows(html):
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    # Eldorado renamed the card wrapper (by 2026-10-24 it is li.product-item-loader); the old
    # selector matched nothing and every aisle read as empty.
    for card in soup.select('.product-item') or soup.select('li.product-item-loader'):
        name = card.select_one('a.product_name.combo_link')
        price = card.select_one('[data-price-type="finalPrice"][data-price-amount]')
        if not name or not price:
            continue
        image = next((el.get('src') for el in card.select('img')
                      if '/media/catalog/product/' in el.get('src', '')), None)
        row = dict(url=name.get('href'), title=name.get_text(' ', strip=True),
                   price=round(float(price['data-price-amount'])),
                   inStock=not bool(card.select_one('.stock.unavailable')),
                   detailVerified=False)
        if image:
            row['image'] = re.sub(r'/cache/[0-9a-f]{32}/', '/', image)
        rows.append(row)
    return rows

