import unittest
from html_references import local_asset_references
class StaticReferencesTests(unittest.TestCase):
 def test_base_relative_assets_and_synthetic_loader_data(self):
  page='<base href="../../"><img src="images/cut/exact.webp"><script data-src="data/a.js data/b.js"></script><script src="data/boot.js?v=1"></script>'
  self.assertEqual(local_asset_references(page,'p/exact/index.html'),[('src','images/cut/exact.webp'),('src','data/boot.js')])
 def test_real_missing_asset_remains_an_auditable_reference(self):
  self.assertEqual(local_asset_references('<img src="/images/missing.webp">','en/p/exact/index.html'),[('src','images/missing.webp')])
 def test_external_fragment_and_entities(self):
  self.assertEqual(local_asset_references('<a href="#specs">x</a><img src="https://retailer.example/a.webp"><a href="/en/p/a/?x=1&amp;y=2">a</a>','en/index.html'),[('href','en/p/a/')])
if __name__=='__main__':unittest.main()
