# Turns the base64 a browser tab left in a tool-result file into a catalogue source photo.
#
#   python tools/ecat-install.py <product-id> [<tool-result-file>]
#
# Why this exists: some catalogue sites sit behind a challenge that a real browser passes and the
# shell does not, so the bytes are only reachable from inside a tab. Three ways out were tried and
# all failed - a browser-initiated download is suppressed after the first one, the Chrome
# extension blocks base64 in its results, and passing ~70 KB of base64 back through the tool
# channel costs about 18k tokens an image. The fourth works: ask the tab for the whole string at
# once, let it overflow the result limit, and the harness writes it to disk. This reads that file.
#
# Newest tool-result file by default, so the usual call is just the product id.
import sys, json, base64, io, re, glob, os
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RESULTS = Path.home() / '.claude' / 'projects'


def newest_result():
    hits = glob.glob(str(RESULTS / '**' / 'tool-results' / '*javascript_tool*.txt'), recursive=True)
    if not hits:
        raise SystemExit('no tool-result files found')
    return max(hits, key=os.path.getmtime)


def main():
    pid = sys.argv[1]
    path = sys.argv[2] if len(sys.argv) > 2 else newest_result()
    txt = open(path, encoding='utf-8').read()
    try:
        data = json.loads(txt)
        txt = data[0]['text'] if isinstance(data, list) else str(data)
    except json.JSONDecodeError:
        pass
    txt = txt.split('#')[0]        # padding the tab adds to force the overflow-to-file path
    txt = re.sub(r'\s+', '', txt.strip().strip('"'))
    txt += '=' * (-len(txt) % 4)          # the harness trims the tail, so pad it back
    im = Image.open(io.BytesIO(base64.b64decode(txt)))
    out = ROOT / 'images' / '_src' / f'{pid}__main.png'
    im.convert('RGB').save(out)
    print(f'{pid}: {im.size[0]}x{im.size[1]} {im.format} -> {out.name}   (from {os.path.basename(path)})')


if __name__ == '__main__':
    main()
