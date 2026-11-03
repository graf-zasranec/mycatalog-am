"""Read actual local href/src attributes using the document's first HTML base URL."""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, unquote

class _References(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.base = None
        self.references = []
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'base':
            if self.base is None and values.get('href'):
                self.base = values['href']
            return
        self.references.extend((key, value) for key, value in attrs
                               if key in ('href', 'src') and value)

def local_asset_references(markup, page):
    parser = _References()
    parser.feed(markup)
    base = 'https://better.am/' + page
    if parser.base is not None:
        base = urljoin(base, parser.base)
    output = []
    for attribute, value in parser.references:
        original = urlsplit(value)
        if not original.path:
            continue
        target = urlsplit(urljoin(base, value))
        if target.scheme != 'https' or target.netloc != 'better.am':
            continue
        output.append((attribute, unquote(target.path).lstrip('/')))
    return output
