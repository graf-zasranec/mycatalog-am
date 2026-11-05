"""Run with a Python environment containing Scrapling; no live network requests."""
import importlib.util, unittest
from datetime import datetime,timezone,timedelta
from pathlib import Path
from scrapling.parser import Selector
spec=importlib.util.spec_from_file_location('vesta',Path(__file__).with_name('vesta-discover.py'))
vesta=importlib.util.module_from_spec(spec);spec.loader.exec_module(vesta)
class DiscoveryTests(unittest.TestCase):
 def test_scope(self):
  for path,kind in [('/hamakargichner-monitorner/tpichner','printer'),('/manr-kencax/ody-xonavacnox','climate'),('/manr-kencax/choracnox-sarqer','climate'),('/manr-kencax/arduk','appliance'),('/audio-video-sarqavorumner/cameras','camera'),('/xnamqi-paraganer/axtahanox-sarq','garment_care'),('/xnamqi-paraganer/chnshum-chapox-sarq','health')]:self.assertEqual(vesta.category(path),kind)
  for path in ['/bjjayin-heraxosner/heraxosner','/nnjasenyaki-kahuyq','/mer-masin']:self.assertIsNone(vesta.category(path))
 def test_identity_and_recommendations(self):
  html='<div class="product-thumb"><h4><a href="/furniture">Recommendation</a></h4></div><div class="product-layout"><h4><a href="http://vesta.am/printer?limit=100">Canon</a></h4><a class="quickbox" href="/index.php?route=product/quick_view&amp;product_id=123"></a></div><div class="product-layout"><h4><a href="https://unrelated.test/advert">Ad</a></h4></div>'
  rows=vesta.extract_grid(Selector(html),'https://vesta.am/list','printer')
  self.assertEqual(len(rows),1);self.assertEqual(rows[0]['url'],'https://vesta.am/printer');self.assertEqual(rows[0]['sourceProductId'],'123')
 def test_stale_evidence(self):
  now=datetime(2026,11,5,16,tzinfo=timezone.utc)
  self.assertTrue(vesta.cache_fresh({'checkedAt':(now-timedelta(hours=2)).isoformat()},12,now))
  for info in [{'checkedAt':(now-timedelta(hours=13)).isoformat()},{'checkedAt':(now+timedelta(hours=1)).isoformat()},{'checkedAt':'invalid'},{'checkedAt':'2026-11-05T15:00:00'},{}]:self.assertFalse(vesta.cache_fresh(info,12,now))
  self.assertFalse(vesta.cache_fresh({'checkedAt':now.isoformat()},0,now))
if __name__=='__main__':unittest.main()
