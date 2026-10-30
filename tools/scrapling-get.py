# Long-lived page reader for shops whose firewall refuses GitHub's servers (AllSell 403, iStore empty).
# All catalogue shops approved crawling (owner, 2026-10-10). scrape.mjs starts this once and sends one
# url per line; each answer is one JSON line {status, html}. Same reader Eldorado and Zigzag use.
import json, os, sys
from scrapling.fetchers import Fetcher
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shop_access import headers_for

for line in sys.stdin:
    url = line.strip()
    if not url:
        continue
    try:
        page = Fetcher.get(url, impersonate='chrome', timeout=40, headers=headers_for(url))
        out = {'status': page.status, 'html': page.html_content if page.status == 200 else ''}
    except Exception as exc:  # a dead page must not stop the reader
        out = {'status': 0, 'html': '', 'error': str(exc)[:200]}
    sys.stdout.write(json.dumps(out) + '\n')
    sys.stdout.flush()
