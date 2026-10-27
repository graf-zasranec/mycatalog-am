"""Exercise real stock sweep with local fake merchant responses; no network/data writes."""
import importlib.util
import json
import pathlib
import sys
import tempfile
import threading
import time
import types

sys.dont_write_bytecode = True
ROOT = pathlib.Path(__file__).resolve().parent.parent
source = ROOT / 'tools/check-links.py'
lock = threading.Lock()
active = {}
peak = {}
overall = 0
overall_peak = 0

class Fetcher:
    @staticmethod
    def get(url, **kwargs):
        global overall, overall_peak
        host = url.split('/')[2]
        with lock:
            active[host] = active.get(host, 0) + 1
            peak[host] = max(peak.get(host, 0), active[host])
            overall += 1
            overall_peak = max(overall_peak, overall)
        time.sleep(0.02)
        with lock:
            active[host] -= 1
            overall -= 1
        n = int(url.rsplit('/', 1)[-1])
        availability = 'OutOfStock' if n % 2 else 'InStock'
        html = '<script type="application/ld+json">' + json.dumps({
            '@type': 'Product', 'offers': {'availability': availability}}) + '</script>'
        return types.SimpleNamespace(status=200, html_content=html)

fake = types.ModuleType('scrapling.fetchers')
fake.Fetcher = Fetcher
sys.modules['scrapling'] = types.ModuleType('scrapling')
sys.modules['scrapling.fetchers'] = fake
spec = importlib.util.spec_from_file_location('stock_fixture_subject', source)
subject = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subject)

with tempfile.TemporaryDirectory() as temp:
    temp = pathlib.Path(temp)
    subject.PRICES = temp / 'prices.json'
    subject.STATE = temp / 'state.json'
    subject.PRICES.write_text(json.dumps({'offers': {'fixture': [
        {'url': f'https://host{host}.invalid/{i}', 'shop': f'host{host}', 'id': str(i)}
        for host in range(4) for i in range(2)]}}))
    outcomes = []
    for workers in (1, 4):
        active.clear()
        peak.clear()
        overall_peak = 0
        sys.argv = [str(source), '--all', f'--workers={workers}', '--fresh']
        start = time.monotonic()
        urls, buckets = subject.check_all()
        elapsed = time.monotonic() - start
        assert len(urls) == 8
        assert len(buckets['soldout']) == 4
        assert all(v == 1 for v in peak.values()), peak
        assert len(json.loads(subject.STATE.read_text())) == 8
        if workers == 4:
            assert overall_peak >= 3, overall_peak
        outcomes.append({'workers': workers, 'seconds': round(elapsed, 3),
                         'global_peak': overall_peak, 'host_peak': peak.copy()})
    assert outcomes[1]['seconds'] < outcomes[0]['seconds'] * 0.6, outcomes
    # A retry resumes its own saved URL results without refetching them.
    sys.argv = [str(source), '--all', '--workers=4']
    def no_request(*args, **kwargs):
        raise AssertionError('checkpoint should avoid every repeat request')
    subject.Fetcher.get = no_request
    _, resumed = subject.check_all()
    assert len(resumed['soldout']) == 4
    assert len(json.loads(subject.STATE.read_text())) == 8
    print('STOCK_SWEEP_PASS ' + json.dumps(outcomes))
