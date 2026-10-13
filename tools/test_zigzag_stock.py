import unittest
from zigzag_stock import stock_of

class StockTests(unittest.TestCase):
    def test_actual_sold_out_markup(self):
        self.assertIs(stock_of('<div class="product-info-main"><div class="stock status_block out_stock" title="Availability"><span>Out of stock</span></div></div>'), False)
    def test_actual_available_markup(self):
        self.assertIs(stock_of('<div class="product-info-main"><div class="stock status_block in_stock" title="Availability"><span>In stock</span></div></div>'), True)
    def test_related_sold_out_does_not_hide_available_product(self):
        self.assertIs(stock_of('<div class="product-info-main"><div title="Availability" class="stock in_stock"><span>In stock</span></div></div><section class="related out-of-stock">Out of stock</section>'), True)
    def test_related_available_does_not_revive_sold_out_product(self):
        self.assertIs(stock_of('<div class="product-info-main"><div title="Availability" class="stock out_stock"><span>Out of stock</span></div></div><section class="related in-stock">In stock</section>'), False)
    def test_related_availability_before_primary_cannot_revive_product(self):
        self.assertIs(stock_of('<section class="related"><div class="stock in_stock" title="Availability">In stock</div></section><div class="product-info-main"><div class="stock out_stock" title="Availability">Առկա չէ</div></div>'), False)
    def test_armenian_text_without_status_class(self):
        self.assertIs(stock_of('<div class="product-info-main"><div title="Availability">Առկա չէ</div></div>'), False)
    def test_unknown_is_not_asserted_available(self):
        self.assertIsNone(stock_of('<html><h1>Access denied</h1></html>'))

if __name__=='__main__':unittest.main()
