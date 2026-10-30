# Per-shop access header for shops whose Cloudflare challenges our crawler (Eldorado and iStore,
# 2026-10-30). Both approved crawling (owner, 2026-10-10); the shop adds one Cloudflare rule
# "Skip when header X-Better-Access equals <key>", which holds whatever IP the Mac or a GitHub
# runner has. Keys are secrets: read from $BETTER_SHOP_KEYS (JSON) or ~/.config/better/shop-keys.json,
# never stored in the repository. No key for a host means no header, so nothing changes for it.
import json, os
from pathlib import Path
from urllib.parse import urlparse

def _load():
    raw = os.environ.get('BETTER_SHOP_KEYS')
    if not raw:
        path = Path.home() / '.config' / 'better' / 'shop-keys.json'
        raw = path.read_text(encoding='utf-8') if path.exists() else '{}'
    try:
        return {k.lower(): v for k, v in json.loads(raw).items() if v}
    except ValueError:
        return {}

_KEYS = _load()

def headers_for(url):
    host = (urlparse(url).hostname or '').lower().removeprefix('www.')
    key = _KEYS.get(host)
    return {'X-Better-Access': key} if key else {}
