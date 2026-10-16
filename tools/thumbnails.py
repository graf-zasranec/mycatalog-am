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
old_manifest = json.loads((root / 'data' / 'thumbnails.json').read_text()) if (root / 'data' / 'thumbnails.json').exists() else {}
old_previews = json.loads((root / 'data' / 'photo-previews.json').read_text()) if (root / 'data' / 'photo-previews.json').exists() else {}
before = after = 0
# Draft assets stay on disk but are not shipped until their product is accepted.
product_ids = {p['id'] for p in json.loads((root / 'data' / 'phones.json').read_text(encoding='utf-8'))}
for source in sorted((root / 'images' / 'cut').glob('*.webp')):
    if source.stem.split('__')[0] not in product_ids:
        continue
    digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
    dest = out / f'{source.stem}-{digest}.webp'
    key = source.relative_to(root).as_posix()
    cached_preview = old_previews.get(key)
    derivatives = [dest, dest.with_name(dest.stem + '-240.webp'), dest.with_name(dest.stem + '-320.webp')]
    if old_manifest.get(key) == dest.relative_to(root).as_posix() and all(p.exists() for p in derivatives) and (not cached_preview or (root / cached_preview['src']).exists()):
        manifest[key] = old_manifest[key]
        if cached_preview:
            previews[key] = cached_preview
        before += source.stat().st_size
        after += dest.stat().st_size
        continue
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
