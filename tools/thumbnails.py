"""Small derivatives of the exact verified product photos, never alternate photos."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = root / 'images' / 'thumb'
out.mkdir(exist_ok=True)
manifest = {}
before = after = 0
for source in sorted((root / 'images' / 'cut').glob('*.webp')):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
    dest = out / f'{source.stem}-{digest}.webp'
    if not dest.exists():
        with Image.open(source) as image:
            image.thumbnail((480, 480), Image.Resampling.LANCZOS)
            image.save(dest, 'WEBP', quality=85, method=1)
    manifest[source.as_posix().removeprefix(root.as_posix() + '/')] = dest.as_posix().removeprefix(root.as_posix() + '/')
    before += source.stat().st_size
    after += dest.stat().st_size
(root / 'data' / 'thumbnails.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'{len(manifest)} exact-photo thumbnails: {before:,} -> {after:,} bytes')
