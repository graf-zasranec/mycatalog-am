from html.parser import HTMLParser

class _Availability(HTMLParser):
    def __init__(self):
        super().__init__(); self.depth=0; self.classes=set(); self.text=[]; self.found=False
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if self.depth:
            if tag not in {'br','img','input','meta','link','hr'}:self.depth+=1
        elif not self.found and attrs.get('title','').lower()=='availability':
            self.found=True;self.depth=1;self.classes=set(attrs.get('class','').lower().split())
    def handle_endtag(self, tag):
        if self.depth:self.depth-=1
    def handle_data(self, data):
        if self.depth:self.text.append(data)

def stock_of(html):
    """Read the main product's own status, never related-card text."""
    p=_Availability();p.feed(html)
    if not p.found:return None
    if p.classes & {'out_stock','out-of-stock','outofstock'}:return False
    if p.classes & {'in_stock','in-stock','instock','available'}:return True
    text=' '.join(p.text).strip().lower()
    if text=='out of stock':return False
    if text=='in stock':return True
    return None
