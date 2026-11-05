"""Discover Vesta product URLs with Scrapling; never publish listing-grid prices.
Requires Scrapling in a separate venv. Raw evidence and resumable page cache stay
under .codex/reports; only independently reviewed exact SKUs enter the manifest.
"""
import argparse, concurrent.futures, gzip, hashlib, json, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qs
from urllib.robotparser import RobotFileParser
from scrapling.fetchers import Fetcher


def canonical(value, base='https://vesta.am/'):
    s=urlsplit(urljoin(base,value))
    if s.hostname not in ('vesta.am','www.vesta.am'): return None
    return urlunsplit(('https','vesta.am',s.path,'',''))


def category(path):
    if path.startswith('/hamakargichner-monitorner/'):
        return {'notbukner':'laptop','monitorner':'monitor','hamakargichner':'desktop','drones':'drone','tesaxagher':'console'}.get(path.rsplit('/',1)[-1])
    if path.startswith('/sarnaranner-sarcaranner/') or path.startswith('/lvacqi-meqenaner-choranocner/') or path.startswith('/aman-lvalu-meqena/') or path.startswith('/nerkarucvogh-texnika/'): return 'largeappliance'
    if path.startswith('/odorakichner/'): return 'climate'
    if path=='/bjjayin-heraxosner/akanjakalner': return 'headphones'
    if path=='/bjjayin-heraxosner/jamacuycner-brasletner': return 'watch'
    if path=='/bjjayin-heraxosner/mobile-aqsesuarner': return 'powerbank'  # candidates only; unrelated accessories must be excluded during matching
    if path=='/audio-video-sarqavorumner/audio-nvagarkichner': return 'speaker'
    if path.startswith('/manr-kencax/poshekulner'): return 'vacuum'
    if path.startswith('/manr-kencax/arduk'): return 'appliance'
    if path=='/manr-kencax/ody-maqrwx-sarq': return 'purifier'
    if path=='/manr-kencax/srchepner' or path=='/manr-kencax/srchaghacner': return 'coffee'
    if path.startswith('/manr-kencax/'): return 'kitchen'
    if path.startswith('/xnamqi-paraganer/varsahardarich'): return 'haircare'
    if path in ['/xnamqi-paraganer/aceliner','/xnamqi-paraganer/maz-ktrelu-sarq','/xnamqi-paraganer/epilyator','/xnamqi-paraganer/atami-elektrakan-xozanak']: return 'grooming'
    return None


def extract_grid(page, base, kind):
    out=[]
    for card in page.css('.product-layout'):
        a=card.css('h4 a')
        if not a: continue
        url=canonical(a[0].attrib.get('href',''),base)
        title=a[0].get_all_text().strip()
        if not url or not title: continue
        image=card.css('.image img::attr(src)').get()
        out.append({'url':url,'title':title,'category':kind,'listingImage':image,'listingPage':base})
    return out


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--report',default='.codex/reports/2026-11-05-vesta-import');args=ap.parse_args();root=Path(args.report);root.mkdir(parents=True,exist_ok=True)
    robots=Fetcher.get('https://vesta.am/robots.txt',timeout=25)
    rp=RobotFileParser();rp.parse(robots.get_all_text().splitlines() if robots.status==200 else [])
    if robots.status not in (200,404,410): raise RuntimeError('Robots status unresolved; retry later')
    if not (root/'categories.json').exists():
        home=Fetcher.get('https://vesta.am/',timeout=35)
        if home.status!=200: raise RuntimeError('Homepage unavailable')
        cats=[{'url':canonical(a.attrib.get('href','')),'title':a.get_all_text().strip()} for a in home.css('a') if canonical(a.attrib.get('href',''))]
        (root/'categories.json').write_text(json.dumps(cats,ensure_ascii=False,indent=2))
    cats=json.loads((root/'categories.json').read_text());jobs={canonical(x['url']):category(urlsplit(x['url']).path) for x in cats if category(urlsplit(x['url']).path)}
    # Parent categories already include subcategories. Avoid duplicate HTTP work.
    jobs={u:k for u,k in jobs.items() if not any(u.startswith(parent+'/') for parent in jobs if parent!=u)}
    cache=root/'discovery-cache';cache.mkdir(exist_ok=True)
    def crawl(item):
        base,kind=item;found={};errors=[];visited=set();pending=[base+'?limit=100']
        while pending:
            url=pending.pop(0)
            if url in visited: continue
            visited.add(url)
            if not rp.can_fetch('*',url):errors.append({'url':url,'error':'robots disallowed'});continue
            key=hashlib.sha256(url.encode()).hexdigest();file=cache/(key+'.html.gz');meta=cache/(key+'.json')
            try:
                if meta.exists() and file.exists():
                    from scrapling.parser import Selector
                    info=json.loads(meta.read_text());page=Selector(gzip.decompress(file.read_bytes()).decode())
                else:
                    page=Fetcher.get(url,timeout=35,retries=1)
                    if page.status!=200:raise RuntimeError('HTTP '+str(page.status))
                    html=page.html_content;file.write_bytes(gzip.compress(html.encode()));info={'url':url,'checkedAt':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(html.encode()).hexdigest()};meta.write_text(json.dumps(info))
                    time.sleep(.7)
                rows=extract_grid(page,url,kind)
                if not rows: raise RuntimeError('No main-grid cards; inspect category manually')
                for r in rows: found[r['url']]={**r,'discoveredAt':info['checkedAt'],'listingSHA256':info['sha256']}
                for a in page.css('.pagination a'):
                    target=urljoin(url,a.attrib.get('href',''));s=urlsplit(target);q=parse_qs(s.query)
                    if canonical(target)==base and q.get('page') and int(q['page'][0])<=100:
                        normalized=base+'?limit=100&page='+q['page'][0]
                        if normalized not in visited:pending.append(normalized)
                (cache/(hashlib.sha256(base.encode()).hexdigest()+'.rows.json')).write_text(json.dumps(list(found.values()),ensure_ascii=False,indent=2))
            except Exception as e:errors.append({'url':url,'error':str(e)})
        print(json.dumps({'category':base,'pages':len(visited),'products':len(found),'errors':len(errors)}),flush=True)
        return list(found.values()),errors
    rows={};errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for found,err in pool.map(crawl,jobs.items()):
            for r in found:rows[r['url']]=r
            errors.extend(err)
            (root/'discovered-other-products.json').write_text(json.dumps(list(rows.values()),ensure_ascii=False,indent=2))
            (root/'discovery-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2))
    print(json.dumps({'categories':len(jobs),'uniqueProducts':len(rows),'errors':len(errors)}))

if __name__=='__main__':main()
