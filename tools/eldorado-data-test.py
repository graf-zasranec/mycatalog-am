import unittest
import importlib.util
import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch
from eldorado_data import product_row, category_rows


def page(price_markup, control='<button id="product-addtocart-button">ADD TO CART</button>', extra=''):
    return ('<h1>Sony WH-CH720N Blue</h1><div class="product-info-main">' + price_markup +
            '<form id="product_addtocart_form">' + control + '</form></div>' + extra)


class EldoradoDataTests(unittest.TestCase):
    def test_sale_final_not_struck_price_or_related_product(self):
        row = product_row(page('<span data-price-type="oldPrice" data-price-amount="57900"></span>'
                               '<span data-price-type="finalPrice" data-price-amount="39900"></span>',
                               extra='<div class="related"><span data-price-type="finalPrice" data-price-amount="500"></span></div>'), 'url')
        self.assertEqual(row['price'], 39900)

    def test_expired_sale_reads_regular_price(self):
        self.assertEqual(product_row(page('<span data-price-type="finalPrice" data-price-amount="57900"></span>'), 'url')['price'], 57900)

    def test_recommendation_add_to_cart_cannot_make_product_available(self):
        row = product_row(page('<span data-price-type="finalPrice" data-price-amount="72900"></span>',
                               '<button>Notify me when this product is in stock</button>',
                               '<button id="product-addtocart-button">ADD TO CART</button>'), 'url')
        self.assertFalse(row['inStock'])

    def test_real_notify_link_outside_purchase_form_is_unavailable(self):
        html = page('<span data-price-type="finalPrice" data-price-amount="72900"></span>',
                    '<button id="buy-now">BUY 1 CLICK</button>').replace('</form></div>',
                    '</form><a>Notify me when this product is in stock</a></div>')
        self.assertFalse(product_row(html, 'url')['inStock'])

    def test_disabled_purchase_control_is_unavailable(self):
        self.assertFalse(product_row(page('<span data-price-type="finalPrice" data-price-amount="57900"></span>',
                                         '<button id="product-addtocart-button" disabled></button>'), 'url')['inStock'])

    def test_enabled_preorder_control_is_not_in_stock(self):
        for label in ['PRE ORDER', 'Pre-order', 'Նախապատվեր', 'Предзаказ']:
            with self.subTest(label=label):
                html = page('<span data-price-type="finalPrice" data-price-amount="27900"></span>',
                            '<button id="product-addtocart-button">' + label + '</button>')
                self.assertFalse(product_row(html, 'url')['inStock'])

    def test_blocked_or_changed_layout_is_not_success(self):
        for html in ['<h1>Sorry, you have been blocked</h1>', page('', control='')]:
            with self.assertRaises(ValueError):
                product_row(html, 'url')

    def test_related_price_cannot_fill_missing_primary_price(self):
        with self.assertRaises(ValueError):
            product_row(page('', extra='<span data-price-type="finalPrice" data-price-amount="130000"></span>'), 'url')

    def test_fixed_sku_specs_when_title_has_no_memory(self):
        row = product_row(page('<span data-price-type="finalPrice" data-price-amount="94900"></span>',
                               extra='<div class="product-info-detailed">Storage - 128 GB RAM - 4 GB</div>'), 'url')
        self.assertEqual((row['ram'], row['storage']), (4, 128))

    def test_primary_finish_replaces_inherited_default_color(self):
        html = page('<span data-price-type="finalPrice" data-price-amount="10900"></span>').replace('Sony WH-CH720N Blue','Redmi Buds 8 lite BHR08OLGL White')
        row = product_row(html,'https://eldorado.am/en/bhr08olgl-white')
        self.assertEqual(row.get('color'),'White')

    def test_color_is_a_whole_primary_title_word(self):
        html = page('<span data-price-type="finalPrice" data-price-amount="10900"></span>').replace('Sony WH-CH720N Blue','Wireless Bluetooth headphones')
        self.assertNotIn('color',product_row(html,'url'))

    def test_card_boundaries_do_not_borrow_next_card_price(self):
        html = '<li class="product-item"><a class="product_name combo_link" href="a">A</a></li>' \
               '<li class="product-item"><a class="product_name combo_link" href="b">B</a><span data-price-type="finalPrice" data-price-amount="50000"></span></li>'
        self.assertEqual([r['url'] for r in category_rows(html)], ['b'])

    def test_catalogue_sources_seed_only_exact_merchant_product_urls_without_identity_pin(self):
        spec = importlib.util.spec_from_file_location('eldorado_fetch_sources_test', Path(__file__).with_name('eldorado-fetch.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'data').mkdir()
            exact = 'https://eldorado.am/en/air-conditioner-tcl-tac-09chsd-zg31i'
            products = [dict(id='tcl-model', name='TCL model', sources=[exact,
                'https://eldorado.am/en/climate', 'https://eldorado.am.evil.test/en/fake',
                'https://eldorado.am/en/item?search=x', 'https://other.am/en/model'])]
            (root / 'data/phones.json').write_text(json.dumps(products), encoding='utf-8')
            with patch.object(module, 'ROOT', root):
                rows = module.known_offers()
            self.assertIn(exact, rows)
            self.assertEqual(rows[exact]['price'], 0)
            self.assertFalse(rows[exact]['detailVerified'])
            self.assertNotIn('id', rows[exact])
            self.assertEqual(list(rows), [exact])

    def test_failed_refresh_preserves_cache_and_its_old_date(self):
        self.run_refresh('', 1, 39900, '2026-10-10')

    def test_live_expired_sale_replaces_old_cache(self):
        result = self.run_refresh(page('<span data-price-type="finalPrice" data-price-amount="57900"></span>'), 0, 57900)
        self.assertTrue(result['detailVerified'])
        self.assertIn('checkedAt', result)

    def run_refresh(self, html, exit_code, price, day=None):
        spec = importlib.util.spec_from_file_location('eldorado_fetch_test', Path(__file__).with_name('eldorado-fetch.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'data').mkdir()
            url = 'https://eldorado.am/en/sony-wh-ch720n-blue'
            previous = dict(url=url, title='Sony WH-CH720N Blue', price=39900, checked='2026-10-10', detailVerified=True)
            out = root / 'data/eldorado.json'
            out.write_text(json.dumps([previous]), encoding='utf-8')
            (root / 'data/prices.json').write_text(json.dumps({'offers': {'sony': [dict(previous, shop='eldorado')]}}), encoding='utf-8')
            with patch.object(module, 'ROOT', root), patch.object(module, 'OUT', out), patch.object(module, 'get', return_value=html), \
                    patch.object(module.time, 'sleep'), patch.object(sys, 'argv', ['eldorado-fetch.py', '--offers-only', '--recheck-hours', '0']):
                self.assertEqual(module.main(), exit_code)
            result = json.loads(out.read_text(encoding='utf-8'))[0]
            self.assertEqual(result['price'], price)
            if day:
                self.assertEqual(result['checked'], day)
            return result


if __name__ == '__main__':
    unittest.main()
