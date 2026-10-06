"""Check every published page, structured-data image and local link before deployment."""
import json, os, re, sys
from pathlib import Path
from urllib.parse import urlsplit, unquote
from PIL import Image

root = Path(__file__).resolve().parent.parent
products = {p['id']: p for p in json.loads((root/'data/phones.json').read_text(encoding='utf8'))}
offers = json.loads((root/'data/prices.json').read_text(encoding='utf8'))['offers']
pages = [root/'index.html']
for folder in ['p','c','b','ru','en']:
    pages += list((root/folder).rglob('index.html'))
errors = []
def fail(file, why): errors.append({'file': str(file.relative_to(root)), 'error': why})
def nodes(value):
    if isinstance(value, dict):
        yield value
        for child in value.values(): yield from nodes(child)
    elif isinstance(value, list):
        for child in value: yield from nodes(child)
for file in pages:
    text = file.read_text(encoding='utf8')
    markup = re.sub(r'(<script\b[^>]*>).*?(</script>)',r'\1\2',text,flags=re.S)
    redirect = 'http-equiv="refresh"' in text.lower()
    if not redirect and '<h1' not in markup.lower(): fail(file,'Missing static heading')
    for attr,url in re.findall(r'\b(href|src)="([^"]+)"',markup):
        parsed=urlsplit(url.replace('&amp;','&'))
        if parsed.scheme and not (parsed.scheme=='https' and parsed.netloc=='better.am'): continue
        if parsed.netloc and parsed.netloc!='better.am': continue
        if not parsed.path: continue
        target=(root/unquote(parsed.path).lstrip('/')) if parsed.netloc or parsed.path.startswith('/') else file.parent/unquote(parsed.path)
        if parsed.path.endswith('/'): target/='index.html'
        if not target.exists(): fail(file,'Missing local '+attr+': '+url)
    for script in re.findall(r'<script type="application/ld\+json">(.*?)</script>',text,re.S):
        try: schema=json.loads(script)
        except json.JSONDecodeError as e: fail(file,'Invalid JSON-LD '+str(e)); continue
        for item in nodes(schema):
            if item.get('@type')!='Product': continue
            pid=file.parent.name
            image=item.get('image')
            if isinstance(image,str):
                imagepath=urlsplit(image).path.lstrip('/')
                if not (root/imagepath).is_file(): fail(file,'Missing Product image: '+image)
                if file.parent.parent.name=='p' and pid in products and pid not in imagepath: fail(file,'Product image belongs to another model')
            elif file.parent.parent.name=='p' and pid in products: fail(file,'Product has no actual image')
            offer=item.get('offers')
            if pid in products and offer and not offers.get(pid): fail(file,'No-shop product claims a price offer')
    if not redirect and file.parent.parent.name=='p' and file.parent.name not in products: fail(file,'Orphan product page')
images=list((root/'images/cut').glob('*.webp'))
for file in images:
    try:
        with Image.open(file) as im: im.verify()
    except Exception as e: fail(file,'Corrupt image '+str(e))
sitemap=(root/'sitemap.xml').read_text(encoding='utf8')
for url in re.findall(r'<loc>(.*?)</loc>',sitemap):
    path=urlsplit(url).path.lstrip('/')
    target=root/path
    if not path or path.endswith('/'): target/='index.html'
    if not target.is_file(): fail(root/'sitemap.xml','Missing sitemap target '+url)
result={'pages':len(pages),'imageFiles':len(images),'sitemapURLs':len(re.findall(r'<loc>',sitemap)),'errors':errors}
out=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--report=')),None)
if out: Path(out).write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps({**result,'errors':errors[:15]}))
sys.exit(bool(errors))
