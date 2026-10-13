import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zigzag_stock import price_of

spec = importlib.util.spec_from_file_location('zigzag_fetch', Path(__file__).with_name('zigzag-fetch.py'))
fetcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetcher)

class FetchTests(unittest.TestCase):
    def refresh(self, html):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'data').mkdir()
            url = 'https://www.zigzag.am/am/phone.html'
            old = dict(url=url,price=35900,inStock=True,checked='2026-10-10')
            out = root/'data/zigzag.json'
            out.write_text(json.dumps([old]))
            (root/'data/prices.json').write_text(json.dumps({'offers': {'phone':[dict(old,shop='zigzag',seen='2026-10-10')]}}))
            with patch.object(fetcher,'ROOT',root), patch.object(fetcher,'OUT',out), patch.object(fetcher,'CATEGORIES',[]), patch.object(fetcher,'DELAY',0), patch.object(fetcher,'known_urls',return_value={url}), patch.object(fetcher,'get',return_value=html):
                fetcher.main()
            return json.loads(out.read_text())[0]

    def test_failed_fetch_preserves_price_and_check_date(self):
        row = self.refresh('')
        self.assertEqual((row['price'],row['checked'],row['inStock']),(35900,'2026-10-10',True))

    def test_unknown_stock_preserves_previous_date(self):
        row = self.refresh('<div class="product-info-main"><span data-price-type="finalPrice" data-price-amount="39900"></span></div>')
        self.assertEqual((row['price'],row['checked']),(35900,'2026-10-10'))

    def test_exact_unavailable_page_replaces_old_available_record(self):
        row = self.refresh('<div class="product-info-main"><div class="stock out_stock">Out of stock</div><span data-price-type="finalPrice" data-price-amount="39900"></span></div>')
        self.assertEqual(row['price'],39900)
        self.assertIs(row['inStock'],False)
        self.assertIn('checkedAt',row)

    def test_related_price_cannot_fill_missing_primary_price(self):
        self.assertIsNone(price_of('<div class="product-info-main">Phone</div><section><span data-price-type="finalPrice" data-price-amount="39900"></span></section>'))

if __name__ == '__main__':
    unittest.main()
