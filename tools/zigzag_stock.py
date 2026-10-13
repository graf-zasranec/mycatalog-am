from bs4 import BeautifulSoup


def price_of(html):
    primary = BeautifulSoup(html, 'html.parser').select_one('.product-info-main')
    if primary is None:
        return None
    values = set()
    for element in primary.select('[data-price-type="finalPrice"][data-price-amount]'):
        try:
            values.add(round(float(element['data-price-amount'])))
        except (TypeError, ValueError):
            return None
    return values.pop() if len(values) == 1 else None


def stock_of(html):
    """Only the primary product can state stock; recommendations never count."""
    soup = BeautifulSoup(html, 'html.parser')
    primary = soup.select_one('.product-info-main')
    if primary is None:
        return None
    status = primary.select_one('[title="Availability"]') or primary.select_one('.stock')
    if status is None:
        return None
    classes = set(status.get('class', []))
    text = status.get_text(' ', strip=True).casefold()
    if classes & {'out_stock', 'out-of-stock', 'outofstock'} or text in {'out of stock', 'առկա չէ'}:
        return False
    if classes & {'in_stock', 'in-stock', 'instock', 'available'} or text in {'in stock', 'առկա է'}:
        return True
    return None
