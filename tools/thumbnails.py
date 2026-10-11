"""Small derivatives of the exact verified product photos, never alternate photos."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = root / 'images' / 'thumb'
out.mkdir(exist_ok=True)
manifest = {}
previews = {}
before = after = 0
for source in sorted((root / 'images' / 'cut').glob('*.webp')):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
    dest = out / f'{source.stem}-{digest}.webp'
    with Image.open(source) as original:
        full_width = original.width
        body = original.convert('RGBA').getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
        scale = min(1, 800 / max(original.size))
        if original.width > 800 and body and max(body[2]-body[0], body[3]-body[1]) * scale >= 600:
            preview = dest.with_name(dest.stem + '-800.webp')
            if not preview.exists():
                original.thumbnail((800, 800), Image.Resampling.LANCZOS)
                original.save(preview, 'WEBP', quality=88, method=4)
            with Image.open(preview) as ready:
                previews[source.relative_to(root).as_posix()] = {
                    'src': preview.relative_to(root).as_posix(), 'width': ready.width,
                    'fullWidth': full_width
                }
    if not dest.exists():
        with Image.open(source) as image:
            image.thumbnail((480, 480), Image.Resampling.LANCZOS)
            image.save(dest, 'WEBP', quality=85, method=1)
    compact = dest.with_name(dest.stem + '-240.webp')
    if not compact.exists():
        with Image.open(source) as image:
            image.thumbnail((240, 240), Image.Resampling.LANCZOS)
            image.save(compact, 'WEBP', quality=85, method=1)
    medium = dest.with_name(dest.stem + '-320.webp')
    if not medium.exists():
        with Image.open(source) as image:
            image.thumbnail((320, 320), Image.Resampling.LANCZOS)
            image.save(medium, 'WEBP', quality=85, method=1)
    manifest[source.as_posix().removeprefix(root.as_posix() + '/')] = dest.as_posix().removeprefix(root.as_posix() + '/')
    before += source.stat().st_size
    after += dest.stat().st_size
(root / 'data' / 'thumbnails.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
(root / 'data' / 'photo-previews.json').write_text(json.dumps(previews, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'{len(manifest)} exact-photo thumbnails: {before:,} -> {after:,} bytes')
