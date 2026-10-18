"""Regression: almost-invisible export residue must not shrink the real product."""
import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
from PIL import Image

spec = importlib.util.spec_from_file_location('place_cut', Path(__file__).with_name('place-cut.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
report = Path(__file__).resolve().parents[1] / '.codex' / 'reports' / 'photo-framing-tests'
report.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(dir=report) as name:
    root = Path(name).resolve()
    assert root.is_relative_to(report.resolve())
    (root / 'images' / 'cut').mkdir(parents=True)
    source = Image.new('RGBA', (2000, 1500), (255, 0, 0, 1))
    source.paste((25, 40, 70, 255), (650, 250, 1350, 1250))
    path = root / 'source.png'
    source.save(path)
    module.ROOT = root
    previous = sys.argv
    try:
        sys.argv = ['place-cut.py', 'framing-regression', str(path)]
        with contextlib.redirect_stdout(io.StringIO()):
            module.main()
    finally:
        sys.argv = previous
    result = Image.open(root / 'images' / 'cut' / 'framing-regression__main.webp').convert('RGBA')
    bounds = result.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
    extent = max(bounds[2] - bounds[0], bounds[3] - bounds[1])
    assert extent >= 900, f'Invisible alpha residue shrank a1000pxproduct to{extent}px'
    assert min(result.size) >= 700
    assert result.getpixel((0, 0))[3] == 0
print('PLACE_CUT_PASS: faint background residue cannot shrink the real product')
